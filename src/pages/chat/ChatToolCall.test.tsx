import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { store } from '../../redux/store';
import { ChatToolCall } from './ChatToolCall';

describe('ChatToolCall file diffs', () => {
    it('loads and renders the diff only after the card is expanded', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <Provider store={store}>
                <ChatToolCall
                    chatId="test-chat"
                    toolCallId="test-tool"
                    name="eca_edit_file"
                    status="succeeded"
                    origin="native"
                    manualApproval={false}
                    details={{
                        type: 'fileChange',
                        path: 'src/example.ts',
                        diff: '@@ -1 +1 @@\n-const value = 1;\n+const value = 2;',
                        linesAdded: 1,
                        linesRemoved: 1,
                    }}
                />
            </Provider>,
        );

        expect(container.querySelector('.diff')).not.toBeInTheDocument();
        await user.click(screen.getByText('+1'));

        await waitFor(() => { expect(container.querySelector('.diff')).toBeInTheDocument(); });
        expect(container).toHaveTextContent('const value = 2;');
    });
});
