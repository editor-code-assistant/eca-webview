import { memo } from 'react';
import { formatNumber } from '../../util';
import './ChatTurnUsage.scss';

interface Props {
    model?: string,
    totalTimeMs?: number,
    outputTokens?: number,
    outputTps?: number,
    inputTokens?: number,
    cost?: string,
}

/**
 * How long a turn took: `9.8s` under a minute, else `1m 12s`, `1m`,
 * `1h 5m`, like eca-emacs tells it.
 */
export function formatTurnTime(ms: number): string {
    if (ms < 59_950) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    const secs = Math.round(ms / 1000);
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const rest = secs % 60;
    if (hours === 0) {
        return rest > 0 ? `${mins}m ${rest}s` : `${mins}m`;
    }
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function tokens(n: number, kind: string): string {
    return `${formatNumber(n)} ${kind} token${n === 1 ? '' : 's'}`;
}

/** The segments of the line telling what a turn used, those it has. */
export function turnUsageSegments({ model, totalTimeMs, outputTokens, outputTps, cost }: Props): string[] {
    return [
        model ? model.split('/').pop() : undefined,
        totalTimeMs != null ? formatTurnTime(totalTimeMs) : undefined,
        outputTokens != null ? tokens(outputTokens, 'output') : undefined,
        outputTps != null ? `${outputTps} tok/s` : undefined,
        cost ? `$${cost}` : undefined,
    ].filter((segment): segment is string => !!segment);
}

/** What hovering the line tells: all of it, the full model included. */
export function turnUsageHelp({ model, totalTimeMs, outputTokens, outputTps, inputTokens, cost }: Props): string {
    return [
        model ? `Model: ${model}` : undefined,
        totalTimeMs != null
            ? `Time: ${formatTurnTime(totalTimeMs)}, from the prompt to the end of the turn`
            : undefined,
        outputTokens != null
            ? `Output tokens: ${outputTokens.toLocaleString('en-US')}, thinking, tool calls and subagents included`
            : undefined,
        outputTps != null
            ? `Output speed: ${outputTps} tokens/s, on average while the model generated, subagents excluded`
            : undefined,
        inputTokens != null
            ? `Input tokens: ${inputTokens.toLocaleString('en-US')}, cache and subagents included`
            : undefined,
        cost ? `Cost: $${cost}` : undefined,
    ].filter((line): line is string => !!line).join('\n');
}

/**
 * The quiet line under the answer of a turn telling what the turn used,
 * like `claude-sonnet-4-5 · 9.8s · 412 output tokens · 87 tok/s · $0.03`:
 * the model, from the prompt to the end of the turn, the tokens the model
 * generated (thinking, tool calls and subagents included), how fast it
 * generated them over the turn, and the cost, absent with subscription
 * logins. The server tells it when the turn ends, and again when the chat
 * is opened again; servers up to 0.175.0 don't tell the speed.
 */
export const ChatTurnUsage = memo(function ChatTurnUsage(props: Props) {
    const segments = turnUsageSegments(props);
    if (segments.length === 0) {
        return null;
    }
    return (
        <div className="turn-usage" title={turnUsageHelp(props)}>
            {segments.join(' · ')}
        </div>
    );
});
