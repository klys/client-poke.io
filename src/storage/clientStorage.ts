// Browser storage for the game's large caches.
//
// localStorage is capped at ~5-10MB per origin no matter what the user grants,
// while the playable-maps payload alone is ~18MB and the designer's tileset /
// asset catalogs are far bigger. Those payloads therefore live in IndexedDB
// (quota is a large share of free disk) and only small settings/tokens stay in
// localStorage. On top of that we ask the browser for *persistent* storage
// (navigator.storage.persist) so the cache is not evicted under pressure —
// Firefox prompts the user, Chromium grants it silently based on engagement
// (installed app, bookmark, notification permission) and otherwise reports
// false, which Settings surfaces with a hint.

const DB_NAME = "pokecraft-client-cache";
const DB_VERSION = 1;
const STORE_NAME = "kv";

export type StorageStatus = {
  supported: boolean;
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
  /** Result of the last persist() request this session, null until asked. */
  lastRequestGranted: boolean | null;
};

let status: StorageStatus = {
  supported: typeof indexedDB !== "undefined",
  persisted: null,
  usageBytes: null,
  quotaBytes: null,
  lastRequestGranted: null,
};
const statusListeners = new Set<() => void>();

function publishStatus(next: Partial<StorageStatus>) {
  status = { ...status, ...next };
  statusListeners.forEach((listener) => listener());
}

export function getStorageStatus() {
  return status;
}

export function subscribeStorageStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// IndexedDB key/value store
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;

        // If another tab upgrades the schema, drop our handle so the next
        // call reopens instead of failing forever.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDatabase();

  if (!db) {
    return undefined;
  }

  try {
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
    return (await requestToPromise(store.get(key))) as T | undefined;
  } catch {
    return undefined;
  }
}

/** Structured-clones `value` into the store. Returns false when storage refused it. */
export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDatabase();

  if (!db) {
    return false;
  }

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch (error) {
    // QuotaExceededError is the interesting case: refresh the estimate so the
    // Settings panel reflects the pressure.
    void refreshStorageStatus();
    console.warn(`IndexedDB write failed for ${key}:`, error);
    return false;
  }
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    /* best effort */
  }
}

/** All entries whose key starts with `prefix`. */
export async function idbEntriesWithPrefix<T = unknown>(
  prefix: string
): Promise<Array<{ key: string; value: T }>> {
  const db = await openDatabase();

  if (!db) {
    return [];
  }

  try {
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
    const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
    const [keys, values] = await Promise.all([
      requestToPromise(store.getAllKeys(range)),
      requestToPromise(store.getAll(range)),
    ]);

    return keys.map((key, index) => ({ key: String(key), value: values[index] as T }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Persistent storage + quota
// ---------------------------------------------------------------------------

export async function refreshStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;

  if (!storage) {
    publishStatus({ supported: status.supported });
    return status;
  }

  try {
    const [persisted, estimate] = await Promise.all([
      storage.persisted ? storage.persisted() : Promise.resolve(null),
      storage.estimate ? storage.estimate() : Promise.resolve(null),
    ]);

    publishStatus({
      persisted,
      usageBytes: typeof estimate?.usage === "number" ? estimate.usage : null,
      quotaBytes: typeof estimate?.quota === "number" ? estimate.quota : null,
    });
  } catch {
    /* estimate unavailable (private mode, old WebView) */
  }

  return status;
}

let persistRequestPromise: Promise<boolean> | null = null;

/**
 * Asks the browser to keep this origin's storage out of eviction. Safe to call
 * repeatedly; the first call per session does the real request.
 */
export function requestPersistentStorage(): Promise<boolean> {
  if (persistRequestPromise) {
    return persistRequestPromise;
  }

  persistRequestPromise = (async () => {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;

    if (!storage?.persist) {
      publishStatus({ lastRequestGranted: false });
      return false;
    }

    try {
      const granted = await storage.persist();

      publishStatus({ persisted: granted, lastRequestGranted: granted });
      void refreshStorageStatus();
      return granted;
    } catch {
      publishStatus({ lastRequestGranted: false });
      return false;
    }
  })();

  return persistRequestPromise;
}

/** Lets Settings re-ask after the user changed something (e.g. installed the app). */
export function retryPersistentStorageRequest(): Promise<boolean> {
  persistRequestPromise = null;
  return requestPersistentStorage();
}

export function formatBytes(bytes: number | null) {
  if (bytes === null || !Number.isFinite(bytes)) {
    return "—";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
