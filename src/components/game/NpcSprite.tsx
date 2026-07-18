import { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "../tilemap/serverAssets";

type MoveRouteCommand = { code: number; parameters?: unknown[] };
type NpcMovement = {
  type?: number;
  speed?: number;
  frequency?: number;
  route?: { list?: MoveRouteCommand[]; repeat?: boolean } | null;
  walkAnime?: boolean;
  stepAnime?: boolean;
  directionFix?: boolean;
  alwaysOnTop?: boolean;
};

type NpcGraphic = {
  characterName?: string;
  direction?: number;
  pattern?: number;
};

type NpcSpriteData = {
  id: string;
  name: string;
  x: number;
  y: number;
  spriteAspect?: number;
  movement?: NpcMovement;
  graphic?: NpcGraphic;
};

// Facing rows in an RPG Maker XP 4x4 character sheet, top to bottom.
const ROW_DOWN = 0;
const ROW_LEFT = 1;
const ROW_RIGHT = 2;
const ROW_UP = 3;
const SHEET_COLS = 4;
const SHEET_ROWS = 4;
// The sheets are drawn for 32px tiles; other cell sizes scale proportionally.
const SHEET_TILE_SIZE = 32;
// Frame hold for in-place animation (stepAnime), matching the classic cadence.
const STEP_ANIME_FRAME_MS = 180;

// RPG Maker move-route directional codes -> cell delta (row = code - 1).
const MOVE_DELTAS: Record<number, { dx: number; dy: number }> = {
  1: { dx: 0, dy: 1 }, // down
  2: { dx: -1, dy: 0 }, // left
  3: { dx: 1, dy: 0 }, // right
  4: { dx: 0, dy: -1 } // up
};

// RPG Maker "turn" codes -> facing row (no movement).
const TURN_ROWS: Record<number, number> = {
  16: ROW_DOWN,
  17: ROW_LEFT,
  18: ROW_RIGHT,
  19: ROW_UP
};

// RPG Maker graphic.direction (2/4/6/8) -> sheet row.
export function rowForRmxpDirection(direction?: number): number {
  switch (direction) {
    case 4:
      return ROW_LEFT;
    case 6:
      return ROW_RIGHT;
    case 8:
      return ROW_UP;
    case 2:
    default:
      return ROW_DOWN;
  }
}

function rowForDelta(dx: number, dy: number, fallback: number): number {
  if (dy > 0) return ROW_DOWN;
  if (dy < 0) return ROW_UP;
  if (dx < 0) return ROW_LEFT;
  if (dx > 0) return ROW_RIGHT;
  return fallback;
}

/**
 * A point on the walk loop. `row` is the facing while walking INTO this
 * waypoint (and while pausing on it), so the sprite keeps looking where it
 * just went instead of snapping back between steps.
 */
type Waypoint = { x: number; y: number; row: number };

function buildRouteWaypoints(movement: NpcMovement | undefined, initialRow: number): Waypoint[] {
  if (!movement?.route?.list?.length) {
    return [];
  }
  const points: Waypoint[] = [{ x: 0, y: 0, row: initialRow }];
  let x = 0;
  let y = 0;
  let row = initialRow;
  for (const command of movement.route.list) {
    const delta = MOVE_DELTAS[command.code];
    if (delta) {
      x += delta.dx;
      y += delta.dy;
      row = rowForDelta(delta.dx, delta.dy, row);
      points.push({ x, y, row });
      continue;
    }
    const turnRow = TURN_ROWS[command.code];
    if (turnRow !== undefined) {
      row = turnRow;
      points.push({ x, y, row });
    }
    // waits, speed/anim toggles, etc. don't change position or facing here
  }
  // A repeating route that doesn't end where it started would teleport on
  // wrap (the original game lets it drift into walls instead, which we can't
  // collision-check client-side). Retrace the steps backwards so the loop
  // closes while only crossing tiles the route already walked.
  if ((x !== 0 || y !== 0) && movement.route.repeat !== false) {
    const forward = points.slice(1);
    for (let index = forward.length - 1; index >= 1; index -= 1) {
      const to = points[index];
      const from = points[index + 1];
      points.push({
        x: to.x,
        y: to.y,
        row: rowForDelta(to.x - from.x, to.y - from.y, to.row)
      });
    }
    points.push({
      x: 0,
      y: 0,
      row: rowForDelta(-points[1].x, -points[1].y, initialRow)
    });
  }
  // A route that never actually moves or turns is treated as stationary.
  return points.length > 1 ? points : [];
}

/**
 * Deterministic wander loop for RMXP "random"/"approach" movers (move_type
 * 1/2): a seeded random walk inside a small radius, mirrored back to the
 * origin so the loop is seamless. Every client renders the same path.
 */
function buildRandomWaypoints(seed: string, initialRow: number): Waypoint[] {
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

  const points: Waypoint[] = [{ x: 0, y: 0, row: initialRow }];
  let px = 0;
  let py = 0;
  const walk = (dx: number, dy: number) => {
    px += dx;
    py += dy;
    points.push({ x: px, y: py, row: rowForDelta(dx, dy, initialRow) });
  };
  half.forEach((delta) => walk(delta.dx, delta.dy));
  // Retrace to the origin so the loop closes without teleporting.
  [...half].reverse().forEach((delta) => walk(-delta.dx, -delta.dy));
  return points;
}

type SheetConfig = {
  // Scaled to CSS pixels for the current cell size.
  frameWidth: number;
  frameHeight: number;
  walkAnime: boolean;
  stepAnime: boolean;
  directionFix: boolean;
  idleRow: number;
  idlePattern: number;
};

type SpriteAnimation = {
  // The tile-sized hit box is translated along the route so clicks and the
  // hover title follow the visible sprite.
  boxNode: HTMLElement;
  // Sheet mode crops frames via background-position; legacy mode is the old
  // single-image behavior (horizontal flip only).
  spriteNode: HTMLElement;
  sheet: SheetConfig | null;
  waypoints: Waypoint[];
  loop: boolean;
  stepMs: number;
  pauseMs: number;
  cellSize: number;
  startedAt: number;
};

// One shared rAF loop paints every animated NPC. Components (re)register on
// every render, so remounts, cache refreshes and battle overlays can never
// strand a sprite mid-route — the ticker always reads the latest config.
const animationRegistry = new Map<string, SpriteAnimation>();
let tickerRunning = false;

function paintFrame(animation: SpriteAnimation, row: number, pattern: number) {
  const sheet = animation.sheet;
  if (!sheet) {
    return;
  }
  animation.spriteNode.style.backgroundPosition =
    `${-pattern * sheet.frameWidth}px ${-row * sheet.frameHeight}px`;
}

function paintSprite(animation: SpriteAnimation, now: number) {
  const { waypoints, stepMs, pauseMs, cellSize, sheet, startedAt, loop } = animation;

  if (waypoints.length < 2) {
    // Stationary sprite registered only for its in-place animation.
    if (sheet?.stepAnime) {
      const pattern = Math.floor(now / STEP_ANIME_FRAME_MS) % SHEET_COLS;
      paintFrame(animation, sheet.idleRow, pattern);
    }
    return;
  }

  const segmentMs = stepMs + pauseMs;
  const cycleMs = segmentMs * (waypoints.length - 1);
  if (cycleMs <= 0) {
    return;
  }
  // rAF timestamps are frame-start times and can lag the performance.now()
  // captured at registration, so the first ticks may land "before" startedAt.
  // A negative modulo made segment -1 and crashed the shared ticker.
  let elapsed = (((now - startedAt) % cycleMs) + cycleMs) % cycleMs;
  if (!loop && now - startedAt >= cycleMs) {
    elapsed = cycleMs - 1; // walk the route once, then rest at the end
  }
  const segment = Math.min(waypoints.length - 2, Math.floor(elapsed / segmentMs));
  const withinSegment = elapsed - segment * segmentMs;
  const from = waypoints[segment];
  const to = waypoints[segment + 1];
  const progress = Math.min(1, withinSegment / stepMs);
  const cx = from.x + (to.x - from.x) * progress;
  const cy = from.y + (to.y - from.y) * progress;
  const stepping = progress < 1 && (to.x !== from.x || to.y !== from.y);

  animation.boxNode.style.transform = `translate(${cx * cellSize}px, ${cy * cellSize}px)`;

  if (sheet) {
    const row = sheet.directionFix ? sheet.idleRow : to.row;
    let pattern = sheet.idlePattern;
    if (stepping && sheet.walkAnime) {
      // One full 4-frame walk cycle per tile, continuous across steps.
      pattern = Math.floor(elapsed / (stepMs / SHEET_COLS)) % SHEET_COLS;
    } else if (!stepping && sheet.stepAnime) {
      pattern = Math.floor(now / STEP_ANIME_FRAME_MS) % SHEET_COLS;
    } else if (stepping && sheet.stepAnime && !sheet.walkAnime) {
      pattern = Math.floor(now / STEP_ANIME_FRAME_MS) % SHEET_COLS;
    }
    paintFrame(animation, row, pattern);
    return;
  }

  // Legacy single-frame sprite: all we can do is mirror for left movement.
  const flip = to.row === ROW_LEFT && stepping ? "scaleX(-1)" : "scaleX(1)";
  animation.spriteNode.style.transform = `translate(-50%, 0) ${flip}`;
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
      if (!animation.boxNode.isConnected) {
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

/** Natural frame size of a loaded 4x4 character sheet, in source pixels. */
type SheetFrame = { width: number; height: number };
const sheetFrameCache = new Map<string, SheetFrame | "error">();

function useCharacterSheet(sheetUrl: string): SheetFrame | "error" | null {
  const [state, setState] = useState<SheetFrame | "error" | null>(
    () => (sheetUrl ? sheetFrameCache.get(sheetUrl) ?? null : "error")
  );

  useEffect(() => {
    if (!sheetUrl) {
      setState("error");
      return;
    }
    const cached = sheetFrameCache.get(sheetUrl);
    if (cached !== undefined) {
      setState(cached);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const frame: SheetFrame = {
        width: Math.max(1, Math.floor(image.naturalWidth / SHEET_COLS)),
        height: Math.max(1, Math.floor(image.naturalHeight / SHEET_ROWS))
      };
      sheetFrameCache.set(sheetUrl, frame);
      if (!cancelled) setState(frame);
    };
    image.onerror = () => {
      sheetFrameCache.set(sheetUrl, "error");
      if (!cancelled) setState("error");
    };
    image.src = sheetUrl;
    return () => {
      cancelled = true;
    };
  }, [sheetUrl]);

  return state;
}

/**
 * Renders an imported Venova NPC / overworld venomon.
 *
 * When the event page's character sheet is published on the asset server
 * (/migration_exports/characters/<name>.png) the sprite is cropped live from
 * the 4x4 sheet: facing follows the walk direction (all four rows, not just a
 * horizontal flip), walking plays the 4-frame cycle, stepAnime pages animate
 * in place, and directionFix pages never turn. Without a sheet it falls back
 * to the single imported preview frame. Position is animated directly on the
 * DOM nodes via a shared ticker so pacing NPCs don't re-render the map each
 * frame.
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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLElement | null>(null);
  const movement = npc.movement;
  const moveType = movement?.type ?? 0;
  const characterName = npc.graphic?.characterName ?? "";
  const sheetUrl = characterName
    ? assetUrl(`/migration_exports/characters/${encodeURIComponent(characterName)}.png`)
    : "";
  const sheetFrame = useCharacterSheet(sheetUrl);

  const initialRow = rowForRmxpDirection(npc.graphic?.direction);
  const idlePattern = Math.max(0, Math.min(SHEET_COLS - 1, npc.graphic?.pattern ?? 0));

  // Stable primitive key so waypoints don't rebuild every render
  // (getPlayableMapById re-sanitizes npc objects, so `movement` is a fresh
  // reference each time).
  const routeKey =
    moveType === 3
      ? `route:${initialRow}:${(movement?.route?.list ?? [])
          .map((command) => command.code)
          .join(",")}:${movement?.route?.repeat === false ? "once" : "loop"}`
      : moveType === 1 || moveType === 2
        ? `random:${initialRow}:${npc.id}`
        : `still:${initialRow}`;
  const speed = movement?.speed ?? 3;
  const frequency = movement?.frequency ?? 3;

  const waypoints = useMemo(
    () =>
      moveType === 3
        ? buildRouteWaypoints(movement, initialRow)
        : moveType === 1 || moveType === 2
          ? buildRandomWaypoints(npc.id, initialRow)
          : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routeKey]
  );

  // RMXP pages carry walk/step anim flags; routes commonly re-enable the walk
  // animation via command 31 (or disable it via 32) as their first step.
  const routeCodes = movement?.route?.list ?? [];
  const walkAnime = routeCodes.some((command) => command.code === 32)
    ? false
    : routeCodes.some((command) => command.code === 31)
      ? true
      : movement?.walkAnime ?? true;
  const stepAnime = movement?.stepAnime ?? false;
  const directionFix = movement?.directionFix ?? false;

  const stepMs = Math.max(140, Math.round(900 / Math.max(1, speed)));
  // Random movers idle noticeably between steps, like RMXP frequency.
  const pauseMs = Math.max(0, (5 - frequency) * 120) + (moveType === 3 ? 0 : 420);

  const sheetReady = sheetFrame !== null && sheetFrame !== "error";
  const sheetScale = cellSize / SHEET_TILE_SIZE;
  const sheetConfig: SheetConfig | null = sheetReady
    ? {
        frameWidth: sheetFrame.width * sheetScale,
        frameHeight: sheetFrame.height * sheetScale,
        walkAnime,
        stepAnime,
        directionFix,
        idleRow: initialRow,
        idlePattern
      }
    : null;

  // Legacy fallback sizing (single preview frame of unknown proportions).
  const legacyHeight = Math.round(cellSize * 1.3);
  const legacyAspect = npc.spriteAspect ?? 0.7;
  const legacyWidth = Math.round(legacyHeight * legacyAspect);

  const animated = waypoints.length >= 2 || Boolean(sheetConfig?.stepAnime);

  // Re-register on EVERY render: the ticker then always has the live DOM
  // nodes and config, whatever React did in between. The start time is
  // preserved so pacing stays continuous.
  useEffect(() => {
    const boxNode = boxRef.current;
    const spriteNode = spriteRef.current;
    if (!boxNode || !spriteNode || !animated) {
      animationRegistry.delete(npc.id);
      return;
    }
    const existing = animationRegistry.get(npc.id);
    animationRegistry.set(npc.id, {
      boxNode,
      spriteNode,
      sheet: sheetConfig,
      waypoints,
      loop: movement?.route?.repeat !== false,
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
      ref={boxRef}
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
        zIndex: movement?.alwaysOnTop ? 1250 : 998,
        cursor: "pointer"
      }}
    >
      {sheetConfig ? (
        <div
          ref={(node) => {
            spriteRef.current = node;
          }}
          aria-label={npc.name}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            width: `${sheetConfig.frameWidth}px`,
            height: `${sheetConfig.frameHeight}px`,
            transform: "translate(-50%, 0)",
            backgroundImage: `url("${sheetUrl}")`,
            backgroundSize: `${sheetConfig.frameWidth * SHEET_COLS}px ${sheetConfig.frameHeight * SHEET_ROWS}px`,
            backgroundPosition: `${-idlePattern * sheetConfig.frameWidth}px ${-initialRow * sheetConfig.frameHeight}px`,
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
            pointerEvents: "none"
          }}
        />
      ) : (
        <img
          ref={(node) => {
            spriteRef.current = node;
          }}
          src={imageSrc}
          alt={npc.name}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: "translate(-50%, 0)",
            transformOrigin: "bottom center",
            width: `${legacyWidth}px`,
            height: `${legacyHeight}px`,
            imageRendering: "pixelated",
            pointerEvents: "none"
          }}
        />
      )}
    </div>
  );
}
