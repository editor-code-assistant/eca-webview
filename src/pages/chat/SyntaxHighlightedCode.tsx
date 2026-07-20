import { PrismAsyncLight } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SyntaxHighlightedCodeProps {
    language: string;
    source: string;
}

export default function SyntaxHighlightedCode({ language, source }: SyntaxHighlightedCodeProps) {
    return (
        <PrismAsyncLight
            className="syntax-highlighter"
            customStyle={{ scrollbarWidth: 'thin' }}
            wrapLines
            wrapLongLines
            PreTag="div"
            language={language}
            style={dracula}
        >
            {source}
        </PrismAsyncLight>
    );
}
