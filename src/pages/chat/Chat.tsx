import { useSelector } from "react-redux";
import { SyncLoader } from "react-spinners";
import { ServerStatus } from "../../redux/slices/server";
import { State, useEcaDispatch } from "../../redux/store";
import { stopPrompt } from "../../redux/thunks/chat";
import './Chat.scss';
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from './ChatMessages';
import { ChatPrompt } from "./ChatPrompt";
import { ChatSubHeader } from './ChatSubHeader';
import { ChatTask } from './ChatTask';
import { MarkdownContent } from "./MarkdownContent";
import { editorName } from "../../util";

export function Chat() {
    const dispatch = useEcaDispatch();
    const status = useSelector((state: State) => state.server.status);
    const running = status === ServerStatus.Running;

    const selectedChat = useSelector((state: State) => state.chat.selectedChat);
    const allChats = useSelector((state: State) => state.chat.chats);
    const chatsList = Object.values(allChats);

    const found = chatsList.find(c => c.id === selectedChat);
    let currentChatId = found ? found.id : 'EMPTY';

    const currentProgress = allChats[currentChatId]?.progress;

    const welcomeMessage = useSelector((state: State) => state.server.config.chat.welcomeMessage);

    const isWeb = editorName() === 'web';
    const hasNoMessages = !allChats[currentChatId]?.messages?.length;
    const heroMode = isWeb && (!running || hasNoMessages);

    const onStop = (_e: any) => {
        dispatch(stopPrompt({ chatId: currentChatId! }));
    };

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
                    <div className="welcome-message">
                        <div className="welcome-logo">
                            <img src={`${window.mediaUrl}/logo.png`} alt="" draggable={false} />
                        </div>
                        {welcomeMessage && !isWeb && (
                            <div className="welcome-content">
                                <MarkdownContent content={welcomeMessage} />
                            </div>
                        )}
                    </div>)
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

            {currentProgress && (
                <div className="progress-area">
                    <p>{currentProgress}</p>
                    <SyncLoader className="spinner" size={2} />
                    <div className="divider"></div>
                    {currentChatId && (
                        <span onClick={onStop} className="stop">Stop</span>
                    )}
                </div>
            )}

            <ChatPrompt chatId={currentChatId} enabled={running} />
        </div>
    );
}
