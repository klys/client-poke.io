import { readStoredDesignerSectionPayload } from "../../../designer/designerCache";
import { resolveServerAssetUrl } from "../../../tilemap/serverAssets";
import type { BattleInterfaceConfig } from "./battleInterfaceConfig";
import { loadGameSettings, subscribeGameSettings } from "../../../../settings/gameSettings";

/**
 * Battle sound cues. Named cues resolve, in order:
 * 1. an explicit src from the battleInterface designer config,
 * 2. a designer `audio` section record whose name matches the cue,
 * 3. a synthesized WebAudio fallback so battles are never silent.
 *
 * The player's Settings -> Audio preferences layer over the designer config:
 * effective volume = designer x player, muted when either side mutes, and
 * changes apply live to the battle BGM.
 */
export type BattleSoundCue =
  | "battle-intro-wild"
  | "battle-intro-trainer"
  | "hit-normal"
  | "hit-super-effective"
  | "hit-not-very-effective"
  | "faint"
  | "exp-gain"
  | "level-up"
  | "stat-up"
  | "stat-down"
  | "status"
  | "heal"
  | "ball-throw"
  | "ball-shake"
  | "ball-caught"
  | "escape"
  | "evolution"
  | "victory";

const CUE_AUDIO_SECTION_NAMES: Record<BattleSoundCue, string[]> = {
  "battle-intro-wild": ["battle intro wild", "battle start", "intro battle"],
  "battle-intro-trainer": ["battle intro trainer", "trainer battle start"],
  "hit-normal": ["normaldamage", "hit normal", "damage normal", "hit"],
  "hit-super-effective": ["superdamage", "hit super", "damage super"],
  "hit-not-very-effective": ["notverydamage", "weakdamage", "hit weak"],
  faint: ["faint", "pkmn faint"],
  "exp-gain": ["exp gain", "expgain"],
  "level-up": ["level up", "levelup", "pkmn level up"],
  "stat-up": ["stat up", "statup"],
  "stat-down": ["stat down", "statdown"],
  status: ["status", "condition"],
  heal: ["recovery", "pokemon healing", "heal"],
  "ball-throw": ["throw", "ball throw"],
  "ball-shake": ["ballshake", "ball shake", "balshake"],
  "ball-caught": ["balldrop", "jingle - hmtm", "jingle", "caught"],
  escape: ["escape", "flee", "run away", "run"],
  evolution: ["evolutionsuccess", "evolution success", "evolve"],
  victory: ["victory - wild pokemon", "victory - trainer", "victory"]
};

/** Synth fallback recipes: [frequencyHz, durationMs, type, sweepToHz?][] */
const CUE_SYNTH_RECIPES: Record<BattleSoundCue, Array<[number, number, OscillatorType, number?]>> = {
  "battle-intro-wild": [[220, 90, "square", 440], [330, 90, "square", 660], [440, 160, "square"]],
  "battle-intro-trainer": [[330, 90, "square", 165], [330, 90, "square", 660], [523, 180, "square"]],
  "hit-normal": [[180, 90, "square", 90]],
  "hit-super-effective": [[300, 60, "square", 120], [150, 140, "square", 60]],
  "hit-not-very-effective": [[140, 110, "sine", 90]],
  faint: [[392, 90, "square", 196], [196, 220, "square", 65]],
  "exp-gain": [[880, 40, "square"], [988, 40, "square"], [1047, 40, "square"]],
  "level-up": [[523, 70, "square"], [659, 70, "square"], [784, 70, "square"], [1047, 160, "square"]],
  "stat-up": [[440, 50, "square", 880], [880, 90, "square"]],
  "stat-down": [[440, 60, "square", 220], [220, 100, "square"]],
  status: [[260, 90, "sawtooth", 180]],
  heal: [[660, 60, "sine"], [880, 60, "sine"], [1100, 90, "sine"]],
  "ball-throw": [[500, 70, "square", 900]],
  "ball-shake": [[240, 60, "square", 200]],
  "ball-caught": [[523, 90, "square"], [659, 90, "square"], [784, 240, "square"]],
  escape: [[600, 60, "square", 1200], [1200, 90, "square"]],
  evolution: [[262, 90, "square", 523], [523, 90, "square", 1047], [1047, 220, "square"]],
  victory: [[523, 90, "square"], [523, 60, "square"], [523, 60, "square"], [659, 200, "square"]]
};

function normalizeAudioName(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

function resolveAudioRecordSrc(cue: BattleSoundCue): string {
  try {
    const payload = readStoredDesignerSectionPayload("audio");
    const wanted = CUE_AUDIO_SECTION_NAMES[cue].map(normalizeAudioName);
    const candidates = payload.state.items
      .map((item) => ({
        item,
        name: normalizeAudioName(item.name),
        kind: (item.audioProfile as { kind?: string } | undefined)?.kind ?? ""
      }))
      // Battle cues are sound effects; keep looping music out of SE lookups.
      .filter((entry) => (cue === "victory" ? true : entry.kind !== "BGM"));

    // Exact name wins, then prefix, then substring (longer aliases only) —
    // this keeps "Explosion" from matching the exp cue and "revolution
    // encounter" from matching evolution.
    let record =
      candidates.find((entry) => wanted.includes(entry.name)) ??
      candidates.find((entry) => wanted.some((candidate) => entry.name.startsWith(candidate))) ??
      candidates.find((entry) =>
        wanted.some((candidate) => candidate.length >= 6 && entry.name.includes(candidate))
      );

    const profile = record?.item.audioProfile as { sourcePath?: string } | undefined;
    const src = profile?.sourcePath ?? "";
    if (src && (src.startsWith("data:") || src.startsWith("/") || src.startsWith("http"))) {
      return resolveServerAssetUrl(src);
    }
  } catch {
    // Designer cache unavailable — fall back to synth cues.
  }
  return "";
}

function userAudio() {
  return loadGameSettings().audio;
}

class BattleAudioManager {
  private audioContext: AudioContext | null = null;
  private bgmElement: HTMLAudioElement | null = null;
  private bgmDesignerVolume = 0;
  private cueElements = new Map<string, HTMLAudioElement>();

  constructor() {
    // Live-apply Settings -> Audio changes to the battle BGM.
    if (typeof window !== "undefined") {
      subscribeGameSettings((settings) => {
        if (!this.bgmElement) {
          return;
        }
        this.bgmElement.volume = Math.max(
          0,
          Math.min(1, this.bgmDesignerVolume * settings.audio.musicVolume)
        );
        if (settings.audio.musicMuted) {
          this.bgmElement.pause();
        } else if (this.bgmElement.paused) {
          void this.bgmElement.play().catch(() => undefined);
        }
      });
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }
    if (!this.audioContext) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) {
        return null;
      }
      this.audioContext = new Ctor();
    }
    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume().catch(() => undefined);
    }
    return this.audioContext;
  }

  private playSynthCue(cue: BattleSoundCue, volume: number) {
    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    let startAt = context.currentTime;
    for (const [frequency, durationMs, type, sweepTo] of CUE_SYNTH_RECIPES[cue]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const duration = durationMs / 1000;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      if (typeof sweepTo === "number") {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), startAt + duration);
      }
      gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.22), startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
      startAt += duration;
    }
  }

  playCue(cue: BattleSoundCue, config: Pick<BattleInterfaceConfig, "seVolume" | "muteSe">, explicitSrc = "") {
    const audio = userAudio();
    const volume = Math.min(1, config.seVolume * audio.sfxVolume);
    if (config.muteSe || audio.sfxMuted || volume <= 0) {
      return;
    }

    const src = explicitSrc || resolveAudioRecordSrc(cue);
    if (src) {
      try {
        let element = this.cueElements.get(src);
        if (!element) {
          element = new Audio(src);
          this.cueElements.set(src, element);
        }
        element.volume = volume;
        element.currentTime = 0;
        void element.play().catch(() => this.playSynthCue(cue, volume));
        return;
      } catch {
        // fall through to synth
      }
    }

    this.playSynthCue(cue, volume);
  }

  playBgm(src: string, config: Pick<BattleInterfaceConfig, "bgmVolume" | "muteBgm">, loop = true) {
    this.stopBgm();
    const audio = userAudio();
    const volume = Math.min(1, config.bgmVolume * audio.musicVolume);
    if (!src || config.muteBgm || audio.musicMuted || volume <= 0) {
      return;
    }

    try {
      const element = new Audio(resolveServerAssetUrl(src));
      element.loop = loop;
      element.volume = volume;
      this.bgmDesignerVolume = config.bgmVolume;
      this.bgmElement = element;
      void element.play().catch(() => undefined);
    } catch {
      this.bgmElement = null;
    }
  }

  stopBgm() {
    if (this.bgmElement) {
      this.bgmElement.pause();
      this.bgmElement = null;
    }
  }

  /** Silences lingering one-shot cues (e.g. a long victory jingle) so a new
   * battle doesn't play on top of the previous battle's fanfare. */
  stopAllCues() {
    this.cueElements.forEach((element) => {
      element.pause();
      element.currentTime = 0;
    });
  }
}

export const battleAudio = new BattleAudioManager();
