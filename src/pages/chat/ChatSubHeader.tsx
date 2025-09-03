import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { clearChat } from '../../redux/slices/chat';
import { State, useEcaDispatch } from '../../redux/store';
import { ToolTip } from '../components/ToolTip';
import './ChatSubHeader.scss';

interface Props {
    chatId: string,
}

export function ChatSubHeader({ chatId }: Props) {
    const dispatch = useEcaDispatch();
    const navigate = useNavigate();

    const clearHistoryChat = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(clearChat({ chatId: chatId }));
    }

    const mcpServers = useSelector((state: State) => state.mcp.servers.filter((server) => server.type === 'mcp'));

    const usage = useSelector((state: State) => state.chat.chats[chatId].usage);
    const usageStringFormat = useSelector((state: State) => state.server.config.usageStringFormat);

    let usageString;
    if (usage && usageStringFormat) {
        usageString = usageStringFormat
            .replace('{sessionTokens}', usage.sessionTokens.toString())
            .replace('{contextLimit}', usage.limit?.context?.toString() || '')
            .replace('{outputLimit}', usage.limit?.output?.toString() || '')
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
                <div data-tooltip-id="details-mcps" onClick={() => navigate(ROUTES.MCP_DETAILS)} className="mcps">
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
                {usageString && (
                    <div>
                        <div data-tooltip-id="details-usage" className="usage">
                            <span>{usageString}</span>
                        </div>
                        {usage && (
                            <ToolTip id="details-usage" className="details-tooltip">
                                <p>Session tokens: {usage.sessionTokens}</p>
                                <p>Last message cost: ${usage.lastMessageCost}</p>
                                <p>Session cost: ${usage.sessionCost}</p>
                                <p>Context limit: ${usage.limit?.context}</p>
                                <p>Output limit: ${usage.limit?.output}</p>
                            </ToolTip>
                        )}
                    </div>
                )}
            </div>
            <div className="actions">
                <div className="action"><i onClick={clearHistoryChat} className="codicon codicon-trash"></i></div>
            </div>
        </div>
    );
}
