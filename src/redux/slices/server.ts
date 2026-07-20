import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import type { WorkspaceFolder } from "../../protocol";
import type { InitProgressTask} from '../../webviewProtocol';
import { ServerStatus } from '../../webviewProtocol';

export { ServerStatus } from '../../webviewProtocol';
export type { InitProgressTask } from '../../webviewProtocol';

interface EcaConfig {
    usageStringFormat?: string;
    chat: {
        models: string[];
        agents: string[];
        selectModel?: string;
        selectAgent?: string;
        welcomeMessage: string;
        variants: string[];
        selectedVariant: string | null;
    }
}

interface ServerState {
    status: ServerStatus;
    workspaceFolders: WorkspaceFolder[];
    activeSessionId: string | null;
    trust: boolean;
    config: EcaConfig;
    initTasks: InitProgressTask[];
}

interface ChatConfigUpdate {
    chatId?: string;
    usageStringFormat?: string;
    chat?: Partial<{
        models: string[];
        agents: string[];
        selectModel: string;
        selectAgent: string;
        welcomeMessage: string;
        variants: string[];
        selectVariant: string | null;
        selectTrust: boolean;
    }>;
}

/**
 * Single entry in the init-progress task list.
 *
 * The ECA server emits `$/progress` notifications with `type: 'start'` when
 * a new initialization task begins, then `type: 'finish'` on the same
 * `taskId` once it completes (see ProgressParams in src/main/protocol.ts
 * and eca-emacs's `eca--handle-progress` for the reference contract).
 *
 * We keep tasks as an ordered array (not a map) so the most recently
 * started task can be surfaced in the derived display string — mirroring
 * `eca-chat--init-progress-str` which prepends to an alist and reads the
 * head to get the "latest" title.
 */
const initialState: ServerState = {
        status: ServerStatus.Stopped,
        workspaceFolders: [],
        activeSessionId: null,
        trust: false,
        config: {
            chat: {
                models: [],
                agents: [],
                welcomeMessage: "",
                variants: [],
                selectedVariant: null,
            }
        },
        // Init-progress tasks arriving via the `$/progress` JSON-RPC
        // notification. Stored as an ordered list (insertion order) so
        // `selectInitProgressString` can identify the most recently
        // started task for the "N/M · title" display. Empty when no
        // tasks have been received yet or after a session reset.
        initTasks: [],
};

export const serverSlice = createSlice({
    name: 'server',
    initialState,
    reducers: {
        setStatus: (state, action: PayloadAction<ServerStatus>) => {
            state.status = action.payload;
        },
        setWorkspaceFolders: (state, action: PayloadAction<WorkspaceFolder[]>) => {
            state.workspaceFolders = action.payload;
        },
        /**
         * Upsert a single `$/progress` task. New taskIds are appended to
         * preserve arrival order (so "latest active" == last inserted
         * task with type 'start'). Known taskIds are updated in place —
         * this is how a task transitions 'start' → 'finish' without
         * losing its slot, matching eca-emacs's alist-assoc behavior.
         */
        upsertProgress: (state, action: PayloadAction<InitProgressTask>) => {
            const incoming = action.payload;
            const existing = state.initTasks.findIndex(t => t.taskId === incoming.taskId);
            if (existing === -1) {
                state.initTasks.push(incoming);
            } else {
                state.initTasks[existing] = incoming;
            }
        },
        /**
         * Clear all init-progress tasks. Called from the server-status
         * thunk on Stopped / Failed transitions so a restart starts from
         * a clean slate (stale tasks from a previous run shouldn't leak
         * into the next attempt's display).
         */
        resetInitProgress: (state) => {
            state.initTasks = [];
        },
        setConfig: (state, action: PayloadAction<ChatConfigUpdate>) => {
            // When `chatId` is present at the top level, the per-chat
            // trust value is for that chat alone (handled by the chat
            // slice's `applyConfigToChat`). The global `state.trust`
            // mirror should NOT be flipped — otherwise switching
            // between two chats with different trust would constantly
            // flicker the global icon. Selection mirrors (selectModel
            // / selectAgent / selectVariant) are still updated globally
            // so newly-created chats inherit the most recently selected
            // values per the per-chat scoping spec.
            const scopedToChat = !!action.payload.chatId;
            if (action.payload.usageStringFormat !== undefined) {
                state.config.usageStringFormat = action.payload.usageStringFormat;
            }
            if (action.payload.chat !== undefined) {
                if (action.payload.chat.models !== undefined) {
                    state.config.chat.models = action.payload.chat.models;
                }
                if (action.payload.chat.selectModel !== undefined) {
                    state.config.chat.selectModel = action.payload.chat.selectModel;
                }
                if (action.payload.chat.agents !== undefined) {
                    state.config.chat.agents = action.payload.chat.agents;
                }
                if (action.payload.chat.selectAgent !== undefined) {
                    state.config.chat.selectAgent = action.payload.chat.selectAgent;
                }
                if (action.payload.chat.welcomeMessage !== undefined) {
                    state.config.chat.welcomeMessage = action.payload.chat.welcomeMessage;
                }
                if (action.payload.chat.variants !== undefined) {
                    state.config.chat.variants = action.payload.chat.variants;
                }
                if (action.payload.chat.selectVariant !== undefined) {
                    state.config.chat.selectedVariant = action.payload.chat.selectVariant;
                }
                // Server-driven trust restore on chat resume (eca #426):
                // align the chat trust indicator with the server's
                // persisted per-chat :trust so the icon matches the
                // auto-approval behavior the server will apply for
                // subsequent tool calls in the resumed chat. Only
                // applied for non-scoped (legacy / session-wide)
                // payloads — see scopedToChat note above.
                if (!scopedToChat && action.payload.chat.selectTrust !== undefined) {
                    state.trust = action.payload.chat.selectTrust;
                }
            }
        },
        setSelectedVariant: (state, action: PayloadAction<string | null>) => {
            state.config.chat.selectedVariant = action.payload;
        },
        setTrust: (state, action: PayloadAction<boolean>) => {
            state.trust = action.payload;
        },
        setActiveSessionId: (state, action: PayloadAction<string | null>) => {
            state.activeSessionId = action.payload;
        },
    },
});

export const {
    setStatus,
    setWorkspaceFolders,
    setConfig,
    setSelectedVariant,
    setTrust,
    setActiveSessionId,
    upsertProgress,
    resetInitProgress,
} = serverSlice.actions

// Selectors for use with useSelector. Typed against a minimal state
// shape on purpose so this slice file doesn't have to import from
// store.ts (avoids a circular import during module load).
export const selectServerStatus = (state: { server: { status: ServerStatus } }) =>
    state.server.status;
export const selectIsServerReady = (state: { server: { status: ServerStatus } }) =>
    state.server.status === ServerStatus.Running;
export const selectIsServerStarting = (state: { server: { status: ServerStatus } }) =>
    state.server.status === ServerStatus.Starting;
export const selectIsServerFailed = (state: { server: { status: ServerStatus } }) =>
    state.server.status === ServerStatus.Failed;
// True while the server is in its post-`initialized` async phase
// (models/plugins/MCP/cleanup). Distinct from Starting (process
// spawning) and Running (fully ready for user input). See
// ServerStatus.Initializing for the full lifecycle notes.
export const selectIsServerInitializing = (state: { server: { status: ServerStatus } }) =>
    state.server.status === ServerStatus.Initializing;

/**
 * Derive the init-progress display string, mirroring eca-emacs's
 * `eca-chat--init-progress-str`:
 *
 *   "{finished}/{total} · {latest-active-title}"
 *
 * Returns `null` when there are no tasks, or when every task has
 * reached `type: 'finish'`. That null is the caller's cue to fall back
 * to the generic "Starting ECA server…" / "Waiting for ECA server…"
 * copy — so the progress line only shows up once the server has
 * actually announced something meaningful.
 *
 * "Latest active" is the most recently appended task with
 * `type: 'start'`. Because we push new tasks to the tail in
 * `upsertProgress`, a reverse scan gives us the most recent one in
 * O(n) without mutating the slice.
 */
export const selectInitProgressString = (
    state: { server: { initTasks: InitProgressTask[] } },
): string | null => {
    const tasks = state.server.initTasks;
    if (tasks.length === 0) return null;

    const total = tasks.length;
    let finished = 0;
    let latestActiveTitle: string | null = null;

    for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].type === 'finish') finished += 1;
    }
    for (let i = tasks.length - 1; i >= 0; i--) {
        if (tasks[i].type === 'start') {
            latestActiveTitle = tasks[i].title;
            break;
        }
    }

    if (latestActiveTitle === null) return null;
    return `${finished}/${total} · ${latestActiveTitle}`;
};
