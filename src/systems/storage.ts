// Thin, failure-tolerant wrappers around localStorage.
// Safe to import in Node (tests): a missing or blocked localStorage behaves like an empty store.

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // Accessing localStorage can throw (e.g. SecurityError when storage is disabled).
    return null;
  }
}

/** Read and parse `key`, then normalize it. Missing, unreadable or corrupt data → `normalize(undefined)`. */
export function loadJSON<T>(key: string, normalize: (raw: unknown) => T): T {
  try {
    const text = getStorage()?.getItem(key);
    if (text != null) return normalize(JSON.parse(text));
  } catch {}
  return normalize(undefined);
}

/** Serialize and store `value` under `key`. Returns false if storage is unavailable or the write fails. */
export function saveJSON(key: string, value: unknown): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
