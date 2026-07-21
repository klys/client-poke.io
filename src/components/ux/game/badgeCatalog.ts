/**
 * Venova ships eight gym badges (Essentials `$Trainer.badges[0..7]`). The
 * icons are sliced from the game's `badges.png` strip by
 * `server-poke.io/tools/publishBadgeSheet.py` and served from asset storage.
 * Earning is server-authoritative — gym-leader events award them and the
 * Trainer Card shows earned ones in colour, unearned ones greyed out.
 */
export type GymBadge = {
  /** 0-based index, matching the persisted badge list and the map scripts. */
  index: number;
  name: string;
  /** Root-relative asset path; resolve with resolveServerAssetUrl at RENDER
   * time — the asset origin isn't known yet when this module is first loaded. */
  iconPath: string;
};

export const GYM_BADGE_COUNT = 8;

// Display names are cosmetic; the index is the source of truth. Refine these
// as the real gym/town names are confirmed from the Venova map data.
const BADGE_NAMES = [
  "1st Gym Badge",
  "2nd Gym Badge",
  "3rd Gym Badge",
  "4th Gym Badge",
  "5th Gym Badge",
  "6th Gym Badge",
  "7th Gym Badge",
  "8th Gym Badge"
];

export const GYM_BADGES: GymBadge[] = Array.from({ length: GYM_BADGE_COUNT }, (_, index) => ({
  index,
  name: BADGE_NAMES[index] ?? `Gym Badge ${index + 1}`,
  iconPath: `/migration_exports/badges/venova/badge-${index}.png`
}));

/** Number of earned badges (Essentials `$Trainer.numbadges`). */
export function countBadges(badges: number[] | undefined | null): number {
  return Array.isArray(badges) ? badges.length : 0;
}
