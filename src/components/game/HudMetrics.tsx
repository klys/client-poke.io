import { useContext, useEffect, useState, type CSSProperties } from "react";
import { AppContext } from "../../context/appContext";
import { useAuth } from "../../context/authContext";
import { useT } from "../../i18n";
import { useGameSettings } from "../../settings/gameSettings";

const LATENCY_PROBE_INTERVAL_MS = 3000;
const LATENCY_PROBE_TIMEOUT_MS = 4000;
const FPS_WINDOW_MS = 500;
// Frame-time budget thresholds: one missed 60Hz frame, and one missed 30Hz frame.
const LONG_FRAME_MS = 1000 / 60 + 4;
const VERY_LONG_FRAME_MS = 1000 / 30 + 4;

type FrameStats = {
  fps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longFrames: number;
  veryLongFrames: number;
};

/** Reduce one window of rAF frame deltas to display stats. */
export const summarizeFrameDeltas = (deltas: number[], elapsedMs: number): FrameStats => {
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    fps: Math.round((sorted.length * 1000) / Math.max(1, elapsedMs)),
    avgFrameMs: sorted.length ? sum / sorted.length : 0,
    p95FrameMs: sorted.length ? sorted[p95Index] : 0,
    maxFrameMs: sorted.length ? sorted[sorted.length - 1] : 0,
    longFrames: sorted.filter((value) => value > LONG_FRAME_MS).length,
    veryLongFrames: sorted.filter((value) => value > VERY_LONG_FRAME_MS).length,
  };
};

/**
 * Optional top-left chips (clear of the top-center map banner and the
 * top-right account menu): FPS, server round-trip latency, and the remaining
 * repellent (Baygon) steps. All toggled in Settings -> Display; the meters
 * only run their measurement loop while their chip is visible, and the
 * repellent chip only renders while a charge is active.
 */
const HudMetrics = () => {
  const { socket } = useContext(AppContext);
  const { user } = useAuth();
  const t = useT();
  const [settings] = useGameSettings();
  const [frameStats, setFrameStats] = useState<FrameStats | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  // Live charge from player:repel-state; null until the first push, when the
  // session snapshot (user.repelSteps) is the source of truth.
  const [liveRepelSteps, setLiveRepelSteps] = useState<number | null>(null);

  const showFps = settings.hud.showFps;
  const showLatency = settings.hud.showLatency;
  const showRepelSteps = settings.hud.showRepelSteps;
  const repelSteps = liveRepelSteps ?? user?.repelSteps ?? 0;

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handleRepelState = (data: { steps?: number }) => {
      const steps = typeof data?.steps === "number" && Number.isFinite(data.steps) ? data.steps : 0;
      setLiveRepelSteps(Math.max(0, Math.round(steps)));
    };
    socket.on("player:repel-state", handleRepelState);
    return () => {
      socket.off("player:repel-state", handleRepelState);
    };
  }, [socket]);

  useEffect(() => {
    if (!showFps) {
      setFrameStats(null);
      return;
    }

    let rafId = 0;
    let deltas: number[] = [];
    let lastFrameAt: number | null = null;
    let windowStart = performance.now();

    const tick = (now: number) => {
      if (lastFrameAt !== null) {
        deltas.push(now - lastFrameAt);
      }
      lastFrameAt = now;
      const elapsed = now - windowStart;
      // One setState per window, not per frame.
      if (elapsed >= FPS_WINDOW_MS && deltas.length > 0) {
        setFrameStats(summarizeFrameDeltas(deltas, elapsed));
        deltas = [];
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

  const showRepelChip = showRepelSteps && repelSteps > 0;
  if (!showFps && !showLatency && !showRepelChip) {
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
          FPS {frameStats?.fps ?? "--"}
          {frameStats
            ? ` · ${frameStats.avgFrameMs.toFixed(1)}ms avg · ${frameStats.p95FrameMs.toFixed(
                1
              )}ms p95 · ${frameStats.maxFrameMs.toFixed(0)}ms max · long ${
                frameStats.longFrames
              }/${frameStats.veryLongFrames}`
            : ""}
        </div>
      ) : null}
      {showLatency ? (
        <div data-hud-latency="true" style={chipStyle}>
          {latencyMs === null ? "-- ms" : `${latencyMs} ms`}
        </div>
      ) : null}
      {showRepelChip ? (
        <div data-hud-repel-steps="true" style={chipStyle}>
          {t("hud.repelSteps", { steps: String(repelSteps) })}
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
