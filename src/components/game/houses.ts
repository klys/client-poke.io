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
  x: number;
  y: number;
  placedAt: number;
};

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
    placedAt: isFiniteNumber(raw.placedAt) ? raw.placedAt : 0
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
      : []
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

export function getHouseFurnitureAt(mapId: string | null | undefined, x: number, y: number): HouseFurniture | null {
  return getHouseFurniture(mapId).find((item) => item.x === x && item.y === y) ?? null;
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
