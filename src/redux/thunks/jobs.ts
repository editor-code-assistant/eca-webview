import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSendAndGet } from "../../hooks";
import { JobsReadOutputResult, JobsKillResult, Job } from "../../protocol";

export const fetchJobsList = createAsyncThunk<Job[], void>(
    "jobs/fetchList",
    async () => {
        const result = await webviewSendAndGet('jobs/list', {});
        return result.jobs ?? [];
    }
);

export const fetchJobOutput = createAsyncThunk<JobsReadOutputResult, { jobId: string }>(
    "jobs/fetchOutput",
    async ({ jobId }) => {
        const result = await webviewSendAndGet('jobs/readOutput', { jobId });
        return result as JobsReadOutputResult;
    }
);

export const killJob = createAsyncThunk<JobsKillResult, { jobId: string }>(
    "jobs/kill",
    async ({ jobId }) => {
        const result = await webviewSendAndGet('jobs/kill', { jobId });
        return result as JobsKillResult;
    }
);
