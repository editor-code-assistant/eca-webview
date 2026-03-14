import { memo } from "react";
import { MarkdownContent } from "./MarkdownContent";
import './ChatTextMessage.scss';

interface Props {
    role: string,
    text: string,
    onRollbackClicked?: () => void;
    showRollback?: boolean;
}

export const ChatTextMessage = memo(({ role, text, onRollbackClicked, showRollback = true }: Props) => {
    if (role === 'system') {
        return (
            <div className="system-message">
                <span>{text}</span>
            </div>
        );
    }

    if (role === 'user') {
        return (
            <div className="user-message-card">
                <div className="user-message-content">
                    <MarkdownContent content={text} />
                </div>
                {showRollback && (
                    <button onClick={onRollbackClicked} className="rollback-btn" title="Rollback to this message">
                        <i className="codicon codicon-discard" />
                    </button>
                )}
            </div>
        );
    }

    // Assistant
    return (
        <div className="assistant-message">
            <MarkdownContent content={text} />
        </div>
    );
});
