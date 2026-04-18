import { createAsyncThunk } from "@reduxjs/toolkit";
import { resetInitProgress, ServerStatus, setStatus } from "../slices/server";
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
        // Clear init-progress tasks on any terminal-ish transition so a
        // subsequent restart doesn't render stale progress. Running is
        // intentionally NOT in this list — tasks naturally settle into
        // "all finished", and selectInitProgressString already hides
        // the line in that case; keeping the history around lets a
        // late-arriving Running transition find a consistent slice.
        if (status === ServerStatus.Stopped || status === ServerStatus.Failed) {
            dispatch(resetInitProgress());
        }
    }
);

export const openServerLogs = createAsyncThunk<void, {}, ThunkApiType>(
    "server/openLogs",
    async ({}, {}) => {
        webviewSend('editor/openServerLogs', {});
    }
);
