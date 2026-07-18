/**
 * World-map model for the Map window and Volar (Fly) travel.
 *
 * The overworld has no authored world-map metadata (regionX/regionY and
 * mapPosition are unset in the imported Essentials data), but towns and
 * routes carry edge `connections` with cell offsets — the same data
 * MapNeighbors uses to render adjacent maps in-game. Walking that graph
 * yields a faithful geographic layout: each map becomes a rectangle placed
 * in a shared cell grid.
 *
 * Town detection mirrors the server (PlayableMapsState.resolveFlyDestinations):
 * a map is a fly-able town when one of its portals leads into a Pokémon
 * Center map. Keep both sides in sync.
 */

import {
  loadPlayableMapEditorData,
  type PlayableMapsStateSnapshot,
} from "./playableMapRuntime";
import type { DesignerItemSeed } from "../designer/designerSections";

const POKECENTER_NAME_PATTERN = /centro\s*pok|pok[eé]\s*center|pokecenter/i;

// Vertical gap (in cells) between disconnected overworld components when they
// are stacked on the world map.
const COMPONENT_GAP_CELLS = 12;

export type WorldMapPlacement = {
  mapId: string;
  name: string;
  cellX: number;
  cellY: number;
  widthCells: number;
  heightCells: number;
  cellSize: number;
  isTown: boolean;
};

export type WorldMapLayout = {
  placements: WorldMapPlacement[];
  placementsByMapId: Map<string, WorldMapPlacement>;
  widthCells: number;
  heightCells: number;
};

function getEditorPortals(snapshot: PlayableMapsStateSnapshot, mapId: string) {
  return (
    snapshot.editorDataByMapId[mapId] ?? loadPlayableMapEditorData(mapId)
  )?.portals ?? [];
}

export function getTownMapIds(snapshot: PlayableMapsStateSnapshot): Set<string> {
  const pokecenterMapIds = new Set(
    snapshot.items
      .filter((item) => POKECENTER_NAME_PATTERN.test(item.name))
      .map((item) => item.id)
  );

  const townIds = new Set<string>();

  for (const item of snapshot.items) {
    if (pokecenterMapIds.has(item.id)) {
      continue;
    }

    const hasPokecenterDoor = getEditorPortals(snapshot, item.id).some(
      (portal) =>
        portal.destinationType === "other-map" &&
        pokecenterMapIds.has(portal.targetMapId)
    );

    if (hasPokecenterDoor) {
      townIds.add(item.id);
    }
  }

  return townIds;
}

type AdjacencyEdge = {
  targetMapId: string;
  dxCells: number;
  dyCells: number;
};

export function buildWorldMapLayout(
  snapshot: PlayableMapsStateSnapshot
): WorldMapLayout {
  const itemsById = new Map<string, DesignerItemSeed>(
    snapshot.items.map((item) => [item.id, item])
  );
  const townIds = getTownMapIds(snapshot);

  // Undirected adjacency: connections are authored on both endpoints, but
  // walking each edge in both directions keeps the layout whole even when
  // only one side declares it.
  const adjacency = new Map<string, AdjacencyEdge[]>();
  const addEdge = (fromId: string, toId: string, dxCells: number, dyCells: number) => {
    if (!itemsById.has(fromId) || !itemsById.has(toId)) {
      return;
    }
    const edges = adjacency.get(fromId) ?? [];
    edges.push({ targetMapId: toId, dxCells, dyCells });
    adjacency.set(fromId, edges);
  };

  for (const item of snapshot.items) {
    for (const connection of item.playableMapConfig?.connections ?? []) {
      addEdge(item.id, connection.targetMapId, connection.offsetXCells, connection.offsetYCells);
      addEdge(connection.targetMapId, item.id, -connection.offsetXCells, -connection.offsetYCells);
    }
  }

  // Connected components via BFS, each in its own local cell space.
  const visited = new Set<string>();
  const components: Array<Array<{ mapId: string; cellX: number; cellY: number }>> = [];

  for (const startId of adjacency.keys()) {
    if (visited.has(startId)) {
      continue;
    }

    const component: Array<{ mapId: string; cellX: number; cellY: number }> = [];
    const queue: Array<{ mapId: string; cellX: number; cellY: number }> = [
      { mapId: startId, cellX: 0, cellY: 0 },
    ];
    visited.add(startId);

    while (queue.length > 0) {
      const node = queue.shift()!;
      component.push(node);

      for (const edge of adjacency.get(node.mapId) ?? []) {
        if (visited.has(edge.targetMapId)) {
          continue;
        }
        visited.add(edge.targetMapId);
        queue.push({
          mapId: edge.targetMapId,
          cellX: node.cellX + edge.dxCells,
          cellY: node.cellY + edge.dyCells,
        });
      }
    }

    components.push(component);
  }

  // Biggest component (the main overworld) first, then stack the rest below.
  components.sort((a, b) => b.length - a.length);

  const placements: WorldMapPlacement[] = [];
  let stackTopCells = 0;
  let overallWidthCells = 0;

  for (const component of components) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const nodes = component.map((node) => {
      const item = itemsById.get(node.mapId)!;
      const config = item.playableMapConfig;
      const widthCells = Math.max(1, config?.width ?? 1);
      const heightCells = Math.max(1, config?.height ?? 1);

      minX = Math.min(minX, node.cellX);
      minY = Math.min(minY, node.cellY);
      maxX = Math.max(maxX, node.cellX + widthCells);
      maxY = Math.max(maxY, node.cellY + heightCells);

      return { item, node, widthCells, heightCells };
    });

    for (const { item, node, widthCells, heightCells } of nodes) {
      placements.push({
        mapId: item.id,
        name: item.name,
        cellX: node.cellX - minX,
        cellY: node.cellY - minY + stackTopCells,
        widthCells,
        heightCells,
        cellSize: item.playableMapConfig?.cellSize ?? 32,
        isTown: townIds.has(item.id),
      });
    }

    overallWidthCells = Math.max(overallWidthCells, maxX - minX);
    stackTopCells += maxY - minY + COMPONENT_GAP_CELLS;
  }

  return {
    placements,
    placementsByMapId: new Map(placements.map((placement) => [placement.mapId, placement])),
    widthCells: overallWidthCells,
    heightCells: Math.max(0, stackTopCells - COMPONENT_GAP_CELLS),
  };
}

export type WorldMapLocation = {
  placement: WorldMapPlacement;
  /** True when the player stands on the placed map itself; false when the
   *  placement is the overworld map that (transitively) contains the interior
   *  the player is in. */
  isExact: boolean;
};

/**
 * Resolves where on the world map a player currently is. Interiors (houses,
 * Pokémon Centers, caves) are not part of the connection graph, so they are
 * traced back to the overworld through the portals that lead into them.
 */
export function resolveWorldMapLocation(
  snapshot: PlayableMapsStateSnapshot,
  layout: WorldMapLayout,
  mapId: string | null | undefined
): WorldMapLocation | null {
  if (!mapId) {
    return null;
  }

  const exact = layout.placementsByMapId.get(mapId);
  if (exact) {
    return { placement: exact, isExact: true };
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

        const placement = layout.placementsByMapId.get(sourceId);
        if (placement) {
          return { placement, isExact: false };
        }

        visited.add(sourceId);
        next.push(sourceId);
      }
    }

    frontier = next;
  }

  return null;
}
