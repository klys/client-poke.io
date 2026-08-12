import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppContext } from "../../context/appContext";
import { applyCameraToPosition, reapplyCamera, snapCameraToPosition } from "./camera";
import { clearLiveSelfPosition, setLiveSelfPosition } from "./livePlayerPosition";
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
 * Movement timing: positions are rendered through an interpolation buffer.
 *
 * Every move packet is stamped onto a local playback timeline (spaced by the
 * server clock `t` it carries, so network jitter can't bunch steps up) and
 * the render loop samples that timeline slightly in the past, linearly
 * interpolating between the two surrounding samples. Constant-velocity
 * sampling is what makes a held walk read as one continuous glide instead of
 * 35 tiny eased hops per second.
 *
 * - INTERP_DELAY_* is the main "feel" control: how far in the past we render.
 *   Larger = smoother under jitter but laggier. The self delay is kept tight
 *   (input already pays a round trip); remote players can afford more.
 * - NOMINAL_STEP_MS mirrors the server movement tick (player.ts).
 * - A gap above MAX_SEGMENT_MS means the walk stopped and restarted, so the
 *   timeline re-anchors instead of interpolating across the pause.
 */
const INTERP_DELAY_SELF_MS = 60;
const INTERP_DELAY_REMOTE_MS = 120;
const NOMINAL_STEP_MS = 28;
const MAX_SEGMENT_MS = 250;
// Keeps the reconstructed (server-clock-spaced) timeline glued to the local
// clock even if the two tick at slightly different rates.
const TIMELINE_DRIFT_CLAMP_MS = 200;
// The walk sprite only drops back to standing after this much stillness, so
// a single late packet can't flicker the GIF mid-stride.
const WALK_STOP_HYSTERESIS_MS = 100;
const MAX_BUFFER_SAMPLES = 64;

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

type MoveSample = {
  x: number;
  y: number;
  angle: number;
  currentMapId: string;
  /** Playback-timeline timestamp (performance.now() domain). */
  time: number;
  /** Server clock from the packet, used to space consecutive samples. */
  serverT: number | null;
};

/**
 * Stamps a move packet onto the local playback timeline. Consecutive samples
 * are spaced by the server clock deltas when available (arrival spacing as a
 * fallback), clamped so the timeline can never drift away from the local
 * clock. A gap longer than MAX_SEGMENT_MS re-anchors the timeline and
 * re-times the resting sample one nominal step back, so the first step of a
 * fresh walk still glides instead of interpolating across the idle pause.
 */
const appendMoveSample = (
  buffer: MoveSample[],
  position: Position,
  serverT: number | null,
  arrival: number
) => {
  const last = buffer[buffer.length - 1];
  let time = arrival;

  if (last) {
    const delta =
      serverT !== null && last.serverT !== null ? serverT - last.serverT : arrival - last.time;

    if (delta >= 0 && delta <= MAX_SEGMENT_MS) {
      time = Math.min(
        Math.max(last.time + delta, arrival - TIMELINE_DRIFT_CLAMP_MS),
        arrival + NOMINAL_STEP_MS
      );
      time = Math.max(time, last.time);
    } else {
      const previous = buffer[buffer.length - 2];
      last.time = Math.max(
        previous ? previous.time : Number.NEGATIVE_INFINITY,
        arrival - NOMINAL_STEP_MS
      );
    }
  }

  buffer.push({
    x: position.x,
    y: position.y,
    angle: position.angle,
    currentMapId: position.currentMapId,
    time,
    serverT
  });

  if (buffer.length > MAX_BUFFER_SAMPLES) {
    buffer.splice(0, buffer.length - MAX_BUFFER_SAMPLES);
  }
};

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
  const moveBufferRef = useRef<MoveSample[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastMovedAtRef = useRef(0);
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
  const applyVisualPosition = useCallback(
    (position: Position, options?: { snapCamera?: boolean }) => {
      posRef.current = position;
      const node = rootRef.current;
      if (node) {
        // The sprite itself snaps to whole CSS pixels (pixel art); the camera
        // gets the raw interpolated focus so its easing stays sub-pixel smooth.
        node.style.transform = `translate3d(${Math.round(position.x)}px, ${Math.round(
          position.y
        )}px, 0)`;
      }
      if (isSelfRef.current) {
        if (options?.snapCamera) {
          snapCameraToPosition(position.x, position.y);
        } else {
          applyCameraToPosition(position.x, position.y);
        }
      }
    },
    []
  );

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

    moveBufferRef.current = [];
    setIsWalking(false);
  }, []);

  // Render loop: samples the move buffer INTERP_DELAY ms in the past and
  // linearly interpolates between the surrounding samples, so a held walk is
  // one constant-velocity glide no matter how the packets arrived. Runs only
  // while there is buffered movement to play out; idles otherwise and is
  // restarted by the next packet.
  const runRenderLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    const step = (now: number) => {
      animationFrameRef.current = null;

      const buffer = moveBufferRef.current;
      if (buffer.length === 0) {
        setIsWalking(false);
        return;
      }

      const delay = isSelfRef.current ? INTERP_DELAY_SELF_MS : INTERP_DELAY_REMOTE_MS;
      const renderTime = now - delay;

      // Drop samples fully behind the render time (always keep the newest —
      // it is the resting position while the player stands still).
      while (buffer.length >= 2 && buffer[1].time <= renderTime) {
        buffer.shift();
      }

      const from = buffer[0];
      const to = buffer.length >= 2 ? buffer[1] : null;
      let x = from.x;
      let y = from.y;

      if (to && renderTime > from.time) {
        const span = Math.max(1, to.time - from.time);
        const fraction = Math.min(1, (renderTime - from.time) / span);
        x = from.x + (to.x - from.x) * fraction;
        y = from.y + (to.y - from.y) * fraction;
      }

      const previous = posRef.current;
      const moved = Math.abs(x - previous.x) > 0.05 || Math.abs(y - previous.y) > 0.05;
      const latest = buffer[buffer.length - 1];

      applyVisualPosition({
        x,
        y,
        angle: latest.angle,
        currentMapId: from.currentMapId
      });

      if (moved) {
        lastMovedAtRef.current = now;
        setIsWalking(true);
      } else if (now - lastMovedAtRef.current > WALK_STOP_HYSTERESIS_MS) {
        setIsWalking(false);
        if (!to) {
          // Settled on the newest sample with nothing left to play — idle.
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
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

      const arrival = performance.now();
      const nextPosition = {
        x: data.x ?? posRef.current.x,
        y: data.y ?? posRef.current.y,
        angle: data.angle ?? posRef.current.angle,
        currentMapId: data.currentMapId ?? posRef.current.currentMapId,
        teleported: data.teleported === true,
        stopped: data.stopped === true
      };

      // Publish the raw authoritative position for the drive loop
      // (UserControl) — fresher than the cell-quantized context mirror.
      if (isSelfRef.current) {
        setLiveSelfPosition({
          x: nextPosition.x,
          y: nextPosition.y,
          angle: nextPosition.angle,
          currentMapId: nextPosition.currentMapId
        });
      }

      // Facing is discrete: apply the newest packet's angle immediately so
      // turns feel responsive instead of trailing the interpolation delay.
      setDirection(getDirectionFromAngle(nextPosition.angle));

      // Only genuine discontinuities snap. `stopped` packets (turn-in-place,
      // blocked step, end of a walk) flow through the buffer like any other
      // sample so the sprite glides to rest instead of jerking to it.
      if (
        nextPosition.teleported ||
        nextPosition.currentMapId !== posRef.current.currentMapId
      ) {
        stopMovement();
        applyVisualPosition(nextPosition, { snapCamera: true });
        setPos(nextPosition);
        dispatchMoveToContext(nextPosition, true);
        // Seed the (just cleared) buffer with the landing spot as a resting
        // sample so the first step walked after arrival glides from it
        // instead of popping straight onto the first path node.
        moveBufferRef.current.push({
          x: nextPosition.x,
          y: nextPosition.y,
          angle: nextPosition.angle,
          currentMapId: nextPosition.currentMapId,
          time: arrival,
          serverT: typeof data.t === "number" && Number.isFinite(data.t) ? data.t : null
        });
        return;
      }

      const serverT =
        typeof data.t === "number" && Number.isFinite(data.t) ? data.t : null;
      appendMoveSample(moveBufferRef.current, nextPosition, serverT, arrival);
      runRenderLoop();

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
      if (isSelfRef.current) {
        clearLiveSelfPosition();
      }
    };
  }, [applyVisualPosition, playerId, playerIndex, runRenderLoop, socket, stopMovement]);

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
    // reconnect). While moving, applyVisualPosition steers the camera's
    // smoothed follow without a React commit per frame.
    snapCameraToPosition(posRef.current.x, posRef.current.y);
    // Seed the drive loop's live position so the very first keypress after
    // login/teleport aims from the right spot even before any move packet.
    setLiveSelfPosition({
      x: posRef.current.x,
      y: posRef.current.y,
      angle: posRef.current.angle,
      currentMapId: posRef.current.currentMapId
    });
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
  // Character name is display-primary (accounts are secondary identities).
  const trainerName = playerInfo.characterName || playerInfo.name || playerInfo.username || "Trainer";
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
          accountId: playerInfo.accountId,
          accountName: playerInfo.accountName,
          characterId: playerInfo.characterId,
          characterName: playerInfo.characterName,
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
        transform: `translate3d(${Math.round(posRef.current.x)}px, ${Math.round(posRef.current.y)}px, 0)`,
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
