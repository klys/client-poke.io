import { useEffect, useState } from "react";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail
} from "../../../designer/designerCache";
import { resolveServerAssetUrl } from "../../../tilemap/serverAssets";

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
  introTransition: "flash-wipe" | "fade" | "none";
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
  introTransition: "flash-wipe",
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
    introTransition:
      introTransition === "flash-wipe" || introTransition === "fade" || introTransition === "none"
        ? introTransition
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

/** Resolves the configured battleback images (designer battleBackgrounds section). */
export function readBattleBackgroundImages(config: BattleInterfaceConfig): {
  backgroundSrc: string;
  playerBaseSrc: string;
  enemyBaseSrc: string;
} {
  let backgroundSrc = config.backgroundImageSrc;
  let playerBaseSrc = config.playerBaseImageSrc;
  let enemyBaseSrc = config.enemyBaseImageSrc;

  if (config.battleBackgroundId && (!backgroundSrc || !playerBaseSrc || !enemyBaseSrc)) {
    const payload = readStoredDesignerSectionPayload("battleBackgrounds");
    const item = payload.state.items.find((candidate) => candidate.id === config.battleBackgroundId);
    const profile = item?.battleBackgroundProfile;

    if (profile) {
      const components = profile.componentAssets ?? [];
      const findComponent = (roleMatch: RegExp) => {
        const component = components.find((asset) => {
          const role = `${asset.role ?? ""} ${asset.filename ?? ""} ${asset.sourcePath ?? ""}`.toLowerCase();
          return roleMatch.test(role);
        });
        return component?.dataUri || component?.imageSrc || "";
      };

      backgroundSrc = backgroundSrc || profile.dataUri || profile.imageSrc || findComponent(/bg|background/);
      playerBaseSrc = playerBaseSrc || findComponent(/player|base1|base_1|base0/);
      enemyBaseSrc = enemyBaseSrc || findComponent(/enemy|opponent|base2|base_2/);
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
