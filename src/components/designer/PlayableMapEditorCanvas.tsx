import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import {
  type DesignerMapObjectType,
  type DesignerNpcAiType,
  type DesignerNpcType,
} from "./designerSections";

export interface MapEditorObjectCatalogItem {
  id: string;
  name: string;
  category: string;
  imageSrc: string;
  width: number;
  height: number;
  objectType: DesignerMapObjectType;
}

export interface MapEditorMapSummary {
  id: string;
  name: string;
}

export interface MapEditorPokemonCatalogItem {
  id: string;
  name: string;
  category: string;
}

export interface MapEditorNpcCatalogItem {
  id: string;
  name: string;
  category: string;
  previewImageSrc: string;
  npcType: DesignerNpcType;
  aiType: DesignerNpcAiType;
}

export interface MapEditorObjectPlacement {
  id: string;
  objectId: string;
  name: string;
  category: string;
  imageSrc: string;
  width: number;
  height: number;
  objectType: DesignerMapObjectType;
  x: number;
  y: number;
}

export type MapEditorPortalDestinationType =
  | "same-map"
  | "other-map"
  | "event-script";

export interface MapEditorPortalPlacement {
  id: string;
  x: number;
  y: number;
  destinationType: MapEditorPortalDestinationType;
  sameMapX: number;
  sameMapY: number;
  targetMapId: string;
  targetMapX: number;
  targetMapY: number;
  eventScript: string;
}

export interface MapEditorGrassPlacement {
  id: string;
  x: number;
  y: number;
  pokemonIds: string[];
  minLevel: number;
  maxLevel: number;
  encounterRate: number;
}

export interface MapEditorNpcPlacement {
  id: string;
  npcId: string;
  name: string;
  category: string;
  previewImageSrc: string;
  npcType: DesignerNpcType;
  aiType: DesignerNpcAiType;
  interactionDistanceSquares: number;
  x: number;
  y: number;
}

export const DEFAULT_NPC_INTERACTION_DISTANCE_SQUARES = 2;

export interface PlayableMapEditorData {
  version: 1;
  objects: MapEditorObjectPlacement[];
  portals: MapEditorPortalPlacement[];
  grass: MapEditorGrassPlacement[];
  npcs: MapEditorNpcPlacement[];
}

interface PlayableMapEditorCanvasProps {
  cellSize: number;
  mapWidth: number;
  mapHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  iframeSrc: string;
  backgroundStyle: React.CSSProperties;
  objectCatalog: MapEditorObjectCatalogItem[];
  pokemonCatalog: MapEditorPokemonCatalogItem[];
  npcCatalog: MapEditorNpcCatalogItem[];
  maps: MapEditorMapSummary[];
  currentMapId: string;
  value: PlayableMapEditorData;
  onChange: (value: PlayableMapEditorData) => void;
  isDirty: boolean;
}

type EditorTool = "selector" | "object" | "portal" | "grass" | "npc";

interface GridCell {
  x: number;
  y: number;
}

interface GridBounds {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface SelectionDraft {
  anchor: GridCell;
  current: GridCell;
}

interface ClipboardObjectPlacement extends MapEditorObjectPlacement {
  offsetX: number;
  offsetY: number;
}

interface ClipboardPortalPlacement extends MapEditorPortalPlacement {
  offsetX: number;
  offsetY: number;
}

interface ClipboardGrassPlacement extends MapEditorGrassPlacement {
  offsetX: number;
  offsetY: number;
}

interface ClipboardNpcPlacement extends MapEditorNpcPlacement {
  offsetX: number;
  offsetY: number;
}

interface MapEditorClipboard {
  width: number;
  height: number;
  objects: ClipboardObjectPlacement[];
  portals: ClipboardPortalPlacement[];
  grass: ClipboardGrassPlacement[];
  npcs: ClipboardNpcPlacement[];
}

interface PendingTransform {
  type: "move" | "paste";
  clipboard: MapEditorClipboard;
  sourceBounds: GridBounds | null;
}

function createEditorId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function clampCell(value: number, limit: number) {
  return Math.max(0, Math.min(value, Math.max(0, limit - 1)));
}

function normalizeBounds(start: GridCell, end: GridCell): GridBounds {
  return {
    startX: Math.min(start.x, end.x),
    startY: Math.min(start.y, end.y),
    endX: Math.max(start.x, end.x),
    endY: Math.max(start.y, end.y),
  };
}

function isCellInsideBounds(cell: GridCell, bounds: GridBounds) {
  return (
    cell.x >= bounds.startX &&
    cell.x <= bounds.endX &&
    cell.y >= bounds.startY &&
    cell.y <= bounds.endY
  );
}

function getBoundsSize(bounds: GridBounds) {
  return {
    width: bounds.endX - bounds.startX + 1,
    height: bounds.endY - bounds.startY + 1,
  };
}

function sanitizeCoordinate(value: string) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function clampEncounterRate(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampLevel(value: number) {
  return Math.max(1, Math.round(value));
}

function createEmptyPortal(targetMapId: string, cell: GridCell): MapEditorPortalPlacement {
  return {
    id: createEditorId("portal"),
    x: cell.x,
    y: cell.y,
    destinationType: "same-map",
    sameMapX: cell.x,
    sameMapY: cell.y,
    targetMapId,
    targetMapX: 0,
    targetMapY: 0,
    eventScript: "",
  };
}

function createEmptyEditorData(): PlayableMapEditorData {
  return {
    version: 1,
    objects: [],
    portals: [],
    grass: [],
    npcs: [],
  };
}

function buildClipboardFromBounds(
  data: PlayableMapEditorData,
  bounds: GridBounds
): MapEditorClipboard {
  const size = getBoundsSize(bounds);

  return {
    width: size.width,
    height: size.height,
    objects: data.objects
      .filter((item) => isCellInsideBounds({ x: item.x, y: item.y }, bounds))
      .map((item) => ({
        ...item,
        offsetX: item.x - bounds.startX,
        offsetY: item.y - bounds.startY,
      })),
    portals: data.portals
      .filter((item) => isCellInsideBounds({ x: item.x, y: item.y }, bounds))
      .map((item) => ({
        ...item,
        offsetX: item.x - bounds.startX,
        offsetY: item.y - bounds.startY,
      })),
    grass: data.grass
      .filter((item) => isCellInsideBounds({ x: item.x, y: item.y }, bounds))
      .map((item) => ({
        ...item,
        offsetX: item.x - bounds.startX,
        offsetY: item.y - bounds.startY,
      })),
    npcs: data.npcs
      .filter((item) => isCellInsideBounds({ x: item.x, y: item.y }, bounds))
      .map((item) => ({
        ...item,
        offsetX: item.x - bounds.startX,
        offsetY: item.y - bounds.startY,
      })),
  };
}

function removeItemsInsideBounds(
  data: PlayableMapEditorData,
  bounds: GridBounds
): PlayableMapEditorData {
  return {
    ...data,
    objects: data.objects.filter(
      (item) => !isCellInsideBounds({ x: item.x, y: item.y }, bounds)
    ),
    portals: data.portals.filter(
      (item) => !isCellInsideBounds({ x: item.x, y: item.y }, bounds)
    ),
    grass: data.grass.filter(
      (item) => !isCellInsideBounds({ x: item.x, y: item.y }, bounds)
    ),
    npcs: data.npcs.filter(
      (item) => !isCellInsideBounds({ x: item.x, y: item.y }, bounds)
    ),
  };
}

function getSurfaceCell(
  event: React.PointerEvent<HTMLDivElement>,
  cellSize: number,
  mapWidth: number,
  mapHeight: number
): GridCell {
  const bounds = event.currentTarget.getBoundingClientRect();
  const localX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width - 1));
  const localY = Math.max(0, Math.min(event.clientY - bounds.top, bounds.height - 1));

  return {
    x: clampCell(Math.floor(localX / cellSize), mapWidth),
    y: clampCell(Math.floor(localY / cellSize), mapHeight),
  };
}

function getSelectionBoxStyle(bounds: GridBounds, cellSize: number): React.CSSProperties {
  const size = getBoundsSize(bounds);

  return {
    position: "absolute",
    left: bounds.startX * cellSize,
    top: bounds.startY * cellSize,
    width: size.width * cellSize,
    height: size.height * cellSize,
    boxSizing: "border-box",
  };
}

function getPortalLabel(portal: MapEditorPortalPlacement, maps: MapEditorMapSummary[]) {
  if (portal.destinationType === "event-script") {
    return "Script";
  }

  if (portal.destinationType === "other-map") {
    const targetMap = maps.find((item) => item.id === portal.targetMapId);

    return targetMap ? targetMap.name : "Other Map";
  }

  return `X ${portal.sameMapX}, Y ${portal.sameMapY}`;
}

function getPokemonNames(
  ids: string[],
  pokemonCatalog: MapEditorPokemonCatalogItem[]
) {
  return ids
    .map((id) => pokemonCatalog.find((pokemon) => pokemon.id === id)?.name ?? null)
    .filter((name): name is string => Boolean(name));
}

export function sanitizePlayableMapEditorData(value: unknown): PlayableMapEditorData {
  if (!value || typeof value !== "object") {
    return createEmptyEditorData();
  }

  const candidate = value as Partial<PlayableMapEditorData>;
  const objects = Array.isArray(candidate.objects)
    ? candidate.objects
        .filter(
          (item): item is MapEditorObjectPlacement =>
            typeof item?.id === "string" &&
            typeof item?.objectId === "string" &&
            typeof item?.name === "string" &&
            typeof item?.category === "string" &&
            typeof item?.imageSrc === "string" &&
            typeof item?.width === "number" &&
            typeof item?.height === "number" &&
            typeof item?.x === "number" &&
            typeof item?.y === "number" &&
            typeof item?.objectType === "string"
        )
        .map((item) => ({
          ...item,
          width: Math.max(16, Math.round(item.width)),
          height: Math.max(16, Math.round(item.height)),
          x: Math.max(0, Math.round(item.x)),
          y: Math.max(0, Math.round(item.y)),
        }))
    : [];
  const portals = Array.isArray(candidate.portals)
    ? candidate.portals
        .filter(
          (item): item is MapEditorPortalPlacement =>
            typeof item?.id === "string" &&
            typeof item?.x === "number" &&
            typeof item?.y === "number" &&
            typeof item?.destinationType === "string" &&
            typeof item?.sameMapX === "number" &&
            typeof item?.sameMapY === "number" &&
            typeof item?.targetMapId === "string" &&
            typeof item?.targetMapX === "number" &&
            typeof item?.targetMapY === "number" &&
            typeof item?.eventScript === "string"
        )
        .map((item) => ({
          ...item,
          x: Math.max(0, Math.round(item.x)),
          y: Math.max(0, Math.round(item.y)),
          sameMapX: Math.round(item.sameMapX),
          sameMapY: Math.round(item.sameMapY),
          targetMapX: Math.round(item.targetMapX),
          targetMapY: Math.round(item.targetMapY),
        }))
    : [];
  const grass = Array.isArray(candidate.grass)
    ? candidate.grass
        .filter(
          (item): item is MapEditorGrassPlacement =>
            typeof item?.id === "string" &&
            typeof item?.x === "number" &&
            typeof item?.y === "number" &&
            Array.isArray(item?.pokemonIds) &&
            typeof item?.minLevel === "number" &&
            typeof item?.maxLevel === "number" &&
            typeof item?.encounterRate === "number"
        )
        .map((item) => ({
          ...item,
          x: Math.max(0, Math.round(item.x)),
          y: Math.max(0, Math.round(item.y)),
          pokemonIds: item.pokemonIds.filter((pokemonId): pokemonId is string => typeof pokemonId === "string"),
          minLevel: clampLevel(item.minLevel),
          maxLevel: Math.max(clampLevel(item.minLevel), clampLevel(item.maxLevel)),
          encounterRate: clampEncounterRate(item.encounterRate),
        }))
    : [];
  const npcs = Array.isArray(candidate.npcs)
    ? candidate.npcs
        .filter(
          (item): item is MapEditorNpcPlacement =>
            typeof item?.id === "string" &&
            typeof item?.npcId === "string" &&
            typeof item?.name === "string" &&
            typeof item?.category === "string" &&
            typeof item?.previewImageSrc === "string" &&
            typeof item?.npcType === "string" &&
            typeof item?.aiType === "string" &&
            typeof item?.x === "number" &&
            typeof item?.y === "number"
        )
        .map((item) => ({
          ...item,
          interactionDistanceSquares:
            typeof item.interactionDistanceSquares === "number" &&
            Number.isFinite(item.interactionDistanceSquares) &&
            item.interactionDistanceSquares >= 0
              ? Math.round(item.interactionDistanceSquares)
              : DEFAULT_NPC_INTERACTION_DISTANCE_SQUARES,
          x: Math.max(0, Math.round(item.x)),
          y: Math.max(0, Math.round(item.y)),
        }))
    : [];

  return {
    version: 1,
    objects,
    portals,
    grass,
    npcs,
  };
}

export default function PlayableMapEditorCanvas({
  cellSize,
  mapWidth,
  mapHeight,
  pixelWidth,
  pixelHeight,
  iframeSrc,
  backgroundStyle,
  objectCatalog,
  pokemonCatalog,
  npcCatalog,
  maps,
  currentMapId,
  value,
  onChange,
  isDirty,
}: PlayableMapEditorCanvasProps) {
  const [activeTool, setActiveTool] = useState<EditorTool>("selector");
  const [hoverCell, setHoverCell] = useState<GridCell | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [grassPaintDraft, setGrassPaintDraft] = useState<SelectionDraft | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<GridBounds | null>(null);
  const [clipboard, setClipboard] = useState<MapEditorClipboard | null>(null);
  const [pendingTransform, setPendingTransform] = useState<PendingTransform | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [selectedGrassId, setSelectedGrassId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const objectCategories = useMemo(
    () => Array.from(new Set(objectCatalog.map((item) => item.category))).sort(),
    [objectCatalog]
  );
  const [activeObjectCategory, setActiveObjectCategory] = useState(
    objectCategories[0] ?? ""
  );
  const availableObjects = useMemo(
    () =>
      objectCatalog.filter((item) =>
        activeObjectCategory ? item.category === activeObjectCategory : true
      ),
    [activeObjectCategory, objectCatalog]
  );
  const [activeObjectId, setActiveObjectId] = useState(availableObjects[0]?.id ?? "");
  const npcCategories = useMemo(
    () => Array.from(new Set(npcCatalog.map((item) => item.category))).sort(),
    [npcCatalog]
  );
  const [activeNpcCategory, setActiveNpcCategory] = useState(npcCategories[0] ?? "");
  const availableNpcs = useMemo(
    () =>
      npcCatalog.filter((item) =>
        activeNpcCategory ? item.category === activeNpcCategory : true
      ),
    [activeNpcCategory, npcCatalog]
  );
  const [activeNpcId, setActiveNpcId] = useState(availableNpcs[0]?.id ?? "");
  const [activeGrassPokemonIds, setActiveGrassPokemonIds] = useState<string[]>(
    pokemonCatalog[0] ? [pokemonCatalog[0].id] : []
  );
  const [activeGrassMinLevel, setActiveGrassMinLevel] = useState("5");
  const [activeGrassMaxLevel, setActiveGrassMaxLevel] = useState("8");
  const [activeGrassEncounterRate, setActiveGrassEncounterRate] = useState("30");
  const pokemonCategories = useMemo(
    () => Array.from(new Set(pokemonCatalog.map((pokemon) => pokemon.category))).sort(),
    [pokemonCatalog]
  );
  const [activePokemonCategoryFilter, setActivePokemonCategoryFilter] = useState("");
  const [pokemonSearchTerm, setPokemonSearchTerm] = useState("");

  useEffect(() => {
    if (!objectCategories.includes(activeObjectCategory)) {
      setActiveObjectCategory(objectCategories[0] ?? "");
    }
  }, [activeObjectCategory, objectCategories]);

  useEffect(() => {
    if (!availableObjects.some((item) => item.id === activeObjectId)) {
      setActiveObjectId(availableObjects[0]?.id ?? "");
    }
  }, [activeObjectId, availableObjects]);

  useEffect(() => {
    if (!npcCategories.includes(activeNpcCategory)) {
      setActiveNpcCategory(npcCategories[0] ?? "");
    }
  }, [activeNpcCategory, npcCategories]);

  useEffect(() => {
    if (!availableNpcs.some((item) => item.id === activeNpcId)) {
      setActiveNpcId(availableNpcs[0]?.id ?? "");
    }
  }, [activeNpcId, availableNpcs]);

  useEffect(() => {
    if (
      selectedPortalId &&
      !value.portals.some((portal) => portal.id === selectedPortalId)
    ) {
      setSelectedPortalId(null);
    }
  }, [selectedPortalId, value.portals]);

  useEffect(() => {
    if (
      selectedGrassId &&
      !value.grass.some((grassCell) => grassCell.id === selectedGrassId)
    ) {
      setSelectedGrassId(null);
    }
  }, [selectedGrassId, value.grass]);

  useEffect(() => {
    if (selectedNpcId && !value.npcs.some((npc) => npc.id === selectedNpcId)) {
      setSelectedNpcId(null);
    }
  }, [selectedNpcId, value.npcs]);

  useEffect(() => {
    if (pokemonCatalog.length === 0) {
      setActiveGrassPokemonIds([]);
      return;
    }

    setActiveGrassPokemonIds((current) => {
      const nextIds = current.filter((id) =>
        pokemonCatalog.some((pokemon) => pokemon.id === id)
      );

      return nextIds.length > 0 ? nextIds : [pokemonCatalog[0].id];
    });
  }, [pokemonCatalog]);

  useEffect(() => {
    if (
      activePokemonCategoryFilter &&
      !pokemonCategories.includes(activePokemonCategoryFilter)
    ) {
      setActivePokemonCategoryFilter("");
    }
  }, [activePokemonCategoryFilter, pokemonCategories]);

  const selectedObject = useMemo(
    () => objectCatalog.find((item) => item.id === activeObjectId) ?? null,
    [activeObjectId, objectCatalog]
  );
  const activeNpc = useMemo(
    () => npcCatalog.find((item) => item.id === activeNpcId) ?? null,
    [activeNpcId, npcCatalog]
  );
  const filteredPokemonCatalog = useMemo(() => {
    const normalizedSearch = pokemonSearchTerm.trim().toLowerCase();

    return pokemonCatalog.filter((pokemon) => {
      const matchesCategory =
        activePokemonCategoryFilter === "" ||
        pokemon.category === activePokemonCategoryFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        pokemon.name.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activePokemonCategoryFilter, pokemonCatalog, pokemonSearchTerm]);
  const activeSelectionBounds = selectionDraft
    ? normalizeBounds(selectionDraft.anchor, selectionDraft.current)
    : selectionBounds;
  const selectedPortal = useMemo(
    () => value.portals.find((portal) => portal.id === selectedPortalId) ?? null,
    [selectedPortalId, value.portals]
  );
  const selectedGrass = useMemo(
    () => value.grass.find((grassCell) => grassCell.id === selectedGrassId) ?? null,
    [selectedGrassId, value.grass]
  );
  const selectedNpc = useMemo(
    () => value.npcs.find((npc) => npc.id === selectedNpcId) ?? null,
    [selectedNpcId, value.npcs]
  );
  const selectedContents = useMemo(
    () =>
      activeSelectionBounds
        ? buildClipboardFromBounds(value, activeSelectionBounds)
        : null,
    [activeSelectionBounds, value]
  );
  const pendingPreviewBounds =
    pendingTransform && hoverCell
      ? {
          startX: hoverCell.x,
          startY: hoverCell.y,
          endX: Math.min(mapWidth - 1, hoverCell.x + pendingTransform.clipboard.width - 1),
          endY: Math.min(mapHeight - 1, hoverCell.y + pendingTransform.clipboard.height - 1),
        }
      : null;

  const setNextValue = (nextValue: PlayableMapEditorData) => {
    onChange({
      ...nextValue,
      version: 1,
    });
  };

  const activeGrassSettings = {
    pokemonIds: activeGrassPokemonIds,
    minLevel: clampLevel(sanitizeCoordinate(activeGrassMinLevel || "1")),
    maxLevel: Math.max(
      clampLevel(sanitizeCoordinate(activeGrassMinLevel || "1")),
      clampLevel(sanitizeCoordinate(activeGrassMaxLevel || activeGrassMinLevel || "1"))
    ),
    encounterRate: clampEncounterRate(
      sanitizeCoordinate(activeGrassEncounterRate || "0")
    ),
  };

  const handleCopySelection = () => {
    if (!activeSelectionBounds) {
      return;
    }

    setClipboard(buildClipboardFromBounds(value, activeSelectionBounds));
    setPendingTransform(null);
  };

  const handleCutSelection = () => {
    if (!activeSelectionBounds) {
      return;
    }

    setClipboard(buildClipboardFromBounds(value, activeSelectionBounds));
    setNextValue(removeItemsInsideBounds(value, activeSelectionBounds));
    setPendingTransform(null);
  };

  const handleDeleteSelection = () => {
    if (!activeSelectionBounds) {
      return;
    }

    setNextValue(removeItemsInsideBounds(value, activeSelectionBounds));
    setPendingTransform(null);
  };

  const handleMoveSelection = () => {
    if (!activeSelectionBounds) {
      return;
    }

    setPendingTransform({
      type: "move",
      clipboard: buildClipboardFromBounds(value, activeSelectionBounds),
      sourceBounds: activeSelectionBounds,
    });
    setActiveTool("selector");
  };

  const handlePasteSelection = () => {
    if (!clipboard) {
      return;
    }

    setPendingTransform({
      type: "paste",
      clipboard,
      sourceBounds: null,
    });
    setActiveTool("selector");
  };

  const commitPendingTransform = (targetCell: GridCell) => {
    if (!pendingTransform) {
      return;
    }

    const baseValue =
      pendingTransform.type === "move" && pendingTransform.sourceBounds
        ? removeItemsInsideBounds(value, pendingTransform.sourceBounds)
        : value;
    const nextObjects = pendingTransform.clipboard.objects
      .map((item) => ({
        ...item,
        id: pendingTransform.type === "move" ? item.id : createEditorId("object"),
        x: targetCell.x + item.offsetX,
        y: targetCell.y + item.offsetY,
      }))
      .filter((item) => item.x >= 0 && item.y >= 0 && item.x < mapWidth && item.y < mapHeight)
      .map(({ offsetX: _offsetX, offsetY: _offsetY, ...item }) => item);
    const nextPortals = pendingTransform.clipboard.portals
      .map((item) => ({
        ...item,
        id: pendingTransform.type === "move" ? item.id : createEditorId("portal"),
        x: targetCell.x + item.offsetX,
        y: targetCell.y + item.offsetY,
      }))
      .filter((item) => item.x >= 0 && item.y >= 0 && item.x < mapWidth && item.y < mapHeight)
      .map(({ offsetX: _offsetX, offsetY: _offsetY, ...item }) => item);
    const nextGrass = pendingTransform.clipboard.grass
      .map((item) => ({
        ...item,
        id: pendingTransform.type === "move" ? item.id : createEditorId("grass"),
        x: targetCell.x + item.offsetX,
        y: targetCell.y + item.offsetY,
      }))
      .filter((item) => item.x >= 0 && item.y >= 0 && item.x < mapWidth && item.y < mapHeight)
      .map(({ offsetX: _offsetX, offsetY: _offsetY, ...item }) => item);
    const nextNpcs = pendingTransform.clipboard.npcs
      .map((item) => ({
        ...item,
        id: pendingTransform.type === "move" ? item.id : createEditorId("npc"),
        x: targetCell.x + item.offsetX,
        y: targetCell.y + item.offsetY,
      }))
      .filter((item) => item.x >= 0 && item.y >= 0 && item.x < mapWidth && item.y < mapHeight)
      .map(({ offsetX: _offsetX, offsetY: _offsetY, ...item }) => item);
    const objectTargetKeys = new Set(nextObjects.map((item) => getCellKey(item.x, item.y)));
    const portalTargetKeys = new Set(nextPortals.map((item) => getCellKey(item.x, item.y)));
    const grassTargetKeys = new Set(nextGrass.map((item) => getCellKey(item.x, item.y)));
    const npcTargetKeys = new Set(nextNpcs.map((item) => getCellKey(item.x, item.y)));

    setNextValue({
      ...baseValue,
      objects: [
        ...baseValue.objects.filter(
          (item) => !objectTargetKeys.has(getCellKey(item.x, item.y))
        ),
        ...nextObjects,
      ],
      portals: [
        ...baseValue.portals.filter(
          (item) => !portalTargetKeys.has(getCellKey(item.x, item.y))
        ),
        ...nextPortals,
      ],
      grass: [
        ...baseValue.grass.filter(
          (item) => !grassTargetKeys.has(getCellKey(item.x, item.y))
        ),
        ...nextGrass,
      ],
      npcs: [
        ...baseValue.npcs.filter((item) => !npcTargetKeys.has(getCellKey(item.x, item.y))),
        ...nextNpcs,
      ],
    });
    setSelectionBounds({
      startX: targetCell.x,
      startY: targetCell.y,
      endX: Math.min(mapWidth - 1, targetCell.x + pendingTransform.clipboard.width - 1),
      endY: Math.min(mapHeight - 1, targetCell.y + pendingTransform.clipboard.height - 1),
    });
    setPendingTransform(null);
  };

  const placeObjectAtCell = (cell: GridCell) => {
    if (!selectedObject) {
      return;
    }

    setNextValue({
      ...value,
      objects: [
        ...value.objects.filter((item) => getCellKey(item.x, item.y) !== getCellKey(cell.x, cell.y)),
        {
          id: createEditorId("object"),
          objectId: selectedObject.id,
          name: selectedObject.name,
          category: selectedObject.category,
          imageSrc: selectedObject.imageSrc,
          width: selectedObject.width,
          height: selectedObject.height,
          objectType: selectedObject.objectType,
          x: cell.x,
          y: cell.y,
        },
      ],
    });
    setSelectionBounds({
      startX: cell.x,
      startY: cell.y,
      endX: cell.x,
      endY: cell.y,
    });
    setSelectedNpcId(null);
  };

  const placeOrSelectPortalAtCell = (cell: GridCell) => {
    const existingPortal =
      value.portals.find((item) => item.x === cell.x && item.y === cell.y) ?? null;

    if (existingPortal) {
      setSelectedPortalId(existingPortal.id);
      setSelectionBounds({
        startX: cell.x,
        startY: cell.y,
        endX: cell.x,
        endY: cell.y,
      });
      return;
    }

    const nextPortal = createEmptyPortal(currentMapId, cell);

    setNextValue({
      ...value,
      portals: [
        ...value.portals.filter((item) => getCellKey(item.x, item.y) !== getCellKey(cell.x, cell.y)),
        nextPortal,
      ],
    });
    setSelectedPortalId(nextPortal.id);
    setSelectedNpcId(null);
    setSelectionBounds({
      startX: cell.x,
      startY: cell.y,
      endX: cell.x,
      endY: cell.y,
    });
  };

  const placeOrSelectNpcAtCell = (cell: GridCell) => {
    const existingNpc =
      value.npcs.find((item) => item.x === cell.x && item.y === cell.y) ?? null;

    if (existingNpc && (!activeNpc || existingNpc.npcId === activeNpc.id)) {
      setSelectedNpcId(existingNpc.id);
      setSelectedPortalId(null);
      setSelectedGrassId(null);
      setSelectionBounds({
        startX: cell.x,
        startY: cell.y,
        endX: cell.x,
        endY: cell.y,
      });
      return;
    }

    if (!activeNpc) {
      return;
    }

    const nextNpc: MapEditorNpcPlacement = {
      id: existingNpc?.id ?? createEditorId("npc"),
      npcId: activeNpc.id,
      name: activeNpc.name,
      category: activeNpc.category,
      previewImageSrc: activeNpc.previewImageSrc,
      npcType: activeNpc.npcType,
      aiType: activeNpc.aiType,
      interactionDistanceSquares:
        existingNpc?.interactionDistanceSquares ?? DEFAULT_NPC_INTERACTION_DISTANCE_SQUARES,
      x: cell.x,
      y: cell.y,
    };

    setNextValue({
      ...value,
      npcs: [
        ...value.npcs.filter((item) => getCellKey(item.x, item.y) !== getCellKey(cell.x, cell.y)),
        nextNpc,
      ],
    });
    setSelectedNpcId(nextNpc.id);
    setSelectedPortalId(null);
    setSelectedGrassId(null);
    setSelectionBounds({
      startX: cell.x,
      startY: cell.y,
      endX: cell.x,
      endY: cell.y,
    });
  };

  const paintGrassInBounds = (bounds: GridBounds) => {
    const nextGrassCells: MapEditorGrassPlacement[] = [];

    for (let x = bounds.startX; x <= bounds.endX; x += 1) {
      for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        nextGrassCells.push({
          id: createEditorId("grass"),
          x,
          y,
          pokemonIds: [...activeGrassSettings.pokemonIds],
          minLevel: activeGrassSettings.minLevel,
          maxLevel: activeGrassSettings.maxLevel,
          encounterRate: activeGrassSettings.encounterRate,
        });
      }
    }

    const occupiedKeys = new Set(nextGrassCells.map((item) => getCellKey(item.x, item.y)));

    setNextValue({
      ...value,
      grass: [
        ...value.grass.filter((item) => !occupiedKeys.has(getCellKey(item.x, item.y))),
        ...nextGrassCells,
      ],
    });

    if (nextGrassCells.length === 1) {
      setSelectedGrassId(nextGrassCells[0].id);
      setSelectedNpcId(null);
      setSelectionBounds({
        startX: nextGrassCells[0].x,
        startY: nextGrassCells[0].y,
        endX: nextGrassCells[0].x,
        endY: nextGrassCells[0].y,
      });
    } else {
      setSelectionBounds(bounds);
      setSelectedGrassId(null);
      setSelectedNpcId(null);
    }
  };

  const updateSelectedPortal = (
    updater: (portal: MapEditorPortalPlacement) => MapEditorPortalPlacement
  ) => {
    if (!selectedPortalId) {
      return;
    }

    setNextValue({
      ...value,
      portals: value.portals.map((portal) =>
        portal.id === selectedPortalId ? updater(portal) : portal
      ),
    });
  };

  const removeSelectedPortal = () => {
    if (!selectedPortalId) {
      return;
    }

    setNextValue({
      ...value,
      portals: value.portals.filter((portal) => portal.id !== selectedPortalId),
    });
    setSelectedPortalId(null);
  };

  const updateSelectedGrass = (
    updater: (grassCell: MapEditorGrassPlacement) => MapEditorGrassPlacement
  ) => {
    if (!selectedGrassId) {
      return;
    }

    setNextValue({
      ...value,
      grass: value.grass.map((grassCell) =>
        grassCell.id === selectedGrassId ? updater(grassCell) : grassCell
      ),
    });
  };

  const removeSelectedGrass = () => {
    if (!selectedGrassId) {
      return;
    }

    setNextValue({
      ...value,
      grass: value.grass.filter((grassCell) => grassCell.id !== selectedGrassId),
    });
    setSelectedGrassId(null);
  };

  const updateSelectedNpc = (
    updater: (npc: MapEditorNpcPlacement) => MapEditorNpcPlacement
  ) => {
    if (!selectedNpcId) {
      return;
    }

    setNextValue({
      ...value,
      npcs: value.npcs.map((npc) => (npc.id === selectedNpcId ? updater(npc) : npc)),
    });
  };

  const removeSelectedNpc = () => {
    if (!selectedNpcId) {
      return;
    }

    setNextValue({
      ...value,
      npcs: value.npcs.filter((npc) => npc.id !== selectedNpcId),
    });
    setSelectedNpcId(null);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const cell = getSurfaceCell(event, cellSize, mapWidth, mapHeight);

    setHoverCell(cell);

    if (pendingTransform) {
      commitPendingTransform(cell);
      return;
    }

    if (activeTool === "object") {
      placeObjectAtCell(cell);
      return;
    }

    if (activeTool === "portal") {
      placeOrSelectPortalAtCell(cell);
      return;
    }

    if (activeTool === "grass") {
      setGrassPaintDraft({
        anchor: cell,
        current: cell,
      });
      setSelectedPortalId(null);
      setSelectedNpcId(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (activeTool === "npc") {
      placeOrSelectNpcAtCell(cell);
      return;
    }

    setSelectionDraft({
      anchor: cell,
      current: cell,
    });
    setSelectedPortalId(null);
    setSelectedNpcId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const cell = getSurfaceCell(event, cellSize, mapWidth, mapHeight);

    setHoverCell(cell);

    if (selectionDraft) {
      setSelectionDraft({
        ...selectionDraft,
        current: cell,
      });
    }

    if (grassPaintDraft) {
      setGrassPaintDraft({
        ...grassPaintDraft,
        current: cell,
      });
    }
  };

  const handlePointerUp = () => {
    if (grassPaintDraft) {
      const nextBounds = normalizeBounds(grassPaintDraft.anchor, grassPaintDraft.current);

      paintGrassInBounds(nextBounds);
      setGrassPaintDraft(null);
      return;
    }

    if (!selectionDraft) {
      return;
    }

    const nextBounds = normalizeBounds(selectionDraft.anchor, selectionDraft.current);

    setSelectionBounds(nextBounds);
    setSelectionDraft(null);

    const portalAtSelection =
      nextBounds.startX === nextBounds.endX && nextBounds.startY === nextBounds.endY
        ? value.portals.find(
            (portal) => portal.x === nextBounds.startX && portal.y === nextBounds.startY
          ) ?? null
        : null;
    const grassAtSelection =
      nextBounds.startX === nextBounds.endX && nextBounds.startY === nextBounds.endY
        ? value.grass.find(
            (grassCell) =>
              grassCell.x === nextBounds.startX && grassCell.y === nextBounds.startY
          ) ?? null
        : null;
    const npcAtSelection =
      nextBounds.startX === nextBounds.endX && nextBounds.startY === nextBounds.endY
        ? value.npcs.find(
            (npc) => npc.x === nextBounds.startX && npc.y === nextBounds.startY
          ) ?? null
        : null;

    setSelectedPortalId(portalAtSelection?.id ?? null);
    setSelectedGrassId(grassAtSelection?.id ?? null);
    setSelectedNpcId(npcAtSelection?.id ?? null);
  };

  const toolLabel =
    activeTool === "selector"
      ? pendingTransform
        ? pendingTransform.type === "move"
          ? "Click a cell to move the selected content."
          : "Click a cell to paste the copied content."
        : "Drag to select one or more cells."
      : activeTool === "object"
        ? selectedObject
          ? `Click to place ${selectedObject.name}.`
          : "Select an object to place."
        : activeTool === "portal"
          ? "Click a cell to place or select a portal cell."
          : activeTool === "grass"
            ? "Drag to paint grass cells with the active encounter setup."
            : activeNpc
              ? `Click to place ${activeNpc.name}.`
              : "Create an NPC in the designer, then place it here.";

  return (
    <Flex direction={{ base: "column", xl: "row" }} gap={5}>
      <Box
        flex="0 0 320px"
        borderRadius="20px"
        border="1px solid rgba(35, 49, 39, 0.12)"
        bg="#ffffff"
        p={4}
      >
        <Stack spacing={4}>
          <Box>
            <Text
              fontSize="xs"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="0.14em"
              color="#5e7a61"
              mb={2}
            >
              Tools
            </Text>
            <SimpleGrid columns={5} spacing={2}>
              <Button
                size="sm"
                colorScheme={activeTool === "selector" ? "green" : undefined}
                variant={activeTool === "selector" ? "solid" : "outline"}
                onClick={() => setActiveTool("selector")}
              >
                Select
              </Button>
              <Button
                size="sm"
                colorScheme={activeTool === "object" ? "green" : undefined}
                variant={activeTool === "object" ? "solid" : "outline"}
                onClick={() => setActiveTool("object")}
              >
                Objects
              </Button>
              <Button
                size="sm"
                colorScheme={activeTool === "portal" ? "green" : undefined}
                variant={activeTool === "portal" ? "solid" : "outline"}
                onClick={() => setActiveTool("portal")}
              >
                Portals
              </Button>
              <Button
                size="sm"
                colorScheme={activeTool === "grass" ? "green" : undefined}
                variant={activeTool === "grass" ? "solid" : "outline"}
                onClick={() => setActiveTool("grass")}
              >
                Grass
              </Button>
              <Button
                size="sm"
                colorScheme={activeTool === "npc" ? "green" : undefined}
                variant={activeTool === "npc" ? "solid" : "outline"}
                onClick={() => setActiveTool("npc")}
              >
                NPCs
              </Button>
            </SimpleGrid>
            <Text mt={3} fontSize="sm" color="#55645a">
              {toolLabel}
            </Text>
          </Box>

          <Divider />

          <Box>
            <Text
              fontSize="xs"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="0.14em"
              color="#5e7a61"
              mb={2}
            >
              Selection
            </Text>
            <SimpleGrid columns={2} spacing={2}>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopySelection}
                isDisabled={!activeSelectionBounds}
              >
                Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCutSelection}
                isDisabled={!activeSelectionBounds}
              >
                Cut
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePasteSelection}
                isDisabled={!clipboard}
              >
                Paste
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMoveSelection}
                isDisabled={!activeSelectionBounds}
              >
                Move
              </Button>
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                onClick={handleDeleteSelection}
                isDisabled={!activeSelectionBounds}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectionBounds(null);
                  setSelectionDraft(null);
                  setGrassPaintDraft(null);
                  setPendingTransform(null);
                  setSelectedPortalId(null);
                  setSelectedGrassId(null);
                  setSelectedNpcId(null);
                }}
              >
                Clear
              </Button>
            </SimpleGrid>
            <Text mt={3} fontSize="sm" color="#55645a">
              {activeSelectionBounds
                ? `${getBoundsSize(activeSelectionBounds).width} x ${getBoundsSize(activeSelectionBounds).height} cells selected • ${selectedContents?.objects.length ?? 0} objects • ${selectedContents?.portals.length ?? 0} portals • ${selectedContents?.grass.length ?? 0} grass • ${selectedContents?.npcs.length ?? 0} NPCs`
                : "No selection yet."}
            </Text>
          </Box>

          {activeTool === "object" ? (
            <>
              <Divider />
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  color="#5e7a61"
                  mb={2}
                >
                  Object Tool
                </Text>
                <FormControl mb={3}>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={activeObjectCategory}
                    onChange={(event) => setActiveObjectCategory(event.target.value)}
                  >
                    {objectCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <Stack spacing={2} maxH="260px" overflowY="auto">
                  {availableObjects.map((item) => (
                    <Flex
                      key={item.id}
                      align="center"
                      gap={3}
                      p={2.5}
                      borderRadius="14px"
                      borderWidth="1px"
                      borderColor={
                        item.id === activeObjectId
                          ? "rgba(46, 91, 55, 0.44)"
                          : "rgba(35, 49, 39, 0.12)"
                      }
                      bg={
                        item.id === activeObjectId
                          ? "rgba(232, 244, 228, 0.96)"
                          : "rgba(255,255,255,0.78)"
                      }
                      cursor="pointer"
                      onClick={() => setActiveObjectId(item.id)}
                    >
                      <Flex
                        align="center"
                        justify="center"
                        w="56px"
                        h="56px"
                        borderRadius="12px"
                        bg="rgba(35, 49, 39, 0.06)"
                        overflow="hidden"
                        flexShrink={0}
                      >
                        {item.imageSrc ? (
                          <Box
                            as="img"
                            src={item.imageSrc}
                            alt={`${item.name} preview`}
                            maxW="56px"
                            maxH="56px"
                            objectFit="contain"
                            style={{ imageRendering: "pixelated" }}
                          />
                        ) : (
                          <Text fontSize="xs" textAlign="center" color="#55645a" px={2}>
                            No Image
                          </Text>
                        )}
                      </Flex>
                      <Box minW={0}>
                        <Text fontWeight="700" color="#233127" noOfLines={1}>
                          {item.name}
                        </Text>
                        <Text fontSize="sm" color="#55645a">
                          {item.width} x {item.height} px • {item.objectType}
                        </Text>
                      </Box>
                    </Flex>
                  ))}
                </Stack>
              </Box>
            </>
          ) : null}

          {activeTool === "npc" ? (
            <>
              <Divider />
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  color="#5e7a61"
                  mb={2}
                >
                  NPC Tool
                </Text>
                {npcCatalog.length > 0 ? (
                  <>
                    <FormControl mb={3}>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={activeNpcCategory}
                        onChange={(event) => setActiveNpcCategory(event.target.value)}
                      >
                        {npcCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <Stack spacing={2} maxH="260px" overflowY="auto">
                      {availableNpcs.map((npc) => (
                        <Flex
                          key={npc.id}
                          align="center"
                          gap={3}
                          p={2.5}
                          borderRadius="14px"
                          borderWidth="1px"
                          borderColor={
                            npc.id === activeNpcId
                              ? "rgba(46, 91, 55, 0.44)"
                              : "rgba(35, 49, 39, 0.12)"
                          }
                          bg={
                            npc.id === activeNpcId
                              ? "rgba(232, 244, 228, 0.96)"
                              : "rgba(255,255,255,0.78)"
                          }
                          cursor="pointer"
                          onClick={() => setActiveNpcId(npc.id)}
                        >
                          <Flex
                            align="center"
                            justify="center"
                            w="56px"
                            h="56px"
                            borderRadius="12px"
                            bg="rgba(35, 49, 39, 0.06)"
                            overflow="hidden"
                            flexShrink={0}
                          >
                            {npc.previewImageSrc ? (
                              <Box
                                as="img"
                                src={npc.previewImageSrc}
                                alt={`${npc.name} preview`}
                                maxW="56px"
                                maxH="56px"
                                objectFit="contain"
                                style={{ imageRendering: "pixelated" }}
                              />
                            ) : (
                              <Text fontSize="xs" textAlign="center" color="#55645a" px={2}>
                                No Image
                              </Text>
                            )}
                          </Flex>
                          <Box minW={0}>
                            <Text fontWeight="700" color="#233127" noOfLines={1}>
                              {npc.name}
                            </Text>
                            <Text fontSize="sm" color="#55645a">
                              {npc.npcType} • {npc.aiType}
                            </Text>
                          </Box>
                        </Flex>
                      ))}
                    </Stack>
                  </>
                ) : (
                  <Text fontSize="sm" color="#55645a">
                    Create NPCs in the designer section first, then place them on this map.
                  </Text>
                )}
              </Box>
            </>
          ) : null}

          {activeTool === "grass" ? (
            <>
              <Divider />
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  color="#5e7a61"
                  mb={2}
                >
                  Grass Tool
                </Text>
                <Text fontSize="sm" color="#55645a" mb={3}>
                  Drag to paint multiple grass cells using this encounter setup.
                </Text>
                <Stack spacing={3}>
                  <SimpleGrid columns={2} spacing={3}>
                    <FormControl>
                      <FormLabel>Pokemon Category</FormLabel>
                      <Select
                        value={activePokemonCategoryFilter}
                        onChange={(event) =>
                          setActivePokemonCategoryFilter(event.target.value)
                        }
                      >
                        <option value="">All Categories</option>
                        {pokemonCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Search Name</FormLabel>
                      <Input
                        value={pokemonSearchTerm}
                        onChange={(event) => setPokemonSearchTerm(event.target.value)}
                        placeholder="Search pokemon"
                      />
                    </FormControl>
                  </SimpleGrid>
                  <Box>
                    <Text fontSize="sm" fontWeight="700" color="#233127" mb={2}>
                      Pokemon Encounters
                    </Text>
                    <Stack spacing={2} maxH="220px" overflowY="auto">
                      {filteredPokemonCatalog.map((pokemon) => {
                        const isSelected = activeGrassPokemonIds.includes(pokemon.id);

                        return (
                          <Flex
                            key={pokemon.id}
                            align="center"
                            justify="space-between"
                            gap={3}
                            p={2.5}
                            borderRadius="14px"
                            borderWidth="1px"
                            borderColor={
                              isSelected
                                ? "rgba(46, 91, 55, 0.44)"
                                : "rgba(35, 49, 39, 0.12)"
                            }
                            bg={
                              isSelected
                                ? "rgba(232, 244, 228, 0.96)"
                                : "rgba(255,255,255,0.78)"
                            }
                            cursor="pointer"
                            onClick={() =>
                              setActiveGrassPokemonIds((current) => {
                                if (current.includes(pokemon.id)) {
                                  return current.length === 1
                                    ? current
                                    : current.filter((id) => id !== pokemon.id);
                                }

                                return [...current, pokemon.id];
                              })
                            }
                          >
                            <Box minW={0}>
                              <Text fontWeight="700" color="#233127" noOfLines={1}>
                                {pokemon.name}
                              </Text>
                              <Text fontSize="sm" color="#55645a">
                                {pokemon.category}
                              </Text>
                            </Box>
                            <Text fontSize="xs" fontWeight="700" color="#2e5b37">
                              {isSelected ? "On" : "Off"}
                            </Text>
                          </Flex>
                        );
                      })}
                      {filteredPokemonCatalog.length === 0 ? (
                        <Text fontSize="sm" color="#55645a">
                          No Pokemon match this category/search.
                        </Text>
                      ) : null}
                    </Stack>
                  </Box>
                  <SimpleGrid columns={2} spacing={3}>
                    <FormControl>
                      <FormLabel>Min Level</FormLabel>
                      <Input
                        value={activeGrassMinLevel}
                        onChange={(event) => setActiveGrassMinLevel(event.target.value)}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Max Level</FormLabel>
                      <Input
                        value={activeGrassMaxLevel}
                        onChange={(event) => setActiveGrassMaxLevel(event.target.value)}
                      />
                    </FormControl>
                  </SimpleGrid>
                  <FormControl>
                    <FormLabel>Encounter Ratio %</FormLabel>
                    <Input
                      value={activeGrassEncounterRate}
                      onChange={(event) => setActiveGrassEncounterRate(event.target.value)}
                    />
                  </FormControl>
                  <Text fontSize="sm" color="#55645a">
                    Selected Pokemon: {getPokemonNames(activeGrassPokemonIds, pokemonCatalog).join(", ") || "None"}
                  </Text>
                </Stack>
              </Box>
            </>
          ) : null}

          {selectedPortal ? (
            <>
              <Divider />
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  color="#5e7a61"
                  mb={2}
                >
                  Portal Cell
                </Text>
                <Text fontSize="sm" color="#55645a" mb={3}>
                  Cell X {selectedPortal.x}, Y {selectedPortal.y}
                </Text>
                <Stack spacing={3}>
                  <FormControl>
                    <FormLabel>Destination</FormLabel>
                    <Select
                      value={selectedPortal.destinationType}
                      onChange={(event) =>
                        updateSelectedPortal((portal) => ({
                          ...portal,
                          destinationType:
                            event.target.value as MapEditorPortalDestinationType,
                        }))
                      }
                    >
                      <option value="same-map">Same Map</option>
                      <option value="other-map">Another Map</option>
                      <option value="event-script">Event Script</option>
                    </Select>
                  </FormControl>

                  {selectedPortal.destinationType === "same-map" ? (
                    <SimpleGrid columns={2} spacing={3}>
                      <FormControl>
                        <FormLabel>Target X</FormLabel>
                        <Input
                          value={String(selectedPortal.sameMapX)}
                          onChange={(event) =>
                            updateSelectedPortal((portal) => ({
                              ...portal,
                              sameMapX: sanitizeCoordinate(event.target.value),
                            }))
                          }
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Target Y</FormLabel>
                        <Input
                          value={String(selectedPortal.sameMapY)}
                          onChange={(event) =>
                            updateSelectedPortal((portal) => ({
                              ...portal,
                              sameMapY: sanitizeCoordinate(event.target.value),
                            }))
                          }
                        />
                      </FormControl>
                    </SimpleGrid>
                  ) : null}

                  {selectedPortal.destinationType === "other-map" ? (
                    <>
                      <FormControl>
                        <FormLabel>Target Map</FormLabel>
                        <Select
                          value={selectedPortal.targetMapId}
                          onChange={(event) =>
                            updateSelectedPortal((portal) => ({
                              ...portal,
                              targetMapId: event.target.value,
                            }))
                          }
                        >
                          {maps.map((map) => (
                            <option key={map.id} value={map.id}>
                              {map.name}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <SimpleGrid columns={2} spacing={3}>
                        <FormControl>
                          <FormLabel>Target X</FormLabel>
                          <Input
                            value={String(selectedPortal.targetMapX)}
                            onChange={(event) =>
                              updateSelectedPortal((portal) => ({
                                ...portal,
                                targetMapX: sanitizeCoordinate(event.target.value),
                              }))
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Target Y</FormLabel>
                          <Input
                            value={String(selectedPortal.targetMapY)}
                            onChange={(event) =>
                              updateSelectedPortal((portal) => ({
                                ...portal,
                                targetMapY: sanitizeCoordinate(event.target.value),
                              }))
                            }
                          />
                        </FormControl>
                      </SimpleGrid>
                    </>
                  ) : null}

                  {selectedPortal.destinationType === "event-script" ? (
                    <FormControl>
                      <FormLabel>Event Script</FormLabel>
                      <Textarea
                        minH="120px"
                        resize="vertical"
                        value={selectedPortal.eventScript}
                        onChange={(event) =>
                          updateSelectedPortal((portal) => ({
                            ...portal,
                            eventScript: event.target.value,
                          }))
                        }
                        placeholder="onEnter: movePlayer('cutscene_start')"
                      />
                    </FormControl>
                  ) : null}

                  <Button colorScheme="red" variant="outline" onClick={removeSelectedPortal}>
                    Remove Portal
                  </Button>
                </Stack>
              </Box>
            </>
          ) : null}

          {selectedGrass ? (
            <>
              <Divider />
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  color="#5e7a61"
                  mb={2}
                >
                  Grass Cell
                </Text>
                <Text fontSize="sm" color="#55645a" mb={3}>
                  Cell X {selectedGrass.x}, Y {selectedGrass.y}
                </Text>
                <Stack spacing={3}>
                  <SimpleGrid columns={2} spacing={3}>
                    <FormControl>
                      <FormLabel>Pokemon Category</FormLabel>
                      <Select
                        value={activePokemonCategoryFilter}
                        onChange={(event) =>
                          setActivePokemonCategoryFilter(event.target.value)
                        }
                      >
                        <option value="">All Categories</option>
                        {pokemonCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Search Name</FormLabel>
                      <Input
                        value={pokemonSearchTerm}
                        onChange={(event) => setPokemonSearchTerm(event.target.value)}
                        placeholder="Search pokemon"
                      />
                    </FormControl>
                  </SimpleGrid>
                  <Box>
                    <Text fontSize="sm" fontWeight="700" color="#233127" mb={2}>
                      Pokemon Encounters
                    </Text>
                    <Stack spacing={2} maxH="220px" overflowY="auto">
                      {filteredPokemonCatalog.map((pokemon) => {
                        const isSelected = selectedGrass.pokemonIds.includes(pokemon.id);

                        return (
                          <Flex
                            key={pokemon.id}
                            align="center"
                            justify="space-between"
                            gap={3}
                            p={2.5}
                            borderRadius="14px"
                            borderWidth="1px"
                            borderColor={
                              isSelected
                                ? "rgba(46, 91, 55, 0.44)"
                                : "rgba(35, 49, 39, 0.12)"
                            }
                            bg={
                              isSelected
                                ? "rgba(232, 244, 228, 0.96)"
                                : "rgba(255,255,255,0.78)"
                            }
                            cursor="pointer"
                            onClick={() =>
                              updateSelectedGrass((grassCell) => ({
                                ...grassCell,
                                pokemonIds: grassCell.pokemonIds.includes(pokemon.id)
                                  ? grassCell.pokemonIds.length === 1
                                    ? grassCell.pokemonIds
                                    : grassCell.pokemonIds.filter((id) => id !== pokemon.id)
                                  : [...grassCell.pokemonIds, pokemon.id],
                              }))
                            }
                          >
                            <Box minW={0}>
                              <Text fontWeight="700" color="#233127" noOfLines={1}>
                                {pokemon.name}
                              </Text>
                              <Text fontSize="sm" color="#55645a">
                                {pokemon.category}
                              </Text>
                            </Box>
                            <Text fontSize="xs" fontWeight="700" color="#2e5b37">
                              {isSelected ? "On" : "Off"}
                            </Text>
                          </Flex>
                        );
                      })}
                      {filteredPokemonCatalog.length === 0 ? (
                        <Text fontSize="sm" color="#55645a">
                          No Pokemon match this category/search.
                        </Text>
                      ) : null}
                    </Stack>
                  </Box>
                  <SimpleGrid columns={2} spacing={3}>
                    <FormControl>
                      <FormLabel>Min Level</FormLabel>
                      <Input
                        value={String(selectedGrass.minLevel)}
                        onChange={(event) =>
                          updateSelectedGrass((grassCell) => ({
                            ...grassCell,
                            minLevel: clampLevel(sanitizeCoordinate(event.target.value)),
                            maxLevel: Math.max(
                              clampLevel(sanitizeCoordinate(event.target.value)),
                              grassCell.maxLevel
                            ),
                          }))
                        }
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Max Level</FormLabel>
                      <Input
                        value={String(selectedGrass.maxLevel)}
                        onChange={(event) =>
                          updateSelectedGrass((grassCell) => ({
                            ...grassCell,
                            maxLevel: Math.max(
                              grassCell.minLevel,
                              clampLevel(sanitizeCoordinate(event.target.value))
                            ),
                          }))
                        }
                      />
                    </FormControl>
                  </SimpleGrid>
                  <FormControl>
                    <FormLabel>Encounter Ratio %</FormLabel>
                    <Input
                      value={String(selectedGrass.encounterRate)}
                      onChange={(event) =>
                        updateSelectedGrass((grassCell) => ({
                          ...grassCell,
                          encounterRate: clampEncounterRate(
                            sanitizeCoordinate(event.target.value)
                          ),
                        }))
                      }
                    />
                  </FormControl>
                  <Text fontSize="sm" color="#55645a">
                    Pokemon: {getPokemonNames(selectedGrass.pokemonIds, pokemonCatalog).join(", ") || "None"}
                  </Text>
                  <Button colorScheme="red" variant="outline" onClick={removeSelectedGrass}>
                    Remove Grass
                  </Button>
                </Stack>
              </Box>
            </>
          ) : null}

          {selectedNpc ? (
            <>
              <Divider />
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  color="#5e7a61"
                  mb={2}
                >
                  NPC Cell
                </Text>
                <Text fontSize="sm" color="#55645a" mb={3}>
                  Cell X {selectedNpc.x}, Y {selectedNpc.y}
                </Text>
                <Stack spacing={3}>
                  <FormControl>
                    <FormLabel>Assigned NPC</FormLabel>
                    <Select
                      value={selectedNpc.npcId}
                      onChange={(event) => {
                        const nextNpc = npcCatalog.find((item) => item.id === event.target.value);

                        if (!nextNpc) {
                          return;
                        }

                        updateSelectedNpc((npc) => ({
                          ...npc,
                          npcId: nextNpc.id,
                          name: nextNpc.name,
                          category: nextNpc.category,
                          previewImageSrc: nextNpc.previewImageSrc,
                          npcType: nextNpc.npcType,
                          aiType: nextNpc.aiType,
                        }));
                      }}
                    >
                      {npcCatalog.map((npc) => (
                        <option key={npc.id} value={npc.id}>
                          {npc.name} ({npc.category})
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <Text fontSize="sm" color="#55645a">
                    Type: {selectedNpc.npcType}
                  </Text>
                  <Text fontSize="sm" color="#55645a">
                    AI: {selectedNpc.aiType}
                  </Text>
                  <FormControl>
                    <FormLabel>Interaction Distance (cells)</FormLabel>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={selectedNpc.interactionDistanceSquares}
                      onChange={(event) =>
                        updateSelectedNpc((npc) => ({
                          ...npc,
                          interactionDistanceSquares: Math.max(
                            0,
                            sanitizeCoordinate(event.target.value)
                          ),
                        }))
                      }
                    />
                  </FormControl>
                  <Text fontSize="sm" color="#55645a">
                    Players must be this many map squares away or less to interact. Default is{" "}
                    {DEFAULT_NPC_INTERACTION_DISTANCE_SQUARES}.
                  </Text>
                  <Button colorScheme="red" variant="outline" onClick={removeSelectedNpc}>
                    Remove NPC
                  </Button>
                </Stack>
              </Box>
            </>
          ) : null}

          <Divider />

          <Box>
            <Text
              fontSize="xs"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="0.14em"
              color="#5e7a61"
              mb={2}
            >
              Map Data
            </Text>
            <Text fontSize="sm" color="#55645a">
              Objects: {value.objects.length}
            </Text>
            <Text fontSize="sm" color="#55645a">
              Portals: {value.portals.length}
            </Text>
            <Text fontSize="sm" color="#55645a">
              Grass cells: {value.grass.length}
            </Text>
            <Text fontSize="sm" color="#55645a">
              NPCs: {value.npcs.length}
            </Text>
            <Text fontSize="sm" color={isDirty ? "#8b5a20" : "#55645a"}>
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </Text>
          </Box>
        </Stack>
      </Box>

      <Box flex="1" minW={0}>
        <Box
          borderRadius="20px"
          border="1px solid rgba(35, 49, 39, 0.12)"
          bg="#eef3ec"
          p={3}
          overflow="auto"
          maxH="calc(100vh - 240px)"
        >
          <Box
            position="relative"
            width={`${pixelWidth}px`}
            height={`${pixelHeight}px`}
            minWidth="100%"
            sx={backgroundStyle}
            boxShadow="0 18px 50px rgba(24, 34, 20, 0.18)"
            overflow="hidden"
          >
            <Box
              as="iframe"
              title="Map Preview"
              src={iframeSrc}
              width={`${pixelWidth}px`}
              height={`${pixelHeight}px`}
              border="0"
              display="block"
              loading="lazy"
              bg="transparent"
            />

            {value.objects.map((item) => (
              <Box
                key={item.id}
                position="absolute"
                left={`${item.x * cellSize}px`}
                top={`${item.y * cellSize}px`}
                width={`${item.width}px`}
                height={`${item.height}px`}
                pointerEvents="none"
                zIndex={2}
              >
                {item.imageSrc ? (
                  <Box
                    as="img"
                    src={item.imageSrc}
                    alt={`${item.name} object`}
                    width={`${item.width}px`}
                    height={`${item.height}px`}
                    objectFit="contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <Flex
                    align="center"
                    justify="center"
                    width="100%"
                    height="100%"
                    border="1px dashed rgba(16, 22, 14, 0.55)"
                    bg="rgba(255,255,255,0.55)"
                    color="#1f2d25"
                    fontSize="xs"
                    fontWeight="700"
                    textAlign="center"
                    px={2}
                  >
                    {item.name}
                  </Flex>
                )}
              </Box>
            ))}

            {value.grass.map((grassCell) => (
              <Box
                key={grassCell.id}
                position="absolute"
                left={`${grassCell.x * cellSize}px`}
                top={`${grassCell.y * cellSize}px`}
                width={`${cellSize}px`}
                height={`${cellSize}px`}
                border={
                  grassCell.id === selectedGrassId
                    ? "2px solid rgba(34, 197, 94, 0.95)"
                    : "1px solid rgba(20, 83, 45, 0.45)"
                }
                bg={
                  grassCell.id === selectedGrassId
                    ? "rgba(34, 197, 94, 0.38)"
                    : "rgba(34, 197, 94, 0.22)"
                }
                pointerEvents="none"
                zIndex={2}
                sx={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(20, 83, 45, 0.36) 0 4px, rgba(74, 222, 128, 0.08) 4px 8px)",
                }}
              />
            ))}

            {value.portals.map((portal) => (
              <Flex
                key={portal.id}
                position="absolute"
                left={`${portal.x * cellSize}px`}
                top={`${portal.y * cellSize}px`}
                width={`${cellSize}px`}
                height={`${cellSize}px`}
                align="center"
                justify="center"
                border={
                  portal.id === selectedPortalId
                    ? "2px solid #f97316"
                    : "2px solid rgba(147, 51, 234, 0.92)"
                }
                bg={
                  portal.id === selectedPortalId
                    ? "rgba(249, 115, 22, 0.2)"
                    : "rgba(147, 51, 234, 0.18)"
                }
                color="#1f132b"
                fontSize="10px"
                fontWeight="800"
                lineHeight="1.1"
                textAlign="center"
                px={1}
                pointerEvents="none"
                zIndex={3}
              >
                P
              </Flex>
            ))}

            {value.npcs.map((npc) => (
              <Flex
                key={npc.id}
                position="absolute"
                left={`${npc.x * cellSize}px`}
                top={`${npc.y * cellSize}px`}
                width={`${cellSize}px`}
                height={`${cellSize}px`}
                align="center"
                justify="center"
                border={
                  npc.id === selectedNpcId
                    ? "2px solid rgba(14, 116, 144, 0.95)"
                    : "1px solid rgba(8, 145, 178, 0.5)"
                }
                bg={
                  npc.id === selectedNpcId
                    ? "rgba(6, 182, 212, 0.26)"
                    : "rgba(6, 182, 212, 0.14)"
                }
                pointerEvents="none"
                zIndex={4}
                overflow="hidden"
              >
                {npc.previewImageSrc ? (
                  <Box
                    as="img"
                    src={npc.previewImageSrc}
                    alt={`${npc.name} npc`}
                    width={`${cellSize}px`}
                    height={`${cellSize}px`}
                    objectFit="contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <Text fontSize="10px" fontWeight="800" color="#0f172a">
                    N
                  </Text>
                )}
              </Flex>
            ))}

            <Box
              position="absolute"
              inset={0}
              backgroundSize={`${cellSize}px ${cellSize}px`}
              backgroundImage="
                linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)
              "
              pointerEvents="none"
              zIndex={3}
            />

            <Box
              position="absolute"
              inset={0}
              zIndex={4}
              cursor={
                pendingTransform
                  ? "copy"
                  : activeTool === "selector"
                    ? "crosshair"
                    : "cell"
              }
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => {
                setHoverCell(null);
                setGrassPaintDraft(null);
              }}
            >
              <style>
                {`
                  @keyframes map-editor-cursor-blink {
                    0%, 100% {
                      border-color: #ffffff;
                      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.85);
                    }
                    50% {
                      border-color: #000000;
                      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.9);
                    }
                  }
                `}
              </style>

              {hoverCell ? (
                <>
                  <Box
                    position="absolute"
                    left={`${hoverCell.x * cellSize}px`}
                    top={`${hoverCell.y * cellSize}px`}
                    width={`${cellSize}px`}
                    height={`${cellSize}px`}
                    border="2px solid #ffffff"
                    boxSizing="border-box"
                    bg="rgba(255, 255, 255, 0.08)"
                    pointerEvents="none"
                    animation="map-editor-cursor-blink 0.8s steps(1, end) infinite"
                  />
                  <Box
                    position="absolute"
                    left={`${Math.min(hoverCell.x * cellSize + 8, Math.max(8, pixelWidth - 220))}px`}
                    top={`${Math.max(8, hoverCell.y * cellSize - 38)}px`}
                    px={2.5}
                    py={1}
                    borderRadius="full"
                    bg="rgba(15, 23, 12, 0.86)"
                    color="white"
                    fontSize="xs"
                    fontWeight="700"
                    lineHeight="shorter"
                    pointerEvents="none"
                    whiteSpace="nowrap"
                  >
                    X {hoverCell.x}, Y {hoverCell.y}
                  </Box>
                </>
              ) : null}

              {grassPaintDraft ? (
                <Box
                  sx={getSelectionBoxStyle(
                    normalizeBounds(grassPaintDraft.anchor, grassPaintDraft.current),
                    cellSize
                  )}
                  border="2px dashed rgba(34, 197, 94, 0.95)"
                  bg="rgba(34, 197, 94, 0.18)"
                  pointerEvents="none"
                />
              ) : null}

              {pendingPreviewBounds ? (
                <Box
                  sx={getSelectionBoxStyle(pendingPreviewBounds, cellSize)}
                  border="2px dashed rgba(59, 130, 246, 0.95)"
                  bg="rgba(59, 130, 246, 0.14)"
                  pointerEvents="none"
                />
              ) : null}

              {activeSelectionBounds ? (
                <Box
                  sx={getSelectionBoxStyle(activeSelectionBounds, cellSize)}
                  border="2px solid rgba(46, 91, 55, 0.95)"
                  bg="rgba(46, 91, 55, 0.12)"
                  pointerEvents="none"
                />
              ) : null}

              {selectedPortal ? (
                <Box
                  position="absolute"
                  left={`${selectedPortal.x * cellSize}px`}
                  top={`${selectedPortal.y * cellSize + cellSize + 4}px`}
                  px={2.5}
                  py={1.5}
                  borderRadius="12px"
                  bg="rgba(15, 23, 12, 0.88)"
                  color="white"
                  fontSize="xs"
                  fontWeight="700"
                  pointerEvents="none"
                  whiteSpace="nowrap"
                >
                  Portal: {getPortalLabel(selectedPortal, maps)}
                </Box>
              ) : null}

              {selectedNpc ? (
                <Box
                  position="absolute"
                  left={`${selectedNpc.x * cellSize}px`}
                  top={`${Math.max(0, selectedNpc.y * cellSize - 34)}px`}
                  px={2.5}
                  py={1.5}
                  borderRadius="12px"
                  bg="rgba(8, 47, 73, 0.88)"
                  color="white"
                  fontSize="xs"
                  fontWeight="700"
                  pointerEvents="none"
                  whiteSpace="nowrap"
                >
                  NPC: {selectedNpc.name}
                </Box>
              ) : null}
            </Box>
          </Box>
        </Box>
      </Box>
    </Flex>
  );
}
