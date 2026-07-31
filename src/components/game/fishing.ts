/**
 * Client-side helpers for click-to-fish: decide whether a tapped tile is a
 * fishable water tile so the "Fish" prompt is only offered when it makes sense.
 * The server remains the authority (it re-validates rod / adjacency / water and
 * runs the cast); this only gates the UI.
 */
import {
  decodePassageTerrainTagCells,
  decodeTerrainTagCells,
} from "../tilemap/tileMapProfile";
import type { PlayableMapTileMapProfile } from "../tilemap/tileMapTypes";

// RMXP/Essentials terrain tags for surfable water (still + sea + deep). Mirrors
// server-poke.io components/terrainTags.ts SURF_TERRAIN_TAGS.
const FISHABLE_WATER_TAGS = new Set([5, 6, 7]);

const terrainTagCache = new globalThis.Map<string, Uint8Array | null>();
const passageTagCache = new globalThis.Map<string, Uint8Array | null>();

export function getTerrainTagCells(mapId: string, tileMap: PlayableMapTileMapProfile) {
  const encoded = tileMap.terrainTags ?? "";
  const cacheKey = `${mapId}:${encoded.length}:${encoded.slice(0, 32)}`;
  const cached = terrainTagCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const cells = decodeTerrainTagCells(tileMap);
  terrainTagCache.set(cacheKey, cells);
  return cells;
}

function getPassageTagCells(mapId: string, tileMap: PlayableMapTileMapProfile) {
  const encoded = tileMap.passageTerrainTags ?? "";
  if (!encoded) {
    return null;
  }
  const cacheKey = `${mapId}:${encoded.length}:${encoded.slice(0, 32)}`;
  const cached = passageTagCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const cells = decodePassageTerrainTagCells(tileMap);
  passageTagCache.set(cacheKey, cells);
  return cells;
}

/**
 * True when the given cell is fishable water on this map. Returns false (rather
 * than guessing) when the map has no terrain-tag grid, so we never offer "Fish"
 * against a plain wall.
 */
export function isFishableWaterCell(
  mapId: string,
  tileMap: PlayableMapTileMapProfile | null | undefined,
  cellX: number,
  cellY: number
): boolean {
  if (!tileMap) {
    return false;
  }
  const cells = getTerrainTagCells(mapId, tileMap);
  if (!cells) {
    return false;
  }
  if (cellX < 0 || cellY < 0 || cellX >= tileMap.width || cellY >= tileMap.height) {
    return false;
  }
  const index = cellY * tileMap.width + cellX;
  if (!FISHABLE_WATER_TAGS.has(cells[index])) {
    return false;
  }
  // Obstacles drawn over water (rocks) keep the water terrain tag from the
  // layer underneath, but their collision-deciding tile is not water — those
  // cells are neither fishable, surfable, nor passable while surfing. Mirrors
  // server world.isOpenWaterCell.
  const passageCells = getPassageTagCells(mapId, tileMap);
  if (passageCells && !FISHABLE_WATER_TAGS.has(passageCells[index])) {
    return false;
  }
  return true;
}
