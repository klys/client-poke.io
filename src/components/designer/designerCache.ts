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

// Item-level ops mirrored from server DesignerSectionStore. A patch touches
// only the records that changed, so saves and rebroadcasts stay small.
export type DesignerSectionPatchOp =
  | { kind: "upsert"; item: DesignerItemSeed }
  | { kind: "delete"; itemId: string }
  | { kind: "setCategories"; categories: string[] };

export type DesignerSectionPatchBroadcast = {
  sectionKey: DesignerSectionKey;
  ops: DesignerSectionPatchOp[];
  version: number;
  updatedAt: string | null;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
};

export function sanitizeDesignerSectionPatchBroadcast(
  value: unknown
): DesignerSectionPatchBroadcast | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<DesignerSectionPatchBroadcast>;

  if (
    typeof candidate.sectionKey !== "string" ||
    !(candidate.sectionKey in designerSectionsByKey) ||
    typeof candidate.version !== "number" ||
    !Number.isFinite(candidate.version) ||
    !Array.isArray(candidate.ops)
  ) {
    return null;
  }

  return {
    sectionKey: candidate.sectionKey as DesignerSectionKey,
    ops: candidate.ops as DesignerSectionPatchOp[],
    version: Math.round(candidate.version),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    updatedByUserId:
      typeof candidate.updatedByUserId === "number" ? candidate.updatedByUserId : null,
    updatedByUsername:
      typeof candidate.updatedByUsername === "string" ? candidate.updatedByUsername : null,
  };
}

// Pure apply, mirrored from the server implementation.
export function applyDesignerSectionPatchOps(
  state: DesignerSectionState,
  ops: DesignerSectionPatchOp[]
): DesignerSectionState {
  let categories = state.categories;
  let items = state.items;

  for (const op of ops) {
    if (op.kind === "upsert" && op.item && typeof op.item.id === "string") {
      const index = items.findIndex((item) => item.id === op.item.id);

      items =
        index >= 0
          ? [...items.slice(0, index), op.item, ...items.slice(index + 1)]
          : [...items, op.item];

      if (!categories.includes(op.item.category)) {
        categories = [...categories, op.item.category];
      }
    } else if (op.kind === "delete" && typeof op.itemId === "string") {
      items = items.filter((item) => item.id !== op.itemId);
    } else if (op.kind === "setCategories" && Array.isArray(op.categories)) {
      categories = op.categories.filter(
        (category): category is string => typeof category === "string"
      );
    }
  }

  return { categories, items };
}

/**
 * Applies a patch broadcast to the cached section payload.
 * Returns "applied" when the ops were applied (version was contiguous),
 * "stale" when the broadcast is older than the cache (safe to ignore), and
 * "gap" when versions were missed — the caller should refetch over HTTP.
 */
export function applyDesignerSectionPatchToCache(
  broadcast: DesignerSectionPatchBroadcast
): "applied" | "stale" | "gap" {
  const cached = readStoredDesignerSectionPayload(broadcast.sectionKey);

  if (cached.version !== null && broadcast.version <= cached.version) {
    return "stale";
  }

  if (cached.version === null || broadcast.version !== cached.version + 1) {
    return "gap";
  }

  persistStoredDesignerSectionPayload(broadcast.sectionKey, {
    state: applyDesignerSectionPatchOps(cached.state, broadcast.ops),
    version: broadcast.version,
    updatedAt: broadcast.updatedAt,
    updatedByUsername: broadcast.updatedByUsername,
  });

  return "applied";
}

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
