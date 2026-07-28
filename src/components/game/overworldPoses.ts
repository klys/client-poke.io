// Overworld traversal/pose charsets (Surf mount, fishing cast) from the
// original Venova auxiliary sheets published at
// /migration_exports/characters/. Each sheet is a classic RMXP 4x4 charset:
// rows = facing (down/left/right/up), columns = animation patterns. The surf
// sheets draw the trainer RIDING the mount, so while a pose is active the
// pose sprite replaces the walk sprite entirely (exactly how Essentials
// renders vehicles) — the mount can never lag behind the player because they
// are one image.
import { assetUrl } from "../tilemap/serverAssets";

export type OverworldPose = "surf" | "fish" | "fishsurf";

export interface PoseSheet {
  src: string;
  frameWidth: number;
  frameHeight: number;
}

type Direction = "up" | "down" | "left" | "right";

// Sheet dimensions: *_surf_offset / *_dive_offset are 264x288 (66x72 frames),
// *_fish_offset / *_fishsurf_offset are 384x320 (96x80 frames).
const POSE_SHEET_NAMES: Record<OverworldPose, { boy: string; girl: string; frameWidth: number; frameHeight: number }> = {
  surf: { boy: "boy_surf_offset", girl: "girl_surf_offset", frameWidth: 66, frameHeight: 72 },
  fish: { boy: "boy_fish_offset", girl: "girl_fish_offset", frameWidth: 96, frameHeight: 80 },
  fishsurf: { boy: "boy_fishsurf_offset", girl: "girl_fishsurf_offset", frameWidth: 96, frameHeight: 80 }
};

/** Female protagonist and feminine hand-made skins use the girl sheets;
 * everything else falls back to the boy sheets (the only art that exists). */
const FEMALE_SKIN_HINTS = ["player-b", "leaf", "chica", "girl", "enfermera", "senora", "mama"];

export function getPoseSheet(pose: OverworldPose, characterSkinId?: string): PoseSheet {
  const entry = POSE_SHEET_NAMES[pose];
  const skin = (characterSkinId ?? "").toLowerCase();
  const female = FEMALE_SKIN_HINTS.some((hint) => skin.includes(hint));
  return {
    src: assetUrl(`/migration_exports/characters/${female ? entry.girl : entry.boy}.png`),
    frameWidth: entry.frameWidth,
    frameHeight: entry.frameHeight
  };
}

/** RMXP charset row for a facing direction. */
export function poseRowForDirection(direction: Direction): number {
  switch (direction) {
    case "left":
      return 1;
    case "right":
      return 2;
    case "up":
      return 3;
    case "down":
    default:
      return 0;
  }
}
