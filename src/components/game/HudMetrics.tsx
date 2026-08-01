import { useContext, useEffect, useState, type CSSProperties } from "react";
import { AppContext } from "../../context/appContext";
import { useGameSettings } from "../../settings/gameSettings";

const LATENCY_PROBE_INTERVAL_MS = 3000;
const LATENCY_PROBE_TIMEOUT_MS = 4000;

/**
 * Optional performance chips (top-left, clear of the top-center map banner and
 * the top-right account menu): FPS and server round-trip latency. Both are
 * off by default and toggled in Settings -> Display; each meter only runs its
 * measurement loop while its chip is visible.
 */
const HudMetrics = () => {
  const { socket } = useContext(AppContext);
  const [settings] = useGameSettings();
  const [fps, setFps] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const showFps = settings.hud.showFps;
  const showLatency = settings.hud.showLatency;

  useEffect(() => {
    if (!showFps) {
      setFps(null);
      return;
    }

    let rafId = 0;
    let frames = 0;
    let windowStart = performance.now();

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        windowStart = now;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [showFps]);

  useEffect(() => {
    if (!showLatency || !socket) {
      setLatencyMs(null);
      return;
    }

    let disposed = false;

    const probe = () => {
      const sentAt = performance.now();
      socket
        .timeout(LATENCY_PROBE_TIMEOUT_MS)
        .emit("net:ping", (error: unknown) => {
          if (disposed) return;
          setLatencyMs(error ? null : Math.round(performance.now() - sentAt));
        });
    };

    probe();
    const intervalId = window.setInterval(probe, LATENCY_PROBE_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [showLatency, socket]);

  if (!showFps && !showLatency) {
    return null;
  }

  return (
    <div
      data-game-ux="true"
      data-hud-metrics="true"
      style={{
        position: "fixed",
        top: "16px",
        left: "16px",
        zIndex: 3500,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "4px",
        pointerEvents: "none",
        userSelect: "none",
        fontFamily: "'Courier New', monospace",
        fontWeight: 700,
        fontSize: "12px",
        letterSpacing: "0.04em",
      }}
    >
      {showFps ? (
        <div data-hud-fps="true" style={chipStyle}>
          FPS {fps ?? "--"}
        </div>
      ) : null}
      {showLatency ? (
        <div data-hud-latency="true" style={chipStyle}>
          {latencyMs === null ? "-- ms" : `${latencyMs} ms`}
        </div>
      ) : null}
    </div>
  );
};

const chipStyle: CSSProperties = {
  padding: "3px 8px",
  background: "rgba(20, 28, 22, 0.92)",
  border: "1px solid rgba(232, 240, 230, 0.7)",
  borderRadius: "5px",
  color: "#f4f8f2",
};

export default HudMetrics;
