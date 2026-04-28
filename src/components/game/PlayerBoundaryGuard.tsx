import { useContext, useEffect, useRef } from "react";
import { AppContext } from "../../context/appContext";
import {
  getInitialPlayableMap,
  getPlayableMapById,
  type PlayableMapRuntimeEntry,
} from "./playableMapRuntime";

const PLAYER_SIZE = 32;

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

const PlayerBoundaryGuard = () => {
  const { players, socket, myplayer, playableMapsState } = useContext(AppContext);
  const lastRelocationRequestRef = useRef<string | null>(null);
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
  }, [activeMap, currentPlayer, socket]);

  return null;
};

export default PlayerBoundaryGuard;
