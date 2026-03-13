import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { ToolServerUpdatedParams, ToolServerStatus } from '../../protocol';
import { State, useEcaDispatch } from '../../redux/store';
import { connectServer, logoutServer, startServer, stopServer } from '../../redux/thunks/mcp';
import { Toggle } from '../components/Toggle';
import { ToolTip } from '../components/ToolTip';
import './MCPDetails.scss';
import { openServerLogs } from '../../redux/thunks/server';

const statusLabel: Record<ToolServerStatus, string> = {
    'running': 'Running',
    'starting': 'Starting',
    'stopped': 'Stopped',
    'failed': 'Failed',
    'disabled': 'Disabled',
    'requires-auth': 'Requires auth',
};

export function MCPDetails() {
    const mcpServers = useSelector((state: State) => state.mcp.servers);
    const navigate = useNavigate();
    const dispatch = useEcaDispatch();

    const changeServerStatus = (enabled: boolean, server: ToolServerUpdatedParams) => {
        if (enabled) {
            dispatch(startServer({ name: server.name }));
        } else {
            dispatch(stopServer({ name: server.name }));
        }
    }

    const anyFailed = mcpServers.some(s => s.status === 'failed');

    const onOpenServerLogs = (_: any) => {
        dispatch(openServerLogs({}));
    };

    return (
        <div className="mcp-details-container scrollable">
            <div className="page-header">
                <button onClick={() => navigate(ROUTES.CHAT)} className="back-button">
                    <i className="codicon codicon-arrow-left"></i>
                </button>
                <h2 className="page-title">MCP Servers</h2>
            </div>

            <p className="page-description">
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
                    const isRemote = server.type === 'mcp' && !!server.url;
                    let commandTxt;
                    if (server.type === 'mcp' && !isRemote && server.command) {
                        commandTxt = server.command + " " + (server.args?.join(" ") || "");
                    }

                    const stoppable = server.status === 'running' || server.status === 'starting';
                    const failed = server.status === 'failed';
                    const requiresAuth = server.status === 'requires-auth';
                    const hasAuth = server.type === 'mcp' && server.hasAuth;
                    const prompts = server.type === 'mcp' ? server.prompts : undefined;
                    const resources = server.type === 'mcp' ? server.resources : undefined;
                    const toolCount = server.tools?.length ?? 0;
                    const promptCount = prompts?.length ?? 0;
                    const resourceCount = resources?.length ?? 0;

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
                                    {requiresAuth
                                        ? <button className="action-btn connect-btn"
                                            onClick={() => dispatch(connectServer({ name: server.name }))}>
                                            <i className="codicon codicon-plug"></i>
                                            Connect
                                          </button>
                                        : <Toggle
                                            defaultChecked={stoppable}
                                            onChange={(enabled) => changeServerStatus(enabled, server)} />}
                                </div>
                            </div>

                            {(toolCount > 0 || promptCount > 0 || resourceCount > 0 || commandTxt) &&
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

                                    {commandTxt &&
                                        <div className="section command-section">
                                            <span className="section-label">
                                                <i className="codicon codicon-terminal"></i>
                                                Command
                                            </span>
                                            <code className="command-text">{commandTxt}</code>
                                        </div>}
                                </div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
