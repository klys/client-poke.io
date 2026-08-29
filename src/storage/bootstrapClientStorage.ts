import { hydrateDesignerCacheFromIndexedDb } from "../components/designer/designerCache";
import { HEAVY_DESIGNER_SECTION_KEYS } from "../components/designer/designerSectionHttp";
import { hydratePlayableMapsCacheFromIndexedDb } from "../components/game/playableMapRuntime";
import { refreshStorageStatus, requestPersistentStorage } from "./clientStorage";

let bootstrapPromise: Promise<void> | null = null;

/**
 * Restores the large caches (playable maps, designer sections) from
 * IndexedDB into memory and asks for persistent storage. App.tsx awaits this
 * before rendering so every synchronous cache reader sees the warm data and
 * the first socket sync negotiates with the stored versions.
 */
export function bootstrapClientStorage(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await Promise.all([
        hydratePlayableMapsCacheFromIndexedDb(),
        hydrateDesignerCacheFromIndexedDb(HEAVY_DESIGNER_SECTION_KEYS),
      ]);
      // Non-blocking: the answer only matters to the Settings panel / prompt.
      void requestPersistentStorage().then(() => refreshStorageStatus());
    })();
  }

  return bootstrapPromise;
}
