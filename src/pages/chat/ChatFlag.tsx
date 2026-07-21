import { memo } from "react";
import './ChatFlag.scss';

interface Props {
    text: string;
    // contentId + stable handlers keep the memo effective — see the same
    // pattern in ChatTextMessage (issue #18).
    contentId: string;
    onFork: (contentId: string) => void;
    onRemove: (contentId: string) => void;
}

export const ChatFlag = memo(({ text, contentId, onFork, onRemove }: Props) => {
    return (
        <div className="flag-banner">
            <span className="flag-label">🚩 {text}</span>
            <div className="flag-actions">
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
