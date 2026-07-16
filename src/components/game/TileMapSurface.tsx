import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { resolveServerAssetUrl } from "../tilemap/serverAssets";
import type { PlayableMapTileMapProfile } from "../tilemap/tileMapTypes";
import {
    getMapLoadSnapshot,
    reportMapChunkResult,
    subscribeMapLoad,
} from "./mapLoadProgress";

// A failed chunk request (asset host hiccup, proxy timeout) used to leave the
// tile permanently black — retry a few times with a cache-busting query
// before declaring it failed to the loading overlay.
const MAX_CHUNK_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

export function tileMapChunkKey(plane: "background" | "foreground", col: number, row: number) {
    return `${plane}-${col}-${row}`;
}

const ChunkImage = ({
    src,
    mapId,
    chunkKey,
    priority,
    style,
}: {
    src: string;
    mapId?: string;
    chunkKey: string;
    priority: boolean;
    style: CSSProperties;
}) => {
    const [attempt, setAttempt] = useState(0);
    const failedRef = useRef(false);
    const retryTimerRef = useRef<number | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const retryNonce = useSyncExternalStore(
        subscribeMapLoad,
        () => getMapLoadSnapshot().retryNonce
    );
    const trackedMapId = useSyncExternalStore(
        subscribeMapLoad,
        () => getMapLoadSnapshot().mapId
    );

    // The overlay's Retry button re-queued the failed chunks; start over.
    useEffect(() => {
        if (failedRef.current) {
            failedRef.current = false;
            setAttempt(0);
        }
    }, [retryNonce]);

    // Child commits run before the parent effect that registers the pending
    // chunk set, so a cached image can finish before the store tracks this
    // map. Re-report once the store catches up (duplicates are ignored).
    useEffect(() => {
        if (!priority || !mapId || trackedMapId !== mapId) {
            return;
        }

        const img = imgRef.current;

        if (failedRef.current) {
            reportMapChunkResult(mapId, chunkKey, false);
        } else if (img && img.complete && img.naturalWidth > 0) {
            reportMapChunkResult(mapId, chunkKey, true);
        }
    }, [trackedMapId, priority, mapId, chunkKey]);

    useEffect(() => () => {
        if (retryTimerRef.current !== null) {
            window.clearTimeout(retryTimerRef.current);
        }
    }, []);

    const reportResult = (loaded: boolean) => {
        if (priority && mapId) {
            reportMapChunkResult(mapId, chunkKey, loaded);
        }
    };

    const handleError = () => {
        if (attempt < MAX_CHUNK_ATTEMPTS - 1) {
            retryTimerRef.current = window.setTimeout(
                () => setAttempt((current) => current + 1),
                RETRY_BASE_DELAY_MS * 2 ** attempt
            );
            return;
        }

        failedRef.current = true;
        reportResult(false);
    };

    const resolved = resolveServerAssetUrl(src);
    const url =
        attempt === 0
            ? resolved
            : `${resolved}${resolved.includes("?") ? "&" : "?"}retry=${retryNonce}-${attempt}`;

    return (
        <img
            src={url}
            alt=""
            draggable={false}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => reportResult(true)}
            onError={handleError}
            ref={(img) => {
                imgRef.current = img;
                // Cached images can complete before React attaches the load
                // listener; settle them straight from the ref.
                if (img && img.complete && img.naturalWidth > 0) {
                    reportResult(true);
                }
            }}
            style={style}
        />
    );
};

/**
 * Renders one baked plane (background or foreground) of a tile map as
 * absolutely-positioned chunk images. Chunks decode lazily, ignore pointer
 * events, and cost no layout/paint work beyond the browser's compositor, so
 * large Essentials maps stay cheap on mobile/webview targets. Chunks listed
 * in priorityKeys (the ones covering the player's spawn viewport) load
 * eagerly and report to the map-loading overlay.
 */
const TileMapSurface = ({
    tileMap,
    plane,
    zIndex,
    mapId,
    priorityKeys,
}: {
    tileMap: PlayableMapTileMapProfile;
    plane: "background" | "foreground";
    zIndex: number;
    mapId?: string;
    priorityKeys?: ReadonlySet<string>;
}) => {
    const baked = tileMap.baked;

    if (!baked) {
        return null;
    }

    const chunks = plane === "background" ? baked.background : baked.foreground;

    if (chunks.length === 0) {
        return null;
    }

    const chunkPixels = baked.chunkCells * tileMap.tileSize;

    return (
        <>
            {chunks.map((chunk) => {
                const chunkKey = tileMapChunkKey(plane, chunk.col, chunk.row);

                return (
                    <ChunkImage
                        key={chunkKey}
                        src={chunk.src}
                        mapId={mapId}
                        chunkKey={chunkKey}
                        priority={Boolean(priorityKeys?.has(chunkKey))}
                        style={{
                            position: "absolute",
                            left: `${chunk.col * chunkPixels}px`,
                            top: `${chunk.row * chunkPixels}px`,
                            width: `${chunk.width}px`,
                            height: `${chunk.height}px`,
                            imageRendering: "pixelated",
                            pointerEvents: "none",
                            userSelect: "none",
                            zIndex,
                        }}
                    />
                );
            })}
        </>
    );
};

export default TileMapSurface;
