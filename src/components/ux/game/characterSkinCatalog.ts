import {
  readStoredDesignerSectionPayload,
} from "../../designer/designerCache";
import type {
  DesignerCharacterSkinProfile,
  DesignerItemSeed,
} from "../../designer/designerSections";

export type CharacterSkinCatalogItem = {
  id: string;
  name: string;
  category: string;
  profile: DesignerCharacterSkinProfile;
};

export type CharacterSkinDirection = "up" | "down" | "left" | "right";

export function sanitizeCharacterSkinProfile(
  value: unknown
): DesignerCharacterSkinProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<DesignerCharacterSkinProfile>;

  return {
    standingUpSrc: typeof candidate.standingUpSrc === "string" ? candidate.standingUpSrc : "",
    standingDownSrc:
      typeof candidate.standingDownSrc === "string" ? candidate.standingDownSrc : "",
    standingLeftSrc:
      typeof candidate.standingLeftSrc === "string" ? candidate.standingLeftSrc : "",
    standingRightSrc:
      typeof candidate.standingRightSrc === "string" ? candidate.standingRightSrc : "",
    walkingUpSrc: typeof candidate.walkingUpSrc === "string" ? candidate.walkingUpSrc : "",
    walkingDownSrc:
      typeof candidate.walkingDownSrc === "string" ? candidate.walkingDownSrc : "",
    walkingLeftSrc:
      typeof candidate.walkingLeftSrc === "string" ? candidate.walkingLeftSrc : "",
    walkingRightSrc:
      typeof candidate.walkingRightSrc === "string" ? candidate.walkingRightSrc : "",
    frontImageSrc: typeof candidate.frontImageSrc === "string" ? candidate.frontImageSrc : "",
    backImageSrc: typeof candidate.backImageSrc === "string" ? candidate.backImageSrc : "",
  };
}

export function toCharacterSkinCatalogItem(item: DesignerItemSeed): CharacterSkinCatalogItem | null {
  const profile = sanitizeCharacterSkinProfile(item.characterSkinProfile);

  if (!item.id.trim() || !item.name.trim() || !profile) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    profile,
  };
}

export function loadCharacterSkinCatalog() {
  return readStoredDesignerSectionPayload("players").state.items
    .map(toCharacterSkinCatalogItem)
    .filter((item): item is CharacterSkinCatalogItem => item !== null)
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
    );
}

export function getCharacterSkinPreview(profile?: DesignerCharacterSkinProfile) {
  if (!profile) {
    return "";
  }

  return (
    profile.standingDownSrc ||
    profile.standingUpSrc ||
    profile.standingLeftSrc ||
    profile.standingRightSrc ||
    profile.frontImageSrc ||
    profile.backImageSrc
  );
}

export function getCharacterSkinSprite(
  profile: DesignerCharacterSkinProfile | undefined,
  direction: CharacterSkinDirection,
  isWalking: boolean
) {
  if (!profile) {
    return "";
  }

  if (isWalking) {
    switch (direction) {
      case "up":
        return profile.walkingUpSrc;
      case "left":
        return profile.walkingLeftSrc;
      case "right":
        return profile.walkingRightSrc;
      case "down":
      default:
        return profile.walkingDownSrc;
    }
  }

  switch (direction) {
    case "up":
      return profile.standingUpSrc;
    case "left":
      return profile.standingLeftSrc;
    case "right":
      return profile.standingRightSrc;
    case "down":
    default:
      return profile.standingDownSrc;
  }
}
