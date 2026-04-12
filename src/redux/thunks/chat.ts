import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { ChatContext } from "../../protocol";
import { ChatPreContext, CursorFocus, incRequestId, removeFlagMessage, resetChat } from "../slices/chat";
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
                chatId: chatId !== 'EMPTY' ? chatId : undefined,
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
        webviewSend('chat/queryContext', { chatId: chatId !== 'EMPTY' ? chatId : undefined, query, contexts });
    }
);

export const queryCommands = createAsyncThunk<void, { chatId?: string, query: string }, ThunkApiType>(
    "chat/queryCommands",
    async ({ chatId, query }, _) => {
        webviewSend('chat/queryCommands', { chatId: chatId !== 'EMPTY' ? chatId : undefined, query });
    }
);

export const queryFiles = createAsyncThunk<void, { chatId?: string, query: string }, ThunkApiType>(
    "chat/queryFiles",
    async ({ chatId, query }, _) => {
        webviewSend('chat/queryFiles', { chatId: chatId !== 'EMPTY' ? chatId : undefined, query });
    }
);

export const sendPromptToCurrentChat = createAsyncThunk<void, { prompt: string }, ThunkApiType>(
    "chat/sendPromptToCurrentChat",
    async ({ prompt }, { dispatch, getState }) => {
        const state = getState();
        const chatId = state.chat.selectedChat;
        const model = state.server.config.chat.selectModel || state.server.config.chat.models[0];
        const agent = state.server.config.chat.selectAgent || state.server.config.chat.agents[0];
        const variant = state.server.config.chat.selectedVariant;

        if (model && agent) {
            dispatch(sendPrompt({ prompt, chatId, model, agent, variant }));
        }
    }
);
