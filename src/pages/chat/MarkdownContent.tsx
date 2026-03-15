import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { webviewSend } from '../../hooks';

interface Props {
    content?: string,
    codeClassName?: string,
}

export function MarkdownContent({ content, codeClassName }: Props) {
    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            e.preventDefault();
            webviewSend('editor/openUrl', { url: href });
        }
    };

    return (
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
    );
}
