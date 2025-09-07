import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface Props {
    content?: string,
    codeClassName?: string,
}

export function MarkdownContent({ content, codeClassName }: Props) {
    return (
        <Markdown
            remarkPlugins={[remarkGfm]}
            children={content}
            components={{
                code(props) {
                    const { children, className, node, ...rest } = props
                    const match = /language-(\w+)/.exec(className || '')
                    return match ? (
                        <SyntaxHighlighter
                            customStyle={{ scrollbarWidth: 'thin' }}
                            wrapLines={true}
                            wrapLongLines={true}
                            PreTag="div"
                            children={String(children).replace(/\n$/, '')}
                            language={match[1]}
                            style={dracula}
                        />
                    ) : (
                        <code {...rest} className={`${className} ${codeClassName ? codeClassName : ''}`}>
                            {children}
                        </code>
                    )
                }
            }}
        />
    );
}
