import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend, webviewSendAndGet } from "../../hooks";
import {
    McpAddServerRequest,
    McpAddServerResponse,
    McpRemoveServerRequest,
    McpRemoveServerResponse,
} from "../../protocol";
import { ThunkApiType } from "../store";

interface UpdateServerParams {
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
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

export const disableServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/disableServer",
    async ({ name }, {}) => {
        webviewSend('mcp/disableServer', { name });
    }
);

export const enableServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/enableServer",
    async ({ name }, {}) => {
        webviewSend('mcp/enableServer', { name });
    }
);

export const updateServer = createAsyncThunk<void, UpdateServerParams, ThunkApiType>(
    "mcp/updateServer",
    async (params) => {
        await webviewSendAndGet('mcp/updateServer', params);
    }
);

/**
 * Request the server to add a new MCP server definition.
 * Resolves with the canonical add-server response (including `error` when
 * validation fails) so UI code can surface problems inline.
 * The server also broadcasts the new entry through `tool/serverUpdated`,
 * so the slice will converge regardless of how this promise is awaited.
 */
export const addServer = createAsyncThunk<McpAddServerResponse, McpAddServerRequest, ThunkApiType>(
    "mcp/addServer",
    async (params) => {
        const result = await webviewSendAndGet<McpAddServerRequest>('mcp/addServer', params);
        return result as McpAddServerResponse;
    }
);

/**
 * Request the server to remove an MCP server definition.
 * The server broadcasts `tool/serverRemoved`; the slice optimistically
 * drops the row here so the UI doesn't flicker while waiting.
 */
export const removeServer = createAsyncThunk<McpRemoveServerResponse, McpRemoveServerRequest, ThunkApiType>(
    "mcp/removeServer",
    async (params) => {
        const result = await webviewSendAndGet<McpRemoveServerRequest>('mcp/removeServer', params);
        return result as McpRemoveServerResponse;
    }
);
