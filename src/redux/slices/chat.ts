import { createSlice } from "@reduxjs/toolkit";
import { ChatCommand, ChatContent, ChatContentReceivedParams, ChatContentRole, ChatContext, SubagentDetails, ToolCallDetails, ToolCallOrigin, ToolCallOutput } from "../../protocol";

interface ChatMessageText {
    type: 'text',
    role: string,
    value: string,
    contentId?: string,
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
    subagentMessages?: ChatMessage[],
    subagentChatId?: string,
}

interface ChatMessageReason {
    type: 'reason',
    role: ChatContentRole,
    id: string,
    status: 'thinking' | 'done',
    totalTimeMs?: number,
    content?: string,
}

interface ChatMessageHook {
    type: 'hook',
    role: ChatContentRole,
    id: string,
    status: 'started' | 'finished',
    name: string,
    statusCode?: number,
    output?: string,
    error?: string,
}

export type ChatMessage = ChatMessageText | ChatMessageReason | ChatMessageToolCall | ChatMessageHook;

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

const defaultContexts = [{ type: 'cursor' }];

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

interface SubagentMapping {
    parentChatId: string;
    toolCallId: string;
}

interface ChatState {
    chats: { [key: string]: Chat },
    chatLocalId: number,
    selectedChat: string,
    contexts?: ChatContext[],
    commands?: ChatCommand[],
    cursorFocus?: CursorFocus,
    subagentChatIdToToolCallId: { [subagentChatId: string]: SubagentMapping },
}

const getCurrentChat = (state: ChatState): Chat => {
    return state.chats[state.selectedChat];
};

/**
 * Apply a content event to a messages array (mutating).
 * Shared between normal chat and subagent routing.
 */
function applyContentToMessages(messages: ChatMessage[], role: ChatContentRole, content: ChatContent) {
    switch (content.type) {
        case 'text': {
            switch (role) {
                case 'user':
                case 'system': {
                    messages.push({
                        type: 'text',
                        role: role,
                        value: content.text,
                        contentId: content.contentId,
                    });
                    break;
                }
                case 'assistant': {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage && lastMessage.type === 'text' && lastMessage.role === 'assistant') {
                        const newMsg = { ...lastMessage } as ChatMessageText;
                        newMsg.value += content.text;
                        messages[messages.length - 1] = newMsg;
                    } else {
                        messages.push({
                            type: 'text',
                            role: role,
                            value: content.text,
                        });
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
                details: content.details,
            };

            const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
            if (existingIndex === -1) {
                messages.push(tool);
            } else {
                const existingTool = messages[existingIndex] as ChatMessageToolCall;
                tool.argumentsText = existingTool.argumentsText + content.argumentsText;
                messages[existingIndex] = tool;
            }
            break;
        }
        case 'toolCallRun': {
            const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
            if (existingIndex !== -1) {
                let tool = messages[existingIndex] as ChatMessageToolCall;
                tool.status = 'run';
                tool.manualApproval = content.manualApproval;
                tool.summary = content.summary;
                tool.details = content.details;
                tool.argumentsText = JSON.stringify(content.arguments, null, 2);
                messages[existingIndex] = tool;
            }
            break;
        }
        case 'toolCallRunning': {
            const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
            if (existingIndex !== -1) {
                let tool = messages[existingIndex] as ChatMessageToolCall;
                tool.status = 'running';
                tool.summary = content.summary;
                tool.details = content.details;
                tool.argumentsText = JSON.stringify(content.arguments, null, 2);
                messages[existingIndex] = tool;
            }
            break;
        }
        case 'toolCallRejected': {
            const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
            if (existingIndex !== -1) {
                let tool = messages[existingIndex] as ChatMessageToolCall;
                tool.status = 'rejected';
                tool.details = content.details;
                tool.summary = content.summary;
                messages[existingIndex] = tool;
            }
            break;
        }
        case 'toolCalled': {
            const existingIndex = messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
            if (existingIndex !== -1) {
                let tool = messages[existingIndex] as ChatMessageToolCall;
                tool.outputs = content.outputs;
                tool.status = content.error ? 'failed' : 'succeeded';
                tool.details = content.details;
                tool.summary = content.summary;
                tool.totalTimeMs = content.totalTimeMs;
                messages[existingIndex] = tool;
            }
            break;
        }
        case 'reasonStarted': {
            messages.push({
                type: 'reason',
                role: role,
                status: 'thinking',
                id: content.id,
            });
            break;
        }
        case 'reasonText': {
            const existingIndex = messages.findIndex(msg => msg.type === 'reason' && msg.id === content.id);
            if (existingIndex !== -1) {
                let reason = messages[existingIndex] as ChatMessageReason;
                const newReason = { ...reason } as ChatMessageReason;
                newReason.content = (newReason.content || '') + content.text;
                messages[existingIndex] = newReason;
            }
            break;
        }
        case 'reasonFinished': {
            const existingIndex = messages.findIndex(msg => msg.type === 'reason' && msg.id === content.id);
            if (existingIndex !== -1) {
                let reason = messages[existingIndex] as ChatMessageReason;
                const newReason = { ...reason } as ChatMessageReason;
                newReason.status = 'done';
                newReason.totalTimeMs = content.totalTimeMs;
                messages[existingIndex] = newReason;
            }
            break;
        }
        case 'hookActionStarted': {
            messages.push({
                type: 'hook',
                role: role,
                id: content.id,
                name: content.name,
                status: 'started',
            });
            break;
        }
        case 'hookActionFinished': {
            const existingIndex = messages.findIndex(msg => msg.type === 'hook' && msg.id === content.id);
            if (existingIndex !== -1) {
                let hook = messages[existingIndex] as ChatMessageHook;
                const newHook = { ...hook } as ChatMessageHook;
                newHook.status = 'finished';
                newHook.statusCode = content.status;
                newHook.output = content.output;
                newHook.error = content.error;
                messages[existingIndex] = newHook;
            }
            break;
        }
        // progress, usage, metadata, url are not message-level — handled separately
    }
}

export const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        chats: emptyStateChats,
        chatLocalId: 1,
        selectedChat: 'EMPTY',
        contexts: undefined,
        commands: undefined,
        cursorFocus: undefined,
        subagentChatIdToToolCallId: {},
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
        cleared: (state, action) => {
            const chatId = action.payload.chatId;
            const isMessages = action.payload.messages;
            if (isMessages) {
                state.chats[chatId].messages = [];
            }
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
            const { chatId, parentChatId, role, content } = action.payload as ChatContentReceivedParams;

            // --- Subagent content: route into parent chat's tool call ---
            if (parentChatId) {
                const mapping = state.subagentChatIdToToolCallId[chatId];
                if (!mapping) return;

                const parentChat = state.chats[mapping.parentChatId];
                if (!parentChat) return;

                const toolCallIndex = parentChat.messages.findIndex(
                    msg => msg.type === 'toolCall' && msg.id === mapping.toolCallId
                );
                if (toolCallIndex === -1) return;

                const toolCall = parentChat.messages[toolCallIndex] as ChatMessageToolCall;
                const msgs = toolCall.subagentMessages ? [...toolCall.subagentMessages] : [];

                applyContentToMessages(msgs, role, content);

                parentChat.messages[toolCallIndex] = { ...toolCall, subagentMessages: msgs };

                // Update the parent tool call's details with step info from subagent tool calls
                if (content.type === 'toolCallRunning' || content.type === 'toolCallRun') {
                    if (content.details?.type === 'subagent') {
                        const details = content.details as SubagentDetails;
                        if (details.step !== undefined && toolCall.details?.type === 'subagent') {
                            (toolCall.details as SubagentDetails).step = details.step;
                            (toolCall.details as SubagentDetails).maxSteps = details.maxSteps;
                        }
                    }
                }

                return;
            }

            // --- Normal (non-subagent) content ---
            const isNewChat = state.chats[chatId] === undefined;

            let chat;
            if (isNewChat) {
                state.chats = Object.fromEntries(Object.entries(state.chats).filter(([_k, v]) => v.id !== 'EMPTY'));;
                chat = { id: chatId, lastRequestId: 0, messages: [], localId: state.chatLocalId++, addedContexts: defaultContexts } as Chat;
                state.selectedChat = chatId;
            } else {
                chat = state.chats[chatId];
            }

            // Register subagent mapping for spawn_agent tool calls.
            // We register on all lifecycle events (including toolCallPrepare) because
            // during chat resume the server may replay events grouped by chatId,
            // so toolCalled can fire before the subagent's own content arrives.
            if (content.type === 'toolCallPrepare' || content.type === 'toolCallRun'
                || content.type === 'toolCallRunning'
                || content.type === 'toolCalled' || content.type === 'toolCallRejected') {
                if (content.details?.type === 'subagent') {
                    const details = content.details as SubagentDetails;
                    if (details.subagentChatId) {
                        state.subagentChatIdToToolCallId[details.subagentChatId] = {
                            parentChatId: chatId,
                            toolCallId: content.id,
                        };
                    }
                }
            }

            applyContentToMessages(chat.messages, role, content);

            // Store subagentChatId on the tool call message for rendering.
            // Must run after applyContentToMessages so the message exists.
            if (content.type === 'toolCallPrepare' || content.type === 'toolCallRun'
                || content.type === 'toolCallRunning'
                || content.type === 'toolCalled' || content.type === 'toolCallRejected') {
                if (content.details?.type === 'subagent') {
                    const details = content.details as SubagentDetails;
                    const existingIndex = chat.messages.findIndex(msg => msg.type === 'toolCall' && msg.id === content.id);
                    if (existingIndex !== -1) {
                        const tool = chat.messages[existingIndex] as ChatMessageToolCall;
                        tool.subagentChatId = details.subagentChatId;
                        if (!tool.subagentMessages) {
                            tool.subagentMessages = [];
                        }
                    }
                }
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
                case 'usage': {
                    chat.usage = content;
                    break;
                }
                case 'metadata': {
                    chat.title = content.title;
                    break;
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
            const context = action.payload.context as ChatContext;
            const prompt = action.payload.prompt as string;
            const currentChat = getCurrentChat(state);
            if (prompt === 'system') {
                currentChat.addedContexts = [...currentChat.addedContexts, context];
            } else {
                // TODO add to user prompt.
            }
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
    cleared,
    resetChats,
    newChat,
    setCursorFocus,
    selectChat,
    setContexts,
    addContext,
    removeContext,
    setCommands,
} = chatSlice.actions
