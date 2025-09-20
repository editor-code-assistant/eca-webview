import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useWebviewListener, webviewSend } from "../hooks";
import { ChatContentReceivedParams, ChatContext, ChatQueryCommandsResponse, ChatQueryContextResponse, ToolServerUpdatedParams, WorkspaceFolder } from "../protocol";
import { addContentReceived, addContext, setCommands, setContexts, } from "../redux/slices/chat";
import { setMcpServers } from "../redux/slices/mcp";
import { ServerStatus, setConfig, setWorkspaceFolders } from "../redux/slices/server";
import { useEcaDispatch } from "../redux/store";
import { focusChanged } from "../redux/thunks/editor";
import { statusChanged } from "../redux/thunks/server";
import { getLocalStorage, setLocalStorage } from "../localStorage";

interface NavigateTo {
    path: string,
    toggle?: boolean,
}

const RootWrapper = () => {
    const navigate = useNavigate();
    const dispatch = useEcaDispatch();

    useWebviewListener(
        "navigateTo",
        async (data: NavigateTo) => {
            if (data.toggle && location.pathname === data.path) {
                navigate("/");
            } else {
                navigate(data.path);
            }
        },
        [location, navigate],
    );

    useWebviewListener('server/statusChanged', (status: ServerStatus) => {
        dispatch(statusChanged({ status: status }));
    });

    useWebviewListener('server/setWorkspaceFolders', (workspaceFolders: WorkspaceFolder[]) => {
        dispatch(setWorkspaceFolders(workspaceFolders));
    });

    useWebviewListener('chat/contentReceived', (contentReceived: ChatContentReceivedParams) => {
        dispatch(addContentReceived(contentReceived))
        if (contentReceived.content.type === 'toolCalled') {
            webviewSend('editor/refresh', {});
        }
    });

    useWebviewListener('chat/queryContext', (result: ChatQueryContextResponse) => {
        dispatch(setContexts(result));
    });

    useWebviewListener('chat/addContext', (context: ChatContext) => {
        dispatch(addContext(context));
    });

    useWebviewListener('chat/queryCommands', (result: ChatQueryCommandsResponse) => {
        dispatch(setCommands(result));
    });

    useWebviewListener('tool/serversUpdated', (mcps: ToolServerUpdatedParams) => {
        dispatch(setMcpServers(mcps));
    });

    useWebviewListener('config/updated', (config: { [key: string]: any }) => {
        dispatch(setConfig(config));
    });

    useWebviewListener('editor/focusChanged', (focus: any) => {
        dispatch(focusChanged(focus))
    });

    useEffect(() => {
        webviewSend('webview/ready', {});
    }, []);

    // Initialize base UI font size from local storage on mount (em units)
    useEffect(() => {
        const saved = getLocalStorage("fontScale");
        const base = typeof saved === "number" ? saved : 1;
        document.documentElement.style.setProperty("--eca-font-size", `${base}em`);
    }, []);

    // Global shortcut: Alt+Shift+(+/-) to zoom font size by 0.1em, Alt+Shift+0 to reset
    useEffect(() => {
        const getCurrent = () => {
            const v = getComputedStyle(document.documentElement).getPropertyValue("--eca-font-size").trim();
            const n = parseFloat(v || "1");
            return Number.isFinite(n) && n > 0 ? n : 1;
        };

        const setScale = (em: number) => {
            const clamped = Math.max(0.8, Math.min(1.6, em));
            const rounded = Math.round(clamped * 100) / 100; // avoid float drift
            document.documentElement.style.setProperty("--eca-font-size", `${rounded}em`);
            setLocalStorage("fontScale", rounded);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac');
            const isJBCombo = (isMac && e.metaKey && !e.ctrlKey && !e.altKey) || (!isMac && e.ctrlKey && !e.metaKey && !e.altKey);
            const isAltShiftCombo = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey;

            if (isJBCombo || isAltShiftCombo) {
                const isIncreaseKey = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd';
                const isDecreaseKey = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract';
                const isResetKey = e.key === '0' || e.code === 'Numpad0';

                if (isIncreaseKey) {
                    e.preventDefault();
                    setScale(getCurrent() + 0.1);
                } else if (isDecreaseKey) {
                    e.preventDefault();
                    setScale(getCurrent() - 0.1);
                } else if (isResetKey) {
                    e.preventDefault();
                    setScale(1);
                }
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <Outlet />
    );
}

export default RootWrapper;
