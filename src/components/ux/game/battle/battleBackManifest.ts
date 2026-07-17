import { assetUrl } from "../../../tilemap/serverAssets";

/**
 * Static battleback catalog exported from the designer battleBackgrounds
 * section (server-poke.io/tools/exportBattleBacksToAssetStorage.py). The
 * section itself is one of the heavy designer-only payloads, so regular
 * players never have it cached — the battle scene resolves the battleBack
 * name streamed in battle:state against this manifest instead.
 *
 * Loaded lazily on first use; consumers subscribe to re-render once it lands.
 */

export type BattleBackManifestEntry = {
  backgroundSrc: string;
  playerBaseSrc: string;
  enemyBaseSrc: string;
};

const MANIFEST_PATH = "/migration_exports/battlebacks/manifest.json";

let manifest: Record<string, BattleBackManifestEntry> | null = null;
let fetchStarted = false;
const listeners = new Set<() => void>();

function startFetch() {
  if (fetchStarted || typeof window === "undefined") {
    return;
  }
  fetchStarted = true;

  fetch(assetUrl(MANIFEST_PATH))
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data && typeof data === "object") {
        manifest = data as Record<string, BattleBackManifestEntry>;
        listeners.forEach((listener) => listener());
      }
    })
    .catch(() => {
      // Asset server unreachable: battles keep the configured default
      // backdrop. Allow a retry on the next battle.
      fetchStarted = false;
    });
}

export function normalizeBattleBackName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Returns the entry for a battleback name, kicking off the fetch if needed. */
export function getBattleBackManifestEntry(name: string): BattleBackManifestEntry | null {
  startFetch();
  if (!manifest) {
    return null;
  }
  return manifest[normalizeBattleBackName(name)] ?? null;
}

/** Notifies when the manifest finishes loading (for re-render hooks). */
export function subscribeBattleBackManifest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
