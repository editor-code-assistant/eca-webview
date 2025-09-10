import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
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
