import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend, webviewSendAndGet } from "../../hooks";
import { ChatContext, ChatSummary } from "../../protocol";
import { beginResume, clearPendingQuestion, ChatPreContext, CursorFocus, incRequestId, removeFlagMessage, resetChat, rollbackResume, setResumableChats } from "../slices/chat";
import { ThunkApiType } from "../store";

function refineContext(context: ChatPreContext, cursorFocus?: CursorFocus): ChatContext | null {
    switch (context.type) {
        case 'cursor':
            if (cursorFocus) {
                return {
                    type: 'cursor',
                    path: cursorFocus.path,
                    position: cursorFocus.position
                };
            } else {
                return null;
            }
        default:
            return context;
    }
}

export const sendPrompt = createAsyncThunk<void, { chatId: string, prompt: string, model?: string, agent: string, variant?: string | null }, ThunkApiType>(
    "chat/sendPrompt",
    async ({ prompt, chatId, model, agent, variant }, { dispatch, getState }) => {
        const state = getState();
        let requestId = state.chat.chats[chatId].lastRequestId;

        dispatch(incRequestId(chatId));

        const contexts = state.chat.chats[chatId].addedContexts;
        const trust = state.server.trust;

        webviewSend('chat/userPrompt',
            {
                // The webview now mints chat ids up-front (UUID) and
                // sends them on every prompt, including the very first.
                // Unknown ids tell the server "create this chat for
                // me", which it confirms via `chat/opened`.
                chatId,
                requestId,
                prompt,
                contexts: contexts.map((c) => refineContext(c, state.chat.cursorFocus)).filter(x => x !== null),
                model,
                agent,
                ...(variant ? { variant } : {}),
                ...(trust ? { trust } : {}),
            },
        );
    }
);

export const toolCallApprove = createAsyncThunk<void, { chatId: string, toolCallId: string, save?: string }, ThunkApiType>(
    "chat/toolCallApprove",
    async ({ chatId, toolCallId, save }, _) => {
        webviewSend('chat/toolCallApprove', { chatId, toolCallId, save });
    }
);

export const toolCallReject = createAsyncThunk<void, { chatId: string, toolCallId: string }, ThunkApiType>(
    "chat/toolCallReject",
    async ({ chatId, toolCallId }, _) => {
        webviewSend('chat/toolCallReject', { chatId, toolCallId });
    }
);

export const stopPrompt = createAsyncThunk<void, { chatId: string }, ThunkApiType>(
    "chat/stopPrompt",
    async ({ chatId }, _) => {
        webviewSend('chat/promptStop', { chatId });
    }
);

export const steerPrompt = createAsyncThunk<void, { chatId: string, message: string }, ThunkApiType>(
    "chat/steerPrompt",
    async ({ chatId, message }, _) => {
        webviewSend('chat/promptSteer', { chatId, message });
    }
);

export const deleteChat = createAsyncThunk<void, { chatId: string }, ThunkApiType>(
    "chat/delete",
    async ({ chatId }, { dispatch }) => {
        webviewSend('chat/delete', { chatId });
        dispatch(resetChat(chatId));
    }
);

export const rollbackChat = createAsyncThunk<void, { chatId: string, contentId: string }, ThunkApiType>(
    "chat/rollback",
    async ({ chatId, contentId }, _) => {
        webviewSend('chat/rollback', { chatId, contentId });
    }
);

export const addFlag = createAsyncThunk<void, { chatId: string, contentId: string }, ThunkApiType>(
    "chat/addFlag",
    async ({ chatId, contentId }, _) => {
        webviewSend('chat/addFlag', { chatId, contentId });
    }
);

export const removeFlag = createAsyncThunk<void, { chatId: string, contentId: string }, ThunkApiType>(
    "chat/removeFlag",
    async ({ chatId, contentId }, { dispatch }) => {
        webviewSend('chat/removeFlag', { chatId, contentId });
        dispatch(removeFlagMessage({ chatId, contentId }));
    }
);

export const forkFromFlag = createAsyncThunk<void, { chatId: string, contentId: string }, ThunkApiType>(
    "chat/fork",
    async ({ chatId, contentId }, _) => {
        webviewSend('chat/fork', { chatId, contentId });
    }
);

export const queryContext = createAsyncThunk<void, { chatId?: string, query: string, contexts: ChatPreContext[] }, ThunkApiType>(
    "chat/queryContext",
    async ({ chatId, query, contexts }, _) => {
        webviewSend('chat/queryContext', { chatId, query, contexts });
    }
);

export const queryCommands = createAsyncThunk<void, { chatId?: string, query: string }, ThunkApiType>(
    "chat/queryCommands",
    async ({ chatId, query }, _) => {
        webviewSend('chat/queryCommands', { chatId, query });
    }
);

export const queryFiles = createAsyncThunk<void, { chatId?: string, query: string }, ThunkApiType>(
    "chat/queryFiles",
    async ({ chatId, query }, _) => {
        webviewSend('chat/queryFiles', { chatId, query });
    }
);

export const answerQuestion = createAsyncThunk<void, { chatId: string, answer: string }, ThunkApiType>(
    "chat/answerQuestion",
    async ({ chatId, answer }, { dispatch, getState }) => {
        const state = getState();
        const chat = state.chat.chats[chatId];
        if (!chat?.pendingQuestion) return;

        const requestId = chat.pendingQuestion.requestId;
        webviewSend('chat/answerQuestion', { requestId, answer, cancelled: false });
        dispatch(clearPendingQuestion({ chatId }));
    }
);

export const cancelQuestion = createAsyncThunk<void, { chatId: string }, ThunkApiType>(
    "chat/cancelQuestion",
    async ({ chatId }, { dispatch, getState }) => {
        const state = getState();
        const chat = state.chat.chats[chatId];
        if (!chat?.pendingQuestion) return;

        const requestId = chat.pendingQuestion.requestId;
        webviewSend('chat/answerQuestion', { requestId, answer: null, cancelled: true });
        dispatch(clearPendingQuestion({ chatId }));
    }
);

/**
 * Fetch the list of resumable chats from the server and cache it on
 * `state.chat.resumableChats`. Drops entries that the server-side
 * projection might leak even though it shouldn't — defensive against
 * older server versions where:
 *   - legacy rows produced nil ids (fixed in eca commit 98b85d6e), and
 *   - subagent chats without an explicit `:subagent` flag slip into
 *     the list (identified by their `subagent-` id prefix).
 *
 * On any RPC failure the cache is set to an empty array so the hint
 * stays hidden — better than leaving the user staring at a broken
 * "Resume" affordance that does nothing.
 */
export const listChats = createAsyncThunk<ChatSummary[], void, ThunkApiType>(
    "chat/list",
    async (_, { dispatch }) => {
        try {
            const result = await webviewSendAndGet('chat/list', { limit: 100, sortBy: 'updatedAt' });
            if (!result || result.error) {
                if (result?.error) {
                    console.error('chat/list failed:', result.error);
                }
                dispatch(setResumableChats([]));
                return [];
            }
            const chats: ChatSummary[] = ((result.chats ?? []) as ChatSummary[]).filter(
                (c) => c.id && !c.id.startsWith('subagent-'),
            );
            dispatch(setResumableChats(chats));
            return chats;
        } catch (err) {
            console.error('chat/list error:', err);
            dispatch(setResumableChats([]));
            return [];
        }
    }
);

/**
 * Resume a persisted chat. Two phases:
 *
 *   1. **Optimistic update (synchronous):** dispatches `beginResume`,
 *      which pre-creates the chat slot with the picker-known title,
 *      switches selection to it, and drops the originating empty
 *      placeholder. The user sees an instant tab swap and a small
 *      "Resuming…" placeholder where the welcome view would otherwise
 *      sit — no lingering empty-chat surface while the server replays.
 *
 *   2. **Server replay:** the `chat/open` request causes the server
 *      to emit `chat/cleared` → `chat/opened` → N × `chat/contentReceived`
 *      → `config/updated` BEFORE the response returns. Those flow
 *      through the regular RootWrapper listeners; `chatOpened` is
 *      idempotent (the slot exists, only title is updated) and
 *      `processContentEvent` fills messages, clearing the `resuming`
 *      flag on the first event.
 *
 * On `{found: false}` or RPC error the thunk rejects. The optimistic
 * chat slot is left in place — the user sees a chat with title but no
 * content. A rollback path could restore the originating placeholder
 * if this turns out to be confusing in practice.
 */
export const openChat = createAsyncThunk<
    { chatId: string; title?: string },
    { chatId: string; originatingChatId?: string; title?: string },
    ThunkApiType
>(
    "chat/open",
    async ({ chatId, originatingChatId, title }, { dispatch }) => {
        // Phase 1: optimistic UI update — fires synchronously before
        // any await so the picker's `onClose()` + this dispatch batch
        // into a single React render.
        dispatch(beginResume({ chatId, title, originatingChatId }));

        try {
            // Phase 2: server replay.
            const result = await webviewSendAndGet('chat/open', { chatId });
            if (result?.error) {
                throw new Error(result.error.message ?? 'Failed to open chat');
            }
            // The server emits `{:found? bool ...}` and `csk/->camelCaseString`
            // preserves the trailing `?` on the wire — so the JSON we receive
            // has key `"found?"` literally. Accept both shapes so we don't
            // care which side of a future server-side rename we're on.
            const found = result?.found ?? result?.['found?'];
            if (!found) {
                throw new Error('Chat not found');
            }
            return { chatId: result.chatId ?? chatId, title: result.title };
        } catch (err) {
            // Phase 3 (failure path): rollback the optimistic chat slot
            // so the user isn't stranded on a ghost chat with a stuck
            // "Resuming…" spinner that never resolves.
            dispatch(rollbackResume({ chatId }));
            throw err;
        }
    }
);

export const sendPromptToCurrentChat = createAsyncThunk<void, { prompt: string }, ThunkApiType>(
    "chat/sendPromptToCurrentChat",
    async ({ prompt }, { dispatch, getState }) => {
        const state = getState();
        const chatId = state.chat.selectedChat;
        const chat = state.chat.chats[chatId];
        // Prefer per-chat selection (set via scoped `config/updated`)
        // before falling back to the global last-known mirrors and
        // finally the first-available list entry.
        const model = chat?.selectedModel
            || state.server.config.chat.selectModel
            || state.server.config.chat.models[0];
        const agent = chat?.selectedAgent
            || state.server.config.chat.selectAgent
            || state.server.config.chat.agents[0];
        const variant = chat?.selectedVariant !== undefined
            ? chat.selectedVariant
            : state.server.config.chat.selectedVariant;

        if (model && agent) {
            dispatch(sendPrompt({ prompt, chatId, model, agent, variant }));
        }
    }
);
