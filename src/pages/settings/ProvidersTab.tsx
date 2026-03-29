import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { webviewSend } from '../../hooks';
import { LoginAction, ProviderAuthStatus, ProviderStatus } from '../../protocol';
import { State, useEcaDispatch } from '../../redux/store';
import { listProviders, loginProvider, loginProviderInput, logoutProvider } from '../../redux/thunks/providers';
import './ProvidersTab.scss';

const authStatusLabel: Record<ProviderAuthStatus, string> = {
    'authenticated': '✓ Authenticated',
    'expiring': '✓ Authenticated',
    'expired': '✗ Expired',
    'unauthenticated': '✗ Not authenticated',
    'local': 'Local',
    'not-running': 'Not running',
};

function authStatusClass(status: ProviderAuthStatus): string {
    switch (status) {
        case 'authenticated':
        case 'expiring':
            return 'authenticated';
        case 'local':
            return 'local';
        case 'expired':
        case 'unauthenticated':
        case 'not-running':
            return 'unauthenticated';
    }
}

function formatExpiry(expiresAt: number): string {
    const now = Date.now() / 1000;
    const diff = expiresAt - now;
    if (diff <= 0) return 'expired';
    if (diff < 3600) return `expires in ${Math.ceil(diff / 60)}m`;
    if (diff < 86400) return `expires in ${Math.ceil(diff / 3600)}h`;
    return `expires in ${Math.ceil(diff / 86400)}d`;
}

function authInfoText(provider: ProviderStatus): string | null {
    const parts: string[] = [];
    const auth = provider.auth;

    if (auth.mode) parts.push(auth.mode);
    else if (auth.type === 'oauth') parts.push('OAuth');
    else if (auth.type === 'api-key') parts.push('API Key');

    if (auth.source === 'env' && auth.envVar) parts.push(`(env: ${auth.envVar})`);
    else if (auth.source === 'config') parts.push('(config)');
    else if (auth.source === 'login') parts.push('(login)');

    if (auth.expiresAt) parts.push(formatExpiry(auth.expiresAt));

    return parts.length > 0 ? parts.join(' · ') : null;
}

function getLoginLabel(provider: ProviderStatus): string | null {
    if (!provider.login?.methods?.length) return null;
    const hasApiKey = provider.login.methods.some(m => m.key === 'api-key');
    const hasOther = provider.login.methods.some(m => m.key !== 'api-key');
    if (hasOther) return 'Login';
    if (hasApiKey) return 'Add Key';
    return 'Login';
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
    const dispatch = useEcaDispatch();
    const [modelsExpanded, setModelsExpanded] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    const auth = provider.auth;
    const isAuthed = auth.status === 'authenticated' || auth.status === 'expiring';
    const canLogout = isAuthed && auth.source === 'login';
    const loginLabel = !isAuthed ? getLoginLabel(provider) : null;
    const info = authInfoText(provider);

    const handleLoginAction = async (action: LoginAction) => {
        if (action.action === 'choose-method') {
            const result: string | null = await new Promise(resolve => {
                webviewSend('editor/readInput', {
                    title: 'Choose login method',
                    placeholder: 'Select a method...',
                    options: action.methods.map(m => m.label),
                });
                const handler = (event: MessageEvent) => {
                    if (event.data.type === 'editor/readInputResponse') {
                        window.removeEventListener('message', handler);
                        resolve(event.data.data?.value ?? null);
                    }
                };
                window.addEventListener('message', handler);
            });
            if (result) {
                const method = action.methods.find(m => m.label === result);
                if (method) {
                    const nextAction = await dispatch(loginProvider({ provider: provider.id, method: method.key })).unwrap();
                    await handleLoginAction(nextAction);
                }
            }
        } else if (action.action === 'input') {
            const data: Record<string, string> = {};
            for (const field of action.fields) {
                const value: string | null = await new Promise(resolve => {
                    webviewSend('editor/readInput', {
                        title: field.label,
                        placeholder: `Enter ${field.label.toLowerCase()}...`,
                        password: field.type === 'secret',
                    });
                    const handler = (event: MessageEvent) => {
                        if (event.data.type === 'editor/readInputResponse') {
                            window.removeEventListener('message', handler);
                            resolve(event.data.data?.value ?? null);
                        }
                    };
                    window.addEventListener('message', handler);
                });
                if (value === null) return;
                data[field.key] = value;
            }
            await dispatch(loginProviderInput({ provider: provider.id, data })).unwrap();
        } else if (action.action === 'authorize') {
            webviewSend('editor/openUrl', { url: action.url });
            if (action.fields?.length) {
                const data: Record<string, string> = {};
                for (const field of action.fields) {
                    const value: string | null = await new Promise(resolve => {
                        webviewSend('editor/readInput', {
                            title: field.label,
                            placeholder: `Enter ${field.label.toLowerCase()}...`,
                            password: field.type === 'secret',
                        });
                        const handler = (event: MessageEvent) => {
                            if (event.data.type === 'editor/readInputResponse') {
                                window.removeEventListener('message', handler);
                                resolve(event.data.data?.value ?? null);
                            }
                        };
                        window.addEventListener('message', handler);
                    });
                    if (value === null) return;
                    data[field.key] = value;
                }
                await dispatch(loginProviderInput({ provider: provider.id, data })).unwrap();
            }
        } else if (action.action === 'device-code') {
            webviewSend('editor/openUrl', { url: action.url });
        }
    };

    const onLogin = async () => {
        setLoginLoading(true);
        try {
            const action = await dispatch(loginProvider({ provider: provider.id })).unwrap();
            await handleLoginAction(action);
        } finally {
            setLoginLoading(false);
        }
    };

    const onLogout = () => {
        dispatch(logoutProvider({ provider: provider.id }));
    };

    return (
        <div className={`provider-card ${authStatusClass(auth.status)}`}>
            <div className="provider-header">
                <div className="provider-identity">
                    <span className={`status-dot ${authStatusClass(auth.status)}`}></span>
                    <span className="provider-name">{provider.label || provider.id}</span>
                    <span className={`auth-status ${authStatusClass(auth.status)}`}>
                        {authStatusLabel[auth.status]}
                    </span>
                </div>
                <div className="provider-actions">
                    {canLogout &&
                        <button className="action-btn logout-btn" onClick={onLogout}>
                            <i className="codicon codicon-sign-out"></i>
                            Logout
                        </button>}
                    {loginLabel &&
                        <button className="action-btn login-btn" onClick={onLogin} disabled={loginLoading}>
                            <i className={`codicon ${loginLabel === 'Add Key' ? 'codicon-key' : 'codicon-sign-in'}`}></i>
                            {loginLoading ? '…' : loginLabel}
                        </button>}
                </div>
            </div>

            <div className="provider-body">
                {info && <span className="auth-info">{info}</span>}

                {provider.models.length > 0 &&
                    <div className="models-section">
                        <button className="models-toggle" onClick={() => setModelsExpanded(!modelsExpanded)}>
                            <i className={`codicon ${modelsExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}></i>
                            <span>{provider.models.length} model{provider.models.length !== 1 ? 's' : ''}</span>
                        </button>
                        {modelsExpanded &&
                            <div className="models-list">
                                {provider.models.map((model, i) => (
                                    <div key={i} className="model-item">
                                        <span className="model-name">{model.id}</span>
                                        <div className="model-caps">
                                            {model.capabilities.reason && <span className="cap-badge">reason</span>}
                                            {model.capabilities.vision && <span className="cap-badge">vision</span>}
                                            {model.capabilities.tools && <span className="cap-badge">tools</span>}
                                            {model.capabilities.webSearch && <span className="cap-badge">web</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>}
                    </div>}
            </div>
        </div>
    );
}

export function ProvidersTab() {
    const dispatch = useEcaDispatch();
    const providers = useSelector((state: State) => state.providers.providers);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        dispatch(listProviders()).finally(() => setLoading(false));
    }, [dispatch]);

    const sorted = [...providers].sort((a, b) => {
        const priority = (p: ProviderStatus) => {
            if (p.auth.status === 'authenticated' || p.auth.status === 'expiring') return 0;
            if (p.auth.status === 'local') return 1;
            if (p.configured) return 2;
            return 3;
        };
        return priority(a) - priority(b);
    });

    const configured = sorted.filter(p => p.configured);
    const unconfigured = sorted.filter(p => !p.configured);

    return (
        <div className="providers-tab">
            <p className="tab-description">
                Manage AI provider authentication and view available models.
            </p>

            {loading && providers.length === 0 &&
                <div className="empty-state">
                    <p>Loading providers…</p>
                </div>}

            {!loading && providers.length === 0 &&
                <div className="empty-state">
                    <i className="codicon codicon-key"></i>
                    <p>No providers available</p>
                </div>}

            {configured.length > 0 &&
                <div className="provider-list">
                    {configured.map(provider => (
                        <ProviderCard key={provider.id} provider={provider} />
                    ))}
                </div>}

            {unconfigured.length > 0 && <>
                {configured.length > 0 && <div className="section-divider">Other providers</div>}
                <div className="provider-list">
                    {unconfigured.map(provider => (
                        <ProviderCard key={provider.id} provider={provider} />
                    ))}
                </div>
            </>}
        </div>
    );
}
