import { useEffect, useMemo, useState } from "react";
import type { PlayableMapConnection } from "../designer/designerSections";
import TileMapSurface from "./TileMapSurface";
import {
  getPlayableMapBackgroundStyle,
  getPlayableMapById,
  type PlayableMapRuntimeEntry,
  type PlayableMapsStateSnapshot,
} from "./playableMapRuntime";

// Streaming thresholds (in cells from the shared edge), with hysteresis so
// neighbors don't flap in and out while walking along the boundary.
const LOAD_WITHIN_CELLS = 20;
const UNLOAD_BEYOND_CELLS = 28;

function distanceToEdgePx(
  connection: PlayableMapConnection,
  playerX: number,
  playerY: number,
  mapPixelWidth: number,
  mapPixelHeight: number
) {
  switch (connection.direction) {
    case "north":
      return playerY;
    case "south":
      return mapPixelHeight - (playerY + 32);
    case "west":
      return playerX;
    case "east":
    default:
      return mapPixelWidth - (playerX + 32);
  }
}

/**
 * Renders the baked surfaces of physically connected neighbor maps at their
 * shared-edge offsets while the player is near the corresponding edge, and
 * unmounts them (freeing decoded images) when the player walks away. Purely
 * visual: pointer events pass through and collision stays per-map.
 */
const MapNeighbors = ({
  activeMap,
  playerX,
  playerY,
  snapshot,
}: {
  activeMap: PlayableMapRuntimeEntry;
  playerX: number;
  playerY: number;
  snapshot?: PlayableMapsStateSnapshot;
}) => {
  const [loadedMapIds, setLoadedMapIds] = useState<string[]>([]);
  const configConnections = activeMap.config.connections;
  const connections = useMemo(() => configConnections ?? [], [configConnections]);
  const cellSize = activeMap.config.cellSize;
  const mapPixelWidth = activeMap.config.width * cellSize;
  const mapPixelHeight = activeMap.config.height * cellSize;

  useEffect(() => {
    setLoadedMapIds([]);
  }, [activeMap.item.id]);

  useEffect(() => {
    if (connections.length === 0) {
      return;
    }

    const nextLoaded = connections
      .filter((connection) => {
        const distance = distanceToEdgePx(
          connection,
          playerX,
          playerY,
          mapPixelWidth,
          mapPixelHeight
        );
        const isLoaded = loadedMapIds.includes(connection.targetMapId);

        return isLoaded
          ? distance <= UNLOAD_BEYOND_CELLS * cellSize
          : distance <= LOAD_WITHIN_CELLS * cellSize;
      })
      .map((connection) => connection.targetMapId);

    if (
      nextLoaded.length !== loadedMapIds.length ||
      nextLoaded.some((mapId) => !loadedMapIds.includes(mapId))
    ) {
      setLoadedMapIds(nextLoaded);
    }
  }, [cellSize, connections, loadedMapIds, mapPixelHeight, mapPixelWidth, playerX, playerY]);

  if (connections.length === 0) {
    return null;
  }

  return (
    <>
      {connections
        .filter((connection) => loadedMapIds.includes(connection.targetMapId))
        .map((connection) => {
          const neighbor = getPlayableMapById(connection.targetMapId, snapshot);

          if (!neighbor) {
            return null;
          }

          const neighborTileMap = neighbor.editorData.tileMap?.baked
            ? neighbor.editorData.tileMap
            : null;
          const neighborPixelWidth = neighbor.config.width * neighbor.config.cellSize;
          const neighborPixelHeight = neighbor.config.height * neighbor.config.cellSize;

          return (
            <div
              key={`${connection.direction}-${connection.targetMapId}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${connection.offsetXCells * cellSize}px`,
                top: `${connection.offsetYCells * cellSize}px`,
                width: `${neighborPixelWidth}px`,
                height: `${neighborPixelHeight}px`,
                pointerEvents: "none",
                ...(neighborTileMap
                  ? { backgroundColor: neighbor.config.backgroundColor }
                  : getPlayableMapBackgroundStyle(neighbor.config)),
              }}
            >
              {neighborTileMap ? (
                <>
                  <TileMapSurface tileMap={neighborTileMap} plane="background" zIndex={0} />
                  <TileMapSurface tileMap={neighborTileMap} plane="foreground" zIndex={1200} />
                </>
              ) : null}
            </div>
          );
        })}
    </>
  );
};

export default MapNeighbors;
