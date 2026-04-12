import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { respondRequest as respondWebviewRequest, useKeyPressedListener, useWebviewListener, webviewSend } from "../hooks";
import { getLocalStorage, setLocalStorage } from "../localStorage";
import { ChatClearedParams, ChatContentReceivedParams, ChatContext, ChatQueryCommandsResponse, ChatQueryContextResponse, ChatQueryFilesResponse, JobsUpdatedParams, ProviderStatus, ToolServerUpdatedParams, WorkspaceFolder } from "../protocol";
import { addContentReceived, batchContentReceived, addContext, chatOpened, cleared, newChat, resetChat, resetChats, selectChat, setCommands, setContexts, setFiles, } from "../redux/slices/chat";
import { setJobs } from "../redux/slices/jobs";
import { setMcpServers } from "../redux/slices/mcp";
import { updateProvider } from "../redux/slices/providers";
import { ServerStatus, setConfig, setTrust, setWorkspaceFolders } from "../redux/slices/server";
import { useEcaDispatch } from "../redux/store";
import { sendPromptToCurrentChat } from "../redux/thunks/chat";
import { focusChanged } from "../redux/thunks/editor";
import { statusChanged } from "../redux/thunks/server";

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

    useWebviewListener('server/setTrust', (trust: boolean) => {
        dispatch(setTrust(trust));
    });

    useWebviewListener('chat/contentReceived', (contentReceived: ChatContentReceivedParams) => {
        dispatch(addContentReceived(contentReceived))

        let isMcpTool = false;
        let anyWriteTool = false;

        if (contentReceived.content.type === 'toolCalled') {
            isMcpTool = contentReceived.content.origin === 'mcp';
            anyWriteTool = contentReceived.content.name === "eca_edit_file"
                || contentReceived.content.name === "eca_write_file"
                || contentReceived.content.name === "eca_shell_command";
        }

        if (isMcpTool || anyWriteTool) {
            webviewSend('editor/refresh', {});
        }
    });

    useWebviewListener('chat/batchContentReceived', (events: ChatContentReceivedParams[]) => {
        dispatch(batchContentReceived(events));
    });

    useWebviewListener('chat/queryContext', (result: ChatQueryContextResponse) => {
        dispatch(setContexts(result));
    });

    useWebviewListener('chat/addContextToSystemPrompt', (context: ChatContext) => {
        dispatch(addContext({ context: context, prompt: 'system' }));
    });

    useWebviewListener('chat/queryCommands', (result: ChatQueryCommandsResponse) => {
        dispatch(setCommands(result));
    });

    useWebviewListener('chat/queryFiles', (result: ChatQueryFilesResponse) => {
        dispatch(setFiles(result));
    });

    useWebviewListener('chat/cleared', (result: ChatClearedParams) => {
        dispatch(cleared(result));
    });

    useWebviewListener('chat/deleted', (chatId: string) => {
        dispatch(resetChat(chatId));
    });

    useWebviewListener('chat/opened', (data: { chatId: string; title?: string }) => {
        dispatch(chatOpened(data));
    });

    useWebviewListener('chat/statusChanged', (data: { chatId: string; status: string }) => {
        if (data.status === 'idle') {
            dispatch(addContentReceived({
                chatId: data.chatId,
                role: 'system',
                content: { type: 'progress', state: 'finished' },
            }));
        } else if (data.status === 'running') {
            dispatch(addContentReceived({
                chatId: data.chatId,
                role: 'system',
                content: { type: 'progress', state: 'running', text: 'Running...' },
            }));
        }
    });

    useWebviewListener('tool/serversUpdated', (mcps: ToolServerUpdatedParams) => {
        dispatch(setMcpServers(mcps));
    });

    useWebviewListener('config/updated', (config: { [key: string]: any }) => {
        dispatch(setConfig(config));
    });

    useWebviewListener('providers/updated', (provider: ProviderStatus) => {
        dispatch(updateProvider(provider));
    });

    useWebviewListener('jobs/updated', (data: JobsUpdatedParams) => {
        dispatch(setJobs(data.jobs));
    });

    useWebviewListener('jobs/list', (data: any) => {
        respondWebviewRequest(data.requestId, data);
    });

    useWebviewListener('jobs/readOutput', (data: any) => {
        respondWebviewRequest(data.requestId, data);
    });

    useWebviewListener('jobs/kill', (data: any) => {
        respondWebviewRequest(data.requestId, data);
    });

    useWebviewListener('editor/focusChanged', (focus: any) => {
        dispatch(focusChanged(focus))
    });

    useWebviewListener('editor/readInput', (data: { requestId: string, value: string | null }) => {
        respondWebviewRequest(data.requestId, data.value);
    });

    useWebviewListener('providers/list', (data: any) => {
        respondWebviewRequest(data.requestId, data);
    });

    useWebviewListener('providers/login', (data: any) => {
        respondWebviewRequest(data.requestId, data);
    });

    useWebviewListener('providers/loginInput', (data: any) => {
        respondWebviewRequest(data.requestId, data);
    });

    useWebviewListener('providers/logout', (data: any) => {
        respondWebviewRequest(data.requestId, data);
    });

    useWebviewListener('editor/saveClipboardImage', (data: { requestId: string, path: string }) => {
        respondWebviewRequest(data.requestId, { path: data.path });
    });

    useWebviewListener('chat/createNewChat', () => {
        dispatch(newChat());
    });

    useWebviewListener('chat/selectChat', (chatId: string) => {
        dispatch(selectChat(chatId));
    });

    useWebviewListener('chat/sendPromptToCurrentChat', (data: { prompt: string }) => {
        dispatch(sendPromptToCurrentChat({ prompt: data.prompt }));
    });

    useEffect(() => {
        // Reset stale chat state before requesting fresh state from the bridge.
        // The Redux store is a module-level singleton that persists across
        // WebviewApp unmount/remount cycles (e.g. disconnect → reconnect).
        // Without this reset, restoreChats() would replay messages on top of
        // stale state, causing duplicates.
        dispatch(resetChats());
        webviewSend('webview/ready', {});
    }, []);

    // Initialize base UI font size from local storage on mount (em units)
    useEffect(() => {
        const saved = getLocalStorage("fontScale");
        const base = typeof saved === "number" ? saved : 1;
        document.documentElement.style.setProperty("--eca-font-size", `${base}em`);
    }, []);

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

    // Global shortcut: Alt+Shift+(+/-) to zoom font size by 0.1em, Alt+Shift+0 to reset
    useKeyPressedListener((e) => {
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
    });

    return (
        <Outlet />
    );
}

export default RootWrapper;
