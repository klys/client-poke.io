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
  if (typeof player.x !== "number" || typeof player.y !== "number") {
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
  if (typeof player.x !== "number" || typeof player.y !== "number") {
    return true;
  }

  const mapPixelWidth = activeMap.config.width * activeMap.config.cellSize;
  const mapPixelHeight = activeMap.config.height * activeMap.config.cellSize;
  const maxX = Math.max(0, mapPixelWidth - PLAYER_SIZE);
  const maxY = Math.max(0, mapPixelHeight - PLAYER_SIZE);

  return player.x < 0 || player.y < 0 || player.x > maxX || player.y > maxY;
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

    const requestedX = typeof currentPlayer.x === "number" ? currentPlayer.x : 0;
    const requestedY = typeof currentPlayer.y === "number" ? currentPlayer.y : 0;
    const requestKey = `${activeMap.item.id}:${requestedX}:${requestedY}`;

    if (lastRelocationRequestRef.current === requestKey) {
      return;
    }

    lastRelocationRequestRef.current = requestKey;
    socket.emit("player:teleport", {
      mapId: activeMap.item.id,
      x: requestedX,
      y: requestedY,
    });
  }, [activeMap, currentPlayer, socket]);

  return null;
};

export default PlayerBoundaryGuard;
