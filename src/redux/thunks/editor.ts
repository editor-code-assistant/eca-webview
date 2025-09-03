import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { setUniqueContext } from "../slices/chat";
import { ThunkApiType } from "../store";

interface FileFocusChanged {
    type: 'fileFocused';
    path: string;
}

type FocusChanged = FileFocusChanged;

export const focusChanged = createAsyncThunk<void, FocusChanged, ThunkApiType>(
    "editor/focusChanged",
    async ({ type, path }, { dispatch }) => {
        switch (type) {
            case 'fileFocused':
                dispatch(setUniqueContext({ uniqueType: type, context: { type: 'file', path: path } }));
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
