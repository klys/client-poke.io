import React, { useEffect, useRef, useState } from 'react';
import { isCapacitor } from '../../platform';
import './VirtualControls.css';

/**
 * On-screen touch controls for the Capacitor (Android) build only.
 *
 * The game reads physical keyboard input (`event.key` on window). These buttons
 * synthesise the same KeyboardEvents so gameplay needs no other changes:
 *
 *   D-pad  -> ArrowUp / ArrowDown / ArrowLeft / ArrowRight
 *   A      -> Enter
 *   B      -> Escape
 *   X      -> Space
 *   Y      -> "m"  (open menu — wire your menu UI to the 'm' key)
 *
 * Movement is hold-to-move: the engine advances one step per keydown and stops
 * on keyup, so the d-pad auto-repeats keydown while held (mimicking OS key
 * repeat). Action buttons fire a single keydown/keyup per tap.
 *
 * Rendered only under Capacitor (never in the browser or Electron builds), and
 * hidden while a text field is focused so the native keyboard is unobstructed.
 * Also hidden while a physical gamepad is connected — plug one in and the
 * on-screen buttons disappear; unplug it and they come back.
 */

type KeySpec = { key: string; code: string; keyCode: number };

type ButtonId = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'x' | 'y';

const KEYS: Record<ButtonId, KeySpec> = {
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  a: { key: 'Enter', code: 'Enter', keyCode: 13 },
  b: { key: 'Escape', code: 'Escape', keyCode: 27 },
  x: { key: ' ', code: 'Space', keyCode: 32 },
  y: { key: 'm', code: 'KeyM', keyCode: 77 },
};

// How fast a held d-pad button repeats keydown, in ms. Tune to taste.
const REPEAT_MS = 100;

const dispatchKey = (type: 'keydown' | 'keyup', spec: KeySpec, repeat: boolean) => {
  const event = new KeyboardEvent(type, {
    key: spec.key,
    code: spec.code,
    bubbles: true,
    cancelable: true,
    repeat,
  });
  // Legacy keyCode/which for any handler that still reads them (the constructor
  // ignores them, so define them explicitly).
  try {
    Object.defineProperty(event, 'keyCode', { get: () => spec.keyCode });
    Object.defineProperty(event, 'which', { get: () => spec.keyCode });
  } catch {
    /* ignore */
  }
  window.dispatchEvent(event);
};

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
    dispatchKey('keyup', spec, false);
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
    dispatchKey('keydown', spec, false);
    if (repeat) {
      stopRepeat();
      intervalRef.current = window.setInterval(() => dispatchKey('keydown', spec, true), REPEAT_MS);
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

const isTextInputFocused = () => {
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
};

const anyGamepadConnected = () => {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (pad && pad.connected) return true;
  }
  return false;
};

const VirtualControls: React.FC = () => {
  const [enabled] = useState(isCapacitor);
  const [typing, setTyping] = useState(false);
  const [gamepad, setGamepad] = useState(false);

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

  // Hide the on-screen pad when a physical controller is present, and bring it
  // back when the last one is unplugged.
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

  if (!enabled || typing || gamepad) return null;

  return (
    <div className="vc-root" aria-hidden={false}>
      <div className="vc-dpad">
        <HoldButton spec={KEYS.up} repeat className="vc-dbtn vc-up" ariaLabel="Move up" label="▲" />
        <HoldButton spec={KEYS.left} repeat className="vc-dbtn vc-left" ariaLabel="Move left" label="◀" />
        <HoldButton spec={KEYS.right} repeat className="vc-dbtn vc-right" ariaLabel="Move right" label="▶" />
        <HoldButton spec={KEYS.down} repeat className="vc-dbtn vc-down" ariaLabel="Move down" label="▼" />
      </div>

      <div className="vc-actions">
        <HoldButton spec={KEYS.y} className="vc-abtn vc-y" ariaLabel="Open menu" label="Y" />
        <HoldButton spec={KEYS.x} className="vc-abtn vc-x" ariaLabel="Space" label="X" />
        <HoldButton spec={KEYS.b} className="vc-abtn vc-b" ariaLabel="Cancel" label="B" />
        <HoldButton spec={KEYS.a} className="vc-abtn vc-a" ariaLabel="Confirm" label="A" />
      </div>
    </div>
  );
};

export default VirtualControls;
