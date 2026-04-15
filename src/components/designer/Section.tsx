import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  IconButton,
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
  Text,
  useToast,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import {
  DesignerIcon,
  type DesignerPlayableMapBackgroundImageMode,
  type DesignerMapSizePreset,
  type DesignerMapObjectAsset,
  type DesignerMapObjectType,
  type DesignerPlayableMapConfig,
  type DesignerPlayableMapType,
  designerSectionsByKey,
  type DesignerItemSeed,
  type DesignerSectionKey,
} from "./designerSections";

interface DesignerSectionState {
  categories: string[];
  items: DesignerItemSeed[];
}

interface DesignerSectionProps {
  sectionKey: DesignerSectionKey;
}

interface DesignerObjectsSyncPayload {
  state: DesignerSectionState;
  updatedAt: string | null;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
}

const UNCATEGORIZED = "Uncategorized";
const ALL_CATEGORIES = "__all__";
const MAP_OBJECT_TYPES: DesignerMapObjectType[] = [
  "obstacle",
  "mob area",
  "floor",
  "water",
];
const MAP_CELL_SIZE_OPTIONS = [8, 16, 32, 64, 128] as const;
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
const DEFAULT_MAP_OBJECT_TYPE: DesignerMapObjectType = "obstacle";
const DEFAULT_MAP_OBJECT_SIZE = 64;
const DEFAULT_MAP_CELL_SIZE = 32;
const DEFAULT_MAP_SIZE_PRESET: DesignerMapSizePreset = "medium";
const DEFAULT_MAP_TYPE: DesignerPlayableMapType = "grassland";
const MAP_BACKGROUND_IMAGE_MODES: DesignerPlayableMapBackgroundImageMode[] = [
  "repeat",
  "centered",
  "stretched",
];
const DEFAULT_MAP_BACKGROUND_COLOR = "#8bc17f";
const DEFAULT_MAP_BACKGROUND_IMAGE_MODE: DesignerPlayableMapBackgroundImageMode = "repeat";

function createUniqueMapId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `map-${crypto.randomUUID()}`;
  }

  return `map-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

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

function getMapSizePresetOption(sizePreset: DesignerMapSizePreset) {
  return MAP_SIZE_OPTIONS.find((option) => option.value === sizePreset) ?? MAP_SIZE_OPTIONS[1];
}

function resolveMapDimensions(
  sizePreset: DesignerMapSizePreset,
  customWidth: string,
  customHeight: string
) {
  const presetOption = getMapSizePresetOption(sizePreset);

  if (sizePreset !== "custom") {
    return {
      width: presetOption.width ?? 500,
      height: presetOption.height ?? 500,
    };
  }

  return {
    width: parseMapDimension(customWidth),
    height: parseMapDimension(customHeight),
  };
}

function isValidMapSizePreset(value: unknown): value is DesignerMapSizePreset {
  return MAP_SIZE_OPTIONS.some((option) => option.value === value);
}

function isValidPlayableMapType(value: unknown): value is DesignerPlayableMapType {
  return typeof value === "string" && MAP_TYPES.includes(value as DesignerPlayableMapType);
}

function isValidBackgroundImageMode(
  value: unknown
): value is DesignerPlayableMapBackgroundImageMode {
  return (
    typeof value === "string" &&
    MAP_BACKGROUND_IMAGE_MODES.includes(value as DesignerPlayableMapBackgroundImageMode)
  );
}

function normalizeBackgroundColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_MAP_BACKGROUND_COLOR;
}

function getPlayableMapBackgroundStyle(config: {
  backgroundColor: string;
  backgroundImageSrc: string;
  backgroundImageMode: DesignerPlayableMapBackgroundImageMode;
}): React.CSSProperties {
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

function formatMapTypeLabel(value: DesignerPlayableMapType) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMapEditorPath(mapId: string) {
  return `/designer/maps-editor/${mapId}`;
}

function findCategoryName(categories: string[], target: string) {
  const normalizedTarget = normalizeCategoryName(target).toLowerCase();

  return categories.find(
    (category) => normalizeCategoryName(category).toLowerCase() === normalizedTarget
  );
}

function getStorageKey(sectionKey: DesignerSectionKey) {
  return `designer-demo:${sectionKey}`;
}

function isValidMapObjectType(value: unknown): value is DesignerMapObjectType {
  return (
    typeof value === "string" &&
    MAP_OBJECT_TYPES.includes(value as DesignerMapObjectType)
  );
}

function sanitizeMapObjectAsset(value: unknown): DesignerMapObjectAsset | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<DesignerMapObjectAsset>;
  const width =
    typeof candidate.width === "number" && Number.isFinite(candidate.width)
      ? Math.max(1, Math.round(candidate.width))
      : null;
  const height =
    typeof candidate.height === "number" && Number.isFinite(candidate.height)
      ? Math.max(1, Math.round(candidate.height))
      : null;

  if (
    typeof candidate.imageSrc !== "string" ||
    !candidate.imageSrc ||
    width === null ||
    height === null ||
    !isValidMapObjectType(candidate.objectType)
  ) {
    return undefined;
  }

  return {
    imageSrc: candidate.imageSrc,
    width,
    height,
    objectType: candidate.objectType,
  };
}

function sanitizePlayableMapConfig(
  value: unknown,
  regionNames: string[]
): DesignerPlayableMapConfig | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<DesignerPlayableMapConfig>;
  const cellSize =
    typeof candidate.cellSize === "number" && MAP_CELL_SIZE_OPTIONS.includes(candidate.cellSize as 8 | 16 | 32 | 64 | 128)
      ? candidate.cellSize
      : null;
  const width =
    typeof candidate.width === "number" && Number.isFinite(candidate.width) && candidate.width > 0
      ? Math.max(1, Math.round(candidate.width))
      : null;
  const height =
    typeof candidate.height === "number" && Number.isFinite(candidate.height) && candidate.height > 0
      ? Math.max(1, Math.round(candidate.height))
      : null;
  const regionName =
    typeof candidate.regionName === "string" && candidate.regionName.trim().length > 0
      ? candidate.regionName.trim()
      : regionNames[0] ?? "";

  if (
    cellSize === null ||
    width === null ||
    height === null ||
    !isValidMapSizePreset(candidate.sizePreset) ||
    !isValidPlayableMapType(candidate.mapType)
  ) {
    return undefined;
  }

  return {
    cellSize,
    sizePreset: candidate.sizePreset,
    width,
    height,
    regionName,
    regionX:
      typeof candidate.regionX === "number" && Number.isFinite(candidate.regionX)
        ? Math.round(candidate.regionX)
        : 0,
    regionY:
      typeof candidate.regionY === "number" && Number.isFinite(candidate.regionY)
        ? Math.round(candidate.regionY)
        : 0,
    mapType: candidate.mapType,
    backgroundColor: normalizeBackgroundColor(candidate.backgroundColor ?? ""),
    backgroundImageSrc:
      typeof candidate.backgroundImageSrc === "string"
        ? candidate.backgroundImageSrc
        : "",
    backgroundImageMode: isValidBackgroundImageMode(candidate.backgroundImageMode)
      ? candidate.backgroundImageMode
      : DEFAULT_MAP_BACKGROUND_IMAGE_MODE,
  };
}

function loadRegionNames() {
  const fallbackRegions =
    buildInitialState("regions").items.map((item) => item.name).filter(Boolean);

  if (typeof window === "undefined") {
    return fallbackRegions;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey("regions"));
    if (!raw) {
      return fallbackRegions;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;
    const regionNames = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
          .filter(Boolean)
      : [];

    return regionNames.length > 0 ? regionNames : fallbackRegions;
  } catch {
    return fallbackRegions;
  }
}

function buildInitialState(sectionKey: DesignerSectionKey): DesignerSectionState {
  const section = designerSectionsByKey[sectionKey];
  const categorySet = new Set([UNCATEGORIZED, ...section.defaultCategories]);

  section.demoItems.forEach((item) => {
    categorySet.add(item.category || UNCATEGORIZED);
  });

  return {
    categories: Array.from(categorySet),
    items: section.demoItems,
  };
}

function sanitizeSectionState(
  sectionKey: DesignerSectionKey,
  value: unknown
): DesignerSectionState {
  const fallback = buildInitialState(sectionKey);
  const regionNames = loadRegionNames();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const parsed = value as Partial<DesignerSectionState>;
  if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) {
    return fallback;
  }

  const categories = Array.from(
    new Set(
      [UNCATEGORIZED, ...parsed.categories]
        .map((category) => normalizeCategoryName(category))
        .filter(Boolean)
    )
  );

  const items = parsed.items
    .filter(
      (item): item is DesignerItemSeed =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.category === "string" &&
        Array.isArray(item?.details)
    )
    .map((item) => ({
      ...item,
      category: normalizeCategoryName(item.category) || UNCATEGORIZED,
      mapObjectAsset: sanitizeMapObjectAsset(item.mapObjectAsset),
      playableMapConfig: sanitizePlayableMapConfig(item.playableMapConfig, regionNames),
    }));

  items.forEach((item) => categories.push(item.category));

  return {
    categories: Array.from(new Set(categories)),
    items,
  };
}

function loadStoredState(sectionKey: DesignerSectionKey): DesignerSectionState {
  const fallback = buildInitialState(sectionKey);

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(sectionKey));
    if (!raw) {
      return fallback;
    }

    return sanitizeSectionState(sectionKey, JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function buildImportedSectionState(
  sectionKey: DesignerSectionKey,
  value: unknown
): DesignerSectionState | null {
  if (Array.isArray(value)) {
    return sanitizeSectionState(sectionKey, {
      categories: [],
      items: value,
    });
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const nestedValue =
    "state" in candidate
      ? candidate.state
      : "data" in candidate
        ? candidate.data
        : value;

  if (nestedValue !== value) {
    return buildImportedSectionState(sectionKey, nestedValue);
  }

  if (!Array.isArray(candidate.items)) {
    return null;
  }

  return sanitizeSectionState(sectionKey, {
    categories: Array.isArray(candidate.categories) ? candidate.categories : [],
    items: candidate.items,
  });
}

export default function Section({ sectionKey }: DesignerSectionProps) {
  const section = designerSectionsByKey[sectionKey];
  const isObjectsSection = sectionKey === "objects";
  const isMapsSection = sectionKey === "mapsEditor";
  const toast = useToast();
  const { authReady, authenticated, socket } = useAuth();
  const regionNames = useMemo(() => loadRegionNames(), []);
  const [sectionState, setSectionState] = useState<DesignerSectionState>(() =>
    loadStoredState(sectionKey)
  );
  const [isObjectsStateHydrated, setIsObjectsStateHydrated] = useState(
    !isObjectsSection
  );
  const [objectsSyncMeta, setObjectsSyncMeta] = useState<{
    updatedAt: string | null;
    updatedByUsername: string | null;
  }>({
    updatedAt: null,
    updatedByUsername: null,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState(
    sectionState.categories[0] || UNCATEGORIZED
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemCategory, setEditItemCategory] = useState(
    sectionState.categories[0] || UNCATEGORIZED
  );
  const [moveCategory, setMoveCategory] = useState(
    sectionState.categories[0] || UNCATEGORIZED
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(UNCATEGORIZED);
  const [newMapObjectImage, setNewMapObjectImage] = useState("");
  const [newMapObjectWidth, setNewMapObjectWidth] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [newMapObjectHeight, setNewMapObjectHeight] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [newMapObjectType, setNewMapObjectType] =
    useState<DesignerMapObjectType>(DEFAULT_MAP_OBJECT_TYPE);
  const [editMapObjectImage, setEditMapObjectImage] = useState("");
  const [editMapObjectWidth, setEditMapObjectWidth] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [editMapObjectHeight, setEditMapObjectHeight] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [editMapObjectType, setEditMapObjectType] =
    useState<DesignerMapObjectType>(DEFAULT_MAP_OBJECT_TYPE);
  const [newMapCellSize, setNewMapCellSize] = useState(String(DEFAULT_MAP_CELL_SIZE));
  const [newMapSizePreset, setNewMapSizePreset] =
    useState<DesignerMapSizePreset>(DEFAULT_MAP_SIZE_PRESET);
  const [newMapCustomWidth, setNewMapCustomWidth] = useState("500");
  const [newMapCustomHeight, setNewMapCustomHeight] = useState("500");
  const [newMapRegion, setNewMapRegion] = useState(regionNames[0] || "");
  const [newMapRegionX, setNewMapRegionX] = useState("0");
  const [newMapRegionY, setNewMapRegionY] = useState("0");
  const [newMapType, setNewMapType] = useState<DesignerPlayableMapType>(DEFAULT_MAP_TYPE);
  const [newMapBackgroundColor, setNewMapBackgroundColor] = useState(
    DEFAULT_MAP_BACKGROUND_COLOR
  );
  const [newMapBackgroundImage, setNewMapBackgroundImage] = useState("");
  const [newMapBackgroundImageMode, setNewMapBackgroundImageMode] =
    useState<DesignerPlayableMapBackgroundImageMode>(DEFAULT_MAP_BACKGROUND_IMAGE_MODE);
  const [editMapCellSize, setEditMapCellSize] = useState(String(DEFAULT_MAP_CELL_SIZE));
  const [editMapSizePreset, setEditMapSizePreset] =
    useState<DesignerMapSizePreset>(DEFAULT_MAP_SIZE_PRESET);
  const [editMapCustomWidth, setEditMapCustomWidth] = useState("500");
  const [editMapCustomHeight, setEditMapCustomHeight] = useState("500");
  const [editMapRegion, setEditMapRegion] = useState(regionNames[0] || "");
  const [editMapRegionX, setEditMapRegionX] = useState("0");
  const [editMapRegionY, setEditMapRegionY] = useState("0");
  const [editMapType, setEditMapType] = useState<DesignerPlayableMapType>(DEFAULT_MAP_TYPE);
  const [editMapBackgroundColor, setEditMapBackgroundColor] = useState(
    DEFAULT_MAP_BACKGROUND_COLOR
  );
  const [editMapBackgroundImage, setEditMapBackgroundImage] = useState("");
  const [editMapBackgroundImageMode, setEditMapBackgroundImageMode] =
    useState<DesignerPlayableMapBackgroundImageMode>(DEFAULT_MAP_BACKGROUND_IMAGE_MODE);
  const shouldBroadcastRef = useRef(false);
  const latestSectionStateRef = useRef(sectionState);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const updateSectionState = useCallback(
    (updater: React.SetStateAction<DesignerSectionState>) => {
      if (isObjectsSection) {
        shouldBroadcastRef.current = true;
      }

      setSectionState(updater);
    },
    [isObjectsSection]
  );

  useEffect(() => {
    latestSectionStateRef.current = sectionState;
  }, [sectionState]);

  useEffect(() => {
    const nextStoredState = loadStoredState(sectionKey);

    setSectionState(nextStoredState);
    latestSectionStateRef.current = nextStoredState;
    setSelectedIds([]);
    setIsAddOpen(false);
    setIsEditOpen(false);
    setEditingItemId(null);
    setSearchTerm("");
    setCategoryFilter(ALL_CATEGORIES);
    setEditingCategory(null);
    setDeletingCategory(null);
    setDeletingItemId(null);
    setIsObjectsStateHydrated(!isObjectsSection);
    setObjectsSyncMeta({
      updatedAt: null,
      updatedByUsername: null,
    });
    shouldBroadcastRef.current = false;
  }, [isObjectsSection, sectionKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getStorageKey(sectionKey),
      JSON.stringify(sectionState)
    );
  }, [sectionKey, sectionState]);

  useEffect(() => {
    if (!isObjectsSection || !shouldBroadcastRef.current) {
      return;
    }

    shouldBroadcastRef.current = false;

    if (!socket || !authenticated) {
      return;
    }

    socket.emit("designer:objects:update", {
      state: sectionState,
    });
  }, [authenticated, isObjectsSection, sectionState, socket]);

  useEffect(() => {
    if (!isObjectsSection) {
      return;
    }

    if (!authReady || !authenticated || !socket) {
      return;
    }

    const joinObjectsRoom = () => {
      setIsObjectsStateHydrated(false);
      socket.emit("designer:objects:join", {
        seedState: latestSectionStateRef.current,
      });
    };

    const handleObjectsState = (payload: DesignerObjectsSyncPayload) => {
      shouldBroadcastRef.current = false;
      const nextState = sanitizeSectionState(sectionKey, payload.state);

      latestSectionStateRef.current = nextState;
      setSectionState(nextState);
      setObjectsSyncMeta({
        updatedAt: payload.updatedAt,
        updatedByUsername: payload.updatedByUsername,
      });
      setIsObjectsStateHydrated(true);
    };

    const handleObjectsError = ({ message }: { message: string }) => {
      setIsObjectsStateHydrated(false);
      toast({
        title: message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    };

    socket.on("designer:objects:state", handleObjectsState);
    socket.on("designer:objects:error", handleObjectsError);
    socket.on("connect", joinObjectsRoom);

    if (!socket.connected) {
      socket.connect();
    } else {
      joinObjectsRoom();
    }

    return () => {
      socket.emit("designer:objects:leave");
      socket.off("designer:objects:state", handleObjectsState);
      socket.off("designer:objects:error", handleObjectsError);
      socket.off("connect", joinObjectsRoom);
    };
  }, [authReady, authenticated, isObjectsSection, sectionKey, socket, toast]);

  useEffect(() => {
    if (!sectionState.categories.includes(newItemCategory)) {
      setNewItemCategory(sectionState.categories[0] || UNCATEGORIZED);
    }

    if (!sectionState.categories.includes(editItemCategory)) {
      setEditItemCategory(sectionState.categories[0] || UNCATEGORIZED);
    }

    if (!sectionState.categories.includes(moveCategory)) {
      setMoveCategory(sectionState.categories[0] || UNCATEGORIZED);
    }

    if (
      categoryFilter !== ALL_CATEGORIES &&
      !sectionState.categories.includes(categoryFilter)
    ) {
      setCategoryFilter(ALL_CATEGORIES);
    }

    if (
      deleteCategoryTarget !== UNCATEGORIZED &&
      !sectionState.categories.includes(deleteCategoryTarget)
    ) {
      setDeleteCategoryTarget(UNCATEGORIZED);
    }
  }, [
    categoryFilter,
    deleteCategoryTarget,
    editItemCategory,
    moveCategory,
    newItemCategory,
    sectionState.categories,
  ]);

  useEffect(() => {
    if (!regionNames.includes(newMapRegion)) {
      setNewMapRegion(regionNames[0] || "");
    }

    if (!regionNames.includes(editMapRegion)) {
      setEditMapRegion(regionNames[0] || "");
    }
  }, [editMapRegion, newMapRegion, regionNames]);

  const selectedCount = selectedIds.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isObjectsSyncReady =
    !isObjectsSection ||
    (authReady && authenticated && Boolean(socket?.connected) && isObjectsStateHydrated);
  const lastSyncedLabel = useMemo(() => {
    if (!objectsSyncMeta.updatedAt) {
      return null;
    }

    const timestamp = new Date(objectsSyncMeta.updatedAt);

    return Number.isNaN(timestamp.getTime())
      ? objectsSyncMeta.updatedAt
      : timestamp.toLocaleString();
  }, [objectsSyncMeta.updatedAt]);
  const parsedMapObjectWidth = Number.parseInt(newMapObjectWidth, 10);
  const parsedMapObjectHeight = Number.parseInt(newMapObjectHeight, 10);
  const parsedEditMapObjectWidth = Number.parseInt(editMapObjectWidth, 10);
  const parsedEditMapObjectHeight = Number.parseInt(editMapObjectHeight, 10);
  const resolvedNewMapDimensions = resolveMapDimensions(
    newMapSizePreset,
    newMapCustomWidth,
    newMapCustomHeight
  );
  const resolvedEditMapDimensions = resolveMapDimensions(
    editMapSizePreset,
    editMapCustomWidth,
    editMapCustomHeight
  );
  const hasValidMapObjectWidth =
    Number.isFinite(parsedMapObjectWidth) && parsedMapObjectWidth > 0;
  const hasValidMapObjectHeight =
    Number.isFinite(parsedMapObjectHeight) && parsedMapObjectHeight > 0;
  const hasValidEditMapObjectWidth =
    Number.isFinite(parsedEditMapObjectWidth) && parsedEditMapObjectWidth > 0;
  const hasValidEditMapObjectHeight =
    Number.isFinite(parsedEditMapObjectHeight) && parsedEditMapObjectHeight > 0;
  const hasValidNewMapDimensions =
    resolvedNewMapDimensions.width !== null && resolvedNewMapDimensions.height !== null;
  const hasValidEditMapDimensions =
    resolvedEditMapDimensions.width !== null && resolvedEditMapDimensions.height !== null;
  const isMapObjectFormValid =
    !isObjectsSection ||
    (!!newMapObjectImage && hasValidMapObjectWidth && hasValidMapObjectHeight);
  const isEditMapObjectFormValid =
    !isObjectsSection ||
    (!!editMapObjectImage &&
      hasValidEditMapObjectWidth &&
      hasValidEditMapObjectHeight);
  const isPlayableMapFormValid =
    !isMapsSection ||
    (!!newMapRegion &&
      MAP_CELL_SIZE_OPTIONS.includes(Number.parseInt(newMapCellSize, 10) as 8 | 16 | 32 | 64 | 128) &&
      hasValidNewMapDimensions);
  const isEditPlayableMapFormValid =
    !isMapsSection ||
    (!!editMapRegion &&
      MAP_CELL_SIZE_OPTIONS.includes(Number.parseInt(editMapCellSize, 10) as 8 | 16 | 32 | 64 | 128) &&
      hasValidEditMapDimensions);

  const categorySummary = useMemo(
    () =>
      sectionState.categories.map((category) => ({
        name: category,
        count: sectionState.items.filter((item) => item.category === category).length,
      })),
    [sectionState.categories, sectionState.items]
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sectionState.items.filter((item) => {
      const matchesName =
        normalizedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === ALL_CATEGORIES || item.category === categoryFilter;

      return matchesName && matchesCategory;
    });
  }, [categoryFilter, searchTerm, sectionState.items]);

  const deleteCategoryOptions = useMemo(() => {
    return [UNCATEGORIZED, ...sectionState.categories.filter((category) => category !== deletingCategory && category !== UNCATEGORIZED)];
  }, [deletingCategory, sectionState.categories]);

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  };

  const openAddModal = () => {
    setNewItemName("");
    setNewItemCategory(sectionState.categories[0] || UNCATEGORIZED);
    setNewMapObjectImage("");
    setNewMapObjectWidth(String(DEFAULT_MAP_OBJECT_SIZE));
    setNewMapObjectHeight(String(DEFAULT_MAP_OBJECT_SIZE));
    setNewMapObjectType(DEFAULT_MAP_OBJECT_TYPE);
    setNewMapCellSize(String(DEFAULT_MAP_CELL_SIZE));
    setNewMapSizePreset(DEFAULT_MAP_SIZE_PRESET);
    setNewMapCustomWidth("500");
    setNewMapCustomHeight("500");
    setNewMapRegion(regionNames[0] || "");
    setNewMapRegionX("0");
    setNewMapRegionY("0");
    setNewMapType(DEFAULT_MAP_TYPE);
    setNewMapBackgroundColor(DEFAULT_MAP_BACKGROUND_COLOR);
    setNewMapBackgroundImage("");
    setNewMapBackgroundImageMode(DEFAULT_MAP_BACKGROUND_IMAGE_MODE);
    setIsAddOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingItemId(null);
  };

  const openEditModal = (item: DesignerItemSeed) => {
    const mapObjectAsset = sanitizeMapObjectAsset(item.mapObjectAsset);
    const playableMapConfig = sanitizePlayableMapConfig(item.playableMapConfig, regionNames);

    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemCategory(item.category || sectionState.categories[0] || UNCATEGORIZED);
    setEditMapObjectImage(mapObjectAsset?.imageSrc || "");
    setEditMapObjectWidth(String(mapObjectAsset?.width || DEFAULT_MAP_OBJECT_SIZE));
    setEditMapObjectHeight(String(mapObjectAsset?.height || DEFAULT_MAP_OBJECT_SIZE));
    setEditMapObjectType(mapObjectAsset?.objectType || DEFAULT_MAP_OBJECT_TYPE);
    setEditMapCellSize(String(playableMapConfig?.cellSize || DEFAULT_MAP_CELL_SIZE));
    setEditMapSizePreset(playableMapConfig?.sizePreset || DEFAULT_MAP_SIZE_PRESET);
    setEditMapCustomWidth(String(playableMapConfig?.width || 500));
    setEditMapCustomHeight(String(playableMapConfig?.height || 500));
    setEditMapRegion(playableMapConfig?.regionName || regionNames[0] || "");
    setEditMapRegionX(String(playableMapConfig?.regionX || 0));
    setEditMapRegionY(String(playableMapConfig?.regionY || 0));
    setEditMapType(playableMapConfig?.mapType || DEFAULT_MAP_TYPE);
    setEditMapBackgroundColor(
      playableMapConfig?.backgroundColor || DEFAULT_MAP_BACKGROUND_COLOR
    );
    setEditMapBackgroundImage(playableMapConfig?.backgroundImageSrc || "");
    setEditMapBackgroundImageMode(
      playableMapConfig?.backgroundImageMode || DEFAULT_MAP_BACKGROUND_IMAGE_MODE
    );
    setIsEditOpen(true);
  };

  const openCategoriesModal = () => {
    setNewCategoryName("");
    setEditingCategory(null);
    setEditingCategoryName("");
    setDeletingCategory(null);
    setDeleteCategoryTarget(UNCATEGORIZED);
    setIsCategoriesOpen(true);
  };

  const openMoveModal = () => {
    setMoveCategory(sectionState.categories[0] || UNCATEGORIZED);
    setIsMoveOpen(true);
  };

  const openDeleteItemConfirm = (itemId: string) => {
    setDeletingItemId(itemId);
  };

  const closeDeleteItemConfirm = () => {
    setDeletingItemId(null);
  };

  const handleAddCategory = () => {
    const normalizedCategory = normalizeCategoryName(newCategoryName);

    if (!normalizedCategory) {
      return;
    }

    updateSectionState((current) => {
      const existingCategory = findCategoryName(current.categories, normalizedCategory);
      if (existingCategory) {
        return current;
      }

      return {
        ...current,
        categories: [...current.categories, normalizedCategory],
      };
    });

    setNewCategoryName("");
  };

  const startEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditingCategoryName(category);
    setDeletingCategory(null);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditingCategoryName("");
  };

  const handleSaveCategory = () => {
    if (!editingCategory) {
      return;
    }

    const normalizedCategory = normalizeCategoryName(editingCategoryName);
    if (!normalizedCategory) {
      return;
    }

    if (editingCategory === UNCATEGORIZED) {
      return;
    }

    updateSectionState((current) => {
      const existingCategory = findCategoryName(current.categories, normalizedCategory);
      const renamedTo = existingCategory && existingCategory !== editingCategory
        ? existingCategory
        : normalizedCategory;

      return {
        categories: current.categories
          .map((category) => (category === editingCategory ? renamedTo : category))
          .filter(
            (category, index, list) =>
              list.findIndex((value) => value.toLowerCase() === category.toLowerCase()) === index
          ),
        items: current.items.map((item) =>
          item.category === editingCategory
            ? { ...item, category: renamedTo }
            : item
        ),
      };
    });

    if (categoryFilter === editingCategory) {
      const existingCategory = findCategoryName(sectionState.categories, normalizedCategory);
      setCategoryFilter(existingCategory && existingCategory !== editingCategory ? existingCategory : normalizedCategory);
    }

    if (newItemCategory === editingCategory) {
      setNewItemCategory(normalizedCategory);
    }

    if (moveCategory === editingCategory) {
      setMoveCategory(normalizedCategory);
    }

    cancelEditCategory();
  };

  const startDeleteCategory = (category: string) => {
    setDeletingCategory(category);
    setDeleteCategoryTarget(UNCATEGORIZED);
    setEditingCategory(null);
  };

  const cancelDeleteCategory = () => {
    setDeletingCategory(null);
    setDeleteCategoryTarget(UNCATEGORIZED);
  };

  const handleDeleteCategory = () => {
    if (!deletingCategory || deletingCategory === UNCATEGORIZED) {
      return;
    }

    const targetCategory = deleteCategoryTarget || UNCATEGORIZED;

    updateSectionState((current) => ({
      categories: current.categories.filter((category) => category !== deletingCategory),
      items: current.items.map((item) =>
        item.category === deletingCategory
          ? { ...item, category: targetCategory }
          : item
      ),
    }));

    if (categoryFilter === deletingCategory) {
      setCategoryFilter(targetCategory === UNCATEGORIZED ? ALL_CATEGORIES : targetCategory);
    }

    if (newItemCategory === deletingCategory) {
      setNewItemCategory(targetCategory);
    }

    if (moveCategory === deletingCategory) {
      setMoveCategory(targetCategory);
    }

    cancelDeleteCategory();
  };

  const handleMapObjectImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    onImageChange: (value: string) => void
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      onImageChange("");
      return;
    }

    const isAllowedType =
      file.type === "image/png" ||
      file.type === "image/gif" ||
      /\.(png|gif)$/i.test(file.name);

    if (!isAllowedType) {
      window.alert("Please upload a PNG or GIF image for the map object.");
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
  };

  const handleMapBackgroundImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    onImageChange: (value: string) => void
  ) => {
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
  };

  const handleAddItem = () => {
    const name = newItemName.trim();
    const category = normalizeCategoryName(newItemCategory) || UNCATEGORIZED;

    if (
      !name ||
      (isObjectsSection && !isMapObjectFormValid) ||
      (isMapsSection && !isPlayableMapFormValid)
    ) {
      return;
    }

    updateSectionState((current) => {
      const nextIndex = current.items.length + 1;
      const mapObjectAsset =
        isObjectsSection && newMapObjectImage
          ? {
              imageSrc: newMapObjectImage,
              width: parsedMapObjectWidth,
              height: parsedMapObjectHeight,
              objectType: newMapObjectType,
            }
          : undefined;
      const playableMapConfig =
        isMapsSection && resolvedNewMapDimensions.width !== null && resolvedNewMapDimensions.height !== null
          ? {
              cellSize: Number.parseInt(newMapCellSize, 10),
              sizePreset: newMapSizePreset,
              width: resolvedNewMapDimensions.width,
              height: resolvedNewMapDimensions.height,
              regionName: newMapRegion,
              regionX: parseMapCoordinate(newMapRegionX),
              regionY: parseMapCoordinate(newMapRegionY),
              mapType: newMapType,
              backgroundColor: normalizeBackgroundColor(newMapBackgroundColor),
              backgroundImageSrc: newMapBackgroundImage,
              backgroundImageMode: newMapBackgroundImageMode,
            }
          : undefined;
      const item: DesignerItemSeed = {
        id: isMapsSection
          ? createUniqueMapId()
          : `${section.key}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
        name,
        category,
        details: section.createDetails(name, category, nextIndex, {
          mapObjectAsset,
          playableMapConfig,
        }),
        mapObjectAsset,
        playableMapConfig,
      };

      return {
        categories: current.categories.includes(category)
          ? current.categories
          : [...current.categories, category],
        items: [item, ...current.items],
      };
    });

    setIsAddOpen(false);
  };

  const handleEditItem = () => {
    const name = editItemName.trim();
    const category = normalizeCategoryName(editItemCategory) || UNCATEGORIZED;

    if (
      !editingItemId ||
      !name ||
      (isObjectsSection && !isEditMapObjectFormValid) ||
      (isMapsSection && !isEditPlayableMapFormValid)
    ) {
      return;
    }

    updateSectionState((current) => {
      const mapObjectAsset =
        isObjectsSection && editMapObjectImage
          ? {
              imageSrc: editMapObjectImage,
              width: parsedEditMapObjectWidth,
              height: parsedEditMapObjectHeight,
              objectType: editMapObjectType,
            }
          : undefined;
      const playableMapConfig =
        isMapsSection && resolvedEditMapDimensions.width !== null && resolvedEditMapDimensions.height !== null
          ? {
              cellSize: Number.parseInt(editMapCellSize, 10),
              sizePreset: editMapSizePreset,
              width: resolvedEditMapDimensions.width,
              height: resolvedEditMapDimensions.height,
              regionName: editMapRegion,
              regionX: parseMapCoordinate(editMapRegionX),
              regionY: parseMapCoordinate(editMapRegionY),
              mapType: editMapType,
              backgroundColor: normalizeBackgroundColor(editMapBackgroundColor),
              backgroundImageSrc: editMapBackgroundImage,
              backgroundImageMode: editMapBackgroundImageMode,
            }
          : undefined;

      return {
        categories: current.categories.includes(category)
          ? current.categories
          : [...current.categories, category],
        items: current.items.map((item, index) =>
          item.id === editingItemId
            ? {
                ...item,
                name,
                category,
                details: section.createDetails(name, category, index + 1, {
                  mapObjectAsset,
                  playableMapConfig,
                }),
                mapObjectAsset,
                playableMapConfig,
              }
            : item
        ),
      };
    });

    closeEditModal();
  };

  const handleDeleteSelected = () => {
    if (selectedCount === 0) {
      return;
    }

    updateSectionState((current) => ({
      ...current,
      items: current.items.filter((item) => !selectedSet.has(item.id)),
    }));
    setSelectedIds([]);
  };

  const handleDeleteItem = () => {
    if (!deletingItemId) {
      return;
    }

    updateSectionState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== deletingItemId),
    }));
    setSelectedIds((current) => current.filter((id) => id !== deletingItemId));

    if (editingItemId === deletingItemId) {
      closeEditModal();
    }

    closeDeleteItemConfirm();
  };

  const handleMoveSelected = () => {
    const category = normalizeCategoryName(moveCategory) || UNCATEGORIZED;

    if (selectedCount === 0) {
      return;
    }

    updateSectionState((current) => ({
      categories: current.categories.includes(category)
        ? current.categories
        : [...current.categories, category],
      items: current.items.map((item) =>
        selectedSet.has(item.id) ? { ...item, category } : item
      ),
    }));
    setSelectedIds([]);
    setIsMoveOpen(false);
  };

  const handleExportItems = () => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      version: 1,
      section: sectionKey,
      exportedAt: new Date().toISOString(),
      state: sectionState,
    };
    const fileName = `${section.key}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");

    link.href = objectUrl;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);

    toast({
      title: `${section.title} exported`,
      description: `${sectionState.items.length} ${section.itemLabelPlural} saved to JSON.`,
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
  };

  const openImportPicker = () => {
    importInputRef.current?.click();
  };

  const handleImportItems = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Importing will replace the current ${section.itemLabelPlural} list. Continue?`
      )
    ) {
      return;
    }

    try {
      const fileContents = await file.text();
      const parsed = JSON.parse(fileContents) as unknown;
      const metadata =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : null;

      if (
        metadata &&
        typeof metadata.section === "string" &&
        metadata.section !== sectionKey
      ) {
        throw new Error(
          `This file is for "${metadata.section}", not "${sectionKey}".`
        );
      }

      const nextState = buildImportedSectionState(sectionKey, parsed);

      if (!nextState) {
        throw new Error("The selected file does not contain a valid designer JSON export.");
      }

      updateSectionState(nextState);
      setSelectedIds([]);

      toast({
        title: `${section.title} imported`,
        description: `${nextState.items.length} ${section.itemLabelPlural} loaded from JSON.`,
        status: "success",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "The selected file could not be imported.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    }
  };

  const renderPlayableMapFields = ({
    cellSize,
    onCellSizeChange,
    sizePreset,
    onSizePresetChange,
    customWidth,
    onCustomWidthChange,
    customHeight,
    onCustomHeightChange,
    regionName,
    onRegionChange,
    regionX,
    onRegionXChange,
    regionY,
    onRegionYChange,
    mapType,
    onMapTypeChange,
    backgroundColor,
    onBackgroundColorChange,
    backgroundImageSrc,
    onBackgroundImageChange,
    backgroundImageMode,
    onBackgroundImageModeChange,
    isValidDimensions,
  }: {
    cellSize: string;
    onCellSizeChange: (value: string) => void;
    sizePreset: DesignerMapSizePreset;
    onSizePresetChange: (value: DesignerMapSizePreset) => void;
    customWidth: string;
    onCustomWidthChange: (value: string) => void;
    customHeight: string;
    onCustomHeightChange: (value: string) => void;
    regionName: string;
    onRegionChange: (value: string) => void;
    regionX: string;
    onRegionXChange: (value: string) => void;
    regionY: string;
    onRegionYChange: (value: string) => void;
    mapType: DesignerPlayableMapType;
    onMapTypeChange: (value: DesignerPlayableMapType) => void;
    backgroundColor: string;
    onBackgroundColorChange: (value: string) => void;
    backgroundImageSrc: string;
    onBackgroundImageChange: (value: string) => void;
    backgroundImageMode: DesignerPlayableMapBackgroundImageMode;
    onBackgroundImageModeChange: (value: DesignerPlayableMapBackgroundImageMode) => void;
    isValidDimensions: boolean;
  }) => {
    const previewBackgroundStyle = getPlayableMapBackgroundStyle({
      backgroundColor,
      backgroundImageSrc,
      backgroundImageMode,
    });

    return (
      <>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormControl isRequired>
            <FormLabel>Cell Size</FormLabel>
            <Select
              value={cellSize}
              onChange={(event) => onCellSizeChange(event.target.value)}
            >
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
                onSizePresetChange(event.target.value as DesignerMapSizePreset)
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
            <FormControl
              isRequired
              isInvalid={customWidth !== "" && parseMapDimension(customWidth) === null}
            >
              <FormLabel>Custom Width</FormLabel>
              <Input
                type="number"
                min={1}
                step={1}
                value={customWidth}
                onChange={(event) =>
                  onCustomWidthChange(normalizeMapDimension(event.target.value))
                }
                placeholder="Map width"
              />
            </FormControl>
            <FormControl
              isRequired
              isInvalid={customHeight !== "" && parseMapDimension(customHeight) === null}
            >
              <FormLabel>Custom Height</FormLabel>
              <Input
                type="number"
                min={1}
                step={1}
                value={customHeight}
                onChange={(event) =>
                  onCustomHeightChange(normalizeMapDimension(event.target.value))
                }
                placeholder="Map height"
              />
            </FormControl>
          </SimpleGrid>
        ) : null}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormControl isRequired>
            <FormLabel>Region</FormLabel>
            <Select
              value={regionName}
              onChange={(event) => onRegionChange(event.target.value)}
              isDisabled={regionNames.length === 0}
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
                onMapTypeChange(event.target.value as DesignerPlayableMapType)
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
              onChange={(event) => onRegionXChange(event.target.value)}
              placeholder="Region X position"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Region Y Position</FormLabel>
            <Input
              type="number"
              step={1}
              value={regionY}
              onChange={(event) => onRegionYChange(event.target.value)}
              placeholder="Region Y position"
            />
          </FormControl>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormControl isRequired>
            <FormLabel>Background Color</FormLabel>
            <Input
              type="color"
              value={normalizeBackgroundColor(backgroundColor)}
              onChange={(event) => onBackgroundColorChange(event.target.value)}
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
              onChange={(event) =>
                handleMapBackgroundImageChange(event, onBackgroundImageChange)
              }
            />
          </FormControl>
        </SimpleGrid>
        {backgroundImageSrc ? (
          <FormControl>
            <FormLabel>Background Image Mode</FormLabel>
            <Select
              value={backgroundImageMode}
              onChange={(event) =>
                onBackgroundImageModeChange(
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
            Region X/Y will be used for automatic region map generation later. That generation flow is not implemented yet.
          </Text>
          {backgroundImageSrc ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onBackgroundImageChange("")}
            >
              Remove Background Image
            </Button>
          ) : null}
        </Flex>
        <Box
          p={4}
          borderRadius="20px"
          border="1px solid rgba(43, 66, 47, 0.12)"
          bg="linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(241,246,238,0.95) 100%)"
        >
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={3}
          >
            Map Summary
          </Text>
          <Text color="#55645a" fontSize="sm">
            Cell size: {cellSize || "--"} px
          </Text>
          <Text color="#55645a" fontSize="sm">
            Map size:{" "}
            {sizePreset === "custom"
              ? `${customWidth || "--"} x ${customHeight || "--"}`
              : getMapSizePresetOption(sizePreset).label.replace(/[^(]*\((.*)\)/, "$1")}
          </Text>
          <Text color="#55645a" fontSize="sm">
            Region: {regionName || "No regions available"}
          </Text>
          <Text color="#55645a" fontSize="sm">
            Region position: {parseMapCoordinate(regionX)}, {parseMapCoordinate(regionY)}
          </Text>
          <Text color="#55645a" fontSize="sm">
            Map type: {formatMapTypeLabel(mapType)}
          </Text>
          <Text color="#55645a" fontSize="sm">
            Background color: {normalizeBackgroundColor(backgroundColor)}
          </Text>
          <Text color="#55645a" fontSize="sm">
            Background image: {backgroundImageSrc ? backgroundImageMode : "None"}
          </Text>
          <Box
            mt={4}
            minH="120px"
            borderRadius="16px"
            border="1px solid rgba(43, 66, 47, 0.14)"
            sx={previewBackgroundStyle}
          />
          {!isValidDimensions ? (
            <Text mt={2} color="#914335" fontSize="sm">
              Enter a valid custom width and height to continue.
            </Text>
          ) : null}
        </Box>
      </>
    );
  };

  return (
    <Box
      minH="100vh"
      px={{ base: 4, md: 8, xl: 12 }}
      py={{ base: 6, md: 10 }}
      bg="linear-gradient(180deg, #f7f4ea 0%, #e8efe5 100%)"
    >
      <Box
        maxW="1280px"
        mx="auto"
        p={{ base: 5, md: 8 }}
        borderRadius="32px"
        bg="rgba(255, 252, 245, 0.92)"
        border="1px solid rgba(58, 76, 52, 0.14)"
        boxShadow="0 24px 60px rgba(52, 66, 45, 0.12)"
        backdropFilter="blur(12px)"
      >
        <Flex
          direction={{ base: "column", lg: "row" }}
          justify="space-between"
          align={{ base: "flex-start", lg: "center" }}
          gap={4}
          mb={8}
        >
          <Box>
            <Text
              fontSize="sm"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="0.18em"
              color="#5e7a61"
              mb={3}
            >
              Designer / {section.title}
            </Text>
            <Heading as="h1" size="xl" color="#233127" mb={3}>
              {section.title}
            </Heading>
            <Text color="#55645a" maxW="760px">
              {section.description}
            </Text>
          </Box>

          <Button
            as={RouterLink}
            to="/designer"
            variant="outline"
            borderColor="rgba(43, 66, 47, 0.2)"
            color="#2e5b37"
            _hover={{ bg: "rgba(126, 166, 120, 0.08)" }}
          >
            Back to Designer
          </Button>
        </Flex>

        <Box
          mb={8}
          p={{ base: 4, md: 5 }}
          borderRadius="24px"
          bg="linear-gradient(135deg, rgba(255,253,246,0.95) 0%, rgba(237,244,234,0.95) 100%)"
          border="1px solid rgba(43, 66, 47, 0.12)"
        >
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            Menu
          </Text>
          <Flex wrap="wrap" gap={3}>
            <Button
              colorScheme="green"
              onClick={openAddModal}
              isDisabled={!isObjectsSyncReady}
            >
              Add New {section.itemLabel}
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={handleDeleteSelected}
              isDisabled={selectedCount === 0 || !isObjectsSyncReady}
            >
              Delete Multiple Elements
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={openCategoriesModal}
              isDisabled={!isObjectsSyncReady}
            >
              Categories
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={openMoveModal}
              isDisabled={selectedCount === 0 || !isObjectsSyncReady}
            >
              Move Multiple Elements
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={openImportPicker}
              isDisabled={!isObjectsSyncReady}
            >
              Import JSON
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={handleExportItems}
              isDisabled={!isObjectsSyncReady}
            >
              Export JSON
            </Button>
          </Flex>
          <Input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            display="none"
            onChange={handleImportItems}
          />
          <Text mt={4} color="#55645a" fontSize="sm">
            {isObjectsSection
              ? !authReady
                ? "Preparing the live collaborative objects channel."
                : !authenticated
                  ? "Authentication is required to edit live map objects."
                  : !socket?.connected
                    ? "Reconnecting the live collaborative objects channel."
                    : !isObjectsStateHydrated
                      ? "Syncing map objects from Redis through the realtime server."
                      : `Live sync is active for map objects. ${selectedCount} selected.${lastSyncedLabel ? ` Last saved ${lastSyncedLabel}.` : ""}${objectsSyncMeta.updatedByUsername ? ` Latest change by ${objectsSyncMeta.updatedByUsername}.` : ""}`
              : `Demo mode is active with seeded ${section.itemLabelPlural}. ${selectedCount} selected.`}
          </Text>
        </Box>

        <Box mb={8}>
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            Categories
          </Text>
          <Flex wrap="wrap" gap={3}>
            {categorySummary.map((category) => (
              <Box
                key={category.name}
                px={4}
                py={3}
                borderRadius="18px"
                bg="rgba(126, 166, 120, 0.1)"
                border="1px solid rgba(43, 66, 47, 0.12)"
              >
                <Text fontWeight="700" color="#233127">
                  {category.name}
                </Text>
                <Text fontSize="sm" color="#55645a">
                  {category.count}{" "}
                  {category.count === 1 ? section.itemLabel : section.itemLabelPlural}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>

        <Box mb={8}>
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            Search & Filter
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl>
              <FormLabel color="#55645a">Search by name</FormLabel>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${section.itemLabelPlural} by name`}
                bg="white"
              />
            </FormControl>
            <FormControl>
              <FormLabel color="#55645a">Filter by category</FormLabel>
              <Select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                bg="white"
              >
                <option value={ALL_CATEGORIES}>All categories</option>
                {sectionState.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </FormControl>
          </SimpleGrid>
          <Text mt={3} color="#55645a" fontSize="sm">
            Showing {filteredItems.length} of {sectionState.items.length}{" "}
            {section.itemLabelPlural}.
          </Text>
        </Box>

        <Box>
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            {section.title} List
          </Text>
          {filteredItems.length === 0 ? (
            <Box
              p={8}
              borderRadius="24px"
              border="1px solid rgba(43, 66, 47, 0.12)"
              bg="rgba(255,255,255,0.72)"
            >
              <Text fontWeight="700" color="#233127" mb={2}>
                No {section.itemLabelPlural} match this filter.
              </Text>
              <Text color="#55645a">
                Try another name or category filter, or create a new {section.itemLabel}.
              </Text>
            </Box>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={{ base: 4, md: 5 }}>
              {filteredItems.map((item) => {
                const isSelected = selectedSet.has(item.id);
                const mapObjectAsset = isObjectsSection
                  ? sanitizeMapObjectAsset(item.mapObjectAsset)
                  : undefined;
                const playableMapConfig = isMapsSection
                  ? sanitizePlayableMapConfig(item.playableMapConfig, regionNames)
                  : undefined;

                return (
                  <Box
                    key={item.id}
                    as="div"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleItem(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleItem(item.id);
                      }
                    }}
                    minH={{ base: "168px", md: "188px" }}
                    p={{ base: 4, md: 5 }}
                    borderRadius="24px"
                    borderWidth="2px"
                    borderColor={isSelected ? "#4b7a55" : "rgba(43, 66, 47, 0.12)"}
                    bg={
                      isSelected
                        ? "rgba(225, 241, 221, 0.95)"
                        : "linear-gradient(135deg, #fffdf6 0%, #edf4ea 100%)"
                    }
                    color="#213128"
                    cursor="pointer"
                    textAlign="left"
                    transition="transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease"
                    boxShadow={
                      isSelected
                        ? "0 18px 34px rgba(59, 78, 55, 0.16)"
                        : "0 14px 30px rgba(59, 78, 55, 0.08)"
                    }
                    _hover={{
                      transform: "translateY(-3px)",
                      borderColor: "rgba(43, 66, 47, 0.32)",
                      boxShadow: "0 18px 34px rgba(59, 78, 55, 0.14)",
                    }}
                  >
                    <Flex justify="space-between" align="flex-start" gap={4} mb={4}>
                      <Flex align="center" gap={3}>
                        <Box
                          w="56px"
                          h="56px"
                          borderRadius="18px"
                          overflow="hidden"
                          display="grid"
                          placeItems="center"
                          bg={
                            mapObjectAsset
                              ? "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(227,235,224,0.95) 100%)"
                              : "rgba(126, 166, 120, 0.12)"
                          }
                          color="#2e5b37"
                          flexShrink={0}
                        >
                          {mapObjectAsset ? (
                            <Box
                              as="img"
                              src={mapObjectAsset.imageSrc}
                              alt={`${item.name} preview`}
                              width={`${Math.max(20, Math.min(mapObjectAsset.width, 56))}px`}
                              height={`${Math.max(20, Math.min(mapObjectAsset.height, 56))}px`}
                              objectFit="contain"
                              style={{ imageRendering: "pixelated" }}
                            />
                          ) : (
                            <DesignerIcon icon={section.icon} boxSize={8} />
                          )}
                        </Box>
                        <Box>
                          <Text fontSize="lg" fontWeight="700" mb={1}>
                            {item.name}
                          </Text>
                          <Badge
                            px={2.5}
                            py={1}
                            borderRadius="full"
                            bg="rgba(46, 91, 55, 0.12)"
                            color="#2e5b37"
                            textTransform="none"
                          >
                            {section.categoryLabel}: {item.category}
                          </Badge>
                        </Box>
                      </Flex>

                      <Badge
                        px={2.5}
                        py={1}
                        borderRadius="full"
                        bg={isSelected ? "#2e5b37" : "rgba(46, 91, 55, 0.08)"}
                        color={isSelected ? "white" : "#2e5b37"}
                        textTransform="none"
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Badge>
                    </Flex>

                    <Stack spacing={2}>
                      {item.details.map((itemDetail) => (
                        <Flex
                          key={`${item.id}-${itemDetail.label}`}
                          justify="space-between"
                          gap={4}
                        >
                          <Text fontSize="sm" color="#6d7b71">
                            {itemDetail.label}
                          </Text>
                          <Text fontSize="sm" fontWeight="700" color="#233127">
                            {itemDetail.value}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                    <Flex mt={4} justify="space-between" align="center" gap={3}>
                      {playableMapConfig ? (
                        <Button
                          as={RouterLink}
                          to={getMapEditorPath(item.id)}
                          size="sm"
                          colorScheme="green"
                          variant="outline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Map Editor
                        </Button>
                      ) : (
                        <Box />
                      )}
                      <Flex gap={2}>
                        <IconButton
                          aria-label={`Delete ${item.name}`}
                          size="sm"
                          variant="outline"
                          borderColor="rgba(145, 67, 53, 0.24)"
                          color="#914335"
                          isDisabled={!isObjectsSyncReady}
                          icon={
                            <Icon viewBox="0 0 24 24" boxSize={4}>
                              <path
                                d="M5 7h14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                              <path
                                d="M9 7V5.8c0-.66.54-1.2 1.2-1.2h3.6c.66 0 1.2.54 1.2 1.2V7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M8 7l.7 11.02c.04.57.51.98 1.08.98h4.44c.57 0 1.04-.41 1.08-.98L16 7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M10.5 10.5v5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                              <path
                                d="M13.5 10.5v5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </Icon>
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            openDeleteItemConfirm(item.id);
                          }}
                        />
                        <IconButton
                          aria-label={`Edit ${item.name}`}
                          size="sm"
                          variant="outline"
                          borderColor="rgba(43, 66, 47, 0.24)"
                          color="#2e5b37"
                          isDisabled={!isObjectsSyncReady}
                          icon={
                            <Icon viewBox="0 0 24 24" boxSize={4}>
                              <path
                                d="M4 20h4l10.5-10.5-4-4L4 16v4Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                              />
                              <path
                                d="m12.5 7.5 4 4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </Icon>
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(item);
                          }}
                        />
                      </Flex>
                    </Flex>
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
      </Box>

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        size={isObjectsSection || isMapsSection ? "3xl" : "md"}
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
            Add New {section.itemLabel}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="#fffdf8" overflowY="auto">
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={newItemName}
                  onChange={(event) => setNewItemName(event.target.value)}
                  placeholder={`Enter ${section.itemLabel} name`}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Category</FormLabel>
                <Select
                  value={newItemCategory}
                  onChange={(event) => setNewItemCategory(event.target.value)}
                >
                  {sectionState.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {isObjectsSection ? (
                <>
                  <FormControl isRequired>
                    <FormLabel>Image</FormLabel>
                    <Input
                      type="file"
                      accept=".png,.gif,image/png,image/gif"
                      onChange={(event) =>
                        handleMapObjectImageChange(event, setNewMapObjectImage)
                      }
                      p={1.5}
                    />
                    <Text mt={2} fontSize="sm" color="#55645a">
                      Upload a transparent PNG or GIF to use as the map object
                      sprite.
                    </Text>
                  </FormControl>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl isRequired isInvalid={newMapObjectWidth !== "" && !hasValidMapObjectWidth}>
                      <FormLabel>Width</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={newMapObjectWidth}
                        onChange={(event) => setNewMapObjectWidth(event.target.value)}
                        placeholder="Width in pixels"
                      />
                    </FormControl>
                    <FormControl isRequired isInvalid={newMapObjectHeight !== "" && !hasValidMapObjectHeight}>
                      <FormLabel>Height</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={newMapObjectHeight}
                        onChange={(event) => setNewMapObjectHeight(event.target.value)}
                        placeholder="Height in pixels"
                      />
                    </FormControl>
                  </SimpleGrid>
                  <FormControl isRequired>
                    <FormLabel>Map Object Type</FormLabel>
                    <Select
                      value={newMapObjectType}
                      onChange={(event) =>
                        setNewMapObjectType(event.target.value as DesignerMapObjectType)
                      }
                    >
                      {MAP_OBJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <Box
                    p={4}
                    borderRadius="20px"
                    border="1px solid rgba(43, 66, 47, 0.12)"
                    bg="linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(241,246,238,0.95) 100%)"
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="700"
                      textTransform="uppercase"
                      letterSpacing="0.14em"
                      color="#5e7a61"
                      mb={3}
                    >
                      Preview
                    </Text>
                    <Flex
                      minH="220px"
                      align="center"
                      justify="center"
                      borderRadius="18px"
                      border="1px dashed rgba(43, 66, 47, 0.18)"
                      bgSize="20px 20px"
                      bgImage="linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07)), linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07))"
                      bgPosition="0 0, 10px 10px"
                    >
                      {newMapObjectImage ? (
                        <Box
                          as="img"
                          src={newMapObjectImage}
                          alt="Map object preview"
                          width={
                            hasValidMapObjectWidth
                              ? `${newMapObjectWidth}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          height={
                            hasValidMapObjectHeight
                              ? `${newMapObjectHeight}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          maxW="100%"
                          maxH="200px"
                          objectFit="contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <Text color="#6d7b71" textAlign="center" maxW="240px">
                          Upload a PNG or GIF to preview the map object with the
                          selected width and height.
                        </Text>
                      )}
                    </Flex>
                    <Text mt={3} fontSize="sm" color="#55645a">
                      Saved size:{" "}
                      {hasValidMapObjectWidth ? newMapObjectWidth : "--"} x{" "}
                      {hasValidMapObjectHeight ? newMapObjectHeight : "--"} px
                      • Type: {newMapObjectType}
                    </Text>
                  </Box>
                </>
              ) : null}
              {isMapsSection ? (
                renderPlayableMapFields({
                  cellSize: newMapCellSize,
                  onCellSizeChange: setNewMapCellSize,
                  sizePreset: newMapSizePreset,
                  onSizePresetChange: setNewMapSizePreset,
                  customWidth: newMapCustomWidth,
                  onCustomWidthChange: setNewMapCustomWidth,
                  customHeight: newMapCustomHeight,
                  onCustomHeightChange: setNewMapCustomHeight,
                  regionName: newMapRegion,
                  onRegionChange: setNewMapRegion,
                  regionX: newMapRegionX,
                  onRegionXChange: setNewMapRegionX,
                  regionY: newMapRegionY,
                  onRegionYChange: setNewMapRegionY,
                  mapType: newMapType,
                  onMapTypeChange: setNewMapType,
                  backgroundColor: newMapBackgroundColor,
                  onBackgroundColorChange: setNewMapBackgroundColor,
                  backgroundImageSrc: newMapBackgroundImage,
                  onBackgroundImageChange: setNewMapBackgroundImage,
                  backgroundImageMode: newMapBackgroundImageMode,
                  onBackgroundImageModeChange: setNewMapBackgroundImageMode,
                  isValidDimensions: hasValidNewMapDimensions,
                })
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter
            gap={3}
            bg="#fffdf8"
            borderTop="1px solid rgba(43, 66, 47, 0.08)"
          >
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleAddItem}
              isDisabled={
                !newItemName.trim() ||
                !isMapObjectFormValid ||
                !isPlayableMapFormValid
              }
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isEditOpen}
        onClose={closeEditModal}
        size={isObjectsSection || isMapsSection ? "3xl" : "md"}
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
            Edit {section.itemLabel}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="#fffdf8" overflowY="auto">
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={editItemName}
                  onChange={(event) => setEditItemName(event.target.value)}
                  placeholder={`Enter ${section.itemLabel} name`}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Category</FormLabel>
                <Select
                  value={editItemCategory}
                  onChange={(event) => setEditItemCategory(event.target.value)}
                >
                  {sectionState.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {isObjectsSection ? (
                <>
                  <FormControl isRequired>
                    <FormLabel>Image</FormLabel>
                    <Input
                      type="file"
                      accept=".png,.gif,image/png,image/gif"
                      onChange={(event) =>
                        handleMapObjectImageChange(event, setEditMapObjectImage)
                      }
                      p={1.5}
                    />
                    <Text mt={2} fontSize="sm" color="#55645a">
                      Upload a transparent PNG or GIF to replace the current map
                      object sprite.
                    </Text>
                  </FormControl>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl
                      isRequired
                      isInvalid={editMapObjectWidth !== "" && !hasValidEditMapObjectWidth}
                    >
                      <FormLabel>Width</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={editMapObjectWidth}
                        onChange={(event) => setEditMapObjectWidth(event.target.value)}
                        placeholder="Width in pixels"
                      />
                    </FormControl>
                    <FormControl
                      isRequired
                      isInvalid={editMapObjectHeight !== "" && !hasValidEditMapObjectHeight}
                    >
                      <FormLabel>Height</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={editMapObjectHeight}
                        onChange={(event) => setEditMapObjectHeight(event.target.value)}
                        placeholder="Height in pixels"
                      />
                    </FormControl>
                  </SimpleGrid>
                  <FormControl isRequired>
                    <FormLabel>Map Object Type</FormLabel>
                    <Select
                      value={editMapObjectType}
                      onChange={(event) =>
                        setEditMapObjectType(event.target.value as DesignerMapObjectType)
                      }
                    >
                      {MAP_OBJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <Box
                    p={4}
                    borderRadius="20px"
                    border="1px solid rgba(43, 66, 47, 0.12)"
                    bg="linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(241,246,238,0.95) 100%)"
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="700"
                      textTransform="uppercase"
                      letterSpacing="0.14em"
                      color="#5e7a61"
                      mb={3}
                    >
                      Preview
                    </Text>
                    <Flex
                      minH="220px"
                      align="center"
                      justify="center"
                      borderRadius="18px"
                      border="1px dashed rgba(43, 66, 47, 0.18)"
                      bgSize="20px 20px"
                      bgImage="linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07)), linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07))"
                      bgPosition="0 0, 10px 10px"
                    >
                      {editMapObjectImage ? (
                        <Box
                          as="img"
                          src={editMapObjectImage}
                          alt="Map object preview"
                          width={
                            hasValidEditMapObjectWidth
                              ? `${editMapObjectWidth}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          height={
                            hasValidEditMapObjectHeight
                              ? `${editMapObjectHeight}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          maxW="100%"
                          maxH="200px"
                          objectFit="contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <Text color="#6d7b71" textAlign="center" maxW="240px">
                          Upload a PNG or GIF to preview the map object with the
                          selected width and height.
                        </Text>
                      )}
                    </Flex>
                    <Text mt={3} fontSize="sm" color="#55645a">
                      Saved size:{" "}
                      {hasValidEditMapObjectWidth ? editMapObjectWidth : "--"} x{" "}
                      {hasValidEditMapObjectHeight ? editMapObjectHeight : "--"} px
                      • Type: {editMapObjectType}
                    </Text>
                  </Box>
                </>
              ) : null}
              {isMapsSection ? (
                renderPlayableMapFields({
                  cellSize: editMapCellSize,
                  onCellSizeChange: setEditMapCellSize,
                  sizePreset: editMapSizePreset,
                  onSizePresetChange: setEditMapSizePreset,
                  customWidth: editMapCustomWidth,
                  onCustomWidthChange: setEditMapCustomWidth,
                  customHeight: editMapCustomHeight,
                  onCustomHeightChange: setEditMapCustomHeight,
                  regionName: editMapRegion,
                  onRegionChange: setEditMapRegion,
                  regionX: editMapRegionX,
                  onRegionXChange: setEditMapRegionX,
                  regionY: editMapRegionY,
                  onRegionYChange: setEditMapRegionY,
                  mapType: editMapType,
                  onMapTypeChange: setEditMapType,
                  backgroundColor: editMapBackgroundColor,
                  onBackgroundColorChange: setEditMapBackgroundColor,
                  backgroundImageSrc: editMapBackgroundImage,
                  onBackgroundImageChange: setEditMapBackgroundImage,
                  backgroundImageMode: editMapBackgroundImageMode,
                  onBackgroundImageModeChange: setEditMapBackgroundImageMode,
                  isValidDimensions: hasValidEditMapDimensions,
                })
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter
            gap={3}
            bg="#fffdf8"
            borderTop="1px solid rgba(43, 66, 47, 0.08)"
          >
            <Button
              colorScheme="red"
              variant="outline"
              mr="auto"
              onClick={() => {
                if (editingItemId) {
                  openDeleteItemConfirm(editingItemId);
                }
              }}
              isDisabled={!editingItemId || !isObjectsSyncReady}
            >
              Delete
            </Button>
            <Button variant="ghost" onClick={closeEditModal}>
              Cancel
            </Button>
            {isMapsSection && editingItemId ? (
              <Button
                as={RouterLink}
                to={getMapEditorPath(editingItemId)}
                variant="outline"
                borderColor="rgba(43, 66, 47, 0.24)"
                color="#2e5b37"
              >
                Map Editor
              </Button>
            ) : null}
            <Button
              colorScheme="green"
              onClick={handleEditItem}
              isDisabled={
                !editItemName.trim() ||
                !isEditMapObjectFormValid ||
                !isEditPlayableMapFormValid
              }
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={Boolean(deletingItemId)}
        onClose={closeDeleteItemConfirm}
        size="md"
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
          <ModalHeader
            color="#914335"
            bg="#fffdf8"
            borderBottom="1px solid rgba(145, 67, 53, 0.08)"
          >
            Delete {section.itemLabel}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="#fffdf8" overflowY="auto">
            <Text color="#6e2f24">
              Are you sure you want to delete this {section.itemLabel}?
            </Text>
          </ModalBody>
          <ModalFooter
            gap={3}
            bg="#fffdf8"
            borderTop="1px solid rgba(145, 67, 53, 0.08)"
          >
            <Button variant="ghost" onClick={closeDeleteItemConfirm}>
              No
            </Button>
            <Button colorScheme="red" onClick={handleDeleteItem}>
              Yes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        size="2xl"
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
            Categories
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="#fffdf8" overflowY="auto">
            <Stack spacing={6}>
              <Box
                p={4}
                borderRadius="18px"
                bg="rgba(126, 166, 120, 0.08)"
                border="1px solid rgba(43, 66, 47, 0.12)"
              >
                <Text fontWeight="700" color="#233127" mb={3}>
                  Add Category
                </Text>
                <Flex direction={{ base: "column", md: "row" }} gap={3}>
                  <Input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder={`Create a ${section.categoryLabel} folder`}
                    bg="white"
                  />
                  <Button
                    colorScheme="green"
                    onClick={handleAddCategory}
                    isDisabled={!newCategoryName.trim()}
                  >
                    Add
                  </Button>
                </Flex>
              </Box>

              <Box>
                <Text fontWeight="700" color="#233127" mb={3}>
                  Existing Categories
                </Text>
                <Stack spacing={3}>
                  {categorySummary.map((category) => {
                    const isEditing = editingCategory === category.name;
                    const isDeleting = deletingCategory === category.name;
                    const isLockedCategory = category.name === UNCATEGORIZED;

                    return (
                      <Box
                        key={category.name}
                        p={4}
                        borderRadius="18px"
                        border="1px solid rgba(43, 66, 47, 0.12)"
                        bg="rgba(255,255,255,0.78)"
                      >
                        <Flex
                          direction={{ base: "column", lg: "row" }}
                          justify="space-between"
                          align={{ base: "flex-start", lg: "center" }}
                          gap={4}
                        >
                          <Box flex="1">
                            {isEditing ? (
                              <Stack spacing={3}>
                                <Input
                                  value={editingCategoryName}
                                  onChange={(event) =>
                                    setEditingCategoryName(event.target.value)
                                  }
                                  placeholder="Rename category"
                                  bg="white"
                                />
                                <Flex wrap="wrap" gap={3}>
                                  <Button
                                    colorScheme="green"
                                    onClick={handleSaveCategory}
                                    isDisabled={!editingCategoryName.trim()}
                                  >
                                    Save
                                  </Button>
                                  <Button variant="ghost" onClick={cancelEditCategory}>
                                    Cancel
                                  </Button>
                                </Flex>
                              </Stack>
                            ) : (
                              <Box>
                                <Text fontWeight="700" color="#233127">
                                  {category.name}
                                </Text>
                                <Text fontSize="sm" color="#55645a">
                                  {category.count}{" "}
                                  {category.count === 1
                                    ? section.itemLabel
                                    : section.itemLabelPlural}
                                </Text>
                              </Box>
                            )}
                          </Box>

                          {!isEditing && (
                            <Flex wrap="wrap" gap={3}>
                              <Button
                                size="sm"
                                variant="outline"
                                borderColor="rgba(43, 66, 47, 0.24)"
                                onClick={() => startEditCategory(category.name)}
                                isDisabled={isLockedCategory}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                borderColor="rgba(145, 67, 53, 0.24)"
                                color="#914335"
                                onClick={() => startDeleteCategory(category.name)}
                                isDisabled={isLockedCategory}
                              >
                                Delete
                              </Button>
                            </Flex>
                          )}
                        </Flex>

                        {isDeleting && !isLockedCategory ? (
                          <Box
                            mt={4}
                            p={4}
                            borderRadius="16px"
                            bg="rgba(145, 67, 53, 0.06)"
                            border="1px solid rgba(145, 67, 53, 0.14)"
                          >
                            <Text fontWeight="700" color="#6e2f24" mb={2}>
                              Delete {category.name}?
                            </Text>
                            <Text fontSize="sm" color="#7b5147" mb={4}>
                              Existing {section.itemLabelPlural} in this category can move
                              into another category or become uncategorized.
                            </Text>
                            <FormControl mb={4}>
                              <FormLabel color="#7b5147">
                                Reassign existing items to
                              </FormLabel>
                              <Select
                                value={deleteCategoryTarget}
                                onChange={(event) =>
                                  setDeleteCategoryTarget(event.target.value)
                                }
                                bg="white"
                              >
                                {deleteCategoryOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <Flex wrap="wrap" gap={3}>
                              <Button colorScheme="red" onClick={handleDeleteCategory}>
                                Confirm Delete
                              </Button>
                              <Button variant="ghost" onClick={cancelDeleteCategory}>
                                Cancel
                              </Button>
                            </Flex>
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter bg="#fffdf8" borderTop="1px solid rgba(43, 66, 47, 0.08)">
            <Button variant="ghost" onClick={() => setIsCategoriesOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isMoveOpen} onClose={() => setIsMoveOpen(false)} scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.400" />
        <ModalContent
          borderRadius="24px"
          bg="#fffdf8"
          overflow="hidden"
          maxH="calc(100vh - 2rem)"
          boxShadow="0 28px 70px rgba(24, 34, 20, 0.24)"
        >
          <ModalHeader bg="#fffdf8" borderBottom="1px solid rgba(43, 66, 47, 0.08)">
            Move Selected Elements
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="#fffdf8" overflowY="auto">
            <Stack spacing={4}>
              <Text color="#55645a">
                Move {selectedCount} selected{" "}
                {selectedCount === 1 ? section.itemLabel : section.itemLabelPlural} into
                a new category folder.
              </Text>
              <FormControl>
                <FormLabel>Target Category</FormLabel>
                <Select
                  value={moveCategory}
                  onChange={(event) => setMoveCategory(event.target.value)}
                >
                  {sectionState.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter
            gap={3}
            bg="#fffdf8"
            borderTop="1px solid rgba(43, 66, 47, 0.08)"
          >
            <Button variant="ghost" onClick={() => setIsMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleMoveSelected}
              isDisabled={selectedCount === 0}
            >
              Move Elements
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
