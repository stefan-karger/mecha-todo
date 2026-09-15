import { COMPOSER_DRAFT_STORAGE_KEY } from "../config/product";

export function clearComposerDraft(): void {
  try {
    globalThis.localStorage?.removeItem(COMPOSER_DRAFT_STORAGE_KEY);
  } catch {
    // IndexedDB remains usable when browser local storage is unavailable.
  }
}
