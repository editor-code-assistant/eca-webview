import { memo } from 'react';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { FileChangeDetails, JsonOutputsDetails, ToolCallDetails, ToolCallOutput } from '../../protocol';
import { EcaDispatch, useEcaDispatch } from '../../redux/store';
import { toolCallApprove, toolCallReject } from '../../redux/thunks/chat';
import { editorOpenFile } from '../../redux/thunks/editor';
import { ChatCollapsableMessage } from './ChatCollapsableMessage';
import { ChatTime } from './ChatTime';
import './ChatToolCall.scss';
import { MarkdownContent } from './MarkdownContent';

function baseToolCall(
    { name, summary, status, origin, argumentsText, totalTimeMs }: Props,
    iconClass: string,
    approvalComp: React.ReactNode,
    outputCompFn: () => React.ReactNode,
) {
    const argsTxt = '```javascript\n' + argumentsText + '\n```';

    const originTxt = origin === 'mcp' ? 'MCP' : 'ECA';
    const showOutput = status === 'succeeded' || status === 'failed';

    let verb: string;
    switch (status) {
        case 'preparing':
            verb = 'Will call';
            break;
        case 'run':
            verb = 'Will call';
            break;
        case 'running':
            verb = 'Calling';
            break;
        case 'succeeded':
            verb = 'Called';
            break;
        case 'failed':
            verb = 'Called';
            break;
        case 'rejected':
            verb = 'Rejected';
            break;
        default:
            verb = 'Calling';
    }

    const description = summary || `${verb} ${originTxt} tool`;

    return (
        <div className="tool-call-wrapper">
            <ChatCollapsableMessage
                className="tool-call"
                header={(toggleOpen) => (
                    <div className="header-content">
                        <span onClick={toggleOpen} className="description">{description}</span>
                        {!summary &&
                            <span onClick={toggleOpen} className="name">{name}</span>}
                        {totalTimeMs && <ChatTime ms={totalTimeMs} />}
                        <span onClick={toggleOpen} className="spacing"></span>
                        <i onClick={toggleOpen} className={`status codicon ${iconClass}`}></i>
                    </div>
                )}
                content={
                    <div style={{ display: 'inline' }}>
                        <p>Parameters:</p>
                        <MarkdownContent codeClassName='args' content={argsTxt} />
                        {showOutput && outputCompFn()}
                    </div>
                }
            />
            {approvalComp}
        </div>
    );
}

function genericToolCall(
    props: Props,
    iconClass: string,
    approvalComp: React.ReactNode,
) {
    return baseToolCall(props, iconClass, approvalComp, () => (
        <div>
            <p>Result:</p>
            {props.outputs!.map((output, index) => {
                const outputTxt = output.text ? '```javascript\n' + output.text + '\n```' : 'Empty';
                return (<MarkdownContent codeClassName='output' key={props.toolCallId + index} content={outputTxt} />)
            })}
        </div>
    ));
}

function jsonOutputsToolCall(
    props: Props,
    iconClass: string,
    approvalComp: React.ReactNode,
) {
    const details = props.details as JsonOutputsDetails;
    return baseToolCall(props, iconClass, approvalComp, () => (
        <div>
            <p>Json output:</p>
            {details.jsons.map((json, index) => {
                const outputTxt = '```javascript\n' + json + '\n```';
                return (<MarkdownContent codeClassName='output' key={props.toolCallId + index} content={outputTxt} />)
            })}
        </div>
    ));
}

function fileChangeToolCall({ name, details }: Props, iconClass: string, approvalComp: React.ReactNode, dispatch: EcaDispatch, totalTimeMs?: number) {
    const { path, diff, linesAdded, linesRemoved } = details as FileChangeDetails;
    const fileDiffs = parseDiff('--- a/' + path + '\n+++ b/' + path + '\n' + diff);
    const fileName = path.split('/').pop();

    const openFile = (_event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
        dispatch(editorOpenFile({ path }));
    }

    return (
        <div className="tool-call-wrapper">
            <ChatCollapsableMessage
                className="tool-call"
                defaultOpen={true}
                header={(toggleOpen) => (
                    <div className="header-content">
                        <span onClick={openFile} className="file-change-name">{fileName}</span>
                        <span onClick={toggleOpen} className="file-change-lines-added">+{linesAdded}</span>
                        <span onClick={toggleOpen} className="file-change-lines-removed">-{linesRemoved}</span>
                        {totalTimeMs && <ChatTime ms={totalTimeMs} />}
                        <span onClick={toggleOpen} className="spacing"></span>
                        <i onClick={toggleOpen} className={`status codicon ${iconClass}`}></i>
                    </div>
                )}
                content={
                    <div>
                        <span>Tool: </span>
                        <span>{name}</span>
                        {fileDiffs.map(({ oldRevision, newRevision, type, hunks }) => {
                            return (
                                <Diff key={oldRevision + '-' + newRevision} viewType="unified" gutterType='none' diffType={type} hunks={hunks}>
                                    {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
                                </Diff>
                            );
                        })}
                    </div>
                }
            />
            {approvalComp}
        </div>
    );
}


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
}

function chatToolCall(props: Props) {
    const dispatch = useEcaDispatch();

    const waitingApproval = props.manualApproval && props.status === 'run';

    const rejectToolCall = (_: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(toolCallReject({ chatId: props.chatId, toolCallId: props.toolCallId }));
    }

    const approveToolCall = (_: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(toolCallApprove({ chatId: props.chatId, toolCallId: props.toolCallId }));
    }

    const approveToolCallAndRemember = (_: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(toolCallApprove({ chatId: props.chatId, toolCallId: props.toolCallId, save: 'session' }));
    }

    let iconClass: string;
    switch (props.status) {
        case 'preparing':
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'run':
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'running':
            iconClass = 'codicon-loading codicon-modifier-spin';
            break;
        case 'succeeded':
            iconClass = 'codicon-check succeeded';
            break;
        case 'failed':
            iconClass = 'codicon-error failed';
            break;
        case 'rejected':
            iconClass = 'codicon-error failed';
            break;
        default:
            iconClass = 'codicon-question';
    }

    const approvalComp = waitingApproval && (
        <div className="approval-actions">
            <div className="approval-option">
                <button onClick={approveToolCall} className="approve-btn">Accept</button>
                <span className="approval-description">for this session</span>
            </div>
            <div className="approval-option">
                <button onClick={approveToolCallAndRemember} className="approve-remember-btn">Accept and remember</button>
                <span className="approval-description">for this session</span>
            </div>
            <div className="approval-option">
                <button onClick={rejectToolCall} className="reject-btn">Reject</button>
                <span className="approval-description">and tell ECA what to do differently</span>
            </div>
        </div>
    )

    switch (props.details?.type) {
        case 'fileChange':
            return fileChangeToolCall(props, iconClass, approvalComp, dispatch);
        case 'jsonOutputs':
            return jsonOutputsToolCall(props, iconClass, approvalComp);
        default:
            return genericToolCall(props, iconClass, approvalComp);
    }
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
