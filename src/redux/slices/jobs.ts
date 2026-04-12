import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Job } from "../../protocol";
import { State } from "../store";

interface JobsState {
    jobs: Job[];
}

export const jobsSlice = createSlice({
    name: 'jobs',
    initialState: {
        jobs: [],
    } as JobsState,
    reducers: {
        setJobs: (state, action: PayloadAction<Job[]>) => {
            state.jobs = action.payload;
        },
    },
});

export const { setJobs } = jobsSlice.actions;

// Selectors
export const selectJobs = (state: State) => state.jobs.jobs;

export const selectRunningJobs = (state: State) =>
    state.jobs.jobs.filter(j => j.status === 'running');

export const selectRunningJobCount = (state: State) =>
    state.jobs.jobs.filter(j => j.status === 'running').length;

export const selectJobByToolCallId = (toolCallId: string) => (state: State) =>
    state.jobs.jobs.find(j => j.toolCallId === toolCallId);
