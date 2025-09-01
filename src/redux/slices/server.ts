import { createSlice } from "@reduxjs/toolkit";
import { WorkspaceFolder } from "../../protocol";

export enum ServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Running = 'Running',
    Failed = 'Failed',
}

interface EcaConfig {
    usageStringFormat?: string;
    chat: {
        models: string[];
        behaviors: string[];
        selectModel?: string;
        selectBehavior?: string;
        welcomeMessage: string;
    }
}

export const serverSlice = createSlice({
    name: 'server',
    initialState: {
        status: ServerStatus.Stopped,
        workspaceFolders: [] as WorkspaceFolder[],
        config: {
            chat: {
                models: [],
                behaviors: [],
                welcomeMessage: "",
            }
        } as EcaConfig,
    },
    reducers: {
        setStatus: (state, action) => {
            state.status = action.payload;
        },
        setWorkspaceFolders: (state, action) => {
            state.workspaceFolders = action.payload;
        },
        setConfig: (state, action) => {
            if (action.payload.usageStringFormat !== undefined) {
                state.config.usageStringFormat = action.payload.usageStringFormat;
            }
            if (action.payload.chat !== undefined) {
                if (action.payload.chat.models !== undefined) {
                    state.config.chat.models = action.payload.chat.models;
                }
                if (action.payload.chat.selectModel !== undefined) {
                    state.config.chat.selectModel = action.payload.chat.selectModel;
                }
                if (action.payload.chat.behaviors !== undefined) {
                    state.config.chat.behaviors = action.payload.chat.behaviors;
                }
                if (action.payload.chat.selectBehavior !== undefined) {
                    state.config.chat.selectBehavior = action.payload.chat.selectBehavior;
                }
                if (action.payload.chat.welcomeMessage !== undefined) {
                    state.config.chat.welcomeMessage = action.payload.chat.welcomeMessage;
                }
            }
        }
    },
});

export const {
    setStatus,
    setWorkspaceFolders,
    setConfig,
} = serverSlice.actions
