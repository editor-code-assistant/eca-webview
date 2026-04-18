import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { webviewSend } from '../../hooks';
import { clearLogEntries, LogEntry, selectLogEntries, selectLogSessionIds } from '../../redux/slices/logs';
import { useEcaDispatch } from '../../redux/store';
import './LogsTab.scss';

// 8-char truncation matches the formatting used in the on-disk log file
// so copy/pasting from either surface produces recognisable IDs.
const SESSION_ID_DISPLAY_LEN = 8;

function formatTs(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

export function LogsTab() {
    const dispatch = useEcaDispatch();
    const entries = useSelector(selectLogEntries);
    const sessionIds = useSelector(selectLogSessionIds);

    const [sessionFilter, setSessionFilter] = useState<string>('__all__');
    const [errorsOnly, setErrorsOnly] = useState(false);
    const [autoscroll, setAutoscroll] = useState(true);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Request a fresh snapshot on mount so entries captured before the
    // webview connected (e.g. early download / version check messages)
    // are visible. The response comes back as a `logs/snapshot` message,
    // dispatched to redux from RootWrapper.
    useEffect(() => {
        webviewSend('logs/snapshot', {});
    }, []);

    const filtered = useMemo(() => {
        return entries.filter((e) => {
            if (errorsOnly && e.level !== 'error') return false;
            if (sessionFilter !== '__all__') {
                if (sessionFilter === '__none__') {
                    if (e.sessionId) return false;
                } else if (e.sessionId !== sessionFilter) {
                    return false;
                }
            }
            return true;
        });
    }, [entries, sessionFilter, errorsOnly]);

    // Autoscroll — only when the user has the toggle on and is already
    // near the bottom. If they've scrolled up to read something, we
    // never yank the view back.
    useEffect(() => {
        if (!autoscroll) return;
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [filtered, autoscroll]);

    const handleClear = () => {
        // Clear both the webview cache and the main-side ring buffer.
        // The on-disk log file is intentionally left intact so that
        // pre-clear history is still available for bug reports.
        dispatch(clearLogEntries());
        webviewSend('logs/clear', {});
    };

    const handleOpenFolder = () => {
        webviewSend('logs/openFolder', {});
    };

    return (
        <div className="logs-tab">
            <p className="tab-description">
                stderr and lifecycle output from the ECA server process. Also
                written to the on-disk log file — useful for attaching to
                bug reports.
            </p>

            <div className="logs-toolbar">
                <label className="logs-filter">
                    Session:
                    <select
                        value={sessionFilter}
                        onChange={(e) => setSessionFilter(e.target.value)}>
                        <option value="__all__">All</option>
                        {sessionIds.length > 0 && <option value="__none__">(pre-session)</option>}
                        {sessionIds.map((id) => (
                            <option key={id} value={id}>{id.slice(0, SESSION_ID_DISPLAY_LEN)}</option>
                        ))}
                    </select>
                </label>

                <label className="logs-checkbox">
                    <input
                        type="checkbox"
                        checked={errorsOnly}
                        onChange={(e) => setErrorsOnly(e.target.checked)} />
                    Errors only
                </label>

                <label className="logs-checkbox">
                    <input
                        type="checkbox"
                        checked={autoscroll}
                        onChange={(e) => setAutoscroll(e.target.checked)} />
                    Autoscroll
                </label>

                <span className="logs-spacer" />

                <button
                    className="logs-action-btn"
                    onClick={handleClear}
                    title="Clear the in-memory buffer (the log file is untouched)">
                    <i className="codicon codicon-clear-all"></i>
                    Clear
                </button>
                <button
                    className="logs-action-btn"
                    onClick={handleOpenFolder}
                    title="Reveal the eca-server.log file in your file manager">
                    <i className="codicon codicon-folder-opened"></i>
                    Open Folder
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="logs-empty">
                    <i className="codicon codicon-output"></i>
                    <p>{entries.length === 0 ? 'No logs yet' : 'No logs match the current filters'}</p>
                    {entries.length === 0 && (
                        <span className="empty-hint">
                            Server stderr and lifecycle messages will appear here as ECA runs.
                        </span>
                    )}
                </div>
            ) : (
                <div className="logs-viewport" ref={scrollRef}>
                    <pre className="logs-content">
                        {filtered.map((entry) => <LogRow key={entry.seq} entry={entry} />)}
                    </pre>
                </div>
            )}
        </div>
    );
}

function LogRow({ entry }: { entry: LogEntry }) {
    const levelClass = entry.level === 'error' ? 'level-error' : 'level-info';
    const sessionBadge = entry.sessionId
        ? entry.sessionId.slice(0, SESSION_ID_DISPLAY_LEN)
        : '—';
    return (
        <span className={`log-row ${levelClass}`}>
            <span className="log-ts">{formatTs(entry.ts)}</span>
            <span className="log-session">{sessionBadge}</span>
            <span className="log-level">{entry.level === 'error' ? 'ERR' : 'INF'}</span>
            <span className="log-text">{entry.text}</span>
            {'\n'}
        </span>
    );
}
