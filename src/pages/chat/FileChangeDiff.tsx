import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import type { FileChangeDetails } from '../../protocol';

interface FileChangeDiffProps {
    details: FileChangeDetails;
    toolName: string;
}

export default function FileChangeDiff({ details, toolName }: FileChangeDiffProps) {
    const { path, diff } = details;
    const patch = diff.startsWith('---')
        ? diff
        : `--- a/${path}\n+++ b/${path}\n${diff}`;
    const fileDiffs = parseDiff(patch);

    return (
        <div>
            <span>Tool: </span>
            <span>{toolName}</span>
            {fileDiffs.map(({ oldRevision, newRevision, type, hunks }) => (
                <Diff
                    key={`${oldRevision}-${newRevision}`}
                    viewType="unified"
                    gutterType="none"
                    diffType={type}
                    hunks={hunks}
                >
                    {renderHunks => renderHunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
                </Diff>
            ))}
        </div>
    );
}
