// Viewport camera: the game world (#camera-world) is translated inside a
// fixed, black, overflow-hidden viewport. Small maps are centered (black
// letterboxing around them); larger maps follow the player, clamped to the
// map edges like a classic top-down Pokemon camera.
//
// The camera does NOT track the player 1:1. applyCameraToPosition only moves
// the *target* focus; a rAF loop eases the rendered focus toward it with an
// exponential smoothing curve, so direction changes, turn corrections and
// packet jitter never reach the viewport as sharp jumps. Teleports and map
// switches go through snapCameraToPosition, which bypasses the easing.

const PLAYER_HALF = 16;

// Time constant of the exponential follow (ms). The camera closes ~63% of
// its remaining distance to the player every TAU; higher = floatier, lower =
// stiffer. While walking (143px/s) the player leads the viewport centre by
// roughly speed * TAU/1000 ≈ 13px, which reads as a soft follow, not lag.
const CAMERA_SMOOTH_TAU_MS = 90;

// If the target ever gets this far from the rendered focus (a teleport that
// skipped snapCameraToPosition), jump instead of panning across the map.
const CAMERA_SNAP_DISTANCE_PX = 480;

// Below this remaining distance the follow is considered settled.
const CAMERA_SETTLE_EPSILON_PX = 0.1;

let targetFocusX: number | null = null;
let targetFocusY: number | null = null;
let renderedFocusX: number | null = null;
let renderedFocusY: number | null = null;
let followFrame: number | null = null;
let lastFrameTime: number | null = null;

function computeAxisOffset(viewportSize: number, worldSize: number, focus: number) {
  if (worldSize <= viewportSize) {
    return (viewportSize - worldSize) / 2;
  }

  return Math.min(0, Math.max(viewportSize - worldSize, viewportSize / 2 - focus));
}

// Writes the transform for the current rendered focus. Offsets are rounded
// to *device* pixels (not CSS pixels) so the smoothed follow stays visually
// continuous on high-DPI screens without shimmering the pixel art.
function writeCamera() {
  if (renderedFocusX === null || renderedFocusY === null) {
    return;
  }

  const world = document.getElementById("camera-world");
  const map = document.getElementById("map");

  if (!world || !map) {
    return;
  }

  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const offsetX = computeAxisOffset(viewportWidth, map.offsetWidth, renderedFocusX);
  const offsetY = computeAxisOffset(viewportHeight, map.offsetHeight, renderedFocusY);
  const dpr = window.devicePixelRatio || 1;

  world.style.transform = `translate3d(${Math.round(offsetX * dpr) / dpr}px, ${
    Math.round(offsetY * dpr) / dpr
  }px, 0)`;
}

function stopFollowLoop() {
  if (followFrame !== null) {
    cancelAnimationFrame(followFrame);
    followFrame = null;
  }
  lastFrameTime = null;
}

function followStep(now: number) {
  followFrame = null;

  if (
    targetFocusX === null ||
    targetFocusY === null ||
    renderedFocusX === null ||
    renderedFocusY === null
  ) {
    lastFrameTime = null;
    return;
  }

  const dt = lastFrameTime === null ? 16 : Math.min(100, now - lastFrameTime);
  lastFrameTime = now;

  const dx = targetFocusX - renderedFocusX;
  const dy = targetFocusY - renderedFocusY;
  const distance = Math.hypot(dx, dy);

  if (distance > CAMERA_SNAP_DISTANCE_PX || distance <= CAMERA_SETTLE_EPSILON_PX) {
    renderedFocusX = targetFocusX;
    renderedFocusY = targetFocusY;
    writeCamera();
    lastFrameTime = null;
    return;
  }

  // Frame-rate independent exponential approach.
  const blend = 1 - Math.exp(-dt / CAMERA_SMOOTH_TAU_MS);
  renderedFocusX += dx * blend;
  renderedFocusY += dy * blend;
  writeCamera();

  followFrame = requestAnimationFrame(followStep);
}

function ensureFollowLoop() {
  if (followFrame === null) {
    followFrame = requestAnimationFrame(followStep);
  }
}

/** Smoothly steer the camera toward the player. Call as often as you like
 * (it is driven per animation frame from the player tween); the easing loop
 * owns the actual viewport writes. */
export function applyCameraToPosition(playerX: number, playerY: number) {
  targetFocusX = playerX + PLAYER_HALF;
  targetFocusY = playerY + PLAYER_HALF;

  if (renderedFocusX === null || renderedFocusY === null) {
    renderedFocusX = targetFocusX;
    renderedFocusY = targetFocusY;
    writeCamera();
    return;
  }

  ensureFollowLoop();
}

/** Hard-place the camera (login, teleport, map switch): no easing, no pan. */
export function snapCameraToPosition(playerX: number, playerY: number) {
  stopFollowLoop();
  targetFocusX = playerX + PLAYER_HALF;
  targetFocusY = playerY + PLAYER_HALF;
  renderedFocusX = targetFocusX;
  renderedFocusY = targetFocusY;
  writeCamera();
}

/** Re-derive offsets for the current focus (viewport resize, map remount). */
export function reapplyCamera() {
  writeCamera();
}

export function resetCamera() {
  stopFollowLoop();
  targetFocusX = null;
  targetFocusY = null;
  renderedFocusX = null;
  renderedFocusY = null;
}
