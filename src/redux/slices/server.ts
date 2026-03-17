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
        agents: string[];
        selectModel?: string;
        selectAgent?: string;
        welcomeMessage: string;
        variants: string[];
        selectedVariant: string | null;
    }
}

export const serverSlice = createSlice({
    name: 'server',
    initialState: {
        status: ServerStatus.Stopped,
        workspaceFolders: [] as WorkspaceFolder[],
        trust: false,
        config: {
            chat: {
                models: [],
                agents: [],
                welcomeMessage: "",
                variants: [],
                selectedVariant: null,
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
                if (action.payload.chat.agents !== undefined) {
                    state.config.chat.agents = action.payload.chat.agents;
                }
                if (action.payload.chat.selectAgent !== undefined) {
                    state.config.chat.selectAgent = action.payload.chat.selectAgent;
                }
                if (action.payload.chat.welcomeMessage !== undefined) {
                    state.config.chat.welcomeMessage = action.payload.chat.welcomeMessage;
                }
                if (action.payload.chat.variants !== undefined) {
                    state.config.chat.variants = action.payload.chat.variants;
                }
                if (action.payload.chat.selectVariant !== undefined) {
                    state.config.chat.selectedVariant = action.payload.chat.selectVariant;
                }
            }
        },
        setSelectedVariant: (state, action) => {
            state.config.chat.selectedVariant = action.payload;
        },
        setTrust: (state, action) => {
            state.trust = action.payload;
        },
    },
});

export const {
    setStatus,
    setWorkspaceFolders,
    setConfig,
    setSelectedVariant,
    setTrust,
} = serverSlice.actions
