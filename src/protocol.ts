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

export interface SessionInfo {
    id: string;
    workspaceFolder: WorkspaceFolder;
    status: string;
}

export interface InitializeResult {
    models: string[];
    chatDefaultModel: string;
    chatAgents: string[];
    chatDefaultAgent: ChatAgent;
    chatWelcomeMessage: string;
}

export interface ChatPromptParams {
    // Optional on the wire for back-compat with older servers, but the
    // webview now always populates it (UUID minted client-side, see
    // `newChatId` in src/util.ts). The server treats an unknown id as
    // a signal to auto-create the chat record and reply with
    // `chat/opened`.
    chatId?: string;
    requestId: string;
    message: string;
    model?: string;
    agent?: ChatAgent;
    variant?: string;
    trust?: boolean;
    contexts?: ChatContext[];
}

/**
 * Outbound `chat/selectedModelChanged` notification. When `chatId` is
 * provided AND the chat exists server-side, the server persists the
 * model/variant on `[:chats chat-id]` and echoes back a `config/updated`
 * carrying that same `chatId` so the client can scope the update.
 *
 * When `chatId` is omitted the server falls back to its legacy
 * session-wide path and the resulting `config/updated` has no chatId.
 */
export interface ChatSelectedModelChangedParams {
    chatId?: string;
    model: string;
    variant?: string;
}

/**
 * Outbound `chat/selectedAgentChanged` notification. Per-chat semantics
 * mirror `ChatSelectedModelChangedParams` above.
 */
export interface ChatSelectedAgentChangedParams {
    chatId?: string;
    agent: ChatAgent;
}

/**
 * Inbound `config/updated` notification.
 *
 * When `chatId` is present at the top level, the per-chat fields under
 * `chat` (selectModel / selectAgent / selectVariant / selectTrust) apply
 * ONLY to the chat with that id; other config fields (models, agents,
 * welcomeMessage, …) still apply globally.
 *
 * When `chatId` is absent, the payload is the legacy session-wide
 * config push and per-chat fields should be applied to every existing
 * chat (so the initial post-`initialize` push still fans out).
 */
export interface ConfigUpdatedParams {
    chatId?: string;
    usageStringFormat?: string;
    chat?: {
        models?: string[];
        agents?: string[];
        selectModel?: string;
        selectAgent?: ChatAgent;
        welcomeMessage?: string;
        variants?: string[];
        selectVariant?: string | null;
        selectTrust?: boolean;
    };
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

export interface ChatPromptSteerParams {
    chatId: string;
    message: string;
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
    | ChatMetadataContent
    | ChatFlagContent;

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

export interface ContextBreakdownCategory {
    name: string;
    tokens: number;
    color: string;
    emoji: string;
}

export interface ContextBreakdown {
    categories: ContextBreakdownCategory[];
    usedTokens: number;
    freeTokens?: number;
    contextLimit?: number;
    freeColor?: string;
    freeEmoji?: string;
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
    contextBreakdown?: ContextBreakdown;
}

interface ChatToolCallPrepareContent {
    type: 'toolCallPrepare';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    server?: string;
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
    server?: string;
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
    server?: string;
    arguments: string[];
    details?: ToolCallDetails;
    summary?: string;
}

interface ChatToolCallRejectedContent {
    type: 'toolCallRejected';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    server?: string;
    arguments: { [key: string]: string };
    details?: ToolCallDetails;
    summary?: string;
}

interface ChatToolCalledContent {
    type: 'toolCalled';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    server?: string;
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

export type ToolCallDetails = FileChangeDetails | JsonOutputsDetails | SubagentDetails | TaskDetails | ShellCommandDetails;

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

/**
 * Breakdown of a shell command tool call.
 * Present when the server could safely parse the command; clients can use it
 * to show what an "approve & remember" would remember.
 */
export interface ShellCommandDetails {
    type: 'shellCommand';
    /** Individual commands extracted from the shell invocation (split on &&, ||, ;, |). */
    commands: ShellCommandBreakdown[];
    /** Whether the command runs in background as a job. */
    background?: boolean;
}

export interface ShellCommandBreakdown {
    /** The command being executed, e.g. "ls", "git". */
    command: string;
    /** All arguments to the command, including flags. */
    args: string[];
    /**
     * The key that "approve & remember" would remember for this command,
     * e.g. "git checkout" or "rg". Absent when this command can never be
     * auto-approved (wrappers like sudo/xargs, output redirections, dynamic
     * command words).
     */
    approvalKey?: string;
    /** Whether approvalKey is already remembered for this session. */
    remembered?: boolean;
}

export interface TaskDetails {
    type: 'task';
    activeSummary?: string;
    tasks: Task[];
    inProgressTaskIds: number[];
    summary: {
        done: number;
        inProgress: number;
        pending: number;
        total: number;
    };
}

export interface Task {
    id: number;
    subject: string;
    description: string;
    status: 'done' | 'in-progress' | 'pending';
    priority: string;
    isBlocked: boolean;
    blockedBy?: number[];
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

interface ChatFlagContent {
    type: 'flag';
    text: string;
    contentId: string;
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

export interface ChatQueryFilesParams {
    chatId: string;
    query: string;
}

export interface ChatFile {
    path: string;
}

export interface ChatQueryFilesResponse {
    chatId: string;
    files: ChatFile[];
}

export interface ChatCommand {
    name: string;
    description: string;
    type: 'mcpPrompt' | 'native';
    arguments?: Array<{
        name: string;
        description?: string;
        required: boolean;
    }> | null;
}

export interface ChatClearedParams {
    chatId: string;
    messages: boolean;
}

// ── chat/list (resume picker) ──
//
// The server returns one summary per persisted, non-subagent chat
// keyed by the chat's persistent id. Sorted descending by `updatedAt`
// (or `createdAt` when `sortBy` requests it). `id` is guaranteed
// non-nil — the server projects it from the chats-map key, so legacy
// rows missing an inner `:id` still round-trip cleanly.
export interface ChatListParams {
    limit?: number;
    sortBy?: 'updatedAt' | 'createdAt';
}

export interface ChatSummary {
    id: string;
    title?: string;
    status: string;
    messageCount: number;
    createdAt?: number;
    updatedAt?: number;
    model?: string;
}

export interface ChatListResponse {
    chats: ChatSummary[];
}

// ── chat/open (resume picker) ──
//
// Asks the server to replay a persisted chat. Side effects (in order)
// emitted as notifications BEFORE this response returns:
//   1. chat/cleared { chatId, messages: true }
//   2. chat/opened  { chatId, title? }
//   3. N × chat/contentReceived { chatId, role, content }
//   4. config/updated { chatId, chat: { selectModel?, selectTrust? } }
//
// The webview lets those flow through the normal RootWrapper listeners
// (so the resumed chat lands in `state.chat.chats[chatId]` naturally);
// the response below is just the picker's signal to flip selection and
// dismiss the modal.
export interface ChatOpenParams {
    chatId: string;
}

export interface ChatOpenResponse {
    found: boolean;
    chatId?: string;
    title?: string;
}

export type ToolServerStatus = 'running' | 'starting' | 'stopped' | 'failed' | 'disabled' | 'requires-auth';

export interface MCPServerUpdatedParams {
    type: 'mcp';
    name: string;
    command?: string;
    args?: string[];
    url?: string;
    status: ToolServerStatus;
    tools?: ServerTool[];
    prompts?: ServerPrompt[];
    resources?: ServerResource[];
    hasAuth?: boolean;
}

export interface ServerPrompt {
    name: string;
    description: string;
    arguments?: PromptArgument[];
}

export interface PromptArgument {
    name: string;
    description: string;
    required: boolean;
}

export interface ServerResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
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

export interface McpConnectServerParams {
    name: string;
}

export interface McpLogoutServerParams {
    name: string;
}

/**
 * Payload for adding a new MCP server via the `mcp/addServer` IPC message.
 * Exactly one transport must be populated: stdio (`command` + optional
 * `args`/`env`) or HTTP (`url` + optional `headers`/OAuth fields).
 * `scope` defaults to "global" on the server.
 */
export interface McpAddServerRequest {
    name: string;
    // stdio transport
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    // HTTP transport
    url?: string;
    headers?: Record<string, string>;
    clientId?: string;
    clientSecret?: string;
    oauthPort?: number;
    // shared
    disabled?: boolean;
    scope?: 'global' | 'workspace';
    workspaceUri?: string;
}

export interface McpAddServerResponse {
    server?: MCPServerUpdatedParams;
    error?: { code: string; message: string; data?: unknown };
}

export interface McpRemoveServerRequest {
    name: string;
}

export interface McpRemoveServerResponse {
    name?: string;
    removed?: boolean;
    error?: { code: string; message: string; data?: unknown };
}

export interface ToolServerRemovedParams {
    name: string;
}

// Provider types

export type ProviderAuthStatus = 'authenticated' | 'expiring' | 'expired' | 'unauthenticated' | 'local' | 'not-running';

export interface ProviderAuth {
    status: ProviderAuthStatus;
    type?: 'oauth' | 'api-key';
    source?: 'config' | 'login' | 'env';
    mode?: string;
    expiresAt?: number;
    envVar?: string;
}

export interface LoginMethod {
    key: string;
    label: string;
}

export interface ProviderModel {
    id: string;
    capabilities: {
        reason: boolean;
        vision: boolean;
        tools: boolean;
        webSearch: boolean;
    };
    cost?: { input: number; output: number };
    settings?: Record<string, unknown>;
}

export interface ProviderStatus {
    id: string;
    label?: string;
    configured: boolean;
    auth: ProviderAuth;
    login?: { methods: LoginMethod[] };
    models: ProviderModel[];
    settings?: Record<string, unknown>;
}

export interface ProvidersListResult {
    providers: ProviderStatus[];
}

export interface InputField {
    key: string;
    label: string;
    type: 'secret' | 'text';
}

export type LoginAction =
    | { action: 'choose-method'; methods: LoginMethod[] }
    | { action: 'authorize'; url: string; message: string; fields?: InputField[] }
    | { action: 'device-code'; url: string; code: string; message: string }
    | { action: 'input'; fields: InputField[] }
    | { action: 'done' };

// === Ask Question ===

export interface AskQuestionOption {
    label: string;
    description?: string;
}

export interface AskQuestionData {
    chatId: string;
    question: string;
    options: AskQuestionOption[];
    toolCallId?: string;
    allowFreeform?: boolean;
    requestId: string;
}

export interface PendingQuestion {
    chatId: string;
    question: string;
    options: AskQuestionOption[];
    toolCallId?: string;
    allowFreeform?: boolean;
    requestId: string;
    answer?: string;
    cancelled?: boolean;
}

// === Background Jobs ===

export type JobStatus = 'running' | 'completed' | 'failed' | 'killed';

export interface Job {
    id: string;
    status: JobStatus;
    label: string;
    summary?: string;
    startedAt: string;
    elapsed: string;
    exitCode?: number | null;
    chatId: string;
    chatLabel?: string;
    toolCallId?: string;
}

export interface JobOutputLine {
    text: string;
    stream: 'stdout' | 'stderr';
}

export interface JobsUpdatedParams {
    jobs: Job[];
}

export interface JobsReadOutputResult {
    lines: JobOutputLine[];
    status: string;
    exitCode?: number | null;
}

export interface JobsKillResult {
    killed: boolean;
}
