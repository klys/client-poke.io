// Viewport camera: the game world (#camera-world) is translated inside a
// fixed, black, overflow-hidden viewport. Small maps are centered (black
// letterboxing around them); larger maps follow the player, clamped to the
// map edges like a classic top-down Pokemon camera.

const PLAYER_HALF = 16;

let lastFocusX: number | null = null;
let lastFocusY: number | null = null;

function computeAxisOffset(viewportSize: number, worldSize: number, focus: number) {
  if (worldSize <= viewportSize) {
    return (viewportSize - worldSize) / 2;
  }

  return Math.min(0, Math.max(viewportSize - worldSize, viewportSize / 2 - focus));
}

export function applyCameraToPosition(playerX: number, playerY: number) {
  lastFocusX = playerX + PLAYER_HALF;
  lastFocusY = playerY + PLAYER_HALF;
  reapplyCamera();
}

export function reapplyCamera() {
  if (lastFocusX === null || lastFocusY === null) {
    return;
  }

  const world = document.getElementById("camera-world");
  const map = document.getElementById("map");

  if (!world || !map) {
    return;
  }

  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const offsetX = computeAxisOffset(viewportWidth, map.offsetWidth, lastFocusX);
  const offsetY = computeAxisOffset(viewportHeight, map.offsetHeight, lastFocusY);

  world.style.transform = `translate3d(${Math.round(offsetX)}px, ${Math.round(offsetY)}px, 0)`;
}

export function resetCamera() {
  lastFocusX = null;
  lastFocusY = null;
}
