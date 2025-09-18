import { createSlice } from "@reduxjs/toolkit";
import { ChatCommand, ChatContentReceivedParams, ChatContentRole, ChatContext, ToolCallDetails, ToolCallOrigin, ToolCallOutput } from "../../protocol";

interface ChatMessageText {
    type: 'text',
    role: string,
    value: string,
}

interface ChatMessageToolCall {
    type: 'toolCall',
    status: 'preparing' | 'run' | 'running' | 'succeeded' | 'failed' | 'rejected',
    role: ChatContentRole,
    id: string,
    name: string,
    argumentsText?: string,
    outputs?: ToolCallOutput[],
    origin: ToolCallOrigin,
    manualApproval: boolean,
    totalTimeMs?: number,
    details?: ToolCallDetails,
    summary?: string,
}

interface ChatMessageReason {
    type: 'reason',
    role: ChatContentRole,
    id: string,
    status: 'thinking' | 'done',
    totalTimeMs?: number,
    content?: string,
}

export type ChatMessage = ChatMessageText | ChatMessageReason | ChatMessageToolCall;

interface CursorPreContext {
    type: 'cursor';
}

export type ChatPreContext = (ChatContext | CursorPreContext);

export interface Chat {
    id: string,
    title?: string,
    localId: number,
    lastRequestId: number,
    progress?: string,
    messages: ChatMessage[],
    addedContexts: ChatPreContext[],
    usage?: ChatUsage,
}

interface ChatUsage {
    sessionTokens: number,
    lastMessageCost?: string,
    sessionCost?: string,
    limit?: {
        context: number;
        output: number;
    }
}

const defaultContexts = [{ type: 'repoMap' }, { type: 'cursor' }];

const emptyStateChats = {
    'EMPTY': {
        id: 'EMPTY',
        lastRequestId: 0,
        messages: [],
        addedContexts: defaultContexts,
        localId: 1
    }
} as { [key: string]: Chat };

export interface CursorFocus {
    path: string,
    position: {
        start: { line: number, character: number },
        end: { line: number, character: number }
    }
}

interface ChatState {
    chats: { [key: string]: Chat },
    chatLocalId: number,
    selectedChat: string,
    contexts?: ChatContext[],
    commands?: ChatCommand[],
    cursorFocus?: CursorFocus,
}

const getCurrentChat = (state: ChatState): Chat => {
    return state.chats[state.selectedChat];
};

export const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        chats: emptyStateChats,
        chatLocalId: 1,
        selectedChat: 'EMPTY',
        contexts: undefined,
        commands: undefined,
        cursorFocus: undefined,
    } as ChatState,
    reducers: {
        incRequestId: (state, action) => {
            const chatId = action.payload.chatId;
            if (state.chats[chatId]) {
                state.chats[chatId] = {
                    ...state.chats[chatId],
                    lastRequestId: (state.chats[chatId]?.lastRequestId || 0) + 1,
                };
            }
        },
        clearChat: (state, action) => {
            const chatId = action.payload.chatId;
            state.chats[chatId].messages = [];
        },
        resetChat: (state, action) => {
            const chatId = action.payload;
            const { [chatId]: oldChat, ...newChats } = state.chats;
            state.chats = newChats;
            if (Object.values(state.chats).length === 0) {
                state.chats = emptyStateChats;
                state.selectedChat = 'EMPTY';
                return;
            }

            if (chatId === state.selectedChat) {
                state.selectedChat = Object.keys(state.chats)[Object.keys(state.chats).length - 1];
            }
        },
        resetChats: (state) => {
            state.chats = emptyStateChats;
            state.selectedChat = 'EMPTY';
        },
        newChat: (state) => {
            state.chats = { ...state.chats, ...emptyStateChats };
            state.selectedChat = 'EMPTY';
        },
        selectChat: (state, action) => {
            state.selectedChat = action.payload;
        },
        addContentReceived: (state, action) => {
            const { chatId, role, content } = action.payload as ChatContentReceivedParams;
            const isNewChat = state.chats[chatId] === undefined;

            let chat;
            if (isNewChat) {
                state.chats = Object.fromEntries(Object.entries(state.chats).filter(([_k, v]) => v.id !== 'EMPTY'));;
                chat = { id: chatId, lastRequestId: 0, messages: [], localId: state.chatLocalId++, addedContexts: defaultContexts } as Chat;
                state.selectedChat = chatId;
            } else {
                chat = state.chats[chatId];
            }

            switch (content.type) {
                case 'progress': {
                    switch (content.state) {
                        case 'running': {
                            chat.progress = content.text!;
                            break;
                        }
                        case 'finished': {
                            chat.progress = undefined;
                            break;
                        }
                    }
                    break;
                }
                case 'text': {
                    switch (role) {
                        case 'user':
                        case 'system': {
                            chat.messages = [...chat.messages, {
                                type: 'text',
                                role: role,
                                value: content.text,
                            }];
                            break;
                        }
                        case 'assistant': {
                            const lastMessage = chat.messages[chat.messages.length - 1];
                            if (lastMessage && lastMessage.type === 'text' && lastMessage.role === 'assistant') {
                                const newMsg = { ...lastMessage } as ChatMessageText;
                                newMsg.value += content.text;
                                chat.messages[chat.messages.length - 1] = newMsg;
                            } else {
                                chat.messages = [...chat.messages, {
                                    type: 'text',
                                    role: role,
                                    value: content.text,
                                }];
                            }
                            break;
                        }
                    }
                    break;
                }
                case 'toolCallPrepare': {
                    const tool: ChatMessageToolCall = {
                        type: 'toolCall',
                        status: 'preparing',
                        role: role,
                        id: content.id,
                        name: content.name,
                        origin: content.origin,
                        argumentsText: content.argumentsText,
                        manualApproval: content.manualApproval,
                        summary: content.summary,
                    };

                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    if (existingIndex === -1) {
                        chat.messages.push(tool);
                    } else {
                        const existingTool = chat.messages[existingIndex] as ChatMessageToolCall;
                        tool.argumentsText = existingTool.argumentsText + content.argumentsText;
                        chat.messages[existingIndex] = tool;
                    }
                    break;
                }
                case 'toolCallRun': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    let tool = chat.messages[existingIndex] as ChatMessageToolCall;
                    tool.status = 'run';
                    tool.manualApproval = content.manualApproval;
                    tool.summary = content.summary;
                    tool.details = content.details;
                    tool.argumentsText = JSON.stringify(content.arguments, null, 2);

                    chat.messages[existingIndex] = tool;
                    break;
                }
                case 'toolCallRunning': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    let tool = chat.messages[existingIndex] as ChatMessageToolCall;
                    tool.status = 'running';
                    tool.summary = content.summary;
                    tool.details = content.details;
                    tool.argumentsText = JSON.stringify(content.arguments, null, 2);

                    chat.messages[existingIndex] = tool;
                    break;
                }
                case 'toolCallRejected': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    let tool = chat.messages[existingIndex] as ChatMessageToolCall;
                    tool.status = 'rejected';
                    chat.messages[existingIndex] = tool;
                    tool.details = content.details;
                    tool.summary = content.summary;
                    break;
                }
                case 'toolCalled': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    let tool = chat.messages[existingIndex] as ChatMessageToolCall;
                    tool.outputs = content.outputs
                    tool.status = content.error ? 'failed' : 'succeeded';
                    chat.messages[existingIndex] = tool;
                    tool.details = content.details;
                    tool.summary = content.summary;
                    tool.totalTimeMs = content.totalTimeMs;
                    break;
                }
                case 'reasonStarted': {
                    chat.messages.push({
                        type: 'reason',
                        role: role,
                        status: 'thinking',
                        id: content.id,
                    });
                    break;
                }
                case 'reasonText': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'reason' && msg.id === content.id);
                    let reason = chat.messages[existingIndex] as ChatMessageReason;
                    const newReason = { ...reason } as ChatMessageReason;
                    newReason.content = (newReason.content || '') + content.text;
                    chat.messages[existingIndex] = newReason;
                    break;
                }
                case 'reasonFinished': {
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'reason' && msg.id === content.id);
                    let reason = chat.messages[existingIndex] as ChatMessageReason;
                    const newReason = { ...reason } as ChatMessageReason;
                    newReason.status = 'done';
                    newReason.totalTimeMs = content.totalTimeMs;
                    chat.messages[existingIndex] = newReason;
                    break;
                }
                case 'usage': {
                    chat.usage = content;
                    break;
                }
                case 'metadata': {
                    chat.title = content.title;
                }
            }
            state.chats[chatId] = chat;
        },
        setCursorFocus: (state, action) => {
            state.cursorFocus = action.payload as CursorFocus;
        },
        setContexts: (state, action) => {
            state.contexts = action.payload.contexts;
        },
        addContext: (state, action) => {
            const currentChat = getCurrentChat(state);
            currentChat.addedContexts = [...currentChat.addedContexts, action.payload];
        },
        removeContext: (state, action) => {
            const currentChat = getCurrentChat(state);
            const toRemove = JSON.stringify(action.payload);
            const i = currentChat.addedContexts.findIndex(context => JSON.stringify(context) === toRemove);
            currentChat.addedContexts = [...currentChat.addedContexts.slice(0, i), ...currentChat.addedContexts.slice(i + 1)];
        },
        setCommands: (state, action) => {
            state.commands = action.payload.commands;
        },
    },
});

export const {
    incRequestId,
    addContentReceived,
    resetChat,
    clearChat,
    resetChats,
    newChat,
    setCursorFocus,
    selectChat,
    setContexts,
    addContext,
    removeContext,
    setCommands,
} = chatSlice.actions
