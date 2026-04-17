import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../../context/appContext";

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
 * - MIN_MOVEMENT_DURATION prevents very short moves from looking like teleports.
 * - MAX_MOVEMENT_DURATION caps long moves so the client does not feel sluggish when several updates queue up.
 *
 * Current examples:
 * - A 16px step uses about 112ms (16 * 7), which fits between the min and max values.
 * - Raising MIN_MOVEMENT_DURATION makes tiny corrections more visible.
 * - Lowering MAX_MOVEMENT_DURATION makes catch-up movement more responsive when network updates stack.
 */
const MIN_MOVEMENT_DURATION = 90;
const MAX_MOVEMENT_DURATION = 180;
const MOVEMENT_DURATION_PER_PIXEL = 7;

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
  `/character0/player_${isWalking ? "walk" : "stand"}_${direction}.${isWalking ? "gif" : "png"}`;

const Ship = (props: any) => {
  const [death, setDeath] = useState(false);
  const { socket, movePlayer, myplayer } = useContext(AppContext);
  const playerInfo = props.playerInfo ?? {};
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

  const posRef = useRef(initialPosition);
  const deathRef = useRef(death);
  const movePlayerRef = useRef(movePlayer);
  const moveQueueRef = useRef<Position[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const currentTargetRef = useRef<Position | null>(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    deathRef.current = death;
  }, [death]);

  useEffect(() => {
    movePlayerRef.current = movePlayer;
  }, [movePlayer]);

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
      posRef.current = nextPosition;
      setPos(nextPosition);
      setIsWalking(false);
      return;
    }

    if (samePosition(startPosition, nextPosition)) {
      currentTargetRef.current = null;
      posRef.current = nextPosition;
      setPos(nextPosition);
      processMoveQueue();
      return;
    }

    if (sameCoordinates(startPosition, nextPosition)) {
      currentTargetRef.current = null;
      posRef.current = nextPosition;
      setPos(nextPosition);
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

      posRef.current = animatedPosition;
      setPos(animatedPosition);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      animationFrameRef.current = null;
      currentTargetRef.current = null;
      posRef.current = nextPosition;
      setPos(nextPosition);

      if (moveQueueRef.current.length === 0) {
        setIsWalking(false);
        return;
      }

      processMoveQueue();
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!playerId) {
      return undefined;
    }

    const isLocalPlayer = myplayer === playerId;

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
        posRef.current = nextPosition;
        setDirection(getDirectionFromAngle(nextPosition.angle));
        setPos(nextPosition);

        if (typeof playerIndex !== "undefined") {
          movePlayerRef.current({
            id: playerIndex,
            angle: nextPosition.angle,
            x: nextPosition.x,
            y: nextPosition.y,
            currentMapId: nextPosition.currentMapId
          });
        }

        return;
      }

      if (isLocalPlayer) {
        const wasMoving = !sameCoordinates(posRef.current, nextPosition);

        stopMovement();
        posRef.current = nextPosition;
        setDirection(getDirectionFromAngle(nextPosition.angle));
        setPos(nextPosition);
        setIsWalking(wasMoving);

        if (typeof playerIndex !== "undefined") {
          movePlayerRef.current({
            id: playerIndex,
            angle: nextPosition.angle,
            x: nextPosition.x,
            y: nextPosition.y,
            currentMapId: nextPosition.currentMapId
          });
        }

        return;
      }

      const lastKnownTarget =
        moveQueueRef.current[moveQueueRef.current.length - 1] ??
        currentTargetRef.current ??
        posRef.current;

      if (!samePosition(lastKnownTarget, nextPosition)) {
        moveQueueRef.current.push(nextPosition);
        processMoveQueue();
      }

      if (typeof playerIndex !== "undefined") {
        movePlayerRef.current({
          id: playerIndex,
          angle: nextPosition.angle,
          x: nextPosition.x,
          y: nextPosition.y,
          currentMapId: nextPosition.currentMapId
        });
      }
    };

    const handlePlayerDeath = () => {
      setDeath(true);
      stopMovement();
    };

    const handlePlayerReborn = () => {
      setDeath(false);
    };

    socket.on(`move${playerId}`, handlePlayerMove);
    socket.on(`playerDeath${playerId}`, handlePlayerDeath);
    socket.on(`playerReborn${playerId}`, handlePlayerReborn);

    return () => {
      socket.off(`move${playerId}`, handlePlayerMove);
      socket.off(`playerDeath${playerId}`, handlePlayerDeath);
      socket.off(`playerReborn${playerId}`, handlePlayerReborn);
      stopMovement();
    };
  }, [myplayer, playerId, playerIndex, processMoveQueue, socket, stopMovement]);

  useEffect(() => {
    if (myplayer !== playerId) {
      return;
    }

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    window.scroll(pos.x - viewportWidth / 2, pos.y - viewportHeight / 2);
  }, [myplayer, playerId, pos]);

  const spritePath = buildSpritePath(direction, isWalking);
  const spriteLabel = `${isWalking ? "walking" : "standing"} ${direction}`;

  return (
    <div
      id={playerId}
      hidden={death}
      style={{
        position: "absolute",
        top: `${pos.y}px`,
        left: `${pos.x}px`,
        zIndex: 999
      }}
    >
      <img
        src={spritePath}
        alt={`Player ${spriteLabel}`}
        width={32}
        height={32}
        style={{ 
          imageRendering: "pixelated",
          objectPosition: "center",
        }}
      />
    </div>
  );
};

export default Ship;
