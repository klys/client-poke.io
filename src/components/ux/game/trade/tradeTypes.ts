/**
 * Client mirror of the server's trade contract (server-poke.io
 * `components/trade/tradeTypes.ts`). These are read-only projections: the
 * client never constructs a snapshot, decides tradeability, or computes a
 * balance — it renders exactly what the server sent and echoes ids back.
 *
 * Keep this file in step with the server types; `trade:state` is the single
 * source of truth for everything the trade window shows.
 */

export type TradeState =
  | 'REQUESTED'
  | 'OPEN'
  | 'PLAYER_A_LOCKED'
  | 'PLAYER_B_LOCKED'
  | 'BOTH_LOCKED'
  | 'FINAL_CONFIRMATION'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type TradeSideKey = 'A' | 'B';

export type TradeRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface TradeOfferItem {
  itemDefinitionId: string;
  itemInstanceId: string;
  quantity: number;
  name: string;
  category: 'usable' | 'berries' | 'moves' | 'quest';
  description: string;
  iconSrc: string;
  rarity: TradeRarity;
  restricted: boolean;
}

export interface TradeOfferVenomon {
  venomonInstanceId: string;
  source: 'party' | 'storage';
  boxId?: string;
  speciesId: string;
  species: string;
  nickname?: string;
  nicknameDiffersFromSpecies: boolean;
  level: number;
  types: string[];
  hp: number;
  maxHp: number;
  moves: string[];
  heldItemId?: string;
  heldItemName?: string;
  isEgg: boolean;
  iconImageSrc?: string;
  rarity: TradeRarity;
  gender?: string;
  shiny?: boolean;
  form?: string;
  nature?: string;
  ability?: string;
  originalTrainer?: string;
}

export interface TradeOffer {
  items: TradeOfferItem[];
  venomons: TradeOfferVenomon[];
  currency: number;
  locked: boolean;
  confirmed: boolean;
}

export type TradeWarningCode =
  | 'ONE_SIDED'
  | 'UNBALANCED'
  | 'RARE_ASSET'
  | 'NICKNAMED_VENOMON'
  | 'EGG_INCLUDED'
  | 'HELD_ITEM_TRANSFERS'
  | 'NEW_ACCOUNT'
  | 'SIMILAR_ITEM_NAMES'
  | 'LARGE_CURRENCY';

export interface TradeWarning {
  code: TradeWarningCode;
  side: TradeSideKey | 'BOTH';
  detail?: string;
}

export interface TradeParticipant {
  userId: number;
  username: string;
  displayName: string;
  characterSkinId: string;
  newAccount: boolean;
}

export interface TradeSnapshot {
  tradeId: string;
  version: number;
  createdAt: string;
  participants: Record<TradeSideKey, TradeParticipant>;
  offers: Record<TradeSideKey, Omit<TradeOffer, 'locked' | 'confirmed'>>;
  warnings: TradeWarning[];
  heldItemsTransferWithVenomon: boolean;
}

export interface TradeChangeSummary {
  side: TradeSideKey;
  kind:
    | 'item-added'
    | 'item-removed'
    | 'item-quantity'
    | 'venomon-added'
    | 'venomon-removed'
    | 'currency'
    | 'locked'
    | 'unlocked'
    | 'invalidated'
    | 'asset-revoked';
  label: string;
  at: string;
}

export interface TradeStatePayload {
  tradeId: string;
  state: TradeState;
  version: number;
  snapshotHash: string | null;
  youAre: TradeSideKey;
  participants: Record<TradeSideKey, TradeParticipant>;
  offers: Record<TradeSideKey, TradeOffer>;
  warnings: TradeWarning[];
  snapshot: TradeSnapshot | null;
  confirmAvailableAt: number | null;
  expiresAt: number;
  disconnected: Record<TradeSideKey, boolean>;
  heldItemsTransferWithVenomon: boolean;
  lastChange: TradeChangeSummary | null;
}

export interface TradeChatMessage {
  id: string;
  tradeId: string;
  messageType: 'player' | 'system';
  senderUserId?: number;
  senderUsername?: string;
  text: string;
  createdAt: string;
}

export interface TradeActionResult {
  success: boolean;
  tradeId: string | null;
  state: TradeState | null;
  version: number | null;
  errorCode: string | null;
  message: string | null;
}

export interface TradeRequestNotice {
  tradeId: string;
  from: TradeParticipant;
  expiresAt: number;
}

export interface TradeExchangeSummary {
  items: Array<{ name: string; quantity: number; iconSrc: string }>;
  venomons: Array<{ species: string; nickname?: string; level: number; iconImageSrc?: string }>;
  currency: number;
}

export interface TradeOutcome {
  tradeId: string;
  kind: 'completed' | 'cancelled' | 'failed';
  message: string;
  given?: TradeExchangeSummary;
  received?: TradeExchangeSummary;
}

export interface TradeHistoryEntry {
  tradeId: string;
  completedAt: string;
  result: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  partnerUsername: string;
  partnerDisplayName: string;
  given: TradeExchangeSummary;
  received: TradeExchangeSummary;
}

export interface TradeHistoryPage {
  entries: TradeHistoryEntry[];
  page: number;
  pageSize: number;
  total: number;
}

/** States in which the local player may still edit their own offer. */
export const EDITABLE_TRADE_STATES: TradeState[] = [
  'OPEN',
  'PLAYER_A_LOCKED',
  'PLAYER_B_LOCKED',
  'BOTH_LOCKED'
];

export function otherTradeSide(side: TradeSideKey): TradeSideKey {
  return side === 'A' ? 'B' : 'A';
}
