import type {
    AskQuestionData,
    ChatAgent,
    ChatClearedParams,
    ChatContentReceivedParams,
    ChatContext,
    ChatListResponse,
    ChatOpenResponse,
    ChatQueryCommandsResponse,
    ChatQueryContextResponse,
    ChatQueryFilesResponse,
    ChatSelectedAgentChangedParams,
    ChatSelectedModelChangedParams,
    ChatToolCallApproveParams,
    ChatToolCallRejectParams,
    Job,
    JobsKillResult,
    JobsReadOutputResult,
    JobsUpdatedParams,
    LoginAction,
    McpAddServerRequest,
    McpAddServerResponse,
    McpRemoveServerRequest,
    McpRemoveServerResponse,
    ProviderStatus,
    ProvidersListResult,
    ToolServerRemovedParams,
    ToolServerUpdatedParams,
    WorkspaceFolder,
    ConfigUpdatedParams,
} from './protocol';

export type EmptyPayload = Record<string, never>;

export interface RpcError {
    code?: string;
    message: string;
    data?: unknown;
}

export interface NavigateToMessage {
    path: string;
    toggle?: boolean;
    state?: unknown;
}

export interface FileFocusChanged {
    type: 'fileFocused';
    path: string;
    position?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
}

export type FocusChanged = FileFocusChanged;

export interface GlobalConfigReadResult {
    contents: string;
    path: string;
    exists: boolean;
    error?: string;
}

export interface GlobalConfigWriteResult {
    ok: boolean;
    path?: string;
    error?: string;
}

export interface McpUpdateServerRequest {
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
}

export interface LogEntry {
    ts: number;
    seq: number;
    sessionId?: string;
    source: 'server' | 'desktop';
    level: 'info' | 'error';
    text: string;
}

export enum ServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Initializing = 'Initializing',
    Running = 'Running',
    Failed = 'Failed',
}

export interface InitProgressTask {
    taskId: string;
    title: string;
    type: 'start' | 'finish';
}

export interface ChatListResult extends Partial<ChatListResponse> {
    error?: RpcError;
}

export interface ChatOpenResult extends Partial<ChatOpenResponse> {
    'found?'?: boolean;
    error?: RpcError;
}

export interface WebviewRequestMap {
    'editor/readGlobalConfig': {
        request: EmptyPayload;
        response: GlobalConfigReadResult;
    };
    'editor/writeGlobalConfig': {
        request: { contents: string };
        response: GlobalConfigWriteResult;
    };
    'editor/readInput': {
        request: { message: string };
        response: string | null;
    };
    'editor/saveClipboardImage': {
        request: { base64Data: string; mimeType: string };
        response: { path: string };
    };
    'chat/list': {
        request: { limit?: number; sortBy?: 'updatedAt' | 'createdAt' };
        response: ChatListResult;
    };
    'chat/open': {
        request: { chatId: string };
        response: ChatOpenResult;
    };
    'mcp/updateServer': {
        request: McpUpdateServerRequest;
        response: unknown;
    };
    'mcp/addServer': {
        request: McpAddServerRequest;
        response: McpAddServerResponse;
    };
    'mcp/removeServer': {
        request: McpRemoveServerRequest;
        response: McpRemoveServerResponse;
    };
    'providers/list': {
        request: EmptyPayload;
        response: ProvidersListResult;
    };
    'providers/login': {
        request: { provider: string; method?: string };
        response: LoginAction;
    };
    'providers/loginInput': {
        request: { provider: string; data: Record<string, string> };
        response: LoginAction;
    };
    'providers/logout': {
        request: { provider: string };
        response: unknown;
    };
    'jobs/list': {
        request: EmptyPayload;
        response: { jobs: Job[] };
    };
    'jobs/readOutput': {
        request: { jobId: string };
        response: JobsReadOutputResult;
    };
    'jobs/kill': {
        request: { jobId: string };
        response: JobsKillResult;
    };
}

export type WebviewRequestType = keyof WebviewRequestMap;
export type WebviewRequestPayload<K extends WebviewRequestType> = WebviewRequestMap[K]['request'];
export type WebviewRequestResponse<K extends WebviewRequestType> = WebviewRequestMap[K]['response'];

export interface WebviewNotificationMap {
    'webview/ready': EmptyPayload;
    'editor/openFile': { path: string };
    'editor/openGlobalConfig': EmptyPayload;
    'editor/openServerLogs': EmptyPayload;
    'editor/openUrl': { url: string };
    'editor/refresh': EmptyPayload;
    'editor/saveFile': { content: string; defaultName?: string };
    'editor/toggleSidebar': EmptyPayload;
    'chat/userPrompt': {
        chatId: string;
        requestId: number;
        prompt: string;
        contexts: ChatContext[];
        model?: string;
        agent: ChatAgent;
        variant?: string;
        trust?: boolean;
    };
    'chat/toolCallApprove': ChatToolCallApproveParams;
    'chat/toolCallReject': ChatToolCallRejectParams;
    'chat/promptStop': { chatId: string };
    'chat/promptSteer': { chatId: string; message: string };
    'chat/delete': { chatId: string };
    'chat/rollback': { chatId: string; contentId: string };
    'chat/addFlag': { chatId: string; contentId: string };
    'chat/removeFlag': { chatId: string; contentId: string };
    'chat/fork': { chatId: string; contentId: string };
    'chat/queryContext': {
        chatId?: string;
        query: string;
        contexts: Array<ChatContext | { type: 'cursor' }>;
    };
    'chat/queryCommands': { chatId?: string; query: string };
    'chat/queryFiles': { chatId?: string; query: string };
    'chat/answerQuestion':
        | { requestId: string; answer: string; cancelled: false }
        | { requestId: string; answer: null; cancelled: true };
    'chat/selectedModelChanged': ChatSelectedModelChangedParams;
    'chat/selectedAgentChanged': ChatSelectedAgentChangedParams;
    'chat/update': { chatId: string; trust: boolean };
    'chat/clearChat': { chatId: string };
    'server/setTrust': boolean;
    'mcp/startServer': { name: string };
    'mcp/stopServer': { name: string };
    'mcp/connectServer': { name: string };
    'mcp/logoutServer': { name: string };
    'mcp/disableServer': { name: string };
    'mcp/enableServer': { name: string };
    'logs/snapshot': EmptyPayload;
    'logs/clear': EmptyPayload;
    'logs/openFolder': EmptyPayload;
}

export type WebviewOutboundMap = WebviewNotificationMap & {
    [K in WebviewRequestType]: WebviewRequestPayload<K> & { requestId: string };
};

export type WebviewOutboundType = keyof WebviewOutboundMap;

type RequestEnvelope<T> = T & { requestId: string };

export interface WebviewInboundMap {
    navigateTo: NavigateToMessage;
    'logs/snapshot': LogEntry[];
    'logs/appended': LogEntry;
    'server/statusChanged': ServerStatus;
    '$/progress': InitProgressTask;
    'server/setWorkspaceFolders': WorkspaceFolder[];
    'server/setTrust': boolean;
    'chat/contentReceived': ChatContentReceivedParams;
    'chat/batchContentReceived': ChatContentReceivedParams[];
    'chat/queryContext': ChatQueryContextResponse;
    'chat/addContextToSystemPrompt': ChatContext;
    'chat/queryCommands': ChatQueryCommandsResponse;
    'chat/queryFiles': ChatQueryFilesResponse;
    'chat/cleared': ChatClearedParams;
    'chat/deleted': string;
    'chat/opened': { chatId: string; title?: string };
    'chat/statusChanged': { chatId: string; status: string };
    'chat/askQuestion': AskQuestionData;
    'chat/createNewChat': undefined;
    'chat/selectChat': string;
    'chat/sendPromptToCurrentChat': { prompt: string };
    'chat/closeCurrent': undefined;
    'chat/renameCurrent': undefined;
    'chat/clearCurrent': undefined;
    'chat/exportCurrent': undefined;
    'chat/stopCurrent': undefined;
    'chat/focusPrompt': undefined;
    'tool/serversUpdated': ToolServerUpdatedParams;
    'tool/serverRemoved': ToolServerRemovedParams;
    'config/updated': ConfigUpdatedParams;
    'providers/updated': ProviderStatus;
    'jobs/updated': JobsUpdatedParams;
    'editor/focusChanged': FocusChanged;
    'editor/readInput': { requestId: string; value: string | null };
    'editor/readGlobalConfig': RequestEnvelope<GlobalConfigReadResult>;
    'editor/writeGlobalConfig': RequestEnvelope<GlobalConfigWriteResult>;
    'editor/saveClipboardImage': RequestEnvelope<{ path: string }>;
    'chat/list': RequestEnvelope<ChatListResult>;
    'chat/open': RequestEnvelope<ChatOpenResult>;
    'mcp/updateServer': RequestEnvelope<Record<string, unknown>>;
    'mcp/addServer': RequestEnvelope<McpAddServerResponse>;
    'mcp/removeServer': RequestEnvelope<McpRemoveServerResponse>;
    'providers/list': RequestEnvelope<ProvidersListResult>;
    'providers/login': RequestEnvelope<LoginAction>;
    'providers/loginInput': RequestEnvelope<LoginAction>;
    'providers/logout': { requestId: string } & Record<string, unknown>;
    'jobs/list': RequestEnvelope<{ jobs: Job[] }>;
    'jobs/readOutput': RequestEnvelope<JobsReadOutputResult>;
    'jobs/kill': RequestEnvelope<JobsKillResult>;
}

export type WebviewInboundType = keyof WebviewInboundMap;

export interface WebviewMessage<K extends WebviewOutboundType = WebviewOutboundType> {
    type: K;
    data: WebviewOutboundMap[K];
}
