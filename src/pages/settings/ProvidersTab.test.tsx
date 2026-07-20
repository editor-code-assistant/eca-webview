import { configureStore, createAction, createReducer } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginAction, ProviderStatus } from '../../protocol';
import { normalizeError } from '../../errorReporting';
import { ProvidersTab } from './ProvidersTab';

interface MockThunkAction {
    type: 'list' | 'login' | 'input' | 'logout' | 'open-url';
    payload?: unknown;
}

interface DispatchResult {
    then: Promise<unknown>['then'];
    catch: Promise<unknown>['catch'];
    finally: Promise<unknown>['finally'];
    unwrap: () => Promise<unknown>;
}

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn<(action: MockThunkAction) => DispatchResult>(),
    listProviders: vi.fn((): MockThunkAction => ({ type: 'list' })),
    loginProvider: vi.fn((payload: unknown): MockThunkAction => ({ type: 'login', payload })),
    loginProviderInput: vi.fn((payload: unknown): MockThunkAction => ({ type: 'input', payload })),
    logoutProvider: vi.fn((payload: unknown): MockThunkAction => ({ type: 'logout', payload })),
    editorOpenUrl: vi.fn((payload: unknown): MockThunkAction => ({ type: 'open-url', payload })),
}));

vi.mock('../../redux/store', () => ({
    useEcaDispatch: () => mocks.dispatch,
}));

vi.mock('../../redux/thunks/providers', () => ({
    listProviders: mocks.listProviders,
    loginProvider: mocks.loginProvider,
    loginProviderInput: mocks.loginProviderInput,
    logoutProvider: mocks.logoutProvider,
}));

vi.mock('../../redux/thunks/editor', () => ({
    editorOpenUrl: mocks.editorOpenUrl,
}));

const replaceProviders = createAction<ProviderStatus[]>('test/replaceProviders');

function provider(overrides: Partial<ProviderStatus> = {}): ProviderStatus {
    return {
        id: 'provider',
        label: 'Test Provider',
        configured: false,
        auth: { status: 'unauthenticated' },
        login: { methods: [{ key: 'api-key', label: 'API Key' }] },
        models: [],
        ...overrides,
    };
}

function createTestStore(initialProviders: ProviderStatus[]) {
    const reducer = createReducer(
        { providers: { providers: initialProviders } },
        builder => builder.addCase(replaceProviders, (_state, action) => ({
            providers: { providers: action.payload },
        })),
    );
    return configureStore({
        reducer,
    });
}

function renderProviders(initialProvider: ProviderStatus) {
    const store = createTestStore([initialProvider]);
    const view = render(
        <Provider store={store}>
            <ProvidersTab />
        </Provider>,
    );
    return { store, ...view };
}

function dispatchResult(value: unknown, rejection = false): DispatchResult {
    const unwrapped = rejection ? Promise.reject(normalizeError(value)) : Promise.resolve(value);
    const dispatched = unwrapped.then(
        () => undefined,
        () => undefined,
    );
    return {
        then: dispatched.then.bind(dispatched),
        catch: dispatched.catch.bind(dispatched),
        finally: dispatched.finally.bind(dispatched),
        unwrap: () => unwrapped,
    };
}

function installResponses(responses: Partial<Record<MockThunkAction['type'], unknown[]>>) {
    mocks.dispatch.mockImplementation((action) => {
        const queue = responses[action.type] ?? [];
        const next = queue.shift();
        if (next instanceof Error) return dispatchResult(next, true);
        return dispatchResult(next);
    });
}

describe('provider authentication', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        installResponses({ list: [undefined] });
    });

    it('submits API keys and refreshes providers after completion', async () => {
        installResponses({
            list: [undefined, undefined],
            login: [{ action: 'input', fields: [{ key: 'apiKey', label: 'API Key', type: 'secret' }] } satisfies LoginAction],
            input: [{ action: 'done' } satisfies LoginAction],
        });
        const user = userEvent.setup();
        renderProviders(provider());

        await user.click(screen.getByRole('button', { name: 'Add Key' }));
        const keyInput = await screen.findByLabelText('API Key');
        expect(keyInput).toHaveAttribute('type', 'password');
        await user.type(keyInput, 'test-api-key');
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        await waitFor(() => {
            expect(mocks.loginProviderInput).toHaveBeenCalledWith({
                provider: 'provider',
                data: { apiKey: 'test-api-key' },
            });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(mocks.listProviders).toHaveBeenCalledTimes(2);
        });
    });

    it('supports choosing and submitting an Anthropic authorization code', async () => {
        installResponses({
            list: [undefined],
            login: [
                { action: 'choose-method', methods: [{ key: 'auth-code', label: 'Anthropic auth code' }] } satisfies LoginAction,
                { action: 'input', fields: [{ key: 'code', label: 'Authorization code', type: 'secret' }] } satisfies LoginAction,
            ],
            input: [{ action: 'done' } satisfies LoginAction],
        });
        const user = userEvent.setup();
        renderProviders(provider({ login: { methods: [{ key: 'auth-code', label: 'Anthropic auth code' }] } }));

        await user.click(screen.getByRole('button', { name: 'Login' }));
        await user.click(await screen.findByRole('button', { name: 'Anthropic auth code' }));
        expect(mocks.loginProvider).toHaveBeenLastCalledWith({ provider: 'provider', method: 'auth-code' });

        await user.type(await screen.findByLabelText('Authorization code'), 'test-auth-code');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await waitFor(() => {
            expect(mocks.loginProviderInput).toHaveBeenCalledWith({
                provider: 'provider',
                data: { code: 'test-auth-code' },
            });
        });
    });

    it('opens browser authorization and closes when a provider update authenticates', async () => {
        const openAi = provider({
            id: 'openai',
            label: 'OpenAI',
            login: { methods: [{ key: 'oauth', label: 'Browser' }] },
        });
        installResponses({
            list: [undefined],
            login: [{
                action: 'authorize',
                url: 'https://example.test/openai-auth',
                message: 'Complete login in your browser.',
            } satisfies LoginAction],
            'open-url': [undefined],
        });
        const user = userEvent.setup();
        const { store } = renderProviders(openAi);

        await user.click(screen.getByRole('button', { name: 'Login' }));
        expect(await screen.findByText('Complete login in your browser.')).toBeVisible();
        expect(mocks.editorOpenUrl).toHaveBeenCalledWith({ url: 'https://example.test/openai-auth' });

        act(() => {
            store.dispatch(replaceProviders([{ ...openAi, auth: { status: 'authenticated', source: 'login' } }]));
        });
        await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); });
        expect(screen.getByRole('button', { name: 'Logout' })).toBeEnabled();
    });

    it('shows Copilot device codes and opens the verification URL', async () => {
        installResponses({
            list: [undefined],
            login: [{
                action: 'device-code',
                url: 'https://example.test/device',
                code: 'ABCD-EFGH',
                message: 'Enter this code in GitHub.',
            } satisfies LoginAction],
            'open-url': [undefined],
        });
        const user = userEvent.setup();
        renderProviders(provider({ id: 'github-copilot', label: 'GitHub Copilot', login: { methods: [{ key: 'device', label: 'Device' }] } }));

        await user.click(screen.getByRole('button', { name: 'Login' }));
        expect(await screen.findByText('ABCD-EFGH')).toBeVisible();
        expect(screen.getByText('Enter this code in GitHub.')).toBeVisible();
        expect(mocks.editorOpenUrl).toHaveBeenCalledWith({ url: 'https://example.test/device' });
    });

    it('cancels an active login without submitting credentials', async () => {
        installResponses({
            list: [undefined],
            login: [{ action: 'input', fields: [{ key: 'token', label: 'Token', type: 'secret' }] } satisfies LoginAction],
        });
        const user = userEvent.setup();
        renderProviders(provider());

        await user.click(screen.getByRole('button', { name: 'Add Key' }));
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mocks.loginProviderInput).not.toHaveBeenCalled();
    });

    it('keeps controls busy while login is pending', async () => {
        let resolveLogin: ((action: LoginAction) => void) | undefined;
        const pending = new Promise<LoginAction>((resolve) => { resolveLogin = resolve; });
        mocks.dispatch.mockImplementation((action) => {
            if (action.type === 'login') return dispatchResult(pending);
            return dispatchResult(undefined);
        });
        const user = userEvent.setup();
        renderProviders(provider());

        const loginButton = screen.getByRole('button', { name: 'Add Key' });
        await user.click(loginButton);
        expect(loginButton).toBeDisabled();

        resolveLogin?.({ action: 'input', fields: [{ key: 'token', label: 'Token', type: 'secret' }] });
        expect(await screen.findByRole('dialog')).toBeVisible();
    });

    it('surfaces rejected login operations and restores controls', async () => {
        installResponses({ list: [undefined], login: [new Error('Authentication service unavailable')] });
        const user = userEvent.setup();
        renderProviders(provider());

        await user.click(screen.getByRole('button', { name: 'Add Key' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Authentication service unavailable');
        expect(screen.getByRole('button', { name: 'Add Key' })).toBeEnabled();
    });
});
