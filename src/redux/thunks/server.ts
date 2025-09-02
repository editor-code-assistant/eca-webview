import { createAsyncThunk } from "@reduxjs/toolkit";
import { ServerStatus, setStatus } from "../slices/server";
import { ThunkApiType } from "../store";
import { resetChats } from "../slices/chat";
import { webviewSend } from "../../hooks";

export const statusChanged = createAsyncThunk<void, { status: ServerStatus }, ThunkApiType>(
    "server/statusChanged",
    async ({ status }, { dispatch }) => {
        dispatch(setStatus(status));
        if (status === ServerStatus.Stopped) {
            dispatch(resetChats());
        }
    }
);

export const openServerLogs = createAsyncThunk<void, {}, ThunkApiType>(
    "server/openLogs",
    async ({}, {}) => {
        webviewSend('editor/openServerLogs', {});
    }
);
