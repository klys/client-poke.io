import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import {
  buildPlayableMapsSnapshot,
  getPlayableMapsCacheVersion,
  loadPlayableMapEditorData,
  loadPlayableMapsState,
  persistPlayableMapsSyncPayload,
  sanitizePlayableMapsSyncPayload,
  updateMemoryPlayableMapEditorData,
} from "../game/playableMapRuntime";
import PlayableMapEditorCanvas, {
  type MapEditorMapSummary,
  type MapEditorNpcCatalogItem,
  type MapEditorObjectCatalogItem,
  type MapEditorPokemonCatalogItem,
  type PlayableMapEditorData,
  sanitizePlayableMapEditorData,
} from "./PlayableMapEditorCanvas";
import {
  designerSectionsByKey,
  type DesignerItemSeed,
  type DesignerMapObjectType,
  type DesignerMapSizePreset,
  type DesignerPlayableMapBackgroundImageMode,
  type DesignerPlayableMapConfig,
  type DesignerPlayableMapType,
  type PlayableMapConnection,
} from "./designerSections";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  persistStoredDesignerSectionPayload,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail,
} from "./designerCache";
import {
  ensureDesignerSectionOverHttp,
  fetchDesignerSectionOverHttp,
  getDesignerSectionLoadProgress,
  subscribeDesignerSectionLoad,
  type DesignerSectionLoadProgress,
} from "./designerSectionHttp";
import {
  getCharacterSkinPreview,
  loadCharacterSkinCatalog,
} from "../ux/game/characterSkinCatalog";
import TileMapEditor from "./TileMapEditor";
import { bakeTileMapForSave } from "./tileMapBakeUpload";
import { resolveServerAssetUrl } from "../tilemap/serverAssets";

type DesignerSectionState = {
  categories: string[];
  items: DesignerItemSeed[];
};

const MAP_EDITOR_STORAGE_PREFIX = "designer:mapEditor:";
const MAP_CELL_SIZE_OPTIONS = [8, 16, 32, 64, 128] as const;
const MAP_BACKGROUND_IMAGE_MODES: DesignerPlayableMapBackgroundImageMode[] = [
  "repeat",
  "centered",
  "stretched",
];
const DEFAULT_MAP_BACKGROUND_COLOR = "#8bc17f";
const DEFAULT_MAP_BACKGROUND_IMAGE_MODE: DesignerPlayableMapBackgroundImageMode = "repeat";
const MAP_SIZE_OPTIONS: Array<{
  value: DesignerMapSizePreset;
  label: string;
  width: number | null;
  height: number | null;
}> = [
  { value: "small", label: "Small (30 x 30)", width: 30, height: 30 },
  { value: "medium", label: "Medium (500 x 500)", width: 500, height: 500 },
  { value: "large", label: "Large (2000 x 2000)", width: 2000, height: 2000 },
  { value: "custom", label: "Custom Size", width: null, height: null },
];
const MAP_CONNECTION_DIRECTIONS: PlayableMapConnection["direction"][] = [
  "north",
  "south",
  "east",
  "west",
];
const MAP_TYPES: DesignerPlayableMapType[] = [
  "grassland",
  "sea",
  "undersea",
  "cave",
  "interior",
  "desert",
  "forest",
  "snow",
  "island",
  "mountain",
  "swamp",
  "volcanic",
  "ruins",
  "city",
];

function normalizeMapDimension(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? String(Math.max(1, Math.round(parsedValue)))
    : "";
}

function parseMapDimension(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.max(1, Math.round(parsedValue))
    : null;
}

function parseMapCoordinate(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : 0;
}

function parseOptionalMapCoordinate(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : null;
}

function hasValidOptionalCoordinatePair(x: string, y: string) {
  const parsedX = parseOptionalMapCoordinate(x);
  const parsedY = parseOptionalMapCoordinate(y);

  return (
    (parsedX === null && parsedY === null) ||
    (parsedX !== null && parsedY !== null)
  );
}

function formatMapTypeLabel(value: DesignerPlayableMapType) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeBackgroundColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_MAP_BACKGROUND_COLOR;
}

function normalizePlayableMapConfig(
  config: Partial<DesignerPlayableMapConfig> | undefined,
  regionNames: string[]
): DesignerPlayableMapConfig {
  return {
    ...config,
    cellSize:
      typeof config?.cellSize === "number" &&
      MAP_CELL_SIZE_OPTIONS.includes(config.cellSize as 8 | 16 | 32 | 64 | 128)
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
    isHouse: config?.isHouse === true,
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
        : regionNames[0] ?? "",
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
    backgroundImageMode: MAP_BACKGROUND_IMAGE_MODES.includes(
      config?.backgroundImageMode as DesignerPlayableMapBackgroundImageMode
    )
      ? (config?.backgroundImageMode as DesignerPlayableMapBackgroundImageMode)
      : DEFAULT_MAP_BACKGROUND_IMAGE_MODE,
  };
}

function normalizeInitialPlayableMapItems(items: DesignerItemSeed[]) {
  let hasInitialMap = false;

  return items.map((item) => {
    if (!item.playableMapConfig) {
      return item;
    }

    const isInitialMap = item.playableMapConfig.isInitialMap === true && !hasInitialMap;

    if (isInitialMap) {
      hasInitialMap = true;
    }

    return {
      ...item,
      playableMapConfig: {
        ...item.playableMapConfig,
        isInitialMap,
      },
    };
  });
}

function syncPlayableMapItems(items: DesignerItemSeed[]) {
  const normalizedItems = normalizeInitialPlayableMapItems(items);

  return normalizedItems.map((item, index) =>
    item.playableMapConfig
      ? {
          ...item,
          details: designerSectionsByKey.mapsEditor.createDetails(
            item.name,
            item.category,
            index + 1,
            { playableMapConfig: item.playableMapConfig }
          ),
        }
      : item
  );
}

function getMapSurfaceBackgroundStyle(config: DesignerPlayableMapConfig): React.CSSProperties {
  const backgroundColor = normalizeBackgroundColor(config.backgroundColor);

  if (!config.backgroundImageSrc) {
    return {
      backgroundColor,
    };
  }

  // Root-relative asset paths live on the asset-storage origin.
  const backgroundImageUrl = resolveServerAssetUrl(config.backgroundImageSrc);

  if (config.backgroundImageMode === "centered") {
    return {
      backgroundColor,
      backgroundImage: `url("${backgroundImageUrl}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "auto",
    };
  }

  if (config.backgroundImageMode === "stretched") {
    return {
      backgroundColor,
      backgroundImage: `url("${backgroundImageUrl}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    };
  }

  return {
    backgroundColor,
    backgroundImage: `url("${backgroundImageUrl}")`,
    backgroundPosition: "top left",
    backgroundRepeat: "repeat",
    backgroundSize: "auto",
  };
}

function getMapEditorStorageKey(mapId: string) {
  return `${MAP_EDITOR_STORAGE_PREFIX}${mapId}`;
}

function parseNumericDetail(details: DesignerItemSeed["details"], label: string, fallback: number) {
  const match = details.find((item) => item.label === label)?.value ?? "";
  const parsed = Number.parseInt(match, 10);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function parseObjectTypeDetail(
  details: DesignerItemSeed["details"]
): DesignerMapObjectType {
  const typeValue = details.find((item) => item.label === "Type")?.value;

  if (
    typeValue === "obstacle" ||
    typeValue === "mob area" ||
    typeValue === "floor" ||
    typeValue === "water"
  ) {
    return typeValue;
  }

  return "obstacle";
}

function normalizeObjectCatalogItem(item: DesignerItemSeed): MapEditorObjectCatalogItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    imageSrc: item.mapObjectAsset?.imageSrc ?? "",
    width: item.mapObjectAsset?.width ?? parseNumericDetail(item.details, "Width", 64),
    height: item.mapObjectAsset?.height ?? parseNumericDetail(item.details, "Height", 64),
    objectType: item.mapObjectAsset?.objectType ?? parseObjectTypeDetail(item.details),
  };
}

function normalizePokemonCatalogItem(item: DesignerItemSeed): MapEditorPokemonCatalogItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
  };
}

function normalizeNpcCatalogItem(item: DesignerItemSeed): MapEditorNpcCatalogItem {
  const characterSkinCatalog = loadCharacterSkinCatalog();
  const npcProfile =
    item.npcProfile && typeof item.npcProfile === "object"
      ? (item.npcProfile as {
          aiType?: string;
          npcType?: string;
          graphicsSource?: string;
          characterSkinId?: string;
          graphics?: {
            chestImageSrc?: string;
            standingDownSrc?: string;
            standingUpSrc?: string;
            standingLeftSrc?: string;
            standingRightSrc?: string;
            trainerFrontImageSrc?: string;
          };
        })
      : null;
  const graphics = npcProfile?.graphics;
  const selectedCharacterSkin =
    npcProfile?.graphicsSource === "characterSkin"
      ? characterSkinCatalog.find((skin) => skin.id === npcProfile.characterSkinId) ?? null
      : null;
  const characterSkinPreviewSrc = selectedCharacterSkin
    ? getCharacterSkinPreview(selectedCharacterSkin.profile)
    : "";

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    previewImageSrc:
      (npcProfile?.npcType === "chest"
        ? graphics?.chestImageSrc
        : characterSkinPreviewSrc ||
          graphics?.standingDownSrc ||
          graphics?.standingUpSrc ||
          graphics?.standingLeftSrc ||
          graphics?.standingRightSrc ||
          graphics?.trainerFrontImageSrc) ?? "",
    npcType:
      npcProfile?.npcType === "trainer" ||
      npcProfile?.npcType === "store" ||
      npcProfile?.npcType === "chest" ||
      npcProfile?.npcType === "healer"
        ? npcProfile.npcType
        : "healer",
    aiType:
      npcProfile?.aiType === "moving" ||
      npcProfile?.aiType === "scriptable" ||
      npcProfile?.aiType === "standing"
        ? npcProfile.aiType
        : "standing",
  };
}

function loadObjectCatalog() {
  const fallback: MapEditorObjectCatalogItem[] = [];

  try {
    const items = readStoredDesignerSectionPayload("objects").state.items
      .filter(
        (item): item is DesignerItemSeed =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      )
      .map(normalizeObjectCatalogItem);

    return items.length > 0 ? items : fallback;
  } catch {
    return fallback;
  }
}

function loadPokemonCatalog() {
  const fallback: MapEditorPokemonCatalogItem[] = [];

  try {
    const items = readStoredDesignerSectionPayload("pokemons").state.items
      .filter(
        (item): item is DesignerItemSeed =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      )
      .map(normalizePokemonCatalogItem);

    return items.length > 0 ? items : fallback;
  } catch {
    return fallback;
  }
}

function loadNpcCatalog() {
  const fallback: MapEditorNpcCatalogItem[] = [];

  try {
    const items = readStoredDesignerSectionPayload("npcs").state.items
      .filter(
        (item): item is DesignerItemSeed =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      )
      .map(normalizeNpcCatalogItem);

    return items.length > 0 ? items : fallback;
  } catch {
    return fallback;
  }
}

function loadMapEditorData(mapId: string) {
  if (!mapId) {
    return sanitizePlayableMapEditorData(undefined);
  }

  // Memory first, then localStorage: the per-map localStorage entry is a
  // best-effort write (a baked tile map can push it past the quota), so the
  // synced payload kept in memory is the authoritative copy for this session.
  return sanitizePlayableMapEditorData(loadPlayableMapEditorData(mapId));
}

function saveMapEditorData(mapId: string, data: PlayableMapEditorData) {
  // Keep the runtime memory cache in step BEFORE anything rebuilds a snapshot
  // from it: publishMapsState -> buildPlayableMapsSnapshot reads editor data
  // memory-first, so a stale memory entry would revert this very save.
  updateMemoryPlayableMapEditorData(mapId, data);

  if (typeof window === "undefined" || !mapId) {
    return;
  }

  try {
    window.localStorage.setItem(
      getMapEditorStorageKey(mapId),
      JSON.stringify({
        data,
        version: getPlayableMapsCacheVersion(),
        updatedAt: null,
        updatedByUsername: null,
      })
    );
  } catch {
    /* quota pressure — the server copy saved through the socket is authoritative */
  }
}

function readBackgroundImage(
  event: React.ChangeEvent<HTMLInputElement>,
  onImageChange: (value: string) => void
) {
  const file = event.target.files?.[0];

  if (!file) {
    onImageChange("");
    return;
  }

  if (!file.type.startsWith("image/")) {
    window.alert("Please upload an image file for the map background.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    if (typeof reader.result === "string") {
      onImageChange(reader.result);
    }
  };

  reader.readAsDataURL(file);
}

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadRegionNames() {
  const fallback: string[] = [];

  try {
    const regionNames = readStoredDesignerSectionPayload("regions").state.items
      .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
      .filter(Boolean);

    return regionNames.length > 0 ? regionNames : fallback;
  } catch {
    return fallback;
  }
}

function loadMapsState() {
  const fallback: DesignerSectionState = {
    categories: designerSectionsByKey.mapsEditor.defaultCategories,
    items: [],
  };

  try {
    const storedState = readStoredDesignerSectionPayload("mapsEditor").state;

    return {
      categories: Array.isArray(storedState.categories)
        ? storedState.categories.filter(
            (category): category is string => typeof category === "string"
          )
        : fallback.categories,
      items: syncPlayableMapItems(
        storedState.items.filter(
          (item): item is DesignerItemSeed =>
            typeof item?.id === "string" &&
            typeof item?.name === "string" &&
            typeof item?.category === "string" &&
            Array.isArray(item?.details)
        )
      ),
    };
  } catch {
    return fallback;
  }
}

function saveMapsState(nextState: DesignerSectionState) {
  persistStoredDesignerSectionPayload("mapsEditor", {
    state: nextState,
    version: getPlayableMapsCacheVersion(),
    updatedAt: null,
    updatedByUsername: null,
  });
}

export default function MapEditorPage() {
  const { mapId = "" } = useParams();
  const toast = useToast();
  const { colorMode, toggleColorMode } = useColorMode();
  const { authReady, authenticated, socket } = useAuth();
  const [regionNames, setRegionNames] = useState<string[]>(() => loadRegionNames());
  const [objectCatalog, setObjectCatalog] = useState<MapEditorObjectCatalogItem[]>(
    () => loadObjectCatalog()
  );
  const [pokemonCatalog, setPokemonCatalog] = useState<MapEditorPokemonCatalogItem[]>(
    () => loadPokemonCatalog()
  );
  const [npcCatalog, setNpcCatalog] = useState<MapEditorNpcCatalogItem[]>(() => loadNpcCatalog());
  const [mapsState, setMapsState] = useState<DesignerSectionState>(() => loadMapsState());
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"tiles" | "placements">("placements");
  const [isSaving, setIsSaving] = useState(false);
  // True once the maps room delivered its first sync — before that, an empty
  // local cache means "still loading", not "map not found".
  const [hasMapsSync, setHasMapsSync] = useState(false);
  const [tilesetLoad, setTilesetLoad] = useState<DesignerSectionLoadProgress | null>(
    () => getDesignerSectionLoadProgress("tilesets")
  );
  const [editorData, setEditorData] = useState<PlayableMapEditorData>(() =>
    loadMapEditorData(mapId)
  );
  const [savedEditorData, setSavedEditorData] = useState<PlayableMapEditorData>(() =>
    loadMapEditorData(mapId)
  );

  const mapItem = useMemo(
    () =>
      mapsState.items.find((item) => item.id === mapId) ?? null,
    [mapId, mapsState.items]
  );

  const initialConfig = useMemo(
    () =>
      normalizePlayableMapConfig(mapItem?.playableMapConfig, regionNames),
    [mapItem, regionNames]
  );
  const mapSummaries = useMemo<MapEditorMapSummary[]>(
    () =>
      mapsState.items.map((item) => ({
        id: item.id,
        name: item.name,
        isHouse: item.playableMapConfig?.isHouse === true,
      })),
    [mapsState.items]
  );

  const [cellSize, setCellSize] = useState(String(initialConfig.cellSize));
  const [mapName, setMapName] = useState(mapItem?.name ?? "");
  const [sizePreset, setSizePreset] = useState<DesignerMapSizePreset>(initialConfig.sizePreset);
  const [customWidth, setCustomWidth] = useState(String(initialConfig.width));
  const [customHeight, setCustomHeight] = useState(String(initialConfig.height));
  const [regionName, setRegionName] = useState(initialConfig.regionName);
  const [regionX, setRegionX] = useState(String(initialConfig.regionX));
  const [regionY, setRegionY] = useState(String(initialConfig.regionY));
  const [initialPositionX, setInitialPositionX] = useState(
    initialConfig.initialPositionX === null ? "" : String(initialConfig.initialPositionX)
  );
  const [initialPositionY, setInitialPositionY] = useState(
    initialConfig.initialPositionY === null ? "" : String(initialConfig.initialPositionY)
  );
  const [mapType, setMapType] = useState<DesignerPlayableMapType>(initialConfig.mapType);
  const [backgroundColor, setBackgroundColor] = useState(initialConfig.backgroundColor);
  const [backgroundImageSrc, setBackgroundImageSrc] = useState(
    initialConfig.backgroundImageSrc
  );
  const [backgroundImageMode, setBackgroundImageMode] =
    useState<DesignerPlayableMapBackgroundImageMode>(initialConfig.backgroundImageMode);
  const [isInitialMap, setIsInitialMap] = useState(initialConfig.isInitialMap);
  const [isHouse, setIsHouse] = useState(initialConfig.isHouse === true);
  const [bgm, setBgm] = useState(initialConfig.bgm ?? "");
  const [bgs, setBgs] = useState(initialConfig.bgs ?? "");
  const [battleBack, setBattleBack] = useState(initialConfig.battleBack ?? "");
  const [environment, setEnvironment] = useState(initialConfig.environment ?? "");
  const [outdoor, setOutdoor] = useState(initialConfig.outdoor === true);
  const [showArea, setShowArea] = useState(initialConfig.showArea === true);
  const [mapFlags, setMapFlags] = useState((initialConfig.flags ?? []).join(", "));
  const [mapPositionX, setMapPositionX] = useState(
    initialConfig.mapPosition ? String(initialConfig.mapPosition.x) : ""
  );
  const [mapPositionY, setMapPositionY] = useState(
    initialConfig.mapPosition ? String(initialConfig.mapPosition.y) : ""
  );
  const [healingSpotMapId, setHealingSpotMapId] = useState(
    initialConfig.healingSpot?.mapId ?? ""
  );
  const [healingSpotX, setHealingSpotX] = useState(
    initialConfig.healingSpot ? String(initialConfig.healingSpot.x) : ""
  );
  const [healingSpotY, setHealingSpotY] = useState(
    initialConfig.healingSpot ? String(initialConfig.healingSpot.y) : ""
  );
  const [connections, setConnections] = useState<PlayableMapConnection[]>(
    initialConfig.connections ?? []
  );

  useEffect(() => {
    const nextConfig = normalizePlayableMapConfig(mapItem?.playableMapConfig, regionNames);

    setMapName(mapItem?.name ?? "");
    setCellSize(String(nextConfig.cellSize));
    setSizePreset(nextConfig.sizePreset);
    setCustomWidth(String(nextConfig.width));
    setCustomHeight(String(nextConfig.height));
    setRegionName(nextConfig.regionName);
    setRegionX(String(nextConfig.regionX));
    setRegionY(String(nextConfig.regionY));
    setInitialPositionX(
      nextConfig.initialPositionX === null ? "" : String(nextConfig.initialPositionX)
    );
    setInitialPositionY(
      nextConfig.initialPositionY === null ? "" : String(nextConfig.initialPositionY)
    );
    setMapType(nextConfig.mapType);
    setBackgroundColor(nextConfig.backgroundColor);
    setBackgroundImageSrc(nextConfig.backgroundImageSrc);
    setBackgroundImageMode(nextConfig.backgroundImageMode);
    setIsInitialMap(nextConfig.isInitialMap);
    setIsHouse(nextConfig.isHouse === true);
    setBgm(nextConfig.bgm ?? "");
    setBgs(nextConfig.bgs ?? "");
    setBattleBack(nextConfig.battleBack ?? "");
    setEnvironment(nextConfig.environment ?? "");
    setOutdoor(nextConfig.outdoor === true);
    setShowArea(nextConfig.showArea === true);
    setMapFlags((nextConfig.flags ?? []).join(", "));
    setMapPositionX(nextConfig.mapPosition ? String(nextConfig.mapPosition.x) : "");
    setMapPositionY(nextConfig.mapPosition ? String(nextConfig.mapPosition.y) : "");
    setHealingSpotMapId(nextConfig.healingSpot?.mapId ?? "");
    setHealingSpotX(nextConfig.healingSpot ? String(nextConfig.healingSpot.x) : "");
    setHealingSpotY(nextConfig.healingSpot ? String(nextConfig.healingSpot.y) : "");
    setConnections(nextConfig.connections ?? []);
  }, [initialConfig, mapItem, regionNames]);

  useEffect(() => {
    const nextEditorData = loadMapEditorData(mapId);

    setEditorData(nextEditorData);
    setSavedEditorData(nextEditorData);
  }, [mapId]);

  const resolvedDimensions = useMemo(() => {
    const selectedPreset = MAP_SIZE_OPTIONS.find((option) => option.value === sizePreset);

    if (sizePreset !== "custom") {
      return {
        width: selectedPreset?.width ?? 500,
        height: selectedPreset?.height ?? 500,
      };
    }

    return {
      width: parseMapDimension(customWidth),
      height: parseMapDimension(customHeight),
    };
  }, [customHeight, customWidth, sizePreset]);

  const previewConfig = normalizePlayableMapConfig(mapItem?.playableMapConfig, regionNames);
  const mapPixelWidth = previewConfig.width * previewConfig.cellSize;
  const mapPixelHeight = previewConfig.height * previewConfig.cellSize;
  const mapSurfaceBackgroundStyle = getMapSurfaceBackgroundStyle(previewConfig);
  // The payload can be megabytes (base64 layers, baked chunks), so only
  // re-serialize when one of the references actually changes instead of on
  // every render. The ref lets long-lived socket/event handlers read the
  // current dirty state without re-subscribing on each edit.
  const isEditorDirty = useMemo(
    () => JSON.stringify(editorData) !== JSON.stringify(savedEditorData),
    [editorData, savedEditorData]
  );
  const isEditorDirtyRef = useRef(isEditorDirty);
  isEditorDirtyRef.current = isEditorDirty;

  const isValidProperties =
    MAP_CELL_SIZE_OPTIONS.includes(Number.parseInt(cellSize, 10) as 8 | 16 | 32 | 64 | 128) &&
    !!regionName &&
    resolvedDimensions.width !== null &&
    resolvedDimensions.height !== null &&
    hasValidOptionalCoordinatePair(initialPositionX, initialPositionY);

  useEffect(() => {
    const handleDesignerCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;

      if (!detail?.sectionKey) {
        return;
      }

      if (detail.sectionKey === "objects") {
        setObjectCatalog(loadObjectCatalog());
        return;
      }

      if (detail.sectionKey === "pokemons") {
        setPokemonCatalog(loadPokemonCatalog());
        return;
      }

      if (detail.sectionKey === "npcs") {
        setNpcCatalog(loadNpcCatalog());
        return;
      }

      if (detail.sectionKey === "players") {
        setNpcCatalog(loadNpcCatalog());
        return;
      }

      if (detail.sectionKey === "regions") {
        setRegionNames(loadRegionNames());
        return;
      }

      if (detail.sectionKey !== "mapsEditor") {
        return;
      }

      const nextMapsState = loadMapsState();

      setMapsState(nextMapsState);

      if (isEditorDirtyRef.current) {
        return;
      }

      const nextEditorData = loadMapEditorData(mapId);

      setEditorData(nextEditorData);
      setSavedEditorData(nextEditorData);
    };

    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);

    return () => {
      window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);
    };
  }, [mapId]);

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return;
    }

    const joinMapsRoom = () => {
      // seedState only bootstraps an empty server store; once we hold a synced
      // version the server has state, so skip the multi-MB snapshot upload.
      const cachedVersion = getPlayableMapsCacheVersion();

      socket.emit("designer:maps:join", {
        version: cachedVersion,
        seedState:
          cachedVersion === null ? buildPlayableMapsSnapshot(loadPlayableMapsState()) : undefined,
      });
    };

    const handleMapsState = (payload: unknown) => {
      const syncPayload = sanitizePlayableMapsSyncPayload(payload);

      if (!syncPayload) {
        return;
      }

      setHasMapsSync(true);
      persistPlayableMapsSyncPayload(syncPayload);

      const nextMapsState = {
        categories: syncPayload.state.categories,
        items: syncPayload.state.items,
      };

      setMapsState(nextMapsState);
      saveMapsState(nextMapsState);

      const nextEditorData = syncPayload.state.editorDataByMapId[mapId];

      if (nextEditorData && !isEditorDirtyRef.current) {
        setEditorData(nextEditorData);
        setSavedEditorData(nextEditorData);
      }
    };

    const handleMapsError = ({ message }: { message: string }) => {
      toast({
        title: message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    };

    // When our cached version already matches, the server answers the join
    // with a version stub instead of the full state: the local cache IS the
    // sync, so a map that is still missing from it is really gone.
    const handleMapsVersion = (payload: { hasState?: boolean; version: number | null }) => {
      if (payload?.hasState === true && payload.version === getPlayableMapsCacheVersion()) {
        setHasMapsSync(true);
        setMapsState(loadMapsState());
      }
    };

    socket.on("playableMaps:state", handleMapsState);
    socket.on("playableMaps:version", handleMapsVersion);
    socket.on("playableMaps:error", handleMapsError);
    socket.on("connect", joinMapsRoom);

    if (!socket.connected) {
      socket.connect();
    } else {
      joinMapsRoom();
    }

    return () => {
      socket.emit("designer:maps:leave");
      socket.off("playableMaps:state", handleMapsState);
      socket.off("playableMaps:version", handleMapsVersion);
      socket.off("playableMaps:error", handleMapsError);
      socket.off("connect", joinMapsRoom);
    };
  }, [authReady, authenticated, mapId, socket, toast]);

  // The tile editor and the save-time bake read tileset profiles from the
  // designer cache. Tilesets are a heavy section (~36MB of inline images)
  // that never travels the websocket: the socket join only subscribes to
  // version stubs, the state itself is downloaded from the HTTP endpoint
  // (DesignerDataBootstrap refetches it when a stub announces a new
  // version). The cache-updated event then refreshes TileMapEditor.
  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return;
    }

    const joinTilesetsRoom = () => {
      socket.emit("designer:section:join", {
        sectionKey: "tilesets",
        version: readStoredDesignerSectionPayload("tilesets").version,
      });
    };

    socket.on("connect", joinTilesetsRoom);

    if (socket.connected) {
      joinTilesetsRoom();
    }

    void ensureDesignerSectionOverHttp("tilesets");

    return () => {
      socket.emit("designer:section:leave", { sectionKey: "tilesets" });
      socket.off("connect", joinTilesetsRoom);
    };
  }, [authReady, authenticated, socket]);

  useEffect(() => {
    return subscribeDesignerSectionLoad((progress) => {
      if (progress.sectionKey === "tilesets") {
        setTilesetLoad(progress);
      }
    });
  }, []);

  const publishMapsState = (nextMapsState: DesignerSectionState) => {
    if (!socket || !authenticated) {
      return;
    }

    socket.emit("designer:maps:update", {
      state: buildPlayableMapsSnapshot(nextMapsState),
    });
  };

  // Publish and wait for the server's answer: the save handler echoes
  // "playableMaps:state" on success and "playableMaps:error" on failure. A
  // fire-and-forget emit used to report "saved" even when the multi-MB packet
  // never reached the server (disconnect mid-send), silently losing the edit
  // on the next session.
  const publishMapsStateConfirmed = (nextMapsState: DesignerSectionState) =>
    new Promise<"confirmed" | "error" | "unconfirmed">((resolve) => {
      if (!socket || !authenticated) {
        resolve("unconfirmed");
        return;
      }

      const timeout = window.setTimeout(() => {
        cleanup();
        resolve("unconfirmed");
      }, 30000);

      const handleState = () => {
        cleanup();
        resolve("confirmed");
      };

      const handleError = () => {
        cleanup();
        resolve("error");
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        socket.off("playableMaps:state", handleState);
        socket.off("playableMaps:error", handleError);
      };

      socket.on("playableMaps:state", handleState);
      socket.on("playableMaps:error", handleError);
      socket.emit("designer:maps:update", {
        state: buildPlayableMapsSnapshot(nextMapsState),
      });
    });

  const handleToolbarSave = async () => {
    if (!mapId || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      // The canvas stays editable while the async bake/publish run below, so
      // work only on this snapshot and never overwrite `editorData` with it —
      // edits made meanwhile must survive as new unsaved changes.
      const snapshot = editorData;
      let nextEditorData = snapshot;

      if (snapshot.tileMap) {
        try {
          const bakeResult = await bakeTileMapForSave(mapId, snapshot.tileMap, socket);

          nextEditorData = { ...snapshot, tileMap: bakeResult.tileMap };
          setEditorData((current) =>
            current === snapshot
              ? nextEditorData
              : current.tileMap
                ? { ...current, tileMap: { ...current.tileMap, baked: bakeResult.tileMap.baked } }
                : current
          );

          if (!bakeResult.uploaded) {
            toast({
              title: "Baked map surfaces stored inline.",
              description:
                "The asset upload was unavailable, so the baked images were embedded in the map data.",
              status: "warning",
              duration: 4000,
              isClosable: true,
              position: "top",
            });
          }
        } catch (error) {
          toast({
            title: "Unable to bake the tile map.",
            description: error instanceof Error ? error.message : "Unknown baking error.",
            status: "error",
            duration: 5000,
            isClosable: true,
            position: "top",
          });
          return;
        }
      }

      saveMapEditorData(mapId, nextEditorData);

      const outcome = await publishMapsStateConfirmed(mapsState);

      if (outcome !== "confirmed") {
        // Leave savedEditorData untouched so the editor stays dirty and the
        // Save button re-publishes. On "error" the playableMaps:error handler
        // already showed the server's message.
        if (outcome === "unconfirmed") {
          toast({
            title: "The server did not confirm the save.",
            description:
              "The map data was sent but no confirmation arrived. Keep this tab open and press Save again.",
            status: "warning",
            duration: 6000,
            isClosable: true,
            position: "top",
          });
        }
        return;
      }

      setSavedEditorData(nextEditorData);
      toast({
        title: "Map editor changes saved.",
        description: `${nextEditorData.objects.length} objects, ${nextEditorData.portals.length} portals, ${nextEditorData.npcs.length} NPCs${
          nextEditorData.tileMap ? ", and the baked tile map" : ""
        } stored for this map.`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProperties = () => {
    if (
      !mapItem ||
      !mapName.trim() ||
      !isValidProperties ||
      resolvedDimensions.width === null ||
      resolvedDimensions.height === null
    ) {
      return;
    }

    const previousConfig: Partial<DesignerPlayableMapConfig> =
      mapItem.playableMapConfig ?? {};
    const parsedMapPositionX = parseOptionalMapCoordinate(mapPositionX);
    const parsedMapPositionY = parseOptionalMapCoordinate(mapPositionY);
    const parsedHealingSpotX = parseOptionalMapCoordinate(healingSpotX);
    const parsedHealingSpotY = parseOptionalMapCoordinate(healingSpotY);
    const parsedFlags = mapFlags
      .split(",")
      .map((flag) => flag.trim())
      .filter(Boolean);

    // Spread the stored config first: fields without a form control here
    // (essentials provenance, tileset linkage, ...) must survive a
    // properties save instead of being silently wiped.
    const nextConfig: DesignerPlayableMapConfig = {
      ...previousConfig,
      cellSize: Number.parseInt(cellSize, 10),
      sizePreset,
      width: resolvedDimensions.width,
      height: resolvedDimensions.height,
      isInitialMap,
      isHouse: isHouse ? true : undefined,
      initialPositionX: parseOptionalMapCoordinate(initialPositionX),
      initialPositionY: parseOptionalMapCoordinate(initialPositionY),
      regionName,
      regionX: parseMapCoordinate(regionX),
      regionY: parseMapCoordinate(regionY),
      mapType,
      backgroundColor: normalizeBackgroundColor(backgroundColor),
      backgroundImageSrc,
      backgroundImageMode,
      bgm: bgm.trim() || undefined,
      bgs: bgs.trim() || undefined,
      battleBack: battleBack.trim() || undefined,
      environment: environment.trim() || undefined,
      outdoor,
      showArea,
      flags: parsedFlags.length > 0 ? parsedFlags : undefined,
      mapPosition:
        parsedMapPositionX !== null && parsedMapPositionY !== null
          ? {
              regionId: previousConfig.mapPosition?.regionId,
              x: parsedMapPositionX,
              y: parsedMapPositionY,
            }
          : undefined,
      healingSpot:
        healingSpotMapId && parsedHealingSpotX !== null && parsedHealingSpotY !== null
          ? {
              mapId: healingSpotMapId,
              x: parsedHealingSpotX,
              y: parsedHealingSpotY,
              direction: previousConfig.healingSpot?.direction,
            }
          : undefined,
      connections: connections.filter((connection) => connection.targetMapId),
    };

    const nextItems = mapsState.items.map((item) =>
      item.id === mapItem.id
        ? {
            ...item,
            name: mapName.trim(),
            details: designerSectionsByKey.mapsEditor.createDetails(
              mapName.trim(),
              item.category,
              1,
              { playableMapConfig: nextConfig }
            ),
            playableMapConfig: nextConfig,
          }
        : item
    );

    const nextState: DesignerSectionState = {
      ...mapsState,
      items: isInitialMap ? syncPlayableMapItems(nextItems) : nextItems,
    };

    setMapsState(nextState);
    saveMapsState(nextState);
    publishMapsState(nextState);
    setIsPropertiesOpen(false);
    toast({
      title: "Map properties saved.",
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
  };

  if (!mapItem) {
    // An empty local cache before the first maps sync means the data is
    // still on its way, not that the map is missing.
    if (!hasMapsSync) {
      return (
        <Box minH="100vh" bg="editor.pageMuted" px={6} py={8}>
          <Heading size="md" color="editor.heading" mb={4}>
            Loading map data...
          </Heading>
          <Progress
            size="sm"
            maxW="420px"
            borderRadius="full"
            colorScheme="green"
            isIndeterminate
          />
        </Box>
      );
    }

    return (
      <Box minH="100vh" bg="editor.pageMuted" px={6} py={8}>
        <Heading size="md" color="editor.heading" mb={4}>
          Map not found
        </Heading>
        <Button as={RouterLink} to="/designer/maps-editor" colorScheme="green" variant="outline">
          Back
        </Button>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="editor.page">
      <Flex
        position="sticky"
        top={0}
        zIndex={2}
        justify="space-between"
        align="center"
        gap={4}
        px={{ base: 4, md: 6 }}
        py={4}
        bg="editor.overlay"
        borderBottom="1px solid" borderBottomColor="editor.borderMuted"
        backdropFilter="blur(10px)"
      >
        <Box>
          <Text
            fontSize="xs"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.16em"
            color="editor.accentMuted"
            mb={1}
          >
            Map Editor
          </Text>
          <Heading size="md" color="editor.heading">
            {mapName || mapItem.name}
          </Heading>
          <Text mt={1} fontSize="sm" color={isEditorDirty ? "editor.warning" : "editor.textMuted"}>
            {isEditorDirty ? "Unsaved editor changes" : "Editor changes saved"}
          </Text>
        </Box>
        <Flex wrap="wrap" gap={3}>
          <Button
            variant="outline"
            borderColor="editor.borderAccent"
            color="editor.accent"
            onClick={toggleColorMode}
            title="Toggle light/dark theme"
          >
            {colorMode === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button
            onClick={handleToolbarSave}
            colorScheme="green"
            isDisabled={!isEditorDirty}
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save
          </Button>
          <Button
            variant="outline"
            borderColor="editor.borderAccent"
            color="editor.accent"
            onClick={() => setIsPropertiesOpen(true)}
          >
            Edit Map Properties
          </Button>
          <Button
            as={RouterLink}
            to="/designer/maps-editor"
            variant="outline"
            borderColor="editor.borderAccent"
            color="editor.accent"
          >
            Back
          </Button>
          <Button
            as={RouterLink}
            to="/"
            variant="outline"
            borderColor="editor.borderAccent"
            color="editor.accent"
          >
            Exit to Game
          </Button>
        </Flex>
      </Flex>

      {tilesetLoad && tilesetLoad.phase !== "done" ? (
        <Box px={{ base: 4, md: 6 }} pt={4}>
          <Box
            borderRadius="16px"
            border="1px solid"
            borderColor="editor.borderFaint"
            bg="editor.surface"
            px={4}
            py={3}
          >
            <Flex justify="space-between" align="center" gap={3} mb={2}>
              <Text fontSize="sm" color="editor.text">
                {tilesetLoad.phase === "error"
                  ? "Unable to load the tileset catalog."
                  : tilesetLoad.phase === "parsing"
                    ? "Preparing tilesets..."
                    : tilesetLoad.totalBytes
                      ? `Loading tilesets — ${formatMegabytes(tilesetLoad.loadedBytes)} of ${formatMegabytes(tilesetLoad.totalBytes)}`
                      : `Loading tilesets — ${formatMegabytes(tilesetLoad.loadedBytes)}`}
              </Text>
              {tilesetLoad.phase === "error" ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void fetchDesignerSectionOverHttp("tilesets")}
                >
                  Retry
                </Button>
              ) : null}
            </Flex>
            {tilesetLoad.phase === "error" ? null : (
              <Progress
                size="sm"
                borderRadius="full"
                colorScheme="green"
                isIndeterminate={tilesetLoad.phase === "parsing" || !tilesetLoad.totalBytes}
                value={
                  tilesetLoad.totalBytes
                    ? (tilesetLoad.loadedBytes / tilesetLoad.totalBytes) * 100
                    : undefined
                }
              />
            )}
          </Box>
        </Box>
      ) : null}

      <Box px={{ base: 4, md: 6 }} py={6}>
        <Box
          minH="calc(100vh - 120px)"
          borderRadius="24px"
          border="1px solid" borderColor="editor.borderFaint"
          bg="editor.surface"
          overflow="hidden"
        >
          <Flex
            justify="space-between"
            align={{ base: "flex-start", lg: "center" }}
            direction={{ base: "column", lg: "row" }}
            gap={3}
            px={{ base: 4, md: 5 }}
            py={4}
            borderBottom="1px solid" borderBottomColor="editor.borderFaint"
            bg="editor.page"
          >
            <Box>
              <Text
                fontSize="xs"
                fontWeight="700"
                textTransform="uppercase"
                letterSpacing="0.14em"
                color="editor.accentMuted"
                mb={1}
              >
                Map Surface
              </Text>
              <Text fontSize="sm" color="editor.text">
                {previewConfig.width} x {previewConfig.height} cells at {previewConfig.cellSize}px
                each, rendered as {mapPixelWidth} x {mapPixelHeight}px.
              </Text>
            </Box>
            <Flex gap={2} align="center">
              <Button
                size="sm"
                variant={editorMode === "tiles" ? "solid" : "outline"}
                colorScheme="green"
                onClick={() => setEditorMode("tiles")}
              >
                Tiles
              </Button>
              <Button
                size="sm"
                variant={editorMode === "placements" ? "solid" : "outline"}
                colorScheme="green"
                onClick={() => setEditorMode("placements")}
              >
                Placements
              </Button>
              <Text fontSize="sm" color="editor.textFaint">
                {editorMode === "tiles"
                  ? "RPG Maker XP style tile layers with autotiles, passability, and baked surfaces."
                  : "Selector, grass, object placement, portal tools, and NPC placement all edit the saved map editor data."}
              </Text>
            </Flex>
          </Flex>

          <Box p={{ base: 4, md: 5 }}>
            {editorMode === "tiles" ? (
              <TileMapEditor
                mapWidth={previewConfig.width}
                mapHeight={previewConfig.height}
                cellSize={previewConfig.cellSize}
                value={editorData}
                onChange={setEditorData}
              />
            ) : (
              <PlayableMapEditorCanvas
                cellSize={previewConfig.cellSize}
                mapWidth={previewConfig.width}
                mapHeight={previewConfig.height}
                pixelWidth={mapPixelWidth}
                pixelHeight={mapPixelHeight}
                backgroundStyle={mapSurfaceBackgroundStyle}
                objectCatalog={objectCatalog}
                pokemonCatalog={pokemonCatalog}
                npcCatalog={npcCatalog}
                maps={mapSummaries}
                currentMapId={mapId}
                value={editorData}
                onChange={setEditorData}
                isDirty={isEditorDirty}
              />
            )}
          </Box>
        </Box>
      </Box>

      <Modal
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalOverlay bg="blackAlpha.400" />
        <ModalContent
          borderRadius="24px"
          bg="editor.raised"
          overflow="hidden"
          maxH="calc(100vh - 2rem)"
          boxShadow="0 28px 70px rgba(24, 34, 20, 0.24)"
        >
          <ModalHeader bg="editor.raised" borderBottom="1px solid" borderBottomColor="editor.borderAccentFaint">
            Edit Map Properties
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="editor.raised" overflowY="auto">
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input value={mapName} onChange={(event) => setMapName(event.target.value)} />
              </FormControl>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Cell Size</FormLabel>
                  <Select value={cellSize} onChange={(event) => setCellSize(event.target.value)}>
                    {MAP_CELL_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Map Size</FormLabel>
                  <Select
                    value={sizePreset}
                    onChange={(event) =>
                      setSizePreset(event.target.value as DesignerMapSizePreset)
                    }
                  >
                    {MAP_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>
              {sizePreset === "custom" ? (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired isInvalid={customWidth !== "" && parseMapDimension(customWidth) === null}>
                    <FormLabel>Custom Width</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={customWidth}
                      onChange={(event) =>
                        setCustomWidth(normalizeMapDimension(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormControl isRequired isInvalid={customHeight !== "" && parseMapDimension(customHeight) === null}>
                    <FormLabel>Custom Height</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={customHeight}
                      onChange={(event) =>
                        setCustomHeight(normalizeMapDimension(event.target.value))
                      }
                    />
                  </FormControl>
                </SimpleGrid>
              ) : null}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <FormLabel mb={1}>Initial Game Map</FormLabel>
                    <Text fontSize="sm" color="editor.textSubtle">
                      New players start on this map unless the server restores a saved location.
                    </Text>
                  </Box>
                  <Switch
                    colorScheme="green"
                    isChecked={isInitialMap}
                    onChange={(event) => setIsInitialMap(event.target.checked)}
                  />
                </FormControl>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <FormLabel mb={1}>House Template</FormLabel>
                    <Text fontSize="sm" color="editor.textSubtle">
                      Apartments behind a House Door cell instance this map per owner. Players spawn at
                      the Initial Position; any portal on it leads back out.
                    </Text>
                  </Box>
                  <Switch
                    colorScheme="purple"
                    isChecked={isHouse}
                    onChange={(event) => setIsHouse(event.target.checked)}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Region</FormLabel>
                  <Select
                    value={regionName}
                    onChange={(event) => setRegionName(event.target.value)}
                  >
                    {regionNames.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Map Type</FormLabel>
                  <Select
                    value={mapType}
                    onChange={(event) =>
                      setMapType(event.target.value as DesignerPlayableMapType)
                    }
                  >
                    {MAP_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {formatMapTypeLabel(option)}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Region X Position</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={regionX}
                    onChange={(event) => setRegionX(event.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Region Y Position</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={regionY}
                    onChange={(event) => setRegionY(event.target.value)}
                  />
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl
                  isInvalid={
                    initialPositionX.trim() !== "" &&
                    parseOptionalMapCoordinate(initialPositionX) === null
                  }
                >
                  <FormLabel>Initial Position X</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={initialPositionX}
                    onChange={(event) => setInitialPositionX(event.target.value)}
                    placeholder="Leave blank to use center"
                  />
                </FormControl>
                <FormControl
                  isInvalid={
                    initialPositionY.trim() !== "" &&
                    parseOptionalMapCoordinate(initialPositionY) === null
                  }
                >
                  <FormLabel>Initial Position Y</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={initialPositionY}
                    onChange={(event) => setInitialPositionY(event.target.value)}
                    placeholder="Leave blank to use center"
                  />
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Background Color</FormLabel>
                  <Input
                    type="color"
                    value={normalizeBackgroundColor(backgroundColor)}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    p={1}
                    h="44px"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Background Image</FormLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    p={1}
                    onChange={(event) => readBackgroundImage(event, setBackgroundImageSrc)}
                  />
                </FormControl>
              </SimpleGrid>
              {backgroundImageSrc ? (
                <FormControl>
                  <FormLabel>Background Image Mode</FormLabel>
                  <Select
                    value={backgroundImageMode}
                    onChange={(event) =>
                      setBackgroundImageMode(
                        event.target.value as DesignerPlayableMapBackgroundImageMode
                      )
                    }
                  >
                    {MAP_BACKGROUND_IMAGE_MODES.map((option) => (
                      <option key={option} value={option}>
                        {option === "centered"
                          ? "Centered"
                          : option === "stretched"
                            ? "Stretched"
                            : "Repeat"}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} gap={3} wrap="wrap">
                <Text fontSize="sm" color="editor.textSubtle">
                  The saved background fills the map editor surface automatically.
                </Text>
                {backgroundImageSrc ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBackgroundImageSrc("")}
                  >
                    Remove Background Image
                  </Button>
                ) : null}
              </Flex>
              <Box
                minH="140px"
                borderRadius="18px"
                border="1px solid" borderColor="editor.borderAccentMuted"
                sx={getMapSurfaceBackgroundStyle({
                  ...initialConfig,
                  backgroundColor,
                  backgroundImageSrc,
                  backgroundImageMode,
                })}
              />

              <Heading size="sm" color="editor.heading" pt={2}>
                Audio & Battle
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Background Music (BGM)</FormLabel>
                  <Input
                    value={bgm}
                    onChange={(event) => setBgm(event.target.value)}
                    placeholder="Audio track name, blank for none"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Background Sound (BGS)</FormLabel>
                  <Input
                    value={bgs}
                    onChange={(event) => setBgs(event.target.value)}
                    placeholder="Ambient loop name, blank for none"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Battle Background</FormLabel>
                  <Input
                    value={battleBack}
                    onChange={(event) => setBattleBack(event.target.value)}
                    placeholder="battleBack name, blank for map-type default"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Environment</FormLabel>
                  <Input
                    value={environment}
                    onChange={(event) => setEnvironment(event.target.value)}
                    placeholder="Grass, Cave, Sand... blank for none"
                  />
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel mb={0}>Outdoor Map</FormLabel>
                  <Switch
                    colorScheme="green"
                    isChecked={outdoor}
                    onChange={(event) => setOutdoor(event.target.checked)}
                  />
                </FormControl>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel mb={0}>Show Area Name</FormLabel>
                  <Switch
                    colorScheme="green"
                    isChecked={showArea}
                    onChange={(event) => setShowArea(event.target.checked)}
                  />
                </FormControl>
              </SimpleGrid>
              <FormControl>
                <FormLabel>Flags</FormLabel>
                <Input
                  value={mapFlags}
                  onChange={(event) => setMapFlags(event.target.value)}
                  placeholder="Comma-separated map flags"
                />
              </FormControl>

              <Heading size="sm" color="editor.heading" pt={2}>
                Town Map & Healing
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl
                  isInvalid={
                    mapPositionX.trim() !== "" &&
                    parseOptionalMapCoordinate(mapPositionX) === null
                  }
                >
                  <FormLabel>Town Map X</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={mapPositionX}
                    onChange={(event) => setMapPositionX(event.target.value)}
                    placeholder="Blank to hide from the town map"
                  />
                </FormControl>
                <FormControl
                  isInvalid={
                    mapPositionY.trim() !== "" &&
                    parseOptionalMapCoordinate(mapPositionY) === null
                  }
                >
                  <FormLabel>Town Map Y</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={mapPositionY}
                    onChange={(event) => setMapPositionY(event.target.value)}
                    placeholder="Blank to hide from the town map"
                  />
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <FormControl>
                  <FormLabel>Healing Spot Map</FormLabel>
                  <Select
                    value={healingSpotMapId}
                    onChange={(event) => setHealingSpotMapId(event.target.value)}
                  >
                    <option value="">None</option>
                    {mapSummaries.map((summary) => (
                      <option key={summary.id} value={summary.id}>
                        {summary.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Healing Spot X</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={healingSpotX}
                    onChange={(event) => setHealingSpotX(event.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Healing Spot Y</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={healingSpotY}
                    onChange={(event) => setHealingSpotY(event.target.value)}
                  />
                </FormControl>
              </SimpleGrid>
              {healingSpotMapId &&
              (parseOptionalMapCoordinate(healingSpotX) === null ||
                parseOptionalMapCoordinate(healingSpotY) === null) ? (
                <Text fontSize="sm" color="editor.danger">
                  Enter both healing spot coordinates, or set the map to None to clear it.
                </Text>
              ) : null}

              <Heading size="sm" color="editor.heading" pt={2}>
                Map Connections
              </Heading>
              <Text fontSize="sm" color="editor.textSubtle">
                Stitch neighboring maps edge to edge. The offset is the neighbor's
                top-left cell relative to this map's top-left cell.
              </Text>
              {connections.map((connection, index) => (
                <Flex key={index} gap={3} align="flex-end" wrap="wrap">
                  <FormControl maxW="120px">
                    <FormLabel>Direction</FormLabel>
                    <Select
                      value={connection.direction}
                      onChange={(event) =>
                        setConnections((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  direction: event.target
                                    .value as PlayableMapConnection["direction"],
                                }
                              : entry
                          )
                        )
                      }
                    >
                      {MAP_CONNECTION_DIRECTIONS.map((direction) => (
                        <option key={direction} value={direction}>
                          {direction}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl flex="1" minW="160px">
                    <FormLabel>Target Map</FormLabel>
                    <Select
                      value={connection.targetMapId}
                      onChange={(event) =>
                        setConnections((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, targetMapId: event.target.value }
                              : entry
                          )
                        )
                      }
                    >
                      <option value="">Select a map</option>
                      {mapSummaries
                        .filter((summary) => summary.id !== mapId)
                        .map((summary) => (
                          <option key={summary.id} value={summary.id}>
                            {summary.name}
                          </option>
                        ))}
                    </Select>
                  </FormControl>
                  <FormControl maxW="110px">
                    <FormLabel>Offset X</FormLabel>
                    <Input
                      type="number"
                      step={1}
                      value={String(connection.offsetXCells)}
                      onChange={(event) =>
                        setConnections((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  offsetXCells: parseMapCoordinate(event.target.value),
                                }
                              : entry
                          )
                        )
                      }
                    />
                  </FormControl>
                  <FormControl maxW="110px">
                    <FormLabel>Offset Y</FormLabel>
                    <Input
                      type="number"
                      step={1}
                      value={String(connection.offsetYCells)}
                      onChange={(event) =>
                        setConnections((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  offsetYCells: parseMapCoordinate(event.target.value),
                                }
                              : entry
                          )
                        )
                      }
                    />
                  </FormControl>
                  <Button
                    variant="outline"
                    colorScheme="red"
                    onClick={() =>
                      setConnections((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index)
                      )
                    }
                  >
                    Remove
                  </Button>
                </Flex>
              ))}
              <Button
                alignSelf="flex-start"
                size="sm"
                variant="outline"
                onClick={() =>
                  setConnections((current) => [
                    ...current,
                    {
                      direction: "north",
                      targetMapId: "",
                      offsetXCells: 0,
                      offsetYCells: 0,
                    },
                  ])
                }
              >
                Add Connection
              </Button>

              <Text fontSize="sm" color="editor.textSubtle">
                Initial game map: {isInitialMap ? "Yes" : "No"}
              </Text>
              <Text fontSize="sm" color="editor.textSubtle">
                Initial position:{" "}
                {parseOptionalMapCoordinate(initialPositionX) !== null &&
                parseOptionalMapCoordinate(initialPositionY) !== null
                  ? `${parseOptionalMapCoordinate(initialPositionX)}, ${parseOptionalMapCoordinate(initialPositionY)}`
                  : "Center"}
              </Text>
              {!hasValidOptionalCoordinatePair(initialPositionX, initialPositionY) ? (
                <Text fontSize="sm" color="editor.danger">
                  Enter both initial position coordinates or leave both empty to use the map center.
                </Text>
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter
            gap={3}
            bg="editor.raised"
            borderTop="1px solid" borderTopColor="editor.borderAccentFaint"
          >
            <Button variant="ghost" onClick={() => setIsPropertiesOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleSaveProperties}
              isDisabled={!mapName.trim() || !isValidProperties}
            >
              Save Properties
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
