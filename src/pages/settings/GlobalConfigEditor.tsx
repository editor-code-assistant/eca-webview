import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { type Diagnostic, linter, lintGutter } from '@codemirror/lint';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { parse as jsoncParse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { useEffect, useRef } from 'react';

const JSONC_PARSE_OPTIONS = {
    allowTrailingComma: true,
    allowEmptyContent: true,
} as const;

const jsonHighlightStyle = HighlightStyle.define([
    { tag: [t.string, t.special(t.string)], color: 'var(--vscode-debugTokenExpression-string, #ce9178)' },
    { tag: t.number, color: 'var(--vscode-debugTokenExpression-number, #b5cea8)' },
    {
        tag: [t.bool, t.null, t.keyword, t.atom],
        color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)',
    },
    {
        tag: [t.propertyName, t.definition(t.propertyName)],
        color: 'var(--vscode-debugTokenExpression-name, #9cdcfe)',
    },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#6a9955', fontStyle: 'italic' },
    { tag: t.escape, color: '#d7ba7d' },
    { tag: t.invalid, color: 'var(--eca-error-fg, #f14c4c)' },
]);

function jsoncLinter() {
    return linter((view) => {
        const diagnostics: Diagnostic[] = [];
        const errors: ParseError[] = [];
        const text = view.state.doc.toString();
        jsoncParse(text, errors, JSONC_PARSE_OPTIONS);
        const docLen = view.state.doc.length;

        for (const error of errors) {
            const from = Math.max(0, Math.min(error.offset, docLen));
            const to = Math.max(from, Math.min(error.offset + error.length, docLen));
            diagnostics.push({
                from,
                to: to > from ? to : Math.min(from + 1, docLen),
                severity: 'error',
                message: printParseErrorCode(error.error),
            });
        }

        return diagnostics;
    });
}

interface GlobalConfigEditorProps {
    contents: string;
    onContentsChange: (contents: string) => void;
}

export function GlobalConfigEditor({ contents, onContentsChange }: GlobalConfigEditorProps) {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const initialContentsRef = useRef(contents);
    const onContentsChangeRef = useRef(onContentsChange);

    useEffect(() => {
        onContentsChangeRef.current = onContentsChange;
    }, [onContentsChange]);

    useEffect(() => {
        if (!editorContainerRef.current || viewRef.current) return;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                onContentsChangeRef.current(update.state.doc.toString());
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
            doc: initialContentsRef.current,
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                history(),
                bracketMatching(),
                indentOnInput(),
                syntaxHighlighting(jsonHighlightStyle, { fallback: true }),
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

    useEffect(() => {
        const view = viewRef.current;
        if (!view || view.state.doc.toString() === contents) return;

        view.dispatch({
            changes: {
                from: 0,
                to: view.state.doc.length,
                insert: contents,
            },
        });
    }, [contents]);

    return <div className="editor-container" ref={editorContainerRef}></div>;
}
