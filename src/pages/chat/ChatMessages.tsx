import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChatMessage } from '../../redux/slices/chat';
import { State, useEcaDispatch } from '../../redux/store';
import { rollbackChat } from '../../redux/thunks/chat';
import { ChatHook } from './ChatHook';
import './ChatMessages.scss';
import { ChatReason } from './ChatReason';
import { ChatTextMessage } from './ChatTextMessage';
import { ChatToolCall } from './ChatToolCall';

interface ChatMessagesProps {
    children: React.ReactNode,
    chatId: string,
}

export function ChatMessages({ chatId, children }: ChatMessagesProps) {
    const dispatch = useEcaDispatch();
    const messages = useSelector((state: State) => state.chat.chats[chatId].messages);

    const scrollRef = useRef<HTMLDivElement>(null);
    useAutoScroll(scrollRef, messages);

    const onRollbackClicked = (contentId: string) => {
        dispatch(rollbackChat({ chatId, contentId }));
    }

    return (
        <div className="messages-container scrollable" ref={scrollRef} >
            {messages.length === 0 && children}
            {messages.map((message, index) => {
                switch (message.type) {
                    case 'text':
                        return (
                            <div key={`chat-message-${index}`}>
                                <ChatTextMessage
                                    text={message.value}
                                    role={message.role}
                                    onRollbackClicked={() => onRollbackClicked(message.contentId!)} />
                            </div>
                        );
                    case 'toolCall':
                        return (
                            <div key={`chat-toolcall-${index}`}>
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
                            </div>
                        );
                    case 'reason':
                        return (
                            <div key={`chat-reason-${index}`}>
                                <ChatReason
                                    id={message.id}
                                    status={message.status}
                                    totalTimeMs={message.totalTimeMs}
                                    content={message.content} />
                            </div>
                        );
                    case 'hook':
                        return (
                            <div key={`chat-hook-${index}`}>
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
                        return (<div></div>);
                }
            })}
        </div>
    );
}

const useAutoScroll = (ref: RefObject<HTMLDivElement | null>, messages: ChatMessage[]) => {
    const [userScrolled, setUserScrolled] = useState(false);
    const userMsgsCount = useMemo(() => messages.filter((msg) => msg.role === 'user').length, [messages.length]);

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
