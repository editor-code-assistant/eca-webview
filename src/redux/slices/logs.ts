import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { State } from "../store";

// Kept structurally compatible with `LogEntry` in src/main/log-store.ts.
// The desktop side is the authoritative producer; the webview only
// consumes entries as read-only data.
export interface LogEntry {
    ts: number;
    seq: number;
    sessionId?: string;
    source: 'server' | 'desktop';
    level: 'info' | 'error';
    text: string;
}

interface LogsState {
    entries: LogEntry[];
    maxEntries: number;
}

const DEFAULT_MAX_ENTRIES = 5000;

export const logsSlice = createSlice({
    name: 'logs',
    initialState: {
        entries: [],
        maxEntries: DEFAULT_MAX_ENTRIES,
    } as LogsState,
    reducers: {
        /** Replace the whole buffer — used by the `logs/snapshot` response
         * when LogsTab mounts, so the user sees everything captured before
         * the webview connected. */
        setLogEntries: (state, action: PayloadAction<LogEntry[]>) => {
            const next = action.payload.slice();
            if (next.length > state.maxEntries) {
                next.splice(0, next.length - state.maxEntries);
            }
            state.entries = next;
        },
        /** Append a single entry from the live `logs/appended` stream. */
        appendLogEntry: (state, action: PayloadAction<LogEntry>) => {
            const incoming = action.payload;
            // Dedup against seq: if we snapshot(), then receive an
            // already-buffered append before the snapshot arrives, we
            // must not double-insert. Entries are monotonic by seq.
            const last = state.entries[state.entries.length - 1];
            if (last && incoming.seq <= last.seq) return;
            state.entries.push(incoming);
            if (state.entries.length > state.maxEntries) {
                state.entries.splice(0, state.entries.length - state.maxEntries);
            }
        },
        /** Wipe the in-redux buffer. The main process owns the on-disk
         * log file and the authoritative in-memory store; the webview's
         * copy is strictly a display cache. */
        clearLogEntries: (state) => {
            state.entries = [];
        },
    },
});

export const { setLogEntries, appendLogEntry, clearLogEntries } = logsSlice.actions;

// Selectors
export const selectLogEntries = (state: State) => state.logs.entries;

export const selectErrorLogCount = (state: State) =>
    state.logs.entries.reduce((n, e) => n + (e.level === 'error' ? 1 : 0), 0);

export const selectLogSessionIds = (state: State) => {
    const seen = new Set<string>();
    for (const e of state.logs.entries) {
        if (e.sessionId) seen.add(e.sessionId);
    }
    return Array.from(seen);
};
