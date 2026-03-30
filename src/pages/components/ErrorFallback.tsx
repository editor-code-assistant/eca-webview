import { ErrorInfo, useState } from 'react';
import { FallbackProps } from 'react-error-boundary';
import { useNavigate, useRouteError } from 'react-router-dom';
import './ErrorFallback.scss';

// ---------------------------------------------------------------------------
// Component-stack capture
// ---------------------------------------------------------------------------
// React's componentDidCatch provides a component stack, but react-error-boundary
// only exposes it through the `onError` callback — not in FallbackProps.
// We store it in a WeakMap keyed by the Error object so fallbacks can retrieve it.

const componentStacks = new WeakMap<Error, string>();

/**
 * Pass this as the `onError` prop on every `<ErrorBoundary>`.
 * It captures the React component stack for later use by fallback UIs.
 */
export function captureComponentStack(error: Error, info: ErrorInfo) {
    if (info.componentStack) {
        componentStacks.set(error, info.componentStack);
    }
}

// ---------------------------------------------------------------------------
// Clipboard helper
// ---------------------------------------------------------------------------

function buildErrorReport(error: Error | undefined): string {
    if (!error) return 'Unknown error';

    const parts: string[] = [`Error: ${error.message}`];

    if (error.stack) {
        parts.push(`\nStack Trace:\n${error.stack}`);
    }

    const componentStack = componentStacks.get(error);
    if (componentStack) {
        parts.push(`\nComponent Stack:${componentStack}`);
    }

    return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Shared: collapsible error details + copy button
// ---------------------------------------------------------------------------

function useErrorDetails(error: Error | undefined) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(buildErrorReport(error));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setExpanded(true);
        }
    };

    const toggleExpanded = () => setExpanded(v => !v);

    const stack = error?.stack ?? '';
    const componentStack = error ? componentStacks.get(error) : undefined;
    const stackContent = stack + (componentStack ? `\n\nComponent Stack:${componentStack}` : '');

    return { expanded, copied, handleCopy, toggleExpanded, stackContent };
}

/** Block variant — used in app-level and route-level fallbacks. */
function ErrorDetailsBlock({ error }: { error: Error | undefined }) {
    const { expanded, copied, handleCopy, toggleExpanded, stackContent } = useErrorDetails(error);

    return (
        <div className="error-details error-details--block">
            <div className="error-details__actions">
                <button
                    className="error-fallback__action error-fallback__action--secondary"
                    onClick={handleCopy}
                    title="Copy full error report to clipboard"
                >
                    <i className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`} />
                    {copied ? ' Copied!' : ' Copy Error'}
                </button>
                <button
                    className="error-fallback__action error-fallback__action--secondary"
                    onClick={toggleExpanded}
                    title={expanded ? 'Hide details' : 'Show details'}
                >
                    <i className={`codicon ${expanded ? 'codicon-chevron-up' : 'codicon-chevron-down'}`} />
                    {expanded ? ' Hide Details' : ' Show Details'}
                </button>
            </div>

            {expanded && (
                <pre className="error-details__stack">{stackContent}</pre>
            )}
        </div>
    );
}

/**
 * Inline variant — returns a fragment with two parts:
 *  1. Action buttons (stay in the parent flex row)
 *  2. Stack trace <pre> (full-width, flows below the row via flex-wrap)
 */
function ErrorDetailsInline({ error }: { error: Error | undefined }) {
    const { expanded, copied, handleCopy, toggleExpanded, stackContent } = useErrorDetails(error);

    return (
        <>
            <span className="error-details__inline-actions">
                <button
                    className="error-fallback__inline-action"
                    onClick={handleCopy}
                    title="Copy full error report to clipboard"
                >
                    <i className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`} />
                </button>
                <button
                    className="error-fallback__inline-action"
                    onClick={toggleExpanded}
                    title={expanded ? 'Hide details' : 'Show details'}
                >
                    <i className={`codicon ${expanded ? 'codicon-chevron-up' : 'codicon-chevron-down'}`} />
                </button>
            </span>
            {expanded && (
                <pre className="error-details__stack error-details__stack--full-width">{stackContent}</pre>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// App-level fallback
// ---------------------------------------------------------------------------

/**
 * App-level fallback — last-resort catch-all wrapping the entire router.
 * Shows a full-panel crash screen with a "Reload" button.
 */
export function AppErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="error-fallback error-fallback--app">
            <div className="error-fallback__icon">
                <i className="codicon codicon-bug" />
            </div>
            <h2 className="error-fallback__title">Something went wrong</h2>
            <p className="error-fallback__description">
                The webview encountered an unexpected error.
            </p>
            <pre className="error-fallback__details">{error?.message}</pre>
            <div className="error-fallback__button-row">
                <button className="error-fallback__action" onClick={resetErrorBoundary}>
                    <i className="codicon codicon-refresh" /> Reload
                </button>
            </div>
            <ErrorDetailsBlock error={error} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Route-level fallback
// ---------------------------------------------------------------------------

/**
 * Route-level fallback — used as `errorElement` in the router config.
 * Shows an error summary with a "Back to Chat" navigation link.
 */
export function RouteErrorFallback() {
    const error = useRouteError() as Error | undefined;
    const navigate = useNavigate();

    return (
        <div className="error-fallback error-fallback--route">
            <div className="error-fallback__icon">
                <i className="codicon codicon-warning" />
            </div>
            <h3 className="error-fallback__title">This page crashed</h3>
            <pre className="error-fallback__details">{error?.message ?? 'Unknown error'}</pre>
            <div className="error-fallback__button-row">
                <button className="error-fallback__action" onClick={() => navigate('/')}>
                    <i className="codicon codicon-arrow-left" /> Back to Chat
                </button>
            </div>
            <ErrorDetailsBlock error={error} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Per-message fallback
// ---------------------------------------------------------------------------

/**
 * Per-message fallback — wraps each chat message in `ChatMessages`.
 * Shows a subtle inline card when a single message fails to render.
 */
export function MessageErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="error-fallback error-fallback--message">
            <span className="error-fallback__inline-icon">
                <i className="codicon codicon-error" />
            </span>
            <span className="error-fallback__inline-text">
                This message couldn't be rendered
            </span>
            <button
                className="error-fallback__inline-action"
                onClick={resetErrorBoundary}
                title="Retry rendering this message"
            >
                <i className="codicon codicon-refresh" />
            </button>
            <ErrorDetailsInline error={error} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Markdown fallback
// ---------------------------------------------------------------------------

/**
 * Markdown fallback — wraps `<MarkdownContent />` rendering.
 * Falls back to showing the raw text content instead of a blank area.
 */
export function MarkdownErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="error-fallback error-fallback--markdown">
            <div className="error-fallback--markdown__header">
                <span className="error-fallback__inline-icon">
                    <i className="codicon codicon-warning" />
                </span>
                <span className="error-fallback__inline-text">
                    Content couldn't be rendered
                </span>
                <button
                    className="error-fallback__inline-action"
                    onClick={resetErrorBoundary}
                    title="Retry rendering"
                >
                    <i className="codicon codicon-refresh" />
                </button>
                <ErrorDetailsInline error={error} />
            </div>
        </div>
    );
}
