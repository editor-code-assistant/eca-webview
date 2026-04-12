import { useEffect, useRef, useState } from 'react';
import { JobOutputLine } from '../../protocol';
import { fetchJobOutput } from '../../redux/thunks/jobs';
import { useEcaDispatch } from '../../redux/store';
import './JobOutput.scss';

interface Props {
    jobId: string;
}

export function JobOutput({ jobId }: Props) {
    const dispatch = useEcaDispatch();
    const [lines, setLines] = useState<JobOutputLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const outputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        dispatch(fetchJobOutput({ jobId }))
            .unwrap()
            .then((result) => {
                setLines(result.lines ?? []);
                setLoading(false);
            })
            .catch((err) => {
                setError(err?.message || 'Failed to fetch output');
                setLoading(false);
            });
    }, [jobId, dispatch]);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [lines]);

    if (loading) {
        return (
            <div className="job-output">
                <div className="job-output-loading">
                    <i className="codicon codicon-loading codicon-modifier-spin"></i>
                    <span>Loading output...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="job-output">
                <div className="job-output-error">
                    <i className="codicon codicon-error"></i>
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (lines.length === 0) {
        return (
            <div className="job-output">
                <div className="job-output-empty">No output</div>
            </div>
        );
    }

    return (
        <div className="job-output" ref={outputRef}>
            <pre className="job-output-content">
                {lines.map((line, i) => (
                    <span key={i} className={`output-line ${line.stream === 'stderr' ? 'stderr' : 'stdout'}`}>
                        {line.text}{'\n'}
                    </span>
                ))}
            </pre>
        </div>
    );
}
