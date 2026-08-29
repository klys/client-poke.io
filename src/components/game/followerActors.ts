// Live follower venomons (party leaders walking behind their trainers), as
// broadcast by the server (server-poke.io/components/FollowerActors.ts).
//
// Mirrors the npcActors.ts split: the ROSTER (which followers exist on a map,
// their charset, hidden state) changes rarely and notifies React subscribers;
// the LIVE positions are read every animation frame by the sprites and never
// go through React state.

const INTERP_DELAY_MS = 100;

export type FollowerInfo = {
  ownerId: string;
  /** Overworld sheet basename under /migration_exports/characters/ (e.g. "025"). */
  charset: string;
  hidden: boolean;
  /** Emotion bubble (house pets: ❤️ 🤢 🍖 …) until `expiresAt` (performance.now()). */
  emote?: { emoji: string; expiresAt: number } | null;
};

type LiveFollower = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  facing: number;
  stepMs: number;
  /** performance.now() timestamp at which the step should begin rendering. */
  startsAt: number;
};

export type FollowerSnapshotPacket = {
  ownerId: string;
  charset: string;
  x: number;
  y: number;
  toX: number;
  toY: number;
  facing: number;
  stepMs: number;
  elapsedMs: number;
  hidden: boolean;
};

export type FollowerStepPacket = {
  ownerId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  facing: number;
  stepMs: number;
};

const followersByMap = new Map<string, Map<string, { info: FollowerInfo; live: LiveFollower }>>();

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

/** Roster subscription (add/remove/charset/hidden changes only). */
export function subscribeFollowers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mapEntry(mapId: string) {
  let entry = followersByMap.get(mapId);
  if (!entry) {
    entry = new Map();
    followersByMap.set(mapId, entry);
  }
  return entry;
}

function liveFromSnapshot(snapshot: FollowerSnapshotPacket, now: number): LiveFollower {
  const stepMs = isFiniteNumber(snapshot.stepMs) && snapshot.stepMs > 0 ? snapshot.stepMs : 224;
  const elapsed = isFiniteNumber(snapshot.elapsedMs) ? Math.max(0, snapshot.elapsedMs) : 0;

  return {
    fromX: snapshot.x,
    fromY: snapshot.y,
    toX: isFiniteNumber(snapshot.toX) ? snapshot.toX : snapshot.x,
    toY: isFiniteNumber(snapshot.toY) ? snapshot.toY : snapshot.y,
    facing: isFiniteNumber(snapshot.facing) ? snapshot.facing : 2,
    stepMs,
    // Rewind so a step already half-done on the server resumes mid-stride.
    startsAt: now - elapsed + INTERP_DELAY_MS
  };
}

function isValidSnapshot(snapshot: FollowerSnapshotPacket | undefined | null): snapshot is FollowerSnapshotPacket {
  return Boolean(
    snapshot &&
      typeof snapshot.ownerId === "string" &&
      typeof snapshot.charset === "string" &&
      isFiniteNumber(snapshot.x) &&
      isFiniteNumber(snapshot.y)
  );
}

/** Replaces the follower roster of a map (map arrival + periodic resync). */
export function applyFollowerSync(mapId: string, followers: FollowerSnapshotPacket[]) {
  if (!mapId || !Array.isArray(followers)) {
    return;
  }

  const entry = new Map<string, { info: FollowerInfo; live: LiveFollower }>();
  const now = performance.now();

  for (const snapshot of followers) {
    if (!isValidSnapshot(snapshot)) {
      continue;
    }
    entry.set(snapshot.ownerId, {
      info: {
        ownerId: snapshot.ownerId,
        charset: snapshot.charset,
        hidden: snapshot.hidden === true
      },
      live: liveFromSnapshot(snapshot, now)
    });
  }

  followersByMap.set(mapId, entry);
  notify();
}

/** One follower appeared or changed (species, hide/show, snap reposition). */
export function applyFollowerUpdate(mapId: string, snapshot: FollowerSnapshotPacket) {
  if (!mapId || !isValidSnapshot(snapshot)) {
    return;
  }

  mapEntry(mapId).set(snapshot.ownerId, {
    info: {
      ownerId: snapshot.ownerId,
      charset: snapshot.charset,
      hidden: snapshot.hidden === true
    },
    live: liveFromSnapshot(snapshot, performance.now())
  });
  notify();
}

export function applyFollowerRemove(mapId: string, ownerId: string) {
  if (!mapId || typeof ownerId !== "string") {
    return;
  }

  const entry = followersByMap.get(mapId);

  if (entry?.delete(ownerId)) {
    notify();
  }
}

/** Applies a batch of walk steps (positions only — no React involved). */
export function applyFollowerSteps(mapId: string, steps: FollowerStepPacket[]) {
  if (!mapId || !Array.isArray(steps)) {
    return;
  }

  const entry = followersByMap.get(mapId);

  if (!entry) {
    return;
  }

  const now = performance.now();

  for (const step of steps) {
    if (
      !step ||
      typeof step.ownerId !== "string" ||
      !isFiniteNumber(step.fromX) ||
      !isFiniteNumber(step.fromY) ||
      !isFiniteNumber(step.toX) ||
      !isFiniteNumber(step.toY)
    ) {
      continue;
    }

    const follower = entry.get(step.ownerId);

    if (!follower) {
      continue;
    }

    follower.live = {
      fromX: step.fromX,
      fromY: step.fromY,
      toX: step.toX,
      toY: step.toY,
      facing: isFiniteNumber(step.facing) ? step.facing : follower.live.facing,
      stepMs: isFiniteNumber(step.stepMs) && step.stepMs > 0 ? step.stepMs : 224,
      startsAt: now + INTERP_DELAY_MS
    };
  }
}

/** `pet:emote` — an emotion bubble over a follower-channel actor for `ms`. */
export function applyFollowerEmote(mapId: string, ownerId: string, emoji: string, ms: number) {
  if (!mapId || typeof ownerId !== "string" || typeof emoji !== "string" || !emoji) {
    return;
  }
  const follower = followersByMap.get(mapId)?.get(ownerId);
  if (!follower) {
    return;
  }
  const duration = isFiniteNumber(ms) && ms > 0 ? ms : 2000;
  const expiresAt = performance.now() + duration;
  follower.info = { ...follower.info, emote: { emoji, expiresAt } };
  notify();
  window.setTimeout(() => {
    const current = followersByMap.get(mapId)?.get(ownerId);
    if (current && current.info.emote && current.info.emote.expiresAt <= performance.now()) {
      current.info = { ...current.info, emote: null };
      notify();
    }
  }, duration + 20);
}

/** Visible followers of a map, for the React layer. */
export function getFollowers(mapId: string): FollowerInfo[] {
  const entry = followersByMap.get(mapId);

  if (!entry) {
    return [];
  }

  return Array.from(entry.values(), (follower) => follower.info);
}

/**
 * Interpolated cell position of a follower at `now` (performance.now()).
 * Fractional while mid-step; null when the follower is unknown.
 */
export function getFollowerCellPosition(
  mapId: string,
  ownerId: string,
  now: number
): { x: number; y: number; facing: number; moving: boolean } | null {
  const follower = followersByMap.get(mapId)?.get(ownerId);

  if (!follower) {
    return null;
  }

  const live = follower.live;
  const isStep = live.toX !== live.fromX || live.toY !== live.fromY;

  if (!isStep) {
    return { x: live.fromX, y: live.fromY, facing: live.facing, moving: false };
  }

  const progress = Math.max(0, Math.min(1, (now - live.startsAt) / live.stepMs));

  return {
    x: live.fromX + (live.toX - live.fromX) * progress,
    y: live.fromY + (live.toY - live.fromY) * progress,
    facing: live.facing,
    moving: progress > 0 && progress < 1
  };
}
