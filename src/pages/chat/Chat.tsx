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
import { MarkdownContent } from "./MarkdownContent";

export function Chat() {
    const dispatch = useEcaDispatch();
    const status = useSelector((state: State) => state.server.status);
    const running = status === ServerStatus.Running;

    const selectedChat = useSelector((state: State) => state.chat.selectedChat);
    const allChats = useSelector((state: State) => state.chat.chats);
    const chatsList = Object.values(allChats);

    let currentChatId = chatsList.find(c => c.id === selectedChat)!.id;

    const currentProgress = allChats[currentChatId].progress;

    const welcomeMessage = useSelector((state: State) => state.server.config.chat.welcomeMessage);

    const onStop = (_e: any) => {
        dispatch(stopPrompt({ chatId: currentChatId! }));
    };

    return (
        <div className="chat-container">
            {running && (
                <ChatHeader chats={chatsList} />)}
            {running && (
                <ChatSubHeader chatId={currentChatId} />
            )}

            {!running &&
                <div className="loading">
                    <div className="content">
                        <p>Waiting for server to start... </p>
                        <img className="image" src={`${window.mediaUrl}/logo.png`} />
                    </div>
                </div>
            }

            <ChatMessages chatId={currentChatId}>
                {running && (
                    <div className="welcome-message">
                        <MarkdownContent content={welcomeMessage} />
                        <div className="image">
                            <img src={`${window.mediaUrl}/logo.png`} />
                        </div>
                    </div>)
                }
            </ChatMessages>

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
