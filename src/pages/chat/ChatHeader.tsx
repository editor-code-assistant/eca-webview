import { memo, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { webviewSend } from '../../hooks';
import { Chat, newChat, renameChat, selectChat } from '../../redux/slices/chat';
import { setTrust } from '../../redux/slices/server';
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
    const trust = useSelector((state: State) => state.server.trust);
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

    const toggleTrust = () => {
        const newTrust = !trust;
        dispatch(setTrust(newTrust));
        webviewSend('server/setTrust', newTrust);
    };

    const emptyChat = chats.find(c => c.id === 'EMPTY');

    return (
        <div className="chat-header">
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
            <span
                className={`trust-toggle ${trust ? 'trust-on' : 'trust-off'}`}
                onClick={toggleTrust}
                title={trust ? 'Trust ON - auto-accepting tool calls' : 'Trust OFF - not auto-accepting tool calls'}>
                ⬤
            </span>
        </div>
    );
});
