function importGlobalConfigEditor() {
    return import('./GlobalConfigEditor');
}

let editorModulePromise: ReturnType<typeof importGlobalConfigEditor> | undefined;

export function loadGlobalConfigEditor(): ReturnType<typeof importGlobalConfigEditor> {
    editorModulePromise ??= importGlobalConfigEditor();
    return editorModulePromise;
}

export function preloadGlobalConfigEditor(): void {
    void loadGlobalConfigEditor().catch(() => {
        // Keep the rejected promise cached. React's route error boundary will
        // surface the module-load failure if the user opens Global Config.
    });
}
