import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Select,
  Stack,
  Text,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail,
} from "./designerCache";
import type { DesignerItemSeed } from "./designerSections";
import type { PlayableMapEditorData } from "./PlayableMapEditorCanvas";
import { reshapeAutotileRegion } from "../tilemap/autotile";
import { deriveCollisionGrid, isSolidCollisionCell } from "../tilemap/collision";
import {
  buildTileMapProfile,
  createEmptyTileLayers,
  decodeTileMapLayers,
  resizeTileLayers,
} from "../tilemap/tileMapProfile";
import { TilesetRenderer, loadImageElement } from "../tilemap/tilesetRenderer";
import {
  AUTOTILE_ID_UNIT,
  AUTOTILE_SLOTS,
  FIRST_TILESET_TILE_ID,
  TILESET_COLUMNS,
  TILE_MAP_LAYERS,
  TILE_SIZE,
  isAutotileId,
  type DesignerTilesetProfile,
} from "../tilemap/tileMapTypes";

type TileTool = "pencil" | "rectangle" | "fill" | "eraser";

type PaletteSelection =
  | { kind: "eraser" }
  | { kind: "autotile"; slot: number }
  | { kind: "tiles"; left: number; top: number; width: number; height: number };

interface TileMapEditorProps {
  mapWidth: number;
  mapHeight: number;
  cellSize: number;
  value: PlayableMapEditorData;
  onChange: (value: PlayableMapEditorData) => void;
}

interface UndoEntry {
  layer: number;
  cells: Array<{ index: number; previous: number; next: number }>;
}

const ZOOM_OPTIONS = [0.25, 0.5, 1, 2];
const MAX_UNDO_ENTRIES = 60;
const LAYER_LABELS = ["Layer 1", "Layer 2", "Layer 3"];

// Colors painted straight into the 2D contexts, where Chakra semantic tokens
// can't reach — keep these in step with the editor.* tokens in theme.ts.
const CANVAS_THEME = {
  light: {
    surface: "#dfe8dc",
    placeholderText: "#5f6d61",
    grid: "rgba(35, 49, 39, 0.18)",
    eraserGlyph: "rgba(35, 49, 39, 0.4)",
    paletteSurface: "#f2f5f0",
    rectStroke: "#2e5b37",
    hoverStroke: "rgba(46, 91, 55, 0.9)",
  },
  dark: {
    surface: "#161c17",
    placeholderText: "#a0b0a2",
    grid: "rgba(226, 235, 227, 0.16)",
    eraserGlyph: "rgba(226, 235, 227, 0.45)",
    paletteSurface: "#121713",
    rectStroke: "#86c290",
    hoverStroke: "rgba(134, 194, 144, 0.9)",
  },
} as const;

function positiveModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo;
}

function loadTilesetItems(): DesignerItemSeed[] {
  return readStoredDesignerSectionPayload("tilesets").state.items.filter(
    (item) => item.tilesetProfile && typeof item.tilesetProfile === "object"
  );
}

/**
 * RPG Maker XP style tile editor: tileset palette (autotile row + tileset
 * column), three tile layers, pencil/rectangle/flood-fill/eraser stamps with
 * autotile auto-shaping, undo/redo, and a derived-passability overlay. Edits
 * `editorData.tileMap`; baking happens on save in MapEditorPage.
 */
export default function TileMapEditor({
  mapWidth,
  mapHeight,
  cellSize,
  value,
  onChange,
}: TileMapEditorProps) {
  const toast = useToast();
  const { colorMode } = useColorMode();
  const canvasTheme = CANVAS_THEME[colorMode === "dark" ? "dark" : "light"];
  const [tilesetItems, setTilesetItems] = useState<DesignerItemSeed[]>(() => loadTilesetItems());
  const [selectedTilesetItemId, setSelectedTilesetItemId] = useState(
    value.tileMap?.tilesetItemId ?? ""
  );
  const [tool, setTool] = useState<TileTool>("pencil");
  const [activeLayer, setActiveLayer] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [dimOtherLayers, setDimOtherLayers] = useState(true);
  const [showPassability, setShowPassability] = useState(false);
  const [paletteSelection, setPaletteSelection] = useState<PaletteSelection>({
    kind: "tiles",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  });
  const [renderer, setRenderer] = useState<TilesetRenderer | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteScrollRef = useRef<HTMLDivElement | null>(null);
  const paletteCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const layersRef = useRef<Uint16Array[] | null>(null);
  const layersKeyRef = useRef<string>("");
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const strokeRef = useRef<Map<number, number> | null>(null);
  const strokeAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const rectDraftRef = useRef<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const paletteDragRef = useRef<{ start: { col: number; row: number } } | null>(null);
  const hoverCellRef = useRef<{ x: number; y: number } | null>(null);
  const redrawRequestRef = useRef(0);
  // deriveCollisionGrid is O(width*height*layers); caching it keyed on an
  // edit revision keeps the passability overlay from re-deriving the whole
  // map on every scroll/zoom/hover redraw.
  const layersRevisionRef = useRef(0);
  const collisionCacheRef = useRef<{
    revision: number;
    width: number;
    height: number;
    profile: DesignerTilesetProfile;
    grid: Uint8Array;
  } | null>(null);

  const tileMap = value.tileMap ?? null;
  const tileMapWidth = tileMap?.width ?? mapWidth;
  const tileMapHeight = tileMap?.height ?? mapHeight;

  const selectedTilesetItem = useMemo(
    () =>
      tilesetItems.find(
        (item) => item.id === (tileMap?.tilesetItemId || selectedTilesetItemId)
      ) ?? null,
    [selectedTilesetItemId, tileMap?.tilesetItemId, tilesetItems]
  );
  const tilesetProfile = (selectedTilesetItem?.tilesetProfile ?? null) as DesignerTilesetProfile | null;

  // ------------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------------

  useEffect(() => {
    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;

      if (detail?.sectionKey === "tilesets") {
        setTilesetItems(loadTilesetItems());
      }
    };

    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleCacheUpdate);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!tilesetProfile) {
      setRenderer(null);
      return;
    }

    TilesetRenderer.create(tilesetProfile).then((nextRenderer) => {
      if (!cancelled) {
        setRenderer(nextRenderer);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tilesetProfile]);

  useEffect(() => {
    if (!tileMap) {
      layersRef.current = null;
      layersKeyRef.current = "";
      return;
    }

    const externalKey = tileMap.layers.join("|");

    if (externalKey === layersKeyRef.current && layersRef.current) {
      return;
    }

    layersRef.current = decodeTileMapLayers(tileMap);
    layersKeyRef.current = externalKey;
    layersRevisionRef.current += 1;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoDepth(0);
    setRedoDepth(0);
  }, [tileMap]);

  // ------------------------------------------------------------------
  // Committing edits back into editor data
  // ------------------------------------------------------------------

  const emitChange = useCallback(() => {
    const layers = layersRef.current;

    if (!layers || !tilesetProfile || !tileMap) {
      return;
    }

    const nextProfile = buildTileMapProfile({
      tilesetItemId: tileMap.tilesetItemId,
      width: tileMapWidth,
      height: tileMapHeight,
      layers,
      tilesetProfile,
      essentials: tileMap.essentials,
    });

    // Keep the previous baked surfaces until the next save re-bakes them.
    layersKeyRef.current = nextProfile.layers.join("|");
    onChange({
      ...value,
      tileMap: { ...nextProfile, baked: tileMap.baked },
    });
  }, [onChange, tileMap, tileMapHeight, tileMapWidth, tilesetProfile, value]);

  const pushUndoEntry = useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry);

    if (undoStackRef.current.length > MAX_UNDO_ENTRIES) {
      undoStackRef.current.shift();
    }

    redoStackRef.current = [];
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(0);
  }, []);

  const applyUndoRedo = useCallback(
    (direction: "undo" | "redo") => {
      const layers = layersRef.current;
      const sourceStack = direction === "undo" ? undoStackRef.current : redoStackRef.current;
      const targetStack = direction === "undo" ? redoStackRef.current : undoStackRef.current;
      const entry = sourceStack.pop();

      if (!layers || !entry) {
        return;
      }

      const layer = layers[entry.layer];

      entry.cells.forEach((cell) => {
        layer[cell.index] = direction === "undo" ? cell.previous : cell.next;
      });
      layersRevisionRef.current += 1;

      targetStack.push(entry);
      setUndoDepth(undoStackRef.current.length);
      setRedoDepth(redoStackRef.current.length);
      emitChange();
    },
    [emitChange]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        applyUndoRedo(event.shiftKey ? "redo" : "undo");
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        applyUndoRedo("redo");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applyUndoRedo]);

  // ------------------------------------------------------------------
  // Stamp application
  // ------------------------------------------------------------------

  const setCell = useCallback(
    (layer: Uint16Array, x: number, y: number, tileId: number, changes: Map<number, number>) => {
      if (x < 0 || y < 0 || x >= tileMapWidth || y >= tileMapHeight) {
        return;
      }

      const index = y * tileMapWidth + x;

      if (!changes.has(index)) {
        changes.set(index, layer[index]);
      }

      layer[index] = tileId;
      layersRevisionRef.current += 1;
    },
    [tileMapHeight, tileMapWidth]
  );

  const stampCell = useCallback(
    (
      layer: Uint16Array,
      x: number,
      y: number,
      anchor: { x: number; y: number },
      changes: Map<number, number>
    ) => {
      if (paletteSelection.kind === "eraser") {
        setCell(layer, x, y, 0, changes);
        return;
      }

      if (paletteSelection.kind === "autotile") {
        setCell(layer, x, y, (paletteSelection.slot + 1) * AUTOTILE_ID_UNIT, changes);
        return;
      }

      const offsetX = positiveModulo(x - anchor.x, paletteSelection.width);
      const offsetY = positiveModulo(y - anchor.y, paletteSelection.height);
      const tileColumn = paletteSelection.left + offsetX;
      const tileRow = paletteSelection.top + offsetY;

      setCell(
        layer,
        x,
        y,
        FIRST_TILESET_TILE_ID + tileRow * TILESET_COLUMNS + tileColumn,
        changes
      );
    },
    [paletteSelection, setCell]
  );

  const finishStroke = useCallback(
    (changes: Map<number, number>, boundsCells: Array<{ x: number; y: number }>) => {
      const layers = layersRef.current;

      if (!layers || changes.size === 0) {
        return;
      }

      const layer = layers[activeLayer];

      if (boundsCells.length > 0) {
        let minX = tileMapWidth;
        let minY = tileMapHeight;
        let maxX = 0;
        let maxY = 0;

        boundsCells.forEach((cell) => {
          minX = Math.min(minX, cell.x);
          minY = Math.min(minY, cell.y);
          maxX = Math.max(maxX, cell.x);
          maxY = Math.max(maxY, cell.y);
        });

        // Auto-shape autotiles in and around the edited region. Track any
        // reshaped cells in the same undo entry.
        const beforeReshape = new Map<number, number>();

        for (let y = Math.max(0, minY - 1); y <= Math.min(tileMapHeight - 1, maxY + 1); y += 1) {
          for (let x = Math.max(0, minX - 1); x <= Math.min(tileMapWidth - 1, maxX + 1); x += 1) {
            beforeReshape.set(y * tileMapWidth + x, layer[y * tileMapWidth + x]);
          }
        }

        reshapeAutotileRegion(
          layer,
          tileMapWidth,
          tileMapHeight,
          minX - 1,
          minY - 1,
          maxX + 1,
          maxY + 1
        );

        beforeReshape.forEach((previous, index) => {
          if (layer[index] !== previous && !changes.has(index)) {
            changes.set(index, previous);
          }
        });
      }

      const cells = Array.from(changes.entries())
        .map(([index, previous]) => ({ index, previous, next: layer[index] }))
        .filter((cell) => cell.previous !== cell.next);

      if (cells.length === 0) {
        return;
      }

      // reshapeAutotileRegion mutated the layer directly above.
      layersRevisionRef.current += 1;
      pushUndoEntry({ layer: activeLayer, cells });
      emitChange();
    },
    [activeLayer, emitChange, pushUndoEntry, tileMapHeight, tileMapWidth]
  );

  const applyFloodFill = useCallback(
    (startX: number, startY: number) => {
      const layers = layersRef.current;

      if (!layers) {
        return;
      }

      const layer = layers[activeLayer];
      const startIndex = startY * tileMapWidth + startX;
      const targetId = layer[startIndex];
      const changes = new Map<number, number>();
      const boundsCells: Array<{ x: number; y: number }> = [];
      const visited = new Uint8Array(tileMapWidth * tileMapHeight);
      const queue: number[] = [startIndex];

      visited[startIndex] = 1;

      // Filling with the exact same single tile would be a no-op.
      while (queue.length > 0) {
        const index = queue.pop() as number;
        const x = index % tileMapWidth;
        const y = Math.floor(index / tileMapWidth);

        stampCell(layer, x, y, { x: startX, y: startY }, changes);
        boundsCells.push({ x, y });

        const neighbors = [
          x > 0 ? index - 1 : -1,
          x < tileMapWidth - 1 ? index + 1 : -1,
          y > 0 ? index - tileMapWidth : -1,
          y < tileMapHeight - 1 ? index + tileMapWidth : -1,
        ];

        neighbors.forEach((neighborIndex) => {
          if (
            neighborIndex >= 0 &&
            !visited[neighborIndex] &&
            (changes.has(neighborIndex)
              ? (changes.get(neighborIndex) as number)
              : layer[neighborIndex]) === targetId
          ) {
            visited[neighborIndex] = 1;
            queue.push(neighborIndex);
          }
        });
      }

      finishStroke(changes, boundsCells);
    },
    [activeLayer, finishStroke, stampCell, tileMapHeight, tileMapWidth]
  );

  // ------------------------------------------------------------------
  // Map canvas rendering
  // ------------------------------------------------------------------

  const drawStampPreview = useCallback(
    (
      context: CanvasRenderingContext2D,
      cellX: number,
      cellY: number,
      anchor: { x: number; y: number }
    ) => {
      if (!renderer) {
        return;
      }

      if (paletteSelection.kind === "eraser") {
        context.fillStyle = "rgba(220, 60, 60, 0.4)";
        context.fillRect(cellX * TILE_SIZE, cellY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        return;
      }

      if (paletteSelection.kind === "autotile") {
        renderer.drawTile(
          context,
          (paletteSelection.slot + 1) * AUTOTILE_ID_UNIT + AUTOTILE_ID_UNIT - 2,
          cellX * TILE_SIZE,
          cellY * TILE_SIZE
        );
        return;
      }

      const offsetX = positiveModulo(cellX - anchor.x, paletteSelection.width);
      const offsetY = positiveModulo(cellY - anchor.y, paletteSelection.height);
      const tileId =
        FIRST_TILESET_TILE_ID +
        (paletteSelection.top + offsetY) * TILESET_COLUMNS +
        (paletteSelection.left + offsetX);

      renderer.drawTile(context, tileId, cellX * TILE_SIZE, cellY * TILE_SIZE);
    },
    [paletteSelection, renderer]
  );

  const redraw = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const layers = layersRef.current;

    if (!container || !canvas) {
      return;
    }

    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;

    if (canvas.width !== viewWidth || canvas.height !== viewHeight) {
      canvas.width = viewWidth;
      canvas.height = viewHeight;
    }

    canvas.style.left = `${container.scrollLeft}px`;
    canvas.style.top = `${container.scrollTop}px`;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = canvasTheme.surface;
    context.fillRect(0, 0, viewWidth, viewHeight);

    if (!layers || !renderer || !tilesetProfile) {
      context.fillStyle = canvasTheme.placeholderText;
      context.font = "14px sans-serif";
      context.fillText(
        !tilesetProfile
          ? "Select a tileset to start tile editing."
          : "Loading tileset graphics...",
        16,
        28
      );
      return;
    }

    const scaledTile = TILE_SIZE * zoom;
    const firstColumn = Math.max(0, Math.floor(container.scrollLeft / scaledTile));
    const firstRow = Math.max(0, Math.floor(container.scrollTop / scaledTile));
    const lastColumn = Math.min(
      tileMapWidth - 1,
      Math.ceil((container.scrollLeft + viewWidth) / scaledTile)
    );
    const lastRow = Math.min(
      tileMapHeight - 1,
      Math.ceil((container.scrollTop + viewHeight) / scaledTile)
    );

    context.setTransform(
      zoom,
      0,
      0,
      zoom,
      -container.scrollLeft,
      -container.scrollTop
    );

    for (let z = 0; z < layers.length; z += 1) {
      context.globalAlpha = dimOtherLayers && z !== activeLayer ? 0.35 : 1;

      for (let y = firstRow; y <= lastRow; y += 1) {
        for (let x = firstColumn; x <= lastColumn; x += 1) {
          const tileId = layers[z][y * tileMapWidth + x];

          if (tileId !== 0) {
            renderer.drawTile(context, tileId, x * TILE_SIZE, y * TILE_SIZE);
          }
        }
      }
    }

    context.globalAlpha = 1;

    if (showPassability) {
      const cache = collisionCacheRef.current;
      let collision: Uint8Array;

      if (
        cache &&
        cache.revision === layersRevisionRef.current &&
        cache.width === tileMapWidth &&
        cache.height === tileMapHeight &&
        cache.profile === tilesetProfile
      ) {
        collision = cache.grid;
      } else {
        collision = deriveCollisionGrid(layers, tileMapWidth, tileMapHeight, tilesetProfile);
        collisionCacheRef.current = {
          revision: layersRevisionRef.current,
          width: tileMapWidth,
          height: tileMapHeight,
          profile: tilesetProfile,
          grid: collision,
        };
      }

      context.fillStyle = "rgba(220, 40, 40, 0.35)";

      for (let y = firstRow; y <= lastRow; y += 1) {
        for (let x = firstColumn; x <= lastColumn; x += 1) {
          if (isSolidCollisionCell(collision[y * tileMapWidth + x])) {
            context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    if (showGrid && zoom >= 0.5) {
      context.strokeStyle = canvasTheme.grid;
      context.lineWidth = 1 / zoom;
      context.beginPath();

      for (let x = firstColumn; x <= lastColumn + 1; x += 1) {
        context.moveTo(x * TILE_SIZE, firstRow * TILE_SIZE);
        context.lineTo(x * TILE_SIZE, (lastRow + 1) * TILE_SIZE);
      }

      for (let y = firstRow; y <= lastRow + 1; y += 1) {
        context.moveTo(firstColumn * TILE_SIZE, y * TILE_SIZE);
        context.lineTo((lastColumn + 1) * TILE_SIZE, y * TILE_SIZE);
      }

      context.stroke();
    }

    const rectDraft = rectDraftRef.current;
    const hoverCell = hoverCellRef.current;

    context.globalAlpha = 0.6;

    if (rectDraft) {
      const left = Math.min(rectDraft.start.x, rectDraft.current.x);
      const right = Math.max(rectDraft.start.x, rectDraft.current.x);
      const top = Math.min(rectDraft.start.y, rectDraft.current.y);
      const bottom = Math.max(rectDraft.start.y, rectDraft.current.y);

      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          drawStampPreview(context, x, y, { x: left, y: top });
        }
      }

      context.globalAlpha = 1;
      context.strokeStyle = canvasTheme.rectStroke;
      context.lineWidth = 2 / zoom;
      context.strokeRect(
        left * TILE_SIZE,
        top * TILE_SIZE,
        (right - left + 1) * TILE_SIZE,
        (bottom - top + 1) * TILE_SIZE
      );
    } else if (hoverCell && !strokeRef.current) {
      drawStampPreview(context, hoverCell.x, hoverCell.y, hoverCell);
      context.globalAlpha = 1;
      context.strokeStyle = canvasTheme.hoverStroke;
      context.lineWidth = 2 / zoom;

      const previewWidth = paletteSelection.kind === "tiles" ? paletteSelection.width : 1;
      const previewHeight = paletteSelection.kind === "tiles" ? paletteSelection.height : 1;

      context.strokeRect(
        hoverCell.x * TILE_SIZE,
        hoverCell.y * TILE_SIZE,
        TILE_SIZE * Math.min(previewWidth, tileMapWidth - hoverCell.x),
        TILE_SIZE * Math.min(previewHeight, tileMapHeight - hoverCell.y)
      );
    }

    context.globalAlpha = 1;
  }, [
    activeLayer,
    canvasTheme,
    dimOtherLayers,
    drawStampPreview,
    paletteSelection,
    renderer,
    showGrid,
    showPassability,
    tileMapHeight,
    tileMapWidth,
    tilesetProfile,
    zoom,
  ]);

  const scheduleRedraw = useCallback(() => {
    if (redrawRequestRef.current) {
      return;
    }

    redrawRequestRef.current = window.requestAnimationFrame(() => {
      redrawRequestRef.current = 0;
      redraw();
    });
  }, [redraw]);

  useEffect(() => {
    scheduleRedraw();
  });

  useEffect(() => () => {
    if (redrawRequestRef.current) {
      window.cancelAnimationFrame(redrawRequestRef.current);
    }
  }, []);

  // ------------------------------------------------------------------
  // Map canvas pointer handling
  // ------------------------------------------------------------------

  const getCellFromPointer = useCallback(
    (event: React.PointerEvent) => {
      const container = containerRef.current;

      if (!container) {
        return null;
      }

      const rect = container.getBoundingClientRect();
      const contentX = event.clientX - rect.left + container.scrollLeft;
      const contentY = event.clientY - rect.top + container.scrollTop;
      const x = Math.floor(contentX / (TILE_SIZE * zoom));
      const y = Math.floor(contentY / (TILE_SIZE * zoom));

      if (x < 0 || y < 0 || x >= tileMapWidth || y >= tileMapHeight) {
        return null;
      }

      return { x, y };
    },
    [tileMapHeight, tileMapWidth, zoom]
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!layersRef.current || !renderer) {
      return;
    }

    const cell = getCellFromPointer(event);

    if (!cell) {
      return;
    }

    // Right-click: eyedropper from the active layer.
    if (event.button === 2) {
      const tileId = layersRef.current[activeLayer][cell.y * tileMapWidth + cell.x];

      if (tileId === 0) {
        setPaletteSelection({ kind: "eraser" });
      } else if (isAutotileId(tileId)) {
        setPaletteSelection({
          kind: "autotile",
          slot: Math.floor(tileId / AUTOTILE_ID_UNIT) - 1,
        });
      } else if (tileId >= FIRST_TILESET_TILE_ID) {
        const index = tileId - FIRST_TILESET_TILE_ID;

        setPaletteSelection({
          kind: "tiles",
          left: index % TILESET_COLUMNS,
          top: Math.floor(index / TILESET_COLUMNS),
          width: 1,
          height: 1,
        });
      }

      return;
    }

    if (event.button !== 0) {
      return;
    }

    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);

    if (tool === "fill") {
      applyFloodFill(cell.x, cell.y);
      return;
    }

    if (tool === "rectangle") {
      rectDraftRef.current = { start: cell, current: cell };
      scheduleRedraw();
      return;
    }

    const changes = new Map<number, number>();

    strokeRef.current = changes;
    strokeAnchorRef.current = cell;

    const layer = layersRef.current[activeLayer];

    if (tool === "eraser") {
      setCell(layer, cell.x, cell.y, 0, changes);
    } else {
      stampCell(layer, cell.x, cell.y, cell, changes);
    }

    scheduleRedraw();
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const cell = getCellFromPointer(event);

    hoverCellRef.current = cell;

    if (rectDraftRef.current && cell) {
      rectDraftRef.current = { ...rectDraftRef.current, current: cell };
    }

    const changes = strokeRef.current;
    const anchor = strokeAnchorRef.current;
    const layers = layersRef.current;

    if (changes && anchor && layers && cell) {
      const layer = layers[activeLayer];

      if (tool === "eraser") {
        setCell(layer, cell.x, cell.y, 0, changes);
      } else {
        stampCell(layer, cell.x, cell.y, anchor, changes);
      }
    }

    scheduleRedraw();
  };

  const handlePointerUp = () => {
    const layers = layersRef.current;

    if (rectDraftRef.current && layers) {
      const { start, current } = rectDraftRef.current;
      const left = Math.min(start.x, current.x);
      const right = Math.max(start.x, current.x);
      const top = Math.min(start.y, current.y);
      const bottom = Math.max(start.y, current.y);
      const changes = new Map<number, number>();
      const boundsCells: Array<{ x: number; y: number }> = [];
      const layer = layers[activeLayer];

      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          if (tool === "eraser") {
            setCell(layer, x, y, 0, changes);
          } else {
            stampCell(layer, x, y, { x: left, y: top }, changes);
          }

          boundsCells.push({ x, y });
        }
      }

      rectDraftRef.current = null;
      finishStroke(changes, boundsCells);
      scheduleRedraw();
      return;
    }

    const changes = strokeRef.current;

    if (changes && layers) {
      const boundsCells = Array.from(changes.keys()).map((index) => ({
        x: index % tileMapWidth,
        y: Math.floor(index / tileMapWidth),
      }));

      strokeRef.current = null;
      strokeAnchorRef.current = null;
      finishStroke(changes, boundsCells);
    }

    scheduleRedraw();
  };

  // ------------------------------------------------------------------
  // Palette rendering + pointer handling
  // ------------------------------------------------------------------

  const paletteRows = tilesetProfile ? tilesetProfile.tilesetHeightTiles : 0;
  const paletteHeight = (paletteRows + 1) * TILE_SIZE;

  useEffect(() => {
    const canvas = paletteCanvasRef.current;

    if (!canvas || !tilesetProfile) {
      return;
    }

    canvas.width = TILESET_COLUMNS * TILE_SIZE;
    canvas.height = paletteHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = false;
    context.fillStyle = canvasTheme.paletteSurface;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Row 0: eraser cell + the 7 autotile previews.
    context.strokeStyle = canvasTheme.eraserGlyph;
    context.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    context.beginPath();
    context.moveTo(6, 6);
    context.lineTo(TILE_SIZE - 6, TILE_SIZE - 6);
    context.moveTo(TILE_SIZE - 6, 6);
    context.lineTo(6, TILE_SIZE - 6);
    context.stroke();

    if (renderer) {
      for (let slot = 0; slot < AUTOTILE_SLOTS; slot += 1) {
        renderer.drawTile(
          context,
          (slot + 1) * AUTOTILE_ID_UNIT + AUTOTILE_ID_UNIT - 1,
          (slot + 1) * TILE_SIZE,
          0
        );
      }
    }

    // The tileset image is already laid out as the 8-column palette grid.
    // Load through loadImageElement so root-relative asset-storage paths
    // resolve against assetStorageBaseUrl (a bare Image().src here would
    // fetch from the frontend origin and leave the palette blank).
    let cancelled = false;

    loadImageElement(tilesetProfile.tilesetImageSrc).then((image) => {
      if (!cancelled && image) {
        context.drawImage(image, 0, TILE_SIZE);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canvasTheme, paletteHeight, renderer, tilesetProfile]);

  const getPaletteCell = (event: React.PointerEvent) => {
    const canvas = paletteCanvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / TILE_SIZE);
    const row = Math.floor((event.clientY - rect.top) / TILE_SIZE);

    if (col < 0 || col >= TILESET_COLUMNS || row < 0 || row > paletteRows) {
      return null;
    }

    return { col, row };
  };

  const handlePalettePointerDown = (event: React.PointerEvent) => {
    const cell = getPaletteCell(event);

    if (!cell) {
      return;
    }

    if (cell.row === 0) {
      if (cell.col === 0) {
        setPaletteSelection({ kind: "eraser" });
      } else if (cell.col - 1 < AUTOTILE_SLOTS) {
        setPaletteSelection({ kind: "autotile", slot: cell.col - 1 });
      }

      return;
    }

    paletteDragRef.current = { start: cell };
    setPaletteSelection({
      kind: "tiles",
      left: cell.col,
      top: cell.row - 1,
      width: 1,
      height: 1,
    });
  };

  const handlePalettePointerMove = (event: React.PointerEvent) => {
    const drag = paletteDragRef.current;

    if (!drag) {
      return;
    }

    const cell = getPaletteCell(event);

    if (!cell || cell.row === 0) {
      return;
    }

    setPaletteSelection({
      kind: "tiles",
      left: Math.min(drag.start.col, cell.col),
      top: Math.min(drag.start.row, cell.row) - 1,
      width: Math.abs(cell.col - drag.start.col) + 1,
      height: Math.abs(cell.row - drag.start.row) + 1,
    });
  };

  const handlePalettePointerUp = () => {
    paletteDragRef.current = null;
  };

  const paletteSelectionStyle = useMemo(() => {
    if (paletteSelection.kind === "eraser") {
      return { left: 0, top: 0, width: TILE_SIZE, height: TILE_SIZE };
    }

    if (paletteSelection.kind === "autotile") {
      return {
        left: (paletteSelection.slot + 1) * TILE_SIZE,
        top: 0,
        width: TILE_SIZE,
        height: TILE_SIZE,
      };
    }

    return {
      left: paletteSelection.left * TILE_SIZE,
      top: (paletteSelection.top + 1) * TILE_SIZE,
      width: paletteSelection.width * TILE_SIZE,
      height: paletteSelection.height * TILE_SIZE,
    };
  }, [paletteSelection]);

  // ------------------------------------------------------------------
  // Tile map lifecycle actions
  // ------------------------------------------------------------------

  const handleCreateTileMap = () => {
    if (!selectedTilesetItemId || !tilesetProfile) {
      toast({
        title: "Select a tileset first.",
        status: "warning",
        duration: 2500,
        isClosable: true,
        position: "top",
      });
      return;
    }

    const layers = createEmptyTileLayers(mapWidth, mapHeight);
    const profile = buildTileMapProfile({
      tilesetItemId: selectedTilesetItemId,
      width: mapWidth,
      height: mapHeight,
      layers,
      tilesetProfile,
    });

    layersRef.current = layers;
    layersKeyRef.current = profile.layers.join("|");
    layersRevisionRef.current += 1;
    onChange({ ...value, tileMap: profile });
  };

  const handleRemoveTileMap = () => {
    layersRef.current = null;
    layersKeyRef.current = "";
    layersRevisionRef.current += 1;
    onChange({ ...value, tileMap: undefined });
  };

  const handleResizeToMap = () => {
    const layers = layersRef.current;

    if (!layers || !tileMap || !tilesetProfile) {
      return;
    }

    const resized = resizeTileLayers(layers, tileMapWidth, tileMapHeight, mapWidth, mapHeight);
    const profile = buildTileMapProfile({
      tilesetItemId: tileMap.tilesetItemId,
      width: mapWidth,
      height: mapHeight,
      layers: resized,
      tilesetProfile,
      essentials: tileMap.essentials,
    });

    layersRef.current = resized;
    layersKeyRef.current = profile.layers.join("|");
    layersRevisionRef.current += 1;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoDepth(0);
    setRedoDepth(0);
    onChange({ ...value, tileMap: profile });
  };

  const dimensionsMismatch =
    tileMap !== null && (tileMap.width !== mapWidth || tileMap.height !== mapHeight);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Flex gap={4} align="stretch" direction={{ base: "column", xl: "row" }}>
      <Box
        w={{ base: "100%", xl: "300px" }}
        flexShrink={0}
        border="1px solid" borderColor="editor.borderMuted"
        borderRadius="16px"
        bg="editor.page"
        p={3}
      >
        <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.14em" color="editor.accentMuted" mb={2}>
          Tileset Palette
        </Text>
        <Select
          size="sm"
          value={tileMap?.tilesetItemId || selectedTilesetItemId}
          onChange={(event) => setSelectedTilesetItemId(event.target.value)}
          isDisabled={Boolean(tileMap)}
          mb={3}
        >
          <option value="">Select tileset...</option>
          {tilesetItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        {!tileMap ? (
          <Button size="sm" colorScheme="green" w="100%" mb={3} onClick={handleCreateTileMap}>
            Create Tile Map ({mapWidth} x {mapHeight})
          </Button>
        ) : (
          <Stack direction="row" mb={3}>
            {dimensionsMismatch ? (
              <Button size="xs" colorScheme="orange" onClick={handleResizeToMap}>
                Resize to {mapWidth} x {mapHeight}
              </Button>
            ) : null}
            <Button size="xs" variant="outline" colorScheme="red" onClick={handleRemoveTileMap}>
              Remove Tile Map
            </Button>
          </Stack>
        )}
        <Box
          ref={paletteScrollRef}
          overflowY="auto"
          maxH="560px"
          border="1px solid" borderColor="editor.borderMuted"
          borderRadius="8px"
          position="relative"
          style={{ touchAction: "none" }}
        >
          {tilesetProfile ? (
            <Box position="relative" w={`${TILESET_COLUMNS * TILE_SIZE}px`}>
              <canvas
                ref={paletteCanvasRef}
                style={{ display: "block", imageRendering: "pixelated" }}
                onPointerDown={handlePalettePointerDown}
                onPointerMove={handlePalettePointerMove}
                onPointerUp={handlePalettePointerUp}
                onPointerLeave={handlePalettePointerUp}
              />
              <Box
                position="absolute"
                pointerEvents="none"
                border="2px solid" borderColor="editor.accent"
                boxShadow="0 0 0 1px rgba(255,255,255,0.8)"
                style={{
                  left: `${paletteSelectionStyle.left}px`,
                  top: `${paletteSelectionStyle.top}px`,
                  width: `${paletteSelectionStyle.width}px`,
                  height: `${paletteSelectionStyle.height}px`,
                }}
              />
            </Box>
          ) : (
            <Text p={3} fontSize="sm" color="editor.textMuted">
              No tileset selected. Import tilesets with the migration tool or create profiles in
              the Tilesets designer section.
            </Text>
          )}
        </Box>
      </Box>

      <Box flex="1" minW={0}>
        <Flex wrap="wrap" gap={2} mb={3} align="center">
          {LAYER_LABELS.slice(0, TILE_MAP_LAYERS).map((label, index) => (
            <Button
              key={label}
              size="sm"
              variant={activeLayer === index ? "solid" : "outline"}
              colorScheme="green"
              onClick={() => setActiveLayer(index)}
            >
              {label}
            </Button>
          ))}
          <Box w="1px" h="24px" bg="editor.border" />
          {(["pencil", "rectangle", "fill", "eraser"] as TileTool[]).map((toolOption) => (
            <Button
              key={toolOption}
              size="sm"
              variant={tool === toolOption ? "solid" : "outline"}
              colorScheme="teal"
              onClick={() => setTool(toolOption)}
              textTransform="capitalize"
            >
              {toolOption}
            </Button>
          ))}
          <Box w="1px" h="24px" bg="editor.border" />
          <Button size="sm" variant="outline" onClick={() => applyUndoRedo("undo")} isDisabled={undoDepth === 0}>
            Undo
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyUndoRedo("redo")} isDisabled={redoDepth === 0}>
            Redo
          </Button>
          <Select
            size="sm"
            w="90px"
            value={String(zoom)}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {ZOOM_OPTIONS.map((zoomOption) => (
              <option key={zoomOption} value={String(zoomOption)}>
                {Math.round(zoomOption * 100)}%
              </option>
            ))}
          </Select>
          <Checkbox size="sm" isChecked={showGrid} onChange={(event) => setShowGrid(event.target.checked)}>
            Grid
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={dimOtherLayers}
            onChange={(event) => setDimOtherLayers(event.target.checked)}
          >
            Dim other layers
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={showPassability}
            onChange={(event) => setShowPassability(event.target.checked)}
          >
            Passability
          </Checkbox>
        </Flex>

        {cellSize !== TILE_SIZE ? (
          <Badge colorScheme="orange" mb={2}>
            Map cell size is {cellSize}px but tiles are {TILE_SIZE}px. Use 32px cells for tile maps.
          </Badge>
        ) : null}

        <Box
          ref={containerRef}
          onScroll={scheduleRedraw}
          overflow="auto"
          position="relative"
          h="70vh"
          border="1px solid" borderColor="editor.border"
          borderRadius="12px"
          bg="editor.well"
          style={{ touchAction: "none" }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <Box
            w={`${tileMapWidth * TILE_SIZE * zoom}px`}
            h={`${tileMapHeight * TILE_SIZE * zoom}px`}
          />
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", left: 0, top: 0, imageRendering: "pixelated" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              hoverCellRef.current = null;
              handlePointerUp();
            }}
          />
        </Box>
        <Text mt={2} fontSize="xs" color="editor.textMuted">
          Left click paints with the selected stamp. Right click picks the tile under the cursor.
          Ctrl+Z / Ctrl+Y undo and redo. Foreground tiles (priority above 0 in the tileset) render
          above players in game; passability comes from the tileset's RMXP passage flags.
        </Text>
      </Box>
    </Flex>
  );
}
