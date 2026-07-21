import { memo, useMemo, useState } from "react";
import { MarkdownContent } from "./MarkdownContent";
import './ChatTextMessage.scss';

interface Props {
    role: string,
    text: string,
    onRollbackClicked?: () => void;
    onAddFlagClicked?: () => void;
    showActions?: boolean;
}

/**
 * Preprocess user message text so it renders faithfully as markdown.
 *
 * Fixes two CommonMark behaviours that feel wrong for chat messages:
 * 1. Single newlines are "soft breaks" (rendered as spaces) — we convert
 *    them to hard breaks (trailing two-space + newline).
 * 2. Multiple consecutive blank lines collapse into one paragraph break —
 *    we insert `\u00A0` spacer paragraphs for the extra lines.
 *
 * Fenced code blocks are left untouched.
 */
function preprocessUserMessage(text: string): string {
    // Split around fenced code blocks (``` ... ```), process only prose parts
    const parts = text.split(/(^```[\s\S]*?^```)/m);

    return parts.map((part, i) => {
        // Odd indices are code blocks — leave them untouched
        if (i % 2 === 1) return part;

        // 1. Preserve extra blank lines (3+ consecutive newlines)
        let result = part.replace(/\n{3,}/g, (match) => {
            const extraBlanks = match.length - 2;
            return '\n\n' + '\u00A0\n\n'.repeat(extraBlanks);
        });

        // 2. Convert single newlines to hard breaks (two trailing spaces)
        //    but skip newlines that are part of paragraph breaks (\n\n)
        result = result.replace(/(?<!\n)\n(?!\n)/g, '  \n');

        return result;
    }).join('');
}

export const ChatTextMessage = memo(({ role, text, onRollbackClicked, onAddFlagClicked, showActions = true }: Props) => {
    const processedText = useMemo(() => role === 'user' ? preprocessUserMessage(text) : text, [role, text]);
    const [copied, setCopied] = useState(false);

    const onCopyClicked = () => {
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
            })
            .catch(err => console.error('Failed to copy message:', err));
    };

    if (role === 'system') {
        return (
            <div className="system-message">
                <span>{text}</span>
            </div>
        );
    }

    if (role === 'user') {
        return (
            <div className="user-message">
                <div className="user-message-card">
                    <div className="user-message-content">
                        <MarkdownContent content={processedText} />
                    </div>
                </div>
                {showActions && (
                    <div className="user-message-actions">
                        <button onClick={onCopyClicked} className="action-btn" title="Copy message">
                            <i className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`} />
                        </button>
                        {onAddFlagClicked && (
                            <button onClick={onAddFlagClicked} className="action-btn" title="Add flag after this message">
                                <i className="codicon codicon-bookmark" />
                            </button>
                        )}
                        <button onClick={onRollbackClicked} className="action-btn" title="Rollback to this message">
                            <i className="codicon codicon-discard" />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Assistant
    return (
        <div className="assistant-message">
            <MarkdownContent content={text} />
        </div>
    );
});
