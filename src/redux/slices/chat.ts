import { createSlice } from "@reduxjs/toolkit";
import { ChatCommand, ChatContentReceivedParams, ChatContentRole, ChatContext, ToolCallDetails, ToolCallOrigin, ToolCallOutput } from "../../protocol";

interface ChatMessageText {
    type: 'text',
    role: string,
    value: string,
}

interface ChatMessageToolCall {
    type: 'toolCall',
    status: 'preparing' | 'run' | 'succeeded' | 'failed' | 'rejected',
    role: ChatContentRole,
    id: string,
    name: string,
    argumentsText?: string,
    outputs?: ToolCallOutput[],
    origin: ToolCallOrigin,
    manualApproval: boolean,
    details?: ToolCallDetails,
    summary?: string,
}

interface ChatMessageReason {
    type: 'reason',
    role: ChatContentRole,
    id: string,
    status: 'thinking' | 'done',
    content?: string,
}

export type ChatMessage = ChatMessageText | ChatMessageReason | ChatMessageToolCall;

interface Chat {
    id: string,
    lastRequestId: number,
    progress?: string,
    messages: ChatMessage[],
    usage?: ChatUsage,
}

interface ChatUsage {
    messageInputTokens: number,
    messageOutputTokens: number,
    sessionTokens: number,
    messageCost?: string,
    sessionCost?: string,
}

export const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        behaviors: [],
        models: [],
        selectedBehavior: "",
        selectedModel: "",
        welcomeMessage: "",
        chats: {} as { [key: string]: Chat },
        contexts: undefined as (ChatContext[] | undefined),
        addedContexts: [{ type: 'repoMap' }] as ChatContext[],
        uniqueContexts: {} as { [key: string]: ChatContext },
        commands: undefined as (ChatCommand[] | undefined),
    },
    reducers: {
        setBehaviors: (state, action) => {
            state.behaviors = action.payload;
        },
        setSelectedBehavior: (state, action) => {
            state.selectedBehavior = action.payload;
        },
        setModels: (state, action) => {
            state.models = action.payload;
        },
        setSelectedModel: (state, action) => {
            state.selectedModel = action.payload;
        },
        setWelcomeMessage: (state, action) => {
            state.welcomeMessage = action.payload;
        },
        incRequestId: (state, action) => {
            const chatId = action.payload.chatId;
            if (state.chats[chatId]) {
                state.chats[chatId] = {
                    ...state.chats[chatId],
                    lastRequestId: (state.chats[chatId]?.lastRequestId || 0) + 1,
                };
            }
        },
        resetChat: (state, action) => {
            const chatId = action.payload;
            const { [chatId]: oldChat, ...newChats } = state.chats;
            state.chats = newChats;
        },
        resetChats: (state) => {
            state.chats = {};
        },
        addContentReceived: (state, action) => {
            const { chatId, role, content } = action.payload as ChatContentReceivedParams;
            let chat = state.chats[chatId] || { id: chatId, lastRequestId: 0, messages: [] };

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
                    tool.argumentsText = JSON.stringify(content.arguments);

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
                    chat.messages[existingIndex] = newReason;
                    break;
                }
                case 'usage': {
                    chat.usage = content;
                    break;
                }
            }
            state.chats[chatId] = chat;
        },
        setContexts: (state, action) => {
            state.contexts = action.payload.contexts;
        },
        setUniqueContext: (state, action) => {
            const context = action.payload.context as ChatContext;
            const uniqueType = action.payload.uniqueType as string;

            // Snapshot previous unique contexts before updating
            const prevUniqueValues = Object.values(state.uniqueContexts);

            // Update unique context for the given type
            state.uniqueContexts[uniqueType] = context;

            // Unique contexts after the update
            const nextUniqueValues = Object.values(state.uniqueContexts);

            // Remove any previous unique contexts from addedContexts
            const filteredAdded = state.addedContexts.filter(existing =>
                !prevUniqueValues.some(prev => JSON.stringify(prev) === JSON.stringify(existing))
            );

            // Merge current unique contexts into addedContexts without duplicates
            const deduped = [...filteredAdded];
            for (const u of nextUniqueValues) {
                const exists = deduped.some(e => JSON.stringify(e) === JSON.stringify(u));
                if (!exists) {
                    deduped.push(u);
                }
            }

            state.addedContexts = deduped;
        },
        addContext: (state, action) => {
            state.addedContexts = [...state.addedContexts, action.payload];
        },
        removeContext: (state, action) => {
            const toRemove = JSON.stringify(action.payload);
            const i = state.addedContexts.findIndex(context => JSON.stringify(context) === toRemove);
            state.addedContexts = [...state.addedContexts.slice(0, i), ...state.addedContexts.slice(i + 1)];
        },
        setCommands: (state, action) => {
            state.commands = action.payload.commands;
        },
    },
});

export const {
    setBehaviors,
    setModels,
    setSelectedBehavior,
    setSelectedModel,
    setUniqueContext,
    setWelcomeMessage,
    incRequestId,
    addContentReceived,
    resetChat,
    resetChats,
    setContexts,
    addContext,
    removeContext,
    setCommands,
} = chatSlice.actions
