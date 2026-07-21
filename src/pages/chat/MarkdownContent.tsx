import { memo, useDeferredValue } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { webviewSend } from '../../hooks';
import { MarkdownErrorFallback, captureComponentStack } from '../components/ErrorFallback';

interface Props {
    content?: string,
    codeClassName?: string,
}

/**
 * Inner renderer, memoized. react-markdown re-parses the WHOLE string and
 * Prism re-highlights every code block on each render — for a message
 * holding a ~2000-line code block that costs ~800ms. During streaming the
 * chat re-renders ~30x/s, so without the memo every markdown surface in
 * the conversation would redo that work per batch, saturating the main
 * thread and starving user input (the Stop button, eca-webview issue #18).
 */
const MarkdownRenderer = memo(function MarkdownRenderer({ content, codeClassName }: Props) {
    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
        e.preventDefault();
        // Only http(s) goes to the OS browser; anything else (file://,
        // C:\..., relative paths a model may emit) must not navigate the
        // webview shell itself.
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
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
                    const isBlock = node?.position && String(children).includes('\n');

                    if (match) {
                        return (
                            <SyntaxHighlighter
                                customStyle={{ scrollbarWidth: 'thin' }}
                                wrapLines={true}
                                wrapLongLines={true}
                                PreTag="div"
                                children={String(children).replace(/\n$/, '')}
                                language={match[1]}
                                style={dracula}
                            />
                        );
                    }

                    if (isBlock) {
                        return (
                            <SyntaxHighlighter
                                customStyle={{ scrollbarWidth: 'thin' }}
                                wrapLines={true}
                                wrapLongLines={true}
                                PreTag="div"
                                children={String(children).replace(/\n$/, '')}
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
                            onClick={(e) => handleLinkClick(e, href)}
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
});

/**
 * Public markdown surface.
 *
 * `useDeferredValue` decouples the expensive parse from urgent updates:
 * when actively-streaming content changes, the urgent pass re-renders with
 * the PREVIOUS string (hitting MarkdownRenderer's memo, ~free) and the
 * parse of the new string runs in a deferred, interruptible render. Clicks
 * and other input are processed in between, so a fast reasoning/token
 * stream can no longer freeze the webview (issue #18). Successive deltas
 * arriving faster than the parse simply supersede the deferred render —
 * natural throttling to whatever the machine can afford.
 */
export const MarkdownContent = memo(function MarkdownContent({ content, codeClassName }: Props) {
    const deferredContent = useDeferredValue(content);
    return <MarkdownRenderer content={deferredContent} codeClassName={codeClassName} />;
});
