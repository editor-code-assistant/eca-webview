import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import {
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
} from '@codemirror/view';
import {
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
} from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { Diagnostic, linter, lintGutter } from '@codemirror/lint';
import {
    bracketMatching,
    defaultHighlightStyle,
    indentOnInput,
    syntaxHighlighting,
} from '@codemirror/language';
import {
    parse as jsoncParse,
    printParseErrorCode,
    type ParseError,
} from 'jsonc-parser';

import { webviewSend } from '../../hooks';
import { useEcaDispatch } from '../../redux/store';
import {
    editorReadGlobalConfig,
    editorWriteGlobalConfig,
} from '../../redux/thunks/editor';
import './GlobalConfigTab.scss';

// ECA's config file accepts JSONC (JSON with Comments + trailing commas).
// We lint with jsonc-parser so comments and trailing commas are not flagged.
const JSONC_PARSE_OPTIONS = {
    allowTrailingComma: true,
    allowEmptyContent: true,
} as const;

function jsoncLinter() {
    return linter((view) => {
        const diagnostics: Diagnostic[] = [];
        const errors: ParseError[] = [];
        const text = view.state.doc.toString();
        jsoncParse(text, errors, JSONC_PARSE_OPTIONS);
        const docLen = view.state.doc.length;
        for (const err of errors) {
            const from = Math.max(0, Math.min(err.offset, docLen));
            const to = Math.max(from, Math.min(err.offset + err.length, docLen));
            diagnostics.push({
                from,
                to: to > from ? to : Math.min(from + 1, docLen),
                severity: 'error',
                message: printParseErrorCode(err.error),
            });
        }
        return diagnostics;
    });
}

export function GlobalConfigTab() {
    const dispatch = useEcaDispatch();

    const editorContainerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

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

    // Parse-error check drives Save button disabled state. An empty document
    // is considered "valid" so users can save an empty file to create a seed.
    // Uses JSONC semantics so // and /* */ comments and trailing commas are
    // accepted (matching ECA's own config parser).
    const parseError = useMemo<string | null>(() => {
        if (!currentContents.trim()) return null;
        const errors: ParseError[] = [];
        jsoncParse(currentContents, errors, JSONC_PARSE_OPTIONS);
        if (errors.length === 0) return null;
        const first = errors[0];
        return `${printParseErrorCode(first.error)} at offset ${first.offset}`;
    }, [currentContents]);

    const applyToEditor = useCallback((contents: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
            changes: {
                from: 0,
                to: view.state.doc.length,
                insert: contents,
            },
        });
    }, []);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await dispatch(editorReadGlobalConfig({})).unwrap();
            setConfigPath(result.path);
            setExists(result.exists);
            const contents = result.contents ?? '';
            setInitialContents(contents);
            setCurrentContents(contents);
            applyToEditor(contents);
            if (result.error) setError(result.error);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [dispatch, applyToEditor]);

    // Create the editor once on mount.
    useEffect(() => {
        if (!editorContainerRef.current || viewRef.current) return;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                setCurrentContents(update.state.doc.toString());
                setJustSaved(false);
            }
        });

        const theme = EditorView.theme({
            '&': {
                height: '100%',
                backgroundColor: 'transparent',
                color: 'var(--eca-fg)',
            },
            '.cm-scroller': {
                fontFamily: 'var(--eca-code-font, ui-monospace, SFMono-Regular, Menlo, monospace)',
                fontSize: '0.9em',
            },
            '.cm-gutters': {
                backgroundColor: 'transparent',
                color: 'var(--eca-input-placeholder-fg)',
                border: 'none',
            },
            '.cm-activeLineGutter, .cm-activeLine': {
                backgroundColor: 'rgba(127, 127, 127, 0.08)',
            },
            '.cm-selectionBackground, ::selection': {
                backgroundColor: 'rgba(0, 120, 212, 0.25)',
            },
            '.cm-cursor': {
                borderLeftColor: 'var(--eca-fg)',
            },
        });

        const state = EditorState.create({
            doc: '',
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                history(),
                bracketMatching(),
                indentOnInput(),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                json(),
                jsoncLinter(),
                lintGutter(),
                keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
                updateListener,
                theme,
            ],
        });

        const view = new EditorView({
            state,
            parent: editorContainerRef.current,
        });
        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []);

    // Initial load and refresh on window focus so external-editor changes
    // are picked up automatically.
    useEffect(() => {
        reload();
        const onFocus = () => { reload(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [reload]);

    // Auto-clear the transient "Saved" indicator after a couple of seconds.
    useEffect(() => {
        if (!justSaved) return;
        const id = window.setTimeout(() => setJustSaved(false), 2000);
        return () => window.clearTimeout(id);
    }, [justSaved]);

    // Auto-clear the copy-path confirmation.
    useEffect(() => {
        if (!copied) return;
        const id = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(id);
    }, [copied]);

    const onSave = async () => {
        if (!dirty || parseError || saving) return;
        setSaving(true);
        setError(null);
        try {
            const result = await dispatch(
                editorWriteGlobalConfig({ contents: currentContents }),
            ).unwrap();
            if (result.ok) {
                setInitialContents(currentContents);
                setExists(true);
                setJustSaved(true);
            } else {
                setError(result.error ?? 'Save failed.');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const onOpenExternal = () => {
        webviewSend('editor/openGlobalConfig', {});
    };

    const onCopyPath = async () => {
        if (!configPath) return;
        try {
            await navigator.clipboard.writeText(configPath);
            setCopied(true);
        } catch {
            /* clipboard may be unavailable in some embedding contexts; swallow */
        }
    };

    // Ctrl/Cmd+S on the tab triggers save when focus is inside the editor.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                const active = document.activeElement;
                const inTab = !!active?.closest?.('.global-config-tab');
                if (inTab) {
                    e.preventDefault();
                    onSave();
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // onSave is a closure over state; re-bind when deps change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dirty, parseError, saving, currentContents]);

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
                    onClick={onCopyPath}
                    title={copied ? 'Copied!' : 'Copy path'}
                    disabled={!configPath}
                >
                    <i className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`}></i>
                </button>
            </div>

            <div className="editor-container" ref={editorContainerRef}></div>

            <div className="action-bar">
                <button
                    className="primary-btn"
                    onClick={onSave}
                    disabled={saveDisabled}
                    title={parseError ?? (saveDisabled && !dirty ? 'No changes' : undefined)}
                >
                    <i className="codicon codicon-save"></i>
                    {saving ? 'Saving…' : 'Save'}
                </button>

                <button
                    className="secondary-btn"
                    onClick={reload}
                    disabled={loading || saving}
                    title="Re-read file from disk"
                >
                    <i className="codicon codicon-refresh"></i>
                    {loading ? 'Loading…' : 'Reload'}
                </button>

                <button
                    className="secondary-btn"
                    onClick={onOpenExternal}
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
                        onClick={() => setError(null)}
                        title="Dismiss"
                    >
                        <i className="codicon codicon-close"></i>
                    </button>
                </div>
            )}
        </div>
    );
}
