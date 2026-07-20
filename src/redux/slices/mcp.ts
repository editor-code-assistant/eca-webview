import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import type { ToolServerRemovedParams, ToolServerUpdatedParams } from "../../protocol";

export const mcpSlice = createSlice({
    name: 'mcp',
    initialState: {
        servers: [] as ToolServerUpdatedParams[],
    },
    reducers: {
        setMcpServers: (state, action: PayloadAction<ToolServerUpdatedParams[]>) => {
            state.servers = action.payload;
        },
        /**
         * Remove a server by name. Triggered by either:
         *   1. The `tool/serverRemoved` notification from the server, or
         *   2. An optimistic dispatch from the remove-server thunk so the
         *      card disappears immediately while the RPC round-trips.
         * Duplicates are safe: a missing entry is a no-op.
         */
        removeMcpServer: (state, action: PayloadAction<ToolServerRemovedParams>) => {
            state.servers = state.servers.filter(s => s.name !== action.payload.name);
        },
    },
});

export const { setMcpServers, removeMcpServer } = mcpSlice.actions
