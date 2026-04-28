import type { InventoryItem } from "../../../context/authContext";

export type BattleAction =
  | { type: "fight"; moveId: string }
  | { type: "bag"; itemId: string; targetPokemonId?: string }
  | { type: "pokemon"; pokemonId: string }
  | { type: "run" }
  | { type: "surrender" };

export type BattlePublicMove = {
  id: string;
  name: string;
  type: string;
  power: number;
  accuracy: number;
  currentPp: number;
  maxPp: number;
};

export type BattlePublicPokemon = {
  id: string;
  name: string;
  level: number;
  types: string[];
  hp: number;
  maxHp: number;
  frontImageSrc: string;
  backImageSrc: string;
  moves: BattlePublicMove[];
};

export type BattlePublicItem = {
  id: string;
  name: string;
  category: InventoryItem["category"];
  quantity: number;
  description: string;
  canUse: boolean;
};

export type BattlePublicSide = {
  id: "a" | "b";
  trainerName: string;
  isPlayer: boolean;
  money: number;
  activePokemon: BattlePublicPokemon;
  party: BattlePublicPokemon[];
};

export type BattlePublicSummary = {
  battleId: string;
  kind: "wild" | "trainer";
  winnerName: string | null;
  loserName: string | null;
  result: string;
  startedAt: string;
  endedAt: string | null;
  log: string[];
};

export type BattlePublicState = {
  id: string;
  kind: "wild" | "trainer";
  status: "active" | "ended";
  turn: number;
  self: BattlePublicSide;
  opponent: BattlePublicSide;
  availableItems: BattlePublicItem[];
  canAct: boolean;
  waitingForOpponent: boolean;
  selectedActionType: string | null;
  turnEndsAt: string | null;
  log: string[];
  result: string | null;
  summary: BattlePublicSummary | null;
};

export type BattlePrompt = {
  id: string;
  type: "battle" | "trade";
  fromPlayerId: string;
  fromUsername: string;
};

export type TrainerCardPlayer = {
  playerId: string;
  username?: string;
  name?: string;
  profileImage?: string;
  description?: string;
  currentMapId?: string;
};
