import type { BattlePublicPokemon } from "../battleTypes";

export type BattleStatKey =
  | "hp"
  | "attack"
  | "defense"
  | "specialAttack"
  | "specialDefense"
  | "speed";

export type BattleStageKey =
  | "attack"
  | "defense"
  | "specialAttack"
  | "specialDefense"
  | "speed"
  | "accuracy"
  | "evasion";

export type BattleStatusId =
  | "poison"
  | "toxic"
  | "burn"
  | "paralysis"
  | "sleep"
  | "freeze";

export type BattleStatGain = {
  before: number;
  after: number;
  gain: number;
};

export type BattlePublicEvent =
  | {
      kind: "battle-start";
      battleKind: "wild" | "trainer";
      transition: string;
      bgmName: string | null;
      introText: string;
    }
  | { kind: "message"; text: string }
  | {
      kind: "move-used";
      sideId: "a" | "b";
      pokemonId: string;
      moveId: string;
      moveName: string;
      moveType: string;
      skillGfxId: string | null;
      skillGfxName: string | null;
      animationId: string | null;
      animationName: string | null;
    }
  | { kind: "move-missed"; sideId: "a" | "b"; pokemonId: string; moveName: string }
  | {
      kind: "damage";
      sideId: "a" | "b";
      pokemonId: string;
      amount: number;
      hpAfter: number;
      maxHp: number;
      effectiveness: number;
      critical: boolean;
      source: "move" | "status" | "recoil" | "confusion" | "held-item";
    }
  | {
      kind: "heal";
      sideId: "a" | "b";
      pokemonId: string;
      amount: number;
      hpAfter: number;
      maxHp: number;
      source: "move" | "item" | "held-item";
    }
  | {
      kind: "stat-change";
      sideId: "a" | "b";
      pokemonId: string;
      stat: BattleStageKey;
      delta: number;
      stageAfter: number;
    }
  | { kind: "status-applied"; sideId: "a" | "b"; pokemonId: string; status: BattleStatusId }
  | { kind: "status-cured"; sideId: "a" | "b"; pokemonId: string; status: BattleStatusId }
  | { kind: "confusion-start"; sideId: "a" | "b"; pokemonId: string }
  | { kind: "confusion-end"; sideId: "a" | "b"; pokemonId: string }
  | { kind: "flinch"; sideId: "a" | "b"; pokemonId: string }
  | { kind: "faint"; sideId: "a" | "b"; pokemonId: string; pokemonName: string }
  | { kind: "switch"; sideId: "a" | "b"; pokemon: BattlePublicPokemon }
  | {
      kind: "item-used";
      sideId: "a" | "b";
      itemId: string;
      itemName: string;
      targetPokemonId: string | null;
    }
  | { kind: "held-item-used"; sideId: "a" | "b"; pokemonId: string; itemName: string }
  | {
      kind: "catch-attempt";
      pokemonId: string;
      pokemonName: string;
      ballName: string;
      shakes: number;
      caught: boolean;
    }
  | {
      kind: "exp-gain";
      sideId: "a" | "b";
      pokemonId: string;
      amount: number;
      experience: number;
      nextLevelExperience: number;
    }
  | {
      kind: "level-up";
      sideId: "a" | "b";
      pokemonId: string;
      pokemonName: string;
      level: number;
      statGains: Record<BattleStatKey, BattleStatGain>;
    }
  | { kind: "move-learned"; sideId: "a" | "b"; pokemonId: string; moveName: string }
  | {
      kind: "move-learn-prompt";
      sideId: "a" | "b";
      pokemonId: string;
      pokemonName: string;
      moveName: string;
      currentMoves: string[];
    }
  | {
      kind: "evolution";
      sideId: "a" | "b";
      pokemonId: string;
      fromName: string;
      toName: string;
      frontImageSrc: string;
      backImageSrc: string;
    }
  | { kind: "escape"; success: boolean }
  | { kind: "battle-end"; result: string; winnerSideId: "a" | "b" | null };

export type BattleSequencedEvent = BattlePublicEvent & { seq: number; text?: string };

export type BattleEventsPayload = {
  battleId: string;
  turn: number;
  events: BattleSequencedEvent[];
};

export const STAT_DISPLAY_NAMES: Record<BattleStatKey, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Atk",
  specialDefense: "Sp. Def",
  speed: "Speed"
};

export const STATUS_BADGES: Record<BattleStatusId, { label: string; color: string }> = {
  poison: { label: "PSN", color: "#a040a0" },
  toxic: { label: "PSN", color: "#7b2d8e" },
  burn: { label: "BRN", color: "#f08030" },
  paralysis: { label: "PAR", color: "#f8d030" },
  sleep: { label: "SLP", color: "#8f8f8f" },
  freeze: { label: "FRZ", color: "#98d8d8" }
};
