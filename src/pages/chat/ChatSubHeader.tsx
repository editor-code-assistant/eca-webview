import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { ChatMessage, clearChat } from '../../redux/slices/chat';
import { selectRunningJobCount } from '../../redux/slices/jobs';
import { setTrust } from '../../redux/slices/server';
import { State, useEcaDispatch } from '../../redux/store';
import { ToolTip } from '../components/ToolTip';
import './ChatSubHeader.scss';
import { webviewSend } from '../../hooks';
import { ChatTimeline } from './ChatTimeline';

function formatNumber(n: number): string {
    if (n >= 1_000_000) {
        const val = n / 1_000_000;
        return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
    }
    if (n >= 1_000) {
        const val = n / 1_000;
        return val % 1 === 0 ? `${val}k` : `${parseFloat(val.toFixed(1))}k`;
    }
    return n.toString();
}

function messagesToMarkdown(messages: ChatMessage[]): string {
    const parts: string[] = [];

    for (const msg of messages) {
        switch (msg.type) {
            case 'text': {
                const roleLabel = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
                parts.push(`## ${roleLabel}\n\n${msg.value}`);
                break;
            }
            case 'toolCall': {
                parts.push(`### Tool Call: ${msg.name} (${msg.status})\n`);
                if (msg.argumentsText) {
                    parts.push(`\`\`\`json\n${msg.argumentsText}\n\`\`\``);
                }
                if (msg.summary) {
                    parts.push(`**Summary:** ${msg.summary}`);
                }
                if (msg.outputs && msg.outputs.length > 0) {
                    parts.push(`**Output:**\n\`\`\`\n${msg.outputs.map(o => o.text).join('\n')}\n\`\`\``);
                }
                if (msg.subagentMessages && msg.subagentMessages.length > 0) {
                    parts.push(`#### Subagent Messages\n\n${messagesToMarkdown(msg.subagentMessages)}`);
                }
                break;
            }
            case 'reason': {
                if (msg.content) {
                    parts.push(`### Thinking\n\n${msg.content}`);
                }
                break;
            }
            case 'hook': {
                parts.push(`### Hook: ${msg.name} (${msg.status})`);
                if (msg.output) {
                    parts.push(`\`\`\`\n${msg.output}\n\`\`\``);
                }
                if (msg.error) {
                    parts.push(`**Error:** ${msg.error}`);
                }
                break;
            }
            case 'flag': {
                parts.push(`---\n\n🚩 **${msg.text}**\n\n---`);
                break;
            }
        }
    }

    return parts.join('\n\n');
}

interface Props {
    chatId: string,
}

export function ChatSubHeader({ chatId }: Props) {
    const dispatch = useEcaDispatch();
    const navigate = useNavigate();
    const trust = useSelector((state: State) => state.server.trust);

    const toggleTrust = () => {
        const newTrust = !trust;
        dispatch(setTrust(newTrust));
        webviewSend('server/setTrust', newTrust);
        if (chatId && chatId !== 'EMPTY') {
            webviewSend('chat/update', { chatId, trust: newTrust });
        }
    };

    const clearHistoryChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(clearChat({ chatId: chatId }));
        webviewSend('chat/clearChat', { chatId: chatId });
    }

    const openSettings = () => {
        navigate(ROUTES.SETTINGS);
    }

    const chat = useSelector((state: State) => state.chat.chats[chatId]);

    const exportChat = () => {
        if (!chat || chat.messages.length === 0) return;
        const title = chat.title || 'Chat Export';
        const markdown = `# ${title}\n\n${messagesToMarkdown(chat.messages)}`;
        const defaultName = `${title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase()}.md`;
        webviewSend('editor/saveFile', { content: markdown, defaultName });
    }

    const allServers = useSelector((state: State) => state.mcp.servers);
    const mcpServers = useMemo(() => allServers.filter((server) => server.type === 'mcp'), [allServers]);
    const runningJobCount = useSelector(selectRunningJobCount);

    const usage = useSelector((state: State) => state.chat.chats[chatId].usage);
    const usageStringFormat = useSelector((state: State) => state.server.config.usageStringFormat);

    let usageString;
    if (usage && usageStringFormat) {
        usageString = usageStringFormat
            .replace('{sessionTokens}', formatNumber(usage.sessionTokens))
            .replace('{contextLimit}', usage.limit?.context != null ? formatNumber(usage.limit.context) : '')
            .replace('{outputLimit}', usage.limit?.output != null ? formatNumber(usage.limit.output) : '')
            .replace('{lastMessageCost}', usage.lastMessageCost ? `$${usage.lastMessageCost}` : '')
            .replace('{sessionCost}', usage.sessionCost ? `$${usage.sessionCost}` : '');
    }

    let failed = 0;
    let starting = 0;
    let running = 0;

    mcpServers.forEach((mcp: any) => {
        switch (mcp.status) {
            case 'failed':
                failed++;
                break;
            case 'starting':
                starting++;
                break;
            case 'running':
                running++;
                break;
        }
    });

    return (
        <div className="chat-subheader">
            <div className="details">
                <div data-tooltip-id="details-mcps" onClick={() => navigate(ROUTES.SETTINGS)} className="mcps">
                    <span>MCPs </span>
                    {failed > 0 &&
                        <span className="failed">{failed}</span>}
                    {(failed > 0 && (starting > 0 || running > 0)) &&
                        <span>/</span>}
                    {starting > 0 &&
                        <span className="starting">{starting}</span>}
                    {(starting > 0 && running > 0) &&
                        <span>/</span>}
                    {running > 0 &&
                        <span className="running">{running}</span>}
                </div>
                <ToolTip id="details-mcps" className="details-tooltip">
                    <p>Failed: {failed}</p>
                    <p>Starting: {starting}</p>
                    <p>Running: {running}</p>
                    <p>Click for more details.</p>
                </ToolTip>
                {runningJobCount > 0 && (
                    <div className="bg-jobs" onClick={() => navigate(ROUTES.SETTINGS, { state: { tab: 'jobs' } })}>
                        <span>{runningJobCount} {runningJobCount === 1 ? 'job' : 'jobs'}</span>
                    </div>
                )}
                {usageString && (
                    <div>
                        <div data-tooltip-id="details-usage" className="usage">
                            <span>{usageString}</span>
                        </div>
                        {usage && (
                            <ToolTip id="details-usage" className="details-tooltip">
                                <p>Session tokens: {usage.sessionTokens.toLocaleString()}</p>
                                <p>Last message cost: ${usage.lastMessageCost}</p>
                                <p>Session cost: ${usage.sessionCost}</p>
                                <p>Context limit: {usage.limit?.context?.toLocaleString()}</p>
                                <p>Output limit: {usage.limit?.output?.toLocaleString()}</p>
                            </ToolTip>
                        )}
                    </div>
                )}
            </div>
            <div className="actions">
                <div className="action trust-toggle">
                    <i
                        onClick={toggleTrust}
                        className={`codicon ${trust ? 'codicon-workspace-trusted trust-on' : 'codicon-workspace-untrusted trust-off'}`}
                        title={trust ? 'Trust ON - auto-accepting tool calls' : 'Trust OFF - not auto-accepting tool calls'}
                    ></i>
                </div>
                <div className="action"><ChatTimeline chatId={chatId} /></div>
                <div className="action"><i onClick={exportChat} className="codicon codicon-export" title="Export chat to Markdown"></i></div>
                <div className="action"><i onClick={clearHistoryChat} className="codicon codicon-trash" title="Clear chat messages"></i></div>
                <div className="action"><i onClick={openSettings} className="codicon codicon-settings-gear" title="Settings"></i></div>
            </div>
        </div>
    );
}
