import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { editorName } from "./util";
import type {
    WebviewInboundMap,
    WebviewInboundType,
    WebviewMessage,
    WebviewNotificationMap,
    WebviewOutboundMap,
    WebviewOutboundType,
    WebviewRequestPayload,
    WebviewRequestResponse,
    WebviewRequestType,
} from './webviewProtocol';

/**
 * Allows collapsing an expanded block by clicking on its background area.
 *
 * Clicking anywhere on the card collapses it, EXCEPT:
 * - text-selection drags (mouse moved >5 px or text was selected)
 * - long presses (>400 ms)
 * - clicks on interactive elements (links, buttons, inputs, pre/code)
 * - clicks inside a *nested* collapsible card (identified by `[data-collapsible]`)
 * - clicks on the card header (identified by `[data-collapsible-header]`)
 *
 * Usage:
 *   const cardRef = useRef<HTMLDivElement>(null);
 *   const { onMouseDown, onMouseUp } = useBackgroundCollapse(expanded, collapse, cardRef);
 *   <div ref={cardRef} data-collapsible onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
 *     <div data-collapsible-header>…</div>
 *     <div>…body…</div>
 *   </div>
 */
export function useBackgroundCollapse(
    expanded: boolean,
    onCollapse: () => void,
    cardRef: RefObject<HTMLDivElement | null>,
) {
    const downRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const onMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (!expanded) {
                return;
            }
            downRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        },
        [expanded],
    );

    const onMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (!expanded || !downRef.current) {
                return;
            }
            const { x, y, time } = downRef.current;
            downRef.current = null;

            // Must be a short, stationary click — not a drag / text-selection
            if (Math.abs(e.clientX - x) > 5 || Math.abs(e.clientY - y) > 5) {
                return;
            }
            if (Date.now() - time > 400) {
                return;
            }

            // Bail if text was selected (e.g. double-click-to-select-word)
            const sel = window.getSelection();
            if (sel && sel.toString().length > 0) {
                return;
            }

            const target = e.target as HTMLElement;

            // Don't collapse when clicking interactive elements
            if (target.closest('a, button, input, textarea, select, [role="button"]')) {
                return;
            }

            // Don't collapse when clicking inside a code/pre block (users copy from these)
            if (target.closest('pre, code')) {
                return;
            }

            // Don't collapse when clicking the header (it already toggles via its own handler)
            if (target.closest('[data-collapsible-header]')) {
                return;
            }

            // Don't collapse when the click lands inside a *nested* collapsible card
            const closestCard = target.closest('[data-collapsible]');
            if (closestCard && closestCard !== cardRef.current) {
                return;
            }

            onCollapse();
        },
        [expanded, onCollapse, cardRef],
    );

    return { onMouseDown, onMouseUp };
}

/**
 * Stabilize a string that can change rapidly — e.g. the live
 * `selectInitProgressString` output driven by a stream of `$/progress`
 * notifications during ECA server startup.
 *
 * Two guarantees:
 *
 *  1. **Min-show** — every non-null value stays on screen for at least
 *     `minShowMs` before being replaced. Back-to-back titles like
 *     `"Loading models"` → `"Warming cache"` arriving 20 ms apart
 *     collapse to a single displayed title (the most recent one when
 *     the window elapses) instead of flickering through both.
 *
 *  2. **Trailing-hold** — when the input drops to `null` (all tasks
 *     finished), the last shown value is held for `trailingMs` more
 *     before the display itself goes null. This prevents the progress
 *     line from appearing and disappearing within a single frame on
 *     very fast startups.
 *
 * The hook is string-scoped on purpose — init-progress is the only
 * consumer right now and broadening the type would force callers to
 * handle referential-equality edge cases that don't apply here.
 */
export function useStickyString(
    value: string | null,
    opts: { minShowMs?: number; trailingMs?: number } = {},
): string | null {
    const { minShowMs = 350, trailingMs = 500 } = opts;

    // `display` is what the caller should render. `displayRef` mirrors
    // it so our effect can make decisions based on the freshest value
    // without adding `display` to the dep array (which would re-run
    // the effect whenever we update display ourselves — a loop hazard).
    const [display, setDisplay] = useState<string | null>(value);
    const displayRef = useRef<string | null>(value);
    const lastChangeAtRef = useRef<number>(Date.now());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Any new input supersedes a pending transition — cancel it
        // before scheduling a new one.
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        const current = displayRef.current;
        if (value === current) return;

        const commit = (next: string | null) => {
            displayRef.current = next;
            setDisplay(next);
            lastChangeAtRef.current = Date.now();
            timerRef.current = null;
        };

        if (value === null) {
            // About to hide — hold the last shown value for trailingMs
            // so it doesn't flash away the instant the server settles.
            // If nothing was displayed yet, there's nothing to hold
            // and we can just commit the null immediately.
            if (current === null) {
                commit(null);
                return;
            }
            timerRef.current = setTimeout(() => commit(null), trailingMs);
            return;
        }

        // Non-null incoming. If the slot is empty or the current value
        // has had its fair share of screen time, swap right away;
        // otherwise defer the swap so `current` satisfies minShowMs.
        const elapsed = Date.now() - lastChangeAtRef.current;
        if (current === null || elapsed >= minShowMs) {
            commit(value);
        } else {
            timerRef.current = setTimeout(() => commit(value), minShowMs - elapsed);
        }
    }, [value, minShowMs, trailingMs]);

    // Cancel any pending timer on unmount so we don't fire setDisplay
    // on a torn-down component.
    useEffect(() => () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    return display;
}

export function useWebviewListener<K extends WebviewInboundType>(
    type: K,
    handle: (message: WebviewInboundMap[K]) => void,
) {
    const handleRef = useRef(handle);

    useLayoutEffect(() => {
        handleRef.current = handle;
    }, [handle]);

    useEffect(() => {
        const handler = (event: MessageEvent<unknown>) => {
            const message = event.data;
            if (
                typeof message === 'object'
                && message !== null
                && 'type' in message
                && 'data' in message
                && message.type === type
            ) {
                handleRef.current(message.data as WebviewInboundMap[K]);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [type]);
}

export function useKeyPressedListener(
    handle: (event: KeyboardEvent) => void,
) {
    const handleRef = useRef(handle);

    useLayoutEffect(() => {
        handleRef.current = handle;
    }, [handle]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            handleRef.current(event);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);
}

interface VsCodeApi {
    postMessage(message: WebviewMessage): unknown;
}

declare const vscode: VsCodeApi | undefined;

function postWebviewMessage<K extends WebviewOutboundType>(
    type: K,
    data: WebviewOutboundMap[K],
): void {
    const msg: WebviewMessage<K> = { type, data };

    switch (editorName()) {
        case 'vscode': {
            if (typeof vscode === 'undefined') {
                throw new Error('VS Code webview API is unavailable');
            }
            vscode.postMessage(msg);
            return;
        }
        case 'intellij': {
            if (window.postMessageToEditor) {
                window.postMessageToEditor(msg);
            }
            return;
        }
        case 'web':
        case 'desktop': {
            if (window.__ecaWebTransport) {
                window.__ecaWebTransport.send(msg);
            }
            return;
        }
    }
    console.error("No webview provider found to send message");
}

export function webviewSend<K extends keyof WebviewNotificationMap>(
    type: K,
    data: WebviewNotificationMap[K],
): void {
    postWebviewMessage(type, data as WebviewOutboundMap[K]);
}

interface PendingRequest {
    type: WebviewRequestType;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

const pendingSyncRequests = new Map<string, PendingRequest>();

export function respondRequest<K extends WebviewRequestType>(
    type: K,
    requestId: string,
    value: WebviewRequestResponse<K>,
): void {
    const pending = pendingSyncRequests.get(requestId);
    if (!pending) {
        return;
    }

    pendingSyncRequests.delete(requestId);
    clearTimeout(pending.timeout);

    if (pending.type !== type) {
        pending.reject(new Error(`Mismatched webview response: expected ${pending.type}, received ${type}`));
        return;
    }

    pending.resolve(value);
}

export function webviewSendAndGet<K extends WebviewRequestType>(
    type: K,
    data: WebviewRequestPayload<K>,
): Promise<WebviewRequestResponse<K>> {
    const requestId = crypto.randomUUID();
    const promise = new Promise<WebviewRequestResponse<K>>((resolve, reject) => {
        const timeout = setTimeout(() => {
            const pending = pendingSyncRequests.get(requestId);
            if (pending) {
                pending.reject(new Error('Wait webview response timeout'));
                pendingSyncRequests.delete(requestId);
            }
        }, 30000);

        pendingSyncRequests.set(requestId, {
            type,
            resolve: (value) => resolve(value as WebviewRequestResponse<K>),
            reject,
            timeout,
        });
    });

    postWebviewMessage(type, { ...data, requestId } as WebviewOutboundMap[K]);

    return promise;
}
