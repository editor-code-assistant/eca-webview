import React from 'react';
import ReactDOM from 'react-dom/client';
import App from "./App";
import './index.css';
import { editorName } from "./util";

const editor = editorName() || 'vscode';
document.documentElement.dataset.editor = editor;

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error('Missing application root element');
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
