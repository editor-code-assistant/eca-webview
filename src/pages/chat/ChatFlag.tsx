import { memo } from "react";
import './ChatFlag.scss';

interface Props {
    text: string;
    // contentId + stable handlers keep the memo effective — see the same
    // pattern in ChatTextMessage (issue #18).
    contentId: string;
    onRollback: (contentId: string) => void;
    onFork: (contentId: string) => void;
    onRemove: (contentId: string) => void;
}

export const ChatFlag = memo(({ text, contentId, onRollback, onFork, onRemove }: Props) => {
    return (
        <div className="flag-banner">
            <span className="flag-label">🚩 {text}</span>
            <div className="flag-actions">
                {/* The server keeps the flag, removing only what came after it,
                    so the chat can be rolled back to it again. */}
                <button onClick={() => onRollback(contentId)} className="flag-btn" title="Rollback to this flag">
                    <i className="codicon codicon-discard" />
                </button>
                <button onClick={() => onFork(contentId)} className="flag-btn" title="Fork from here">
                    <i className="codicon codicon-repo-forked" />
                </button>
                <button onClick={() => onRemove(contentId)} className="flag-btn flag-btn-remove" title="Remove flag">
                    <i className="codicon codicon-close" />
                </button>
            </div>
        </div>
    );
});
