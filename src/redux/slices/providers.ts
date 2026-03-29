import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ProviderStatus } from "../../protocol";

export const providersSlice = createSlice({
    name: 'providers',
    initialState: {
        providers: [] as ProviderStatus[],
    },
    reducers: {
        setProviders: (state, action: PayloadAction<ProviderStatus[]>) => {
            state.providers = action.payload;
        },
        updateProvider: (state, action: PayloadAction<ProviderStatus>) => {
            const index = state.providers.findIndex(p => p.id === action.payload.id);
            if (index >= 0) {
                state.providers[index] = action.payload;
            } else {
                state.providers.push(action.payload);
            }
        },
    },
});

export const { setProviders, updateProvider } = providersSlice.actions;
