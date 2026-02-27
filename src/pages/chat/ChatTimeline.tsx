import { memo, useState } from 'react';
import { useSelector } from 'react-redux';
import { State } from '../../redux/store';
import './ChatTimeline.scss';

interface Props {
    chatId: string;
}

function formatTimestamp(ts: number): string {
    const date = new Date(ts);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

function truncate(text: string, maxLen: number): string {
    const singleLine = text.replace(/\n/g, ' ').trim();
    if (singleLine.length <= maxLen) return singleLine;
    return singleLine.slice(0, maxLen) + '…';
}

export const ChatTimeline = memo(({ chatId }: Props) => {
    const [open, setOpen] = useState(false);
    const messages = useSelector((state: State) => state.chat.chats[chatId]?.messages || []);

    const userMessages = messages
        .map((msg, index) => ({ msg, index }))
        .filter(({ msg }) => msg.type === 'text' && msg.role === 'user');

    if (userMessages.length === 0) return null;

    const scrollToMessage = (index: number) => {
        const container = document.querySelector('.messages-container');
        if (!container) return;
        const children = container.children;
        if (index < children.length) {
            children[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setOpen(false);
    };

    return (
        <div className="chat-timeline">
            <i
                className="codicon codicon-list-flat"
                title="Chat timeline"
                onClick={() => setOpen(!open)}
            ></i>
            {open && (
                <div className="timeline-dropdown">
                    <div className="timeline-header">Timeline</div>
                    <ul className="timeline-list scrollable">
                        {userMessages.map(({ msg, index }, i) => {
                            const textMsg = msg as { type: 'text'; role: string; value: string; timestamp?: number };
                            return (
                                <li
                                    key={i}
                                    className="timeline-item"
                                    onClick={() => scrollToMessage(index)}
                                >
                                    <span className="timeline-time">
                                        {textMsg.timestamp ? formatTimestamp(textMsg.timestamp) : '—'}
                                    </span>
                                    <span className="timeline-text">
                                        {truncate(textMsg.value, 60)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
});
