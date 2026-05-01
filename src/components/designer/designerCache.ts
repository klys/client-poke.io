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

export function persistStoredDesignerSectionPayload(
  sectionKey: DesignerSectionKey,
  payload: StoredDesignerSectionPayload
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getDesignerSectionStorageKey(sectionKey),
    JSON.stringify(payload)
  );
  dispatchDesignerCacheUpdated(sectionKey);
}
