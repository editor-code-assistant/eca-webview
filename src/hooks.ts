import { RefObject, useCallback, useRef, useEffect } from "react";
import { editorName } from "./util";

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

export function useWebviewListener<T>(
    type: string,
    handle: (message: T) => any,
    dependencies: any[] = [],
) {
    useEffect(
        () => {
            const handler = (event: MessageEvent) => {
                const message = event.data;
                if (message.type === type) {
                    handle(message.data);
                }
            };
            window.addEventListener('message', handler);
            return () => window.removeEventListener('message', handler);
        },
        dependencies,
    );
}

export function useKeyPressedListener(
    handle: (event: KeyboardEvent) => any,
    dependencies: any[] = [],
) {
    useEffect(
        () => {
            const onKeyDown = (e: KeyboardEvent) => {
                return handle(e);
            };
            document.addEventListener("keydown", onKeyDown);
            return () => document.removeEventListener("keydown", onKeyDown);
        },
        dependencies,
    );
}

interface vscode {
    postMessage(message: any): vscode;
}

declare const vscode: any;

export function webviewSend<T>(
    type: string, data: T,
) {
    const msg = { type, data };

    switch (editorName()) {
        case 'vscode': {
            vscode.postMessage(msg);
            return;
        }
        case 'intellij': {
            if (window.postMessageToEditor) {
                window.postMessageToEditor(msg);
            }
            return;
        }
        case 'web': {
            if (window.__ecaWebTransport) {
                window.__ecaWebTransport.send(msg);
            }
            return;
        }
    }
    console.error("No webview provider found to send message");
}

const pendingSyncRequests = new Map<string, {
    resolve: (value: any | null) => void;
    reject: (error: Error) => void;
}>();

export function respondRequest(requestId: string, value: any | null) {
    const pending = pendingSyncRequests.get(requestId);
    if (pending) {
        pending.resolve(value);
        pendingSyncRequests.delete(requestId);
    }
}

export function webviewSendAndGet<T>(
    type: string, data: T,
): Promise<any> {
    const requestId = Date.now().toString();
    const promise = new Promise<any | null>((resolve, reject) => {
        pendingSyncRequests.set(requestId, { resolve, reject });

        // Set a timeout to prevent hanging forever (30 seconds)
        setTimeout(() => {
            const pending = pendingSyncRequests.get(requestId);
            if (pending) {
                pending.reject(new Error('Wait webview response timeout'));
                pendingSyncRequests.delete(requestId);
            }
        }, 30000);
    });

    webviewSend(type, { ...data, requestId });

    return promise;
}
