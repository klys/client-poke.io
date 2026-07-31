import { getBackendBaseUrl } from "../game/backendConfig";
import { type DesignerSectionKey, designerSectionsByKey } from "./designerSections";
import {
  persistStoredDesignerSectionPayload,
  readStoredDesignerSectionPayload,
  type DesignerSectionState,
} from "./designerCache";

// Heavy sections (tilesets ~36MB, assets ~134MB) never travel the websocket:
// the server only announces version stubs and every client — designers
// included — downloads the state from /designer-sections/<key>.json. This
// module owns that download: it streams the body so the UI can render a real
// progress bar, dedupes concurrent requests for the same section, and
// persists the result into the designer cache (which notifies the editors
// through DESIGNER_CACHE_UPDATED_EVENT).

// Single source of truth for which sections the HTTP endpoint serves without
// auth (mirrors PUBLIC_SECTION_KEYS / HEAVY_SECTION_KEYS in server index.ts).
// Everything else requires a designer session token via Authorization: Bearer.
export const PUBLIC_DESIGNER_SECTION_KEYS: DesignerSectionKey[] = [
  "pokemons",
  "npcs",
  "players",
  "skillsGfx",
  "audio",
  "types",
  "battleInterface",
];
export const HEAVY_DESIGNER_SECTION_KEYS: DesignerSectionKey[] = [
  "assets",
  "tilesets",
  "battleBackgrounds",
];

const AUTH_TOKEN_STORAGE_KEY = "client-poke.io.auth.token";

function isDesignerOnlySection(sectionKey: DesignerSectionKey) {
  return (
    !PUBLIC_DESIGNER_SECTION_KEYS.includes(sectionKey) &&
    !HEAVY_DESIGNER_SECTION_KEYS.includes(sectionKey)
  );
}

function readAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export type DesignerSectionLoadPhase = "downloading" | "parsing" | "done" | "error";

export type DesignerSectionLoadProgress = {
  sectionKey: DesignerSectionKey;
  phase: DesignerSectionLoadPhase;
  loadedBytes: number;
  totalBytes: number | null;
};

type DesignerSectionStatePayload = {
  sectionKey: DesignerSectionKey;
  state: unknown;
  version: number;
  updatedAt: string | null;
  updatedByUsername: string | null;
};

type LoadListener = (progress: DesignerSectionLoadProgress) => void;

const loadListeners = new Set<LoadListener>();
const progressBySection = new Map<DesignerSectionKey, DesignerSectionLoadProgress>();
const inFlightBySection = new Map<DesignerSectionKey, Promise<boolean>>();

export function subscribeDesignerSectionLoad(listener: LoadListener) {
  loadListeners.add(listener);

  return () => {
    loadListeners.delete(listener);
  };
}

// Snapshot for components that mount after a download already started.
export function getDesignerSectionLoadProgress(
  sectionKey: DesignerSectionKey
): DesignerSectionLoadProgress | null {
  return progressBySection.get(sectionKey) ?? null;
}

function publishProgress(progress: DesignerSectionLoadProgress) {
  progressBySection.set(progress.sectionKey, progress);
  loadListeners.forEach((listener) => {
    try {
      listener(progress);
    } catch {
      /* one broken listener must not stall the download */
    }
  });
}

function isDesignerSectionKey(value: unknown): value is DesignerSectionKey {
  return typeof value === "string" && value in designerSectionsByKey;
}

export function sanitizeSectionStatePayload(
  value: unknown
): DesignerSectionStatePayload | null {
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

export function sanitizeBootstrapSectionState(
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

async function readResponseText(
  response: Response,
  onChunk: (loadedBytes: number, totalBytes: number | null) => void
) {
  const contentLength = Number.parseInt(response.headers.get("Content-Length") ?? "", 10);
  const totalBytes =
    Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;

  if (!response.body) {
    // Streaming unavailable (older WebView) — fall back to a one-shot read.
    const text = await response.text();
    onChunk(text.length, totalBytes);
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    loadedBytes += value.byteLength;
    onChunk(loadedBytes, totalBytes);
  }

  const merged = new Uint8Array(loadedBytes);
  let offset = 0;

  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return new TextDecoder().decode(merged);
}

async function fetchSectionOverHttp(sectionKey: DesignerSectionKey) {
  try {
    publishProgress({ sectionKey, phase: "downloading", loadedBytes: 0, totalBytes: null });

    const token = isDesignerOnlySection(sectionKey) ? readAuthToken() : null;
    const response = await fetch(
      `${getBackendBaseUrl()}/designer-sections/${sectionKey}.json`,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );

    if (!response.ok) {
      publishProgress({ sectionKey, phase: "error", loadedBytes: 0, totalBytes: null });
      return false;
    }

    let lastTotalBytes: number | null = null;
    let lastLoadedBytes = 0;
    const text = await readResponseText(response, (loadedBytes, totalBytes) => {
      lastLoadedBytes = loadedBytes;
      lastTotalBytes = totalBytes;
      publishProgress({ sectionKey, phase: "downloading", loadedBytes, totalBytes });
    });

    publishProgress({
      sectionKey,
      phase: "parsing",
      loadedBytes: lastLoadedBytes,
      totalBytes: lastTotalBytes,
    });

    const payload = sanitizeSectionStatePayload(JSON.parse(text));

    if (!payload || payload.sectionKey !== sectionKey) {
      publishProgress({
        sectionKey,
        phase: "error",
        loadedBytes: lastLoadedBytes,
        totalBytes: lastTotalBytes,
      });
      return false;
    }

    persistStoredDesignerSectionPayload(sectionKey, {
      state: sanitizeBootstrapSectionState(sectionKey, payload.state),
      version: payload.version,
      updatedAt: payload.updatedAt,
      updatedByUsername: payload.updatedByUsername,
    });
    publishProgress({
      sectionKey,
      phase: "done",
      loadedBytes: lastLoadedBytes,
      totalBytes: lastTotalBytes,
    });
    return true;
  } catch {
    publishProgress({ sectionKey, phase: "error", loadedBytes: 0, totalBytes: null });
    return false;
  }
}

// Downloads a section from the HTTP endpoint into the designer cache.
// Concurrent callers (e.g. the map editor and the bootstrap's version-stub
// refresh) share one request.
export function fetchDesignerSectionOverHttp(
  sectionKey: DesignerSectionKey
): Promise<boolean> {
  const inFlight = inFlightBySection.get(sectionKey);

  if (inFlight) {
    return inFlight;
  }

  const request = fetchSectionOverHttp(sectionKey).finally(() => {
    inFlightBySection.delete(sectionKey);
  });

  inFlightBySection.set(sectionKey, request);
  return request;
}

// Fetch only when the cache holds nothing yet — used by pages that need the
// section on mount but should not re-download it on every visit (version
// stubs from the socket trigger refreshes when the data actually changes).
export function ensureDesignerSectionOverHttp(
  sectionKey: DesignerSectionKey
): Promise<boolean> {
  if (readStoredDesignerSectionPayload(sectionKey).version !== null) {
    return Promise.resolve(true);
  }

  return fetchDesignerSectionOverHttp(sectionKey);
}
