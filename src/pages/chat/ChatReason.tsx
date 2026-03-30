import { memo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import './ChatReason.scss';
import { useBackgroundCollapse } from '../../hooks';
import { ChatTime } from "./ChatTime";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
    id: string,
    status: string,
    content?: string,
    totalTimeMs?: number,
}

function chatReason({ id, status, content, totalTimeMs }: Props) {
    const [expanded, setExpanded] = useState(false);
    const isDone = status === 'done';
    const label = isDone ? 'Thought' : 'Thinking';
    const iconClass = isDone ? 'codicon-sparkle' : 'codicon-loading codicon-modifier-spin';

    const toggleExpanded = () => {
        if (content) setExpanded(!expanded);
    };

    const cardRef = useRef<HTMLDivElement>(null);
    const collapse = () => setExpanded(false);
    const { onMouseDown, onMouseUp } = useBackgroundCollapse(expanded, collapse, cardRef);

    return (
        <div className={`reason-card ${isDone ? 'done' : 'active'}`} ref={cardRef} data-collapsible onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
            <div className="reason-card-header" data-collapsible-header onClick={toggleExpanded}>
                {content && (
                    <motion.i
                        className="chevron codicon codicon-chevron-right"
                        animate={{ rotate: expanded ? 90 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                )}
                <i className={`reason-icon codicon ${iconClass}`} />
                <span className="reason-label">{label}</span>
                {totalTimeMs && <ChatTime ms={totalTimeMs} />}
            </div>

            <AnimatePresence initial={false}>
                {expanded && content && (
                    <motion.div
                        className="reason-card-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, opacity: { duration: 0.15 } }}
                        style={{ overflow: "hidden" }}
                    >
                        <MarkdownContent content={content} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const ChatReasonMemo = memo((props: Props) => {
    return chatReason(props);
});

export function ChatReason(props: Props) {
    if (props.status !== 'done') {
        return chatReason(props);
    }

    return (<div> <ChatReasonMemo {...props} /> </div>);
}
