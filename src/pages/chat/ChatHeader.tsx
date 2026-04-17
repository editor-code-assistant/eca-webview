import { memo, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { webviewSend } from '../../hooks';
import { Chat, newChat, renameChat, selectChat } from '../../redux/slices/chat';
import { State, useEcaDispatch } from '../../redux/store';
import { deleteChat } from '../../redux/thunks/chat';
import { editorName } from '../../util';
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
    const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (renamingChatId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingChatId]);

    const chatDelete = (chat: Chat) => {
        dispatch(deleteChat({ chatId: chat.id }));
    };

    const chatNew = (_: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
        dispatch(newChat());
    };

    const selectTab = (chatId: string) => {
        dispatch(selectChat(chatId));
    };

    const startRename = (chat: Chat) => {
        setRenamingChatId(chat.id);
        setRenameValue(chatTitle(chat));
    };

    const commitRename = () => {
        if (renamingChatId && renameValue.trim()) {
            dispatch(renameChat({ chatId: renamingChatId, title: renameValue.trim() }));
        }
        setRenamingChatId(null);
        setRenameValue('');
    };

    const cancelRename = () => {
        setRenamingChatId(null);
        setRenameValue('');
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitRename();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRename();
        }
    };

    // Bridge for the desktop "Rename Chat" menu (F2). RootWrapper emits
    // this DOM event on the currently-selected chat; we map it to the
    // existing inline-rename flow so there is a single code path.
    useEffect(() => {
        const handler = () => {
            const target = chats.find(c => c.id === selectedChat);
            if (target && target.id !== 'EMPTY') {
                startRename(target);
            }
        };
        document.addEventListener('eca:requestRenameCurrent', handler);
        return () => document.removeEventListener('eca:requestRenameCurrent', handler);
    }, [chats, selectedChat]);

    const emptyChat = chats.find(c => c.id === 'EMPTY');
    const isWeb = editorName() === 'web';
    const selectedChatObj = chats.find(c => c.id === selectedChat);

    const openSidebar = () => {
        webviewSend('editor/toggleSidebar', {});
    };

    return (
        <div className="chat-header">
            {isWeb && selectedChatObj && (
                <button className="web-chat-title-bar" onClick={openSidebar}>
                    <i className="codicon codicon-comment web-chat-title-icon" />
                    <span className="web-chat-title-label">
                        {chatTitle(selectedChatObj)}
                    </span>
                    <i className="codicon codicon-chevron-down web-chat-title-chevron" />
                </button>
            )}
            <section className="chats scrollable">
                {chats.map(chat => {
                    const isEmpty = chat.id === emptyChat?.id;
                    const isSelected = chat.id === selectedChat;
                    const isRenaming = renamingChatId === chat.id;

                    if (isEmpty) {
                        return (
                            <span onClick={() => selectTab(chat.id)}
                                key={`chat-${chat.id}`}
                                className={`chat empty ${isSelected ? 'selected' : ''}`}>
                                Empty chat
                                {isSelected && (
                                    <motion.div
                                        className="tab-indicator"
                                        layoutId="tab-indicator"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </span>
                        );
                    }

                    return (
                        <span onClick={() => selectTab(chat.id)}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                startRename(chat);
                            }}
                            key={`chat-${chat.id}`}
                            className={`chat ${isSelected ? 'selected' : ''}`}>
                            {isRenaming ? (
                                <input
                                    ref={renameInputRef}
                                    className="rename-input"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={handleRenameKeyDown}
                                    onBlur={commitRename}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                chatTitle(chat)
                            )}
                            <i onClick={(e) => {
                                e.stopPropagation();
                                chatDelete(chat);
                            }} className="close codicon codicon-close"></i>
                            {isSelected && (
                                <motion.div
                                    className="tab-indicator"
                                    layoutId="tab-indicator"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
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
