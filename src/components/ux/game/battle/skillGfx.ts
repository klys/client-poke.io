import { readStoredDesignerSectionPayload } from "../../../designer/designerCache";
import { resolveServerAssetUrl } from "../../../tilemap/serverAssets";
import type { DesignerSkillGfxProfile } from "../../../designer/designerSections";

export type ResolvedSkillGfx = {
  mediaSrc: string;
  animationKind: "sheet" | "record" | "battle-animation" | "other";
  applyTo: "target" | "user" | "screen";
  cellSize: number;
  columns: number;
  rows: number;
  frameCount: number;
  fps: number;
  durationMs: number;
};

function sanitizeApplyTo(value: unknown): ResolvedSkillGfx["applyTo"] {
  if (value === "user" || value === "screen") {
    return value;
  }
  return "target";
}

/**
 * Resolves the migrated move-effect animation for a move by skillGfx id,
 * skillGfx name, or Essentials animation name (all provided by the server's
 * move-used event).
 */
export function resolveSkillGfx(options: {
  skillGfxId: string | null;
  skillGfxName: string | null;
  animationName: string | null;
}): ResolvedSkillGfx | null {
  const payload = readStoredDesignerSectionPayload("skillsGfx");
  const items = payload.state.items;

  const wantedId = options.skillGfxId ?? "";
  const wantedNames = [options.skillGfxName, options.animationName]
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .map((name) => name.trim().toLowerCase());

  const item =
    (wantedId ? items.find((candidate) => candidate.id === wantedId) : undefined) ??
    items.find((candidate) => {
      const profile = candidate.skillGfxProfile as DesignerSkillGfxProfile | undefined;
      const names = [candidate.name, profile?.essentialsAnimationName ?? ""]
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
      return wantedNames.some((wanted) => names.includes(wanted));
    });

  const profile = item?.skillGfxProfile as DesignerSkillGfxProfile | undefined;
  if (!profile || !profile.mediaSrc) {
    return null;
  }

  const frameCount = Math.max(1, Math.round(profile.frameCount ?? 1));
  const fps = Math.max(1, Math.round(profile.fps ?? 12));

  // Migrated profiles store the PER-FRAME delay in durationMs (e.g. 50 for a
  // 13-frame GIF), not the total play time — treating it as the total cut
  // every animation off after the 120ms floor. When the stored value is
  // shorter than what the frames need, derive the total from frameCount/fps.
  const framesMs = Math.round((frameCount / fps) * 1000);
  const storedMs = Math.round(profile.durationMs ?? 0);
  const durationMs = Math.max(120, storedMs >= framesMs * 0.75 ? storedMs : framesMs);

  return {
    mediaSrc: resolveServerAssetUrl(profile.mediaSrc),
    animationKind: profile.animationKind ?? "record",
    applyTo: sanitizeApplyTo(profile.applyTo),
    cellSize: Math.max(1, Math.round(profile.cellSize ?? 192)),
    columns: Math.max(1, Math.round(profile.columns ?? 1)),
    rows: Math.max(1, Math.round(profile.rows ?? 1)),
    frameCount,
    fps,
    durationMs
  };
}
