import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { ChatContext } from "../../protocol";
import { ChatPreContext, CursorFocus, incRequestId, resetChat } from "../slices/chat";
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

export const sendPrompt = createAsyncThunk<void, { chatId: string, prompt: string, model: string, behavior: string, }, ThunkApiType>(
    "chat/sendPrompt",
    async ({ prompt, chatId, model, behavior }, { dispatch, getState }) => {
        const state = getState();
        let requestId = state.chat.chats[chatId].lastRequestId;

        dispatch(incRequestId(chatId));

        const contexts = state.chat.chats[chatId].addedContexts;

        webviewSend('chat/userPrompt',
            {
                chatId: chatId !== 'EMPTY' ? chatId : undefined,
                requestId,
                prompt,
                contexts: contexts.map((c) => refineContext(c, state.chat.cursorFocus)).filter(x => x !== null),
                model,
                behavior,
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

export const queryContext = createAsyncThunk<void, { chatId?: string, query: string, contexts: ChatPreContext[] }, ThunkApiType>(
    "chat/queryContext",
    async ({ chatId, query, contexts }, _) => {
        webviewSend('chat/queryContext', { chatId: chatId !== 'EMPTY' ? chatId : undefined, query, contexts });
    }
);

export const queryCommands = createAsyncThunk<void, { chatId?: string, query: string }, ThunkApiType>(
    "chat/queryCommands",
    async ({ chatId, query }, _) => {
        webviewSend('chat/queryCommands', { chatId: chatId !== 'EMPTY' ? chatId : undefined, query });
    }
);

export const sendPromptToCurrentChat = createAsyncThunk<void, { prompt: string }, ThunkApiType>(
    "chat/sendPromptToCurrentChat",
    async ({ prompt }, { dispatch, getState }) => {
        const state = getState();
        const chatId = state.chat.selectedChat;
        const model = state.server.config.chat.selectModel || state.server.config.chat.models[0];
        const behavior = state.server.config.chat.selectBehavior || state.server.config.chat.behaviors[0];

        if (model && behavior) {
            dispatch(sendPrompt({ prompt, chatId, model, behavior }));
        }
    }
);
