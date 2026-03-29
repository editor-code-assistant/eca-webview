import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSendAndGet } from "../../hooks";
import { LoginAction, ProvidersListResult } from "../../protocol";
import { setProviders } from "../slices/providers";
import { ThunkApiType } from "../store";

export const listProviders = createAsyncThunk<void, void, ThunkApiType>(
    "providers/list",
    async (_, { dispatch }) => {
        const result: ProvidersListResult = await webviewSendAndGet('providers/list', {});
        dispatch(setProviders(result.providers));
    }
);

export const loginProvider = createAsyncThunk<LoginAction, { provider: string; method?: string }, ThunkApiType>(
    "providers/login",
    async (params) => {
        return await webviewSendAndGet('providers/login', params);
    }
);

export const loginProviderInput = createAsyncThunk<void, { provider: string; data: Record<string, string> }, ThunkApiType>(
    "providers/loginInput",
    async (params) => {
        await webviewSendAndGet('providers/loginInput', params);
    }
);

export const logoutProvider = createAsyncThunk<void, { provider: string }, ThunkApiType>(
    "providers/logout",
    async (params) => {
        await webviewSendAndGet('providers/logout', params);
    }
);
