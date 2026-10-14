import { ProviderQuota, ProviderQuotaWindow } from '../../protocol';
import './QuotaWindows.scss';

export type QuotaLevel = 'warning' | 'critical' | null;

function nowSecs(): number {
    return Date.now() / 1000;
}

export function formatDuration(secs: number): string {
    if (secs < 60) {
        return '<1m';
    }
    if (secs < 3600) {
        return `${Math.floor(secs / 60)}m`;
    }
    if (secs < 86400) {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export function isStaleWindow(window: ProviderQuotaWindow, now: number): boolean {
    return window.resetsAt != null && window.resetsAt <= now;
}

function levelForPercent(percent: number): QuotaLevel {
    if (percent >= 95) return 'critical';
    if (percent >= 80) return 'warning';
    return null;
}

export function quotaLevel(quota: ProviderQuota | undefined): QuotaLevel {
    if (!quota) return null;
    const now = nowSecs();
    const active = quota.windows.filter((w) => !isStaleWindow(w, now));
    if (active.length === 0) return null;
    return levelForPercent(Math.max(...active.map((w) => w.usedPercent)));
}

export function formatQuotaShort(quota: ProviderQuota): string {
    const now = nowSecs();
    return quota.windows
        .map((w) => isStaleWindow(w, now) ? `${w.label} —` : `${w.label} ${Math.round(w.usedPercent)}%`)
        .join(' · ');
}

function formatClock(resetsAt: number, diff: number): string {
    const date = new Date(resetsAt * 1000);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 86400) {
        return time;
    }
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

export function formatResetText(window: ProviderQuotaWindow, now: number): string | null {
    if (window.resetsAt == null) return null;
    if (isStaleWindow(window, now)) return 'reset, refreshes on next request';
    const diff = window.resetsAt - now;
    return `resets in ${formatDuration(diff)} (${formatClock(window.resetsAt, diff)})`;
}

export function formatUpdatedText(updatedAt: number, now: number): string {
    const ago = Math.max(0, now - updatedAt);
    if (ago < 60) return 'updated just now';
    if (ago < 3600) return `updated ${Math.floor(ago / 60)}m ago`;
    if (ago < 86400) return `updated ${Math.floor(ago / 3600)}h ago`;
    return `updated ${Math.floor(ago / 86400)}d ago`;
}

interface Props {
    quota: ProviderQuota;
    title?: string;
}

/**
 * Per-window subscription quota breakdown (usage bar + reset time), used
 * in the chat usage tooltip and in the providers settings card.
 */
export function QuotaWindows({ quota, title }: Props) {
    if (quota.windows.length === 0) {
        return null;
    }

    const now = nowSecs();

    return (
        <div className="quota-windows">
            {title && <div className="quota-windows-title">{title}</div>}
            {quota.windows.map((window) => {
                const stale = isStaleWindow(window, now);
                const level = stale ? null : levelForPercent(window.usedPercent);
                const width = Math.min(100, Math.max(0, window.usedPercent));
                const resetText = formatResetText(window, now);
                return (
                    <div className="quota-window-row" key={window.id}>
                        <span className="quota-window-label">{window.label}</span>
                        <div
                            className="quota-window-bar"
                            role="img"
                            aria-label={`${window.label}: ${Math.round(window.usedPercent)}% used`}
                        >
                            <div
                                className={`quota-window-fill${level ? ` ${level}` : ''}`}
                                style={{ width: `${width}%` }}
                            />
                        </div>
                        <span className="quota-window-used">{Math.round(window.usedPercent)}% used</span>
                        {resetText && <span className="quota-window-reset">{resetText}</span>}
                    </div>
                );
            })}
            <div className="quota-windows-updated">{formatUpdatedText(quota.updatedAt, now)}</div>
        </div>
    );
}
