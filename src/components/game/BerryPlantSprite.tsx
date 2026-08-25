// A global berry plot on the map. Renders the original Venova charsets:
// `berrytreeplanted.png` (just planted) or `berrytree<BERRYID>.png`, a 4x4
// RPG Maker sheet whose ROWS are the growth stages (down = sprouted,
// left = taller, right = flowering, up = ripe) and whose columns sway in
// place (step_anime). Stage is recomputed against the server clock on every
// animation tick, so a plant visibly advances while you stand next to it.
// Empty soil is an invisible hover/click target so the patch is discoverable.

import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../tilemap/serverAssets";
import { useT } from "../../i18n";
import { berryMsUntilRipe, berryStage, formatBerryCountdown, type BerryPlot } from "./berryPlots";

const SHEET_COLS = 4;
const SHEET_ROWS = 4;
const SHEET_TILE_SIZE = 32;
const STEP_ANIME_FRAME_MS = 180;

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

/** Sheet + row for a growth stage (1..5). */
export function berrySheetForStage(berryId: string, stage: number): { sheet: string; row: number } {
  if (stage <= 1) return { sheet: "berrytreeplanted", row: 0 };
  return { sheet: `berrytree${berryId}`, row: Math.max(0, Math.min(3, stage - 2)) };
}

export default function BerryPlantSprite({
  plot,
  cellSize
}: {
  plot: BerryPlot;
  cellSize: number;
}) {
  const t = useT();
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState(() => berryStage(plot));
  const [, setTick] = useState(0);

  // Stage clock: cheap timer that also drives the idle sway frame.
  useEffect(() => {
    if (!plot.berryId) {
      setStage(0);
      return undefined;
    }
    setStage(berryStage(plot));
    const id = window.setInterval(() => {
      setStage((prev) => {
        const next = berryStage(plot);
        return next !== prev ? next : prev;
      });
      // Refresh the hover countdown roughly once a second.
      setTick((value) => (value + 1) % 1000);
    }, 1000);
    return () => window.clearInterval(id);
  }, [plot]);

  const visual = plot.berryId && stage > 0 ? berrySheetForStage(plot.berryId, stage) : null;
  const sheetUrl = visual
    ? assetUrl(`/migration_exports/characters/${encodeURIComponent(visual.sheet)}.png`)
    : "";
  const sheetFrame = useSheetFrame(sheetUrl);
  const ready = visual !== null && sheetFrame !== null && sheetFrame !== "error";
  const scale = cellSize / SHEET_TILE_SIZE;
  const frameWidth = ready ? (sheetFrame as SheetFrame).width * scale : cellSize;
  const frameHeight = ready ? (sheetFrame as SheetFrame).height * scale : cellSize;
  const row = visual?.row ?? 0;

  // Sway animation: paint straight to the DOM (no re-render per frame).
  useEffect(() => {
    if (!ready) return undefined;
    let frameId = 0;
    const paint = (now: number) => {
      frameId = requestAnimationFrame(paint);
      const node = spriteRef.current;
      if (!node) return;
      const pattern = Math.floor(now / STEP_ANIME_FRAME_MS) % SHEET_COLS;
      node.style.backgroundPosition = `${-pattern * frameWidth}px ${-row * frameHeight}px`;
    };
    frameId = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frameId);
  }, [ready, frameWidth, frameHeight, row]);

  const title = !plot.berryId
    ? t("berry.emptySoil")
    : stage >= 5
      ? t("berry.ripeTitle", { name: plot.berryId })
      : t("berry.growingTitle", {
          stage: t(`berry.stage.${stage}`),
          remaining: formatBerryCountdown(berryMsUntilRipe(plot))
        });

  return (
    <div
      title={title}
      data-berry-plot={plot.id}
      data-berry-stage={String(stage)}
      style={{
        position: "absolute",
        top: `${plot.y * cellSize}px`,
        left: `${plot.x * cellSize}px`,
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        zIndex: 998,
        cursor: "pointer"
      }}
    >
      {ready ? (
        <div
          ref={spriteRef}
          aria-label={title}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            transform: "translate(-50%, 0)",
            backgroundImage: `url("${sheetUrl}")`,
            backgroundSize: `${frameWidth * SHEET_COLS}px ${frameHeight * SHEET_ROWS}px`,
            backgroundPosition: `0px ${-row * frameHeight}px`,
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
            pointerEvents: "none"
          }}
        />
      ) : null}
    </div>
  );
}
