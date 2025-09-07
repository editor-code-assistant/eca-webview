import { memo } from "react";
import { ChatCollapsableMessage } from "./ChatCollapsableMessage";
import './ChatReason.scss';
import { ChatTime } from "./ChatTime";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
    id: string,
    status: string,
    content?: string,
    totalTimeMs?: number,
}

function chatReason({ id, status, content, totalTimeMs }: Props) {
    let label;
    let extraIconClass;
    if (status === 'done') {
        label = 'Thought';
        extraIconClass = 'codicon-sparkle';
    } else {
        label = 'Thinking';
        extraIconClass = 'codicon-loading codicon-modifier-spin';
    }

    return content ? (
        <ChatCollapsableMessage
            className="reason"
            header={(toggleOpen) => (
                <div className="header-content">
                    <span key={`reason-${id}-label`} onClick={toggleOpen}>{label}</span>
                    <i key={`reason-${id}-icon`} onClick={toggleOpen} className={`icon codicon ${extraIconClass}`}></i>
                    {totalTimeMs && <ChatTime ms={totalTimeMs} />}
                </div>
            )}
            content={
                <MarkdownContent content={content} />
            }
        />
    ) : (
        <div className="reason empty">
            <span key={`reason-${id}-label`}>{label}</span>
            <i key={`reason-${id}-icon`} className={`icon codicon ${extraIconClass}`}></i>
            {totalTimeMs && <ChatTime ms={totalTimeMs} />}
        </div>
    );

};

const ChatReasonMemo = memo((props: Props) => {
    return chatReason(props);
});

export function ChatReason(props: Props) {
    if (props.status !== 'done') {
        return chatReason(props);
    }

    return (<div> <ChatReasonMemo {...props} /> </div>);
}
