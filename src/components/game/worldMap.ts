/**
 * World-map model for the Map window and Volar (Fly) travel.
 *
 * The window renders the original game's region image (public/townmap/
 * mapRegion0.png, 480x320, 16px grid squares). Positions come from the
 * generated town-map data (townMapData.ts, produced by
 * server-poke.io/tools/generateTownMapData.ts from the Essentials PBS files):
 * TOWN_MAP_POSITION_BY_MAP_ID places each overworld map on the grid and
 * TOWN_MAP_POINTS carries the flyable towns with their authored landing tile.
 * The server validates flights against the same data
 * (PlayableMapsState.resolveFlyDestinations).
 */

import {
  loadPlayableMapEditorData,
  type PlayableMapsStateSnapshot,
} from "./playableMapRuntime";
import {
  TOWN_MAP_POINTS,
  TOWN_MAP_POSITION_BY_MAP_ID,
  type TownMapPoint,
} from "./townMapData";

function getEditorPortals(snapshot: PlayableMapsStateSnapshot, mapId: string) {
  return (
    snapshot.editorDataByMapId[mapId] ?? loadPlayableMapEditorData(mapId)
  )?.portals ?? [];
}

/** Flyable town points whose destination map exists in the current snapshot. */
export function getFlyablePoints(snapshot: PlayableMapsStateSnapshot): TownMapPoint[] {
  const mapIds = new Set(snapshot.items.map((item) => item.id));
  const seen = new Set<string>();

  return TOWN_MAP_POINTS.filter((point) => {
    if (!point.fly || !mapIds.has(point.fly.mapId) || seen.has(point.fly.mapId)) {
      return false;
    }
    seen.add(point.fly.mapId);
    return true;
  });
}

export type TownMapLocation = {
  gridX: number;
  gridY: number;
  mapName: string;
  /** True when the player's map sits on the region grid itself; false when
   *  the position is the overworld map that (transitively) contains the
   *  interior the player is in. */
  isExact: boolean;
};

/**
 * Resolves where on the region map a player currently is. Interiors (houses,
 * Pokémon Centers, caves) have no MapPosition, so they are traced back to the
 * overworld through the portals that lead into them.
 */
export function resolveTownMapLocation(
  snapshot: PlayableMapsStateSnapshot,
  mapId: string | null | undefined
): TownMapLocation | null {
  if (!mapId) {
    return null;
  }

  const nameOf = (id: string) =>
    snapshot.items.find((item) => item.id === id)?.name ?? id;

  const exact = TOWN_MAP_POSITION_BY_MAP_ID[mapId];
  if (exact) {
    return { gridX: exact.gridX, gridY: exact.gridY, mapName: nameOf(mapId), isExact: true };
  }

  // Reverse-portal index: interior map -> maps holding a door into it.
  const entrancesByMapId = new Map<string, string[]>();
  for (const item of snapshot.items) {
    for (const portal of getEditorPortals(snapshot, item.id)) {
      if (portal.destinationType !== "other-map" || !portal.targetMapId) {
        continue;
      }
      const sources = entrancesByMapId.get(portal.targetMapId) ?? [];
      sources.push(item.id);
      entrancesByMapId.set(portal.targetMapId, sources);
    }
  }

  const visited = new Set<string>([mapId]);
  let frontier = [mapId];

  // Interiors nest only a few levels deep (mall floors, cave rooms); the
  // bound just guards against portal cycles in authored data.
  for (let depth = 0; depth < 8 && frontier.length > 0; depth += 1) {
    const next: string[] = [];

    for (const currentId of frontier) {
      for (const sourceId of entrancesByMapId.get(currentId) ?? []) {
        if (visited.has(sourceId)) {
          continue;
        }

        const position = TOWN_MAP_POSITION_BY_MAP_ID[sourceId];
        if (position) {
          return {
            gridX: position.gridX,
            gridY: position.gridY,
            mapName: nameOf(sourceId),
            isExact: false,
          };
        }

        visited.add(sourceId);
        next.push(sourceId);
      }
    }

    frontier = next;
  }

  return null;
}
