import { useEffect, useState } from "react";

type Mode = "cell" | "center";

interface CursorGridOverlayProps {
  gridSize?: number;
  squareSize?: number;
  color?: string;
  borderWidth?: number;
  offsetX?: number;
  offsetY?: number;
  mode?: Mode;
  hideWhenIdle?: boolean;
  idleDelay?: number;
  zIndex?: number;
}

interface PositionState {
  x: number;
  y: number;
  visible: boolean;
}

export default function Cursor({
  gridSize = 32,
  squareSize = 32,
  color = "lime",
  borderWidth = 2,
  offsetX = 0,
  offsetY = 0,
  mode = "cell",
  hideWhenIdle = false,
  idleDelay = 1000,
  zIndex = 9999,
}: CursorGridOverlayProps) {
  const [pos, setPos] = useState<PositionState>({
    x: 0,
    y: 0,
    visible: true,
  });

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const hide = () => {
      setPos((p) => ({ ...p, visible: false }));
    };

    const show = () => {
      setPos((p) => ({ ...p, visible: true }));
    };

    const onPointerMove = (e: PointerEvent) => {
      const snappedX = Math.floor(e.pageX / gridSize) * gridSize;
      const snappedY = Math.floor(e.pageY / gridSize) * gridSize;

      let x = snappedX;
      let y = snappedY;

      if (mode === "center") {
        x = snappedX + gridSize / 2 - squareSize / 2;
        y = snappedY + gridSize / 2 - squareSize / 2;
      }

      setPos({
        x: x + offsetX,
        y: y + offsetY,
        visible: true,
      });

      if (hideWhenIdle) {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(hide, idleDelay);
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      // Detect leaving window
      if (e.relatedTarget === null) {
        hide();
      }
    };

    const onMouseOver = () => {
      show();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("mouseout", onMouseOut);
    window.addEventListener("mouseover", onMouseOver);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("mouseover", onMouseOver);
    };
  }, [
    gridSize,
    squareSize,
    offsetX,
    offsetY,
    mode,
    hideWhenIdle,
    idleDelay,
  ]);

  if (!pos.visible) return null;

  return (<>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: squareSize,
        height: squareSize,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        border: `${borderWidth}px solid ${color}`,
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex,
      }}
    />
    <div
      style={{
        position:"absolute",
        left:0,
        top:0,
      }}
    >X{pos.x}/Y{pos.y}</div>
    </>
  );
}
