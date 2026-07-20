import { ErrorBoundary } from 'react-error-boundary';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { webviewSend } from '../../hooks';
import { captureComponentStack } from '../../errorReporting';
import { MarkdownErrorFallback } from '../components/ErrorFallback';

interface Props {
    content?: string,
    codeClassName?: string,
}

function textContent(node: ReactNode): string | null {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (!Array.isArray(node)) return null;

    const parts = node.map(textContent);
    return parts.every((part): part is string => part !== null) ? parts.join('') : null;
}

export function MarkdownContent({ content, codeClassName }: Props) {
    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            e.preventDefault();
            webviewSend('editor/openUrl', { url: href });
        }
    };

    return (
        <ErrorBoundary FallbackComponent={MarkdownErrorFallback} onError={captureComponentStack}>
        <Markdown
            remarkPlugins={[remarkGfm]}
            children={content}
            components={{
                code(props) {
                    const { children, className, node, ...rest } = props
                    const match = /language-(\w+)/.exec(className || '')
                    const source = textContent(children);
                    const isBlock = Boolean(node?.position && source?.includes('\n'));

                    if (match && source !== null) {
                        return (
                            <SyntaxHighlighter
                                customStyle={{ scrollbarWidth: 'thin' }}
                                wrapLines={true}
                                wrapLongLines={true}
                                PreTag="div"
                                children={source.replace(/\n$/, '')}
                                language={match[1]}
                                style={dracula}
                            />
                        );
                    }

                    if (isBlock && source !== null) {
                        return (
                            <SyntaxHighlighter
                                customStyle={{ scrollbarWidth: 'thin' }}
                                wrapLines={true}
                                wrapLongLines={true}
                                PreTag="div"
                                children={source.replace(/\n$/, '')}
                                language={'text'}
                                style={dracula}
                            />
                        );
                    }

                    return (
                        <code {...rest} className={`inline-code ${className ?? ''} ${codeClassName ?? ''}`}>
                            {children}
                        </code>
                    );
                },
                a(props) {
                    const { href, children, ...rest } = props;
                    return (
                        <a
                            {...rest}
                            href={href}
                            onClick={(e) => { handleLinkClick(e, href); }}
                        >
                            {children}
                        </a>
                    );
                },
                table(props) {
                    const { children, ...rest } = props;
                    return (
                        <div className="table-wrapper scrollable">
                            <table {...rest}>{children}</table>
                        </div>
                    );
                }
            }}
        />
        </ErrorBoundary>
    );
}
