import { readStoredDesignerSectionPayload } from "../../designer/designerCache";
import { resolveServerAssetUrl } from "../../tilemap/serverAssets";
import { readBattleInterfaceConfig } from "./battle/battleInterfaceConfig";

/**
 * World audio: map background music, RPG Maker event sounds (Play SE/ME/BGM)
 * and one-shot effects like portal doors. Sources come from the designer
 * `audio` section (Venova imports live under /migration_exports/audio). MIDI
 * originals are pre-converted to .ogg; records still marked unplayable are
 * skipped silently.
 */

type AudioKind = "BGM" | "ME" | "SE";

function normalizeAudioName(value: string) {
  return value
    .toLowerCase()
    .replace(/\.(mid|ogg|mp3|wav)$/i, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function isPlayableSrc(src: string) {
  return Boolean(src) && !/\.mid$/i.test(src);
}

/** Resolves an audio record src by its RMXP name (e.g. "begin", "ballshake"). */
export function resolveGameAudioSrc(name: string, kind: AudioKind): string {
  if (!name) {
    return "";
  }
  try {
    const payload = readStoredDesignerSectionPayload("audio");
    const wanted = normalizeAudioName(name);
    const candidates = payload.state.items
      .map((item) => ({
        name: normalizeAudioName(item.name),
        profile: item.audioProfile as { sourcePath?: string; kind?: string } | undefined
      }))
      .filter((entry) => entry.profile?.sourcePath);

    const ofKind = candidates.filter((entry) => entry.profile?.kind === kind);
    const pool = ofKind.length > 0 ? ofKind : candidates;
    const record =
      pool.find((entry) => entry.name === wanted) ??
      pool.find((entry) => entry.name.startsWith(wanted)) ??
      (wanted.length >= 6 ? pool.find((entry) => entry.name.includes(wanted)) : undefined);

    let src = record?.profile?.sourcePath ?? "";
    // Prefer a pre-converted .ogg sitting beside a MIDI original.
    if (/\.mid$/i.test(src)) {
      src = src.replace(/\.mid$/i, ".ogg");
    }
    if (isPlayableSrc(src)) {
      return resolveServerAssetUrl(src);
    }
  } catch {
    // Audio cache unavailable; stay silent.
  }
  return "";
}

class GameAudioManager {
  private bgmElement: HTMLAudioElement | null = null;
  private bgmKey = "";
  private seElements = new Map<string, HTMLAudioElement>();
  private suspended = false;

  /** Starts (or keeps) looping background music identified by RMXP name. */
  playBgm(name: string) {
    const config = readBattleInterfaceConfig();
    if (!name || config.muteBgm || config.bgmVolume <= 0) {
      return;
    }
    const key = normalizeAudioName(name);
    if (key === this.bgmKey && this.bgmElement && !this.bgmElement.paused) {
      return;
    }
    const src = resolveGameAudioSrc(name, "BGM");
    if (!src) {
      return;
    }
    this.stopBgm();
    try {
      const element = new Audio(src);
      element.loop = true;
      element.volume = config.bgmVolume;
      this.bgmElement = element;
      this.bgmKey = key;
      if (!this.suspended) {
        void element.play().catch(() => undefined);
      }
    } catch {
      this.bgmElement = null;
      this.bgmKey = "";
    }
  }

  stopBgm() {
    if (this.bgmElement) {
      this.bgmElement.pause();
      this.bgmElement = null;
    }
    this.bgmKey = "";
  }

  /** Battles take over audio; map music resumes on resume(). */
  suspendBgm() {
    this.suspended = true;
    if (this.bgmElement) {
      this.bgmElement.pause();
    }
  }

  resumeBgm() {
    this.suspended = false;
    if (this.bgmElement) {
      void this.bgmElement.play().catch(() => undefined);
    }
  }

  get isSuspended() {
    return this.suspended;
  }

  /** One-shot sound effect / musical effect by RMXP name. */
  playEffect(name: string, kind: "SE" | "ME" = "SE", volume?: number) {
    const config = readBattleInterfaceConfig();
    if (!name || config.muteSe || config.seVolume <= 0) {
      return;
    }
    const src = resolveGameAudioSrc(name, kind);
    if (!src) {
      return;
    }
    try {
      let element = this.seElements.get(src);
      if (!element) {
        element = new Audio(src);
        this.seElements.set(src, element);
      }
      element.volume = Math.max(0, Math.min(1, (volume ?? 100) / 100)) * config.seVolume;
      element.currentTime = 0;
      void element.play().catch(() => undefined);
    } catch {
      // Missing/broken audio should never break the game loop.
    }
  }
}

export const gameAudio = new GameAudioManager();
