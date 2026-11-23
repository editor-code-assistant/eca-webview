import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSendAndGet } from "../../hooks";
import { LoginAction, ProvidersListResult } from "../../protocol";
import { setProviders } from "../slices/providers";
import { ThunkApiType } from "../store";

/**
 * Clients relay a server error (e.g. a login that can't listen for its OAuth
 * callback) as `{ error: { message } }`: reject with that message so the
 * caller can show the user why.
 */
function throwIfError<T>(result: T): T {
    const error = (result as { error?: { message?: string } } | null)?.error;
    if (error) {
        throw new Error(error.message || 'Request failed');
    }
    return result;
}

export const listProviders = createAsyncThunk<void, void, ThunkApiType>(
    "providers/list",
    async (_, { dispatch }) => {
        const result: ProvidersListResult = throwIfError(await webviewSendAndGet('providers/list', {}));
        dispatch(setProviders(result.providers));
    }
);

export const loginProvider = createAsyncThunk<LoginAction, { provider: string; method?: string }, ThunkApiType>(
    "providers/login",
    async (params) => {
        return throwIfError(await webviewSendAndGet('providers/login', params));
    }
);

export const loginProviderInput = createAsyncThunk<void, { provider: string; data: Record<string, string> }, ThunkApiType>(
    "providers/loginInput",
    async (params) => {
        throwIfError(await webviewSendAndGet('providers/loginInput', params));
    }
);

export const logoutProvider = createAsyncThunk<void, { provider: string }, ThunkApiType>(
    "providers/logout",
    async (params) => {
        throwIfError(await webviewSendAndGet('providers/logout', params));
    }
);
