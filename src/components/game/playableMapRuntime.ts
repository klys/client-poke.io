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

export type PlayableMapPortalDestination = {
  mapId: string;
  x: number;
  y: number;
};

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
  mapId: string | null | undefined
): PlayableMapRuntimeEntry | null {
  if (!mapId) {
    return null;
  }

  const mapsState = loadPlayableMapsState();
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
    editorData: loadPlayableMapEditorData(item.id),
  };
}

export function getInitialPlayableMap() {
  const mapsState = loadPlayableMapsState();
  const item =
    mapsState.items.find((candidate) => candidate.playableMapConfig?.isInitialMap === true) ??
    mapsState.items[0] ??
    designerSectionsByKey.mapsEditor.demoItems[0] ??
    null;

  if (!item) {
    return null;
  }

  return getPlayableMapById(item.id);
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
  portal: MapEditorPortalPlacement
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

  const targetMap = getPlayableMapById(portal.targetMapId);

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

export function getInitialGameSpawn() {
  const initialMap = getInitialPlayableMap();

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

export function getPlayableMapDefinitions(): PlayableMapDefinition[] {
  const mapsState = loadPlayableMapsState();

  return mapsState.items
    .map((item) => {
      const config = normalizePlayableMapConfig(item.playableMapConfig);
      const editorData = loadPlayableMapEditorData(item.id);

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
