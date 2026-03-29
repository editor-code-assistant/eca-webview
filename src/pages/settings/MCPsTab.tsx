import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { MCPServerUpdatedParams, ToolServerUpdatedParams, ToolServerStatus } from '../../protocol';
import { State, useEcaDispatch } from '../../redux/store';
import { connectServer, disableServer, enableServer, logoutServer, startServer, stopServer, updateServer } from '../../redux/thunks/mcp';
import { openServerLogs } from '../../redux/thunks/server';
import { Toggle } from '../components/Toggle';
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

export function MCPsTab() {
    const mcpServers = useSelector((state: State) => state.mcp.servers);
    const dispatch = useEcaDispatch();

    const changeServerStatus = (enabled: boolean, server: ToolServerUpdatedParams) => {
        if (enabled) {
            dispatch(startServer({ name: server.name }));
        } else {
            dispatch(stopServer({ name: server.name }));
        }
    };

    const anyFailed = mcpServers.some(s => s.status === 'failed');

    const onOpenServerLogs = (_: any) => {
        dispatch(openServerLogs({}));
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

            {mcpServers.length === 0 &&
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
                                            : <Toggle
                                                defaultChecked={stoppable}
                                                onChange={(enabled) => changeServerStatus(enabled, server)} />}
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
                                                            <ToolTip id={`tool-${server.name}-${tool.name}`}>
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
                                                        <ToolTip id={`prompt-${server.name}-${prompt.name}`}>
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
                                                        <ToolTip id={`resource-${server.name}-${resource.uri}`}>
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
