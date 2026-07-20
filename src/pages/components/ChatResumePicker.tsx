import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatSummary } from "../../protocol";
import { useEcaDispatch } from "../../redux/store";
import { openChat } from "../../redux/thunks/chat";
import { relativeTime } from "../../util";
import './ChatResumePicker.scss';

interface ChatResumePickerProps {
    chats: ChatSummary[];
    /**
     * The empty placeholder the user clicked "Resume" from. When the
     * resume succeeds this chat is dropped from the tab list so the
     * user doesn't end up with the welcome view AND the resumed chat
     * side by side. Pass `undefined` if there's nothing to clean up.
     */
    originatingChatId?: string;
    onClose: () => void;
}

/**
 * Modal overlay listing every resumable chat. Picks one of:
 *   - search (substring on title)
 *   - keyboard navigation (↑/↓/Enter/Esc)
 *   - mouse click
 *
 * UX contract:
 *   1. Click a row → modal closes IMMEDIATELY (synchronous setState in
 *      the parent). The `chat/open` RPC is fired AFTER the close so the
 *      user gets instant visual feedback and the modal teardown isn't
 *      racing the cascade of `chat/cleared` + `chat/opened` + N ×
 *      `chat/contentReceived` reducers that run while the open response
 *      is in flight (those flow through `RootWrapper` listeners as
 *      normal). The thunk dispatches `selectChat` and drops the empty
 *      placeholder when the response confirms `found`.
 *   2. Click ✕ / Esc / backdrop → modal closes, no server traffic.
 *   3. Errors are logged to console (no inline banner). The modal is
 *      already gone by the time the dispatch might reject; a webview-
 *      wide toast/banner would be a worthwhile follow-up for the
 *      `{found: false}` edge case.
 */
export function ChatResumePicker({ chats, originatingChatId, onClose }: ChatResumePickerProps) {
    const dispatch = useEcaDispatch();
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Duplicate-title disambiguation. Append a relative-time suffix
    // to EVERY entry whose title collides — including the first
    // occurrence (fixing the off-by-one in the eca-emacs implementation
    // where the first dup kept the bare title and only second+ dups
    // got the suffix, leaving two identical-looking rows).
    const titleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of chats) {
            const t = c.title ?? '(Untitled)';
            counts[t] = (counts[t] ?? 0) + 1;
        }
        return counts;
    }, [chats]);

    const displayTitle = (c: ChatSummary) => {
        const t = c.title ?? '(Untitled)';
        if ((titleCounts[t] ?? 0) > 1) {
            // Disambiguate same-titled chats by appending the relative
            // time — much friendlier than an opaque id suffix. Falls
            // back to the short id if neither timestamp is available
            // (legacy rows that pre-date persistence).
            const ts = c.updatedAt ?? c.createdAt;
            const suffix = ts != null && Number.isFinite(ts)
                ? relativeTime(ts)
                : (c.id.length > 8 ? c.id.slice(-8) : c.id);
            return `${t} · ${suffix}`;
        }
        return t;
    };

    // Apply the title substring filter to the full list. Stable order
    // (already updatedAt-desc from the server) is preserved.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return chats;
        return chats.filter(c => (c.title ?? '').toLowerCase().includes(q));
    }, [chats, search]);

    // Snap selection back to a valid index whenever the filtered list
    // shrinks (e.g. user typed a more restrictive query).
    useEffect(() => {
        if (selectedIndex >= filtered.length) {
            setSelectedIndex(Math.max(0, filtered.length - 1));
        }
    }, [filtered.length, selectedIndex]);

    // Auto-focus the search box on mount so the picker is keyboard-
    // operable the moment it appears.
    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    // Keep the highlighted row in view as the user navigates with
    // arrow keys. Block scrolling on initial mount (selectedIndex=0)
    // is harmless because the list is already scrolled to the top.
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const row = list.querySelector<HTMLDivElement>(`[data-index="${selectedIndex}"]`);
        row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedIndex]);

    const resume = (chat: ChatSummary) => {
        // Close the modal first so the user gets instant visual feedback.
        // The `openChat` thunk's first action is a synchronous optimistic
        // dispatch (`beginResume`) that swaps the originating empty
        // placeholder for the resumed chat slot — React batches both
        // state updates into one render, so the user sees the tab swap
        // and the modal close happen together. The server replay then
        // fills the new slot in the background.
        onClose();
        dispatch(openChat({
            chatId: chat.id,
            originatingChatId,
            title: chat.title,
        }))
            .unwrap()
            .catch(err => {
                // No visible UI for this case yet; the modal is gone and
                // we don't have a toast system. Log so it's discoverable
                // from the host's webview devtools.
                console.error('Failed to resume chat:', err);
            });
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filtered.length === 0) return;
            setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filtered.length === 0) return;
            setSelectedIndex(i => Math.max(0, i - 1));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const target = filtered[selectedIndex];
            if (target) resume(target);
            return;
        }
    };

    // Backdrop click closes the picker. The inner panel stops the
    // mousedown so clicks inside the panel don't propagate up.
    const onBackdropClick = () => {
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                key="resume-picker-backdrop"
                className="resume-picker-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                onMouseDown={onBackdropClick}
                role="presentation"
            >
                <motion.div
                    key="resume-picker-panel"
                    className="resume-picker-panel"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    onMouseDown={e => { e.stopPropagation(); }}
                    onKeyDown={onKeyDown}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Resume a previous chat"
                >
                    <div className="resume-picker-header">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="resume-picker-search"
                            placeholder="Filter chats..."
                            value={search}
                            onChange={e => {
                                setSearch(e.target.value);
                                setSelectedIndex(0);
                            }}
                            aria-label="Filter chats"
                        />
                        <button
                            type="button"
                            className="resume-picker-close"
                            onClick={onClose}
                            aria-label="Close resume picker"
                        >
                            <i className="codicon codicon-close" />
                        </button>
                    </div>
                    <div className="resume-picker-list" ref={listRef} role="listbox">
                        {filtered.length === 0 ? (
                            <div className="resume-picker-empty">
                                {chats.length === 0 ? 'No previous chats' : 'No chats match your filter'}
                            </div>
                        ) : (
                            filtered.map((c, i) => (
                                <div
                                    key={c.id}
                                    data-index={i}
                                    className={`resume-picker-row${i === selectedIndex ? ' selected' : ''}`}
                                    role="option"
                                    aria-selected={i === selectedIndex}
                                    onMouseEnter={() => { setSelectedIndex(i); }}
                                    onClick={() => { resume(c); }}
                                >
                                    <div className="resume-picker-row-title">{displayTitle(c)}</div>
                                    <div className="resume-picker-row-meta">
                                        {c.model && <span className="resume-picker-row-model">{c.model}</span>}
                                        <span>{c.messageCount} {c.messageCount === 1 ? 'message' : 'messages'}</span>
                                        {(c.updatedAt ?? c.createdAt) && (
                                            <span>{relativeTime(c.updatedAt ?? c.createdAt)}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
