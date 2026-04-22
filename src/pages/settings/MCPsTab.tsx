import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { McpAddServerRequest, MCPServerUpdatedParams, ToolServerStatus } from '../../protocol';
import { State, useEcaDispatch } from '../../redux/store';
import {
    addServer,
    connectServer,
    disableServer,
    enableServer,
    logoutServer,
    removeServer,
    startServer,
    stopServer,
    updateServer,
} from '../../redux/thunks/mcp';
import { openServerLogs } from '../../redux/thunks/server';
import { ToolTip } from '../components/ToolTip';
import './MCPsTab.scss';

const statusLabel: Record<ToolServerStatus, string> = {
    'running': 'Running',
    'starting': 'Starting',
    'stopped': 'Stopped',
    'failed': 'Failed',
    'disabled': 'Disabled',
    'requires-auth': 'Requires auth',
};

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parse a multi-line KEY=VALUE block into an object.
 * Blank lines are ignored. Returns a human-readable error string when
 * any non-blank line is malformed.
 */
function parseEnvLines(raw: string): Record<string, string> | { error: string } {
    const out: Record<string, string> = {};
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const eq = line.indexOf('=');
        if (eq <= 0) return { error: `env line ${i + 1} must be KEY=VALUE: "${line}"` };
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1);
        if (!key) return { error: `env line ${i + 1} has empty key` };
        out[key] = value;
    }
    return out;
}

/**
 * Parse a multi-line "Header: value" block into an object.
 * Blank lines are ignored. Colon in the value is preserved (first split wins).
 */
function parseHeaderLines(raw: string): Record<string, string> | { error: string } {
    const out: Record<string, string> = {};
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const colon = line.indexOf(':');
        if (colon <= 0) return { error: `header line ${i + 1} must be "Key: value": "${line}"` };
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (!key) return { error: `header line ${i + 1} has empty key` };
        out[key] = value;
    }
    return out;
}

// ── Add-server form ───────────────────────────────────────────────────────

interface AddServerFormProps {
    existingNames: Set<string>;
    onClose: () => void;
}

/**
 * Inline form for adding a new MCP server. Posts `mcp/addServer` and waits
 * for the server's response — validation errors surface inline, and on
 * success the `tool/serverUpdated` broadcast will populate the new row in
 * the parent list so we don't need to push it locally.
 */
function AddServerForm({ existingNames, onClose }: AddServerFormProps) {
    const dispatch = useEcaDispatch();
    const [name, setName] = useState('');
    const [transport, setTransport] = useState<'stdio' | 'remote'>('stdio');
    const [command, setCommand] = useState('');
    const [args, setArgs] = useState('');
    const [env, setEnv] = useState('');
    const [url, setUrl] = useState('');
    const [headers, setHeaders] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmedName = name.trim();
    const nameCollision = trimmedName.length > 0 && existingNames.has(trimmedName);

    const canSubmit =
        trimmedName.length > 0 &&
        !nameCollision &&
        !submitting &&
        (transport === 'stdio' ? command.trim().length > 0 : url.trim().length > 0);

    const onSubmit = async () => {
        setError(null);
        if (!trimmedName) return setError('Name is required.');
        if (nameCollision) return setError(`Server '${trimmedName}' already exists.`);

        const payload: McpAddServerRequest = { name: trimmedName };

        if (transport === 'stdio') {
            if (!command.trim()) return setError('Command is required for stdio transport.');
            payload.command = command.trim();
            const parsedArgs = args.trim() ? args.trim().split(/\s+/) : [];
            if (parsedArgs.length) payload.args = parsedArgs;
            if (env.trim()) {
                const parsed = parseEnvLines(env);
                if ('error' in parsed) return setError(parsed.error);
                if (Object.keys(parsed).length) payload.env = parsed;
            }
        } else {
            if (!url.trim()) return setError('URL is required for remote transport.');
            payload.url = url.trim();
            if (headers.trim()) {
                const parsed = parseHeaderLines(headers);
                if ('error' in parsed) return setError(parsed.error);
                if (Object.keys(parsed).length) payload.headers = parsed;
            }
        }

        setSubmitting(true);
        try {
            const result = await dispatch(addServer(payload)).unwrap();
            if (result?.error) {
                setError(result.error.message ?? 'Failed to add MCP server.');
                return;
            }
            onClose();
        } catch (err) {
            setError((err as Error)?.message ?? 'Failed to add MCP server.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="add-server-form">
            <div className="form-header">
                <span className="form-title">New MCP server</span>
                <button
                    className="icon-btn"
                    onClick={onClose}
                    aria-label="Close add-server form"
                    disabled={submitting}
                >
                    <i className="codicon codicon-close"></i>
                </button>
            </div>

            <div className="form-row">
                <label className="form-label">Name</label>
                <input
                    className={`editable-field${nameCollision ? ' has-error' : ''}`}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="my-mcp-server"
                    spellCheck={false}
                    autoFocus
                />
                {nameCollision &&
                    <span className="field-hint error">Name already in use</span>}
            </div>

            <div className="form-row">
                <label className="form-label">Transport</label>
                <div className="transport-toggle">
                    <button
                        type="button"
                        className={`toggle-btn ${transport === 'stdio' ? 'active' : ''}`}
                        onClick={() => setTransport('stdio')}
                    >
                        <i className="codicon codicon-terminal"></i>
                        stdio
                    </button>
                    <button
                        type="button"
                        className={`toggle-btn ${transport === 'remote' ? 'active' : ''}`}
                        onClick={() => setTransport('remote')}
                    >
                        <i className="codicon codicon-globe"></i>
                        remote
                    </button>
                </div>
            </div>

            {transport === 'stdio' ? (
                <>
                    <div className="form-row">
                        <label className="form-label">Command</label>
                        <input
                            className="editable-field"
                            type="text"
                            value={command}
                            onChange={e => setCommand(e.target.value)}
                            placeholder="npx"
                            spellCheck={false}
                        />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Args</label>
                        <input
                            className="editable-field"
                            type="text"
                            value={args}
                            onChange={e => setArgs(e.target.value)}
                            placeholder="-y my-mcp-package"
                            spellCheck={false}
                        />
                        <span className="field-hint">Whitespace-separated.</span>
                    </div>
                    <div className="form-row">
                        <label className="form-label">Env <span className="optional">(optional)</span></label>
                        <textarea
                            className="editable-field multiline"
                            value={env}
                            onChange={e => setEnv(e.target.value)}
                            placeholder="KEY=value&#10;OTHER=another"
                            spellCheck={false}
                            rows={3}
                        />
                        <span className="field-hint">One <code>KEY=VALUE</code> per line.</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="form-row">
                        <label className="form-label">URL</label>
                        <input
                            className="editable-field url-field"
                            type="text"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://example.com/mcp"
                            spellCheck={false}
                        />
                    </div>
                    <div className="form-row">
                        <label className="form-label">Headers <span className="optional">(optional)</span></label>
                        <textarea
                            className="editable-field multiline"
                            value={headers}
                            onChange={e => setHeaders(e.target.value)}
                            placeholder="Authorization: Bearer xxx&#10;X-Custom: value"
                            spellCheck={false}
                            rows={3}
                        />
                        <span className="field-hint">One <code>Header: value</code> per line.</span>
                    </div>
                </>
            )}

            {error &&
                <div className="form-error">
                    <i className="codicon codicon-warning"></i>
                    <span>{error}</span>
                </div>}

            <div className="form-actions">
                <button
                    className="action-btn"
                    onClick={onClose}
                    disabled={submitting}
                    type="button"
                >
                    Cancel
                </button>
                <button
                    className="action-btn primary-btn"
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    type="button"
                >
                    {submitting ? 'Adding…' : 'Add server'}
                </button>
            </div>
        </div>
    );
}

// ── Edit existing connection fields ───────────────────────────────────────

function EditableConnectionFields({ server }: { server: MCPServerUpdatedParams }) {
    const dispatch = useEcaDispatch();
    const isRemote = !!server.url;

    const [url, setUrl] = useState(server.url ?? '');
    const [command, setCommand] = useState(server.command ?? '');
    const [args, setArgs] = useState(server.args?.join(' ') ?? '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setUrl(server.url ?? '');
        setCommand(server.command ?? '');
        setArgs(server.args?.join(' ') ?? '');
    }, [server.url, server.command, server.args]);

    const originalUrl = server.url ?? '';
    const originalCommand = server.command ?? '';
    const originalArgs = server.args?.join(' ') ?? '';

    const hasChanges = isRemote
        ? url !== originalUrl
        : command !== originalCommand || args !== originalArgs;

    const onSave = async () => {
        setSaving(true);
        try {
            if (isRemote) {
                await dispatch(updateServer({ name: server.name, url })).unwrap();
            } else {
                const parsedArgs = args.trim() ? args.trim().split(/\s+/) : [];
                await dispatch(updateServer({ name: server.name, command, args: parsedArgs })).unwrap();
            }
        } finally {
            setSaving(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && hasChanges && !saving) {
            onSave();
        } else if (e.key === 'Escape') {
            setUrl(originalUrl);
            setCommand(originalCommand);
            setArgs(originalArgs);
        }
    };

    if (isRemote) {
        return (
            <div className="section connection-section">
                <span className="section-label">
                    <i className="codicon codicon-globe"></i>
                    URL
                </span>
                <div className="editable-row">
                    <input
                        className="editable-field url-field"
                        type="text"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={onKeyDown}
                        spellCheck={false}
                    />
                    {hasChanges &&
                        <button className="save-btn" onClick={onSave} disabled={saving}>
                            {saving ? '…' : 'Save'}
                        </button>}
                </div>
            </div>
        );
    }

    if (!command && !args) return null;

    return (
        <div className="section connection-section">
            <span className="section-label">
                <i className="codicon codicon-terminal"></i>
                Command
            </span>
            <div className="editable-row">
                <input
                    className="editable-field"
                    type="text"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="command"
                    spellCheck={false}
                    style={{ width: `${Math.max(6, command.length + 2)}ch` }}
                />
                <input
                    className="editable-field"
                    type="text"
                    value={args}
                    onChange={e => setArgs(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="args"
                    spellCheck={false}
                    style={{ width: `${Math.max(4, args.length + 2)}ch` }}
                />
                {hasChanges &&
                    <button className="save-btn" onClick={onSave} disabled={saving}>
                        {saving ? '…' : 'Save'}
                    </button>}
            </div>
        </div>
    );
}

// ── Tab ───────────────────────────────────────────────────────────────────

export function MCPsTab() {
    const mcpServers = useSelector((state: State) => state.mcp.servers);
    const dispatch = useEcaDispatch();

    const [isAdding, setIsAdding] = useState(false);
    // Two-step inline-confirm: holds the name of the server currently awaiting
    // remove-confirmation. null when no card is in confirm mode.
    const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);

    const existingNames = useMemo(
        () => new Set(mcpServers.map(s => s.name)),
        [mcpServers],
    );

    const anyFailed = mcpServers.some(s => s.status === 'failed');

    const onOpenServerLogs = (_: any) => {
        dispatch(openServerLogs({}));
    };

    const onRemove = async (name: string) => {
        setRemoving(name);
        setConfirmingRemove(null);
        try {
            await dispatch(removeServer({ name })).unwrap();
        } finally {
            setRemoving(null);
        }
    };

    return (
        <div className="mcps-tab">
            <p className="tab-description">
                Extend ECA with extra tools via MCP servers.{' '}
                <a href="https://eca.dev/config/tools/#mcp">Learn more</a>
            </p>

            {anyFailed &&
                <div className="failed-banner">
                    <i className="codicon codicon-warning"></i>
                    <span>Some servers failed to start. Check <a href="#" onClick={onOpenServerLogs}>server logs</a> for details.</span>
                </div>}

            <div className="add-server-area">
                {isAdding
                    ? <AddServerForm
                        existingNames={existingNames}
                        onClose={() => setIsAdding(false)}
                    />
                    : <button
                        className="action-btn add-btn"
                        onClick={() => setIsAdding(true)}
                    >
                        <i className="codicon codicon-add"></i>
                        Add MCP server
                    </button>}
            </div>

            {mcpServers.length === 0 && !isAdding &&
                <div className="empty-state">
                    <i className="codicon codicon-extensions"></i>
                    <p>No MCP servers configured yet</p>
                    <a href="https://eca.dev/config/tools/#mcp">Configure your first MCP server</a>
                </div>}

            <div className="server-list">
                {mcpServers.map((server, index) => {
                    const isMcp = server.type === 'mcp';
                    const stoppable = server.status === 'running' || server.status === 'starting';
                    const failed = server.status === 'failed';
                    const disabled = server.status === 'disabled';
                    const requiresAuth = server.status === 'requires-auth';
                    const hasAuth = isMcp && server.hasAuth;
                    const prompts = isMcp ? server.prompts : undefined;
                    const resources = isMcp ? server.resources : undefined;
                    const toolCount = server.tools?.length ?? 0;
                    const promptCount = prompts?.length ?? 0;
                    const resourceCount = resources?.length ?? 0;
                    const hasConnection = isMcp && (!!server.url || !!server.command);
                    // Only MCP servers are user-managed; the synthetic 'eca'
                    // native server is never removable.
                    const isRemovable = isMcp;
                    const isConfirming = confirmingRemove === server.name;
                    const isRemovingThis = removing === server.name;

                    return (
                        <div key={index} className={`server-card ${server.status}`}>
                            <div className="server-header">
                                <div className="server-identity">
                                    <span className={`status-dot ${server.status}`}
                                        data-tooltip-id={`status-${server.name}`}
                                        onClick={failed ? onOpenServerLogs : undefined}></span>
                                    <span className="server-name">{server.name}</span>
                                </div>
                                <ToolTip id={`status-${server.name}`}>
                                    {failed && <span>{statusLabel[server.status]} — click to see server logs</span>}
                                    {requiresAuth && <span>{statusLabel[server.status]} — click Connect to authenticate</span>}
                                    {!failed && !requiresAuth && <span>{statusLabel[server.status]}</span>}
                                </ToolTip>
                                <div className="server-actions">
                                    {isConfirming ? (
                                        <>
                                            <span className="confirm-prompt">Remove?</span>
                                            <button
                                                className="action-btn stop-btn"
                                                onClick={() => onRemove(server.name)}
                                                disabled={isRemovingThis}
                                            >
                                                <i className="codicon codicon-trash"></i>
                                                {isRemovingThis ? 'Removing…' : 'Yes'}
                                            </button>
                                            <button
                                                className="action-btn"
                                                onClick={() => setConfirmingRemove(null)}
                                                disabled={isRemovingThis}
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {stoppable && hasAuth &&
                                                <button className="action-btn logout-btn"
                                                    onClick={() => dispatch(logoutServer({ name: server.name }))}>
                                                    <i className="codicon codicon-sign-out"></i>
                                                    Logout
                                                </button>}
                                            {stoppable &&
                                                <button className="action-btn disable-btn"
                                                    onClick={() => dispatch(disableServer({ name: server.name }))}>
                                                    <i className="codicon codicon-circle-slash"></i>
                                                    Disable
                                                </button>}
                                            {requiresAuth
                                                ? <button className="action-btn connect-btn"
                                                    onClick={() => dispatch(connectServer({ name: server.name }))}>
                                                    <i className="codicon codicon-plug"></i>
                                                    Connect
                                                  </button>
                                                : disabled
                                                    ? <button className="action-btn enable-btn"
                                                        onClick={() => dispatch(enableServer({ name: server.name }))}>
                                                        <i className="codicon codicon-check"></i>
                                                        Enable
                                                      </button>
                                                    : stoppable
                                                        ? <button className="action-btn stop-btn"
                                                            onClick={() => dispatch(stopServer({ name: server.name }))}>
                                                            <i className="codicon codicon-stop-circle"></i>
                                                            Stop
                                                          </button>
                                                        : <button className="action-btn start-btn"
                                                            onClick={() => dispatch(startServer({ name: server.name }))}>
                                                            <i className="codicon codicon-play"></i>
                                                            Start
                                                          </button>}
                                            {isRemovable &&
                                                <button
                                                    className="action-btn icon-only remove-btn"
                                                    onClick={() => setConfirmingRemove(server.name)}
                                                    title="Remove server"
                                                    aria-label={`Remove ${server.name}`}
                                                >
                                                    <i className="codicon codicon-trash"></i>
                                                </button>}
                                        </>
                                    )}
                                </div>
                            </div>

                            {(toolCount > 0 || promptCount > 0 || resourceCount > 0 || hasConnection) &&
                                <div className="server-body">
                                    {toolCount > 0 &&
                                        <div className="section">
                                            <span className="section-label">
                                                <i className="codicon codicon-tools"></i>
                                                Tools
                                                <span className="count">{toolCount}</span>
                                            </span>
                                            <div className="chip-list">
                                                {server.tools!.map((tool, i) => {
                                                    let parametersTxt = '';
                                                    if (tool.parameters?.properties) {
                                                        parametersTxt = Object.entries(tool.parameters.properties)
                                                            .map(([key, value]) => `${key}: ${value.description || 'No description'}`)
                                                            .join('\n');
                                                    }
                                                    return (
                                                        <span key={i}
                                                            className={`chip tool-chip ${tool.disabled ? 'disabled' : ''}`}
                                                            data-tooltip-id={`tool-${server.name}-${tool.name}`}>
                                                            {tool.name}
                                                            <ToolTip id={`tool-${server.name}-${tool.name}`} clickable>
                                                                <p className="tooltip-title">{tool.name}</p>
                                                                <p>{tool.description}</p>
                                                                {parametersTxt &&
                                                                    <div className="tooltip-params">
                                                                        <span>Parameters:</span>
                                                                        <pre>{parametersTxt}</pre>
                                                                    </div>}
                                                            </ToolTip>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>}

                                    {promptCount > 0 &&
                                        <div className="section">
                                            <span className="section-label">
                                                <i className="codicon codicon-comment-discussion"></i>
                                                Prompts
                                                <span className="count">{promptCount}</span>
                                            </span>
                                            <div className="chip-list">
                                                {prompts!.map((prompt, i) => (
                                                    <span key={i}
                                                        className="chip prompt-chip"
                                                        data-tooltip-id={`prompt-${server.name}-${prompt.name}`}>
                                                        {prompt.name}
                                                        <ToolTip id={`prompt-${server.name}-${prompt.name}`} clickable>
                                                            <p className="tooltip-title">{prompt.name}</p>
                                                            <p>{prompt.description}</p>
                                                            {prompt.arguments && prompt.arguments.length > 0 &&
                                                                <div className="tooltip-params">
                                                                    <span>Arguments:</span>
                                                                    <pre>{prompt.arguments.map(a =>
                                                                        `${a.name}${a.required ? ' (required)' : ''}: ${a.description}`
                                                                    ).join('\n')}</pre>
                                                                </div>}
                                                        </ToolTip>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>}

                                    {resourceCount > 0 &&
                                        <div className="section">
                                            <span className="section-label">
                                                <i className="codicon codicon-database"></i>
                                                Resources
                                                <span className="count">{resourceCount}</span>
                                            </span>
                                            <div className="chip-list">
                                                {resources!.map((resource, i) => (
                                                    <span key={i}
                                                        className="chip resource-chip"
                                                        data-tooltip-id={`resource-${server.name}-${resource.uri}`}>
                                                        {resource.name}
                                                        <ToolTip id={`resource-${server.name}-${resource.uri}`} clickable>
                                                            <p className="tooltip-title">{resource.name}</p>
                                                            <p>{resource.description}</p>
                                                            <div className="tooltip-meta">
                                                                <span>URI: {resource.uri}</span>
                                                                {resource.mimeType && <span>Type: {resource.mimeType}</span>}
                                                            </div>
                                                        </ToolTip>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>}

                                    {isMcp && hasConnection &&
                                        <EditableConnectionFields server={server} />}
                                </div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
