import React, { useEffect, useRef, useState } from 'react';
import { isCapacitor } from '../../platform';
import {
  ACTION_KEYS,
  GamepadAction,
  KeySpec,
  REPEAT_MS,
  VirtualPadButton,
  dispatchKey,
  isTextInputFocused,
  useGamepadSettings,
} from '../../input/gamepadConfig';
import './VirtualControls.css';

/**
 * On-screen touch controls for the Capacitor (Android) build only.
 *
 * The game reads physical keyboard input (`event.key` on window). These buttons
 * synthesise the same KeyboardEvents so gameplay needs no other changes. The
 * d-pad is fixed to movement; the A/B/X/Y actions, pad scale, opacity and
 * visibility are user-configurable in Settings -> Gamepad (gamepadConfig.ts).
 *
 * Movement is hold-to-move: the engine advances one step per keydown and stops
 * on keyup, so the d-pad auto-repeats keydown while held (mimicking OS key
 * repeat). Action buttons fire a single keydown/keyup per tap.
 *
 * Rendered only under Capacitor (never in the browser or Electron builds), and
 * hidden while a text field is focused so the native keyboard is unobstructed.
 * In the default "auto" visibility mode it also hides while a physical
 * gamepad is connected (GamepadControls.tsx drives the game instead) and comes
 * back when the last one is unplugged.
 */

type HoldButtonProps = {
  spec: KeySpec;
  repeat?: boolean;
  className: string;
  label: React.ReactNode;
  ariaLabel: string;
};

const HoldButton: React.FC<HoldButtonProps> = ({ spec, repeat, className, label, ariaLabel }) => {
  const intervalRef = useRef<number | null>(null);
  const pointerRef = useRef<number | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  const stopRepeat = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const end = () => {
    if (pointerRef.current === null) return;
    pointerRef.current = null;
    stopRepeat();
    dispatchKey('keyup', specRef.current, false);
  };

  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    pointerRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dispatchKey('keydown', specRef.current, false);
    if (repeat) {
      stopRepeat();
      intervalRef.current = window.setInterval(() => dispatchKey('keydown', specRef.current, true), REPEAT_MS);
    }
  };

  const handleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    end();
  };

  // Release the key if the component unmounts mid-press so movement never sticks.
  useEffect(() => end, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={end}
    >
      {label}
    </button>
  );
};

const anyGamepadConnected = () => {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (pad && pad.connected) return true;
  }
  return false;
};

const MOVE_SPECS = {
  up: ACTION_KEYS.moveUp.spec,
  down: ACTION_KEYS.moveDown.spec,
  left: ACTION_KEYS.moveLeft.spec,
  right: ACTION_KEYS.moveRight.spec,
};

/** A face button bound to "Unassigned" falls back to a no-op key nothing listens to. */
const NOOP_SPEC: KeySpec = { key: 'Unidentified', code: '', keyCode: 0 };

const actionSpec = (action: GamepadAction) => (action === 'none' ? NOOP_SPEC : ACTION_KEYS[action].spec);
const actionRepeats = (action: GamepadAction) => action !== 'none' && ACTION_KEYS[action].repeat;
const actionLabel = (action: GamepadAction) => (action === 'none' ? 'Unassigned' : ACTION_KEYS[action].label);

const VirtualControls: React.FC = () => {
  const [enabled] = useState(isCapacitor);
  const [typing, setTyping] = useState(false);
  const [gamepad, setGamepad] = useState(false);
  const [settings] = useGamepadSettings();

  useEffect(() => {
    if (!enabled) return;
    const update = () => setTyping(isTextInputFocused());
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    update();
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, [enabled]);

  // Track physical-controller presence for the "auto" visibility mode.
  useEffect(() => {
    if (!enabled) return;
    const onConnect = () => setGamepad(true);
    const onDisconnect = () => setGamepad(anyGamepadConnected());
    setGamepad(anyGamepadConnected());
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, [enabled]);

  const { visibility, scale, opacity, buttonActions } = settings.virtual;

  if (!enabled || typing) return null;
  if (visibility === 'hidden') return null;
  // Auto-hide only when the physical pad can actually drive the game;
  // if gamepad controls are disabled in Settings, keep the touch pad up.
  if (visibility === 'auto' && gamepad && settings.enabled) return null;

  const faceButton = (id: VirtualPadButton, className: string) => {
    const action = buttonActions[id];
    return (
      <HoldButton
        spec={actionSpec(action)}
        repeat={actionRepeats(action)}
        className={className}
        ariaLabel={actionLabel(action)}
        label={id.toUpperCase()}
      />
    );
  };

  const style = {
    '--vc-scale': scale,
    '--vc-opacity': opacity,
  } as React.CSSProperties;

  return (
    <div className="vc-root" style={style} aria-hidden={false}>
      <div className="vc-dpad">
        <HoldButton spec={MOVE_SPECS.up} repeat className="vc-dbtn vc-up" ariaLabel="Move up" label="▲" />
        <HoldButton spec={MOVE_SPECS.left} repeat className="vc-dbtn vc-left" ariaLabel="Move left" label="◀" />
        <HoldButton spec={MOVE_SPECS.right} repeat className="vc-dbtn vc-right" ariaLabel="Move right" label="▶" />
        <HoldButton spec={MOVE_SPECS.down} repeat className="vc-dbtn vc-down" ariaLabel="Move down" label="▼" />
      </div>

      <div className="vc-actions">
        {faceButton('y', 'vc-abtn vc-y')}
        {faceButton('x', 'vc-abtn vc-x')}
        {faceButton('b', 'vc-abtn vc-b')}
        {faceButton('a', 'vc-abtn vc-a')}
      </div>
    </div>
  );
};

export default VirtualControls;
