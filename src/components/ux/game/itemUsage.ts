/**
 * Client mirror of the server's field-item classifier
 * (server-poke.io `components/battle/fieldItemEffects.ts`). The server remains
 * the authority that APPLIES effects; this only decides how the bag modal
 * should behave — ask for a Venomon, a Venomon + move, or nothing — and which
 * key items are handled purely client-side (e.g. Town Map opens the map).
 *
 * Item ids in the inventory are opaque; we resolve each one to its Essentials
 * internal id (and heal amount) through the cached `items` designer section.
 */
import { readStoredDesignerSectionPayload } from "../../designer/designerCache";
import type { InventoryItem } from "../../../context/authContext";

export type ItemTargetKind = "pokemon" | "pokemon-move" | "none";

/** A key item the client resolves without touching the server. */
export type ClientKeyAction = "town-map";

export interface ItemUsage {
  /** What the modal must collect before the item is used. */
  target: ItemTargetKind;
  /** Set for key items the client handles locally instead of via the server. */
  clientAction?: ClientKeyAction;
  /** True when the item does something usable at all (drives the Use button). */
  usable: boolean;
}

const STATUS_CURE_IDS = new Set([
  "ANTIDOTE", "PARLYZHEAL", "PARALYZEHEAL", "AWAKENING", "BURNHEAL", "ICEHEAL",
  "FULLHEAL", "LAVACOOKIE", "OLDGATEAU", "CASTELIACONE", "RAGECANDYBAR",
  "SWEETHEART", "HEALPOWDER", "LUMBERRY", "CHERIBERRY", "CHESTOBERRY",
  "PECHABERRY", "RAWSTBERRY", "ASPEARBERRY", "PERSIMBERRY", "MIRACLEBERRY",
  "BITTERBERRY", "PRZCUREBERRY", "MINTBERRY", "PSNCUREBERRY", "ICEBERRY", "BURNTBERRY"
]);

const REVIVE_IDS = new Set(["REVIVE", "MAXREVIVE", "REVIVALHERB"]);
const REVIVE_ALL_IDS = new Set(["SACREDASH"]);
const VITAMIN_IDS = new Set([
  "HPUP", "PROTEIN", "IRON", "CALCIUM", "ZINC", "CARBOS",
  "HEALTHWING", "MUSCLEWING", "RESISTWING", "GENIUSWING", "CLEVERWING", "SWIFTWING"
]);
const PP_RESTORE_ONE_IDS = new Set(["ETHER", "MAXETHER", "LEPPABERRY"]);
const PP_RESTORE_ALL_IDS = new Set(["ELIXIR", "MAXELIXIR"]);
const PP_UP_IDS = new Set(["PPUP", "PPMAX"]);
const EVOLUTION_STONE_IDS = new Set([
  "FIRESTONE", "WATERSTONE", "THUNDERSTONE", "LEAFSTONE", "MOONSTONE", "SUNSTONE",
  "SHINYSTONE", "DUSKSTONE", "DAWNSTONE", "ICESTONE", "OVALSTONE", "METALCOAT",
  "DRAGONSCALE", "KINGSROCK", "UPGRADE", "DUBIOUSDISC", "PROTECTOR", "ELECTIRIZER",
  "MAGMARIZER", "REAPERCLOTH", "PRISMSCALE", "WHIPPEDDREAM", "SACHET",
  "DEEPSEATOOTH", "DEEPSEASCALE", "RAZORCLAW", "RAZORFANG", "LINKINGCORD", "LINKCABLE"
]);
const REPEL_IDS = new Set(["REPEL", "SUPERREPEL", "MAXREPEL"]);
const WAKE_FLUTE_IDS = new Set(["POKEFLUTE", "BLUEFLUTE"]);
const SERVER_KEY_ITEM_IDS = new Set([
  "BICYCLE", "ITEMFINDER", "DOWSINGMACHINE", "OLDROD", "GOODROD", "SUPERROD", "POKERADAR"
]);

interface CatalogEntry {
  essentialsId: string;
  healHp: number;
}

/** Reads the cached items catalog into a `itemId -> {essentialsId, healHp}` map. */
function readItemCatalogIndex(): Map<string, CatalogEntry> {
  const index = new Map<string, CatalogEntry>();
  try {
    readStoredDesignerSectionPayload("items").state.items.forEach((item) => {
      const profile = (
        item as { itemProfile?: { essentialsId?: string; statModifiers?: { hp?: number } } }
      ).itemProfile;
      const essentialsId =
        typeof profile?.essentialsId === "string" ? profile.essentialsId.trim().toUpperCase() : "";
      const healHp =
        typeof profile?.statModifiers?.hp === "number" && Number.isFinite(profile.statModifiers.hp)
          ? Math.max(0, Math.round(profile.statModifiers.hp))
          : 0;
      if (item.id) {
        index.set(item.id, { essentialsId, healHp });
      }
    });
  } catch {
    // No cached catalog yet — fall back to category-only classification below.
  }
  return index;
}

const NOT_USABLE: ItemUsage = { target: "none", usable: false };

function classifyByEssentialsId(essentialsId: string, healHp: number, category: string): ItemUsage {
  const id = essentialsId.toUpperCase();

  if (REVIVE_ALL_IDS.has(id) || REPEL_IDS.has(id) || id === "ESCAPEROPE" || WAKE_FLUTE_IDS.has(id)) {
    return { target: "none", usable: true };
  }
  if (id === "TOWNMAP") {
    return { target: "none", usable: true, clientAction: "town-map" };
  }
  if (SERVER_KEY_ITEM_IDS.has(id)) {
    return { target: "none", usable: true };
  }
  if (PP_RESTORE_ONE_IDS.has(id) || PP_UP_IDS.has(id)) {
    return { target: "pokemon-move", usable: true };
  }
  if (
    REVIVE_IDS.has(id) ||
    VITAMIN_IDS.has(id) ||
    PP_RESTORE_ALL_IDS.has(id) ||
    EVOLUTION_STONE_IDS.has(id) ||
    STATUS_CURE_IDS.has(id) ||
    id === "FULLRESTORE" ||
    id === "RARECANDY"
  ) {
    return { target: "pokemon", usable: true };
  }
  if (healHp > 0) {
    return { target: "pokemon", usable: true };
  }
  // Unknown id: usable/berry items default to a Venomon target, others inert.
  if (category === "usable" || category === "berries") {
    return { target: "pokemon", usable: true };
  }
  return NOT_USABLE;
}

/** Classifies a bag item for the Use flow. */
export function classifyInventoryItem(item: InventoryItem): ItemUsage {
  if (item.category === "moves" || item.category === "quest") {
    // Moves are taught; quest items are handled per-id (Town Map etc.).
    if (item.category === "moves") {
      return NOT_USABLE;
    }
  }
  const entry = readItemCatalogIndex().get(item.id);
  if (!entry) {
    // No catalog match: only medicine-style pockets are usable, target a Venomon.
    if (item.category === "usable" || item.category === "berries") {
      return { target: "pokemon", usable: true };
    }
    return NOT_USABLE;
  }
  return classifyByEssentialsId(entry.essentialsId, entry.healHp, item.category);
}
