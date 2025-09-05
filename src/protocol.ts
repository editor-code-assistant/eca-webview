export interface InitializeParams {
    processId: number;
    clientInfo: {
        name: string;
        version: string;
    };
    capabilities: {
        codeAssistant: {
            chat: boolean;
        };
    };
    initializationOptions?: any;
    workspaceFolders: WorkspaceFolder[];
}

export interface WorkspaceFolder {
    name: string;
    uri: string;
}

export interface InitializeResult {
    models: string[];
    chatDefaultModel: string;
    chatBehaviors: string[];
    chatDefaultBehavior: ChatBehavior;
    chatWelcomeMessage: string;
}

export interface ChatPromptParams {
    chatId?: string;
    requestId: string;
    message: string;
    model?: string;
    behavior?: ChatBehavior;
    contexts?: ChatContext[];
}

interface FileContext {
    type: 'file';
    path: string;
    linesRange?: {
        start: number,
        end: number,
    }
}

interface DirectoryContext {
    type: 'directory';
    path: string;
}

interface WebContext {
    type: 'web';
    url: string;
}

interface RepoMapContext {
    type: 'repoMap';
}

interface McpResourceContext {
    type: 'mcpResource';
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    server: string;
}

export type ChatContext = FileContext | DirectoryContext | WebContext | RepoMapContext | McpResourceContext;
export type ChatBehavior = 'agent' | 'chat';

export interface ChatPromptResult {
    chatId: string;
    model: string;
}

export interface ChatToolCallApproveParams {
    chatId: string;
    toolCallId: string;
}

export interface ChatToolCallRejectParams {
    chatId: string;
    toolCallId: string;
}

export interface ChatPromptStopParams {
    chatId: string;
}

export interface ChatDeleteParams {
    chatId: string;
}

export interface ChatContentReceivedParams {
    chatId: string;
    role: ChatContentRole;
    content: ChatContent;
}

export type ChatContentRole = 'user' | 'system' | 'assistant';

type ChatContent =
    | TextContent
    | URLContent
    | ProgressContent
    | UsageContent
    | ToolCallPrepareContent
    | ToolCallRunContent
    | ToolCallRunningContent
    | ToolCallRejectedContent
    | ToolCalledContent
    | ReasonStartedContent
    | ReasonTextContent
    | ReasonFinishedContent;

interface TextContent {
    type: 'text';
    text: string;
}

interface URLContent {
    type: 'url';
    title: string;
    url: string;
}

interface ProgressContent {
    type: 'progress';
    state: 'running' | 'finished';
    text?: string;
}

interface UsageContent {
    type: 'usage';
    sessionTokens: number;
    lastMessageCost?: string;
    sessionCost?: string;
    limit?: {
        context: number;
        output: number;
    }
}

interface ToolCallPrepareContent {
    type: 'toolCallPrepare';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    argumentsText: string;
    manualApproval: boolean;
    summary?: string;
}

interface ToolCallRunContent {
    type: 'toolCallRun';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: string[];
    manualApproval: boolean;
    details?: ToolCallDetails;
    summary?: string;
}

interface ToolCallRunningContent {
    type: 'toolCallRunning';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: string[];
    details?: ToolCallDetails;
    summary?: string;
}

interface ToolCallRejectedContent {
    type: 'toolCallRejected';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: { [key: string]: string };
    details?: ToolCallDetails;
    summary?: string;
}

interface ToolCalledContent {
    type: 'toolCalled';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: string[];
    error: boolean;
    outputs: ToolCallOutput[];
    totalTimeMs: number;
    details?: ToolCallDetails;
    summary?: string;
}

export interface ToolCallOutput {
    type: 'text';
    text: string;
}

export type ToolCallOrigin = 'mcp' | 'native';

export type ToolCallDetails = FileChangeDetails;

export interface FileChangeDetails {
    type: 'fileChange';
    path: string;
    diff: string;
    linesAdded: number;
    linesRemoved: number;
}

interface ReasonStartedContent {
    type: 'reasonStarted';
    id: string;
}

interface ReasonTextContent {
    type: 'reasonText';
    id: string;
    text: string;
}

interface ReasonFinishedContent {
    type: 'reasonFinished';
    id: string;
    totalTimeMs: number;
}

export interface ChatQueryContextParams {
    chatId: string;
    query: string;
    contexts: ChatContext[];
}

export interface ChatQueryContextResponse {
    chatId: string;
    contexts: ChatContext[];
}

export interface ChatQueryCommandsParams {
    chatId: string;
    query: string;
}

export interface ChatQueryCommandsResponse {
    chatId: string;
    contexts: ChatCommand[];
}

export interface ChatCommand {
    name: string;
    description: string;
    type: 'mcpPrompt' | 'native';
    arguments: [{
        name: string;
        description?: string;
        required: boolean;
    }];
}

export type ToolServerStatus = 'running' | 'starting' | 'stopped' | 'failed' | 'disabled';

interface MCPServerUpdatedParams {
    type: 'mcp';
    name: string;
    command: string;
    args: string[];
    status: ToolServerStatus;
    tools?: ServerTool[];
}

interface EcaServerUpdatedParams {
    type: 'native';
    name: string;
    status: ToolServerStatus;
    tools: ServerTool[];
}

export type ToolServerUpdatedParams = EcaServerUpdatedParams | MCPServerUpdatedParams;

export interface ServerToolParameters {
    properties: { [key: string]: { type: string, description?: string } },
    required: string[],
}

export interface ServerTool {
    name: string;
    description: string;
    parameters: ServerToolParameters;
    disabled?: boolean;
}

export interface McpStartServerParams {
    name: string;
}

export interface McpStopServerParams {
    name: string;
}
