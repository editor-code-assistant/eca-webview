import type { RefObject} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChatMessage } from '../../redux/slices/chat';
import type { State} from '../../redux/store';
import { useEcaDispatch } from '../../redux/store';
import { addFlag, forkFromFlag, removeFlag, rollbackChat } from '../../redux/thunks/chat';
import { captureComponentStack } from '../../errorReporting';
import { MessageErrorFallback } from '../components/ErrorFallback';
import { ChatHook } from './ChatHook';
import './ChatMessages.css';
import { ChatQuestion } from './ChatQuestion';
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
    const messages = useSelector((state: State) => state.chat.chats[chatId]?.messages ?? []);
    const pendingQuestion = useSelector((state: State) => state.chat.chats[chatId]?.pendingQuestion);

    // Track how many messages existed on first render so we only animate new ones
    const initialCountRef = useRef(messages.length);

    const scrollRef = useRef<HTMLDivElement>(null);
    const { userScrolled, scrollToBottom } = useAutoScroll(scrollRef, messages);

    const onRollbackClicked = (contentId: string) => {
        void dispatch(rollbackChat({ chatId, contentId }));
    }

    const onAddFlagClicked = (contentId: string) => {
        void dispatch(addFlag({ chatId, contentId }));
    }

    const onForkFromFlagClicked = (contentId: string) => {
        void dispatch(forkFromFlag({ chatId, contentId }));
    }

    const onRemoveFlagClicked = (contentId: string) => {
        void dispatch(removeFlag({ chatId, contentId }));
    }

    return (
        <div className="messages-wrapper">
            <div className="messages-container scrollable" ref={scrollRef} >
            {messages.map((message, index) => {
                const shouldAnimate = index >= initialCountRef.current;

                const renderMessage = () => {
                    switch (message.type) {
                        case 'text':
                            return (
                                <ChatTextMessage
                                    text={message.value}
                                    role={message.role}
                                    onRollbackClicked={() => { onRollbackClicked(message.contentId!); }}
                                    onAddFlagClicked={message.contentId ? () => { onAddFlagClicked(message.contentId!); } : undefined} />
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
                                    onForkClicked={() => { onForkFromFlagClicked(message.contentId); }}
                                    onRemoveClicked={() => { onRemoveFlagClicked(message.contentId); }}
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
                        className="message-row"
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
            {pendingQuestion && (
                <motion.div
                    key="chat-question-standalone"
                    className="message-row"
                    variants={messageVariants}
                    initial="hidden"
                    animate="visible"
                    transition={messageTransition}
                >
                    <ChatQuestion chatId={chatId} question={pendingQuestion} />
                </motion.div>
            )}
            {/*
              * Render the empty-state welcome LAST so that while it is exiting
              * (AnimatePresence keeps it mounted for the duration of its exit
              * animation) the already-mounted user message stays above it in
              * the flex flow. Placing it first here, combined with its
              * `flex: 1`, would expand the welcome to fill the column and push
              * the first user message to the bottom for ~250ms, then snap it
              * back to the top when the welcome finally unmounts.
              */}
            <AnimatePresence initial={false}>
                {messages.length === 0 && children}
            </AnimatePresence>
            </div>
            <AnimatePresence>
                {userScrolled && (
                    <motion.button
                        type="button"
                        key="scroll-to-bottom"
                        className="scroll-to-bottom-btn"
                        onClick={() => { scrollToBottom(true); }}
                        aria-label="Scroll to latest messages"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                    >
                        <i className="codicon codicon-arrow-down" aria-hidden="true" />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

// Tolerance in pixels for considering the scroll container "at bottom".
// Larger than 1px to avoid flicker from sub-pixel rounding, smooth-scroll
// inertia, and DPR variations across editors and zoom levels. This same
// threshold drives both the auto-stick-to-bottom suspend logic and the
// visibility of the floating "scroll to latest" button.
const AT_BOTTOM_THRESHOLD_PX = 24;

const useAutoScroll = (ref: RefObject<HTMLDivElement | null>, messages: ChatMessage[]) => {
    const [userScrolled, setUserScrolled] = useState(false);
    const userMsgsCount = useMemo(() => messages.filter((msg) => 'role' in msg && msg.role === 'user').length, [messages]);

    // Active "header toggle" anchor. While set, the ResizeObserver below
    // freezes scrollTop to the value captured at click time instead of
    // pinning the chat to the bottom — that way the start of the block
    // the user just clicked stays at the same on-screen position
    // throughout the open/close animation, regardless of what other
    // scroll mechanisms (browser scroll anchoring, our own RO pin, etc.)
    // might try to do during the layout shift.
    const headerToggleRef = useRef<{ endsAt: number; frozenScrollTop: number } | null>(null);

    useEffect(() => {
        setUserScrolled(false);
    }, [userMsgsCount]);

    useEffect(() => {
        const element = ref.current;
        if (!element || messages.length === 0) return;

        const handleScroll = () => {
            const elem = ref.current;
            if (!elem) return;

            // A user scroll during the animation window cancels the freeze
            // so we don't fight them. Self-induced scrolls from the freeze
            // restore land exactly on `frozenScrollTop`, so they don't
            // trip this check.
            const anchor = headerToggleRef.current;
            if (anchor && Math.abs(elem.scrollTop - anchor.frozenScrollTop) > 1) {
                headerToggleRef.current = null;
            }

            const isAtBottom =
                Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < AT_BOTTOM_THRESHOLD_PX;
            setUserScrolled(!isAtBottom);
        };

        // Detect clicks on any expandable header so we can freeze scrollTop
        // for the duration of the open/close animation. All expandable cards
        // in the chat (`ChatToolCall`, `ChatReason`, `ChatTask`,
        // `ChatSubagentToolCall`, and the generic `ChatCollapsableMessage`)
        // mark their header with `data-collapsible-header`, so a single
        // capture-phase listener on the container catches them all and runs
        // before React's onClick toggles the state.
        const handleHeaderClick = (e: Event) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('[data-collapsible-header]')) return;
            const elem = ref.current;
            if (!elem) return;
            // Framer Motion's height-auto spring runs ~250–400ms for typical
            // content; 800ms gives a comfortable margin for tall bodies and
            // slower frames before we re-arm auto-pin.
            headerToggleRef.current = {
                endsAt: performance.now() + 800,
                frozenScrollTop: elem.scrollTop,
            };
        };

        const resizeObserver = new ResizeObserver(() => {
            const elem = ref.current;
            if (!elem) return;

            // While a collapsible is animating, actively keep scrollTop at
            // the value it had when the header was clicked. This neutralizes
            // our own pin-to-bottom impulse AND any external mutator (e.g.
            // a stray browser scroll-anchoring adjustment) that would move
            // the just-opened block out of view.
            const anchor = headerToggleRef.current;
            if (anchor && performance.now() < anchor.endsAt) {
                if (elem.scrollTop !== anchor.frozenScrollTop) {
                    elem.scrollTop = anchor.frozenScrollTop;
                }
                return;
            }
            if (anchor) {
                // Window expired. Clear the anchor and, if the expansion
                // pushed the bottom out of view, flag the user as scrolled
                // away so subsequent streaming chunks won't yank them back
                // — and the floating "scroll to latest" button surfaces.
                headerToggleRef.current = null;
                const isAtBottom =
                    Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < AT_BOTTOM_THRESHOLD_PX;
                if (!isAtBottom) {
                    setUserScrolled(true);
                    return;
                }
            }

            if (userScrolled) return;
            elem.scrollTop = elem.scrollHeight;
        });

        element.addEventListener("scroll", handleScroll);
        element.addEventListener("click", handleHeaderClick, true);

        resizeObserver.observe(element);

        Array.from(element.children).forEach((child) => {
            resizeObserver.observe(child);
        });

        return () => {
            resizeObserver.disconnect();
            element.removeEventListener("scroll", handleScroll);
            element.removeEventListener("click", handleHeaderClick, true);
        };
    }, [ref, messages.length, userScrolled]);

    // Imperative scroll-to-bottom used by the floating button. We optimistically
    // clear `userScrolled` so that any streaming chunks arriving during (or
    // right after) the smooth-scroll animation will keep the view pinned via
    // the ResizeObserver above — matching the "stay at bottom for new messages
    // until the user scrolls again" expectation.
    //
    // We also reset `scrollLeft` to 0. On iOS Safari/WebKit a wide markdown
    // payload (e.g. an unbreakable token in a long code block) can leave the
    // scroll container scrolled horizontally — clipping the start of every
    // line. The user reported "text clipped on left side" on iPhone; resetting
    // scrollLeft snaps the column back into view alongside the vertical jump.
    const scrollToBottom = useCallback((smooth = false) => {
        const elem = ref.current;
        if (!elem) return;
        elem.scrollTo({
            top: elem.scrollHeight,
            left: 0,
            behavior: smooth ? 'smooth' : 'auto',
        });
        setUserScrolled(false);
    }, [ref]);

    return { userScrolled, scrollToBottom };
}
