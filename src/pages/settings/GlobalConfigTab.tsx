import { parse as jsoncParse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { webviewSend } from '../../hooks';
import { useEcaDispatch } from '../../redux/store';
import { editorReadGlobalConfig, editorWriteGlobalConfig } from '../../redux/thunks/editor';
import { loadGlobalConfigEditor } from './globalConfigEditorLoader';
import './GlobalConfigTab.css';

const GlobalConfigEditor = lazy(async () => ({
    default: (await loadGlobalConfigEditor()).GlobalConfigEditor,
}));

const JSONC_PARSE_OPTIONS = {
    allowTrailingComma: true,
    allowEmptyContent: true,
} as const;

export function GlobalConfigTab() {
    const dispatch = useEcaDispatch();
    const [configPath, setConfigPath] = useState<string>('');
    const [exists, setExists] = useState<boolean>(false);
    const [initialContents, setInitialContents] = useState<string>('');
    const [currentContents, setCurrentContents] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<boolean>(false);
    const [justSaved, setJustSaved] = useState<boolean>(false);

    const dirty = currentContents !== initialContents;

    const parseError = useMemo<string | null>(() => {
        if (!currentContents.trim()) return null;

        const errors: ParseError[] = [];
        jsoncParse(currentContents, errors, JSONC_PARSE_OPTIONS);
        if (errors.length === 0) return null;

        const first = errors[0];
        return `${printParseErrorCode(first.error)} at offset ${first.offset}`;
    }, [currentContents]);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await dispatch(editorReadGlobalConfig()).unwrap();
            setConfigPath(result.path);
            setExists(result.exists);
            const contents = result.contents ?? '';
            setInitialContents(contents);
            setCurrentContents(contents);
            if (result.error) setError(result.error);
        } catch (caughtError) {
            setError((caughtError as Error).message);
        } finally {
            setLoading(false);
        }
    }, [dispatch]);

    useEffect(() => {
        void reload();
        const onFocus = () => { void reload(); };
        window.addEventListener('focus', onFocus);
        return () => { window.removeEventListener('focus', onFocus); };
    }, [reload]);

    useEffect(() => {
        if (!justSaved) return;
        const id = window.setTimeout(() => { setJustSaved(false); }, 2000);
        return () => { window.clearTimeout(id); };
    }, [justSaved]);

    useEffect(() => {
        if (!copied) return;
        const id = window.setTimeout(() => { setCopied(false); }, 1500);
        return () => { window.clearTimeout(id); };
    }, [copied]);

    const onSave = useCallback(async () => {
        if (!dirty || parseError || saving) return;

        setSaving(true);
        setError(null);
        try {
            const result = await dispatch(editorWriteGlobalConfig({ contents: currentContents })).unwrap();
            if (result.ok) {
                setInitialContents(currentContents);
                setExists(true);
                setJustSaved(true);
            } else {
                setError(result.error ?? 'Save failed.');
            }
        } catch (caughtError) {
            setError((caughtError as Error).message);
        } finally {
            setSaving(false);
        }
    }, [currentContents, dirty, dispatch, parseError, saving]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                const active = document.activeElement;
                const inTab = !!active?.closest?.('.global-config-tab');
                if (inTab) {
                    event.preventDefault();
                    void onSave();
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); };
    }, [onSave]);

    const onCopyPath = async () => {
        if (!configPath) return;

        try {
            await navigator.clipboard.writeText(configPath);
            setCopied(true);
        } catch {
            // Clipboard access is optional in embedded clients.
        }
    };

    const saveDisabled = !dirty || !!parseError || saving;

    return (
        <div className="global-config-tab">
            <p className="tab-description">
                Edit the ECA global configuration file. This JSON file controls default models,
                providers, MCP servers, and other settings.{' '}
                <a href="https://eca.dev/config">Learn more</a>
            </p>

            <div className="path-row">
                <i className="codicon codicon-file"></i>
                <span className="config-path" title={configPath}>
                    {configPath || 'Resolving path…'}
                </span>
                <button
                    className="icon-btn"
                    onClick={() => { void onCopyPath(); }}
                    title={copied ? 'Copied!' : 'Copy path'}
                    disabled={!configPath}
                >
                    <i className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`}></i>
                </button>
            </div>

            <Suspense
                fallback={(
                    <div
                        className="editor-container editor-container-loading"
                        aria-label="Loading configuration editor"
                        aria-busy="true"
                    ></div>
                )}
            >
                <GlobalConfigEditor
                    contents={currentContents}
                    onContentsChange={setCurrentContents}
                />
            </Suspense>

            <div className="action-bar">
                <button
                    className="primary-btn"
                    onClick={() => { void onSave(); }}
                    disabled={saveDisabled}
                    title={parseError ?? (saveDisabled && !dirty ? 'No changes' : undefined)}
                >
                    <i className="codicon codicon-save"></i>
                    {saving ? 'Saving…' : 'Save'}
                </button>

                <button
                    className="secondary-btn"
                    onClick={() => { void reload(); }}
                    disabled={loading || saving}
                    title="Re-read file from disk"
                >
                    <i className="codicon codicon-refresh"></i>
                    {loading ? 'Loading…' : 'Reload'}
                </button>

                <button
                    className="secondary-btn"
                    onClick={() => { webviewSend('editor/openGlobalConfig', {}); }}
                    title="Open in your OS default editor"
                >
                    <i className="codicon codicon-go-to-file"></i>
                    Open in editor
                </button>

                <div className="status-area">
                    {!exists && !loading && (
                        <span className="status-hint">
                            File does not exist yet — Save to create it.
                        </span>
                    )}
                    {parseError && (
                        <span className="parse-error" title={parseError}>
                            <i className="codicon codicon-error"></i> invalid JSON
                        </span>
                    )}
                    {!parseError && dirty && (
                        <span className="dirty-indicator">● unsaved changes</span>
                    )}
                    {!dirty && !parseError && justSaved && (
                        <span className="saved-indicator">
                            <i className="codicon codicon-check"></i> Saved
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <i className="codicon codicon-error"></i>
                    <span>{error}</span>
                    <button
                        className="icon-btn"
                        onClick={() => { setError(null); }}
                        title="Dismiss"
                    >
                        <i className="codicon codicon-close"></i>
                    </button>
                </div>
            )}
        </div>
    );
}
