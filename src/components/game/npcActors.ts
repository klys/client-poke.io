// Live positions of walking map NPCs, as broadcast by the server.
//
// NPC movement used to be a client-only illusion: NpcSprite replayed a seeded
// random walk off `performance.now()`, so the same NPC appeared on a different
// tile for every player, walked through walls, and never matched the hitbox
// the server used for collision and interaction.
//
// The server now owns the walk (server-poke.io/components/NpcActors.ts) and
// sends `npc:steps` / `npc:sync` / `npc:turn`. This module is the client's
// mirror of that state: module-level, no React state and no context
// re-renders, in the same spirit as livePlayerPosition.ts — NPC positions are
// read every animation frame by the shared NpcSprite ticker, and pushing them
// through React would re-render the whole map ~60 times a second.

/** RPG Maker facing codes. */
export const NPC_FACE_DOWN = 2;
export const NPC_FACE_LEFT = 4;
export const NPC_FACE_RIGHT = 6;
export const NPC_FACE_UP = 8;

/**
 * How far in the past NPC steps are rendered. One step packet arrives per
 * tile (~300ms apart), so a small buffer absorbs network jitter without the
 * NPC visibly lagging: the sprite waits this long before starting a step it
 * has already been told about, which leaves room for the next packet to land.
 */
const INTERP_DELAY_MS = 100;

export type LiveNpc = {
  /** Cell the step starts from. */
  fromX: number;
  fromY: number;
  /** Cell the step ends on (equal to from* when standing still). */
  toX: number;
  toY: number;
  facing: number;
  stepMs: number;
  /** performance.now() timestamp at which the step should begin rendering. */
  startsAt: number;
};

export type NpcStepPacket = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  facing: number;
  stepMs: number;
};

export type NpcSyncPacket = {
  id: string;
  x: number;
  y: number;
  toX: number;
  toY: number;
  facing: number;
  stepMs: number;
  elapsedMs: number;
};

const npcsByMap = new Map<string, Map<string, LiveNpc>>();

function mapEntry(mapId: string) {
  let entry = npcsByMap.get(mapId);

  if (!entry) {
    entry = new Map<string, LiveNpc>();
    npcsByMap.set(mapId, entry);
  }

  return entry;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Applies a batch of steps for one map. */
export function applyNpcSteps(mapId: string, steps: NpcStepPacket[]) {
  if (!mapId || !Array.isArray(steps)) {
    return;
  }

  const entry = mapEntry(mapId);
  const now = performance.now();

  for (const step of steps) {
    if (
      !step ||
      typeof step.id !== "string" ||
      !isFiniteNumber(step.fromX) ||
      !isFiniteNumber(step.fromY) ||
      !isFiniteNumber(step.toX) ||
      !isFiniteNumber(step.toY)
    ) {
      continue;
    }

    entry.set(step.id, {
      fromX: step.fromX,
      fromY: step.fromY,
      toX: step.toX,
      toY: step.toY,
      facing: isFiniteNumber(step.facing) ? step.facing : NPC_FACE_DOWN,
      stepMs: isFiniteNumber(step.stepMs) && step.stepMs > 0 ? step.stepMs : 300,
      startsAt: now + INTERP_DELAY_MS
    });
  }
}

/**
 * Replaces the known state of a map. Sent on map arrival and periodically as
 * a safety net, so a dropped step packet self-corrects within seconds instead
 * of leaving an NPC permanently offset for that one client.
 */
export function applyNpcSync(mapId: string, npcs: NpcSyncPacket[]) {
  if (!mapId || !Array.isArray(npcs)) {
    return;
  }

  const entry = new Map<string, LiveNpc>();
  const now = performance.now();

  for (const npc of npcs) {
    if (!npc || typeof npc.id !== "string" || !isFiniteNumber(npc.x) || !isFiniteNumber(npc.y)) {
      continue;
    }

    const stepMs = isFiniteNumber(npc.stepMs) && npc.stepMs > 0 ? npc.stepMs : 300;
    const elapsed = isFiniteNumber(npc.elapsedMs) ? Math.max(0, npc.elapsedMs) : 0;

    entry.set(npc.id, {
      fromX: npc.x,
      fromY: npc.y,
      toX: isFiniteNumber(npc.toX) ? npc.toX : npc.x,
      toY: isFiniteNumber(npc.toY) ? npc.toY : npc.y,
      facing: isFiniteNumber(npc.facing) ? npc.facing : NPC_FACE_DOWN,
      stepMs,
      // Rewind the start so a step already half-done on the server is picked
      // up mid-stride rather than replayed from the beginning.
      startsAt: now - elapsed + INTERP_DELAY_MS
    });
  }

  npcsByMap.set(mapId, entry);
}

/** An NPC turned on the spot without moving. */
export function applyNpcTurn(mapId: string, id: string, facing: number) {
  if (!mapId || typeof id !== "string" || !isFiniteNumber(facing)) {
    return;
  }

  const existing = npcsByMap.get(mapId)?.get(id);

  if (existing) {
    existing.facing = facing;
  }
}

function getLiveNpc(mapId: string, id: string): LiveNpc | null {
  return npcsByMap.get(mapId)?.get(id) ?? null;
}

/**
 * Interpolated cell position of an NPC at `now` (a performance.now() value).
 * Fractional while the NPC is mid-step. Returns null when the server has not
 * told us about this NPC — the caller then falls back to the authored tile,
 * which is exactly right for the stationary majority.
 */
export function getNpcCellPosition(
  mapId: string,
  id: string,
  now: number
): { x: number; y: number; facing: number; moving: boolean } | null {
  const npc = getLiveNpc(mapId, id);

  if (!npc) {
    return null;
  }

  const isStep = npc.toX !== npc.fromX || npc.toY !== npc.fromY;

  if (!isStep) {
    return { x: npc.fromX, y: npc.fromY, facing: npc.facing, moving: false };
  }

  const progress = Math.max(0, Math.min(1, (now - npc.startsAt) / npc.stepMs));

  return {
    x: npc.fromX + (npc.toX - npc.fromX) * progress,
    y: npc.fromY + (npc.toY - npc.fromY) * progress,
    facing: npc.facing,
    moving: progress > 0 && progress < 1
  };
}

/** Nearest whole tile an NPC occupies — what interaction range is measured against. */
export function getNpcCell(mapId: string, id: string): { x: number; y: number } | null {
  const position = getNpcCellPosition(mapId, id, performance.now());

  if (!position) {
    return null;
  }

  return { x: Math.round(position.x), y: Math.round(position.y) };
}
