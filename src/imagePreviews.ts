/**
 * In-memory store of image previews for pasted images, keyed by the
 * temp-file path the host saved them to (`editor/saveClipboardImage`).
 *
 * Deliberately NOT in redux: added contexts are forwarded verbatim to
 * the server on `chat/queryContext` and `chat/prompt`, and a base64
 * data URI (potentially several MB for a retina screenshot) must never
 * ride along on those payloads. Keeping previews here means the chip
 * thumbnails render instantly from the bytes we already had at paste
 * time, while redux keeps only the lightweight `{type:'file', path}`.
 *
 * Previews don't survive a webview reload — neither do the added
 * contexts they decorate, so both disappear together.
 */

const previews = new Map<string, string>();

// Bound memory across long sessions with many pastes. Map preserves
// insertion order, so evicting the first key drops the oldest preview
// (its chip falls back to the generic image-file icon).
const MAX_PREVIEWS = 24;

export function setImagePreview(path: string, dataUri: string): void {
    if (previews.size >= MAX_PREVIEWS && !previews.has(path)) {
        const oldest = previews.keys().next().value;
        if (oldest !== undefined) {
            previews.delete(oldest);
        }
    }
    previews.set(path, dataUri);
}

export function getImagePreview(path: string): string | undefined {
    return previews.get(path);
}

export function removeImagePreview(path: string): void {
    previews.delete(path);
}
