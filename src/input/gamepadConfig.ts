/**
 * Shared gamepad configuration for the cross-platform client.
 *
 * The game reads physical keyboard input off `window` (UserControl.tsx,
 * EventDialog.tsx, NpcInteractions.tsx), so both input bridges — the physical
 * controller poll loop (GamepadControls.tsx) and the on-screen touch pad
 * (VirtualControls.tsx) — work by synthesising the same KeyboardEvents.
 *
 * This module owns the vocabulary they share:
 *   - the game ACTIONS a button can trigger (move, confirm, cancel, ...)
 *   - the standard-mapping button names (https://w3c.github.io/gamepad/#remapping)
 *   - the user's settings (button -> action mapping, dead zone, on-screen pad
 *     scale/opacity/visibility) persisted in localStorage
 *   - the KeyboardEvent synthesis helper
 *
 * The Settings window edits these values; both bridges re-read them live via
 * useGamepadSettings().
 */

import { useCallback, useEffect, useState } from 'react';

export type KeySpec = { key: string; code: string; keyCode: number };

export type GamepadAction =
  | 'none'
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'confirm'
  | 'cancel'
  | 'interact'
  | 'menu'
  | 'shoot';

/**
 * What each action synthesises. `repeat: true` marks hold-to-move inputs: the
 * engine advances one step per keydown and stops on keyup, so held directions
 * re-dispatch keydown on an interval (mimicking OS key repeat).
 */
export const ACTION_KEYS: Record<Exclude<GamepadAction, 'none'>, { spec: KeySpec; repeat: boolean; label: string }> = {
  moveUp: { spec: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }, repeat: true, label: 'Move Up' },
  moveDown: { spec: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }, repeat: true, label: 'Move Down' },
  moveLeft: { spec: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }, repeat: true, label: 'Move Left' },
  moveRight: { spec: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }, repeat: true, label: 'Move Right' },
  confirm: { spec: { key: 'Enter', code: 'Enter', keyCode: 13 }, repeat: false, label: 'Confirm / Advance dialog' },
  cancel: { spec: { key: 'Escape', code: 'Escape', keyCode: 27 }, repeat: false, label: 'Cancel / Close' },
  interact: { spec: { key: ' ', code: 'Space', keyCode: 32 }, repeat: false, label: 'Interact (facing tile)' },
  menu: { spec: { key: 'm', code: 'KeyM', keyCode: 77 }, repeat: false, label: 'Open Menu' },
  shoot: { spec: { key: 'q', code: 'KeyQ', keyCode: 81 }, repeat: false, label: 'Action / Shoot' },
};

/** Ordered options for the settings selects. */
export const GAMEPAD_ACTION_OPTIONS: Array<{ id: GamepadAction; label: string }> = [
  { id: 'none', label: 'Unassigned' },
  ...(Object.keys(ACTION_KEYS) as Array<Exclude<GamepadAction, 'none'>>).map((id) => ({
    id: id as GamepadAction,
    label: ACTION_KEYS[id].label,
  })),
];

/** Standard-mapping button indices with human names (Xbox / PlayStation). */
export const STANDARD_BUTTONS: Array<{ index: number; label: string }> = [
  { index: 0, label: 'A / Cross' },
  { index: 1, label: 'B / Circle' },
  { index: 2, label: 'X / Square' },
  { index: 3, label: 'Y / Triangle' },
  { index: 4, label: 'Left Bumper (LB / L1)' },
  { index: 5, label: 'Right Bumper (RB / R1)' },
  { index: 6, label: 'Left Trigger (LT / L2)' },
  { index: 7, label: 'Right Trigger (RT / R2)' },
  { index: 8, label: 'Select / View / Share' },
  { index: 9, label: 'Start / Menu / Options' },
  { index: 10, label: 'Left Stick Press (L3)' },
  { index: 11, label: 'Right Stick Press (R3)' },
  { index: 12, label: 'D-pad Up' },
  { index: 13, label: 'D-pad Down' },
  { index: 14, label: 'D-pad Left' },
  { index: 15, label: 'D-pad Right' },
  { index: 16, label: 'Guide / Home' },
];

export type VirtualPadVisibility = 'auto' | 'always' | 'hidden';
export type VirtualPadButton = 'a' | 'b' | 'x' | 'y';

export interface GamepadSettings {
  /** Master switch for physical-controller input. */
  enabled: boolean;
  /** Left stick becomes a virtual d-pad past this threshold (0.1–0.9). */
  deadZone: number;
  /** Whether the left stick moves the player (d-pad always works). */
  leftStickMovement: boolean;
  /** Standard-mapping button index (as string key) -> game action. */
  buttonActions: Record<string, GamepadAction>;
  /** On-screen touch pad (Capacitor build). */
  virtual: {
    /** auto = hide while a physical controller is connected. */
    visibility: VirtualPadVisibility;
    /** Render scale, 0.6–1.6. */
    scale: number;
    /** Button opacity, 0.2–1. */
    opacity: number;
    /** Action per on-screen face button. */
    buttonActions: Record<VirtualPadButton, GamepadAction>;
  };
}

/** Matches the Electron preload map so every shell feels the same. */
export const DEFAULT_GAMEPAD_SETTINGS: GamepadSettings = {
  enabled: true,
  deadZone: 0.5,
  leftStickMovement: true,
  buttonActions: {
    '0': 'confirm',
    '1': 'cancel',
    '2': 'interact',
    '3': 'menu',
    '4': 'none',
    '5': 'shoot',
    '6': 'none',
    '7': 'none',
    '8': 'cancel',
    '9': 'menu',
    '10': 'none',
    '11': 'none',
    '12': 'moveUp',
    '13': 'moveDown',
    '14': 'moveLeft',
    '15': 'moveRight',
    '16': 'none',
  },
  virtual: {
    visibility: 'auto',
    scale: 1,
    opacity: 0.9,
    buttonActions: { a: 'confirm', b: 'cancel', x: 'interact', y: 'menu' },
  },
};

const SETTINGS_KEY = 'client-poke.io.input.gamepadSettings';
const SETTINGS_EVENT = 'pokecraft:gamepad-settings-changed';

const isAction = (value: unknown): value is GamepadAction =>
  value === 'none' || (typeof value === 'string' && value in ACTION_KEYS);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Merge a stored (possibly partial / stale) blob over the defaults. */
function normalizeSettings(raw: unknown): GamepadSettings {
  const base = DEFAULT_GAMEPAD_SETTINGS;
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<GamepadSettings> & { virtual?: Partial<GamepadSettings['virtual']> };

  const buttonActions: Record<string, GamepadAction> = { ...base.buttonActions };
  if (input.buttonActions && typeof input.buttonActions === 'object') {
    for (const [index, action] of Object.entries(input.buttonActions)) {
      if (index in buttonActions && isAction(action)) buttonActions[index] = action;
    }
  }

  const virtualButtons: Record<VirtualPadButton, GamepadAction> = { ...base.virtual.buttonActions };
  if (input.virtual?.buttonActions && typeof input.virtual.buttonActions === 'object') {
    for (const key of Object.keys(virtualButtons) as VirtualPadButton[]) {
      const action = (input.virtual.buttonActions as Record<string, unknown>)[key];
      if (isAction(action)) virtualButtons[key] = action;
    }
  }

  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : base.enabled,
    deadZone: typeof input.deadZone === 'number' ? clamp(input.deadZone, 0.1, 0.9) : base.deadZone,
    leftStickMovement:
      typeof input.leftStickMovement === 'boolean' ? input.leftStickMovement : base.leftStickMovement,
    buttonActions,
    virtual: {
      visibility:
        input.virtual?.visibility === 'always' || input.virtual?.visibility === 'hidden'
          ? input.virtual.visibility
          : 'auto',
      scale: typeof input.virtual?.scale === 'number' ? clamp(input.virtual.scale, 0.6, 1.6) : base.virtual.scale,
      opacity:
        typeof input.virtual?.opacity === 'number' ? clamp(input.virtual.opacity, 0.2, 1) : base.virtual.opacity,
      buttonActions: virtualButtons,
    },
  };
}

export function loadGamepadSettings(): GamepadSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_GAMEPAD_SETTINGS;
  }
}

export function saveGamepadSettings(next: GamepadSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — settings still apply for this session */
  }
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }));
}

/**
 * Live settings hook. Every consumer (input bridges, settings UI) re-renders
 * when any of them saves, so changes apply immediately without a reload.
 */
export function useGamepadSettings(): [GamepadSettings, (patch: Partial<GamepadSettings>) => void] {
  const [settings, setSettings] = useState<GamepadSettings>(() => loadGamepadSettings());

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<GamepadSettings>).detail;
      setSettings(detail ? normalizeSettings(detail) : loadGamepadSettings());
    };
    window.addEventListener(SETTINGS_EVENT, onChange);
    return () => window.removeEventListener(SETTINGS_EVENT, onChange);
  }, []);

  const update = useCallback((patch: Partial<GamepadSettings>) => {
    const next = normalizeSettings({
      ...loadGamepadSettings(),
      ...patch,
    });
    saveGamepadSettings(next);
  }, []);

  return [settings, update];
}

/**
 * Synthesise a KeyboardEvent the game's window listeners will see. Legacy
 * keyCode/which are defined explicitly for any handler that still reads them
 * (the constructor ignores those options).
 */
export function dispatchKey(type: 'keydown' | 'keyup', spec: KeySpec, repeat: boolean) {
  const event = new KeyboardEvent(type, {
    key: spec.key,
    code: spec.code,
    bubbles: true,
    cancelable: true,
    repeat,
  });
  try {
    Object.defineProperty(event, 'keyCode', { get: () => spec.keyCode });
    Object.defineProperty(event, 'which', { get: () => spec.keyCode });
  } catch {
    /* ignore */
  }
  window.dispatchEvent(event);
}

/** True while a text field is focused, so synthetic keys never type into it. */
export function isTextInputFocused() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    const nonText = ['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'];
    return !nonText.includes(type);
  }
  return false;
}

/** How fast a held direction repeats keydown, in ms (matches VirtualControls). */
export const REPEAT_MS = 100;
