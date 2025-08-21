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
            return;
        }
    }
    console.error("No webview provider found to send message");
}
