import { useContext, useEffect, useRef } from "react";
import { AppContext } from "../../context/appContext";
import {
  getInitialPlayableMap,
  getPlayableMapById,
  type PlayableMapRuntimeEntry,
} from "./playableMapRuntime";
import { isSolidCollisionCell } from "../tilemap/collision";
import { decodeCollisionCells } from "../tilemap/tileMapProfile";
import type { PlayableMapTileMapProfile } from "../tilemap/tileMapTypes";

const PLAYER_SIZE = 32;

const collisionCellsCache = new globalThis.Map<string, Uint8Array | null>();

function getCollisionCells(mapId: string, tileMap: PlayableMapTileMapProfile) {
  const cacheKey = `${mapId}:${tileMap.collision.length}:${tileMap.collision.slice(0, 32)}`;
  const cached = collisionCellsCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const cells = decodeCollisionCells(tileMap);
  collisionCellsCache.set(cacheKey, cells);
  return cells;
}

function isPlayerBlockedByTileMap(
  x: number,
  y: number,
  activeMap: PlayableMapRuntimeEntry
) {
  const tileMap = activeMap.editorData.tileMap;

  if (!tileMap) {
    return false;
  }

  const cells = getCollisionCells(activeMap.item.id, tileMap);

  if (!cells) {
    return false;
  }

  // Match the server: inset the hitbox so tile-wide corridors stay passable.
  const inset = Math.min(tileMap.tileSize / 4, PLAYER_SIZE / 2 - 1);
  const firstColumn = Math.max(0, Math.floor((x + inset) / tileMap.tileSize));
  const firstRow = Math.max(0, Math.floor((y + inset) / tileMap.tileSize));
  const lastColumn = Math.min(
    tileMap.width - 1,
    Math.floor((x + PLAYER_SIZE - inset - 1) / tileMap.tileSize)
  );
  const lastRow = Math.min(
    tileMap.height - 1,
    Math.floor((y + PLAYER_SIZE - inset - 1) / tileMap.tileSize)
  );

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (isSolidCollisionCell(cells[row * tileMap.width + column])) {
        return true;
      }
    }
  }

  return false;
}

type ActivePlayer = {
  currentMapId?: string;
  playerId?: string;
  x?: number;
  y?: number;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function overlaps(first: Bounds, second: Bounds) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function isPlayerBlocked(player: ActivePlayer, activeMap: PlayableMapRuntimeEntry) {
  if (
    typeof player.x !== "number" ||
    !Number.isFinite(player.x) ||
    typeof player.y !== "number" ||
    !Number.isFinite(player.y)
  ) {
    return true;
  }

  const playerBounds = {
    x: player.x,
    y: player.y,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
  };

  if (isPlayerBlockedByTileMap(playerBounds.x, playerBounds.y, activeMap)) {
    return true;
  }

  return activeMap.editorData.objects
    .filter((object) => object.objectType === "obstacle")
    .some((object) =>
      overlaps(playerBounds, {
        x: object.x * activeMap.config.cellSize,
        y: object.y * activeMap.config.cellSize,
        width: object.width,
        height: object.height,
      })
    );
}

function isPlayerOutsideMap(player: ActivePlayer, activeMap: PlayableMapRuntimeEntry) {
  if (
    typeof player.x !== "number" ||
    !Number.isFinite(player.x) ||
    typeof player.y !== "number" ||
    !Number.isFinite(player.y)
  ) {
    return true;
  }

  const position = clampPlayerToMap(player.x, player.y, activeMap);

  return player.x !== position.x || player.y !== position.y;
}

function clampPlayerToMap(x: number, y: number, activeMap: PlayableMapRuntimeEntry) {
  const mapPixelWidth = activeMap.config.width * activeMap.config.cellSize;
  const mapPixelHeight = activeMap.config.height * activeMap.config.cellSize;
  const maxX = Math.max(0, mapPixelWidth - PLAYER_SIZE);
  const maxY = Math.max(0, mapPixelHeight - PLAYER_SIZE);

  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;

  return {
    x: Math.max(0, Math.min(Math.round(safeX), maxX)),
    y: Math.max(0, Math.min(Math.round(safeY), maxY)),
  };
}

function resolveValidPlayerPosition(player: ActivePlayer, activeMap: PlayableMapRuntimeEntry) {
  const requestedX =
    typeof player.x === "number" && Number.isFinite(player.x) ? player.x : 0;
  const requestedY =
    typeof player.y === "number" && Number.isFinite(player.y) ? player.y : 0;
  const clampedPosition = clampPlayerToMap(requestedX, requestedY, activeMap);

  if (!isPlayerBlocked({ ...player, ...clampedPosition }, activeMap)) {
    return clampedPosition;
  }

  const stepSize = PLAYER_SIZE;
  const mapPixelWidth = activeMap.config.width * activeMap.config.cellSize;
  const mapPixelHeight = activeMap.config.height * activeMap.config.cellSize;
  const maxX = Math.max(0, mapPixelWidth - PLAYER_SIZE);
  const maxY = Math.max(0, mapPixelHeight - PLAYER_SIZE);
  const maxRadius = Math.ceil(Math.max(maxX, maxY) / stepSize);

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) {
          continue;
        }

        const candidate = {
          x: Math.max(0, Math.min(clampedPosition.x + offsetX * stepSize, maxX)),
          y: Math.max(0, Math.min(clampedPosition.y + offsetY * stepSize, maxY)),
        };

        if (!isPlayerBlocked({ ...player, ...candidate }, activeMap)) {
          return candidate;
        }
      }
    }
  }

  return clampedPosition;
}

const EDGE_CROSS_EPSILON_PX = 4;
const EDGE_CROSS_COOLDOWN_MS = 600;

function resolveEdgeCrossing(
  player: { x: number; y: number },
  movement: { dx: number; dy: number },
  activeMap: PlayableMapRuntimeEntry,
  snapshot?: Parameters<typeof getPlayableMapById>[1]
) {
  const connections = activeMap.config.connections ?? [];

  if (connections.length === 0) {
    return null;
  }

  const cellSize = activeMap.config.cellSize;
  const mapPixelWidth = activeMap.config.width * cellSize;
  const mapPixelHeight = activeMap.config.height * cellSize;
  const maxX = Math.max(0, mapPixelWidth - PLAYER_SIZE);
  const maxY = Math.max(0, mapPixelHeight - PLAYER_SIZE);

  for (const connection of connections) {
    const atEdge =
      (connection.direction === "north" &&
        player.y <= EDGE_CROSS_EPSILON_PX &&
        movement.dy < 0) ||
      (connection.direction === "south" &&
        player.y >= maxY - EDGE_CROSS_EPSILON_PX &&
        movement.dy > 0) ||
      (connection.direction === "west" &&
        player.x <= EDGE_CROSS_EPSILON_PX &&
        movement.dx < 0) ||
      (connection.direction === "east" &&
        player.x >= maxX - EDGE_CROSS_EPSILON_PX &&
        movement.dx > 0);

    if (!atEdge) {
      continue;
    }

    const neighbor = getPlayableMapById(connection.targetMapId, snapshot);

    if (!neighbor) {
      continue;
    }

    const neighborPixelWidth = neighbor.config.width * neighbor.config.cellSize;
    const neighborPixelHeight = neighbor.config.height * neighbor.config.cellSize;
    // Translate into the neighbor's coordinate space via the shared-edge offset.
    let targetX = player.x - connection.offsetXCells * cellSize;
    let targetY = player.y - connection.offsetYCells * cellSize;

    // Land one tile inside the neighbor so the arrival edge isn't re-triggered.
    if (connection.direction === "north") {
      targetY = neighborPixelHeight - PLAYER_SIZE - cellSize;
    } else if (connection.direction === "south") {
      targetY = cellSize;
    } else if (connection.direction === "west") {
      targetX = neighborPixelWidth - PLAYER_SIZE - cellSize;
    } else {
      targetX = cellSize;
    }

    targetX = Math.max(0, Math.min(Math.round(targetX), neighborPixelWidth - PLAYER_SIZE));
    targetY = Math.max(0, Math.min(Math.round(targetY), neighborPixelHeight - PLAYER_SIZE));

    return { mapId: neighbor.item.id, x: targetX, y: targetY };
  }

  return null;
}

const PlayerBoundaryGuard = () => {
  const { players, socket, myplayer, playableMapsState } = useContext(AppContext);
  const lastRelocationRequestRef = useRef<string | null>(null);
  const lastPositionRef = useRef<{ mapId: string; x: number; y: number } | null>(null);
  const lastCrossingAtRef = useRef(0);
  const currentPlayer =
    (Object.values(players ?? {}).find(
      (player: any) => player?.playerId === myplayer
    ) as ActivePlayer | undefined) ?? null;
  const activeMap =
    getPlayableMapById(currentPlayer?.currentMapId, playableMapsState) ??
    getInitialPlayableMap(playableMapsState);

  useEffect(() => {
    if (!currentPlayer || !activeMap) {
      lastRelocationRequestRef.current = null;
      return;
    }

    if (
      typeof currentPlayer.x === "number" &&
      typeof currentPlayer.y === "number" &&
      currentPlayer.currentMapId === activeMap.item.id
    ) {
      const lastPosition = lastPositionRef.current;
      const movement =
        lastPosition && lastPosition.mapId === activeMap.item.id
          ? { dx: currentPlayer.x - lastPosition.x, dy: currentPlayer.y - lastPosition.y }
          : { dx: 0, dy: 0 };

      lastPositionRef.current = {
        mapId: activeMap.item.id,
        x: currentPlayer.x,
        y: currentPlayer.y,
      };

      if (
        (movement.dx !== 0 || movement.dy !== 0) &&
        Date.now() - lastCrossingAtRef.current > EDGE_CROSS_COOLDOWN_MS
      ) {
        const crossing = resolveEdgeCrossing(
          { x: currentPlayer.x, y: currentPlayer.y },
          movement,
          activeMap,
          playableMapsState
        );

        if (crossing) {
          lastCrossingAtRef.current = Date.now();
          socket.emit("player:teleport", crossing);
          return;
        }
      }
    }

    const shouldRelocate =
      currentPlayer.currentMapId !== activeMap.item.id ||
      isPlayerOutsideMap(currentPlayer, activeMap) ||
      isPlayerBlocked(currentPlayer, activeMap);

    if (!shouldRelocate) {
      lastRelocationRequestRef.current = null;
      return;
    }

    const nextPosition = resolveValidPlayerPosition(currentPlayer, activeMap);
    const requestKey = `${activeMap.item.id}:${nextPosition.x}:${nextPosition.y}`;

    if (lastRelocationRequestRef.current === requestKey) {
      return;
    }

    lastRelocationRequestRef.current = requestKey;
    socket.emit("player:teleport", {
      mapId: activeMap.item.id,
      x: nextPosition.x,
      y: nextPosition.y,
    });
  }, [activeMap, currentPlayer, playableMapsState, socket]);

  return null;
};

export default PlayerBoundaryGuard;
