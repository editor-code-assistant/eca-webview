import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend, webviewSendAndGet } from "../../hooks";
import { setCursorFocus } from "../slices/chat";
import type { ThunkApiType } from "../store";
import type { FocusChanged, GlobalConfigReadResult, GlobalConfigWriteResult } from '../../webviewProtocol';

export const focusChanged = createAsyncThunk<void, FocusChanged, ThunkApiType>(
    "editor/focusChanged",
    ({ type, path, position }, { dispatch }) => {
        switch (type) {
            case 'fileFocused':
                dispatch(setCursorFocus(position ? { path, position } : undefined));
                break;
        }
    }
);

export const editorOpenFile = createAsyncThunk<void, { path: string }, ThunkApiType>(
    "editor/openFile",
    ({ path }) => {
        webviewSend('editor/openFile', { path });
    }
);

export const editorOpenGlobalConfig = createAsyncThunk<void, void, ThunkApiType>(
    "editor/openGlobalConfig",
    () => {
        webviewSend('editor/openGlobalConfig', {});
    }
);

export const editorReadGlobalConfig = createAsyncThunk<GlobalConfigReadResult, void, ThunkApiType>(
    "editor/readGlobalConfig",
    () => webviewSendAndGet('editor/readGlobalConfig', {}),
);

export const editorWriteGlobalConfig = createAsyncThunk<GlobalConfigWriteResult, { contents: string }, ThunkApiType>(
    "editor/writeGlobalConfig",
    ({ contents }) => webviewSendAndGet('editor/writeGlobalConfig', { contents }),
);

export const editorReadInput = createAsyncThunk<string | null, { message: string }, ThunkApiType>(
    "editor/readInput",
    ({ message }) => webviewSendAndGet('editor/readInput', { message }),
);

export const editorOpenUrl = createAsyncThunk<void, { url: string }, ThunkApiType>(
    "editor/openUrl",
    ({ url }) => {
        webviewSend('editor/openUrl', { url });
    }
);
