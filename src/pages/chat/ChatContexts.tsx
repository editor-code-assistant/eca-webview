import { memo, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { WorkspaceFolder } from "../../protocol";
import { addContext, ChatPreContext, CursorFocus, removeContext } from "../../redux/slices/chat";
import { State, useEcaDispatch } from "../../redux/store";
import { queryContext } from "../../redux/thunks/chat";
import { relativizeFromRoot } from "../../util";
import { ToolTip } from "../components/ToolTip";
import './ChatContexts.scss';

interface Props {
    chatId: string,
    enabled: boolean,
}

function absPathToFilename(path: string) {
    return path.split('/').pop() || path;
}

function contextLabel(context: ChatPreContext, cursorFocus: CursorFocus | undefined): string {
    switch (context.type) {
        case 'file':
            const path = absPathToFilename(context.path);
            if (context.linesRange) {
                return `${path} (${context.linesRange.start}-${context.linesRange.end})`;
            }
            return path;
        case 'directory':
            return context.path.split('/').pop() || context.path;
        case 'web':
            return context.url;
        case 'repoMap':
            return 'repoMap';
        case 'cursor':
            const filename = cursorFocus ? absPathToFilename(cursorFocus?.path) : '';
            const startLine = cursorFocus?.position.start.line;
            const startCharacter = cursorFocus?.position.start.character;

            return `cursor (${filename}:${startLine}:${startCharacter})`;
        case 'mcpResource':
            return context.server + ':' + context.name;
        default:
            return 'Unknown Context';
    }
}

function contextDescription(context: ChatPreContext, workspaceFolders: WorkspaceFolder[]): string {
    switch (context.type) {
        case 'file':
        case 'directory':
            return relativizeFromRoot(context.path, workspaceFolders) || context.path;
        case 'repoMap':
            return 'Summary view of workspaces files';
        case 'cursor':
            return 'Cursor path + position/selection';
        case 'mcpResource':
            return context.description;
        default:
            return '';
    }
}

function contextIcon(context: ChatPreContext): React.ReactNode {
    let icon = '';
    switch (context.type) {
        case 'file':
            icon = 'file';
            break;
        case 'directory':
            icon = 'folder';
            break;
        case 'web':
            icon = 'globe';
            break;
        case 'repoMap':
            icon = 'sparkle-filled';
            break;
        case 'cursor':
            icon = 'circle-filled';
            break;
        case 'mcpResource':
            icon = 'file-code';
            break;
        default:
            icon = 'question';
            break;
    }

    return (<i className={`context-icon ${context.type} codicon codicon-${icon}`}></i>);
}

export const ChatContexts = memo(({ chatId, enabled }: Props) => {
    const [query, setQuery] = useState('');
    const contexts = useSelector((state: State) => state.chat.contexts);
    const addedContexts = useSelector((state: State) => state.chat.chats[chatId].addedContexts);
    const workspaceFolders = useSelector((state: State) => state.server.workspaceFolders);
    const dispatch = useEcaDispatch();

    const cursorFocus = useSelector((state: State) => state.chat.cursorFocus);

    useEffect(() => {
        dispatch(queryContext({
            chatId,
            query: query,
            contexts: addedContexts
        }));
    }, [query, addedContexts]);

    const onInputQueryChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    }

    const onContextAdded = (context: ChatPreContext) => {
        dispatch(addContext(context));
    }

    const onContextRemoved = (context: ChatPreContext) => {
        dispatch(removeContext(context));
    }

    return (
        <div className="contexts">
            <button disabled={!enabled} data-tooltip-id="add-context" className="add">@{addedContexts.length === 0 ? " Add context" : ""}</button>
            {enabled && addedContexts.map((context, index) => (
                <span onClick={() => onContextRemoved(context)} key={index} className="added-context">
                    {contextIcon(context)}
                    {contextLabel(context, cursorFocus)}
                </span>
            ))}
            <ToolTip id="add-context"
                delayHide={5}
                delayShow={5}
                globalCloseEvents={{ escape: true, clickOutsideAnchor: true }}
                openOnClick
                className="scrollable"
                clickable
                place="top-start">
                <div className="add-context-container">
                    <input autoFocus value={query} onChange={onInputQueryChanged} type="text" placeholder="Add files, folders..." />
                    {!contexts && (
                        <div className="loading">
                            <i className="codicon codicon-loading codicon-modifier-spin"></i>
                        </div>
                    )}

                    {contexts && contexts.length > 0 && (
                        <ul className="context-list">
                            {contexts.map((context, index) => (
                                <li onClick={() => onContextAdded(context)} key={index} className="context-item">
                                    {contextIcon(context)}
                                    <span className="label">{contextLabel(context, cursorFocus)}</span>
                                    <span className="description">{contextDescription(context, workspaceFolders)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            </ToolTip>
        </div>
    );
});
