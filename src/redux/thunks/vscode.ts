import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { ThunkApiType } from "../store";

export const editorOpenFile = createAsyncThunk<void, { path: string }, ThunkApiType>(
    "editor/openFile",
    async ({ path }, _) => {
        webviewSend('editor/openFile', { path });
    }
);
