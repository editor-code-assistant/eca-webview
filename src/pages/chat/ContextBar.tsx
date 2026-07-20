import type { ContextBreakdown } from '../../protocol';
import './ContextBar.css';

// Local humanizer (mirrors the one in ChatSubHeader) so the legend can
// label each category compactly, e.g. 12.3k.
function formatNumber(n: number): string {
    if (n >= 1_000_000) {
        const val = n / 1_000_000;
        return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
    }
    if (n >= 1_000) {
        const val = n / 1_000;
        return val % 1 === 0 ? `${val}k` : `${parseFloat(val.toFixed(1))}k`;
    }
    return n.toString();
}

// Fallback only used when an older server omits the colour from the
// payload; the server is the source of truth for colours/emoji.
const DEFAULT_FREE_COLOR = '#5c6370';

// Full-window model: the bar represents the whole context window, so the
// denominator is the context limit when known, else used + free.
function totalTokens(breakdown: ContextBreakdown): number {
    if (breakdown.contextLimit && breakdown.contextLimit > 0) {
        return breakdown.contextLimit;
    }
    return breakdown.usedTokens + (breakdown.freeTokens ?? 0);
}

interface Props {
    breakdown: ContextBreakdown;
}

/**
 * Thin segmented bar showing how full the model context window is.
 * Each category is a proportional slice coloured by the server-provided
 * hex; the remaining track is the dim "free" segment. Widths animate as
 * the context grows turn by turn.
 */
export function ContextBar({ breakdown }: Props) {
    const total = totalTokens(breakdown);
    if (total <= 0) {
        return null;
    }

    const usedPct = Math.min(100, (breakdown.usedTokens / total) * 100);
    const freeColor = breakdown.freeColor ?? DEFAULT_FREE_COLOR;

    return (
        <div
            className="context-bar"
            role="img"
            aria-label={`Context usage: ${usedPct.toFixed(1)}% of ${formatNumber(total)} tokens used`}
        >
            {breakdown.categories.map((category) => {
                const pct = (category.tokens / total) * 100;
                if (pct <= 0) {
                    return null;
                }
                return (
                    <div
                        key={category.name}
                        className="context-bar-segment"
                        style={{ width: `${pct}%`, backgroundColor: category.color }}
                    />
                );
            })}
            <div
                className="context-bar-segment context-bar-free"
                style={{ backgroundColor: freeColor }}
            />
        </div>
    );
}

/**
 * Legend for the context bar, meant to live inside the usage tooltip.
 * Renders a real colour swatch per category (nicer than emoji in a
 * webview) plus its token count and share of the window.
 */
export function ContextLegend({ breakdown }: Props) {
    const total = totalTokens(breakdown);
    if (total <= 0) {
        return null;
    }

    const freeColor = breakdown.freeColor ?? DEFAULT_FREE_COLOR;
    const freeTokens = breakdown.freeTokens ?? Math.max(0, total - breakdown.usedTokens);
    const pctOf = (tokens: number) => (tokens / total) * 100;

    return (
        <div className="context-legend">
            <div className="context-legend-title">Context breakdown</div>
            {breakdown.categories.map((category) => (
                <div className="context-legend-row" key={category.name}>
                    <span
                        className="context-legend-swatch"
                        style={{ backgroundColor: category.color }}
                    />
                    <span className="context-legend-name">{category.name}</span>
                    <span className="context-legend-tokens">
                        {formatNumber(category.tokens)} ({pctOf(category.tokens).toFixed(1)}%)
                    </span>
                </div>
            ))}
            <div className="context-legend-row context-legend-free-row">
                <span
                    className="context-legend-swatch"
                    style={{ backgroundColor: freeColor }}
                />
                <span className="context-legend-name">Free space</span>
                <span className="context-legend-tokens">
                    {formatNumber(freeTokens)} ({pctOf(freeTokens).toFixed(1)}%)
                </span>
            </div>
        </div>
    );
}
