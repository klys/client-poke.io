// Latest server-authoritative position of the local player, published by
// Player.tsx straight from the move{id} packet stream (module-level like
// pointerPosition.ts — no React state, no context re-renders).
//
// Why this exists: AppContext mirrors positions at 32px-cell granularity
// with a 200ms trailing settle (see Player.tsx dispatch throttling), which
// is fine for tile-level consumers but too stale for UserControl's drive
// loop — movement targets computed from a cell-quantized position drift
// from the server's truth and cause direction changes to overshoot or jerk.

export type LiveSelfPosition = {
  x: number;
  y: number;
  angle: number;
  currentMapId: string;
};

let liveSelfPosition: LiveSelfPosition | null = null;

export function setLiveSelfPosition(position: LiveSelfPosition) {
  liveSelfPosition = position;
}

export function getLiveSelfPosition(): LiveSelfPosition | null {
  return liveSelfPosition;
}

export function clearLiveSelfPosition() {
  liveSelfPosition = null;
}
