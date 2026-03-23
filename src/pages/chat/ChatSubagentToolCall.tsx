import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SubagentDetails, ToolCallOutput } from '../../protocol';
import { ChatMessage } from '../../redux/slices/chat';
import { useEcaDispatch } from '../../redux/store';
import { toolCallApprove, toolCallReject } from '../../redux/thunks/chat';
import { useKeyPressedListener } from '../../hooks';
import { ApprovalActions } from './ApprovalActions';
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
    depth?: number;
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

function SubagentMessages({ messages, subagentChatId, depth }: { messages: ChatMessage[]; subagentChatId: string; depth: number }) {
    return (
        <div className="subagent-messages">
            {messages.map((message, index) => {
                switch (message.type) {
                    case 'text':
                        return (
                            <div key={`subagent-msg-${index}`} className="subagent-text-message">
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
                                    depth={depth}
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
    const depth = props.depth ?? 0;
    const { agent, task, activity } = useMemo(() => parseAgentArgs(props.argumentsText), [props.argumentsText]);
    const [expanded, setExpanded] = useState(false);

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

    const isActive = props.status === 'preparing' || props.status === 'run' || props.status === 'running';

    let statusIconClass: string;
    if (isActive) {
        statusIconClass = hasChildPendingApproval
            ? 'codicon-bell-dot pending-approval'
            : 'codicon-loading codicon-modifier-spin';
    } else {
        switch (props.status) {
            case 'succeeded':
                statusIconClass = 'codicon-check succeeded';
                break;
            case 'failed':
            case 'rejected':
                statusIconClass = 'codicon-error failed';
                break;
            default:
                statusIconClass = 'codicon-question';
        }
    }

    const stepsInfo = props.details?.step !== undefined
        ? `${props.details.step}${props.details.maxSteps ? '/' + props.details.maxSteps : ''} steps`
        : '';

    const description = props.summary || (activity ? activity : agent || props.name);

    const hasMessages = (props.subagentMessages ?? []).length > 0;

    const toggleExpanded = () => setExpanded(!expanded);

    return (
        <div
            className={`subagent-card depth-${Math.min(depth, 4)} ${isActive ? 'active' : ''} ${props.status}`}
            style={{ '--subagent-depth': depth } as React.CSSProperties}
        >
            <div className="subagent-card-header" onClick={toggleExpanded}>
                <motion.i
                    className="chevron codicon codicon-chevron-right"
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
                <i className="agent-icon codicon codicon-hubot" />
                <span className="subagent-description">{description}</span>
                {stepsInfo && <span className="subagent-steps-info">{stepsInfo}</span>}
                {props.totalTimeMs && <ChatTime ms={props.totalTimeMs} />}
                <span className="spacing" />
                <i className={`subagent-status codicon ${statusIconClass}`} />
            </div>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        className="subagent-card-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, opacity: { duration: 0.15 } }}
                        style={{ overflow: "hidden" }}
                    >
                        {!hasMessages && (
                            <div className="subagent-info">
                                {task && <div className="subagent-task">{task}</div>}
                                {!task && agent && <div className="subagent-agent-name">Agent: {agent}</div>}
                            </div>
                        )}
                        {hasMessages && (
                            <SubagentMessages
                                messages={props.subagentMessages!}
                                subagentChatId={props.subagentChatId || props.chatId}
                                depth={depth + 1}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <ApprovalActions
                waitingApproval={waitingApproval}
                onApprove={approveToolCall}
                onApproveAndRemember={approveToolCallAndRemember}
                onReject={rejectToolCall}
            />
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
