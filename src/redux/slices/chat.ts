import { createSlice } from "@reduxjs/toolkit";
import { ChatAgent, ChatCommand, ChatContent, ChatContentReceivedParams, ChatContentRole, ChatContext, ChatFile, ChatSummary, PendingQuestion, SubagentDetails, TaskDetails, ToolCallDetails, ToolCallOrigin, ToolCallOutput } from "../../protocol";
import { newChatId } from "../../util";

interface ChatMessageText {
    type: 'text',
    role: string,
    value: string,
    contentId?: string,
    timestamp?: number,
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

interface ChatMessageFlag {
    type: 'flag',
    text: string,
    contentId: string,
}

export type ChatMessage = ChatMessageText | ChatMessageReason | ChatMessageToolCall | ChatMessageHook | ChatMessageFlag;

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
    pendingPrompts: string[],
    steerMessage?: string,
    taskState?: TaskDetails | null,
    taskLoading?: boolean,
    pendingQuestion?: PendingQuestion,
    /**
     * `true` for a freshly minted chat that hasn't seen any user or
     * assistant text yet — i.e. the placeholder slot that used to be
     * keyed by the literal `'EMPTY'`. Cleared on the first text content
     * event. Used by the chat-tab list to render the "Empty chat" pill
     * and hide the "+ new chat" button while one already exists.
     */
    isEmpty?: boolean,
    /**
     * Per-chat selection state. Populated from `config/updated` payloads
     * that carry a top-level `chatId`. The server-side fields are
     * `selectModel` / `selectAgent` / `selectVariant` / `selectTrust`;
     * we mirror them here under more idiomatic webview names. When
     * unset, the UI falls back to the global last-known values on
     * `state.server.config.chat` so newly-created chats inherit the
     * most recently selected session defaults.
     */
    selectedModel?: string,
    selectedAgent?: ChatAgent,
    selectedVariant?: string | null,
    trust?: boolean,
    /**
     * Set by `beginResume` (resume-picker click) and cleared by the
     * first content event for the chat. While `true` the welcome view
     * is suppressed in favour of a small "Resuming…" indicator so the
     * user doesn't briefly see a fresh-looking empty chat between the
     * tab switch and the server's replayed content arriving.
     */
    resuming?: boolean,
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

/**
 * Build a fresh empty chat record. The chat id is a client-minted UUID
 * (see `newChatId` in src/util.ts) so it can be sent on the very first
 * `chat/prompt` — the server will auto-create the matching record and
 * echo back a `chat/opened` notification.
 *
 * `localId` is taken from and increments the slice's `chatLocalId`
 * counter so each empty slot gets a stable "Chat N" fallback title
 * (matches the previous behaviour driven by `chatTitle()`).
 */
function makeEmptyChat(localId: number): Chat {
    return {
        id: newChatId(),
        isEmpty: true,
        lastRequestId: 0,
        messages: [],
        addedContexts: defaultContexts as ChatPreContext[],
        localId,
        pendingPrompts: [],
    };
}

// Initial empty-chat slot built once at module load so the
// `initialState` literal below stays a plain value (Redux Toolkit
// requires this; you can't compute initial state inside the slice
// definition without losing some type inference).
const _initialChat = makeEmptyChat(1);
const initialChats: { [key: string]: Chat } = {
    [_initialChat.id]: _initialChat,
};

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
    files?: ChatFile[],
    cursorFocus?: CursorFocus,
    subagentChatIdToToolCallId: { [subagentChatId: string]: SubagentMapping },
    promptHistory: string[],
    /**
     * Cached result of the most recent `chat/list` RPC. Used by the
     * resume picker so re-opening the modal doesn't re-fetch. Refreshed
     * on demand by the `listChats` thunk. `undefined` distinguishes
     * "never loaded" (hide the resume hint until we know) from "loaded
     * but empty" (hide the resume hint permanently).
     */
    resumableChats?: ChatSummary[],
}

const getCurrentChat = (state: ChatState): Chat => {
    return state.chats[state.selectedChat];
};

/**
 * Check if a content event is a task tool call (server="eca", name="task").
 */
function isTaskToolCall(content: ChatContent): boolean {
    if (content.type === 'toolCallPrepare' || content.type === 'toolCallRun'
        || content.type === 'toolCallRunning' || content.type === 'toolCalled'
        || content.type === 'toolCallRejected') {
        return content.server === 'eca' && content.name === 'task';
    }
    return false;
}

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
                        timestamp: Date.now(),
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
        case 'flag': {
            messages.push({
                type: 'flag',
                text: content.text,
                contentId: content.contentId,
            });
            break;
        }
        // progress, usage, metadata, url are not message-level — handled separately
    }
}

/**
 * Core content event processing logic, extracted so it can be shared
 * between `addContentReceived` (single event) and `batchContentReceived`
 * (bulk restore). Operates on the Immer draft state directly.
 */
function processContentEvent(state: ChatState, payload: ChatContentReceivedParams) {
    const { chatId, parentChatId, role, content } = payload;

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

    // If this chatId is a known subagent but arrived without parentChatId
    // (e.g. from chat:status-changed events), don't create a new chat tab.
    if (isNewChat && state.subagentChatIdToToolCallId[chatId]) {
        return;
    }

    let chat;
    if (isNewChat) {
        // With client-minted UUIDs the chat record almost always exists
        // before content streams in (created by `newChat` / `chatOpened`
        // / `resetChats`). This branch still covers chat-resume edge
        // cases where the server replays content for an unknown id.
        // No EMPTY-sentinel filtering needed any more.
        chat = {
            id: chatId,
            lastRequestId: 0,
            messages: [],
            localId: state.chatLocalId++,
            addedContexts: defaultContexts,
            pendingPrompts: [],
        } as Chat;
        state.selectedChat = chatId;
    } else {
        chat = state.chats[chatId];
    }

    // Clear `isEmpty` on the first user/assistant text — that's the
    // moment a placeholder chat becomes a "real" chat in the tab list
    // (so the "+" new-chat button reappears, etc).
    if (chat.isEmpty && content.type === 'text' && (role === 'user' || role === 'assistant')) {
        chat.isEmpty = false;
    }

    // Clear the `resuming` flag the moment any content arrives for the
    // chat. Set by `beginResume` so the welcome view is suppressed
    // between tab-switch and first replayed content; once we've got at
    // least one event the chat is no longer in "loading" state.
    if (chat.resuming) {
        chat.resuming = false;
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

    // --- Task tool call: intercept and route to task state ---
    if (isTaskToolCall(content)) {
        switch (content.type) {
            case 'toolCallPrepare': {
                if (!chat.taskState) {
                    chat.taskLoading = true;
                }
                break;
            }
            case 'toolCalled': {
                if (content.details?.type === 'task') {
                    const details = content.details as TaskDetails;
                    if (details.tasks.length === 0) {
                        chat.taskState = null;
                    } else {
                        chat.taskState = details;
                    }
                }
                chat.taskLoading = false;
                break;
            }
            case 'toolCallRun':
            case 'toolCallRunning': {
                // Suppress — don't add to messages
                break;
            }
            case 'toolCallRejected': {
                chat.taskLoading = false;
                break;
            }
        }
        state.chats[chatId] = chat;
        return;
    }

    applyContentToMessages(chat.messages, role, content);

    // Clear steer message when server echoes back a user message (steer consumed)
    if (content.type === 'text' && role === 'user' && chat.steerMessage) {
        chat.steerMessage = undefined;
    }

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
                    // Merge unconsumed steer into pending prompts queue
                    if (chat.steerMessage) {
                        chat.pendingPrompts.unshift(chat.steerMessage);
                        chat.steerMessage = undefined;
                    }
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
}

export const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        chats: initialChats,
        // 1 was consumed by `_initialChat`; next slot is 2.
        chatLocalId: 2,
        selectedChat: _initialChat.id,
        contexts: undefined,
        commands: undefined,
        files: undefined,
        cursorFocus: undefined,
        subagentChatIdToToolCallId: {},
        promptHistory: [],
        resumableChats: undefined,
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
            if (!state.chats[chatId]) return;
            state.chats[chatId].messages = [];
            state.chats[chatId].taskState = null;
            state.chats[chatId].taskLoading = false;
        },
        cleared: (state, action) => {
            const chatId = action.payload.chatId;
            const isMessages = action.payload.messages;
            if (isMessages && state.chats[chatId]) {
                state.chats[chatId].messages = [];
                state.chats[chatId].taskState = null;
                state.chats[chatId].taskLoading = false;
            }
        },
        resetChat: (state, action) => {
            const chatId = action.payload;
            const { [chatId]: _oldChat, ...newChats } = state.chats;
            state.chats = newChats;
            if (Object.values(state.chats).length === 0) {
                // Last chat removed — replace it with a freshly minted
                // empty placeholder so the UI never has zero chats.
                const fresh = makeEmptyChat(state.chatLocalId++);
                state.chats = { [fresh.id]: fresh };
                state.selectedChat = fresh.id;
                return;
            }

            if (chatId === state.selectedChat) {
                state.selectedChat = Object.keys(state.chats)[Object.keys(state.chats).length - 1];
            }
        },
        resetChats: (state) => {
            const fresh = makeEmptyChat(state.chatLocalId++);
            state.chats = { [fresh.id]: fresh };
            state.selectedChat = fresh.id;
        },
        newChat: (state) => {
            // Preserve the original "only one empty chat at a time"
            // behaviour (the EMPTY sentinel naturally enforced this by
            // sharing a key). If an empty placeholder already exists,
            // just select it; otherwise mint a new UUID-keyed slot.
            const existingEmpty = Object.values(state.chats).find(c => c.isEmpty);
            if (existingEmpty) {
                state.selectedChat = existingEmpty.id;
                return;
            }
            const fresh = makeEmptyChat(state.chatLocalId++);
            state.chats[fresh.id] = fresh;
            state.selectedChat = fresh.id;
        },
        chatOpened: (state, action) => {
            const { chatId, title } = action.payload;
            // Idempotent: the server may emit `chat/opened` for a chat
            // the client already created via UUID-upfront flow, in
            // which case we don't want to clobber its state. Only
            // create if missing.
            if (!state.chats[chatId]) {
                state.chats[chatId] = {
                    id: chatId,
                    title: title,
                    lastRequestId: 0,
                    messages: [],
                    localId: state.chatLocalId++,
                    addedContexts: defaultContexts,
                    pendingPrompts: [],
                    isEmpty: true,
                } as Chat;
            } else if (title) {
                state.chats[chatId].title = title;
            }
        },
        selectChat: (state, action) => {
            state.selectedChat = action.payload;
        },
        /**
         * Apply per-chat selection fields (model / agent / variant /
         * trust) carried by a `config/updated` whose top-level `chatId`
         * names a specific chat. Only that chat's slot is touched —
         * the global `state.server.config.chat.*` mirrors are updated
         * separately by the server slice's `setConfig` reducer so newly
         * created chats inherit the most recently selected values.
         */
        applyConfigToChat: (state, action) => {
            const { chatId, chat: chatConfig } = action.payload as {
                chatId: string;
                chat?: {
                    selectModel?: string;
                    selectAgent?: ChatAgent;
                    selectVariant?: string | null;
                    selectTrust?: boolean;
                };
            };
            const chat = state.chats[chatId];
            if (!chat || !chatConfig) return;
            if (chatConfig.selectModel !== undefined) {
                chat.selectedModel = chatConfig.selectModel;
            }
            if (chatConfig.selectAgent !== undefined) {
                chat.selectedAgent = chatConfig.selectAgent;
            }
            if (chatConfig.selectVariant !== undefined) {
                chat.selectedVariant = chatConfig.selectVariant;
            }
            if (chatConfig.selectTrust !== undefined) {
                chat.trust = chatConfig.selectTrust;
            }
        },
        /**
         * Legacy "apply to all chats" path used when `config/updated`
         * arrives without a `chatId` (e.g. the initial post-`initialize`
         * push that fans the session-default model/agent out across
         * every chat). Mirrors the per-field semantics of
         * `applyConfigToChat` but iterates every chat in the slice.
         */
        applyConfigToAllChats: (state, action) => {
            const { chat: chatConfig } = action.payload as {
                chat?: {
                    selectModel?: string;
                    selectAgent?: ChatAgent;
                    selectVariant?: string | null;
                    selectTrust?: boolean;
                };
            };
            if (!chatConfig) return;
            for (const chat of Object.values(state.chats)) {
                if (chatConfig.selectModel !== undefined) {
                    chat.selectedModel = chatConfig.selectModel;
                }
                if (chatConfig.selectAgent !== undefined) {
                    chat.selectedAgent = chatConfig.selectAgent;
                }
                if (chatConfig.selectVariant !== undefined) {
                    chat.selectedVariant = chatConfig.selectVariant;
                }
                if (chatConfig.selectTrust !== undefined) {
                    chat.trust = chatConfig.selectTrust;
                }
            }
        },
        addContentReceived: (state, action) => {
            processContentEvent(state, action.payload as ChatContentReceivedParams);
        },
        /**
         * Process multiple content events in a single Immer draft.
         * Used during chat restore to avoid hundreds of individual Redux
         * dispatches (each creating a separate Immer draft + React render).
         * A single batchContentReceived dispatch = one draft, one render.
         */
        batchContentReceived: (state, action) => {
            const events = action.payload as ChatContentReceivedParams[];
            for (const event of events) {
                processContentEvent(state, event);
            }
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
        setFiles: (state, action) => {
            state.files = action.payload.files;
        },
        enqueuePendingPrompt: (state, action) => {
            const { chatId, prompt } = action.payload;
            const chat = state.chats[chatId];
            if (chat) {
                chat.pendingPrompts.push(prompt);
            }
        },
        dequeuePendingPrompt: (state, action) => {
            const chatId = action.payload;
            const chat = state.chats[chatId];
            if (chat && chat.pendingPrompts.length > 0) {
                chat.pendingPrompts.shift();
            }
        },
        setSteerMessage: (state, action) => {
            const { chatId, message } = action.payload;
            const chat = state.chats[chatId];
            if (chat) {
                chat.steerMessage = chat.steerMessage
                    ? chat.steerMessage + '\n' + message
                    : message;
            }
        },
        clearSteerMessage: (state, action) => {
            const chatId = action.payload;
            const chat = state.chats[chatId];
            if (chat) {
                chat.steerMessage = undefined;
            }
        },
        pushPromptHistory: (state, action) => {
            const prompt = action.payload as string;
            // Avoid consecutive duplicates
            if (state.promptHistory[state.promptHistory.length - 1] !== prompt) {
                state.promptHistory.push(prompt);
            }
            // Keep last 100 entries
            if (state.promptHistory.length > 100) {
                state.promptHistory = state.promptHistory.slice(-100);
            }
        },
        renameChat: (state, action) => {
            const { chatId, title } = action.payload;
            const chat = state.chats[chatId];
            if (chat) {
                chat.title = title;
            }
        },
        removeFlagMessage: (state, action) => {
            const { chatId, contentId } = action.payload;
            const chat = state.chats[chatId];
            if (chat) {
                chat.messages = chat.messages.filter(
                    msg => !(msg.type === 'flag' && msg.contentId === contentId)
                );
            }
        },
        setPendingQuestion: (state, action) => {
            const data = action.payload as PendingQuestion;
            const chat = state.chats[data.chatId];
            if (chat) {
                chat.pendingQuestion = data;
            }
        },
        clearPendingQuestion: (state, action) => {
            const { chatId } = action.payload;
            const chat = state.chats[chatId];
            if (chat) {
                chat.pendingQuestion = undefined;
            }
        },
        answerPendingQuestion: (state, action) => {
            const { chatId, answer, cancelled } = action.payload;
            const chat = state.chats[chatId];
            if (chat && chat.pendingQuestion) {
                chat.pendingQuestion = {
                    ...chat.pendingQuestion,
                    answer: answer ?? undefined,
                    cancelled: !!cancelled,
                };
            }
        },
        /**
         * Resume-picker cache. Replace the cached list of resumable
         * chats with whatever the latest `chat/list` returned. The
         * thunk that drives this is also responsible for defensive
         * filtering (drop nil-id entries and subagent-prefixed ids).
         */
        setResumableChats: (state, action) => {
            state.resumableChats = action.payload as ChatSummary[];
        },
        clearResumableChats: (state) => {
            state.resumableChats = undefined;
        },
        /**
         * Rollback the optimistic update done by `beginResume`. Fired
         * by the `openChat` thunk if the server returns `{found: false}`
         * or the RPC fails. Drops the optimistic slot and falls back to
         * a fresh empty placeholder so the user always has somewhere
         * to be — rather than being stranded on a ghost chat that
         * shows "Resuming…" forever with no content arriving.
         */
        rollbackResume: (state, action) => {
            const { chatId } = action.payload as { chatId: string };
            const { [chatId]: _dropped, ...rest } = state.chats;
            state.chats = rest;
            if (Object.keys(state.chats).length === 0) {
                const fresh = makeEmptyChat(state.chatLocalId++);
                state.chats = { [fresh.id]: fresh };
                state.selectedChat = fresh.id;
                return;
            }
            if (state.selectedChat === chatId) {
                // Surface the most-recently-touched remaining chat as
                // the new selection. The object's insertion order is
                // updatedAt-ish for our purposes (newest at the end).
                const keys = Object.keys(state.chats);
                state.selectedChat = keys[keys.length - 1];
            }
        },
        /**
         * Optimistic update fired when the user picks a chat to resume.
         * Pre-creates the chat slot (so it appears in the tab strip
         * with the correct title), switches selection to it, and drops
         * the originating empty placeholder if one was provided. The
         * server's `chat/cleared` + `chat/opened` + `contentReceived`
         * cascade runs against this slot afterwards — `chatOpened` is
         * idempotent and `processContentEvent` finds the existing slot
         * and fills its messages, clearing `resuming` on the first
         * event so the "Resuming…" placeholder gives way to content.
         */
        beginResume: (state, action) => {
            const { chatId, title, originatingChatId } = action.payload as {
                chatId: string;
                title?: string;
                originatingChatId?: string;
            };
            if (!state.chats[chatId]) {
                state.chats[chatId] = {
                    id: chatId,
                    title,
                    lastRequestId: 0,
                    messages: [],
                    localId: state.chatLocalId++,
                    addedContexts: defaultContexts as ChatPreContext[],
                    pendingPrompts: [],
                    isEmpty: false,
                    resuming: true,
                } as Chat;
            } else {
                state.chats[chatId].resuming = true;
                state.chats[chatId].isEmpty = false;
                if (title && !state.chats[chatId].title) {
                    state.chats[chatId].title = title;
                }
            }
            state.selectedChat = chatId;
            if (originatingChatId && originatingChatId !== chatId) {
                const orig = state.chats[originatingChatId];
                if (orig?.isEmpty && orig.messages.length === 0) {
                    const { [originatingChatId]: _dropped, ...rest } = state.chats;
                    state.chats = rest;
                }
            }
        },
    },
});

export const {
    incRequestId,
    addContentReceived,
    batchContentReceived,
    resetChat,
    clearChat,
    cleared,
    resetChats,
    newChat,
    chatOpened,
    setCursorFocus,
    selectChat,
    applyConfigToChat,
    applyConfigToAllChats,
    setContexts,
    addContext,
    removeContext,
    setCommands,
    setFiles,
    enqueuePendingPrompt,
    dequeuePendingPrompt,
    setSteerMessage,
    clearSteerMessage,
    pushPromptHistory,
    renameChat,
    removeFlagMessage,
    setPendingQuestion,
    clearPendingQuestion,
    answerPendingQuestion,
    setResumableChats,
    clearResumableChats,
    beginResume,
    rollbackResume,
} = chatSlice.actions
