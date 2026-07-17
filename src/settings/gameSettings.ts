/**
 * Player-level game settings: audio (music / sound effect volume and mutes),
 * UI scaling (NPC dialogs, interface windows, battle interface) and language.
 *
 * These are per-player preferences persisted in localStorage — distinct from
 * the designer-published battleInterface config, which sets the game-wide
 * baseline. Audio consumers combine both: effective volume = designer volume x
 * user volume, muted when either side mutes.
 *
 * Same store pattern as input/gamepadConfig.ts: load/save + a custom event so
 * every consumer (React hooks and the plain-JS audio managers) applies changes
 * live without a reload.
 */

import { useCallback, useEffect, useState } from 'react';

export type LanguageSetting = 'auto' | 'en' | 'es';

export interface GameSettings {
  audio: {
    /** 0–1 multiplier over the designer BGM volume. */
    musicVolume: number;
    musicMuted: boolean;
    /** 0–1 multiplier over the designer SE volume. */
    sfxVolume: number;
    sfxMuted: boolean;
  };
  uiScale: {
    /** NPC / event dialog boxes (EventDialog, NpcInteractions, trainer cards). */
    dialogs: number;
    /** Interface windows (Account, Bag, Settings, ...). */
    interface: number;
    /** Battle scene UI (databoxes, message window, command menu). */
    battle: number;
  };
  language: LanguageSetting;
  controls: {
    /** Tap/click on the map walks the player there. Off = keyboard/pad only. */
    touchMoveEnabled: boolean;
  };
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  audio: {
    musicVolume: 1,
    musicMuted: false,
    sfxVolume: 1,
    sfxMuted: false,
  },
  uiScale: {
    dialogs: 1,
    interface: 1,
    // The battle UI reads best ~15% smaller than the other windows; players
    // can still push it back up (or lower) in Settings -> Display.
    battle: 0.85,
  },
  language: 'auto',
  controls: {
    touchMoveEnabled: true,
  },
};

export const UI_SCALE_MIN = 0.75;
export const UI_SCALE_MAX = 1.5;

const SETTINGS_KEY = 'client-poke.io.settings.game';
const SETTINGS_EVENT = 'pokecraft:game-settings-changed';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toVolume = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : fallback;

const toScale = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, UI_SCALE_MIN, UI_SCALE_MAX) : fallback;

const toBool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

function normalizeSettings(raw: unknown): GameSettings {
  const base = DEFAULT_GAME_SETTINGS;
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as {
    audio?: Partial<GameSettings['audio']>;
    uiScale?: Partial<GameSettings['uiScale']>;
    language?: unknown;
    controls?: Partial<GameSettings['controls']>;
  };

  return {
    audio: {
      musicVolume: toVolume(input.audio?.musicVolume, base.audio.musicVolume),
      musicMuted: toBool(input.audio?.musicMuted, base.audio.musicMuted),
      sfxVolume: toVolume(input.audio?.sfxVolume, base.audio.sfxVolume),
      sfxMuted: toBool(input.audio?.sfxMuted, base.audio.sfxMuted),
    },
    uiScale: {
      dialogs: toScale(input.uiScale?.dialogs, base.uiScale.dialogs),
      interface: toScale(input.uiScale?.interface, base.uiScale.interface),
      battle: toScale(input.uiScale?.battle, base.uiScale.battle),
    },
    language:
      input.language === 'en' || input.language === 'es' || input.language === 'auto'
        ? input.language
        : base.language,
    controls: {
      touchMoveEnabled: toBool(input.controls?.touchMoveEnabled, base.controls.touchMoveEnabled),
    },
  };
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function saveGameSettings(next: GameSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — settings still apply for this session */
  }
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }));
}

/** Subscription for non-React consumers (the audio managers). */
export function subscribeGameSettings(listener: (settings: GameSettings) => void): () => void {
  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<GameSettings>).detail;
    listener(detail ? normalizeSettings(detail) : loadGameSettings());
  };
  window.addEventListener(SETTINGS_EVENT, onChange);
  return () => window.removeEventListener(SETTINGS_EVENT, onChange);
}

/** Live settings hook; `update` deep-merges one top-level group at a time. */
export function useGameSettings(): [GameSettings, (patch: Partial<GameSettings>) => void] {
  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings());

  useEffect(() => subscribeGameSettings(setSettings), []);

  const update = useCallback((patch: Partial<GameSettings>) => {
    const current = loadGameSettings();
    const next = normalizeSettings({
      ...current,
      ...patch,
      audio: { ...current.audio, ...patch.audio },
      uiScale: { ...current.uiScale, ...patch.uiScale },
      controls: { ...current.controls, ...patch.controls },
    });
    saveGameSettings(next);
  }, []);

  return [settings, update];
}
