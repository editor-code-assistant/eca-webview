import type { ErrorInfo } from 'react';

const componentStacks = new WeakMap<Error, string>();

export function captureComponentStack(error: Error, info: ErrorInfo): void {
    if (info.componentStack) componentStacks.set(error, info.componentStack);
}

export function normalizeError(value: unknown): Error {
    if (value instanceof Error) return value;
    if (typeof value === 'string') return new Error(value);
    return new Error('Unknown error');
}

export function getComponentStack(error: Error): string | undefined {
    return componentStacks.get(error);
}

export function buildErrorReport(error: Error | undefined): string {
    if (!error) return 'Unknown error';
    const parts: string[] = [`Error: ${error.message}`];
    if (error.stack) parts.push(`\nStack Trace:\n${error.stack}`);
    const componentStack = componentStacks.get(error);
    if (componentStack) parts.push(`\nComponent Stack:${componentStack}`);
    return parts.join('\n');
}
