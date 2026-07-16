import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
    dismissMapLoadOverlay,
    getMapLoadSnapshot,
    retryFailedMapChunks,
    subscribeMapLoad,
} from "./mapLoadProgress";

// If a load phase runs this long without settling (asset host unreachable,
// socket dead, request that never errors), surface the escape actions so the
// player is never stuck staring at a black screen with no option.
const STUCK_TIMEOUT_MS = 20000;

const buttonStyle: CSSProperties = {
    padding: "10px 24px",
    borderRadius: "8px",
    border: "1px solid #2c7a7b",
    background: "#285e61",
    color: "#e6fffa",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
};

/**
 * Full-screen overlay shown while entering a map: indeterminate while the
 * connection / maps payload settles, then a progress bar while the tile
 * chunks around the spawn point load. Failed loads expose Retry and
 * "Continue anyway" so the player always has a way out.
 */
const MapLoadingOverlay = () => {
    const snapshot = useSyncExternalStore(subscribeMapLoad, getMapLoadSnapshot);
    const [stuck, setStuck] = useState(false);

    const active = !snapshot.dismissed && snapshot.phase !== "ready";
    const phaseKey = `${snapshot.phase}:${snapshot.mapId ?? ""}`;

    useEffect(() => {
        setStuck(false);

        if (!active || snapshot.phase === "failed") {
            return;
        }

        const timer = window.setTimeout(() => setStuck(true), STUCK_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phaseKey, active]);

    if (!active) {
        return null;
    }

    const determinate = snapshot.phase === "chunks" || snapshot.phase === "failed";
    const percent =
        determinate && snapshot.totalChunks > 0
            ? Math.round((snapshot.settledChunks / snapshot.totalChunks) * 100)
            : 0;
    const failed = snapshot.phase === "failed";
    const label =
        snapshot.phase === "connecting"
            ? "Connecting…"
            : snapshot.phase === "mapData"
                ? "Downloading map data…"
                : failed
                    ? "Some map graphics failed to load."
                    : `Loading map… ${percent}%`;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 3400,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "18px",
                background: "#000",
                color: "#e2e8f0",
                fontFamily: "inherit",
                touchAction: "none",
            }}
        >
            {snapshot.mapName ? (
                <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "0.04em" }}>
                    {snapshot.mapName}
                </div>
            ) : null}
            <div style={{ fontSize: "15px", opacity: 0.85 }}>{label}</div>
            <div
                style={{
                    width: "min(320px, 70vw)",
                    height: "10px",
                    borderRadius: "5px",
                    background: "#1a202c",
                    border: "1px solid #2d3748",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        borderRadius: "5px",
                        background: failed ? "#c53030" : "#38b2ac",
                        transition: "width 200ms ease",
                        ...(determinate
                            ? { width: `${Math.max(percent, 4)}%` }
                            : {
                                width: "40%",
                                animation: "map-load-indeterminate 1.2s ease-in-out infinite",
                            }),
                    }}
                />
            </div>
            {(failed || stuck) ? (
                <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                    {failed ? (
                        <button style={buttonStyle} onClick={() => retryFailedMapChunks()}>
                            Retry
                        </button>
                    ) : (
                        <button style={buttonStyle} onClick={() => window.location.reload()}>
                            Reload
                        </button>
                    )}
                    <button
                        style={{ ...buttonStyle, background: "#2d3748", borderColor: "#4a5568" }}
                        onClick={() => dismissMapLoadOverlay()}
                    >
                        Continue anyway
                    </button>
                </div>
            ) : null}
            <style>
                {`@keyframes map-load-indeterminate {
                    0% { margin-left: -40%; }
                    100% { margin-left: 100%; }
                }`}
            </style>
        </div>
    );
};

export default MapLoadingOverlay;
