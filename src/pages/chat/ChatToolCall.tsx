import { memo, useRef, useState } from 'react';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackgroundCollapse, useKeyPressedListener } from '../../hooks';
import { FileChangeDetails, JsonOutputsDetails, SubagentDetails, ToolCallDetails, ToolCallOutput } from '../../protocol';
import { ChatMessage } from '../../redux/slices/chat';
import { EcaDispatch, useEcaDispatch } from '../../redux/store';
import { toolCallApprove, toolCallReject } from '../../redux/thunks/chat';
import { editorOpenFile } from '../../redux/thunks/editor';
import { ApprovalActions } from './ApprovalActions';
import { ChatSubagentToolCall } from './ChatSubagentToolCall';
import { ChatTime } from './ChatTime';
import './ChatToolCall.scss';
import { MarkdownContent } from './MarkdownContent';

interface Props {
    chatId: string,
    toolCallId: string,
    name: string,
    status: string,
    origin: string,
    argumentsText?: string,
    manualApproval: boolean,
    totalTimeMs?: number,
    outputs?: ToolCallOutput[],
    details?: ToolCallDetails,
    summary?: string,
    subagentMessages?: ChatMessage[],
    subagentChatId?: string,
    depth?: number,
}

function ToolCallCard({ props, iconClass, defaultOpen, headerContent, bodyContent, approvalComp }: {
    props: Props,
    iconClass: string,
    defaultOpen?: boolean,
    headerContent: React.ReactNode,
    bodyContent: React.ReactNode,
    approvalComp: React.ReactNode,
}) {
    const [expanded, setExpanded] = useState(defaultOpen ?? false);
    const cardRef = useRef<HTMLDivElement>(null);
    const collapse = () => setExpanded(false);
    const { onMouseDown, onMouseUp } = useBackgroundCollapse(expanded, collapse, cardRef);
    const isActive = props.status === 'preparing' || props.status === 'run' || props.status === 'running';

    const toggleExpanded = () => setExpanded(!expanded);

    return (
        <div className={`tool-call-card ${isActive ? 'active' : ''} ${props.status}`} ref={cardRef} data-collapsible onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
            <div className="tool-call-card-header" onClick={toggleExpanded} data-collapsible-header>
                <motion.i
                    className="chevron codicon codicon-chevron-right"
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
                {headerContent}
                <span className="spacing" />
                <i className={`tool-call-status codicon ${iconClass}`} />
            </div>

            <AnimatePresence initial={defaultOpen}>
                {expanded && (
                    <motion.div
                        className="tool-call-card-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, opacity: { duration: 0.15 } }}
                        style={{ overflow: "hidden" }}
                    >
                        {bodyContent}
                    </motion.div>
                )}
            </AnimatePresence>

            {approvalComp}
        </div>
    );
}

function GenericToolCallHeader({ props }: { props: Props }) {
    const originTxt = props.origin === 'mcp' ? 'MCP' : 'ECA';

    let verb: string;
    switch (props.status) {
        case 'preparing':
        case 'run':
            verb = 'Will call';
            break;
        case 'running':
            verb = 'Calling';
            break;
        case 'succeeded':
        case 'failed':
            verb = 'Called';
            break;
        case 'rejected':
            verb = 'Rejected';
            break;
        default:
            verb = 'Calling';
    }

    const description = props.summary || `${verb} ${originTxt} tool`;

    return (
        <>
            <span className="tool-call-description">{description}</span>
            {!props.summary && <span className="tool-call-name">{props.name}</span>}
            {props.totalTimeMs && <ChatTime ms={props.totalTimeMs} />}
        </>
    );
}

function GenericToolCallBody({ props }: { props: Props }) {
    const argsTxt = '```javascript\n' + props.argumentsText + '\n```';
    const showOutput = props.status === 'succeeded' || props.status === 'failed';

    return (
        <div>
            <p>Parameters:</p>
            <MarkdownContent codeClassName='args' content={argsTxt} />
            {showOutput && (
                <div>
                    <p>Result:</p>
                    {(props.outputs ?? []).filter(Boolean).map((output, index) => {
                        const outputTxt = output.text ? '```javascript\n' + output.text + '\n```' : 'Empty';
                        return (<MarkdownContent codeClassName='output' key={props.toolCallId + index} content={outputTxt} />);
                    })}
                </div>
            )}
        </div>
    );
}

function JsonOutputsBody({ props }: { props: Props }) {
    const details = props.details as JsonOutputsDetails;
    const argsTxt = '```javascript\n' + props.argumentsText + '\n```';

    return (
        <div>
            <p>Parameters:</p>
            <MarkdownContent codeClassName='args' content={argsTxt} />
            <p>Json output:</p>
            {(details.jsons ?? []).filter(Boolean).map((json, index) => {
                const outputTxt = '```javascript\n' + json + '\n```';
                return (<MarkdownContent codeClassName='output' key={props.toolCallId + index} content={outputTxt} />);
            })}
        </div>
    );
}

function FileChangeHeader({ props, dispatch }: { props: Props, dispatch: EcaDispatch }) {
    const { path, linesAdded, linesRemoved } = props.details as FileChangeDetails;
    const fileName = path.split('/').pop();

    const openFile = (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
        e.stopPropagation();
        dispatch(editorOpenFile({ path }));
    };

    return (
        <>
            <span className="file-change-name" onClick={openFile}>{fileName}</span>
            <span className="file-change-lines-added">+{linesAdded}</span>
            <span className="file-change-lines-removed">-{linesRemoved}</span>
            {props.totalTimeMs && <ChatTime ms={props.totalTimeMs} />}
        </>
    );
}

function FileChangeBody({ props }: { props: Props }) {
    const { path, diff } = props.details as FileChangeDetails;
    let fileDiffs;
    if (diff.startsWith('---')) {
        fileDiffs = parseDiff(diff);
    } else {
        fileDiffs = parseDiff('--- a/' + path + '\n+++ b/' + path + '\n' + diff);
    }

    return (
        <div>
            <span>Tool: </span>
            <span>{props.name}</span>
            {fileDiffs.map(({ oldRevision, newRevision, type, hunks }) => (
                <Diff key={oldRevision + '-' + newRevision} viewType="unified" gutterType='none' diffType={type} hunks={hunks}>
                    {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
                </Diff>
            ))}
        </div>
    );
}

function chatToolCall(props: Props) {
    const dispatch = useEcaDispatch();

    const waitingApproval = props.manualApproval && props.status === 'run';

    const rejectToolCall = () => {
        dispatch(toolCallReject({ chatId: props.chatId, toolCallId: props.toolCallId }));
    };

    const approveToolCall = () => {
        dispatch(toolCallApprove({ chatId: props.chatId, toolCallId: props.toolCallId }));
    };

    const approveToolCallAndRemember = () => {
        dispatch(toolCallApprove({ chatId: props.chatId, toolCallId: props.toolCallId, save: 'session' }));
    };

    useKeyPressedListener((e) => {
        if (!waitingApproval) return;

        const isEnter = e.key === 'Enter' && !e.shiftKey;
        const isShiftEnter = e.key === 'Enter' && e.shiftKey;
        const isEsc = e.key === 'Escape';

        if (isEnter) {
            e.preventDefault();
            approveToolCall();
            return;
        }

        if (isShiftEnter) {
            e.preventDefault();
            approveToolCallAndRemember();
            return;
        }

        if (isEsc) {
            e.preventDefault();
            rejectToolCall();
            return;
        }
    }, [waitingApproval]);

    let iconClass: string;
    switch (props.status) {
        case 'preparing':
        case 'run':
        case 'running':
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'succeeded':
            iconClass = 'codicon-check succeeded';
            break;
        case 'failed':
        case 'rejected':
            iconClass = 'codicon-error failed';
            break;
        default:
            iconClass = 'codicon-question';
    }

    const approvalComp = (
        <ApprovalActions
            waitingApproval={waitingApproval}
            onApprove={approveToolCall}
            onApproveAndRemember={approveToolCallAndRemember}
            onReject={rejectToolCall}
        />
    );

    // Subagent has its own card component
    if (props.details?.type === 'subagent') {
        return (
            <ChatSubagentToolCall
                chatId={props.chatId}
                toolCallId={props.toolCallId}
                name={props.name}
                status={props.status}
                argumentsText={props.argumentsText}
                manualApproval={props.manualApproval}
                totalTimeMs={props.totalTimeMs}
                outputs={props.outputs}
                details={props.details as SubagentDetails}
                summary={props.summary}
                subagentMessages={props.subagentMessages}
                subagentChatId={props.subagentChatId}
                depth={props.depth}
            />
        );
    }

    // File change card with diff
    if (props.details?.type === 'fileChange') {
        return (
            <ToolCallCard
                props={props}
                iconClass={iconClass}
                headerContent={<FileChangeHeader props={props} dispatch={dispatch} />}
                bodyContent={<FileChangeBody props={props} />}
                approvalComp={approvalComp}
            />
        );
    }

    // JSON outputs card
    if (props.details?.type === 'jsonOutputs') {
        return (
            <ToolCallCard
                props={props}
                iconClass={iconClass}
                headerContent={<GenericToolCallHeader props={props} />}
                bodyContent={<JsonOutputsBody props={props} />}
                approvalComp={approvalComp}
            />
        );
    }

    // Generic tool call card
    return (
        <ToolCallCard
            props={props}
            iconClass={iconClass}
            headerContent={<GenericToolCallHeader props={props} />}
            bodyContent={<GenericToolCallBody props={props} />}
            approvalComp={approvalComp}
        />
    );
}

const ChatToolCallMemo = memo((props: Props) => {
    return chatToolCall(props);
});

export function ChatToolCall(props: Props) {
    if (props.status === 'preparing') {
        return chatToolCall(props);
    }

    return (<div> <ChatToolCallMemo {...props} /> </div>);
}
