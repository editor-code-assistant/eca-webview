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
    chatAgents: string[];
    chatDefaultAgent: ChatAgent;
    chatWelcomeMessage: string;
}

export interface ChatPromptParams {
    chatId?: string;
    requestId: string;
    message: string;
    model?: string;
    agent?: ChatAgent;
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

interface CursorContext {
    type: 'cursor';
    path: string;
    position: {
        start: {
            line: number;
            character: number;
        },
        end: {
            line: number;
            character: number;
        }
    }
}

interface McpResourceContext {
    type: 'mcpResource';
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    server: string;
}

export type ChatContext = FileContext | DirectoryContext | WebContext | RepoMapContext | CursorContext | McpResourceContext;
export type ChatAgent = 'agent' | 'chat';

export interface ChatPromptResult {
    chatId: string;
    model: string;
}

export interface ChatToolCallApproveParams {
    chatId: string;
    toolCallId: string;
    save?: string;
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
    parentChatId?: string;
    role: ChatContentRole;
    content: ChatContent;
}

export type ChatContentRole = 'user' | 'system' | 'assistant';

export type ChatContent =
    | ChatTextContent
    | ChatURLContent
    | ChatProgressContent
    | ChatUsageContent
    | ChatToolCallPrepareContent
    | ChatToolCallRunContent
    | ChatToolCallRunningContent
    | ChatToolCallRejectedContent
    | ChatToolCalledContent
    | ChatReasonStartedContent
    | ChatReasonTextContent
    | ChatReasonFinishedContent
    | ChatHookActionStartedContent 
    | ChatHookActionFinishedContent 
    | ChatMetadataContent;

interface ChatTextContent {
    type: 'text';
    text: string;
    contentId?: string;
}

interface ChatURLContent {
    type: 'url';
    title: string;
    url: string;
}

interface ChatProgressContent {
    type: 'progress';
    state: 'running' | 'finished';
    text?: string;
}

interface ChatUsageContent {
    type: 'usage';
    sessionTokens: number;
    lastMessageCost?: string;
    sessionCost?: string;
    limit?: {
        context: number;
        output: number;
    }
}

interface ChatToolCallPrepareContent {
    type: 'toolCallPrepare';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    argumentsText: string;
    manualApproval: boolean;
    summary?: string;
    details?: ToolCallDetails;
}

interface ChatToolCallRunContent {
    type: 'toolCallRun';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: string[];
    manualApproval: boolean;
    details?: ToolCallDetails;
    summary?: string;
}

interface ChatToolCallRunningContent {
    type: 'toolCallRunning';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: string[];
    details?: ToolCallDetails;
    summary?: string;
}

interface ChatToolCallRejectedContent {
    type: 'toolCallRejected';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: { [key: string]: string };
    details?: ToolCallDetails;
    summary?: string;
}

interface ChatToolCalledContent {
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

export type ToolCallDetails = FileChangeDetails | JsonOutputsDetails | SubagentDetails;

export interface FileChangeDetails {
    type: 'fileChange';
    path: string;
    diff: string;
    linesAdded: number;
    linesRemoved: number;
}

export interface JsonOutputsDetails {
    type: 'jsonOutputs';
    jsons: string[];
}

export interface SubagentDetails {
    type: 'subagent';
    subagentChatId: string;
    agentName?: string;
    step?: number;
    maxSteps?: number;
}

interface ChatReasonStartedContent {
    type: 'reasonStarted';
    id: string;
}

interface ChatReasonTextContent {
    type: 'reasonText';
    id: string;
    text: string;
}

interface ChatReasonFinishedContent {
    type: 'reasonFinished';
    id: string;
    totalTimeMs: number;
}

interface ChatHookActionStartedContent {
    type: 'hookActionStarted';
    id: string; 
    name: string;
    actionType: string;
}

interface ChatHookActionFinishedContent {
    type: 'hookActionFinished';
    id: string; 
    name: string;
    actionType: string;
    status: number;
    output?: string;
    error?: string;
}

interface ChatMetadataContent {
    type: 'metadata';
    title?: string;
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

export interface ChatClearedParams {
    chatId: string;
    messages: boolean;
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
