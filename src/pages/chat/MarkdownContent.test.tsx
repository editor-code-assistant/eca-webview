import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
    it('renders inline markdown without loading syntax highlighting', () => {
        const { container } = render(<MarkdownContent content="Hello **world** and `inline`" />);

        expect(screen.getByText('world')).toHaveProperty('tagName', 'STRONG');
        expect(screen.getByText('inline')).toHaveClass('inline-code');
        expect(container.querySelector('.syntax-highlighter')).not.toBeInTheDocument();
    });

    it('loads syntax highlighting only for fenced code blocks', async () => {
        const { container } = render(
            <MarkdownContent content={'```javascript\nconst answer = 42;\n```'} />,
        );

        await waitFor(() => {
            expect(container.querySelector('.syntax-highlighter')).toBeInTheDocument();
        }, { timeout: 10_000 });
        expect(container).toHaveTextContent('const answer = 42;');
    });
});
