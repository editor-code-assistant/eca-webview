import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { SyncLoader } from "react-spinners";
import { ServerStatus } from "../../redux/slices/server";
import { State } from "../../redux/store";
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

            {!running && !isWeb &&
                <div className="loading">
                    <div className="content">
                        <img className="image" src={`${window.mediaUrl}/logo.png`} alt="" draggable={false} />
                        <p>Waiting for server to start…</p>
                    </div>
                </div>
            }

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
                <div className={`hero-status${running ? ' hero-status-ready' : ''}`}>
                    {!running && (
                        <>
                            <p>Waiting for server to start…</p>
                            <SyncLoader className="spinner" size={2} />
                        </>
                    )}
                </div>
            )}

            <ChatPrompt chatId={currentChatId} enabled={running} heroMode={heroMode} />
        </div>
    );
}
