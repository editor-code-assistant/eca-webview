import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend, webviewSendAndGet } from "../../hooks";
import { ThunkApiType } from "../store";

interface UpdateServerParams {
    name: string;
    command?: string;
    args?: string[];
    url?: string;
}

export const startServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/startServer",
    async ({ name }, {}) => {
        webviewSend('mcp/startServer', { name });
    }
);

export const stopServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/stopServer",
    async ({ name }, {}) => {
        webviewSend('mcp/stopServer', { name });
    }
);

export const connectServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/connectServer",
    async ({ name }, {}) => {
        webviewSend('mcp/connectServer', { name });
    }
);

export const logoutServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/logoutServer",
    async ({ name }, {}) => {
        webviewSend('mcp/logoutServer', { name });
    }
);

export const updateServer = createAsyncThunk<void, UpdateServerParams, ThunkApiType>(
    "mcp/updateServer",
    async (params) => {
        await webviewSendAndGet('mcp/updateServer', params);
    }
);
