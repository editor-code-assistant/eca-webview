import { memo } from "react";
import { ChatCollapsableMessage } from "./ChatCollapsableMessage";
import './ChatHook.scss';
import { MarkdownContent } from "./MarkdownContent";

interface Props {
    id: string,
    status: string,
    name: string,
    statusCode?: number,
    output?: string,
    error?: string,
}

function chatHook({ id, status, name, statusCode, output, error }: Props) {
    let label;
    let extraIconClass;
    if (status === 'finished') {
        label = `Executed hook '${name}'`;
        extraIconClass = 'codicon-discard';
    } else {
        label = `Running hook '${name}'`;
        extraIconClass = 'codicon-loading codicon-modifier-spin';
    }

    return status === 'finished' ? (
        <ChatCollapsableMessage
            className="hook"
            header={(toggleOpen) => (
                <div className="header-content">
                    <span key={`hook-${id}-label`} onClick={toggleOpen}>{label}</span>
                    <i key={`hook-${id}-icon`} onClick={toggleOpen} className={`icon codicon ${extraIconClass}`}></i>
                </div>
            )}
            content={
                <div style={{ display: 'inline' }}>
                    <p>Name: {name}</p>
                    <p>Status: {statusCode}</p>
                    {output && <p>Output: {output}</p>}
                    {error && <p>Error: {error}</p>}
                </div>
            }
        />
    ) : (
        <div className="hook empty">
            <span key={`hook-${id}-label`}>{label}</span>
            <i key={`hook-${id}-icon`} className={`icon codicon ${extraIconClass}`}></i>
        </div>
    );

};

const ChatHookMemo = memo((props: Props) => {
    return chatHook(props);
});

export function ChatHook(props: Props) {
    if (props.status !== 'finished') {
        return chatHook(props);
    }

    return (<div> <ChatHookMemo {...props} /> </div>);
}
