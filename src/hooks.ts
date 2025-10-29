import { useEffect } from "react";
import { editorName } from "./util";

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
    const msg = { type, data }

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
