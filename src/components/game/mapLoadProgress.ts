// Shared progress store for the map-entry loading overlay. Map.tsx registers
// the chunk images that cover the player's initial viewport ("priority"
// chunks — the rest stay lazy and load as the camera reaches them),
// TileMapSurface reports each one as it loads or exhausts its retries, and
// MapLoadingOverlay renders the aggregate. Kept outside React state so the
// overlay, the map and every chunk image can share it without prop drilling
// through the camera tree.

export type MapLoadPhase =
    | "connecting" // socket up / player entity not yet received
    | "mapData" // player exists but the maps payload hasn't arrived
    | "chunks" // waiting on the priority tile chunks
    | "failed" // some chunks exhausted their retries
    | "ready";

export type MapLoadSnapshot = {
    phase: MapLoadPhase;
    mapId: string | null;
    mapName: string;
    totalChunks: number;
    settledChunks: number;
    failedChunks: number;
    /** Bumped by the overlay's Retry button; failed chunks reload on change. */
    retryNonce: number;
    /** True after "Continue anyway" — hides the overlay until the next load. */
    dismissed: boolean;
};

const pendingChunks = new Set<string>();
const failedChunks = new Set<string>();
const listeners = new Set<() => void>();

let snapshot: MapLoadSnapshot = {
    phase: "connecting",
    mapId: null,
    mapName: "",
    totalChunks: 0,
    settledChunks: 0,
    failedChunks: 0,
    retryNonce: 0,
    dismissed: false,
};

function publish(next: Partial<MapLoadSnapshot>) {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
}

export function subscribeMapLoad(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getMapLoadSnapshot() {
    return snapshot;
}

/** Overlay states with nothing to count (connecting / waiting for map data). */
export function setMapLoadWaiting(phase: "connecting" | "mapData") {
    if (snapshot.phase === phase) {
        return;
    }

    pendingChunks.clear();
    failedChunks.clear();
    publish({
        phase,
        mapId: null,
        totalChunks: 0,
        settledChunks: 0,
        failedChunks: 0,
        dismissed: false,
    });
}

export function startMapLoad(mapId: string, mapName: string, chunkKeys: string[]) {
    if (snapshot.mapId === mapId && snapshot.phase !== "mapData" && snapshot.phase !== "connecting") {
        return; // already tracking this map
    }

    pendingChunks.clear();
    failedChunks.clear();
    chunkKeys.forEach((key) => pendingChunks.add(key));
    publish({
        phase: chunkKeys.length === 0 ? "ready" : "chunks",
        mapId,
        mapName,
        totalChunks: chunkKeys.length,
        settledChunks: 0,
        failedChunks: 0,
        dismissed: false,
    });
}

export function reportMapChunkResult(mapId: string, chunkKey: string, loaded: boolean) {
    if (snapshot.mapId !== mapId || !pendingChunks.has(chunkKey)) {
        return; // stale report from a previous map, or a duplicate
    }

    pendingChunks.delete(chunkKey);

    if (!loaded) {
        failedChunks.add(chunkKey);
    }

    const settledChunks = snapshot.totalChunks - pendingChunks.size;
    const phase =
        pendingChunks.size > 0 ? "chunks" : failedChunks.size > 0 ? "failed" : "ready";

    publish({ settledChunks, failedChunks: failedChunks.size, phase });
}

/** Re-queue every failed chunk and tell their images to reload. */
export function retryFailedMapChunks() {
    if (failedChunks.size === 0) {
        return;
    }

    failedChunks.forEach((key) => pendingChunks.add(key));
    failedChunks.clear();
    publish({
        phase: "chunks",
        settledChunks: snapshot.totalChunks - pendingChunks.size,
        failedChunks: 0,
        retryNonce: snapshot.retryNonce + 1,
        dismissed: false,
    });
}

export function dismissMapLoadOverlay() {
    publish({ dismissed: true });
}
