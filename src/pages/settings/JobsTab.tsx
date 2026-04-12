import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Job, JobStatus } from '../../protocol';
import { selectJobs } from '../../redux/slices/jobs';
import { useEcaDispatch } from '../../redux/store';
import { fetchJobsList, killJob } from '../../redux/thunks/jobs';
import { JobOutput } from './JobOutput';
import './JobsTab.scss';

const statusIcon: Record<JobStatus, string> = {
    running: '🟡',
    completed: '✅',
    failed: '🔴',
    killed: '⚫',
};

const statusLabel: Record<JobStatus, string> = {
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    killed: 'Killed',
};

function formatElapsed(job: Job): string {
    if (job.status === 'running' && job.startedAt) {
        // Compute elapsed client-side for running jobs
        const started = new Date(job.startedAt).getTime();
        const now = Date.now();
        const diffMs = now - started;
        if (diffMs < 0) return job.elapsed || '0s';
        const secs = Math.floor(diffMs / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remainSecs = secs % 60;
        if (mins < 60) return `${mins}m ${remainSecs}s`;
        const hours = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hours}h ${remainMins}m`;
    }
    return job.elapsed || '';
}

interface GroupedJobs {
    chatId: string;
    chatLabel: string;
    jobs: Job[];
}

function groupJobsByChat(jobs: Job[]): GroupedJobs[] {
    const groups = new Map<string, GroupedJobs>();
    for (const job of jobs) {
        const key = job.chatId || 'unknown';
        if (!groups.has(key)) {
            groups.set(key, {
                chatId: key,
                chatLabel: job.chatLabel || key,
                jobs: [],
            });
        }
        groups.get(key)!.jobs.push(job);
    }
    return Array.from(groups.values());
}

function JobCard({ job }: { job: Job }) {
    const dispatch = useEcaDispatch();
    const [showOutput, setShowOutput] = useState(false);
    const [killing, setKilling] = useState(false);
    const [elapsed, setElapsed] = useState(formatElapsed(job));

    // Live elapsed time update for running jobs
    useEffect(() => {
        if (job.status !== 'running') {
            setElapsed(formatElapsed(job));
            return;
        }
        setElapsed(formatElapsed(job));
        const timer = setInterval(() => {
            setElapsed(formatElapsed(job));
        }, 1000);
        return () => clearInterval(timer);
    }, [job.status, job.startedAt, job.elapsed]);

    const handleKill = async () => {
        if (killing) return;
        setKilling(true);
        try {
            await dispatch(killJob({ jobId: job.id })).unwrap();
        } catch {
            // Job may have already terminated
        }
        setKilling(false);
    };

    const truncatedLabel = job.label && job.label.length > 80
        ? job.label.slice(0, 80) + '…'
        : job.label;

    return (
        <div className={`job-card ${job.status}`}>
            <div className="job-card-header">
                <span className="job-status-icon">{statusIcon[job.status]}</span>
                <span className="job-summary">{job.summary || job.id}</span>
                <span className="job-elapsed">{elapsed}</span>
                {job.exitCode != null && (
                    <span className={`job-exit-code ${job.exitCode === 0 ? 'success' : 'error'}`}>
                        exit {job.exitCode}
                    </span>
                )}
                <span className="job-actions">
                    <button
                        className="job-action-btn"
                        onClick={() => setShowOutput(!showOutput)}
                        title={showOutput ? 'Hide output' : 'View output'}
                    >
                        <i className={`codicon ${showOutput ? 'codicon-chevron-up' : 'codicon-terminal'}`}></i>
                    </button>
                    {job.status === 'running' && (
                        <button
                            className="job-action-btn kill-btn"
                            onClick={handleKill}
                            disabled={killing}
                            title="Kill job"
                        >
                            <i className={`codicon ${killing ? 'codicon-loading codicon-modifier-spin' : 'codicon-stop-circle'}`}></i>
                        </button>
                    )}
                </span>
            </div>
            {truncatedLabel && (
                <div className="job-card-label">{truncatedLabel}</div>
            )}
            {showOutput && <JobOutput jobId={job.id} />}
        </div>
    );
}

export function JobsTab() {
    const dispatch = useEcaDispatch();
    const jobs = useSelector(selectJobs);

    useEffect(() => {
        dispatch(fetchJobsList());
    }, [dispatch]);

    const grouped = useMemo(() => groupJobsByChat(jobs), [jobs]);

    if (jobs.length === 0) {
        return (
            <div className="jobs-tab">
                <p className="tab-description">
                    Background jobs spawned by ECA during your session.
                </p>
                <div className="empty-state">
                    <i className="codicon codicon-run-all"></i>
                    <p>No background jobs</p>
                    <span className="empty-hint">Jobs appear here when ECA runs long-running commands in the background.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="jobs-tab">
            <p className="tab-description">
                Background jobs spawned by ECA during your session.
            </p>
            {grouped.map((group) => (
                <div key={group.chatId} className="job-group">
                    <div className="job-group-header">
                        <i className="codicon codicon-comment-discussion"></i>
                        <span className="job-group-label">{group.chatLabel}</span>
                        <span className="job-group-count">{group.jobs.length}</span>
                    </div>
                    <div className="job-group-list">
                        {group.jobs.map((job) => (
                            <JobCard key={job.id} job={job} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
