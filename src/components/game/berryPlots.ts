// Global berry plots, as broadcast by the server
// (server-poke.io/components/BerryPlots.ts). One shared roster per map;
// growth is computed locally from `plantedAt` + `stageMs` against the server
// clock (every packet carries `t`), so the sprites advance through their
// stages in real time without any further traffic.

export type BerryPlot = {
  id: string;
  mapId: string;
  x: number;
  y: number;
  /** Essentials berry internal name (e.g. "ORANBERRY"); null = empty soil. */
  berryId: string | null;
  itemId: string | null;
  plantedAt: number | null;
  plantedBy: string | null;
  stageMs: number | null;
  ripeAt: number | null;
  stage: number;
};

export const BERRY_RIPE_STAGE = 5;
export const BERRY_MENU_EVENT = "pokecraft:berry-menu";

const plotsByMap = new Map<string, Map<string, BerryPlot>>();
const listeners = new Set<() => void>();
/** serverNow - Date.now(), from the latest packet. */
let serverClockOffset = 0;

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // One bad subscriber must not break the rest.
    }
  });
}

export function subscribeBerryPlots(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function sanitize(value: unknown): BerryPlot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<BerryPlot>;
  if (typeof raw.id !== "string" || typeof raw.mapId !== "string") return null;
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null;
  const berryId = typeof raw.berryId === "string" && raw.berryId ? raw.berryId.toUpperCase() : null;
  const planted = berryId && isFiniteNumber(raw.plantedAt) && isFiniteNumber(raw.stageMs) && raw.stageMs > 0;
  return {
    id: raw.id,
    mapId: raw.mapId,
    x: raw.x,
    y: raw.y,
    berryId: planted ? berryId : null,
    itemId: planted && typeof raw.itemId === "string" ? raw.itemId : planted ? `item-${berryId!.toLowerCase()}` : null,
    plantedAt: planted ? (raw.plantedAt as number) : null,
    plantedBy: typeof raw.plantedBy === "string" ? raw.plantedBy : null,
    stageMs: planted ? (raw.stageMs as number) : null,
    ripeAt: planted ? (isFiniteNumber(raw.ripeAt) ? raw.ripeAt : (raw.plantedAt as number) + 4 * (raw.stageMs as number)) : null,
    stage: planted ? Math.max(1, Math.min(BERRY_RIPE_STAGE, isFiniteNumber(raw.stage) ? raw.stage : 1)) : 0
  };
}

function noteServerClock(t: unknown) {
  if (isFiniteNumber(t)) {
    serverClockOffset = t - Date.now();
  }
}

/** The server's wall clock, best effort. */
export function berryServerNow(): number {
  return Date.now() + serverClockOffset;
}

/** Growth stage 0 (empty) / 1..5 of a plot right now. */
export function berryStage(plot: BerryPlot, now = berryServerNow()): number {
  if (!plot.berryId || plot.plantedAt === null || !plot.stageMs) return 0;
  return Math.min(BERRY_RIPE_STAGE, 1 + Math.floor(Math.max(0, now - plot.plantedAt) / plot.stageMs));
}

/** Milliseconds until the plot is ripe (0 when ripe or empty). */
export function berryMsUntilRipe(plot: BerryPlot, now = berryServerNow()): number {
  if (plot.ripeAt === null) return 0;
  return Math.max(0, plot.ripeAt - now);
}

/** Replaces the plot roster of a map (map arrival / re-sync). */
export function applyBerrySync(mapId: string, t: unknown, plots: unknown[]) {
  if (!mapId || !Array.isArray(plots)) return;
  noteServerClock(t);
  const entry = new Map<string, BerryPlot>();
  for (const raw of plots) {
    const plot = sanitize(raw);
    if (plot) entry.set(plot.id, plot);
  }
  plotsByMap.set(mapId, entry);
  notify();
}

export function applyBerryUpdate(mapId: string, t: unknown, raw: unknown) {
  const plot = sanitize(raw);
  if (!mapId || !plot) return;
  noteServerClock(t);
  let entry = plotsByMap.get(mapId);
  if (!entry) {
    entry = new Map();
    plotsByMap.set(mapId, entry);
  }
  entry.set(plot.id, plot);
  notify();
}

export function getBerryPlots(mapId: string): BerryPlot[] {
  const entry = plotsByMap.get(mapId);
  return entry ? Array.from(entry.values()) : [];
}

export function getBerryPlot(mapId: string, id: string): BerryPlot | null {
  return plotsByMap.get(mapId)?.get(id) ?? null;
}

export function getBerryPlotAt(mapId: string, x: number, y: number): BerryPlot | null {
  const entry = plotsByMap.get(mapId);
  if (!entry) return null;
  for (const plot of Array.from(entry.values())) {
    if (plot.x === x && plot.y === y) return plot;
  }
  return null;
}

/**
 * True when an imported map placement is a berry plot (an event page runs
 * `pbBerryPlant`). Mirrors the server's isBerryPlotPlacement: such placements
 * are drawn by BerryPlantsLayer from the global state, never as page NPCs.
 */
export function isBerryPlotPlacement(placement: unknown): boolean {
  const pages = (placement as { essentialsEvent?: { pages?: unknown } } | null)?.essentialsEvent?.pages;
  if (!Array.isArray(pages)) return false;
  return pages.some((page) => {
    const commands = (page as { commands?: unknown })?.commands;
    if (!Array.isArray(commands)) return false;
    return commands.some((command) => {
      const c = command as { code?: number; parameters?: unknown[] };
      if (c?.code !== 355 && c?.code !== 655) return false;
      const text = c.parameters?.[0];
      return typeof text === "string" && /pbBerryPlant/i.test(text);
    });
  });
}

/** Short "2h 15m" / "45s" countdown. */
export function formatBerryCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
