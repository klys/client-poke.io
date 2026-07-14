import { Box } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { ResolvedSkillGfx } from "./skillGfx";

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
  const isSheet = gfx.animationKind === "sheet" && gfx.frameCount > 1;

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
      transform: "scale(1.2)",
      transformOrigin: "center"
    };
  }, [isSheet, frame, gfx]);

  return (
    <Box
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
          style={{
            maxWidth: "80%",
            maxHeight: "90%",
            imageRendering: "pixelated",
            objectFit: "contain"
          }}
        />
      )}
    </Box>
  );
}
