import { FormEvent, useEffect, useRef, useState } from 'react';
import { InputField, LoginAction, LoginMethod } from '../../protocol';
import './ProviderLoginDialog.scss';

export type ActiveLoginAction = Exclude<LoginAction, { action: 'done' }>;

interface ProviderLoginDialogProps {
    providerName: string;
    action: ActiveLoginAction;
    busy: boolean;
    error: string | null;
    onChooseMethod: (method: LoginMethod) => void;
    onSubmitFields: (data: Record<string, string>) => void;
    onClose: () => void;
}

function actionFields(action: ActiveLoginAction): InputField[] {
    if (action.action === 'input') return action.fields;
    if (action.action === 'authorize') return action.fields ?? [];
    return [];
}

function initialValues(fields: InputField[]): Record<string, string> {
    return Object.fromEntries(fields.map(field => [field.key, '']));
}

export function ProviderLoginDialog({
    providerName,
    action,
    busy,
    error,
    onChooseMethod,
    onSubmitFields,
    onClose,
}: ProviderLoginDialogProps) {
    const fields = actionFields(action);
    const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const nextFields = actionFields(action);
        setValues(initialValues(nextFields));
        if (nextFields.length > 0) {
            requestAnimationFrame(() => firstInputRef.current?.focus());
        }
    }, [action]);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!busy) onSubmitFields(values);
    };

    const closeOnEscape = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape' && !busy) {
            event.preventDefault();
            onClose();
        }
    };

    const message = action.action === 'authorize' || action.action === 'device-code'
        ? action.message
        : null;
    const hasForm = fields.length > 0;

    return (
        <div
            className="provider-login-backdrop"
            role="presentation"
            onMouseDown={event => {
                if (event.target === event.currentTarget && !busy) onClose();
            }}
        >
            <div
                className="provider-login-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="provider-login-title"
                onKeyDown={closeOnEscape}
            >
                <header className="provider-login-header">
                    <div>
                        <h3 id="provider-login-title">Connect {providerName}</h3>
                        {action.action === 'choose-method' && <p>Choose a login method.</p>}
                        {message && <p>{message}</p>}
                    </div>
                    <button
                        type="button"
                        className="provider-login-close"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close provider login"
                    >
                        <i className="codicon codicon-close" />
                    </button>
                </header>

                {action.action === 'choose-method' && (
                    <div className="provider-login-methods">
                        {action.methods.map(method => (
                            <button
                                type="button"
                                key={method.key}
                                onClick={() => onChooseMethod(method)}
                                disabled={busy}
                            >
                                {method.label}
                            </button>
                        ))}
                    </div>
                )}

                {action.action === 'device-code' && (
                    <div className="provider-login-device-code">
                        <span>Device code</span>
                        <code>{action.code}</code>
                    </div>
                )}

                {hasForm && (
                    <form className="provider-login-form" onSubmit={submit}>
                        {fields.map((field, index) => (
                            <label key={field.key}>
                                <span>{field.label}</span>
                                <input
                                    ref={index === 0 ? firstInputRef : undefined}
                                    type={field.type === 'secret' ? 'password' : 'text'}
                                    name={field.key}
                                    value={values[field.key] ?? ''}
                                    onChange={event => setValues(current => ({
                                        ...current,
                                        [field.key]: event.target.value,
                                    }))}
                                    autoComplete={field.type === 'secret' ? 'new-password' : 'off'}
                                    disabled={busy}
                                />
                            </label>
                        ))}
                        <div className="provider-login-actions">
                            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
                            <button type="submit" className="primary" disabled={busy}>
                                {busy ? 'Connecting…' : 'Continue'}
                            </button>
                        </div>
                    </form>
                )}

                {!hasForm && action.action !== 'choose-method' && (
                    <div className="provider-login-actions">
                        <button type="button" className="primary" onClick={onClose} disabled={busy}>Close</button>
                    </div>
                )}

                {error && <p className="provider-login-error" role="alert">{error}</p>}
            </div>
        </div>
    );
}
