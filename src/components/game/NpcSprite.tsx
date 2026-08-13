import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../tilemap/serverAssets";
import {
  getNpcCellPosition,
  NPC_FACE_DOWN,
  NPC_FACE_LEFT,
  NPC_FACE_RIGHT,
  NPC_FACE_UP,
} from "./npcActors";

type NpcMovement = {
  type?: number;
  speed?: number;
  frequency?: number;
  route?: { list?: Array<{ code: number; parameters?: unknown[] }>; repeat?: boolean } | null;
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

// RPG Maker graphic.direction (2/4/6/8) -> sheet row.
export function rowForRmxpDirection(direction?: number): number {
  switch (direction) {
    case NPC_FACE_LEFT:
      return ROW_LEFT;
    case NPC_FACE_RIGHT:
      return ROW_RIGHT;
    case NPC_FACE_UP:
      return ROW_UP;
    case NPC_FACE_DOWN:
    default:
      return ROW_DOWN;
  }
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
  // The tile-sized hit box is translated along with the sprite so clicks and
  // the hover title follow what the player actually sees.
  boxNode: HTMLElement;
  // Sheet mode crops frames via background-position; legacy mode is the old
  // single-image behavior (horizontal flip only).
  spriteNode: HTMLElement;
  sheet: SheetConfig | null;
  cellSize: number;
  /** Map + placement id: the key the server addresses this NPC by. */
  mapId: string;
  npcId: string;
  /** Authored tile — the box is positioned there, so paints are a delta. */
  homeX: number;
  homeY: number;
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

/**
 * Paints one NPC from the server's live state.
 *
 * There is deliberately no simulation here. This used to replay a seeded
 * random walk started at `performance.now()`, which meant two players on the
 * same map saw the same NPC on different tiles, and the server's collision
 * box never moved at all. Now the server walks the NPC and we only glide
 * between the tiles it reports (see npcActors.ts).
 */
function paintSprite(animation: SpriteAnimation, now: number) {
  const { cellSize, sheet, homeX, homeY } = animation;
  const live = getNpcCellPosition(animation.mapId, animation.npcId, now);

  if (!live) {
    // Stationary NPC (the vast majority): nothing to move. Pages flagged
    // stepAnime still animate in place — that's cosmetic and needs no sync.
    if (sheet?.stepAnime) {
      const pattern = Math.floor(now / STEP_ANIME_FRAME_MS) % SHEET_COLS;
      paintFrame(animation, sheet.idleRow, pattern);
    }
    return;
  }

  animation.boxNode.style.transform =
    `translate(${(live.x - homeX) * cellSize}px, ${(live.y - homeY) * cellSize}px)`;

  const walkRow = rowForRmxpDirection(live.facing);

  if (sheet) {
    const row = sheet.directionFix ? sheet.idleRow : walkRow;
    let pattern = sheet.idlePattern;

    if (live.moving && sheet.walkAnime) {
      // One full 4-frame walk cycle per tile.
      pattern = Math.floor(now / (STEP_ANIME_FRAME_MS / 2)) % SHEET_COLS;
    } else if (sheet.stepAnime) {
      pattern = Math.floor(now / STEP_ANIME_FRAME_MS) % SHEET_COLS;
    }

    paintFrame(animation, row, pattern);
    return;
  }

  // Legacy single-frame sprite: all we can do is mirror for left movement.
  const flip = walkRow === ROW_LEFT && live.moving ? "scaleX(-1)" : "scaleX(1)";
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
 * to the single imported preview frame.
 *
 * Position comes from the server (`npc:steps` / `npc:sync`, mirrored by
 * npcActors.ts) and is written straight to the DOM node via a shared ticker,
 * so a pacing NPC never re-renders the map and never drifts out of sync with
 * the hitbox the server collides against.
 */
export default function NpcSprite({
  npc,
  mapId,
  cellSize,
  imageSrc,
  onClick
}: {
  npc: NpcSpriteData;
  mapId: string;
  cellSize: number;
  imageSrc: string;
  onClick: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLElement | null>(null);
  const movement = npc.movement;
  const characterName = npc.graphic?.characterName ?? "";
  const sheetUrl = characterName
    ? assetUrl(`/migration_exports/characters/${encodeURIComponent(characterName)}.png`)
    : "";
  const sheetFrame = useCharacterSheet(sheetUrl);

  const initialRow = rowForRmxpDirection(npc.graphic?.direction);
  const idlePattern = Math.max(0, Math.min(SHEET_COLS - 1, npc.graphic?.pattern ?? 0));

  // Move routes commonly toggle the walk animation as their first command
  // (31 on / 32 off) rather than relying on the page flag — 491 of the 562
  // walking NPCs in the imported Venova data start their route with a 31.
  const routeCodes = movement?.route?.list ?? [];
  const walkAnime = routeCodes.some((command) => command.code === 32)
    ? false
    : routeCodes.some((command) => command.code === 31)
      ? true
      : movement?.walkAnime ?? true;
  const stepAnime = movement?.stepAnime ?? false;
  const directionFix = movement?.directionFix ?? false;

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

  // Re-register on EVERY render: the ticker then always has the live DOM
  // nodes and config, whatever React did in between.
  useEffect(() => {
    const boxNode = boxRef.current;
    const spriteNode = spriteRef.current;
    if (!boxNode || !spriteNode) {
      animationRegistry.delete(npc.id);
      return;
    }
    animationRegistry.set(npc.id, {
      boxNode,
      spriteNode,
      sheet: sheetConfig,
      cellSize,
      mapId,
      npcId: npc.id,
      homeX: npc.x,
      homeY: npc.y
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
