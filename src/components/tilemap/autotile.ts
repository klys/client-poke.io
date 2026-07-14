import { AUTOTILE_ID_UNIT, FIRST_TILESET_TILE_ID, isAutotileId } from "./tileMapTypes";

// The 48 autotile variants. Each entry lists the four 16x16 quarter pieces
// (1-based indices into the 6x8 quarter grid of one 96x128 autotile frame)
// for the top-left, top-right, bottom-left and bottom-right corners of the
// tile. Identical to the RPG Maker XP editor/runtime layout and to the
// migration tool's MapRenderer.
export const AUTOTILE_PATTERNS: ReadonlyArray<readonly [number, number, number, number]> = [
  [27, 28, 33, 34], [5, 28, 33, 34], [27, 6, 33, 34], [5, 6, 33, 34],
  [27, 28, 33, 12], [5, 28, 33, 12], [27, 6, 33, 12], [5, 6, 33, 12],
  [27, 28, 11, 34], [5, 28, 11, 34], [27, 6, 11, 34], [5, 6, 11, 34],
  [27, 28, 11, 12], [5, 28, 11, 12], [27, 6, 11, 12], [5, 6, 11, 12],
  [25, 26, 31, 32], [25, 6, 31, 32], [25, 26, 31, 12], [25, 6, 31, 12],
  [15, 16, 21, 22], [15, 16, 21, 12], [15, 16, 11, 22], [15, 16, 11, 12],
  [29, 30, 35, 36], [29, 30, 11, 36], [5, 30, 35, 36], [5, 30, 11, 36],
  [39, 40, 45, 46], [5, 40, 45, 46], [39, 6, 45, 46], [5, 6, 45, 46],
  [25, 30, 31, 36], [15, 16, 45, 46], [13, 14, 19, 20], [13, 14, 19, 12],
  [17, 18, 23, 24], [17, 18, 11, 24], [41, 42, 47, 48], [5, 42, 47, 48],
  [37, 38, 43, 44], [37, 6, 43, 44], [13, 18, 19, 24], [13, 14, 43, 44],
  [37, 42, 43, 48], [17, 18, 47, 48], [13, 18, 43, 48], [1, 2, 7, 8],
];

/**
 * Resolves the autotile shape variant (0..47) from the eight neighbor flags
 * ("is the neighbor the same autotile"). Ported verbatim from the migration
 * tool's MapCatalog so both sides shape identically.
 */
export function autotileVariantForMask(
  n: boolean,
  e: boolean,
  s: boolean,
  w: boolean,
  nw: boolean,
  ne: boolean,
  se: boolean,
  sw: boolean
) {
  if (n && e && s && w) {
    return (nw ? 0 : 1) | (ne ? 0 : 2) | (se ? 0 : 4) | (sw ? 0 : 8);
  }
  if (!w && n && e && s) {
    return 16 + (ne ? 0 : 1) + (se ? 0 : 2);
  }
  if (!n && e && s && w) {
    return 20 + (se ? 0 : 1) + (sw ? 0 : 2);
  }
  if (!e && n && s && w) {
    return 24 + (sw ? 0 : 1) + (nw ? 0 : 2);
  }
  if (!s && n && e && w) {
    return 28 + (nw ? 0 : 1) + (ne ? 0 : 2);
  }
  if (!w && !e && n && s) {
    return 32;
  }
  if (!n && !s && e && w) {
    return 33;
  }
  if (!n && !w && e && s) {
    return 34 + (se ? 0 : 1);
  }
  if (!n && !e && s && w) {
    return 36 + (sw ? 0 : 1);
  }
  if (!s && !e && n && w) {
    return 38 + (nw ? 0 : 1);
  }
  if (!s && !w && n && e) {
    return 40 + (ne ? 0 : 1);
  }
  if (!n && !w && !e && s) {
    return 42;
  }
  if (!n && !s && !w && e) {
    return 43;
  }
  if (!s && !w && !e && n) {
    return 44;
  }
  if (!n && !s && !e && w) {
    return 45;
  }
  return 46;
}

/**
 * Recomputes autotile shape variants for every autotile cell inside the given
 * region (inclusive bounds) of one layer. Out-of-map neighbors count as
 * "same", matching RPG Maker XP.
 */
export function reshapeAutotileRegion(
  layer: Uint16Array,
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number
) {
  const safeLeft = Math.max(0, left);
  const safeTop = Math.max(0, top);
  const safeRight = Math.min(width - 1, right);
  const safeBottom = Math.min(height - 1, bottom);

  for (let y = safeTop; y <= safeBottom; y += 1) {
    for (let x = safeLeft; x <= safeRight; x += 1) {
      const tileId = layer[y * width + x];

      if (!isAutotileId(tileId)) {
        continue;
      }

      const slot = Math.floor(tileId / AUTOTILE_ID_UNIT);
      const same = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          return true;
        }

        const neighbor = layer[ny * width + nx];

        return (
          neighbor >= AUTOTILE_ID_UNIT &&
          neighbor < FIRST_TILESET_TILE_ID &&
          Math.floor(neighbor / AUTOTILE_ID_UNIT) === slot
        );
      };

      const variant = autotileVariantForMask(
        same(x, y - 1),
        same(x + 1, y),
        same(x, y + 1),
        same(x - 1, y),
        same(x - 1, y - 1),
        same(x + 1, y - 1),
        same(x + 1, y + 1),
        same(x - 1, y + 1)
      );

      layer[y * width + x] = slot * AUTOTILE_ID_UNIT + variant;
    }
  }
}
