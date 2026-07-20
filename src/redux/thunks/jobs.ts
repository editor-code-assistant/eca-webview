import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSendAndGet } from "../../hooks";
import type { JobsReadOutputResult, JobsKillResult, Job } from "../../protocol";

export const fetchJobsList = createAsyncThunk<Job[]>(
    "jobs/fetchList",
    async () => (await webviewSendAndGet('jobs/list', {})).jobs ?? [],
);

export const fetchJobOutput = createAsyncThunk<JobsReadOutputResult, { jobId: string }>(
    "jobs/fetchOutput",
    ({ jobId }) => webviewSendAndGet('jobs/readOutput', { jobId }),
);

export const killJob = createAsyncThunk<JobsKillResult, { jobId: string }>(
    "jobs/kill",
    ({ jobId }) => webviewSendAndGet('jobs/kill', { jobId }),
);
