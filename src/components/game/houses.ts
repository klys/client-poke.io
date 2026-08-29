// Housing state as broadcast by the server (server-poke.io/components/Housing.ts).
//
// A house INSTANCE is an ordinary map whose id is `<template>--house-<apartment>`
// (playableMapRuntime resolves it to the template's tiles). While the player
// stands inside one, the server sends `house:sync` with the owner/lock/sale
// state plus the furniture roster; furniture changes arrive as
// `house:furniture-update`. Door cells are plain editor placements
// (`editorData.houseDoors`) — the door menu itself is fetched on demand with
// `house:door-info`.

import { useEffect, useState } from "react";

export const HOUSE_DOOR_MENU_EVENT = "pokecraft:house-door-menu";
export const HOUSE_MENU_EVENT = "pokecraft:house-menu";
export const HOUSE_PLACE_EVENT = "pokecraft:house-place";

export type HouseFurniture = {
  id: string;
  itemId: string;
  itemName: string;
  iconSrc: string;
  /** Anchor cell (top-left), like an authored map object. */
  x: number;
  y: number;
  placedAt: number;
  /** Linked designer map object drawn at `width`×`height` px from the anchor;
   * absent = the item icon on one tile. */
  objectId?: string;
  imageSrc?: string;
  width?: number;
  height?: number;
  /** Solid pieces block walking over their rect. */
  solid: boolean;
};

/** Inclusive cell range a piece covers on a map with the given cell size. */
export function furnitureCells(piece: HouseFurniture, cellSize: number) {
  const width = piece.width && piece.width > 0 ? piece.width : cellSize;
  const height = piece.height && piece.height > 0 ? piece.height : cellSize;
  return {
    x0: piece.x,
    y0: piece.y,
    x1: piece.x + Math.max(1, Math.ceil(width / cellSize - 0.01)) - 1,
    y1: piece.y + Math.max(1, Math.ceil(height / cellSize - 0.01)) - 1
  };
}

export type HouseInfo = {
  mapId: string;
  apartmentId: string;
  doorId: string;
  templateMapId: string;
  name: string;
  ownerCharacterId: number | null;
  ownerName: string | null;
  isOwner: boolean;
  keyCodeSet: boolean;
  salePrice: number | null;
  furniture: HouseFurniture[];
  /** Owner-chosen BGM name; null = the template map's music. */
  bgm: string | null;
  customName: boolean;
};

export type HouseApartmentSummary = {
  id: string;
  index: number;
  name: string;
  templateMapId: string;
  price: number;
  owned: boolean;
  ownerName: string | null;
  isOwner: boolean;
  locked: boolean;
  keyCodeSet: boolean;
  forSale: boolean;
  available: boolean;
};

export type HouseDoorSummary = {
  doorId: string;
  mapId: string;
  x: number;
  y: number;
  name: string;
  apartments: HouseApartmentSummary[];
};

export type HouseDoorPlacement = {
  id: string;
  x: number;
  y: number;
  name?: string;
  apartments: Array<{ price: number; mapId: string }>;
};

const housesByMap = new Map<string, HouseInfo>();
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

export function subscribeHouses(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function sanitizeFurniture(value: unknown): HouseFurniture | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<HouseFurniture>;
  if (typeof raw.id !== "string" || typeof raw.itemId !== "string") return null;
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null;
  return {
    id: raw.id,
    itemId: raw.itemId,
    itemName: typeof raw.itemName === "string" ? raw.itemName : raw.itemId,
    iconSrc: typeof raw.iconSrc === "string" ? raw.iconSrc : "",
    x: raw.x,
    y: raw.y,
    placedAt: isFiniteNumber(raw.placedAt) ? raw.placedAt : 0,
    ...(typeof raw.objectId === "string" && raw.objectId && typeof raw.imageSrc === "string" && raw.imageSrc
      ? {
          objectId: raw.objectId,
          imageSrc: raw.imageSrc,
          width: isFiniteNumber(raw.width) && raw.width > 0 ? raw.width : undefined,
          height: isFiniteNumber(raw.height) && raw.height > 0 ? raw.height : undefined
        }
      : {}),
    solid: raw.solid !== false
  };
}

function sanitizeHouse(value: unknown): HouseInfo | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<HouseInfo>;
  if (typeof raw.mapId !== "string" || typeof raw.apartmentId !== "string") return null;
  return {
    mapId: raw.mapId,
    apartmentId: raw.apartmentId,
    doorId: typeof raw.doorId === "string" ? raw.doorId : "",
    templateMapId: typeof raw.templateMapId === "string" ? raw.templateMapId : "",
    name: typeof raw.name === "string" ? raw.name : "",
    ownerCharacterId: isFiniteNumber(raw.ownerCharacterId) ? raw.ownerCharacterId : null,
    ownerName: typeof raw.ownerName === "string" ? raw.ownerName : null,
    isOwner: raw.isOwner === true,
    keyCodeSet: raw.keyCodeSet === true,
    salePrice: isFiniteNumber(raw.salePrice) ? raw.salePrice : null,
    furniture: Array.isArray(raw.furniture)
      ? raw.furniture.map(sanitizeFurniture).filter((item): item is HouseFurniture => Boolean(item))
      : [],
    bgm: typeof raw.bgm === "string" && raw.bgm ? raw.bgm : null,
    customName: raw.customName === true
  };
}

/** `house:sync` — the instance the player just arrived in (or its refresh). */
export function applyHouseSync(raw: unknown) {
  const house = sanitizeHouse(raw);
  if (!house) return;
  housesByMap.set(house.mapId, house);
  notify();
}

/** `house:furniture-update` — one piece placed or picked up. */
export function applyHouseFurnitureUpdate(mapId: string, placed: unknown, removedId: unknown) {
  const house = housesByMap.get(mapId);
  if (!house) return;
  const piece = sanitizeFurniture(placed);
  let furniture = house.furniture;
  if (typeof removedId === "string") {
    furniture = furniture.filter((item) => item.id !== removedId);
  }
  if (piece) {
    furniture = [...furniture.filter((item) => item.id !== piece.id), piece];
  }
  housesByMap.set(mapId, { ...house, furniture });
  notify();
}

export function getHouse(mapId: string | null | undefined): HouseInfo | null {
  return mapId ? housesByMap.get(mapId) ?? null : null;
}

export function getHouseFurniture(mapId: string | null | undefined): HouseFurniture[] {
  return getHouse(mapId)?.furniture ?? [];
}

/** The piece covering a cell (linked objects can span several cells). */
export function getHouseFurnitureAt(
  mapId: string | null | undefined,
  x: number,
  y: number,
  cellSize = 32
): HouseFurniture | null {
  return (
    getHouseFurniture(mapId).find((item) => {
      const cells = furnitureCells(item, cellSize);
      return x >= cells.x0 && x <= cells.x1 && y >= cells.y0 && y <= cells.y1;
    }) ?? null
  );
}

/** The door placement at a cell of the active map's editor data, if any. */
export function getHouseDoorAt(
  editorData: { houseDoors?: HouseDoorPlacement[] } | null | undefined,
  x: number,
  y: number
): HouseDoorPlacement | null {
  return (editorData?.houseDoors ?? []).find((door) => door.x === x && door.y === y) ?? null;
}

/** React hook: the house instance the given map id belongs to (null outside). */
export function useHouse(mapId: string | null | undefined): HouseInfo | null {
  const [, setVersion] = useState(0);
  useEffect(() => subscribeHouses(() => setVersion((value) => value + 1)), []);
  return getHouse(mapId);
}
