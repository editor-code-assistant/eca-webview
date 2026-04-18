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
        // Clear init-progress tasks on any transition that kicks off a
        // fresh lifecycle — Stopped/Failed terminal transitions, plus
        // Starting at the top of a new attempt — so stale 'finish'
        // entries from the previous run don't make
        // selectInitProgressString prematurely return null during
        // re-init. Running is intentionally NOT in this list: tasks
        // naturally settle into "all finished" and
        // selectInitProgressString already hides the line then;
        // keeping the history around lets a late-arriving Running
        // transition find a consistent slice. Initializing is also
        // NOT in this list (resetting while mid-init would discard
        // the tasks actively driving the progress display).
        if (
            status === ServerStatus.Stopped
            || status === ServerStatus.Failed
            || status === ServerStatus.Starting
        ) {
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
