import { memo } from 'react';
import { useSelector } from 'react-redux';
import { Chat, newChat, selectChat } from '../../redux/slices/chat';
import { State, useEcaDispatch } from '../../redux/store';
import { deleteChat } from '../../redux/thunks/chat';
import './ChatHeader.scss';

interface Props {
    chats: Chat[];
}

function chatTitle(chat: Chat): string {
    if (chat.title) {
        return chat.title;
    }
    return `Chat ${chat.localId}`;
}

export const ChatHeader = memo(({ chats }: Props) => {
    const dispatch = useEcaDispatch();
    const selectedChat = useSelector((state: State) => state.chat.selectedChat);

    const chatDelete = (chat: Chat) => {
        dispatch(deleteChat({ chatId: chat.id }));
    };

    const chatNew = (_: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
        dispatch(newChat());
    };

    const selectTab = (chatId: string) => {
        dispatch(selectChat(chatId));
    };

    const emptyChat = chats.find(c => c.id === 'EMPTY');

    return (
        <div className="chat-header">
            <section className="chats scrollable">
                {chats.map(chat => {
                    const isEmpty = chat.id === emptyChat?.id;
                    const isSelected = chat.id === selectedChat;

                    if (isEmpty) {
                        return (
                            <span onClick={() => selectTab(chat.id)}
                                key={`chat-${chat.id}`}
                                className={`chat empty ${isSelected ? 'selected' : ''}`}>Empty chat</span>
                        );
                    }

                    return (
                        <span onClick={() => selectTab(chat.id)}
                            key={`chat-${chat.id}`}
                            className={`chat ${isSelected ? 'selected' : ''}`}>
                            {chatTitle(chat)}
                            <i onClick={(e) => {
                                e.stopPropagation();
                                chatDelete(chat);
                            }} className="close codicon codicon-close"></i>
                        </span>

                    );
                })}

                {!emptyChat && (
                    <span onClick={chatNew} className="new-chat">+</span>
                )}
            </section>
        </div>
    );
});
