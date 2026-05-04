import { useEffect } from "react";
import { useAuth } from "../../context/authContext";
import {
  buildPlayableMapsSnapshot,
  getPlayableMapsCacheVersion,
  loadPlayableMapsState,
  persistPlayableMapsSyncPayload,
  sanitizePlayableMapsSyncPayload,
} from "../game/playableMapRuntime";
import {
  designerSectionsByKey,
  type DesignerSectionKey,
} from "./designerSections";
import {
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
const GENERIC_DESIGNER_SECTION_KEYS = DESIGNER_SECTION_KEYS.filter(
  (sectionKey) => sectionKey !== "mapsEditor"
);

function isDesignerSectionKey(value: unknown): value is DesignerSectionKey {
  return typeof value === "string" && value in designerSectionsByKey;
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

export default function DesignerDataBootstrap() {
  const { authReady, authenticated, hasPermission, socket } = useAuth();
  const canAccessDesigner = hasPermission("designer.access");

  useEffect(() => {
    if (!authReady || !authenticated || !socket || !canAccessDesigner) {
      return;
    }

    const preloadDesignerData = () => {
      GENERIC_DESIGNER_SECTION_KEYS.forEach((sectionKey) => {
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

      socket.emit("designer:maps:join", {
        version: getPlayableMapsCacheVersion(),
        seedState: buildPlayableMapsSnapshot(loadPlayableMapsState()),
      });
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

      persistStoredDesignerSectionPayload(nextPayload.sectionKey, {
        ...storedPayload,
        version: nextPayload.version,
        updatedAt: nextPayload.updatedAt,
      });
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
    socket.on("connect", preloadDesignerData);

    if (!socket.connected) {
      socket.connect();
    } else {
      preloadDesignerData();
    }

    return () => {
      socket.off("designer:section:state", handleSectionState);
      socket.off("designer:section:version", handleSectionVersion);
      socket.off("playableMaps:state", handleMapsState);
      socket.off("connect", preloadDesignerData);
    };
  }, [authReady, authenticated, canAccessDesigner, socket]);

  return null;
}
