import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { State } from '../../redux/store';
import { Task } from '../../protocol';
import { useBackgroundCollapse } from '../../hooks';
import './ChatTask.scss';

interface Props {
    chatId: string;
}

export function ChatTask({ chatId }: Props) {
    const [expanded, setExpanded] = useState(false);

    const taskState = useSelector((state: State) => state.chat.chats[chatId]?.taskState);
    const taskLoading = useSelector((state: State) => state.chat.chats[chatId]?.taskLoading);
    const cardRef = useRef<HTMLDivElement>(null);
    const collapse = () => setExpanded(false);
    const { onMouseDown, onMouseUp } = useBackgroundCollapse(expanded, collapse, cardRef);

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
        <div className="chat-task" ref={cardRef} data-collapsible onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
            <div className="chat-task-header" data-collapsible-header onClick={toggle}>
                <motion.i
                    className="codicon codicon-chevron-right chat-task-chevron"
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
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
            <AnimatePresence initial={false}>
                {expanded && tasks.length > 0 && (
                    <motion.div
                        className="chat-task-list"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, opacity: { duration: 0.15 } }}
                        style={{ overflow: "hidden" }}
                    >
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
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
