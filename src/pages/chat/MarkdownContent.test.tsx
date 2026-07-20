import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

const syntaxModuleLoaded = vi.hoisted(() => vi.fn());

vi.mock('./SyntaxHighlightedCode', () => {
    syntaxModuleLoaded();

    return {
        default: ({ source }: { source: string }) => (
            <pre className="syntax-highlighter"><code>{source}</code></pre>
        ),
    };
});

describe('MarkdownContent', () => {
    it('renders inline markdown without loading syntax highlighting', () => {
        const { container } = render(<MarkdownContent content="Hello **world** and `inline`" />);

        expect(screen.getByText('world')).toHaveProperty('tagName', 'STRONG');
        expect(screen.getByText('inline')).toHaveClass('inline-code');
        expect(container.querySelector('.syntax-highlighter')).not.toBeInTheDocument();
        expect(syntaxModuleLoaded).not.toHaveBeenCalled();
    });

    it('loads syntax highlighting only for fenced code blocks', async () => {
        const { container } = render(
            <MarkdownContent content={'```javascript\nconst answer = 42;\n```'} />,
        );

        await waitFor(() => {
            expect(syntaxModuleLoaded).toHaveBeenCalledOnce();
            expect(container.querySelector('.syntax-highlighter')).toBeInTheDocument();
        });
        expect(container).toHaveTextContent('const answer = 42;');
    });
});
