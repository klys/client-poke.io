import { BakedTileMapImages } from "./bake";
import { deriveCollisionGrid, deriveTerrainTagGrid } from "./collision";
import {
  decodeRleBytes,
  decodeTileLayer,
  encodeRleBytes,
  encodeTileLayer,
} from "./tileMapEncoding";
import {
  DesignerTilesetProfile,
  PlayableMapBakedChunk,
  PlayableMapTileMapProfile,
  TILE_MAP_GRID_ENCODING,
  TILE_MAP_LAYER_ENCODING,
  TILE_MAP_LAYERS,
  TILE_SIZE,
} from "./tileMapTypes";

export function createEmptyTileLayers(width: number, height: number): Uint16Array[] {
  return Array.from({ length: TILE_MAP_LAYERS }, () => new Uint16Array(width * height));
}

/**
 * Mirrors the server's sanitizeTileMapProfile in
 * server-poke.io/components/PlayableMapsState.ts — keep the two in sync.
 */
export function sanitizeTileMapProfile(value: unknown): PlayableMapTileMapProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<PlayableMapTileMapProfile>;

  if (
    candidate.version !== 1 ||
    typeof candidate.tilesetItemId !== "string" ||
    candidate.layerEncoding !== TILE_MAP_LAYER_ENCODING ||
    candidate.collisionEncoding !== TILE_MAP_GRID_ENCODING ||
    !Array.isArray(candidate.layers) ||
    typeof candidate.collision !== "string" ||
    typeof candidate.width !== "number" ||
    !Number.isFinite(candidate.width) ||
    candidate.width <= 0 ||
    typeof candidate.height !== "number" ||
    !Number.isFinite(candidate.height) ||
    candidate.height <= 0
  ) {
    return undefined;
  }

  const layers = candidate.layers.filter((layer): layer is string => typeof layer === "string");

  if (layers.length === 0 || layers.length > TILE_MAP_LAYERS) {
    return undefined;
  }

  const sanitizeChunks = (chunks: unknown): PlayableMapBakedChunk[] =>
    Array.isArray(chunks)
      ? chunks.filter(
          (chunk): chunk is PlayableMapBakedChunk =>
            typeof chunk?.col === "number" &&
            typeof chunk?.row === "number" &&
            typeof chunk?.src === "string" &&
            chunk.src.length > 0 &&
            typeof chunk?.width === "number" &&
            typeof chunk?.height === "number"
        )
      : [];

  return {
    version: 1,
    tilesetItemId: candidate.tilesetItemId,
    width: Math.round(candidate.width),
    height: Math.round(candidate.height),
    tileSize:
      typeof candidate.tileSize === "number" && Number.isFinite(candidate.tileSize) && candidate.tileSize > 0
        ? Math.round(candidate.tileSize)
        : TILE_SIZE,
    layerEncoding: TILE_MAP_LAYER_ENCODING,
    layers,
    collisionEncoding: TILE_MAP_GRID_ENCODING,
    collision: candidate.collision,
    terrainTags: typeof candidate.terrainTags === "string" ? candidate.terrainTags : undefined,
    baked:
      candidate.baked && typeof candidate.baked === "object"
        ? {
            chunkCells:
              typeof candidate.baked.chunkCells === "number" && candidate.baked.chunkCells > 0
                ? Math.round(candidate.baked.chunkCells)
                : 64,
            background: sanitizeChunks(candidate.baked.background),
            foreground: sanitizeChunks(candidate.baked.foreground),
            bakedAt:
              typeof candidate.baked.bakedAt === "string" ? candidate.baked.bakedAt : undefined,
          }
        : undefined,
    essentials:
      candidate.essentials && typeof candidate.essentials === "object"
        ? {
            mapId:
              typeof candidate.essentials.mapId === "string" ? candidate.essentials.mapId : undefined,
            tilesetId:
              typeof candidate.essentials.tilesetId === "number" &&
              Number.isFinite(candidate.essentials.tilesetId)
                ? Math.round(candidate.essentials.tilesetId)
                : undefined,
            sourcePath:
              typeof candidate.essentials.sourcePath === "string"
                ? candidate.essentials.sourcePath
                : undefined,
          }
        : undefined,
  };
}

export function decodeTileMapLayers(profile: PlayableMapTileMapProfile): Uint16Array[] | null {
  const cells = profile.width * profile.height;
  const layers: Uint16Array[] = [];

  for (const encodedLayer of profile.layers) {
    const layer = decodeTileLayer(encodedLayer, cells);

    if (!layer) {
      return null;
    }

    layers.push(layer);
  }

  while (layers.length < TILE_MAP_LAYERS) {
    layers.push(new Uint16Array(cells));
  }

  return layers;
}

export function decodeCollisionCells(profile: PlayableMapTileMapProfile): Uint8Array | null {
  const cells = decodeRleBytes(profile.collision);

  if (!cells || cells.length !== profile.width * profile.height) {
    return null;
  }

  return cells;
}

export function resizeTileLayers(
  layers: Uint16Array[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): Uint16Array[] {
  return layers.map((layer) => {
    const resized = new Uint16Array(newWidth * newHeight);
    const copyWidth = Math.min(oldWidth, newWidth);
    const copyHeight = Math.min(oldHeight, newHeight);

    for (let y = 0; y < copyHeight; y += 1) {
      for (let x = 0; x < copyWidth; x += 1) {
        resized[y * newWidth + x] = layer[y * oldWidth + x];
      }
    }

    return resized;
  });
}

/**
 * Assembles the persisted tile-map profile from live editing state: encodes
 * the layers, derives the collision and terrain grids from the tileset's
 * RMXP passage tables, and attaches baked chunk references (whose `src` the
 * caller has already resolved to uploaded asset paths or data URLs).
 */
export function buildTileMapProfile(options: {
  tilesetItemId: string;
  width: number;
  height: number;
  layers: Uint16Array[];
  tilesetProfile: DesignerTilesetProfile;
  baked?: BakedTileMapImages & {
    backgroundSrcs: string[];
    foregroundSrcs: string[];
  };
  essentials?: PlayableMapTileMapProfile["essentials"];
}): PlayableMapTileMapProfile {
  const { tilesetItemId, width, height, layers, tilesetProfile, baked, essentials } = options;
  const collision = deriveCollisionGrid(layers, width, height, tilesetProfile);
  const terrainTags = deriveTerrainTagGrid(layers, width, height, tilesetProfile);

  return {
    version: 1,
    tilesetItemId,
    width,
    height,
    tileSize: TILE_SIZE,
    layerEncoding: TILE_MAP_LAYER_ENCODING,
    layers: layers.map((layer) => encodeTileLayer(layer)),
    collisionEncoding: TILE_MAP_GRID_ENCODING,
    collision: encodeRleBytes(collision),
    terrainTags: encodeRleBytes(terrainTags),
    baked: baked
      ? {
          chunkCells: baked.chunkCells,
          background: baked.background.map((chunk, index) => ({
            col: chunk.col,
            row: chunk.row,
            src: baked.backgroundSrcs[index] ?? chunk.dataUrl,
            width: chunk.width,
            height: chunk.height,
          })),
          foreground: baked.foreground.map((chunk, index) => ({
            col: chunk.col,
            row: chunk.row,
            src: baked.foregroundSrcs[index] ?? chunk.dataUrl,
            width: chunk.width,
            height: chunk.height,
          })),
          bakedAt: new Date().toISOString(),
        }
      : undefined,
    essentials,
  };
}
