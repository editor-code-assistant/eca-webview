import { memo } from "react";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
    role: string,
    text: string,
    onRollbackClicked: () => void;
}

export const ChatTextMessage = memo(({ role, text, onRollbackClicked }: Props) => {
    return (
        <div className={`${role}-message`}>
            {role === 'system' && (
                <span>{text}</span>
            )}
            {role != 'system' && (
                <MarkdownContent content={text} />
            )}
            {role === 'user' && (
                <div className="actions">
                    <button onClick={onRollbackClicked} className="rollback">↶</button>
                </div>
            )}
        </div>);
});
