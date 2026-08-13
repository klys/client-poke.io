// Live beach balls (/pelota command), as broadcast by the server
// (server-poke.io/components/BeachBalls.ts). Same roster/live split as
// followerActors.ts: roster changes notify React, positions are read per
// animation frame by the sprites.

const INTERP_DELAY_MS = 100;

export type BallInfo = {
  id: string;
  deflated: boolean;
};

type LiveBall = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  stepMs: number;
  startsAt: number;
};

export type BallSnapshotPacket = {
  id: string;
  mapId: string;
  x: number;
  y: number;
  toX: number;
  toY: number;
  stepMs: number;
  elapsedMs: number;
  pushesLeft: number;
  deflated: boolean;
};

export type BallStepPacket = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  stepMs: number;
  pushesLeft: number;
};

/** How long a deflated ball keeps rendering its pop animation before removal. */
const DEFLATE_LINGER_MS = 2300;

const ballsByMap = new Map<string, Map<string, { info: BallInfo; live: LiveBall }>>();

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // One bad subscriber must not break the rest.
    }
  });
}

export function subscribeBeachBalls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function liveFromSnapshot(snapshot: BallSnapshotPacket, now: number): LiveBall {
  const stepMs = isFiniteNumber(snapshot.stepMs) && snapshot.stepMs > 0 ? snapshot.stepMs : 180;
  const elapsed = isFiniteNumber(snapshot.elapsedMs) ? Math.max(0, snapshot.elapsedMs) : 0;

  return {
    fromX: snapshot.x,
    fromY: snapshot.y,
    toX: isFiniteNumber(snapshot.toX) ? snapshot.toX : snapshot.x,
    toY: isFiniteNumber(snapshot.toY) ? snapshot.toY : snapshot.y,
    stepMs,
    startsAt: now - elapsed + INTERP_DELAY_MS
  };
}

function isValidSnapshot(snapshot: BallSnapshotPacket | undefined | null): snapshot is BallSnapshotPacket {
  return Boolean(
    snapshot && typeof snapshot.id === "string" && isFiniteNumber(snapshot.x) && isFiniteNumber(snapshot.y)
  );
}

function scheduleRemoval(mapId: string, id: string) {
  window.setTimeout(() => {
    const entry = ballsByMap.get(mapId);

    if (entry?.delete(id)) {
      notify();
    }
  }, DEFLATE_LINGER_MS);
}

/** Replaces the ball roster of a map (map arrival). */
export function applyBallSync(mapId: string, balls: BallSnapshotPacket[]) {
  if (!mapId || !Array.isArray(balls)) {
    return;
  }

  const entry = new Map<string, { info: BallInfo; live: LiveBall }>();
  const now = performance.now();

  for (const snapshot of balls) {
    if (!isValidSnapshot(snapshot)) {
      continue;
    }
    entry.set(snapshot.id, {
      info: { id: snapshot.id, deflated: snapshot.deflated === true },
      live: liveFromSnapshot(snapshot, now)
    });
    if (snapshot.deflated === true) {
      scheduleRemoval(mapId, snapshot.id);
    }
  }

  ballsByMap.set(mapId, entry);
  notify();
}

export function applyBallSpawn(mapId: string, snapshot: BallSnapshotPacket) {
  if (!mapId || !isValidSnapshot(snapshot)) {
    return;
  }

  let entry = ballsByMap.get(mapId);

  if (!entry) {
    entry = new Map();
    ballsByMap.set(mapId, entry);
  }

  entry.set(snapshot.id, {
    info: { id: snapshot.id, deflated: snapshot.deflated === true },
    live: liveFromSnapshot(snapshot, performance.now())
  });
  notify();
}

export function applyBallStep(mapId: string, step: BallStepPacket) {
  if (
    !mapId ||
    !step ||
    typeof step.id !== "string" ||
    !isFiniteNumber(step.fromX) ||
    !isFiniteNumber(step.fromY) ||
    !isFiniteNumber(step.toX) ||
    !isFiniteNumber(step.toY)
  ) {
    return;
  }

  const ball = ballsByMap.get(mapId)?.get(step.id);

  if (!ball) {
    return;
  }

  ball.live = {
    fromX: step.fromX,
    fromY: step.fromY,
    toX: step.toX,
    toY: step.toY,
    stepMs: isFiniteNumber(step.stepMs) && step.stepMs > 0 ? step.stepMs : 180,
    startsAt: performance.now() + INTERP_DELAY_MS
  };
}

/** The ball popped: flag it so the sprite plays the deflate strip, then drop it. */
export function applyBallDeflate(mapId: string, id: string) {
  const ball = ballsByMap.get(mapId)?.get(id);

  if (!ball || ball.info.deflated) {
    return;
  }

  ball.info = { ...ball.info, deflated: true };
  notify();
  scheduleRemoval(mapId, id);
}

export function getBeachBalls(mapId: string): BallInfo[] {
  const entry = ballsByMap.get(mapId);

  if (!entry) {
    return [];
  }

  return Array.from(entry.values(), (ball) => ball.info);
}

export function getBallCellPosition(
  mapId: string,
  id: string,
  now: number
): { x: number; y: number; moving: boolean } | null {
  const ball = ballsByMap.get(mapId)?.get(id);

  if (!ball) {
    return null;
  }

  const live = ball.live;
  const isStep = live.toX !== live.fromX || live.toY !== live.fromY;

  if (!isStep) {
    return { x: live.fromX, y: live.fromY, moving: false };
  }

  const progress = Math.max(0, Math.min(1, (now - live.startsAt) / live.stepMs));

  return {
    x: live.fromX + (live.toX - live.fromX) * progress,
    y: live.fromY + (live.toY - live.fromY) * progress,
    moving: progress > 0 && progress < 1
  };
}
