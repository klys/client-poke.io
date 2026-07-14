import {
  designerSectionsByKey,
  type DesignerItemSeed,
  type DesignerSectionKey,
} from "./designerSections";

export type DesignerSectionState = {
  categories: string[];
  items: DesignerItemSeed[];
};

export type StoredDesignerSectionPayload = {
  state: DesignerSectionState;
  version: number | null;
  updatedAt: string | null;
  updatedByUsername: string | null;
};

export type DesignerCacheUpdateDetail = {
  sectionKey: DesignerSectionKey;
};

export const DESIGNER_CACHE_UPDATED_EVENT = "client-poke.io.designer-cache-updated";

// localStorage is a warm-start optimization only: quota is ~10MB shared across the
// whole origin while some sections (assets, battleBackgrounds) are far larger, so
// every payload is kept in memory first and localStorage writes are best-effort.
const memorySectionCache = new Map<DesignerSectionKey, StoredDesignerSectionPayload>();
const LOCAL_STORAGE_SECTION_CHAR_LIMIT = 3 * 1024 * 1024;

export function getDesignerSectionStorageKey(sectionKey: DesignerSectionKey) {
  return `designer:section:${sectionKey}`;
}

export function getLegacyDesignerSectionStorageKey(sectionKey: DesignerSectionKey) {
  return `designer-demo:${sectionKey}`;
}

function buildFallbackState(sectionKey: DesignerSectionKey): DesignerSectionState {
  return {
    categories: designerSectionsByKey[sectionKey].defaultCategories,
    items: [],
  };
}

function sanitizeStoredSectionState(
  sectionKey: DesignerSectionKey,
  value: unknown
): DesignerSectionState {
  const fallback = buildFallbackState(sectionKey);

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<DesignerSectionState>;
  const items = Array.isArray(candidate.items)
    ? candidate.items.filter(
        (item): item is DesignerItemSeed =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      )
    : [];

  return {
    categories: Array.isArray(candidate.categories)
      ? candidate.categories.filter(
          (category): category is string => typeof category === "string"
        )
      : fallback.categories,
    items,
  };
}

export function readStoredDesignerSectionPayload(
  sectionKey: DesignerSectionKey
): StoredDesignerSectionPayload {
  const memoryPayload = memorySectionCache.get(sectionKey);

  if (memoryPayload) {
    return memoryPayload;
  }

  const fallback = buildFallbackState(sectionKey);

  if (typeof window === "undefined") {
    return {
      state: fallback,
      version: null,
      updatedAt: null,
      updatedByUsername: null,
    };
  }

  try {
    const raw =
      window.localStorage.getItem(getDesignerSectionStorageKey(sectionKey)) ??
      window.localStorage.getItem(getLegacyDesignerSectionStorageKey(sectionKey));

    if (!raw) {
      return {
        state: fallback,
        version: null,
        updatedAt: null,
        updatedByUsername: null,
      };
    }

    const parsed = JSON.parse(raw);
    const stateCandidate =
      parsed && typeof parsed === "object" && "state" in parsed
        ? (parsed as { state?: unknown }).state
        : parsed;

    return {
      state: sanitizeStoredSectionState(sectionKey, stateCandidate),
      version:
        typeof parsed?.version === "number" && Number.isFinite(parsed.version)
          ? Math.round(parsed.version)
          : null,
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
      updatedByUsername:
        typeof parsed?.updatedByUsername === "string" ? parsed.updatedByUsername : null,
    };
  } catch {
    return {
      state: fallback,
      version: null,
      updatedAt: null,
      updatedByUsername: null,
    };
  }
}

export function dispatchDesignerCacheUpdated(sectionKey: DesignerSectionKey) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DesignerCacheUpdateDetail>(DESIGNER_CACHE_UPDATED_EVENT, {
      detail: { sectionKey },
    })
  );
}

function removeStorageKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}

function writeSectionToStorage(sectionKey: DesignerSectionKey, serialized: string) {
  try {
    window.localStorage.setItem(getDesignerSectionStorageKey(sectionKey), serialized);
    return true;
  } catch {
    return false;
  }
}

export function persistStoredDesignerSectionPayload(
  sectionKey: DesignerSectionKey,
  payload: StoredDesignerSectionPayload
) {
  memorySectionCache.set(sectionKey, payload);

  if (typeof window === "undefined") {
    return;
  }

  removeStorageKey(getLegacyDesignerSectionStorageKey(sectionKey));

  const serialized = JSON.stringify(payload);
  const fitsInStorage =
    serialized.length <= LOCAL_STORAGE_SECTION_CHAR_LIMIT &&
    (writeSectionToStorage(sectionKey, serialized) ||
      // Quota pressure: drop the stale copy so an old version can't shadow this
      // payload next session, then retry once with the freed space.
      (removeStorageKey(getDesignerSectionStorageKey(sectionKey)),
      writeSectionToStorage(sectionKey, serialized)));

  if (!fitsInStorage) {
    removeStorageKey(getDesignerSectionStorageKey(sectionKey));
  }

  dispatchDesignerCacheUpdated(sectionKey);
}

// Removes leftover storage from older client versions and any cached section too
// large for the quota, so oversized entries can't starve the caches that matter.
export function cleanupStaleDesignerStorage() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keys: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (key) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      if (key.startsWith("designer-demo:")) {
        removeStorageKey(key);
        return;
      }

      if (key.startsWith("designer:section:")) {
        const raw = window.localStorage.getItem(key);

        if (raw && raw.length > LOCAL_STORAGE_SECTION_CHAR_LIMIT) {
          removeStorageKey(key);
        }
      }
    });
  } catch {
    /* best effort */
  }
}
