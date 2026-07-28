/**
 * Data-driven overworld field-move actions for the Venomon party menu.
 *
 * A party member whose move list contains one of the (localized) move names
 * gets the matching menu entry; choosing it fires the same server-validated
 * rail every other entry point uses (water menu, bag, interact button), so
 * there is no party-menu-specific logic on the server. New field moves only
 * need a row here plus their server handler.
 *
 * Move names are the localized display names stored in `pokemon.moves`
 * (Venova data is Spanish; legacy aliases are included where older data used
 * them, e.g. Fly appearing as "volar"). This mirrors the server's
 * FIELD_SKILL_MOVE_INTERNALS -> skill-name resolution — the server remains
 * the authority when the action executes.
 */

export type FieldMoveKind = "socket" | "open-world-map" | "interact-front";

export interface FieldMoveAction {
  key: string;
  /** Menu label (localized move display name). */
  label: string;
  /** Lowercased localized move names that grant this action. */
  moveNames: string[];
  kind: FieldMoveKind;
  /** For kind "socket": the AppContext socket event to emit (no payload). */
  socketEvent?: string;
}

export const FIELD_MOVE_ACTIONS: FieldMoveAction[] = [
  { key: "surf", label: "Surf", moveNames: ["surf"], kind: "socket", socketEvent: "player:surf" },
  { key: "dive", label: "Buceo", moveNames: ["buceo", "dive"], kind: "socket", socketEvent: "player:dive" },
  { key: "fly", label: "Vuelo", moveNames: ["vuelo", "volar", "fly"], kind: "open-world-map" },
  {
    key: "waterfall",
    label: "Cascada",
    moveNames: ["cascada", "waterfall"],
    kind: "socket",
    socketEvent: "player:waterfall"
  },
  {
    key: "strength",
    label: "Fuerza",
    moveNames: ["fuerza", "strength"],
    kind: "socket",
    socketEvent: "player:strength-push"
  },
  // Cut / Rock Smash act on the event (tree / rock) the player faces — the
  // shared interact-front path already routes to it.
  { key: "cut", label: "Corte", moveNames: ["corte", "cut"], kind: "interact-front" },
  {
    key: "rock-smash",
    label: "Golpe Roca",
    moveNames: ["golpe roca", "rock smash"],
    kind: "interact-front"
  }
];

/** The field-move actions a specific Venomon's move list unlocks. */
export function fieldMovesForPokemon(moves: string[] | undefined): FieldMoveAction[] {
  const known = new Set((moves ?? []).map((move) => move.trim().toLowerCase()));
  return FIELD_MOVE_ACTIONS.filter((action) =>
    action.moveNames.some((name) => known.has(name))
  );
}
