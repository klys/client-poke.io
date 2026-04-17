import { useToast } from "@chakra-ui/react";
import { useCallback, useContext, useEffect, useRef } from "react";
import { AppContext } from "../../context/appContext";
import type { MapEditorPortalPlacement } from "../designer/PlayableMapEditorCanvas";
import {
  getInitialPlayableMap,
  getPlayableMapById,
  resolvePlayableMapCellPosition,
  resolvePortalDestination,
} from "./playableMapRuntime";

const PLAYER_SIZE = 32;
const PORTAL_COOLDOWN_MS = 350;

type ActivePlayer = {
  currentMapId?: string;
  x?: number;
  y?: number;
};

function isOverlappingPortal(
  player: ActivePlayer | null,
  portal: MapEditorPortalPlacement,
  cellSize: number
) {
  if (typeof player?.x !== "number" || typeof player?.y !== "number") {
    return false;
  }

  const portalBounds = {
    x: portal.x * cellSize,
    y: portal.y * cellSize,
    width: cellSize,
    height: cellSize,
  };
  const playerBounds = {
    x: player.x,
    y: player.y,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
  };

  return (
    playerBounds.x < portalBounds.x + portalBounds.width &&
    playerBounds.x + playerBounds.width > portalBounds.x &&
    playerBounds.y < portalBounds.y + portalBounds.height &&
    playerBounds.y + playerBounds.height > portalBounds.y
  );
}

function normalizeScriptBody(script: string) {
  return script.replace(/^\s*onEnter\s*:\s*/i, "").trim();
}

const PortalRuntime = () => {
  const toast = useToast();
  const { players, socket, myplayer } = useContext(AppContext);
  const lastTriggeredPortalRef = useRef<string | null>(null);
  const lastTriggeredAtRef = useRef(0);

  const currentPlayer: any =
    Object.values(players ?? {}).find((player: any) => player?.playerId === myplayer) ?? null;
  const activeMap = getPlayableMapById(currentPlayer?.currentMapId) ?? getInitialPlayableMap();

  const requestTeleport = useCallback((mapId: string, x: number, y: number) => {
    socket.emit("player:teleport", {
      mapId,
      x,
      y,
    });
  }, [socket]);

  const runPortalScript = useCallback((portal: MapEditorPortalPlacement) => {
    if (!activeMap) {
      return;
    }

    const script = normalizeScriptBody(portal.eventScript);

    if (!script) {
      return;
    }

    const api = {
      player: {
        playerId: currentPlayer?.playerId ?? "",
        currentMapId: currentPlayer?.currentMapId ?? activeMap.item.id,
        x: currentPlayer?.x ?? 0,
        y: currentPlayer?.y ?? 0,
      },
      portal,
      map: {
        id: activeMap.item.id,
        name: activeMap.item.name,
        width: activeMap.config.width,
        height: activeMap.config.height,
        cellSize: activeMap.config.cellSize,
      },
      teleportToSameMap: (cellX: number, cellY: number) => {
        const position = resolvePlayableMapCellPosition(activeMap.config, cellX, cellY);
        requestTeleport(activeMap.item.id, position.x, position.y);
      },
      teleportWithinMap: (cellX: number, cellY: number) => {
        const position = resolvePlayableMapCellPosition(activeMap.config, cellX, cellY);
        requestTeleport(activeMap.item.id, position.x, position.y);
      },
      teleportToMap: (mapId: string, cellX: number, cellY: number) => {
        const targetMap = getPlayableMapById(mapId);

        if (!targetMap) {
          throw new Error(`Target map "${mapId}" was not found.`);
        }

        const position = resolvePlayableMapCellPosition(targetMap.config, cellX, cellY);
        requestTeleport(targetMap.item.id, position.x, position.y);
      },
      loadMap: (mapId: string, cellX: number, cellY: number) => {
        const targetMap = getPlayableMapById(mapId);

        if (!targetMap) {
          throw new Error(`Target map "${mapId}" was not found.`);
        }

        const position = resolvePlayableMapCellPosition(targetMap.config, cellX, cellY);
        requestTeleport(targetMap.item.id, position.x, position.y);
      },
      showMessage: (message: string, status: "info" | "success" | "warning" | "error" = "info") => {
        toast({
          title: message,
          status,
          duration: 3000,
          isClosable: true,
          position: "top",
        });
      },
      console,
    };

    try {
      // eslint-disable-next-line no-new-func
      const execute = new Function(
        "api",
        `
          "use strict";
          const {
            player,
            portal,
            map,
            teleportToSameMap,
            teleportWithinMap,
            teleportToMap,
            loadMap,
            showMessage,
            console
          } = api;
          ${script}
        `
      ) as (value: typeof api) => void;

      execute(api);
    } catch (error) {
      console.error("Portal script failed:", error);
      toast({
        title: "Portal script failed.",
        description: error instanceof Error ? error.message : "Unknown portal script error.",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    }
  }, [activeMap, currentPlayer, requestTeleport, toast]);

  useEffect(() => {
    if (!activeMap || !currentPlayer) {
      lastTriggeredPortalRef.current = null;
      return;
    }

    const overlappingPortal =
      activeMap.editorData.portals.find((portal) =>
        isOverlappingPortal(currentPlayer, portal, activeMap.config.cellSize)
      ) ?? null;

    if (!overlappingPortal) {
      lastTriggeredPortalRef.current = null;
      return;
    }

    const portalKey = `${activeMap.item.id}:${overlappingPortal.id}`;
    const now = Date.now();

    if (
      lastTriggeredPortalRef.current === portalKey ||
      now - lastTriggeredAtRef.current < PORTAL_COOLDOWN_MS
    ) {
      return;
    }

    lastTriggeredPortalRef.current = portalKey;
    lastTriggeredAtRef.current = now;

    if (overlappingPortal.destinationType === "event-script") {
      runPortalScript(overlappingPortal);
      return;
    }

    const destination = resolvePortalDestination(activeMap, overlappingPortal);

    if (!destination) {
      toast({
        title: "Portal destination is invalid.",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    requestTeleport(destination.mapId, destination.x, destination.y);
  }, [activeMap, currentPlayer, requestTeleport, runPortalScript, toast]);

  return null;
};

export default PortalRuntime;
