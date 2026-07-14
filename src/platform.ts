/**
 * Runtime platform detection for the cross-platform client.
 *
 * The same web bundle runs in three places:
 *   - a normal browser
 *   - the Capacitor Android app (WebView) — the native runtime injects a
 *     `window.Capacitor` bridge object into the page
 *   - the Electron desktop app
 *
 * These helpers let platform-specific UI (e.g. the on-screen touch controls)
 * render only where it belongs, without adding a build-time dependency.
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  platform?: string;
  isNative?: boolean;
};

const getCapacitor = (): CapacitorGlobal | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { Capacitor?: CapacitorGlobal; top?: { Capacitor?: CapacitorGlobal } | null };
  if (w.Capacitor) return w.Capacitor;
  // The game is sometimes embedded in a same-origin iframe (the /map frame);
  // the native bridge lives on the top window there.
  try {
    const top = w.top;
    if (top && top.Capacitor) return top.Capacitor;
  } catch {
    /* cross-origin top frame — ignore */
  }
  return undefined;
};

/** True only inside the native Capacitor shell (Android/iOS), not the browser. */
export const isCapacitor = (): boolean => {
  const cap = getCapacitor();
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
  if (typeof cap.isNative === 'boolean') return cap.isNative;
  // Fallback: a platform other than 'web' means we're native.
  const platform = cap.getPlatform?.() ?? cap.platform;
  return !!platform && platform !== 'web';
};

/** True inside the Electron desktop shell. */
export const isElectron = (): boolean => {
  if (typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)) {
    return true;
  }
  return typeof window !== 'undefined' &&
    !!(window as unknown as { process?: { type?: string } }).process?.type;
};

/** 'android' | 'ios' | 'electron' | 'web' */
export const getPlatform = (): string => {
  const cap = getCapacitor();
  if (cap) {
    const platform = cap.getPlatform?.() ?? cap.platform;
    if (platform && platform !== 'web') return platform;
  }
  if (isElectron()) return 'electron';
  return 'web';
};
