import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend, webviewSendAndGet } from "../../hooks";
import { setCursorFocus } from "../slices/chat";
import { ThunkApiType } from "../store";

interface FileFocusChanged {
    type: 'fileFocused';
    path: string;
    position?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
}

type FocusChanged = FileFocusChanged;

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

export interface GlobalConfigReadResult {
    /** Raw file contents. Empty string when the file does not exist yet. */
    contents: string;
    /** Absolute path resolved on the main side. */
    path: string;
    /** Whether the file exists on disk. */
    exists: boolean;
    /** Populated if an IO error occurred. */
    error?: string;
}

export const editorReadGlobalConfig = createAsyncThunk<GlobalConfigReadResult, {}, ThunkApiType>(
    "editor/readGlobalConfig",
    async (_) => {
        return await webviewSendAndGet('editor/readGlobalConfig', {});
    }
);

export interface GlobalConfigWriteResult {
    ok: boolean;
    path?: string;
    error?: string;
}

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
