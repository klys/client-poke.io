import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppContext } from "../../context/appContext";
import { applyCameraToPosition, reapplyCamera } from "./camera";
import { assetUrl } from "../tilemap/serverAssets";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  type DesignerCacheUpdateDetail,
} from "../designer/designerCache";
import {
  getCharacterSkinSprite,
  loadCharacterSkinCatalog,
} from "../ux/game/characterSkinCatalog";
import { SocialContext } from "../ux/game/social/SocialContext";
import { useGameSettings } from "../../settings/gameSettings";
import { getPoseSheet, poseRowForDirection, type OverworldPose } from "./overworldPoses";

type Position = {
  x: number
  y: number
  angle: number
  currentMapId: string
  teleported?: boolean
  stopped?: boolean
}

type Direction = "up" | "down" | "left" | "right";

const DEFAULT_POSITION: Position = {
  x: 100,
  y: 100,
  angle: 270,
  currentMapId: "default-world"
}

/*
 * Movement timing guide:
 * - MOVEMENT_DURATION_PER_PIXEL is the main "feel" control. Higher values make each step glide longer.
 * - MIN_MOVEMENT_DURATION keeps tiny corrections from animating faster than a frame.
 * - MAX_MOVEMENT_DURATION caps long moves so the client does not feel sluggish when several updates queue up.
 *
 * Current examples:
 * - A 4px server tick uses about 28ms (4 * 7).
 * - A 16px keyboard step uses about 112ms total across four server ticks.
 * - Raising MIN_MOVEMENT_DURATION makes tiny corrections more visible.
 * - Lowering MAX_MOVEMENT_DURATION makes catch-up movement more responsive when network updates stack.
 */
const MIN_MOVEMENT_DURATION = 16;
const MAX_MOVEMENT_DURATION = 180;
const MOVEMENT_DURATION_PER_PIXEL = 7;

// Context-dispatch throttling: positions are mirrored into AppContext at tile
// granularity (plus a trailing settle) instead of per server packet.
const CONTEXT_DISPATCH_CELL_PX = 32;
const TRAILING_DISPATCH_MS = 200;

const getDirectionFromAngle = (angle: number): Direction => {
  switch (angle) {
    case 450:
    case 90:
      return "up";
    case 180:
      return "right";
    case 360:
    case 0:
      return "left";
    case 270:
    default:
      return "down";
  }
}

const sameCoordinates = (first: Position, second: Position) =>
  first.x === second.x && first.y === second.y && first.currentMapId === second.currentMapId;

const samePosition = (first: Position, second: Position) =>
  sameCoordinates(first, second) && first.angle === second.angle;

const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

const buildSpritePath = (direction: Direction, isWalking: boolean) =>
  assetUrl(`/character0/player_${isWalking ? "walk" : "stand"}_${direction}.${isWalking ? "gif" : "png"}`);

const Player = (props: any) => {
  const [death, setDeath] = useState(false);
  const { socket, movePlayer, myplayer, setSelectedTrainer } = useContext(AppContext);
  const playerInfo = props.playerInfo ?? {};
  const activeMapId = typeof props.activeMapId === "string" ? props.activeMapId : null;
  const playerId = playerInfo.playerId;
  const playerIndex = playerInfo.id;
  const initialPosition = {
    x: playerInfo.x ?? DEFAULT_POSITION.x,
    y: playerInfo.y ?? DEFAULT_POSITION.y,
    angle: playerInfo.angle ?? DEFAULT_POSITION.angle,
    currentMapId: playerInfo.currentMapId ?? DEFAULT_POSITION.currentMapId
  };

  const [pos, setPos] = useState<Position>(() => initialPosition);
  const [direction, setDirection] = useState<Direction>(() => getDirectionFromAngle(initialPosition.angle));
  const [isWalking, setIsWalking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // Traversal/pose state, server-authoritative: seeded from the addPlayer
  // snapshot and kept fresh by player:surf-state / player:pose broadcasts, so
  // local, remote, and reconnecting clients all render the same mount.
  const [isSurfing, setIsSurfing] = useState(() => playerInfo.isSurfing === true);
  const [fishingPose, setFishingPose] = useState(false);
  const [characterSkinCatalog, setCharacterSkinCatalog] = useState(() =>
    loadCharacterSkinCatalog()
  );

  const posRef = useRef(initialPosition);
  const deathRef = useRef(death);
  const movePlayerRef = useRef(movePlayer);
  const moveQueueRef = useRef<Position[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const currentTargetRef = useRef<Position | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isSelfRef = useRef(false);
  const lastDispatchedCellRef = useRef<{ cx: number; cy: number; angle: number; mapId: string } | null>(null);
  const pendingDispatchRef = useRef<Position | null>(null);
  const dispatchTimerRef = useRef<number | null>(null);

  // Visual position is written straight to the DOM (compositor-friendly
  // translate3d) instead of through setState: tweens run every animation
  // frame and a React commit per frame per visible player is the single
  // biggest render cost in the world view. React state (`pos`) only tracks
  // the semantic bits a render actually depends on (currentMapId).
  const applyVisualPosition = useCallback((position: Position) => {
    posRef.current = position;
    const node = rootRef.current;
    if (node) {
      node.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    }
    if (isSelfRef.current) {
      applyCameraToPosition(position.x, position.y);
    }
  }, []);

  useEffect(() => {
    deathRef.current = death;
  }, [death]);

  useEffect(() => {
    movePlayerRef.current = movePlayer;
  }, [movePlayer]);

  useEffect(() => {
    const handleDesignerCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;

      if (detail?.sectionKey === "players") {
        setCharacterSkinCatalog(loadCharacterSkinCatalog());
      }
    };

    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);

    return () => {
      window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);
    };
  }, []);

  const stopMovement = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    currentTargetRef.current = null;
    moveQueueRef.current = [];
    setIsWalking(false);
  }, []);

  // Queue one server movement at a time so each update can be animated smoothly.
  const processMoveQueue = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    const nextPosition = moveQueueRef.current.shift();

    if (!nextPosition) {
      currentTargetRef.current = null;
      setIsWalking(false);
      return;
    }

    const startPosition = posRef.current;
    const nextDirection = getDirectionFromAngle(nextPosition.angle);

    setDirection(nextDirection);

    if (
      nextPosition.teleported ||
      nextPosition.stopped ||
      startPosition.currentMapId !== nextPosition.currentMapId
    ) {
      currentTargetRef.current = null;
      moveQueueRef.current = [];
      applyVisualPosition(nextPosition);
      setPos(nextPosition);
      setIsWalking(false);
      return;
    }

    if (samePosition(startPosition, nextPosition)) {
      currentTargetRef.current = null;
      applyVisualPosition(nextPosition);
      processMoveQueue();
      return;
    }

    if (sameCoordinates(startPosition, nextPosition)) {
      currentTargetRef.current = null;
      applyVisualPosition(nextPosition);
      processMoveQueue();
      return;
    }

    currentTargetRef.current = nextPosition;
    setIsWalking(true);

    const distance = Math.hypot(nextPosition.x - startPosition.x, nextPosition.y - startPosition.y);
    // Clamp duration so short steps remain visible and long catch-up steps do not drag.
    const duration = Math.max(
      MIN_MOVEMENT_DURATION,
      Math.min(MAX_MOVEMENT_DURATION, distance * MOVEMENT_DURATION_PER_PIXEL)
    );
    const startedAt = performance.now();

    const animate = (currentTime: number) => {
      const progress = Math.min(1, (currentTime - startedAt) / duration);
      const easedProgress = easeOutCubic(progress);
      const animatedPosition = {
        x: Math.round(startPosition.x + (nextPosition.x - startPosition.x) * easedProgress),
        y: Math.round(startPosition.y + (nextPosition.y - startPosition.y) * easedProgress),
        angle: nextPosition.angle,
        currentMapId: nextPosition.currentMapId
      };

      applyVisualPosition(animatedPosition);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      animationFrameRef.current = null;
      currentTargetRef.current = null;
      applyVisualPosition(nextPosition);

      if (moveQueueRef.current.length === 0) {
        setIsWalking(false);
        return;
      }

      processMoveQueue();
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [applyVisualPosition]);

  useEffect(() => {
    if (!playerId) {
      return undefined;
    }

    // Mirror a server position into the app context, but not at packet rate:
    // move packets arrive ~every 28ms while walking and every dispatch
    // re-renders every AppContext consumer (Map, UserControl, Network, …).
    // Consumers act on tile-level data, so dispatch immediately only when the
    // 32px cell / facing / map changes, and trail the in-cell remainder so the
    // context always settles on the exact resting position.
    const dispatchMoveToContext = (position: Position, force: boolean) => {
      if (typeof playerIndex === "undefined") {
        return;
      }

      const cell = {
        cx: Math.floor(position.x / CONTEXT_DISPATCH_CELL_PX),
        cy: Math.floor(position.y / CONTEXT_DISPATCH_CELL_PX),
        angle: position.angle,
        mapId: position.currentMapId
      };
      const last = lastDispatchedCellRef.current;
      const cellChanged =
        !last ||
        last.cx !== cell.cx ||
        last.cy !== cell.cy ||
        last.angle !== cell.angle ||
        last.mapId !== cell.mapId;

      if (!cellChanged && !force) {
        pendingDispatchRef.current = position;
        if (dispatchTimerRef.current === null) {
          dispatchTimerRef.current = window.setTimeout(() => {
            dispatchTimerRef.current = null;
            const pending = pendingDispatchRef.current;
            pendingDispatchRef.current = null;
            if (pending) {
              dispatchMoveToContext(pending, true);
            }
          }, TRAILING_DISPATCH_MS);
        }
        return;
      }

      if (dispatchTimerRef.current !== null) {
        window.clearTimeout(dispatchTimerRef.current);
        dispatchTimerRef.current = null;
      }
      pendingDispatchRef.current = null;
      lastDispatchedCellRef.current = cell;
      movePlayerRef.current({
        id: playerIndex,
        angle: position.angle,
        x: position.x,
        y: position.y,
        currentMapId: position.currentMapId
      });
    };

    const handlePlayerMove = (data: any) => {
      if (deathRef.current) {
        return;
      }

      const nextPosition = {
        x: data.x ?? posRef.current.x,
        y: data.y ?? posRef.current.y,
        angle: data.angle ?? posRef.current.angle,
        currentMapId: data.currentMapId ?? posRef.current.currentMapId,
        teleported: data.teleported === true,
        stopped: data.stopped === true
      };

      if (
        nextPosition.teleported ||
        nextPosition.stopped ||
        nextPosition.currentMapId !== posRef.current.currentMapId
      ) {
        stopMovement();
        applyVisualPosition(nextPosition);
        setDirection(getDirectionFromAngle(nextPosition.angle));
        setPos(nextPosition);
        dispatchMoveToContext(nextPosition, true);
        return;
      }

      const lastKnownTarget =
        moveQueueRef.current[moveQueueRef.current.length - 1] ??
        currentTargetRef.current ??
        posRef.current;

      if (!samePosition(lastKnownTarget, nextPosition)) {
        if (animationFrameRef.current !== null) {
          moveQueueRef.current = [nextPosition];
        } else {
          moveQueueRef.current.push(nextPosition);
        }
        processMoveQueue();
      }

      dispatchMoveToContext(nextPosition, false);
    };

    const handlePlayerDeath = () => {
      setDeath(true);
      stopMovement();
    };

    const handlePlayerReborn = () => {
      setDeath(false);
    };

    const handleSurfState = (data: any) => {
      if (data?.playerId !== playerId) {
        return;
      }
      setIsSurfing(data.surfing === true);
    };

    const handlePose = (data: any) => {
      if (data?.playerId !== playerId) {
        return;
      }
      setFishingPose(data.pose === "fishing");
    };

    socket.on(`move${playerId}`, handlePlayerMove);
    socket.on(`playerDeath${playerId}`, handlePlayerDeath);
    socket.on(`playerReborn${playerId}`, handlePlayerReborn);
    socket.on("player:surf-state", handleSurfState);
    socket.on("player:pose", handlePose);

    return () => {
      socket.off(`move${playerId}`, handlePlayerMove);
      socket.off(`playerDeath${playerId}`, handlePlayerDeath);
      socket.off(`playerReborn${playerId}`, handlePlayerReborn);
      socket.off("player:surf-state", handleSurfState);
      socket.off("player:pose", handlePose);
      stopMovement();
      if (dispatchTimerRef.current !== null) {
        window.clearTimeout(dispatchTimerRef.current);
        dispatchTimerRef.current = null;
      }
      pendingDispatchRef.current = null;
    };
  }, [applyVisualPosition, playerId, playerIndex, processMoveQueue, socket, stopMovement]);

  // Re-seed traversal state whenever the server re-presents this player
  // (map change, reconnect, visibility refresh).
  useEffect(() => {
    setIsSurfing(playerInfo.isSurfing === true);
  }, [playerInfo.isSurfing]);

  useEffect(() => {
    isSelfRef.current = myplayer === playerId;
    if (!isSelfRef.current) {
      return;
    }

    // Snap the camera when this player becomes "me" (login, map switch,
    // reconnect). While moving, applyVisualPosition keeps the camera glued to
    // the tween without a React commit per frame.
    applyCameraToPosition(posRef.current.x, posRef.current.y);
  }, [myplayer, playerId, pos]);

  useEffect(() => {
    if (myplayer !== playerId) {
      return;
    }

    window.addEventListener("resize", reapplyCamera);

    return () => {
      window.removeEventListener("resize", reapplyCamera);
    };
  }, [myplayer, playerId]);

  // Active overworld pose: the pose charsets draw the trainer ON the mount /
  // with the rod, so they replace the walk sprite while active (the original
  // Essentials vehicle behavior — mount and player can never desync).
  const activePose: OverworldPose | null = fishingPose
    ? isSurfing
      ? "fishsurf"
      : "fish"
    : isSurfing
      ? "surf"
      : null;
  const poseSheet = activePose ? getPoseSheet(activePose, playerInfo.characterSkinId) : null;
  const [poseFrame, setPoseFrame] = useState(0);

  useEffect(() => {
    setPoseFrame(0);
    if (!activePose) {
      return undefined;
    }
    // Surf mounts bob continuously; the fishing cast plays once and holds.
    const interval = window.setInterval(
      () => {
        setPoseFrame((frame) =>
          activePose === "surf" ? (frame + 1) % 4 : Math.min(frame + 1, 3)
        );
      },
      activePose === "surf" ? 220 : 160
    );
    return () => window.clearInterval(interval);
  }, [activePose]);

  const characterSkinProfile = useMemo(
    () =>
      characterSkinCatalog.find((item) => item.id === playerInfo.characterSkinId)?.profile,
    [characterSkinCatalog, playerInfo.characterSkinId]
  );
  const spritePath =
    getCharacterSkinSprite(characterSkinProfile, direction, isWalking) ||
    buildSpritePath(direction, isWalking);
  const spriteLabel = `${isWalking ? "walking" : "standing"} ${direction}`;
  const isVisibleOnActiveMap = !activeMapId || pos.currentMapId === activeMapId;
  const trainerName = playerInfo.username || playerInfo.name || "Trainer";
  const isCurrentPlayer = myplayer === playerId;
  // Speech bubble for this player's latest same-map chat message. Direct
  // useContext (not useSocial) so Player still renders if the social provider
  // is absent (e.g. isolated tests).
  const social = useContext(SocialContext);
  const chatBubble = social?.bubbles?.[playerId] ?? null;
  // Settings toggle: names always visible over heads, or hover-only (the
  // original behavior) when off. The chat bubble keeps priority either way.
  const [gameSettings] = useGameSettings();
  const showNameLabel =
    !chatBubble &&
    (gameSettings.hud.showPlayerNames || (!isCurrentPlayer && isHovered));

  return (
    <div
      id={playerId}
      ref={rootRef}
      hidden={death || !isVisibleOnActiveMap}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={(event) => {
        if (isCurrentPlayer) {
          return;
        }

        event.stopPropagation();
        setSelectedTrainer({
          playerId,
          username: playerInfo.username,
          name: playerInfo.name,
          profileImage: playerInfo.profileImage,
          description: playerInfo.description,
          characterSkinId: playerInfo.characterSkinId,
          currentMapId: pos.currentMapId
        });
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        // Movement animates transform (compositor-only, no layout) via
        // applyVisualPosition. Rendering from posRef (not `pos` state) keeps
        // an unrelated re-render mid-tween from snapping the sprite back.
        transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`,
        width: "32px",
        height: "32px",
        zIndex: 999,
        cursor: isCurrentPlayer ? "default" : "pointer"
      }}
    >
      {chatBubble ? (
        <div
          data-chat-bubble={playerId}
          style={{
            position: "absolute",
            bottom: "34px",
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "160px",
            width: "max-content",
            padding: "4px 8px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(17,24,39,0.35)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            color: "#111827",
            fontSize: "11px",
            fontWeight: 600,
            lineHeight: 1.25,
            textAlign: "center",
            whiteSpace: "normal",
            overflowWrap: "break-word",
            pointerEvents: "none",
            zIndex: 2
          }}
        >
          {chatBubble.text}
          <div
            style={{
              position: "absolute",
              bottom: "-5px",
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: "8px",
              height: "8px",
              background: "rgba(255,255,255,0.96)",
              borderRight: "1px solid rgba(17,24,39,0.35)",
              borderBottom: "1px solid rgba(17,24,39,0.35)"
            }}
          />
        </div>
      ) : null}
      {showNameLabel ? (
        <div
          data-player-name-label={playerId}
          style={{
            position: "absolute",
            bottom: "34px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "3px 7px",
            borderRadius: "6px",
            background: "rgba(17, 24, 39, 0.92)",
            border: "1px solid rgba(255,255,255,0.28)",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            pointerEvents: "none"
          }}
        >
          {trainerName}
        </div>
      ) : null}
      {/* Skins are 32x48 (taller than the 32x32 logical cell). Render at
          natural aspect anchored to the cell's bottom edge so feet stay on
          the tile — the old fixed 32x32 box squished every skin. While a
          traversal pose is active (Surf mount, fishing cast) the 4x4 RMXP
          pose charset replaces the walk sprite: it already contains the
          trainer riding/casting, centered on the cell and bottom-anchored so
          water renders below it and overhead tiles above it. */}
      {poseSheet ? (
        <div
          role="img"
          aria-label={`Player ${activePose} ${direction}`}
          style={{
            position: "absolute",
            bottom: 0,
            left: `${Math.round((32 - poseSheet.frameWidth) / 2)}px`,
            width: `${poseSheet.frameWidth}px`,
            height: `${poseSheet.frameHeight}px`,
            backgroundImage: `url(${poseSheet.src})`,
            backgroundSize: "400% 400%",
            backgroundPosition: `${(poseFrame * 100) / 3}% ${
              (poseRowForDirection(direction) * 100) / 3
            }%`,
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
            pointerEvents: "none"
          }}
        />
      ) : (
        <img
          src={spritePath}
          alt={`Player ${spriteLabel}`}
          width={32}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "32px",
            height: "auto",
            imageRendering: "pixelated",
          }}
        />
      )}
    </div>
  );
};

export default Player;
