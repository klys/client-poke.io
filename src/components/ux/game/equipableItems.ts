import type { InventoryItem, PokemonSummary } from '../../../context/authContext';

/**
 * Client mirror of the server's equipment-slot model: every equippable item
 * belongs to one of three slots on the venomon's "Equipo" tab.
 *
 *  - bonus:      passive equip bonuses (type boosters, Choice trio, Life Orb...)
 *                plus the non-consumed hold triggers (Leftovers, Black Sludge,
 *                Flame/Toxic Orb).
 *  - battle:     consumables the venomon uses on its own in battle (berries,
 *                Focus Sash, White Herb).
 *  - appearance: form/shiny items that change how the venomon looks.
 *
 * KEEP IN SYNC with server-poke.io components/battle/heldItems.ts — the
 * server is the authority on the effects and re-validates every equip.
 */
export type EquipmentSlot = 'bonus' | 'battle' | 'appearance';

const BONUS_INTERNAL_IDS = new Set([
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
  // Arceus plates and incenses double as type boosters for non-Arceus holders.
  'FLAMEPLATE',
  'SPLASHPLATE',
  'ZAPPLATE',
  'MEADOWPLATE',
  'ICICLEPLATE',
  'FISTPLATE',
  'TOXICPLATE',
  'EARTHPLATE',
  'SKYPLATE',
  'MINDPLATE',
  'INSECTPLATE',
  'STONEPLATE',
  'SPOOKYPLATE',
  'DRACOPLATE',
  'DREADPLATE',
  'IRONPLATE',
  'SEAINCENSE',
  'WAVEINCENSE',
  'ROSEINCENSE',
  'ODDINCENSE',
  'ROCKINCENSE',
  // Damage-class bands and stat boosters.
  'MUSCLEBAND',
  'WISEGLASSES',
  'CHOICEBAND',
  'CHOICESPECS',
  'CHOICESCARF',
  'LIFEORB',
  'EXPERTBELT',
  'THICKCLUB',
  'LIGHTBALL',
  'EVIOLITE',
  'SOULDEW',
  'METALPOWDER',
  'QUICKPOWDER',
  'DEEPSEATOOTH',
  'DEEPSEASCALE',
  'MACHOBRACE',
  'IRONBALL',
  // Chance-based battle perks.
  'SCOPELENS',
  'RAZORCLAW',
  'STICK',
  'LUCKYPUNCH',
  'KINGSROCK',
  'RAZORFANG',
  'QUICKCLAW',
  'FOCUSBAND',
  'BRIGHTPOWDER',
  'LAXINCENSE',
  'WIDELENS',
  'SHELLBELL',
  // Out-of-combat rewards and end-of-turn holds.
  'LUCKYEGG',
  'AMULETCOIN',
  'LUCKINCENSE',
  'LEFTOVERS',
  'BLACKSLUDGE',
  'FLAMEORB',
  'TOXICORB'
]);

/** Consumables with a server-side in-battle trigger. Any berry is accepted
 * too (harmless if it has no effect — classic "Give Berry" behavior). */
const BATTLE_INTERNAL_IDS = new Set([
  'ORANBERRY',
  'SITRUSBERRY',
  'CHERIBERRY',
  'CHESTOBERRY',
  'PECHABERRY',
  'RAWSTBERRY',
  'ASPEARBERRY',
  'PERSIMBERRY',
  'LUMBERRY',
  'LIECHIBERRY',
  'GANLONBERRY',
  'SALACBERRY',
  'PETAYABERRY',
  'APICOTBERRY',
  'STARFBERRY',
  'BERRY',
  'GOLDBERRY',
  'PRZCUREBERRY',
  'MINTBERRY',
  'PSNCUREBERRY',
  'ICEBERRY',
  'BURNTBERRY',
  'BITTERBERRY',
  'MIRACLEBERRY',
  'FOCUSSASH',
  'WHITEHERB'
]);

export type AppearanceEffect = {
  onlySpecies?: string[];
  formSuffix?: string;
  shiny?: boolean;
  formName?: string;
};

const ARCEUS = ['ARCEUS'];
const GENESECT = ['GENESECT'];

/** Mirror of the server registry (BW v3.1.1 form numbering). */
export const APPEARANCE_ITEMS_BY_INTERNAL_ID: Record<string, AppearanceEffect> = {
  SHINYCHARM: { shiny: true, formName: 'Variocolor' },
  GRISEOUSORB: { onlySpecies: ['GIRATINA'], formSuffix: '_1', formName: 'Forma Origen' },
  SHOCKDRIVE: { onlySpecies: GENESECT, formSuffix: '_1', formName: 'FulgoROM' },
  BURNDRIVE: { onlySpecies: GENESECT, formSuffix: '_2', formName: 'PiroROM' },
  CHILLDRIVE: { onlySpecies: GENESECT, formSuffix: '_3', formName: 'CrioROM' },
  DOUSEDRIVE: { onlySpecies: GENESECT, formSuffix: '_4', formName: 'HidroROM' },
  FISTPLATE: { onlySpecies: ARCEUS, formSuffix: '_1', formName: 'Tipo Lucha' },
  SKYPLATE: { onlySpecies: ARCEUS, formSuffix: '_2', formName: 'Tipo Volador' },
  TOXICPLATE: { onlySpecies: ARCEUS, formSuffix: '_3', formName: 'Tipo Veneno' },
  EARTHPLATE: { onlySpecies: ARCEUS, formSuffix: '_4', formName: 'Tipo Tierra' },
  STONEPLATE: { onlySpecies: ARCEUS, formSuffix: '_5', formName: 'Tipo Roca' },
  INSECTPLATE: { onlySpecies: ARCEUS, formSuffix: '_6', formName: 'Tipo Bicho' },
  SPOOKYPLATE: { onlySpecies: ARCEUS, formSuffix: '_7', formName: 'Tipo Fantasma' },
  IRONPLATE: { onlySpecies: ARCEUS, formSuffix: '_8', formName: 'Tipo Acero' },
  FLAMEPLATE: { onlySpecies: ARCEUS, formSuffix: '_10', formName: 'Tipo Fuego' },
  SPLASHPLATE: { onlySpecies: ARCEUS, formSuffix: '_11', formName: 'Tipo Agua' },
  MEADOWPLATE: { onlySpecies: ARCEUS, formSuffix: '_12', formName: 'Tipo Planta' },
  ZAPPLATE: { onlySpecies: ARCEUS, formSuffix: '_13', formName: 'Tipo Eléctrico' },
  MINDPLATE: { onlySpecies: ARCEUS, formSuffix: '_14', formName: 'Tipo Psíquico' },
  ICICLEPLATE: { onlySpecies: ARCEUS, formSuffix: '_15', formName: 'Tipo Hielo' },
  DRACOPLATE: { onlySpecies: ARCEUS, formSuffix: '_16', formName: 'Tipo Dragón' },
  DREADPLATE: { onlySpecies: ARCEUS, formSuffix: '_17', formName: 'Tipo Siniestro' }
};

/**
 * Inventory ids follow the designer catalog convention `item-<InternalName>`
 * (lowercased during migration), so the internal name can be derived without
 * shipping the full item catalog to players.
 */
export function getItemInternalId(item: Pick<InventoryItem, 'id'>): string {
  return item.id.replace(/^item-/i, '').trim().toUpperCase();
}

/** "pokemon-GIRATINA" (or the species name) -> "GIRATINA". */
export function getSpeciesInternalId(
  pokemon: Pick<PokemonSummary, 'sourcePokemonId' | 'name'>
): string {
  const fromSource = (pokemon.sourcePokemonId ?? '').replace(/^pokemon-/i, '').trim().toUpperCase();
  return fromSource || pokemon.name.trim().toUpperCase();
}

export function resolveAppearanceEffect(
  internalId: string,
  speciesInternalId: string
): AppearanceEffect | null {
  const effect = APPEARANCE_ITEMS_BY_INTERNAL_ID[internalId];
  if (!effect) return null;
  if (effect.onlySpecies && !effect.onlySpecies.includes(speciesInternalId)) return null;
  return effect;
}

/**
 * Rewrites a sprite path for an equipped appearance item — same rules as the
 * server: form suffix before the extension, shiny swaps the front/back
 * directory, icons are never touched (the pack has no shiny/form icons).
 */
export function applyAppearanceToSpritePath(
  src: string,
  effect: AppearanceEffect,
  kind: 'front' | 'back' | 'icon'
): string {
  if (!src || kind === 'icon') return src;
  let next = src;
  if (effect.shiny) {
    next = next.replace(`/${kind}/`, `/${kind}-shiny/`);
  }
  if (effect.formSuffix) {
    next = next.replace(/(\.[a-z0-9]+)$/i, `${effect.formSuffix}$1`);
  }
  return next;
}

/** The slot this item would occupy on this venomon, or null. */
export function getEquipmentSlotForItem(
  item: Pick<InventoryItem, 'id' | 'category'>,
  speciesInternalId: string
): EquipmentSlot | null {
  const internalId = getItemInternalId(item);
  if (resolveAppearanceEffect(internalId, speciesInternalId)) return 'appearance';
  if (BONUS_INTERNAL_IDS.has(internalId)) return 'bonus';
  if (BATTLE_INTERNAL_IDS.has(internalId) || item.category === 'berries') return 'battle';
  return null;
}

export function isEquipableForSlot(
  item: Pick<InventoryItem, 'id' | 'category' | 'quantity'>,
  slot: EquipmentSlot,
  speciesInternalId: string
): boolean {
  return item.quantity > 0 && getEquipmentSlotForItem(item, speciesInternalId) === slot;
}

/** Legacy helper kept for the party-menu "Equip Item" flow (bonus slot). */
export function isEquipableBonusItem(item: Pick<InventoryItem, 'id' | 'quantity'>): boolean {
  return item.quantity > 0 && BONUS_INTERNAL_IDS.has(getItemInternalId(item));
}
