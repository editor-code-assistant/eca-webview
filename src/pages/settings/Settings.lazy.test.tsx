import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Settings } from './Settings';

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(() => ({
        unwrap: () => Promise.resolve({
            contents: '{}',
            path: 'C:/Users/test/.config/eca/config.json',
            exists: true,
        }),
    })),
}));

vi.mock('../../redux/store', () => ({
    useEcaDispatch: () => mocks.dispatch,
}));

vi.mock('./MCPsTab', () => ({
    MCPsTab: () => <div>MCP settings loaded</div>,
}));

vi.mock('./ProvidersTab', () => ({
    ProvidersTab: () => <div>Provider settings loaded</div>,
}));

vi.mock('./JobsTab', () => ({
    JobsTab: () => <div>Job settings loaded</div>,
}));

vi.mock('./LogsTab', () => ({
    LogsTab: () => <div>Log settings loaded</div>,
}));

describe('lazy settings tabs', () => {
    it('initializes CodeMirror only after Global Config is opened', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>,
        );

        expect(await screen.findByText('MCP settings loaded')).toBeVisible();
        expect(container.querySelector('.cm-editor')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Global Config/ }));
        await waitFor(() => {
            expect(container.querySelector('.cm-editor')).toBeInTheDocument();
        });
        expect(mocks.dispatch).toHaveBeenCalledOnce();
    });
});
