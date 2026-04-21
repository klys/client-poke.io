import React, { useEffect, useMemo, useState } from "react";
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
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  useToast,
} from "@chakra-ui/react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import {
  buildPlayableMapsSnapshot,
  persistPlayableMapsSyncPayload,
  sanitizePlayableMapsSyncPayload,
} from "../game/playableMapRuntime";
import PlayableMapEditorCanvas, {
  type MapEditorMapSummary,
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
} from "./designerSections";

type DesignerSectionState = {
  categories: string[];
  items: DesignerItemSeed[];
};

const STORAGE_KEY = "designer-demo:mapsEditor";
const OBJECTS_STORAGE_KEY = "designer-demo:objects";
const POKEMONS_STORAGE_KEY = "designer-demo:pokemons";
const REGION_STORAGE_KEY = "designer-demo:regions";
const MAP_EDITOR_STORAGE_PREFIX = "designer-demo:mapEditor:";
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

function buildMapFrameSrc() {
  if (typeof window === "undefined") {
    return "/#/map";
  }

  return `${window.location.pathname}${window.location.search}#/map`;
}

function normalizeBackgroundColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_MAP_BACKGROUND_COLOR;
}

function normalizePlayableMapConfig(
  config: Partial<DesignerPlayableMapConfig> | undefined,
  regionNames: string[]
): DesignerPlayableMapConfig {
  return {
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

function loadObjectCatalog() {
  const fallback = designerSectionsByKey.objects.demoItems.map(normalizeObjectCatalogItem);

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(OBJECTS_STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;

    if (!Array.isArray(parsed.items)) {
      return fallback;
    }

    const items = parsed.items
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
  const fallback = designerSectionsByKey.pokemons.demoItems.map(normalizePokemonCatalogItem);

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(POKEMONS_STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;

    if (!Array.isArray(parsed.items)) {
      return fallback;
    }

    const items = parsed.items
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

function loadMapEditorData(mapId: string) {
  if (typeof window === "undefined" || !mapId) {
    return sanitizePlayableMapEditorData(undefined);
  }

  try {
    const raw = window.localStorage.getItem(getMapEditorStorageKey(mapId));

    return raw ? sanitizePlayableMapEditorData(JSON.parse(raw)) : sanitizePlayableMapEditorData(undefined);
  } catch {
    return sanitizePlayableMapEditorData(undefined);
  }
}

function saveMapEditorData(mapId: string, data: PlayableMapEditorData) {
  if (typeof window === "undefined" || !mapId) {
    return;
  }

  window.localStorage.setItem(getMapEditorStorageKey(mapId), JSON.stringify(data));
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

function loadRegionNames() {
  const fallback = designerSectionsByKey.regions.demoItems.map((item) => item.name);

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;
    const regionNames = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
          .filter(Boolean)
      : [];

    return regionNames.length > 0 ? regionNames : fallback;
  } catch {
    return fallback;
  }
}

function loadMapsState() {
  const fallback: DesignerSectionState = {
    categories: designerSectionsByKey.mapsEditor.defaultCategories,
    items: designerSectionsByKey.mapsEditor.demoItems,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;

    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) {
      return fallback;
    }

    return {
      categories: parsed.categories.filter(
        (category): category is string => typeof category === "string"
      ),
      items: syncPlayableMapItems(
        parsed.items.filter(
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
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export default function MapEditorPage() {
  const { mapId = "" } = useParams();
  const toast = useToast();
  const { authReady, authenticated, socket } = useAuth();
  const regionNames = useMemo(() => loadRegionNames(), []);
  const objectCatalog = useMemo(() => loadObjectCatalog(), []);
  const pokemonCatalog = useMemo(() => loadPokemonCatalog(), []);
  const [mapsState, setMapsState] = useState<DesignerSectionState>(() => loadMapsState());
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [editorData, setEditorData] = useState<PlayableMapEditorData>(() =>
    loadMapEditorData(mapId)
  );
  const [savedEditorData, setSavedEditorData] = useState<PlayableMapEditorData>(() =>
    loadMapEditorData(mapId)
  );

  const mapItem = useMemo(
    () =>
      mapsState.items.find((item) => item.id === mapId) ??
      designerSectionsByKey.mapsEditor.demoItems.find((item) => item.id === mapId) ??
      null,
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
      })),
    [mapsState.items]
  );

  const editorFrameSrc = useMemo(() => buildMapFrameSrc(), []);

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
  const isEditorDirty =
    JSON.stringify(editorData) !== JSON.stringify(savedEditorData);

  const isValidProperties =
    MAP_CELL_SIZE_OPTIONS.includes(Number.parseInt(cellSize, 10) as 8 | 16 | 32 | 64 | 128) &&
    !!regionName &&
    resolvedDimensions.width !== null &&
    resolvedDimensions.height !== null &&
    hasValidOptionalCoordinatePair(initialPositionX, initialPositionY);

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return;
    }

    const joinMapsRoom = () => {
      socket.emit("designer:maps:join", {
        seedState: buildPlayableMapsSnapshot(loadMapsState()),
      });
    };

    const handleMapsState = (payload: unknown) => {
      const syncPayload = sanitizePlayableMapsSyncPayload(payload);

      if (!syncPayload) {
        return;
      }

      persistPlayableMapsSyncPayload(syncPayload);

      const nextMapsState = {
        categories: syncPayload.state.categories,
        items: syncPayload.state.items,
      };

      setMapsState(nextMapsState);
      saveMapsState(nextMapsState);

      const nextEditorData = syncPayload.state.editorDataByMapId[mapId];

      if (nextEditorData && !isEditorDirty) {
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

    socket.on("playableMaps:state", handleMapsState);
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
      socket.off("playableMaps:error", handleMapsError);
      socket.off("connect", joinMapsRoom);
    };
  }, [authReady, authenticated, isEditorDirty, mapId, socket, toast]);

  const publishMapsState = (nextMapsState: DesignerSectionState) => {
    if (!socket || !authenticated) {
      return;
    }

    socket.emit("designer:maps:update", {
      state: buildPlayableMapsSnapshot(nextMapsState),
    });
  };

  const handleToolbarSave = () => {
    if (!mapId) {
      return;
    }

    saveMapEditorData(mapId, editorData);
    setSavedEditorData(editorData);
    publishMapsState(mapsState);
    toast({
      title: "Map editor changes saved.",
      description: `${editorData.objects.length} objects and ${editorData.portals.length} portals stored for this map.`,
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
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

    const nextConfig: DesignerPlayableMapConfig = {
      cellSize: Number.parseInt(cellSize, 10),
      sizePreset,
      width: resolvedDimensions.width,
      height: resolvedDimensions.height,
      isInitialMap,
      initialPositionX: parseOptionalMapCoordinate(initialPositionX),
      initialPositionY: parseOptionalMapCoordinate(initialPositionY),
      regionName,
      regionX: parseMapCoordinate(regionX),
      regionY: parseMapCoordinate(regionY),
      mapType,
      backgroundColor: normalizeBackgroundColor(backgroundColor),
      backgroundImageSrc,
      backgroundImageMode,
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
    return (
      <Box minH="100vh" bg="#f7f7f7" px={6} py={8}>
        <Heading size="md" color="#233127" mb={4}>
          Map not found
        </Heading>
        <Button as={RouterLink} to="/designer/maps-editor" colorScheme="green" variant="outline">
          Back
        </Button>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="#ffffff">
      <Flex
        position="sticky"
        top={0}
        zIndex={2}
        justify="space-between"
        align="center"
        gap={4}
        px={{ base: 4, md: 6 }}
        py={4}
        bg="rgba(255,255,255,0.96)"
        borderBottom="1px solid rgba(35, 49, 39, 0.12)"
        backdropFilter="blur(10px)"
      >
        <Box>
          <Text
            fontSize="xs"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.16em"
            color="#5e7a61"
            mb={1}
          >
            Map Editor
          </Text>
          <Heading size="md" color="#233127">
            {mapName || mapItem.name}
          </Heading>
          <Text mt={1} fontSize="sm" color={isEditorDirty ? "#8b5a20" : "#5f6d61"}>
            {isEditorDirty ? "Unsaved editor changes" : "Editor changes saved"}
          </Text>
        </Box>
        <Flex wrap="wrap" gap={3}>
          <Button onClick={handleToolbarSave} colorScheme="green" isDisabled={!isEditorDirty}>
            Save
          </Button>
          <Button
            variant="outline"
            borderColor="rgba(43, 66, 47, 0.24)"
            color="#2e5b37"
            onClick={() => setIsPropertiesOpen(true)}
          >
            Edit Map Properties
          </Button>
          <Button
            as={RouterLink}
            to="/designer/maps-editor"
            variant="outline"
            borderColor="rgba(43, 66, 47, 0.24)"
            color="#2e5b37"
          >
            Back
          </Button>
        </Flex>
      </Flex>

      <Box px={{ base: 4, md: 6 }} py={6}>
        <Box
          minH="calc(100vh - 120px)"
          borderRadius="24px"
          border="1px solid rgba(35, 49, 39, 0.08)"
          bg="#f8faf7"
          overflow="hidden"
        >
          <Flex
            justify="space-between"
            align={{ base: "flex-start", lg: "center" }}
            direction={{ base: "column", lg: "row" }}
            gap={3}
            px={{ base: 4, md: 5 }}
            py={4}
            borderBottom="1px solid rgba(35, 49, 39, 0.08)"
            bg="#ffffff"
          >
            <Box>
              <Text
                fontSize="xs"
                fontWeight="700"
                textTransform="uppercase"
                letterSpacing="0.14em"
                color="#5e7a61"
                mb={1}
              >
                Map Surface
              </Text>
              <Text fontSize="sm" color="#314636">
                {previewConfig.width} x {previewConfig.height} cells at {previewConfig.cellSize}px
                each, rendered as {mapPixelWidth} x {mapPixelHeight}px.
              </Text>
            </Box>
            <Text fontSize="sm" color="#4d6652">
              Selector, grass, object placement, and portal tools all edit the saved map editor data.
            </Text>
          </Flex>

          <Box p={{ base: 4, md: 5 }}>
            <PlayableMapEditorCanvas
              cellSize={previewConfig.cellSize}
              mapWidth={previewConfig.width}
              mapHeight={previewConfig.height}
              pixelWidth={mapPixelWidth}
              pixelHeight={mapPixelHeight}
              iframeSrc={editorFrameSrc}
              backgroundStyle={mapSurfaceBackgroundStyle}
              objectCatalog={objectCatalog}
              pokemonCatalog={pokemonCatalog}
              maps={mapSummaries}
              currentMapId={mapId}
              value={editorData}
              onChange={setEditorData}
              isDirty={isEditorDirty}
            />
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
          bg="#fffdf8"
          overflow="hidden"
          maxH="calc(100vh - 2rem)"
          boxShadow="0 28px 70px rgba(24, 34, 20, 0.24)"
        >
          <ModalHeader bg="#fffdf8" borderBottom="1px solid rgba(43, 66, 47, 0.08)">
            Edit Map Properties
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="#fffdf8" overflowY="auto">
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
                    <Text fontSize="sm" color="#55645a">
                      New players start on this map unless the server restores a saved location.
                    </Text>
                  </Box>
                  <Switch
                    colorScheme="green"
                    isChecked={isInitialMap}
                    onChange={(event) => setIsInitialMap(event.target.checked)}
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
                <Text fontSize="sm" color="#55645a">
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
                border="1px solid rgba(43, 66, 47, 0.12)"
                sx={getMapSurfaceBackgroundStyle({
                  ...initialConfig,
                  backgroundColor,
                  backgroundImageSrc,
                  backgroundImageMode,
                })}
              />
              <Text fontSize="sm" color="#55645a">
                Initial game map: {isInitialMap ? "Yes" : "No"}
              </Text>
              <Text fontSize="sm" color="#55645a">
                Initial position:{" "}
                {parseOptionalMapCoordinate(initialPositionX) !== null &&
                parseOptionalMapCoordinate(initialPositionY) !== null
                  ? `${parseOptionalMapCoordinate(initialPositionX)}, ${parseOptionalMapCoordinate(initialPositionY)}`
                  : "Center"}
              </Text>
              {!hasValidOptionalCoordinatePair(initialPositionX, initialPositionY) ? (
                <Text fontSize="sm" color="#914335">
                  Enter both initial position coordinates or leave both empty to use the map center.
                </Text>
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter
            gap={3}
            bg="#fffdf8"
            borderTop="1px solid rgba(43, 66, 47, 0.08)"
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
