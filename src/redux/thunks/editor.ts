import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend, webviewSendAndGet } from "../../hooks";
import { setCursorFocus } from "../slices/chat";
import { ThunkApiType } from "../store";
import type { FocusChanged, GlobalConfigReadResult, GlobalConfigWriteResult } from '../../webviewProtocol';

export const focusChanged = createAsyncThunk<void, FocusChanged, ThunkApiType>(
    "editor/focusChanged",
    async ({ type, path, position }, { dispatch }) => {
        switch (type) {
            case 'fileFocused':
                dispatch(setCursorFocus({
                    path: path,
                    position: position,
                }));
                break;
        }
    }
);

export const editorOpenFile = createAsyncThunk<void, { path: string }, ThunkApiType>(
    "editor/openFile",
    async ({ path }, _) => {
        webviewSend('editor/openFile', { path });
    }
);

export const editorOpenGlobalConfig = createAsyncThunk<void, {}, ThunkApiType>(
    "editor/openGlobalConfig",
    async (_) => {
        webviewSend('editor/openGlobalConfig', {});
    }
);

export const editorReadGlobalConfig = createAsyncThunk<GlobalConfigReadResult, {}, ThunkApiType>(
    "editor/readGlobalConfig",
    async (_) => {
        return await webviewSendAndGet('editor/readGlobalConfig', {});
    }
);

export const editorWriteGlobalConfig = createAsyncThunk<GlobalConfigWriteResult, { contents: string }, ThunkApiType>(
    "editor/writeGlobalConfig",
    async ({ contents }, _) => {
        return await webviewSendAndGet('editor/writeGlobalConfig', { contents });
    }
);

export const editorReadInput = createAsyncThunk<string | null, { message: string }, ThunkApiType>(
    "editor/readInput",
    async ({ message }, _) => {
        return await webviewSendAndGet('editor/readInput', { message });
    }
);

export const editorOpenUrl = createAsyncThunk<void, { url: string }, ThunkApiType>(
    "editor/openUrl",
    async ({ url }, _) => {
        webviewSend('editor/openUrl', { url });
    }
);
