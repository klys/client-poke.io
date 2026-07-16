import { useEffect, useState } from "react";
import { isCapacitor } from "../../platform";

/**
 * Compact-UX detection for game screens.
 *
 * Chakra's width-based breakpoints ({ base, md }) betray us on phones in
 * landscape: an 812x375 phone reports width >= 768px, so every component
 * picks its DESKTOP variant (big fonts, draggable windows, hover mechanics)
 * on a 5-inch touch screen. Compact mode keys off the native shell and the
 * viewport HEIGHT instead, so landscape phones get the touch-sized UI.
 *
 * Used two ways:
 *  - `useCompactUx()` in components that need different sizes/mechanics.
 *  - `data-compact-ux` on <html> (see installCompactUxAttribute), which the
 *    global stylesheet uses to shrink the rem-based Chakra scale everywhere.
 */
const COMPACT_MEDIA_QUERY = "(max-height: 520px), (max-width: 480px)";

export function isCompactUx(): boolean {
  if (isCapacitor()) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(COMPACT_MEDIA_QUERY).matches;
}

export function useCompactUx(): boolean {
  const [compact, setCompact] = useState(isCompactUx);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_MEDIA_QUERY);
    const update = () => setCompact(isCompactUx());

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}

/**
 * Keeps `data-compact-ux` on <html> in sync so plain CSS can react to compact
 * mode (index.css shrinks the root font size, scaling all rem-based Chakra
 * tokens). Call once at app startup.
 */
export function installCompactUxAttribute() {
  if (typeof document === "undefined") {
    return;
  }

  const apply = () => {
    if (isCompactUx()) {
      document.documentElement.setAttribute("data-compact-ux", "1");
    } else {
      document.documentElement.removeAttribute("data-compact-ux");
    }
  };

  apply();
  window.matchMedia(COMPACT_MEDIA_QUERY).addEventListener("change", apply);
}
