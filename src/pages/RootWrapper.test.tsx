import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webviewSendAndGet } from '../hooks';
import { setLocalStorage } from '../localStorage';
import { store } from '../redux/store';
import type { WebviewMessage } from '../webviewProtocol';
import RootWrapper from './RootWrapper';

describe('RootWrapper request responses', () => {
    afterEach(() => {
        delete window.__ecaWebTransport;
        localStorage.clear();
    });

    it('resolves mcp/updateServer requests from the host response', async () => {
        setLocalStorage('editor', 'desktop');
        const send = vi.fn<(message: WebviewMessage) => void>();
        window.__ecaWebTransport = { send };

        render(
            <Provider store={store}>
                <MemoryRouter>
                    <Routes>
                        <Route element={<RootWrapper />}>
                            <Route index element={<div>Ready</div>} />
                        </Route>
                    </Routes>
                </MemoryRouter>
            </Provider>,
        );
        send.mockClear();

        const responsePromise = webviewSendAndGet('mcp/updateServer', {
            name: 'filesystem',
            command: 'eca-filesystem',
            args: ['--stdio'],
        });
        const outbound = send.mock.calls[0]?.[0];
        expect(outbound?.type).toBe('mcp/updateServer');
        if (!outbound || outbound.type !== 'mcp/updateServer') {
            throw new Error('Expected an mcp/updateServer request');
        }
        const outboundData: unknown = outbound.data;
        if (typeof outboundData !== 'object' || outboundData === null) {
            throw new Error('Expected an object request payload');
        }
        if (!('requestId' in outboundData) || typeof outboundData.requestId !== 'string') {
            throw new Error('Expected a string request id');
        }
        const requestId = outboundData.requestId;

        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                data: {
                    type: 'mcp/updateServer',
                    data: { requestId, updated: true },
                },
            }));
        });

        await expect(responsePromise).resolves.toEqual({
            requestId,
            updated: true,
        });
    });
});
