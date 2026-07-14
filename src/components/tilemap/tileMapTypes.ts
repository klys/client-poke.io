// Tile-map contract types shared with server-poke.io and the Essentials
// migration tool. See MAP_TILEMAP_CONTRACT.md at the workspace root.

export const TILE_MAP_LAYER_ENCODING = "u16le-base64";
export const TILE_MAP_GRID_ENCODING = "u8rle-base64";

export const TILE_SIZE = 32;
export const TILE_MAP_LAYERS = 3;
export const AUTOTILE_ID_UNIT = 48;
export const FIRST_TILESET_TILE_ID = 384;
export const TILESET_COLUMNS = 8;
export const AUTOTILE_SLOTS = 7;
export const DEFAULT_BAKE_CHUNK_CELLS = 64;

// RMXP passage bits.
export const PASSAGE_BLOCK_DOWN = 0x01;
export const PASSAGE_BLOCK_LEFT = 0x02;
export const PASSAGE_BLOCK_RIGHT = 0x04;
export const PASSAGE_BLOCK_UP = 0x08;
export const PASSAGE_STAR = 0x10;
export const PASSAGE_BUSH = 0x40;
export const PASSAGE_COUNTER = 0x80;
export const PASSAGE_SOLID_MASK = 0x0f;

export interface PlayableMapBakedChunk {
  col: number;
  row: number;
  src: string;
  width: number;
  height: number;
}

export interface PlayableMapTileMapBaked {
  chunkCells: number;
  background: PlayableMapBakedChunk[];
  foreground: PlayableMapBakedChunk[];
  bakedAt?: string;
}

export interface PlayableMapTileMapProfile {
  version: 1;
  tilesetItemId: string;
  width: number;
  height: number;
  tileSize: number;
  layerEncoding: typeof TILE_MAP_LAYER_ENCODING;
  layers: string[];
  collisionEncoding: typeof TILE_MAP_GRID_ENCODING;
  collision: string;
  terrainTags?: string;
  baked?: PlayableMapTileMapBaked;
  essentials?: {
    mapId?: string;
    tilesetId?: number;
    sourcePath?: string;
  };
}

export interface DesignerTilesetAutotileSlot {
  name: string;
  imageSrc: string;
}

/**
 * RPG Maker XP tileset profile. `passages`, `priorities`, and `terrainTags`
 * are indexed by tile id: autotiles occupy ids 0..383 (48 ids per slot,
 * values stored at the slot base id), tileset tiles start at 384.
 */
export interface DesignerTilesetProfile {
  tileSize: number;
  tilesetImageSrc: string;
  tilesetHeightTiles: number;
  autotiles: Array<DesignerTilesetAutotileSlot | null>;
  passages: number[];
  priorities: number[];
  terrainTags: number[];
  essentialsTilesetId?: number;
  tilesetGraphicName?: string;
  source?: {
    project: string;
    sourcePath: string;
  };
}

export function isAutotileId(tileId: number) {
  return tileId >= AUTOTILE_ID_UNIT && tileId < FIRST_TILESET_TILE_ID;
}

export function autotileSlotForId(tileId: number) {
  return Math.floor(tileId / AUTOTILE_ID_UNIT) - 1;
}

/**
 * Passage/priority/terrain lookups for autotiles resolve at the slot base id
 * (variant 0), because the tileset editor stores one value per autotile.
 */
export function propertyIndexForTileId(tileId: number) {
  if (tileId < FIRST_TILESET_TILE_ID) {
    return Math.floor(tileId / AUTOTILE_ID_UNIT) * AUTOTILE_ID_UNIT;
  }

  return tileId;
}

export function passageForTileId(profile: DesignerTilesetProfile, tileId: number) {
  return profile.passages[propertyIndexForTileId(tileId)] ?? 0;
}

export function priorityForTileId(profile: DesignerTilesetProfile, tileId: number) {
  return profile.priorities[propertyIndexForTileId(tileId)] ?? 0;
}

export function terrainTagForTileId(profile: DesignerTilesetProfile, tileId: number) {
  return profile.terrainTags[propertyIndexForTileId(tileId)] ?? 0;
}
