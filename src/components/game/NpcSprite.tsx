import { useEffect, useMemo, useRef } from "react";

type MoveRouteCommand = { code: number; parameters?: unknown[] };
type NpcMovement = {
  type?: number;
  speed?: number;
  frequency?: number;
  route?: { list?: MoveRouteCommand[]; repeat?: boolean } | null;
};

type NpcSpriteData = {
  id: string;
  name: string;
  x: number;
  y: number;
  spriteAspect?: number;
  movement?: NpcMovement;
};

// RPG Maker move-route directional codes -> cell delta.
const MOVE_DELTAS: Record<number, { dx: number; dy: number }> = {
  1: { dx: 0, dy: 1 }, // down
  2: { dx: -1, dy: 0 }, // left
  3: { dx: 1, dy: 0 }, // right
  4: { dx: 0, dy: -1 } // up
};

type Waypoint = { x: number; y: number; faceLeft: boolean; faceRight: boolean };

function buildRouteWaypoints(movement?: NpcMovement): Waypoint[] {
  if (!movement?.route?.list?.length) {
    return [];
  }
  const points: Waypoint[] = [{ x: 0, y: 0, faceLeft: false, faceRight: false }];
  let x = 0;
  let y = 0;
  for (const command of movement.route.list) {
    const delta = MOVE_DELTAS[command.code];
    if (!delta) {
      continue; // turns, waits, speed/anim toggles don't change position
    }
    x += delta.dx;
    y += delta.dy;
    points.push({ x, y, faceLeft: delta.dx < 0, faceRight: delta.dx > 0 });
  }
  // A route that never actually moves is treated as stationary.
  return points.length > 1 ? points : [];
}

/**
 * Deterministic wander loop for RMXP "random"/"approach" movers (move_type
 * 1/2): a seeded random walk inside a small radius, mirrored back to the
 * origin so the loop is seamless. Every client renders the same path.
 */
function buildRandomWaypoints(seed: string): Waypoint[] {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  const nextRandom = () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };

  const radius = 2;
  const half: Array<{ dx: number; dy: number }> = [];
  let x = 0;
  let y = 0;
  for (let step = 0; step < 6; step += 1) {
    const options = [
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ].filter((delta) => Math.abs(x + delta.dx) <= radius && Math.abs(y + delta.dy) <= radius);
    const pick = options[Math.floor(nextRandom() * options.length)] ?? { dx: 0, dy: 1 };
    x += pick.dx;
    y += pick.dy;
    half.push(pick);
  }

  const points: Waypoint[] = [{ x: 0, y: 0, faceLeft: false, faceRight: false }];
  let px = 0;
  let py = 0;
  const walk = (dx: number, dy: number) => {
    px += dx;
    py += dy;
    points.push({ x: px, y: py, faceLeft: dx < 0, faceRight: dx > 0 });
  };
  half.forEach((delta) => walk(delta.dx, delta.dy));
  // Retrace to the origin so the loop closes without teleporting.
  [...half].reverse().forEach((delta) => walk(-delta.dx, -delta.dy));
  return points;
}

type SpriteAnimation = {
  node: HTMLElement;
  waypoints: Waypoint[];
  stepMs: number;
  pauseMs: number;
  cellSize: number;
  startedAt: number;
};

// One shared rAF loop paints every pacing NPC. Components (re)register on
// every render, so remounts, cache refreshes and battle overlays can never
// strand a sprite mid-route — the ticker always reads the latest config.
const animationRegistry = new Map<string, SpriteAnimation>();
let tickerRunning = false;

function paintSprite(animation: SpriteAnimation, now: number) {
  const { waypoints, stepMs, pauseMs, cellSize, node, startedAt } = animation;
  const segmentMs = stepMs + pauseMs;
  const cycleMs = segmentMs * (waypoints.length - 1);
  if (cycleMs <= 0) {
    return;
  }
  // rAF timestamps are frame-start times and can lag the performance.now()
  // captured at registration, so the first ticks may land "before" startedAt.
  // A negative modulo made segment -1 and crashed the shared ticker.
  const elapsed = (((now - startedAt) % cycleMs) + cycleMs) % cycleMs;
  const segment = Math.min(waypoints.length - 2, Math.floor(elapsed / segmentMs));
  const withinSegment = elapsed - segment * segmentMs;
  const from = waypoints[segment];
  const to = waypoints[(segment + 1) % waypoints.length];
  const progress = Math.min(1, withinSegment / stepMs);
  const cx = from.x + (to.x - from.x) * progress;
  const cy = from.y + (to.y - from.y) * progress;
  const facing = progress < 1 ? to : from;
  const flip = facing.faceLeft ? "scaleX(-1)" : "scaleX(1)";
  node.style.transform =
    `translate(-50%, 0) translate(${cx * cellSize}px, ${cy * cellSize}px) ${flip}`;
}

function ensureTicker() {
  if (tickerRunning) {
    return;
  }
  tickerRunning = true;
  const tick = (now: number) => {
    // Schedule the next frame FIRST: a bad paint must never kill the loop
    // (a single throw here used to freeze every NPC until the next reload).
    requestAnimationFrame(tick);
    animationRegistry.forEach((animation) => {
      if (!animation.node.isConnected) {
        return;
      }
      try {
        paintSprite(animation, now);
      } catch {
        // One bad sprite must not freeze the rest.
      }
    });
  };
  requestAnimationFrame(tick);
}

/**
 * Renders an imported Venova NPC. Stationary events show a single trimmed frame;
 * events with a custom move route pace between their waypoints, and random /
 * approach movers wander a small seeded loop — mirroring the classic overworld
 * feel. Position is animated directly on the DOM node via a shared ticker so
 * pacing NPCs don't re-render the map each frame.
 */
export default function NpcSprite({
  npc,
  cellSize,
  imageSrc,
  onClick
}: {
  npc: NpcSpriteData;
  cellSize: number;
  imageSrc: string;
  onClick: () => void;
}) {
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const movement = npc.movement;
  const moveType = movement?.type ?? 0;
  // Stable primitive key so waypoints don't rebuild every render
  // (getPlayableMapById re-sanitizes npc objects, so `movement` is a fresh
  // reference each time).
  const routeKey =
    moveType === 3
      ? `route:${(movement?.route?.list ?? []).map((command) => command.code).join(",")}`
      : moveType === 1 || moveType === 2
        ? `random:${npc.id}`
        : "";
  const speed = movement?.speed ?? 3;
  const frequency = movement?.frequency ?? 3;

  const waypoints = useMemo(
    () =>
      moveType === 3
        ? buildRouteWaypoints(movement)
        : moveType === 1 || moveType === 2
          ? buildRandomWaypoints(npc.id)
          : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routeKey]
  );

  const spriteHeight = Math.round(cellSize * 1.3);
  const aspect = npc.spriteAspect ?? 0.7;
  const spriteWidth = Math.round(spriteHeight * aspect);

  const stepMs = Math.max(140, Math.round(900 / Math.max(1, speed)));
  // Random movers idle noticeably between steps, like RMXP frequency.
  const pauseMs = Math.max(0, (5 - frequency) * 120) + (moveType === 3 ? 0 : 420);

  // Re-register on EVERY render: the ticker then always has the live DOM node
  // and config, whatever React did in between. The start time is preserved so
  // pacing stays continuous.
  useEffect(() => {
    const node = spriteRef.current;
    if (!node || waypoints.length < 2) {
      animationRegistry.delete(npc.id);
      return;
    }
    const existing = animationRegistry.get(npc.id);
    animationRegistry.set(npc.id, {
      node,
      waypoints,
      stepMs,
      pauseMs,
      cellSize,
      startedAt: existing?.startedAt ?? performance.now()
    });
    ensureTicker();
  });

  useEffect(
    () => () => {
      animationRegistry.delete(npc.id);
    },
    [npc.id]
  );

  return (
    <div
      title={npc.name}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{
        position: "absolute",
        top: `${npc.y * cellSize}px`,
        left: `${npc.x * cellSize}px`,
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        zIndex: 998,
        cursor: "pointer"
      }}
    >
      <img
        ref={spriteRef}
        src={imageSrc}
        alt={npc.name}
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          transform: "translate(-50%, 0)",
          transformOrigin: "bottom center",
          width: `${spriteWidth}px`,
          height: `${spriteHeight}px`,
          imageRendering: "pixelated",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}
