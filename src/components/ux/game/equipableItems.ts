import type { InventoryItem } from '../../../context/authContext';

/**
 * Items offered under "Equip Item" in the party menu: hold items whose passive
 * bonus the battle server honors (type boosters, Choice trio, Life Orb...)
 * plus Leftovers. Berries have their own "Give Berry" flow.
 *
 * KEEP IN SYNC with server-poke.io components/battle/heldItems.ts
 * (EQUIPABLE_INTERNAL_IDS) — the server is the authority on the effects.
 */
const EQUIPABLE_INTERNAL_IDS = new Set([
  // Type boosters (x1.2 to matching-type moves).
  'CHARCOAL',
  'MYSTICWATER',
  'MIRACLESEED',
  'MAGNET',
  'TWISTEDSPOON',
  'SILKSCARF',
  'BLACKBELT',
  'SHARPBEAK',
  'POISONBARB',
  'SOFTSAND',
  'HARDSTONE',
  'SILVERPOWDER',
  'SPELLTAG',
  'NEVERMELTICE',
  'DRAGONFANG',
  'METALCOAT',
  'BLACKGLASSES',
  // Damage-class bands and stat boosters.
  'MUSCLEBAND',
  'WISEGLASSES',
  'CHOICEBAND',
  'CHOICESPECS',
  'CHOICESCARF',
  'LIFEORB',
  'THICKCLUB',
  'LIGHTBALL',
  'EVIOLITE',
  // Chance-based battle perks.
  'SCOPELENS',
  'KINGSROCK',
  'QUICKCLAW',
  'FOCUSBAND',
  'BRIGHTPOWDER',
  // Out-of-combat rewards and end-of-turn healing.
  'LUCKYEGG',
  'AMULETCOIN',
  'LEFTOVERS'
]);

/**
 * Inventory ids follow the designer catalog convention `item-<InternalName>`
 * (lowercased during migration), so the internal name can be derived without
 * shipping the full item catalog to players.
 */
export function getItemInternalId(item: Pick<InventoryItem, 'id'>): string {
  return item.id.replace(/^item-/i, '').trim().toUpperCase();
}

export function isEquipableBonusItem(item: Pick<InventoryItem, 'id' | 'quantity'>): boolean {
  return item.quantity > 0 && EQUIPABLE_INTERNAL_IDS.has(getItemInternalId(item));
}
