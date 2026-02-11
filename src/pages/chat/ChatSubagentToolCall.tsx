import { memo, useMemo } from 'react';
import { SubagentDetails, ToolCallOutput } from '../../protocol';
import { ChatMessage } from '../../redux/slices/chat';
import { useEcaDispatch } from '../../redux/store';
import { toolCallApprove, toolCallReject } from '../../redux/thunks/chat';
import { useKeyPressedListener } from '../../hooks';
import { ChatCollapsableMessage } from './ChatCollapsableMessage';
import { ChatTextMessage } from './ChatTextMessage';
import { ChatToolCall } from './ChatToolCall';
import { ChatReason } from './ChatReason';
import { ChatHook } from './ChatHook';
import { ChatTime } from './ChatTime';
import './ChatSubagentToolCall.scss';

interface Props {
    chatId: string;
    toolCallId: string;
    name: string;
    status: string;
    argumentsText?: string;
    manualApproval: boolean;
    totalTimeMs?: number;
    outputs?: ToolCallOutput[];
    details?: SubagentDetails;
    summary?: string;
    subagentMessages?: ChatMessage[];
    subagentChatId?: string;
}

function parseAgentArgs(argumentsText?: string): { agent?: string; task?: string; activity?: string } {
    if (!argumentsText) return {};
    try {
        const parsed = JSON.parse(argumentsText);
        return {
            agent: parsed.agent,
            task: parsed.task,
            activity: parsed.activity,
        };
    } catch {
        return {};
    }
}

function SubagentMessages({ messages, subagentChatId }: { messages: ChatMessage[]; subagentChatId: string }) {
    return (
        <div className="subagent-messages">
            {messages.map((message, index) => {
                switch (message.type) {
                    case 'text':
                        return (
                            <div key={`subagent-msg-${index}`}>
                                <ChatTextMessage
                                    text={message.value}
                                    role={message.role}
                                    showRollback={false} />
                            </div>
                        );
                    case 'toolCall':
                        return (
                            <div key={`subagent-tc-${index}`}>
                                <ChatToolCall
                                    chatId={subagentChatId}
                                    toolCallId={message.id}
                                    name={message.name}
                                    origin={message.origin}
                                    status={message.status}
                                    outputs={message.outputs}
                                    details={message.details}
                                    totalTimeMs={message.totalTimeMs}
                                    manualApproval={message.manualApproval}
                                    summary={message.summary}
                                    argumentsText={message.argumentsText}
                                    subagentMessages={message.subagentMessages}
                                    subagentChatId={message.subagentChatId}
                                />
                            </div>
                        );
                    case 'reason':
                        return (
                            <div key={`subagent-reason-${index}`}>
                                <ChatReason
                                    id={message.id}
                                    status={message.status}
                                    totalTimeMs={message.totalTimeMs}
                                    content={message.content} />
                            </div>
                        );
                    case 'hook':
                        return (
                            <div key={`subagent-hook-${index}`}>
                                <ChatHook
                                    id={message.id}
                                    status={message.status}
                                    name={message.name}
                                    statusCode={message.statusCode}
                                    output={message.output}
                                    error={message.error}
                                />
                            </div>
                        );
                    default:
                        return null;
                }
            })}
        </div>
    );
}

function chatSubagentToolCall(props: Props) {
    const dispatch = useEcaDispatch();
    const { agent, task, activity } = useMemo(() => parseAgentArgs(props.argumentsText), [props.argumentsText]);

    const waitingApproval = props.manualApproval && props.status === 'run';
    const effectiveChatId = props.subagentChatId || props.chatId;

    // Check if any child tool call is waiting for approval
    const hasChildPendingApproval = useMemo(() => {
        return (props.subagentMessages ?? []).some(
            msg => msg.type === 'toolCall' && msg.status === 'run' && msg.manualApproval
        );
    }, [props.subagentMessages]);

    const rejectToolCall = () => {
        dispatch(toolCallReject({ chatId: effectiveChatId, toolCallId: props.toolCallId }));
    };

    const approveToolCall = () => {
        dispatch(toolCallApprove({ chatId: effectiveChatId, toolCallId: props.toolCallId }));
    };

    const approveToolCallAndRemember = () => {
        dispatch(toolCallApprove({ chatId: effectiveChatId, toolCallId: props.toolCallId, save: 'session' }));
    };

    useKeyPressedListener((e) => {
        if (!waitingApproval) return;

        const isEnter = e.key === 'Enter' && !e.shiftKey;
        const isShiftEnter = e.key === 'Enter' && e.shiftKey;
        const isEsc = e.key === 'Escape';

        if (isEnter) {
            e.preventDefault();
            approveToolCall();
            return;
        }
        if (isShiftEnter) {
            e.preventDefault();
            approveToolCallAndRemember();
            return;
        }
        if (isEsc) {
            e.preventDefault();
            rejectToolCall();
            return;
        }
    }, [waitingApproval]);

    let iconClass: string;
    switch (props.status) {
        case 'preparing':
        case 'run':
        case 'running':
            iconClass = hasChildPendingApproval
                ? 'codicon-bell-dot pending-approval'
                : 'codicon-loading codicon-modifier-spin';
            break;
        case 'succeeded':
            iconClass = 'codicon-check succeeded';
            break;
        case 'failed':
            iconClass = 'codicon-error failed';
            break;
        case 'rejected':
            iconClass = 'codicon-error failed';
            break;
        default:
            iconClass = 'codicon-question';
    }

    const stepsInfo = props.details?.step !== undefined
        ? ` (${props.details.step}${props.details.maxSteps ? '/' + props.details.maxSteps : ''} steps)`
        : '';

    const description = props.summary || (activity ? `${agent || 'agent'}: ${activity}` : `Subagent: ${agent || props.name}`);

    const hasMessages = (props.subagentMessages ?? []).length > 0;

    return (
        <div className="tool-call-wrapper subagent-tool-call-wrapper">
            <ChatCollapsableMessage
                className="tool-call subagent-tool-call"
                header={(toggleOpen) => (
                    <div className="header-content">
                        <span onClick={toggleOpen} className="description">{description}</span>
                        <span onClick={toggleOpen} className="subagent-steps-info">{stepsInfo}</span>
                        {props.totalTimeMs && <ChatTime ms={props.totalTimeMs} />}
                        <span onClick={toggleOpen} className="spacing"></span>
                        <i onClick={toggleOpen} className={`status codicon ${iconClass}`}></i>
                    </div>
                )}
                content={
                    <div className="subagent-content">
                        {!hasMessages && (
                            <div className="subagent-info">
                                {agent && <div className="subagent-info-row"><span className="label">Agent:</span> <span>{agent}</span></div>}
                                {task && <div className="subagent-info-row"><span className="label">Task:</span> <span className="task">{task}</span></div>}
                            </div>
                        )}
                        {hasMessages && (
                            <SubagentMessages
                                messages={props.subagentMessages!}
                                subagentChatId={props.subagentChatId || props.chatId}
                            />
                        )}
                    </div>
                }
            />
            {waitingApproval && (
                <div className="approval-actions">
                    <div className="approval-option">
                        <button onClick={approveToolCall} className="approve-btn">Accept</button>
                        <span className="approval-description">for this session</span>
                        <span className="approval-shortcut">(Enter)</span>
                    </div>
                    <div className="approval-option">
                        <button onClick={approveToolCallAndRemember} className="approve-remember-btn">Accept and remember</button>
                        <span className="approval-description">for this session</span>
                        <span className="approval-shortcut">(Shift + Enter)</span>
                    </div>
                    <div className="approval-option">
                        <button onClick={rejectToolCall} className="reject-btn">Reject</button>
                        <span className="approval-description">and tell ECA what to do differently</span>
                        <span className="approval-shortcut">(Esc)</span>
                    </div>
                </div>
            )}
        </div>
    );
}

const ChatSubagentToolCallMemo = memo((props: Props) => {
    return chatSubagentToolCall(props);
});

export function ChatSubagentToolCall(props: Props) {
    // Don't memoize while status is still changing
    if (props.status === 'preparing' || props.status === 'running' || props.status === 'run') {
        return chatSubagentToolCall(props);
    }
    return <ChatSubagentToolCallMemo {...props} />;
}
