import { COMPOSER_DRAFT_STORAGE_KEY } from "../config/product";

export function loadComposerDraft(): string {
  try {
    return globalThis.localStorage?.getItem(COMPOSER_DRAFT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveComposerDraft(value: string): void {
  try {
    if (value.length === 0) {
      globalThis.localStorage?.removeItem(COMPOSER_DRAFT_STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(COMPOSER_DRAFT_STORAGE_KEY, value);
    }
  } catch {
    // IndexedDB remains usable when browser local storage is unavailable.
  }
}

export function clearComposerDraft(): void {
  try {
    globalThis.localStorage?.removeItem(COMPOSER_DRAFT_STORAGE_KEY);
  } catch {
    // IndexedDB remains usable when browser local storage is unavailable.
  }
}
