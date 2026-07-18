/**
 * Cross-component latch that keeps the battle UI mounted while it still needs
 * the player's input. Network.tsx auto-clears an ended battle after a delay,
 * but a move-learn prompt (or a still-playing event queue) must never be
 * ripped away mid-decision — the deferred clear checks this latch and
 * re-arms itself instead of closing the battle while it is held.
 *
 * A module singleton (not React state) on purpose: the holder (BattleScene)
 * and the reader (Network's timer callback) live in unrelated trees, and the
 * reader only samples the value inside a timeout.
 */
let held = false;

export function setBattleUiHold(value: boolean) {
  held = value;
}

export function isBattleUiHeld() {
  return held;
}
