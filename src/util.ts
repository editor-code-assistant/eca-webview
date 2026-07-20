import { getLocalStorage } from "./localStorage";
import { WorkspaceFolder } from "./protocol";

/**
 * Generate a fresh chat id on the client. The webview now mints a UUID
 * up-front and uses it for the entire lifetime of a chat — including the
 * very first `chat/prompt`. The eca server treats unknown chatIds as a
 * signal to auto-create a new chat record (and emit `chat/opened` back),
 * so we no longer need the `'EMPTY'` sentinel.
 */
export const newChatId = (): string => crypto.randomUUID();

export function uriToPath(path: string) {
    // TODO use a lib or improve to support all uri cases
    return path.substring(path.indexOf('://') + 3).replace(/%20/g, ' ').replace(/\/\//g, '/');
}

export function relativizeFromRoot(path: string, workspaceFolders: WorkspaceFolder[]) {
    for (const root of workspaceFolders) {
        const rootPath = uriToPath(root.uri);
        if (path.startsWith(rootPath)) {
            const relativePath = path.substring(rootPath.length).replace(/^\//, '');
            return relativePath.split('/').slice(0, -1).join('/');
        }
    }

}

/**
 * Render `epochMs` as a short, human-readable "X ago" string for the
 * resume picker. Buckets:
 *   - < 60 s             → "just now"
 *   - < 60 min           → "{n}m ago"
 *   - < 24 h             → "{n}h ago"
 *   - otherwise          → "{n}d ago"
 *
 * Matches the bucket boundaries used by `eca-chat--relative-time` in
 * eca-emacs so the same chat reads identically across surfaces.
 * Returns an empty string when `epochMs` is undefined/null/NaN so call
 * sites can render `... · {relativeTime(undefined)}` without conditional
 * branches.
 */
export function relativeTime(epochMs?: number | null): string {
    if (epochMs == null || !Number.isFinite(epochMs)) return '';
    const diffMs = Date.now() - epochMs;
    if (diffMs < 60_000) return 'just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

declare const vscode: unknown;

export function editorName() {
    if (getLocalStorage("editor") === "vscode" ||
        typeof vscode != "undefined") {
        return "vscode";
    }
    if (getLocalStorage("editor") === "jetbrains") {
        return "intellij"
    }
    if (getLocalStorage("editor") === "web") {
        return "web"
    }
    if (getLocalStorage("editor") === "desktop") {
        return "desktop"
    }
    return null;
}
