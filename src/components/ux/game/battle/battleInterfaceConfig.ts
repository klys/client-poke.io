import { useEffect, useMemo, useState } from "react";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail
} from "../../../designer/designerCache";
import { resolveServerAssetUrl } from "../../../tilemap/serverAssets";
import {
  getBattleBackManifestEntry,
  normalizeBattleBackName,
  subscribeBattleBackManifest
} from "./battleBackManifest";

/** Concrete battle entry transitions (see BattleIntro.tsx). */
export const BATTLE_INTRO_EFFECTS = [
  "flash-wipe",
  "fade",
  "iris",
  "blinds",
  "checker",
  "shutter"
] as const;

export type BattleIntroEffect = (typeof BATTLE_INTRO_EFFECTS)[number];

/** "random" picks one of the concrete effects per battle. */
export type BattleIntroTransition = BattleIntroEffect | "random" | "none";

const INTRO_TRANSITIONS: readonly BattleIntroTransition[] = [
  ...BATTLE_INTRO_EFFECTS,
  "random",
  "none"
];

/**
 * Battle interface customization published through the `battleInterface`
 * designer section. Every field is optional in storage; readers always go
 * through DEFAULT_BATTLE_INTERFACE_CONFIG.
 */
export type BattleInterfaceConfig = {
  battleBackgroundId: string;
  backgroundImageSrc: string;
  playerBaseImageSrc: string;
  enemyBaseImageSrc: string;
  databoxPlayerColor: string;
  databoxEnemyColor: string;
  databoxTextColor: string;
  messageBoxColor: string;
  messageBoxTextColor: string;
  messageBoxBorderColor: string;
  messageRows: number;
  textSpeedMsPerChar: number;
  battleBgmSrc: string;
  victoryMeSrc: string;
  wildIntroSeSrc: string;
  trainerIntroSeSrc: string;
  bgmVolume: number;
  seVolume: number;
  muteBgm: boolean;
  muteSe: boolean;
  introTransition: BattleIntroTransition;
  animationSpeed: number;
  showBattleLog: boolean;
  logRows: number;
};

export const DEFAULT_BATTLE_INTERFACE_CONFIG: BattleInterfaceConfig = {
  battleBackgroundId: "",
  backgroundImageSrc: "",
  playerBaseImageSrc: "",
  enemyBaseImageSrc: "",
  databoxPlayerColor: "#f8f4e8",
  databoxEnemyColor: "#f8f4e8",
  databoxTextColor: "#3a3a32",
  messageBoxColor: "#2b3a4a",
  messageBoxTextColor: "#f8f8f8",
  messageBoxBorderColor: "#8ea5c0",
  messageRows: 2,
  textSpeedMsPerChar: 18,
  battleBgmSrc: "",
  victoryMeSrc: "",
  wildIntroSeSrc: "",
  trainerIntroSeSrc: "",
  bgmVolume: 0.5,
  seVolume: 0.7,
  muteBgm: false,
  muteSe: false,
  introTransition: "random",
  animationSpeed: 1,
  showBattleLog: true,
  logRows: 6
};

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toText(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizeBattleInterfaceConfig(value: unknown): BattleInterfaceConfig {
  const defaults = DEFAULT_BATTLE_INTERFACE_CONFIG;
  if (!value || typeof value !== "object") {
    return { ...defaults };
  }

  const candidate = value as Partial<Record<keyof BattleInterfaceConfig, unknown>>;
  const introTransition = candidate.introTransition;

  return {
    battleBackgroundId: toText(candidate.battleBackgroundId, defaults.battleBackgroundId),
    backgroundImageSrc: toText(candidate.backgroundImageSrc, defaults.backgroundImageSrc),
    playerBaseImageSrc: toText(candidate.playerBaseImageSrc, defaults.playerBaseImageSrc),
    enemyBaseImageSrc: toText(candidate.enemyBaseImageSrc, defaults.enemyBaseImageSrc),
    databoxPlayerColor: toText(candidate.databoxPlayerColor, defaults.databoxPlayerColor),
    databoxEnemyColor: toText(candidate.databoxEnemyColor, defaults.databoxEnemyColor),
    databoxTextColor: toText(candidate.databoxTextColor, defaults.databoxTextColor),
    messageBoxColor: toText(candidate.messageBoxColor, defaults.messageBoxColor),
    messageBoxTextColor: toText(candidate.messageBoxTextColor, defaults.messageBoxTextColor),
    messageBoxBorderColor: toText(candidate.messageBoxBorderColor, defaults.messageBoxBorderColor),
    messageRows: Math.max(1, Math.min(4, Math.round(toNumber(candidate.messageRows, defaults.messageRows)))),
    textSpeedMsPerChar: Math.max(0, Math.min(90, toNumber(candidate.textSpeedMsPerChar, defaults.textSpeedMsPerChar))),
    battleBgmSrc: toText(candidate.battleBgmSrc, defaults.battleBgmSrc),
    victoryMeSrc: toText(candidate.victoryMeSrc, defaults.victoryMeSrc),
    wildIntroSeSrc: toText(candidate.wildIntroSeSrc, defaults.wildIntroSeSrc),
    trainerIntroSeSrc: toText(candidate.trainerIntroSeSrc, defaults.trainerIntroSeSrc),
    bgmVolume: Math.max(0, Math.min(1, toNumber(candidate.bgmVolume, defaults.bgmVolume))),
    seVolume: Math.max(0, Math.min(1, toNumber(candidate.seVolume, defaults.seVolume))),
    muteBgm: toBoolean(candidate.muteBgm, defaults.muteBgm),
    muteSe: toBoolean(candidate.muteSe, defaults.muteSe),
    introTransition: INTRO_TRANSITIONS.includes(introTransition as BattleIntroTransition)
      ? (introTransition as BattleIntroTransition)
      : defaults.introTransition,
    animationSpeed: Math.max(0.25, Math.min(3, toNumber(candidate.animationSpeed, defaults.animationSpeed))),
    showBattleLog: toBoolean(candidate.showBattleLog, defaults.showBattleLog),
    logRows: Math.max(3, Math.min(14, Math.round(toNumber(candidate.logRows, defaults.logRows))))
  };
}

export function readBattleInterfaceConfig(): BattleInterfaceConfig {
  const payload = readStoredDesignerSectionPayload("battleInterface");
  const item = payload.state.items[0] as { battleInterfaceProfile?: unknown } | undefined;
  return sanitizeBattleInterfaceConfig(item?.battleInterfaceProfile);
}

/** Live view of the designer battleInterface config. */
export function useBattleInterfaceConfig(): BattleInterfaceConfig {
  const [config, setConfig] = useState<BattleInterfaceConfig>(() => readBattleInterfaceConfig());

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;
      if (!detail || detail.sectionKey === "battleInterface" || detail.sectionKey === "battleBackgrounds") {
        setConfig(readBattleInterfaceConfig());
      }
    };

    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleUpdate);
  }, []);

  return config;
}

type BattleBackgroundImages = {
  backgroundSrc: string;
  playerBaseSrc: string;
  enemyBaseSrc: string;
};

function readBattleBackgroundProfileImages(item: {
  battleBackgroundProfile?: {
    dataUri?: string;
    imageSrc?: string;
    componentAssets?: Array<{
      role?: string;
      filename?: string;
      sourcePath?: string;
      dataUri?: string;
      imageSrc?: string;
    }>;
  };
}): BattleBackgroundImages | null {
  const profile = item?.battleBackgroundProfile;
  if (!profile) {
    return null;
  }

  const components = profile.componentAssets ?? [];
  const findComponent = (exactRole: string, roleMatch: RegExp) => {
    const exact = components.find((asset) => asset.role === exactRole);
    if (exact) {
      return exact.dataUri || exact.imageSrc || "";
    }
    const fuzzy = components.find((asset) => {
      const role = `${asset.role ?? ""} ${asset.filename ?? ""} ${asset.sourcePath ?? ""}`.toLowerCase();
      return roleMatch.test(role);
    });
    return fuzzy?.dataUri || fuzzy?.imageSrc || "";
  };

  return {
    backgroundSrc:
      findComponent("background", /bg|background/) || profile.dataUri || profile.imageSrc || "",
    playerBaseSrc: findComponent("playerBase", /player|base0|base_0/),
    enemyBaseSrc: findComponent("opponentBase", /enemy|opponent|base1|base_1|base2|base_2/)
  };
}

/**
 * Resolves the battleback images. `battleBackName` is the map/terrain-driven
 * backdrop the server picked for this battle (Essentials BattleBack names
 * like "Field", "FieldGrass", "Cave"); when it matches an item of the
 * designer battleBackgrounds section it wins over the global config, so
 * battles look like the place they started in. Falls back to the configured
 * default battleback, then the config's explicit image overrides.
 */
export function readBattleBackgroundImages(
  config: BattleInterfaceConfig,
  battleBackName?: string | null
): BattleBackgroundImages {
  let backgroundSrc = "";
  let playerBaseSrc = "";
  let enemyBaseSrc = "";

  if (battleBackName && battleBackName.trim()) {
    // Primary source: the static battleback manifest (available to every
    // player). The designer section lookup below only works for designers
    // who have the heavy battleBackgrounds payload cached.
    const manifestEntry = getBattleBackManifestEntry(battleBackName);
    if (manifestEntry?.backgroundSrc) {
      backgroundSrc = manifestEntry.backgroundSrc;
      playerBaseSrc = manifestEntry.playerBaseSrc;
      enemyBaseSrc = manifestEntry.enemyBaseSrc;
    } else {
      const payload = readStoredDesignerSectionPayload("battleBackgrounds");
      const wanted = normalizeBattleBackName(battleBackName);
      const item = payload.state.items.find(
        (candidate) =>
          normalizeBattleBackName(candidate.name ?? "") === wanted ||
          candidate.id === `battle-bg-${wanted}`
      );
      const images = item ? readBattleBackgroundProfileImages(item) : null;
      if (images?.backgroundSrc) {
        backgroundSrc = images.backgroundSrc;
        playerBaseSrc = images.playerBaseSrc;
        enemyBaseSrc = images.enemyBaseSrc;
      }
    }
  }

  backgroundSrc = backgroundSrc || config.backgroundImageSrc;
  playerBaseSrc = playerBaseSrc || config.playerBaseImageSrc;
  enemyBaseSrc = enemyBaseSrc || config.enemyBaseImageSrc;

  if (config.battleBackgroundId && (!backgroundSrc || !playerBaseSrc || !enemyBaseSrc)) {
    const payload = readStoredDesignerSectionPayload("battleBackgrounds");
    const item = payload.state.items.find((candidate) => candidate.id === config.battleBackgroundId);
    const images = item ? readBattleBackgroundProfileImages(item) : null;

    if (images) {
      backgroundSrc = backgroundSrc || images.backgroundSrc;
      playerBaseSrc = playerBaseSrc || images.playerBaseSrc;
      enemyBaseSrc = enemyBaseSrc || images.enemyBaseSrc;
    }
  }

  // Designer values may be data URIs (uploads) or root-relative asset-storage
  // paths ("/migration_exports/..."); resolveServerAssetUrl prefixes the latter
  // with the asset-storage origin and passes data/absolute URLs through.
  return {
    backgroundSrc: resolveServerAssetUrl(backgroundSrc),
    playerBaseSrc: resolveServerAssetUrl(playerBaseSrc),
    enemyBaseSrc: resolveServerAssetUrl(enemyBaseSrc)
  };
}

/**
 * Live battleback images for a battle. Recomputes when the designer config
 * changes and when the static battleback manifest finishes loading (the
 * manifest fetch races the first battle after a cold start).
 */
export function useBattleBackgroundImages(
  config: BattleInterfaceConfig,
  battleBackName: string | null
): BattleBackgroundImages {
  const [manifestGeneration, setManifestGeneration] = useState(0);

  useEffect(
    () => subscribeBattleBackManifest(() => setManifestGeneration((value) => value + 1)),
    []
  );

  return useMemo(
    () => readBattleBackgroundImages(config, battleBackName),
    [config, battleBackName, manifestGeneration]
  );
}
