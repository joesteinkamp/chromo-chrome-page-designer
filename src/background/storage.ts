/**
 * Storage helpers — save and load edits per URL using chrome.storage.local.
 */

import type { Change } from "../shared/types";

const STORAGE_PREFIX = "pd_edits_";

/** Save changes for a URL */
export async function saveEdits(url: string, changes: Change[]): Promise<void> {
  const key = STORAGE_PREFIX + normalizeUrl(url);
  await chrome.storage.local.set({
    [key]: {
      url,
      changes,
      savedAt: Date.now(),
    },
  });
}

/** Load saved changes for a URL */
export async function loadEdits(url: string): Promise<Change[] | null> {
  const key = STORAGE_PREFIX + normalizeUrl(url);
  const result = await chrome.storage.local.get(key);
  const data = result[key];
  if (data && Array.isArray(data.changes)) {
    return data.changes;
  }
  return null;
}

/** Delete saved changes for a URL */
export async function deleteEdits(url: string): Promise<void> {
  const key = STORAGE_PREFIX + normalizeUrl(url);
  await chrome.storage.local.remove(key);
}

/** Check if a URL has saved edits */
export async function hasSavedEdits(url: string): Promise<boolean> {
  const changes = await loadEdits(url);
  return changes !== null && changes.length > 0;
}

/** List all URLs with saved edits */
export async function listSavedUrls(): Promise<string[]> {
  const all = await chrome.storage.local.get(null);
  const urls: string[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(STORAGE_PREFIX) && value?.url) {
      urls.push(value.url);
    }
  }
  return urls;
}

/** Normalize URL for storage key (strip hash, trailing slash) */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove hash and trailing slash
    return (u.origin + u.pathname.replace(/\/$/, "") + u.search).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
