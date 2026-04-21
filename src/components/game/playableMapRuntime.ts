import type { CSSProperties } from "react";
import {
  designerSectionsByKey,
  type DesignerItemSeed,
  type DesignerPlayableMapBackgroundImageMode,
  type DesignerPlayableMapConfig,
} from "../designer/designerSections";
import {
  sanitizePlayableMapEditorData,
  type MapEditorPortalPlacement,
} from "../designer/PlayableMapEditorCanvas";

type DesignerSectionState = {
  categories: string[];
  items: DesignerItemSeed[];
};

export type PlayableMapObstacleDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlayableMapDefinition = {
  mapId: string;
  width: number;
  height: number;
  obstacles: PlayableMapObstacleDefinition[];
};

export type PlayableMapRuntimeEntry = {
  item: DesignerItemSeed;
  config: DesignerPlayableMapConfig;
  editorData: ReturnType<typeof sanitizePlayableMapEditorData>;
};

export type PlayableMapsStateSnapshot = {
  categories: string[];
  items: DesignerItemSeed[];
  editorDataByMapId: Record<string, ReturnType<typeof sanitizePlayableMapEditorData>>;
};

export type PlayableMapsSyncPayload = {
  state: PlayableMapsStateSnapshot;
  version: number;
  updatedAt: string | null;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
};

export type PlayableMapPortalDestination = {
  mapId: string;
  x: number;
  y: number;
};

const PLAYABLE_MAPS_CACHE_KEY = "server-cache:playableMaps";
const MAPS_STORAGE_KEY = "designer-demo:mapsEditor";
const MAP_EDITOR_STORAGE_PREFIX = "designer-demo:mapEditor:";
const DEFAULT_MAP_BACKGROUND_COLOR = "#8bc17f";
const DEFAULT_MAP_BACKGROUND_IMAGE_MODE: DesignerPlayableMapBackgroundImageMode = "repeat";

function normalizeBackgroundColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_MAP_BACKGROUND_COLOR;
}

function normalizePlayableMapConfig(
  config: Partial<DesignerPlayableMapConfig> | undefined
): DesignerPlayableMapConfig {
  return {
    cellSize:
      typeof config?.cellSize === "number" &&
      [8, 16, 32, 64, 128].includes(config.cellSize)
        ? config.cellSize
        : 32,
    sizePreset: config?.sizePreset ?? "medium",
    width:
      typeof config?.width === "number" && Number.isFinite(config.width) && config.width > 0
        ? Math.max(1, Math.round(config.width))
        : 500,
    height:
      typeof config?.height === "number" && Number.isFinite(config.height) && config.height > 0
        ? Math.max(1, Math.round(config.height))
        : 500,
    isInitialMap: config?.isInitialMap === true,
    initialPositionX:
      typeof config?.initialPositionX === "number" && Number.isFinite(config.initialPositionX)
        ? Math.round(config.initialPositionX)
        : null,
    initialPositionY:
      typeof config?.initialPositionY === "number" && Number.isFinite(config.initialPositionY)
        ? Math.round(config.initialPositionY)
        : null,
    regionName:
      typeof config?.regionName === "string" && config.regionName.trim()
        ? config.regionName.trim()
        : "Ash Coast",
    regionX:
      typeof config?.regionX === "number" && Number.isFinite(config.regionX)
        ? Math.round(config.regionX)
        : 0,
    regionY:
      typeof config?.regionY === "number" && Number.isFinite(config.regionY)
        ? Math.round(config.regionY)
        : 0,
    mapType: config?.mapType ?? "grassland",
    backgroundColor: normalizeBackgroundColor(config?.backgroundColor ?? ""),
    backgroundImageSrc:
      typeof config?.backgroundImageSrc === "string" ? config.backgroundImageSrc : "",
    backgroundImageMode:
      config?.backgroundImageMode === "centered" ||
      config?.backgroundImageMode === "stretched" ||
      config?.backgroundImageMode === "repeat"
        ? config.backgroundImageMode
        : DEFAULT_MAP_BACKGROUND_IMAGE_MODE,
  };
}

function getMapEditorStorageKey(mapId: string) {
  return `${MAP_EDITOR_STORAGE_PREFIX}${mapId}`;
}

export function getPlayableMapBackgroundStyle(config: DesignerPlayableMapConfig): CSSProperties {
  const backgroundColor = normalizeBackgroundColor(config.backgroundColor);

  if (!config.backgroundImageSrc) {
    return {
      backgroundColor,
    };
  }

  if (config.backgroundImageMode === "centered") {
    return {
      backgroundColor,
      backgroundImage: `url("${config.backgroundImageSrc}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "auto",
    };
  }

  if (config.backgroundImageMode === "stretched") {
    return {
      backgroundColor,
      backgroundImage: `url("${config.backgroundImageSrc}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    };
  }

  return {
    backgroundColor,
    backgroundImage: `url("${config.backgroundImageSrc}")`,
    backgroundPosition: "top left",
    backgroundRepeat: "repeat",
    backgroundSize: "auto",
  };
}

export function loadPlayableMapsState() {
  const fallback: DesignerSectionState = {
    categories: designerSectionsByKey.mapsEditor.defaultCategories,
    items: designerSectionsByKey.mapsEditor.demoItems,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(MAPS_STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;

    if (!Array.isArray(parsed.items)) {
      return fallback;
    }

    return {
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((category): category is string => typeof category === "string")
        : fallback.categories,
      items: parsed.items.filter(
        (item): item is DesignerItemSeed =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      ),
    };
  } catch {
    return fallback;
  }
}

function sanitizePlayableMapsState(value: unknown) {
  const fallback: DesignerSectionState = {
    categories: designerSectionsByKey.mapsEditor.defaultCategories,
    items: designerSectionsByKey.mapsEditor.demoItems,
  };

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<DesignerSectionState>;

  if (!Array.isArray(candidate.items)) {
    return fallback;
  }

  return {
    categories: Array.isArray(candidate.categories)
      ? candidate.categories.filter((category): category is string => typeof category === "string")
      : fallback.categories,
    items: candidate.items.filter(
      (item): item is DesignerItemSeed =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.category === "string" &&
        Array.isArray(item?.details)
    ),
  };
}

function sanitizePlayableMapEditorDataByMapId(value: unknown) {
  if (!value || typeof value !== "object") {
    return {} as PlayableMapsStateSnapshot["editorDataByMapId"];
  }

  return Object.entries(value as Record<string, unknown>).reduce<PlayableMapsStateSnapshot["editorDataByMapId"]>(
    (accumulator, [mapId, editorData]) => {
      if (typeof mapId !== "string" || mapId.length === 0) {
        return accumulator;
      }

      accumulator[mapId] = sanitizePlayableMapEditorData(editorData);
      return accumulator;
    },
    {}
  );
}

export function loadPlayableMapsSnapshot(): PlayableMapsStateSnapshot {
  const cachedPayload = loadPlayableMapsCache();

  if (cachedPayload) {
    return cachedPayload.state;
  }

  const mapsState = loadPlayableMapsState();

  return {
    categories: mapsState.categories,
    items: mapsState.items,
    editorDataByMapId: mapsState.items.reduce<PlayableMapsStateSnapshot["editorDataByMapId"]>(
      (accumulator, item) => {
        accumulator[item.id] = loadPlayableMapEditorData(item.id);
        return accumulator;
      },
      {}
    ),
  };
}

export function sanitizePlayableMapsSnapshot(value: unknown): PlayableMapsStateSnapshot {
  const source =
    value && typeof value === "object" && "state" in value
      ? (value as Partial<PlayableMapsSyncPayload>).state
      : value;
  const candidate = source as
    | Partial<PlayableMapsStateSnapshot>
    | undefined;
  const mapsState = sanitizePlayableMapsState(candidate);

  return {
    categories: mapsState.categories,
    items: mapsState.items,
    editorDataByMapId: sanitizePlayableMapEditorDataByMapId(candidate?.editorDataByMapId),
  };
}

export function sanitizePlayableMapsSyncPayload(value: unknown): PlayableMapsSyncPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PlayableMapsSyncPayload>;

  if (typeof candidate.version !== "number" || !Number.isFinite(candidate.version)) {
    return null;
  }

  return {
    state: sanitizePlayableMapsSnapshot(candidate.state),
    version: Math.max(1, Math.round(candidate.version)),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    updatedByUserId:
      typeof candidate.updatedByUserId === "number" && Number.isFinite(candidate.updatedByUserId)
        ? candidate.updatedByUserId
        : null,
    updatedByUsername:
      typeof candidate.updatedByUsername === "string" && candidate.updatedByUsername.length > 0
        ? candidate.updatedByUsername
        : null,
  };
}

export function loadPlayableMapsCache(): PlayableMapsSyncPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PLAYABLE_MAPS_CACHE_KEY);

    return raw ? sanitizePlayableMapsSyncPayload(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function getPlayableMapsCacheVersion() {
  return loadPlayableMapsCache()?.version ?? null;
}

export function buildPlayableMapsSnapshot(
  mapsState: DesignerSectionState
): PlayableMapsStateSnapshot {
  const sanitizedMapsState = sanitizePlayableMapsState(mapsState);

  return {
    categories: sanitizedMapsState.categories,
    items: sanitizedMapsState.items,
    editorDataByMapId: sanitizedMapsState.items.reduce<PlayableMapsStateSnapshot["editorDataByMapId"]>(
      (accumulator, item) => {
        accumulator[item.id] = loadPlayableMapEditorData(item.id);
        return accumulator;
      },
      {}
    ),
  };
}

export function persistPlayableMapsSyncPayload(payload: PlayableMapsSyncPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const sanitizedPayload = sanitizePlayableMapsSyncPayload(payload);

  if (!sanitizedPayload) {
    return;
  }

  window.localStorage.setItem(PLAYABLE_MAPS_CACHE_KEY, JSON.stringify(sanitizedPayload));
  window.localStorage.setItem(
    MAPS_STORAGE_KEY,
    JSON.stringify({
      categories: sanitizedPayload.state.categories,
      items: sanitizedPayload.state.items,
    })
  );

  sanitizedPayload.state.items.forEach((item) => {
    const editorData = sanitizedPayload.state.editorDataByMapId[item.id];

    if (editorData) {
      window.localStorage.setItem(getMapEditorStorageKey(item.id), JSON.stringify(editorData));
    }
  });
}

function resolvePlayableMapsSnapshot(snapshot?: PlayableMapsStateSnapshot) {
  return snapshot ?? loadPlayableMapsSnapshot();
}

export function loadPlayableMapEditorData(mapId: string) {
  if (typeof window === "undefined" || !mapId) {
    return sanitizePlayableMapEditorData(undefined);
  }

  try {
    const raw = window.localStorage.getItem(getMapEditorStorageKey(mapId));

    return raw
      ? sanitizePlayableMapEditorData(JSON.parse(raw))
      : sanitizePlayableMapEditorData(undefined);
  } catch {
    return sanitizePlayableMapEditorData(undefined);
  }
}

export function getPlayableMapById(
  mapId: string | null | undefined,
  snapshot?: PlayableMapsStateSnapshot
): PlayableMapRuntimeEntry | null {
  if (!mapId) {
    return null;
  }

  const mapsState = resolvePlayableMapsSnapshot(snapshot);
  const item =
    mapsState.items.find((candidate) => candidate.id === mapId) ??
    designerSectionsByKey.mapsEditor.demoItems.find((candidate) => candidate.id === mapId) ??
    null;

  if (!item) {
    return null;
  }

  const config = normalizePlayableMapConfig(item.playableMapConfig);

  return {
    item,
    config,
    editorData:
      mapsState.editorDataByMapId[item.id] ??
      loadPlayableMapEditorData(item.id),
  };
}

export function getInitialPlayableMap(snapshot?: PlayableMapsStateSnapshot) {
  const mapsState = resolvePlayableMapsSnapshot(snapshot);
  const item =
    mapsState.items.find((candidate) => candidate.playableMapConfig?.isInitialMap === true) ??
    mapsState.items[0] ??
    designerSectionsByKey.mapsEditor.demoItems[0] ??
    null;

  if (!item) {
    return null;
  }

  return getPlayableMapById(item.id, mapsState);
}

export function resolveInitialPlayerPosition(config: DesignerPlayableMapConfig) {
  if (
    typeof config.initialPositionX === "number" &&
    typeof config.initialPositionY === "number"
  ) {
    return {
      x: config.initialPositionX,
      y: config.initialPositionY,
    };
  }

  return {
    x: Math.round((config.width * config.cellSize) / 2),
    y: Math.round((config.height * config.cellSize) / 2),
  };
}

export function resolvePlayableMapCellPosition(
  config: DesignerPlayableMapConfig,
  cellX: number,
  cellY: number
) {
  return {
    x: Math.max(0, Math.round(cellX)) * config.cellSize,
    y: Math.max(0, Math.round(cellY)) * config.cellSize,
  };
}

export function resolvePortalDestination(
  sourceMap: PlayableMapRuntimeEntry,
  portal: MapEditorPortalPlacement,
  snapshot?: PlayableMapsStateSnapshot
): PlayableMapPortalDestination | null {
  if (portal.destinationType === "same-map") {
    const position = resolvePlayableMapCellPosition(
      sourceMap.config,
      portal.sameMapX,
      portal.sameMapY
    );

    return {
      mapId: sourceMap.item.id,
      x: position.x,
      y: position.y,
    };
  }

  if (portal.destinationType !== "other-map") {
    return null;
  }

  const targetMap = getPlayableMapById(portal.targetMapId, snapshot);

  if (!targetMap) {
    return null;
  }

  const position = resolvePlayableMapCellPosition(
    targetMap.config,
    portal.targetMapX,
    portal.targetMapY
  );

  return {
    mapId: targetMap.item.id,
    x: position.x,
    y: position.y,
  };
}

export function getInitialGameSpawn(snapshot?: PlayableMapsStateSnapshot) {
  const initialMap = getInitialPlayableMap(snapshot);

  if (!initialMap) {
    return null;
  }

  const position = resolveInitialPlayerPosition(initialMap.config);

  return {
    initialMapId: initialMap.item.id,
    initialX: position.x,
    initialY: position.y,
  };
}

export function getPlayableMapDefinitions(snapshot?: PlayableMapsStateSnapshot): PlayableMapDefinition[] {
  const mapsState = resolvePlayableMapsSnapshot(snapshot);

  return mapsState.items
    .map((item) => {
      const config = normalizePlayableMapConfig(item.playableMapConfig);
      const editorData =
        mapsState.editorDataByMapId[item.id] ??
        loadPlayableMapEditorData(item.id);

      return {
        mapId: item.id,
        width: config.width * config.cellSize,
        height: config.height * config.cellSize,
        obstacles: editorData.objects
          .filter((object) => object.objectType === "obstacle")
          .map((object) => ({
            x: object.x * config.cellSize,
            y: object.y * config.cellSize,
            width: object.width,
            height: object.height,
          })),
      };
    })
    .filter((definition) => definition.mapId.length > 0);
}
