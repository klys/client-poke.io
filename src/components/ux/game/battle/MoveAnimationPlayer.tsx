import { Box } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedSkillGfx } from "./skillGfx";

// Effects are authored at small fixed sizes (192px sheet cells, ~220px GIF
// records), so on a large screen they used to look tiny next to
// viewport-scaled battlers. Scale them to cover this fraction of the battler
// slot instead, clamped so effects never collapse on tiny slots nor blow up
// past readable pixel-art sizes.
const EFFECT_SLOT_COVERAGE = 1.1;
const MIN_EFFECT_SCALE = 0.75;
const MAX_EFFECT_SCALE = 4;

function useSlotSize(ref: React.RefObject<HTMLDivElement>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * Plays a migrated move-effect animation over a battler slot. Rendered GIF
 * records play as-is; sprite sheets are stepped frame by frame via
 * background-position.
 */
export default function MoveAnimationPlayer({
  gfx,
  animationSpeed,
  onFinished
}: {
  gfx: ResolvedSkillGfx;
  animationSpeed: number;
  onFinished: () => void;
}) {
  const durationMs = Math.max(120, gfx.durationMs / Math.max(0.25, animationSpeed));
  const [frame, setFrame] = useState(0);
  const [recordNaturalSize, setRecordNaturalSize] = useState<number | null>(null);
  const isSheet = gfx.animationKind === "sheet" && gfx.frameCount > 1;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const slotSize = useSlotSize(wrapperRef);

  useEffect(() => {
    const timeout = window.setTimeout(onFinished, durationMs + 80);
    return () => window.clearTimeout(timeout);
  }, [durationMs, onFinished]);

  useEffect(() => {
    if (!isSheet) {
      return;
    }

    const frameDuration = durationMs / gfx.frameCount;
    const interval = window.setInterval(() => {
      setFrame((current) => Math.min(gfx.frameCount - 1, current + 1));
    }, Math.max(16, frameDuration));

    return () => window.clearInterval(interval);
  }, [isSheet, durationMs, gfx.frameCount]);

  const scaleForSourceSize = (sourceSize: number) => {
    if (!slotSize || slotSize.width <= 0) {
      return 1.2;
    }

    const targetSize = Math.min(slotSize.width, Math.max(slotSize.height, slotSize.width * 0.6));
    const scale = (targetSize * EFFECT_SLOT_COVERAGE) / sourceSize;
    return Math.min(MAX_EFFECT_SCALE, Math.max(MIN_EFFECT_SCALE, scale));
  };

  const effectScale = useMemo(
    () => scaleForSourceSize(gfx.cellSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotSize, gfx.cellSize]
  );

  // GIF records render at their natural pixel size (often ~200px), which
  // looked tiny over a large battler slot — scale them like sheet cells.
  const recordScale = useMemo(
    () => (recordNaturalSize ? scaleForSourceSize(recordNaturalSize) : 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotSize, recordNaturalSize]
  );

  const sheetStyle = useMemo(() => {
    if (!isSheet) {
      return null;
    }

    const column = frame % gfx.columns;
    const row = Math.floor(frame / gfx.columns);
    return {
      width: `${gfx.cellSize}px`,
      height: `${gfx.cellSize}px`,
      backgroundImage: `url(${gfx.mediaSrc})`,
      backgroundPosition: `-${column * gfx.cellSize}px -${row * gfx.cellSize}px`,
      backgroundRepeat: "no-repeat" as const,
      imageRendering: "pixelated" as const,
      transform: `scale(${effectScale})`,
      transformOrigin: "center"
    };
  }, [isSheet, frame, gfx, effectScale]);

  return (
    <Box
      ref={wrapperRef}
      position="absolute"
      inset={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
      zIndex={5}
    >
      {isSheet && sheetStyle ? (
        <Box style={sheetStyle} />
      ) : (
        <img
          src={gfx.mediaSrc}
          alt=""
          onLoad={(event) => {
            const image = event.currentTarget;
            const size = Math.max(image.naturalWidth, image.naturalHeight);
            if (size > 0) {
              setRecordNaturalSize(size);
            }
          }}
          style={{
            imageRendering: "pixelated",
            objectFit: "contain",
            // Hidden until the natural size is known so the GIF never flashes
            // at its unscaled (tiny) size for a frame.
            opacity: recordNaturalSize ? 1 : 0,
            transform: `scale(${recordScale})`,
            transformOrigin: "center"
          }}
        />
      )}
    </Box>
  );
}
