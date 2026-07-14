import { useToast } from "@chakra-ui/react";
import { useCallback, useContext, useEffect, useRef } from "react";
import { AppContext } from "../../context/appContext";
import { gameAudio } from "../ux/game/gameAudio";
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
  const { players, socket, myplayer, playableMapsState } = useContext(AppContext);
  // The portal the player currently occupies. A portal fires only on the
  // transition from "not standing on it" to "standing on it"; while this ref
  // holds a portal's key, that portal stays inert until the player steps off.
  const standingPortalKeyRef = useRef<string | null>(null);
  // Last map we observed the player on, to detect teleport/portal arrivals.
  const lastMapIdRef = useRef<string | null>(null);
  const lastTriggeredAtRef = useRef(0);

  const currentPlayer: any =
    Object.values(players ?? {}).find((player: any) => player?.playerId === myplayer) ?? null;
  const activeMap =
    getPlayableMapById(currentPlayer?.currentMapId, playableMapsState) ??
    getInitialPlayableMap(playableMapsState);

  const requestTeleport = useCallback((mapId: string, x: number, y: number) => {
    // Door/exit chime, like the original Essentials transfer events.
    gameAudio.playEffect("Exit Door", "SE");
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
        const targetMap = getPlayableMapById(mapId, playableMapsState);

        if (!targetMap) {
          throw new Error(`Target map "${mapId}" was not found.`);
        }

        const position = resolvePlayableMapCellPosition(targetMap.config, cellX, cellY);
        requestTeleport(targetMap.item.id, position.x, position.y);
      },
      loadMap: (mapId: string, cellX: number, cellY: number) => {
        const targetMap = getPlayableMapById(mapId, playableMapsState);

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
  }, [activeMap, currentPlayer, playableMapsState, requestTeleport, toast]);

  useEffect(() => {
    if (!activeMap || !currentPlayer) {
      standingPortalKeyRef.current = null;
      lastMapIdRef.current = currentPlayer?.currentMapId ?? null;
      return;
    }

    const overlappingPortal =
      activeMap.editorData.portals.find((portal) =>
        isOverlappingPortal(currentPlayer, portal, activeMap.config.cellSize)
      ) ?? null;
    const portalKey = overlappingPortal
      ? `${activeMap.item.id}:${overlappingPortal.id}`
      : null;

    const mapChanged = currentPlayer.currentMapId !== lastMapIdRef.current;
    lastMapIdRef.current = currentPlayer.currentMapId ?? null;

    // The player just arrived on this map (via a portal, admin teleport, or
    // initial spawn). Whatever portal they land on — typically the return
    // portal at the destination — is treated as already-consumed so it can't
    // instantly warp them back. They must step off and re-enter it on foot.
    if (mapChanged) {
      standingPortalKeyRef.current = portalKey;
      return;
    }

    if (!overlappingPortal) {
      standingPortalKeyRef.current = null;
      return;
    }

    // Still standing on the portal we already handled or were dropped onto.
    if (portalKey === standingPortalKeyRef.current) {
      return;
    }

    const now = Date.now();

    if (now - lastTriggeredAtRef.current < PORTAL_COOLDOWN_MS) {
      return;
    }

    standingPortalKeyRef.current = portalKey;
    lastTriggeredAtRef.current = now;

    if (overlappingPortal.destinationType === "event-script") {
      runPortalScript(overlappingPortal);
      return;
    }

    const destination = resolvePortalDestination(
      activeMap,
      overlappingPortal,
      playableMapsState
    );

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
  }, [activeMap, currentPlayer, playableMapsState, requestTeleport, runPortalScript, toast]);

  return null;
};

export default PortalRuntime;
