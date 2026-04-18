import { AnimatePresence, motion } from "framer-motion";
import { useSelector } from "react-redux";
import { SyncLoader } from "react-spinners";
import { selectInitProgressString, ServerStatus } from "../../redux/slices/server";
import { State } from "../../redux/store";
import { useStickyString } from "../../hooks";
import './Chat.scss';
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from './ChatMessages';
import { ChatPrompt } from "./ChatPrompt";
import { ChatSubHeader } from './ChatSubHeader';
import { ChatTask } from './ChatTask';
import { MarkdownContent } from "./MarkdownContent";
import { editorName } from "../../util";

export function Chat() {
    const status = useSelector((state: State) => state.server.status);
    const running = status === ServerStatus.Running;

    const selectedChat = useSelector((state: State) => state.chat.selectedChat);
    const allChats = useSelector((state: State) => state.chat.chats);
    const chatsList = Object.values(allChats);

    const found = chatsList.find(c => c.id === selectedChat);
    let currentChatId = found ? found.id : 'EMPTY';

    const welcomeMessage = useSelector((state: State) => state.server.config.chat.welcomeMessage);

    const isWeb = editorName() === 'web';
    const hasNoMessages = !allChats[currentChatId]?.messages?.length;
    const heroMode = isWeb && (!running || hasNoMessages);

    // Live ECA-server init-progress line (mirrors eca-emacs). Null until
    // the server emits its first $/progress notification, or once every
    // known task has reached the 'finish' state — both cases fall back
    // to the generic "Starting…" copy below. We still guard on
    // `status !== Failed` at the call sites so a failed start shows
    // only the "failed to start" message, not stale progress.
    //
    // Run the raw selector output through `useStickyString` to absorb
    // the rapid start→finish churn an ECA server emits during fast
    // boots. Without this, individual task titles can flicker across
    // for <100 ms each, and the whole line can flash in and back out
    // inside a single frame — visually jarring. See the hook's
    // comment for the minShow / trailingMs semantics.
    const rawInitProgress = useSelector(selectInitProgressString);
    const initProgress = useStickyString(rawInitProgress);

    return (
        <div className={`chat-container${heroMode ? ' hero-mode' : ''}`}>
            {(running || isWeb) && (
                <ChatHeader chats={chatsList} />)}
            {(running || isWeb) && (
                <ChatSubHeader chatId={currentChatId} />
            )}

            {(running || isWeb) && (
                <ChatTask key={currentChatId} chatId={currentChatId} />
            )}

            {!running && !isWeb && (
                <div className={`startup-card${status === ServerStatus.Failed ? ' startup-card-failed' : ' startup-card-starting'}`}
                     role="status"
                     aria-live="polite">
                    <div className="content">
                        <img className="image" src={`${window.mediaUrl}/logo.png`} alt="" draggable={false} />
                        <div className="status-row">
                            <span className="status-dot" aria-hidden="true" />
                            <p className="title">
                                {status === ServerStatus.Failed ? 'ECA server failed to start' : 'Starting ECA server…'}
                            </p>
                        </div>
                        {status !== ServerStatus.Failed && (
                            <SyncLoader className="spinner" size={4} />
                        )}
                        {/*
                          Subtitle has three modes:
                          1. Failed — show the recovery hint, ignore any
                             stale progress (a failed start shouldn't
                             advertise "Loading models · 2/5").
                          2. Starting w/ live progress — replace the
                             generic "usually takes a few seconds" copy
                             with the live "N/M · title" line so the user
                             sees what the server is actually doing.
                          3. Starting w/o progress yet — fall back to the
                             original generic copy. This covers the race
                             window between spawn and first $/progress.

                          AnimatePresence swaps the subtitle between
                          modes with a short fade+rise so rapid-fire
                          progress transitions feel smooth instead of
                          snapping; keying on the displayed text itself
                          means each new title re-triggers the enter
                          animation (graceful swap vs. content flash).
                        */}
                        {/*
                          Animate targets for `opacity` intentionally
                          match the computed CSS opacity of each class
                          (subtitle → 0.85, startup-card-progress →
                          0.95) so framer-motion's inline-style override
                          lands at the same visual weight the rule
                          would otherwise produce. Diverging would make
                          the element subtly brighten the moment the
                          animation finishes, which looks like a bug.
                        */}
                        <AnimatePresence mode="wait" initial={false}>
                            {status === ServerStatus.Failed ? (
                                <motion.p
                                    key="failed"
                                    className="subtitle"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 0.85, y: 0 }}
                                    exit={{ opacity: 0, y: -2 }}
                                    transition={{ duration: 0.22, ease: "easeOut" }}
                                >
                                    Check the logs for details and try restarting.
                                </motion.p>
                            ) : initProgress ? (
                                <motion.p
                                    key={`progress:${initProgress}`}
                                    className="subtitle startup-card-progress"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 0.95, y: 0 }}
                                    exit={{ opacity: 0, y: -2 }}
                                    transition={{ duration: 0.22, ease: "easeOut" }}
                                >
                                    {initProgress}
                                </motion.p>
                            ) : (
                                <motion.p
                                    key="generic"
                                    className="subtitle"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 0.85, y: 0 }}
                                    exit={{ opacity: 0, y: -2 }}
                                    transition={{ duration: 0.22, ease: "easeOut" }}
                                >
                                    This usually takes a few seconds. You can start drafting your message below.
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            <ChatMessages chatId={currentChatId}>
                {(running || isWeb) && (
                    <motion.div
                        key="welcome-message"
                        className="welcome-message"
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                        <div className="welcome-logo">
                            {/*
                              Logo rendered as a CSS-masked <span> rather than
                              <img> so it can follow the desktop shell's
                              active theme via --eca-logo-fg (defined in
                              eca-desktop/src/renderer/theme.css). The mask
                              URL is set inline via window.mediaUrl so it
                              resolves the same way the old <img> src did —
                              independent of how the bundled CSS is served.
                            */}
                            <span
                                className="welcome-logo-icon"
                                role="img"
                                aria-label="ECA"
                                style={{
                                    WebkitMaskImage: `url(${window.mediaUrl}/logo.svg)`,
                                    maskImage: `url(${window.mediaUrl}/logo.svg)`,
                                }}
                            />
                        </div>
                        {welcomeMessage && !isWeb && (
                            <div className="welcome-content">
                                <MarkdownContent content={welcomeMessage} />
                            </div>
                        )}
                    </motion.div>)
                }
            </ChatMessages>

            {heroMode && (
                <div className={`hero-status${running ? ' hero-status-ready' : ''}${status === ServerStatus.Failed ? ' hero-status-failed' : ''}`}
                     role="status"
                     aria-live="polite">
                    {!running && (
                        <>
                            {/*
                              Primary row: dot + label + spinner sit on
                              one line. Kept in its own flex container
                              so the `.hero-status-progress` sibling can
                              stack underneath without disturbing the
                              horizontal centering of the main label
                              (a long task title mustn't shove the
                              "Starting ECA server…" off-center).
                            */}
                            <div className="hero-status-row">
                                <span className="status-dot" aria-hidden="true" />
                                <p>
                                    {status === ServerStatus.Failed ? 'ECA server failed to start' : 'Starting ECA server…'}
                                </p>
                                {status !== ServerStatus.Failed && (
                                    <SyncLoader className="spinner" size={2} />
                                )}
                            </div>
                            {/*
                              Optional second line: live "N/M · title"
                              progress line sourced from $/progress.
                              Hidden on Failed — a failed start shouldn't
                              advertise in-flight tasks. AnimatePresence
                              fades the line in/out on enter/exit and
                              re-fires the enter animation when the
                              title text changes (keyed by the string).
                            */}
                            <AnimatePresence initial={false}>
                                {status !== ServerStatus.Failed && initProgress && (
                                    <motion.p
                                        key={`progress:${initProgress}`}
                                        className="hero-status-progress"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 0.75, y: 0 }}
                                        exit={{ opacity: 0, y: -2 }}
                                        transition={{ duration: 0.22, ease: "easeOut" }}
                                    >
                                        {initProgress}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </div>
            )}

            <ChatPrompt chatId={currentChatId} enabled={running} heroMode={heroMode} />
        </div>
    );
}
