import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { ChatMessage } from '../../redux/slices/chat';
import { State, useEcaDispatch } from '../../redux/store';
import { addFlag, forkFromFlag, removeFlag, rollbackChat } from '../../redux/thunks/chat';
import { MessageErrorFallback, captureComponentStack } from '../components/ErrorFallback';
import { ChatHook } from './ChatHook';
import './ChatMessages.scss';
import { ChatReason } from './ChatReason';
import { ChatTextMessage } from './ChatTextMessage';
import { ChatFlag } from './ChatFlag';
import { ChatToolCall } from './ChatToolCall';

const messageVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0 },
};

const messageTransition = {
    type: "spring" as const,
    stiffness: 500,
    damping: 35,
    mass: 0.8,
};

interface ChatMessagesProps {
    children: React.ReactNode,
    chatId: string,
}

export function ChatMessages({ chatId, children }: ChatMessagesProps) {
    const dispatch = useEcaDispatch();
    const messages = useSelector((state: State) => state.chat.chats[chatId].messages);

    // Track how many messages existed on first render so we only animate new ones
    const initialCountRef = useRef(messages.length);

    const scrollRef = useRef<HTMLDivElement>(null);
    useAutoScroll(scrollRef, messages);

    const onRollbackClicked = (contentId: string) => {
        dispatch(rollbackChat({ chatId, contentId }));
    }

    const onAddFlagClicked = (contentId: string) => {
        dispatch(addFlag({ chatId, contentId }));
    }

    const onForkFromFlagClicked = (contentId: string) => {
        dispatch(forkFromFlag({ chatId, contentId }));
    }

    const onRemoveFlagClicked = (contentId: string) => {
        dispatch(removeFlag({ chatId, contentId }));
    }

    return (
        <div className="messages-container scrollable" ref={scrollRef} >
            {messages.length === 0 && children}
            {messages.map((message, index) => {
                const shouldAnimate = index >= initialCountRef.current;

                const renderMessage = () => {
                    switch (message.type) {
                        case 'text':
                            return (
                                <ChatTextMessage
                                    text={message.value}
                                    role={message.role}
                                    onRollbackClicked={() => onRollbackClicked(message.contentId!)}
                                    onAddFlagClicked={message.contentId ? () => onAddFlagClicked(message.contentId!) : undefined} />
                            );
                        case 'toolCall':
                            return (
                                <ChatToolCall
                                    chatId={chatId}
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
                            );
                        case 'reason':
                            return (
                                <ChatReason
                                    id={message.id}
                                    status={message.status}
                                    totalTimeMs={message.totalTimeMs}
                                    content={message.content} />
                            );
                        case 'hook':
                            return (
                                <ChatHook
                                    id={message.id}
                                    status={message.status}
                                    name={message.name}
                                    statusCode={message.statusCode}
                                    output={message.output}
                                    error={message.error}
                                />
                            );
                        case 'flag':
                            return (
                                <ChatFlag
                                    text={message.text}
                                    onForkClicked={() => onForkFromFlagClicked(message.contentId)}
                                    onRemoveClicked={() => onRemoveFlagClicked(message.contentId)}
                                />
                            );
                        default:
                            return null;
                    }
                };

                const key = message.type === 'toolCall'
                    ? `chat-toolcall-${index}`
                    : message.type === 'reason'
                        ? `chat-reason-${index}`
                        : message.type === 'hook'
                            ? `chat-hook-${index}`
                            : message.type === 'flag'
                                ? `chat-flag-${index}`
                                : `chat-message-${index}`;

                return (
                    <motion.div
                        key={key}
                        variants={messageVariants}
                        initial={shouldAnimate ? "hidden" : false}
                        animate="visible"
                        transition={messageTransition}
                    >
                        <ErrorBoundary FallbackComponent={MessageErrorFallback} onError={captureComponentStack}>
                            {renderMessage()}
                        </ErrorBoundary>
                    </motion.div>
                );
            })}
        </div>
    );
}

const useAutoScroll = (ref: RefObject<HTMLDivElement | null>, messages: ChatMessage[]) => {
    const [userScrolled, setUserScrolled] = useState(false);
    const userMsgsCount = useMemo(() => messages.filter((msg) => 'role' in msg && msg.role === 'user').length, [messages.length]);

    useEffect(() => {
        setUserScrolled(false);
    }, [userMsgsCount]);

    useEffect(() => {
        if (!ref.current || messages.length === 0) return;

        const handleScroll = () => {
            const elem = ref.current;
            if (!elem) return;

            const isAtBottom =
                Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 1;
            setUserScrolled(!isAtBottom);
        };

        const resizeObserver = new ResizeObserver(() => {
            const elem = ref.current;
            if (!elem || userScrolled) return;
            elem.scrollTop = elem.scrollHeight;
        });

        ref.current.addEventListener("scroll", handleScroll);

        resizeObserver.observe(ref.current);

        Array.from(ref.current.children).forEach((child) => {
            resizeObserver.observe(child);
        });

        return () => {
            resizeObserver.disconnect();
            ref.current?.removeEventListener("scroll", handleScroll);
        };
    }, [ref, messages.length, userScrolled]);
}
