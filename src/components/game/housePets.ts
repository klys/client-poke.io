// House pets as broadcast by the server (server-poke.io/components/HousePets.ts).
//
// Pets WALK on the follower channel (followerActors.ts, owner id
// `roam:<char>:<petId>`); this store keeps what the follower channel does not
// know: who each pet is, how it feels, and what lies on the floor of the
// house (eggs, messes). `pet:sync` arrives on entering a house instance,
// `pet:update` whenever one pet / floor thing changes.

import { useEffect, useState } from "react";

export const PET_MENU_EVENT = "pokecraft:pet-menu";

export type PetGender = "male" | "female" | "genderless";

export type HousePet = {
  id: string;
  ownerId: string;
  apartmentId: string;
  mapId: string;
  ownerCharacterId: number;
  ownerName: string;
  name: string;
  species: string;
  level: number;
  gender: PetGender;
  charset: string;
  iconImageSrc?: string;
  hunger: number;
  boredom: number;
  loneliness: number;
  mood: number;
  sick: boolean;
  courting: boolean;
  eggDueAt: number | null;
  leftAt: number;
};

export type PetGroundThing = {
  id: string;
  apartmentId: string;
  mapId: string;
  kind: "egg" | "mess";
  x: number;
  y: number;
  ownerCharacterId: number;
  byPetName: string;
  speciesName?: string;
  createdAt: number;
};

export type PetNotification = {
  id: string;
  kind: string;
  petId: string;
  petName: string;
  apartmentId: string;
  houseName: string;
  mapId: string;
  text: string;
  at: number;
};

type MapPets = { pets: Map<string, HousePet>; ground: Map<string, PetGroundThing> };

const byMap = new Map<string, MapPets>();
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

export function subscribeHousePets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp100 = (value: unknown) => (isFiniteNumber(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0);

export function sanitizePet(value: unknown): HousePet | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<HousePet>;
  if (typeof raw.id !== "string" || typeof raw.ownerId !== "string" || typeof raw.mapId !== "string") return null;
  return {
    id: raw.id,
    ownerId: raw.ownerId,
    apartmentId: typeof raw.apartmentId === "string" ? raw.apartmentId : "",
    mapId: raw.mapId,
    ownerCharacterId: isFiniteNumber(raw.ownerCharacterId) ? raw.ownerCharacterId : 0,
    ownerName: typeof raw.ownerName === "string" ? raw.ownerName : "",
    name: typeof raw.name === "string" ? raw.name : raw.id,
    species: typeof raw.species === "string" ? raw.species : "",
    level: isFiniteNumber(raw.level) ? raw.level : 1,
    gender: raw.gender === "male" || raw.gender === "female" ? raw.gender : "genderless",
    charset: typeof raw.charset === "string" ? raw.charset : "",
    iconImageSrc: typeof raw.iconImageSrc === "string" ? raw.iconImageSrc : undefined,
    hunger: clamp100(raw.hunger),
    boredom: clamp100(raw.boredom),
    loneliness: clamp100(raw.loneliness),
    mood: clamp100(raw.mood),
    sick: raw.sick === true,
    courting: raw.courting === true,
    eggDueAt: isFiniteNumber(raw.eggDueAt) ? raw.eggDueAt : null,
    leftAt: isFiniteNumber(raw.leftAt) ? raw.leftAt : 0
  };
}

export function sanitizeGround(value: unknown): PetGroundThing | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PetGroundThing>;
  if (typeof raw.id !== "string" || typeof raw.mapId !== "string") return null;
  if (raw.kind !== "egg" && raw.kind !== "mess") return null;
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null;
  return {
    id: raw.id,
    apartmentId: typeof raw.apartmentId === "string" ? raw.apartmentId : "",
    mapId: raw.mapId,
    kind: raw.kind,
    x: raw.x,
    y: raw.y,
    ownerCharacterId: isFiniteNumber(raw.ownerCharacterId) ? raw.ownerCharacterId : 0,
    byPetName: typeof raw.byPetName === "string" ? raw.byPetName : "",
    speciesName: typeof raw.speciesName === "string" ? raw.speciesName : undefined,
    createdAt: isFiniteNumber(raw.createdAt) ? raw.createdAt : 0
  };
}

function entryFor(mapId: string): MapPets {
  let entry = byMap.get(mapId);
  if (!entry) {
    entry = { pets: new Map(), ground: new Map() };
    byMap.set(mapId, entry);
  }
  return entry;
}

/** `pet:sync` — the whole roster of a house instance. */
export function applyPetSync(mapId: string, pets: unknown[], ground: unknown[]) {
  if (!mapId) return;
  const entry: MapPets = { pets: new Map(), ground: new Map() };
  (Array.isArray(pets) ? pets : []).forEach((raw) => {
    const pet = sanitizePet(raw);
    if (pet) entry.pets.set(pet.id, pet);
  });
  (Array.isArray(ground) ? ground : []).forEach((raw) => {
    const thing = sanitizeGround(raw);
    if (thing) entry.ground.set(thing.id, thing);
  });
  byMap.set(mapId, entry);
  notify();
}

/** `pet:update` — one pet / floor thing changed. */
export function applyPetUpdate(
  mapId: string,
  data: { pet?: unknown; removedPetId?: unknown; ground?: unknown; removedGroundId?: unknown }
) {
  if (!mapId) return;
  const entry = entryFor(mapId);
  let changed = false;
  const pet = sanitizePet(data.pet);
  if (pet) {
    entry.pets.set(pet.id, pet);
    changed = true;
  }
  if (typeof data.removedPetId === "string" && entry.pets.delete(data.removedPetId)) changed = true;
  const thing = sanitizeGround(data.ground);
  if (thing) {
    entry.ground.set(thing.id, thing);
    changed = true;
  }
  if (typeof data.removedGroundId === "string" && entry.ground.delete(data.removedGroundId)) changed = true;
  if (changed) notify();
}

export function getHousePets(mapId: string | null | undefined): HousePet[] {
  return mapId ? Array.from(byMap.get(mapId)?.pets.values() ?? []) : [];
}

export function getPetGround(mapId: string | null | undefined): PetGroundThing[] {
  return mapId ? Array.from(byMap.get(mapId)?.ground.values() ?? []) : [];
}

export function getPetByOwnerId(mapId: string | null | undefined, ownerId: string): HousePet | null {
  return getHousePets(mapId).find((pet) => pet.ownerId === ownerId) ?? null;
}

/** React hook: pets + floor things of a map (re-renders on changes). */
export function useHousePets(mapId: string | null | undefined): { pets: HousePet[]; ground: PetGroundThing[] } {
  const [, setVersion] = useState(0);
  useEffect(() => subscribeHousePets(() => setVersion((value) => value + 1)), []);
  return { pets: getHousePets(mapId), ground: getPetGround(mapId) };
}

export const GENDER_SYMBOL: Record<PetGender, string> = { male: "♂", female: "♀", genderless: "" };
export const GENDER_COLOR: Record<PetGender, string> = { male: "#4dabf7", female: "#f783ac", genderless: "#adb5bd" };
