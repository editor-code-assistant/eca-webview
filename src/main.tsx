import React from 'react';
import ReactDOM from 'react-dom/client';
import App from "./App";
import './index.css';
import { editorName } from "./util";

const editor = editorName() || 'vscode';
document.documentElement.dataset.editor = editor;

(async () => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
})();
