import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend, webviewSendAndGet } from "../../hooks";
import type {
    McpAddServerRequest,
    McpAddServerResponse,
    McpRemoveServerRequest,
    McpRemoveServerResponse,
} from "../../protocol";
import type { ThunkApiType } from "../store";
import type { McpUpdateServerRequest } from '../../webviewProtocol';

export const startServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/startServer",
    ({ name }) => {
        webviewSend('mcp/startServer', { name });
    }
);

export const stopServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/stopServer",
    ({ name }) => {
        webviewSend('mcp/stopServer', { name });
    }
);

export const connectServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/connectServer",
    ({ name }) => {
        webviewSend('mcp/connectServer', { name });
    }
);

export const logoutServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/logoutServer",
    ({ name }) => {
        webviewSend('mcp/logoutServer', { name });
    }
);

export const disableServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/disableServer",
    ({ name }) => {
        webviewSend('mcp/disableServer', { name });
    }
);

export const enableServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/enableServer",
    ({ name }) => {
        webviewSend('mcp/enableServer', { name });
    }
);

export const updateServer = createAsyncThunk<void, McpUpdateServerRequest, ThunkApiType>(
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
        return await webviewSendAndGet('mcp/addServer', params);
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
        return await webviewSendAndGet('mcp/removeServer', params);
    }
);
