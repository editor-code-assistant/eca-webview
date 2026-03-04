import { useState } from 'react';
import { useSelector } from 'react-redux';
import { State } from '../../redux/store';
import { Task } from '../../protocol';
import './ChatTask.scss';

interface Props {
    chatId: string;
}

export function ChatTask({ chatId }: Props) {
    const [expanded, setExpanded] = useState(false);

    const taskState = useSelector((state: State) => state.chat.chats[chatId]?.taskState);
    const taskLoading = useSelector((state: State) => state.chat.chats[chatId]?.taskLoading);

    if (!taskState && !taskLoading) {
        return null;
    }

    const tasks = taskState?.tasks ?? [];
    const summary = taskState?.summary;
    const activeSummary = taskState?.activeSummary;

    const inProgressTask = tasks.find(t => t.status === 'in-progress');

    const doneCount = summary?.done ?? 0;
    const totalCount = summary?.total ?? 0;

    const labelPrefix = inProgressTask ? 'Task: ' : 'Tasks ';
    const labelText = activeSummary ?? (inProgressTask?.subject || '') ;

    const toggle = () => setExpanded(prev => !prev);

    return (
        <div className="chat-task">
            <div className="chat-task-header" onClick={toggle}>
                <i className={`codicon codicon-chevron-${expanded ? 'down' : 'right'} chat-task-chevron`} />
                {taskLoading ? (
                    <span className="chat-task-loading">Creating tasks…</span>
                ) : (
                    <>
                        <span className="chat-task-prefix">{labelPrefix}</span>
                        <span className={`chat-task-label ${inProgressTask ? 'in-progress' : ''}`}>
                            {labelText}
                        </span>
                        <span className="chat-task-progress">({doneCount}/{totalCount})</span>
                    </>
                )}
            </div>
            {expanded && tasks.length > 0 && (
                <div className="chat-task-list">
                    {tasks.map((task: Task) => (
                        <div
                            key={task.id}
                            className={`chat-task-item ${task.status}`}
                            title={task.description || task.subject}
                        >
                            <i className={`codicon ${task.status === 'done' ? 'codicon-pass-filled' : 'codicon-circle-large-outline'} chat-task-checkbox`} />
                            <span className="chat-task-subject">{task.subject}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
