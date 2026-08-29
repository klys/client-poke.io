// Follower venomon sprite: the party leader walking one tile behind its
// trainer. Position comes from the server (`follower:steps`/`follower:sync`,
// mirrored by followerActors.ts) and is painted straight to the DOM in a rAF
// loop, like NpcSprite — a walking follower never re-renders the map.
//
// Charsets are the dex-numbered overworld sheets on the asset server
// (/migration_exports/characters/<dex>.png): 4x4 grids of 64x64 frames drawn
// for 32px tiles, so the sprite intentionally overflows its tile like large
// NPC sprites do. Rows follow the RMXP order (down/left/right/up).

import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../tilemap/serverAssets";
import { rowForRmxpDirection } from "./NpcSprite";
import { getFollowerCellPosition, type FollowerInfo } from "./followerActors";

const SHEET_COLS = 4;
const SHEET_ROWS = 4;
const SHEET_TILE_SIZE = 32;
const WALK_FRAME_MS = 90;

type SheetFrame = { width: number; height: number };
const sheetFrameCache = new Map<string, SheetFrame | "error">();

function useSheetFrame(sheetUrl: string): SheetFrame | "error" | null {
  const [state, setState] = useState<SheetFrame | "error" | null>(() =>
    sheetUrl ? sheetFrameCache.get(sheetUrl) ?? null : "error"
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

export default function FollowerSprite({
  follower,
  mapId,
  cellSize
}: {
  follower: FollowerInfo;
  mapId: string;
  cellSize: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);

  const sheetUrl = assetUrl(
    `/migration_exports/characters/${encodeURIComponent(follower.charset)}.png`
  );
  const sheetFrame = useSheetFrame(sheetUrl);
  const sheetReady = sheetFrame !== null && sheetFrame !== "error";
  const scale = cellSize / SHEET_TILE_SIZE;
  const frameWidth = sheetReady ? sheetFrame.width * scale : cellSize;
  const frameHeight = sheetReady ? sheetFrame.height * scale : cellSize;

  useEffect(() => {
    if (!sheetReady || follower.hidden) {
      return;
    }

    let frameId = 0;
    const paint = (now: number) => {
      frameId = requestAnimationFrame(paint);
      const boxNode = boxRef.current;
      const spriteNode = spriteRef.current;
      if (!boxNode || !spriteNode) {
        return;
      }
      const live = getFollowerCellPosition(mapId, follower.ownerId, now);
      if (!live) {
        return;
      }
      boxNode.style.transform = `translate(${live.x * cellSize}px, ${live.y * cellSize}px)`;
      const row = rowForRmxpDirection(live.facing);
      const pattern = live.moving ? Math.floor(now / WALK_FRAME_MS) % SHEET_COLS : 0;
      spriteNode.style.backgroundPosition = `${-pattern * frameWidth}px ${-row * frameHeight}px`;
    };
    frameId = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frameId);
  }, [sheetReady, follower.hidden, follower.ownerId, mapId, cellSize, frameWidth, frameHeight]);

  // No sheet for this species (or hidden while the owner surfs/dives).
  if (!sheetReady || follower.hidden) {
    return null;
  }

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        // Just under players (999): the trainer walks "in front of" their venomon.
        zIndex: 998,
        pointerEvents: "none"
      }}
    >
      {follower.emote ? (
        <div
          data-follower-emote={follower.emote.emoji}
          style={{
            position: "absolute",
            left: "50%",
            bottom: `${frameHeight + 2}px`,
            transform: "translateX(-50%)",
            minWidth: "26px",
            height: "26px",
            padding: "0 5px",
            borderRadius: "13px 13px 13px 3px",
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(17,24,39,0.35)",
            boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            lineHeight: 1,
            pointerEvents: "none",
            zIndex: 2,
            animation: "pokecraft-emote-pop 240ms ease-out"
          }}
        >
          {follower.emote.emoji}
        </div>
      ) : null}
      <div
        ref={spriteRef}
        aria-label="follower"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: `${frameWidth}px`,
          height: `${frameHeight}px`,
          transform: "translate(-50%, 0)",
          backgroundImage: `url("${sheetUrl}")`,
          backgroundSize: `${frameWidth * SHEET_COLS}px ${frameHeight * SHEET_ROWS}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}
