import { useEffect, useRef } from "react";
import { useAuth } from "../../context/authContext";
import {
  persistPlayableMapsSyncPayload,
  sanitizePlayableMapsSyncPayload,
} from "../game/playableMapRuntime";
import { getBackendBaseUrl } from "../game/backendConfig";
import {
  designerSectionsByKey,
  type DesignerSectionKey,
} from "./designerSections";
import {
  cleanupStaleDesignerStorage,
  persistStoredDesignerSectionPayload,
  readStoredDesignerSectionPayload,
  type DesignerSectionState,
} from "./designerCache";

type DesignerSectionStatePayload = {
  sectionKey: DesignerSectionKey;
  state: unknown;
  version: number;
  updatedAt: string | null;
  updatedByUsername: string | null;
};

type DesignerSectionVersionPayload = {
  sectionKey: DesignerSectionKey;
  version: number | null;
  updatedAt: string | null;
};

const DESIGNER_SECTION_KEYS = Object.keys(
  designerSectionsByKey
) as DesignerSectionKey[];
const PUBLIC_DESIGNER_SECTION_KEYS: DesignerSectionKey[] = [
  "pokemons",
  "npcs",
  "players",
  "skillsGfx",
  "audio",
  "types",
  "battleInterface",
];
const GENERIC_DESIGNER_SECTION_KEYS = DESIGNER_SECTION_KEYS.filter(
  (sectionKey) => sectionKey !== "mapsEditor"
);
// Never eagerly preload the heavy media catalogs (assets/tilesets/battle-
// backgrounds run to tens of MB): they cannot fit in localStorage, so their
// cached version never persists and every connect would re-stream the full
// payload over the websocket — enough queued traffic to starve the Socket.IO
// heartbeat into "ping timeout"/"transport error" loops. Their designer pages
// join the sections on demand instead.
const HEAVY_DESIGNER_SECTION_KEYS: DesignerSectionKey[] = [
  "assets",
  "tilesets",
  "battleBackgrounds",
];
const DESIGNER_ONLY_SECTION_KEYS = GENERIC_DESIGNER_SECTION_KEYS.filter(
  (sectionKey) =>
    !PUBLIC_DESIGNER_SECTION_KEYS.includes(sectionKey) &&
    !HEAVY_DESIGNER_SECTION_KEYS.includes(sectionKey)
);

function isDesignerSectionKey(value: unknown): value is DesignerSectionKey {
  return typeof value === "string" && value in designerSectionsByKey;
}

// Native app builds (Capacitor / Electron) ship snapshots of the public
// sections at /bundled-data/sections/<key>.json. Seeding them before the
// first designer:section:join gives each join a version to negotiate with,
// so the server answers with a tiny version payload instead of streaming the
// full state. Browsers don't have the files — the fetches fail once and the
// normal socket sync takes over.
let bundledSectionsSeedPromise: Promise<void> | null = null;

function ensureBundledSectionsSeeded(): Promise<void> {
  if (!bundledSectionsSeedPromise) {
    bundledSectionsSeedPromise = (async () => {
      await Promise.all(
        PUBLIC_DESIGNER_SECTION_KEYS.map(async (sectionKey) => {
          try {
            if (readStoredDesignerSectionPayload(sectionKey).version !== null) {
              return; // a cached (possibly newer) payload already exists
            }

            const response = await fetch(`/bundled-data/sections/${sectionKey}.json`);

            if (!response.ok) {
              return;
            }

            const payload = sanitizeSectionStatePayload(await response.json());

            if (!payload || payload.sectionKey !== sectionKey) {
              return;
            }

            persistStoredDesignerSectionPayload(sectionKey, {
              state: sanitizeBootstrapSectionState(sectionKey, payload.state),
              version: payload.version,
              updatedAt: payload.updatedAt,
              updatedByUsername: payload.updatedByUsername,
            });
          } catch {
            /* no bundle for this section — the socket sync handles it */
          }
        })
      );
    })();
  }

  return bundledSectionsSeedPromise;
}

function sanitizeBootstrapSectionState(
  sectionKey: DesignerSectionKey,
  value: unknown
): DesignerSectionState {
  const fallback = readStoredDesignerSectionPayload(sectionKey).state;

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<DesignerSectionState>;
  const items = Array.isArray(candidate.items)
    ? candidate.items.filter(
        (item): item is DesignerSectionState["items"][number] =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      )
    : fallback.items;

  return {
    categories: Array.isArray(candidate.categories)
      ? candidate.categories.filter(
          (category): category is string => typeof category === "string"
        )
      : fallback.categories,
    items,
  };
}

function sanitizeSectionStatePayload(value: unknown): DesignerSectionStatePayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<DesignerSectionStatePayload>;

  if (
    !isDesignerSectionKey(candidate.sectionKey) ||
    typeof candidate.version !== "number" ||
    !Number.isFinite(candidate.version)
  ) {
    return null;
  }

  return {
    sectionKey: candidate.sectionKey,
    state: candidate.state,
    version: Math.max(1, Math.round(candidate.version)),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    updatedByUsername:
      typeof candidate.updatedByUsername === "string" ? candidate.updatedByUsername : null,
  };
}

function sanitizeSectionVersionPayload(value: unknown): DesignerSectionVersionPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<DesignerSectionVersionPayload>;

  if (!isDesignerSectionKey(candidate.sectionKey)) {
    return null;
  }

  return {
    sectionKey: candidate.sectionKey,
    version:
      typeof candidate.version === "number" && Number.isFinite(candidate.version)
        ? Math.max(1, Math.round(candidate.version))
        : null,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
  };
}

// The server answers game clients (no designer access) with version stubs
// only — full section catalogs never travel the websocket. This fetches the
// announced state from the cacheable HTTP endpoint instead.
async function fetchSharedSectionOverHttp(sectionKey: DesignerSectionKey) {
  try {
    const response = await fetch(
      `${getBackendBaseUrl()}/designer-sections/${sectionKey}.json`
    );

    if (!response.ok) {
      return false;
    }

    const payload = sanitizeSectionStatePayload(await response.json());

    if (!payload || payload.sectionKey !== sectionKey) {
      return false;
    }

    persistStoredDesignerSectionPayload(sectionKey, {
      state: sanitizeBootstrapSectionState(sectionKey, payload.state),
      version: payload.version,
      updatedAt: payload.updatedAt,
      updatedByUsername: payload.updatedByUsername,
    });
    return true;
  } catch {
    return false;
  }
}

export default function DesignerDataBootstrap() {
  const { authReady, authenticated, hasPermission, socket } = useAuth();
  const canAccessDesigner = hasPermission("designer.access");
  const sectionRetryRef = useRef(
    new Map<DesignerSectionKey, { timer: number | null; attempts: number }>()
  );

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return;
    }

    // Purge dirty storage from previous sessions before syncing, so oversized or
    // legacy entries can't hold the quota hostage and keep caches stale.
    cleanupStaleDesignerStorage();

    // The server only ever answers game clients with version stubs; when the
    // announced version differs from the cache, refresh the section over the
    // HTTP endpoint (a few retries with backoff — the cached/bundled copy
    // keeps the game playable in the meantime).
    const scheduleSectionRefresh = (sectionKey: DesignerSectionKey) => {
      if (!PUBLIC_DESIGNER_SECTION_KEYS.includes(sectionKey)) {
        return;
      }

      const entry =
        sectionRetryRef.current.get(sectionKey) ?? { timer: null, attempts: 0 };
      sectionRetryRef.current.set(sectionKey, entry);

      if (entry.timer !== null) {
        return; // a refresh is already scheduled
      }

      const run = async () => {
        entry.timer = null;

        if (await fetchSharedSectionOverHttp(sectionKey)) {
          entry.attempts = 0;
          return;
        }

        entry.attempts += 1;

        if (entry.attempts >= 5) {
          entry.attempts = 0;
          return;
        }

        entry.timer = window.setTimeout(() => void run(), Math.min(2000 * 2 ** entry.attempts, 60000));
      };

      void run();
    };

    const preloadSharedData = async () => {
      // Native builds seed the bundled snapshots first so the joins below
      // carry a version and the server skips the full-state stream.
      await ensureBundledSectionsSeeded();

      // Browsers with a cold cache pull the shared catalogs over HTTP before
      // joining — the socket only ever supplies version stubs to game clients.
      await Promise.all(
        PUBLIC_DESIGNER_SECTION_KEYS.map(async (sectionKey) => {
          if (readStoredDesignerSectionPayload(sectionKey).version === null) {
            await fetchSharedSectionOverHttp(sectionKey);
          }
        })
      );

      PUBLIC_DESIGNER_SECTION_KEYS.forEach((sectionKey) => {
        const storedPayload = readStoredDesignerSectionPayload(sectionKey);

        socket.emit("designer:section:join", {
          sectionKey,
          version: storedPayload.version,
          seedState:
            storedPayload.version === null && storedPayload.state.items.length > 0
              ? storedPayload.state
              : undefined,
        });
      });
    };

    const preloadDesignerData = () => {
      DESIGNER_ONLY_SECTION_KEYS.forEach((sectionKey) => {
        const storedPayload = readStoredDesignerSectionPayload(sectionKey);

        socket.emit("designer:section:join", {
          sectionKey,
          version: storedPayload.version,
          seedState:
            storedPayload.version === null && storedPayload.state.items.length > 0
              ? storedPayload.state
              : undefined,
        });
      });
      // No eager designer:maps:join here: MapEditorPage and Section join the
      // maps room themselves when opened, and the old eager join uploaded the
      // full multi-MB local maps snapshot as seedState on every connect.
    };

    const handleSectionState = (payload: unknown) => {
      const nextPayload = sanitizeSectionStatePayload(payload);

      if (!nextPayload) {
        return;
      }

      persistStoredDesignerSectionPayload(nextPayload.sectionKey, {
        state: sanitizeBootstrapSectionState(nextPayload.sectionKey, nextPayload.state),
        version: nextPayload.version,
        updatedAt: nextPayload.updatedAt,
        updatedByUsername: nextPayload.updatedByUsername,
      });
    };

    const handleSectionVersion = (payload: unknown) => {
      const nextPayload = sanitizeSectionVersionPayload(payload);

      if (!nextPayload) {
        return;
      }

      const storedPayload = readStoredDesignerSectionPayload(nextPayload.sectionKey);

      // Version matches the state we hold: just refresh the metadata.
      if (storedPayload.version === nextPayload.version) {
        persistStoredDesignerSectionPayload(nextPayload.sectionKey, {
          ...storedPayload,
          version: nextPayload.version,
          updatedAt: nextPayload.updatedAt,
        });
        return;
      }

      // The server announced a version we don't hold (game clients never get
      // the full state over the socket): pull it from the HTTP endpoint.
      if (nextPayload.version !== null) {
        scheduleSectionRefresh(nextPayload.sectionKey);
      }
    };

    const handleMapsState = (payload: unknown) => {
      const syncPayload = sanitizePlayableMapsSyncPayload(payload);

      if (!syncPayload) {
        return;
      }

      persistPlayableMapsSyncPayload(syncPayload);
    };

    socket.on("designer:section:state", handleSectionState);
    socket.on("designer:section:version", handleSectionVersion);
    socket.on("playableMaps:state", handleMapsState);
    socket.on("connect", preloadSharedData);

    if (canAccessDesigner) {
      socket.on("connect", preloadDesignerData);
    }

    if (!socket.connected) {
      socket.connect();
    } else {
      preloadSharedData();

      if (canAccessDesigner) {
        preloadDesignerData();
      }
    }

    const sectionRetries = sectionRetryRef.current;

    return () => {
      socket.off("designer:section:state", handleSectionState);
      socket.off("designer:section:version", handleSectionVersion);
      socket.off("playableMaps:state", handleMapsState);
      socket.off("connect", preloadSharedData);

      if (canAccessDesigner) {
        socket.off("connect", preloadDesignerData);
      }

      sectionRetries.forEach((entry) => {
        if (entry.timer !== null) {
          window.clearTimeout(entry.timer);
          entry.timer = null;
        }
      });
    };
  }, [authReady, authenticated, canAccessDesigner, socket]);

  return null;
}
