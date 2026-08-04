// Map-relative pointer position, kept OUT of React state on purpose: it
// updates on every pointermove, and routing it through the AppContext reducer
// re-rendered every context consumer (the whole world view) per mouse move.
// The only gameplay read is event-time (aiming the "q" projectile), so a
// mutable module store is exactly enough.

const pointer = { x: -1, y: -1 };

export function setPointerPosition(x: number, y: number): void {
  pointer.x = x;
  pointer.y = y;
}

export function getPointerPosition(): { x: number; y: number } {
  return { x: pointer.x, y: pointer.y };
}
