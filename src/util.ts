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

export function uriToPath(uri: string) {
    const schemeIdx = uri.indexOf('://');
    if (schemeIdx === -1) return uri;
    let p = uri.substring(schemeIdx + 3).replace(/\/\//g, '/');
    try {
        p = decodeURIComponent(p);
    } catch {
        // Malformed escape (e.g. a literal % in the path): decode spaces only.
        p = p.replace(/%20/g, ' ');
    }
    // Windows drive URI: file:///C:/Users/x → C:\Users\x
    if (/^\/[A-Za-z]:([/\\]|$)/.test(p)) {
        p = p.slice(1).replace(/\//g, '\\');
    }
    return p;
}

/**
 * Separator-normalized form for path comparisons; lowercased for Windows
 * paths (case-insensitive filesystem, drive-letter casing varies between
 * server and client).
 */
function comparablePath(p: string): string {
    const normalized = p.replace(/\\/g, '/');
    return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

/**
 * Path of `path` relative to the workspace root containing it ('' when it
 * IS a root), or undefined when it lives outside all roots. Output always
 * uses forward slashes; input may use `\` (Windows server paths).
 */
export function relativePathFromRoot(path: string, workspaceFolders: { uri: string }[]): string | undefined {
    const target = comparablePath(path);
    for (const root of workspaceFolders) {
        const rootPath = comparablePath(uriToPath(root.uri));
        const rootWithSep = rootPath.endsWith('/') ? rootPath : rootPath + '/';
        if (target === rootPath) return '';
        if (target.startsWith(rootWithSep)) {
            // comparablePath is a 1:1 char map, so lengths line up with the
            // separator-normalized original (preserving its casing).
            return path.replace(/\\/g, '/').substring(rootWithSep.length);
        }
    }
    return undefined;
}

/** Directory part (relative to its workspace root) of `path`, for descriptions. */
export function relativizeFromRoot(path: string, workspaceFolders: WorkspaceFolder[]) {
    const rel = relativePathFromRoot(path, workspaceFolders);
    if (rel === undefined) return undefined;
    return rel.split('/').slice(0, -1).join('/');
}

/** Last segment of a file path; separator-agnostic (handles C:\ paths). */
export function pathBasename(path: string): string {
    const parts = path.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? path;
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

declare const vscode: any;

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
