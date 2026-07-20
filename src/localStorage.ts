
type EditorName = "vscode" | "jetbrains" | "web" | "desktop";

interface LocalStorageTypes {
  editor: EditorName;
  // Base UI font scale multiplier (em units), e.g., 1, 1.1
  fontScale: number;
}

function isEditorName(value: unknown): value is EditorName {
  return value === "vscode"
    || value === "jetbrains"
    || value === "web"
    || value === "desktop";
}

export function getLocalStorage(key: "editor"): EditorName | undefined;
export function getLocalStorage(key: "fontScale"): number | undefined;
export function getLocalStorage(key: keyof LocalStorageTypes): LocalStorageTypes[keyof LocalStorageTypes] | undefined;
export function getLocalStorage(
  key: keyof LocalStorageTypes,
): LocalStorageTypes[keyof LocalStorageTypes] | undefined {
  const value = localStorage.getItem(key);

  if (value === null) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    switch (key) {
      case "editor":
        return isEditorName(parsed) ? parsed : undefined;
      case "fontScale":
        return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
          ? parsed
          : undefined;
    }
  } catch (error) {
    console.error(
      `Error parsing ${key} from local storage. Value was ${value}\n\n`,
      error,
    );
    return undefined;
  }
}

export function setLocalStorage<T extends keyof LocalStorageTypes>(
  key: T,
  value: LocalStorageTypes[T],
): void {
  localStorage.setItem(key, JSON.stringify(value));
}
