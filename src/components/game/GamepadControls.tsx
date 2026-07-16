import { useEffect, useRef } from 'react';
import { isElectron } from '../../platform';
import {
  ACTION_KEYS,
  GamepadAction,
  GamepadSettings,
  KeySpec,
  REPEAT_MS,
  dispatchKey,
  isTextInputFocused,
  useGamepadSettings,
} from '../../input/gamepadConfig';

/**
 * Physical-controller input for the browser and Capacitor (Android) builds.
 *
 * Before this component existed, plugging a controller into the mobile app
 * only hid the on-screen pad (VirtualControls listens to gamepadconnected) —
 * nothing actually read the controller, so the game became uncontrollable.
 *
 * This polls the standard Web Gamepad API once per animation frame and
 * synthesises the KeyboardEvents the game already reads, per the user's
 * button -> action mapping from the Settings window (see gamepadConfig.ts).
 * Held directions auto-repeat keydown; action buttons fire one
 * keydown/keyup per press.
 *
 * Inert under Electron: the desktop shell's preload script
 * (client-desktop/electron/preload.js) already runs an equivalent loop, and
 * running both would double every press.
 */

type HeldState = { spec: KeySpec; repeat: boolean; nextRepeat: number };

const GamepadControls = () => {
  const [settings] = useGamepadSettings();
  const settingsRef = useRef<GamepadSettings>(settings);
  settingsRef.current = settings;

  useEffect(() => {
    // Electron's preload already bridges the gamepad — never double up.
    if (isElectron()) return;
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    // Per-virtual-input state so we emit keydown on press, keyup on release,
    // and auto-repeat held directions. Keyed by button index / axis name.
    const held = new Map<string, HeldState>();
    let raf = 0;
    let running = true;

    const releaseAll = () => {
      held.forEach((state) => dispatchKey('keyup', state.spec, false));
      held.clear();
    };

    const setInput = (id: string, active: boolean, action: GamepadAction, now: number) => {
      const prev = held.get(id);
      if (action === 'none') {
        if (prev) {
          dispatchKey('keyup', prev.spec, false);
          held.delete(id);
        }
        return;
      }
      const { spec, repeat } = ACTION_KEYS[action];
      if (active && !prev) {
        dispatchKey('keydown', spec, false);
        held.set(id, { spec, repeat, nextRepeat: now + REPEAT_MS });
      } else if (active && prev) {
        // Remap mid-press: release the old key so nothing sticks.
        if (prev.spec.key !== spec.key) {
          dispatchKey('keyup', prev.spec, false);
          dispatchKey('keydown', spec, false);
          held.set(id, { spec, repeat, nextRepeat: now + REPEAT_MS });
        } else if (repeat && now >= prev.nextRepeat) {
          dispatchKey('keydown', spec, true);
          prev.nextRepeat = now + REPEAT_MS;
        }
      } else if (!active && prev) {
        dispatchKey('keyup', prev.spec, false);
        held.delete(id);
      }
    };

    const firstConnectedPad = (): Gamepad | null => {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (pad && pad.connected) return pad;
      }
      return null;
    };

    const poll = (now: number) => {
      if (!running) return;
      const config = settingsRef.current;
      const pad = config.enabled ? firstConnectedPad() : null;

      if (!pad || isTextInputFocused()) {
        if (held.size > 0) releaseAll();
        raf = requestAnimationFrame(poll);
        return;
      }

      for (const [index, action] of Object.entries(config.buttonActions)) {
        const btn = pad.buttons[Number(index)];
        const active = !!btn && (btn.pressed || btn.value > 0.5);
        setInput(`b${index}`, active, action, now);
      }

      // Left stick -> virtual d-pad, with its own ids so the stick and the
      // real d-pad can each hold a direction without fighting.
      const stick = config.leftStickMovement;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const dz = config.deadZone;
      setInput('axLeft', stick && ax < -dz, 'moveLeft', now);
      setInput('axRight', stick && ax > dz, 'moveRight', now);
      setInput('axUp', stick && ay < -dz, 'moveUp', now);
      setInput('axDown', stick && ay > dz, 'moveDown', now);

      raf = requestAnimationFrame(poll);
    };

    // Release held keys if the app loses focus mid-press so movement never sticks.
    window.addEventListener('blur', releaseAll);
    window.addEventListener('gamepaddisconnected', releaseAll);
    raf = requestAnimationFrame(poll);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('gamepaddisconnected', releaseAll);
      releaseAll();
    };
  }, []);

  return null;
};

export default GamepadControls;
