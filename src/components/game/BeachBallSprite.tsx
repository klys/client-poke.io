// Beach ball sprite (/pelota command). The sheet is /objects/BeachBall.png,
// a horizontal strip of 7 32x32 frames: 0-1 roll the ball, 2-6 deflate it.
// Position mirrors the server (`ball:step`/`ball:sync` via beachBalls.ts) and
// is painted in a rAF loop like followers/NPCs.

import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../tilemap/serverAssets";
import { getBallCellPosition, type BallInfo } from "./beachBalls";

const FRAME_COUNT = 7;
const ROLL_FRAMES = [0, 1];
const DEFLATE_FRAMES = [2, 3, 4, 5, 6];
const ROLL_FRAME_MS = 110;
const DEFLATE_FRAME_MS = 150;
const BALL_TILE_SIZE = 32;

export default function BeachBallSprite({
  ball,
  mapId,
  cellSize
}: {
  ball: BallInfo;
  mapId: string;
  cellSize: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const deflateStartedAtRef = useRef<number | null>(null);
  const [popFinished, setPopFinished] = useState(false);

  const sheetUrl = assetUrl("/objects/BeachBall.png");
  const scale = cellSize / BALL_TILE_SIZE;
  const frameSize = BALL_TILE_SIZE * scale;

  useEffect(() => {
    if (popFinished) {
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
      const live = getBallCellPosition(mapId, ball.id, now);
      if (live) {
        boxNode.style.transform = `translate(${live.x * cellSize}px, ${live.y * cellSize}px)`;
        // Wall rebound: the ball arcs over the pusher's head back behind them.
        // While airborne it draws above players (999) and foreground (1200).
        spriteNode.style.transform = live.bounceArc > 0
          ? `translateY(${-live.bounceArc * cellSize * 0.9}px)`
          : "";
        boxNode.style.zIndex = live.bounceArc > 0 ? "1210" : "998";
      }

      let frame: number;

      if (ball.deflated) {
        if (deflateStartedAtRef.current === null) {
          deflateStartedAtRef.current = now;
        }
        const index = Math.floor((now - deflateStartedAtRef.current) / DEFLATE_FRAME_MS);
        if (index >= DEFLATE_FRAMES.length) {
          setPopFinished(true);
          return;
        }
        frame = DEFLATE_FRAMES[index];
      } else if (live?.moving) {
        frame = ROLL_FRAMES[Math.floor(now / ROLL_FRAME_MS) % ROLL_FRAMES.length];
      } else {
        frame = 0;
      }

      spriteNode.style.backgroundPosition = `${-frame * frameSize}px 0px`;
    };
    frameId = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frameId);
  }, [ball.id, ball.deflated, mapId, cellSize, frameSize, popFinished]);

  if (popFinished) {
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
        zIndex: 998,
        pointerEvents: "none"
      }}
    >
      <div
        ref={spriteRef}
        aria-label="beach ball"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: `${frameSize}px`,
          height: `${frameSize}px`,
          backgroundImage: `url("${sheetUrl}")`,
          backgroundSize: `${frameSize * FRAME_COUNT}px ${frameSize}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}
