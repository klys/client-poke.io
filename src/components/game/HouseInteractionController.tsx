/**
 * Housing UX — the single client entry point for apartments and houses
 * (server: components/Housing.ts). Mirrors BerryInteractionController: every
 * input method funnels into one contextual menu, every choice is validated
 * server-side and answered with `house:result`.
 *
 *  DOOR   click / tap / right-click / face an apartment door cell (an editor
 *         `houseDoors` placement) → apartments list (house:door-info) →
 *         Enter · Buy · Set key code · Put up for sale · … A locked
 *         apartment asks for its code on a keypad before entering.
 *  HOUSE  inside an instance: right-click the floor, or click / face a
 *         piece of furniture → Pick up (owner) · Leave the house.
 *  PLACE  the bag's "Place" on a furniture item (HOUSE_PLACE_EVENT) arms a
 *         placement: the next click on a floor tile places it there.
 */
import { CSSProperties, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Button, HStack, Input, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import type { Socket } from "socket.io-client";
import { AppContext } from "../../context/appContext";
import { MenuChoiceButton, RetroPanel } from "../ux/game/NpcInteractions";
import { useT } from "../../i18n";
import {
  getHouse,
  getHouseDoorAt,
  getHouseFurnitureAt,
  HOUSE_DOOR_MENU_EVENT,
  HOUSE_MENU_EVENT,
  HOUSE_PLACE_EVENT,
  type HouseApartmentSummary,
  type HouseDoorPlacement,
  type HouseDoorSummary
} from "./houses";

const INFO_TIMEOUT_MS = 2500;
const RESULT_LINGER_MS = 2200;

type Phase = "loading" | "apartments" | "apartment" | "keypad" | "price" | "house" | "name" | "music" | "placing" | "result";

interface Session {
  kind: "door" | "house" | "placing";
  phase: Phase;
  menuX: number;
  menuY: number;
  selected: number;
  doorId?: string;
  door?: HouseDoorSummary;
  apartmentId?: string;
  keypadPurpose?: "enter" | "setKey";
  digits: string;
  furnitureId?: string | null;
  placeItemId?: string;
  placeItemName?: string;
  /** Rename phase: the text being typed. */
  nameDraft?: string;
  /** Music phase: the tracks the server offers. */
  bgms?: string[];
  message?: string;
  ok?: boolean;
}

interface Props {
  socket: Socket;
  player: { x?: number; y?: number; angle?: number } | null;
  mapId: string | null;
  cellSize: number;
  editorData: { houseDoors?: HouseDoorPlacement[] } | null;
}

type Entry = { key: string; label: string; disabled?: boolean; run: () => void };

const isUxTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return Boolean(
    target.closest('[data-game-ux="true"]') ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable
  );
};

const otherMenuActive = () =>
  typeof document !== "undefined" &&
  (document.body.dataset.eventActive === "1" ||
    document.body.dataset.waterMenuActive === "1" ||
    document.body.dataset.berryMenuActive === "1");

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

/** Money params arrive as plain numbers; the UI shows them with the $ sign. */
const money = (value: number | string) => `$${Number(value).toLocaleString("es-VE")}`;
const formatParams = (params?: Record<string, string>) =>
  params && typeof params.price === "string" ? { ...params, price: money(params.price) } : params;

const HouseInteractionController = ({ socket, player, mapId, cellSize, editorData }: Props) => {
  const t = useT();
  const { waiting, activeNpcInteraction } = useContext(AppContext);
  const [session, setSession] = useState<Session | null>(null);

  const stateRef = useRef({ player, mapId, cellSize, editorData, waiting, activeNpcInteraction });
  stateRef.current = { player, mapId, cellSize, editorData, waiting, activeNpcInteraction };
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;
  const timersRef = useRef<number[]>([]);
  const submitLockRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  // Freeze walk/interact input while a menu is up (placement keeps walking).
  useEffect(() => {
    const menuOpen = session !== null && session.phase !== "result" && session.kind !== "placing";
    if (menuOpen) {
      document.body.dataset.houseMenuActive = "1";
    } else {
      delete document.body.dataset.houseMenuActive;
    }
    return () => {
      delete document.body.dataset.houseMenuActive;
    };
  }, [session]);

  // Leaving the map (entering/leaving a house) closes whatever was open.
  useEffect(() => {
    setSession((prev) => (prev && prev.kind !== "placing" ? null : prev));
    if (mapId && !getHouse(mapId)) {
      setSession((prev) => (prev?.kind === "placing" ? null : prev));
    }
  }, [mapId]);

  const anchorForCell = (x: number, y: number) => {
    const map = document.getElementById("map");
    const size = stateRef.current.cellSize || 32;
    if (!map) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const rect = map.getBoundingClientRect();
    return { x: rect.left + x * size + size / 2, y: rect.top + y * size };
  };

  const openDoor = (doorId: string, anchor: { x: number; y: number }) => {
    clearTimers();
    submitLockRef.current = false;
    setSession({ kind: "door", phase: "loading", menuX: anchor.x, menuY: anchor.y, selected: 0, doorId, digits: "" });
    socket.emit("house:door-info", { doorId });
    const timeoutId = window.setTimeout(() => {
      setSession((prev) => (prev && prev.phase === "loading" && prev.kind === "door" ? null : prev));
    }, INFO_TIMEOUT_MS);
    timersRef.current.push(timeoutId);
  };

  const openHouseMenu = (furnitureId: string | null, anchor: { x: number; y: number }) => {
    clearTimers();
    submitLockRef.current = false;
    setSession({ kind: "house", phase: "house", menuX: anchor.x, menuY: anchor.y, selected: 0, furnitureId, digits: "" });
  };

  const startPlacing = (itemId: string, itemName: string) => {
    clearTimers();
    submitLockRef.current = false;
    setSession({
      kind: "placing",
      phase: "placing",
      menuX: window.innerWidth / 2,
      menuY: 72,
      selected: 0,
      placeItemId: itemId,
      placeItemName: itemName,
      digits: ""
    });
  };

  const cancel = () => {
    clearTimers();
    submitLockRef.current = false;
    setSession(null);
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  const openDoorRef = useRef(openDoor);
  openDoorRef.current = openDoor;
  const openHouseMenuRef = useRef(openHouseMenu);
  openHouseMenuRef.current = openHouseMenu;
  const startPlacingRef = useRef(startPlacing);
  startPlacingRef.current = startPlacing;

  const playerCell = () => {
    const snap = stateRef.current;
    const size = snap.cellSize || 32;
    return { x: Math.round((snap.player?.x ?? 0) / size), y: Math.round((snap.player?.y ?? 0) / size) };
  };
  const isNear = (cell: { x: number; y: number }) => {
    const me = playerCell();
    return Math.abs(cell.x - me.x) + Math.abs(cell.y - me.y) <= 1;
  };
  const isNearRef = useRef(isNear);
  isNearRef.current = isNear;

  const showResult = (ok: boolean, message: string, closeAfter = true) => {
    clearTimers();
    submitLockRef.current = false;
    setSession((prev) => (prev ? { ...prev, phase: "result", ok, message } : prev));
    if (closeAfter) {
      const id = window.setTimeout(() => setSession(null), RESULT_LINGER_MS);
      timersRef.current.push(id);
    }
  };

  // Pointer entry point (capture phase: steals the click from click-to-move).
  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const snap = stateRef.current;
      const current = sessionRef.current;
      if (isUxTarget(event.target)) return;
      const map = document.getElementById("map");
      const target = event.target as Node | null;
      const overMap = Boolean(map && target && map.contains(target));

      if (current && current.kind !== "placing") {
        if (current.phase === "result") return;
        // A click outside the panel dismisses the menu.
        event.stopImmediatePropagation();
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (!overMap || !map || !snap.player || !snap.mapId) return;
      if (snap.waiting || snap.activeNpcInteraction || otherMenuActive()) return;

      const rect = map.getBoundingClientRect();
      const size = snap.cellSize || 32;
      const cellX = Math.floor((event.clientX - rect.left) / size);
      const cellY = Math.floor((event.clientY - rect.top) / size);

      if (current?.kind === "placing") {
        if (event.type === "contextmenu") {
          event.stopImmediatePropagation();
          event.preventDefault();
          cancelRef.current();
          return;
        }
        if (submitLockRef.current || !current.placeItemId) return;
        event.stopImmediatePropagation();
        event.preventDefault();
        submitLockRef.current = true;
        socket.emit("house:furniture-place", { itemId: current.placeItemId, x: cellX, y: cellY });
        setSession((prev) => (prev ? { ...prev, phase: "loading" } : prev));
        return;
      }

      const door = getHouseDoorAt(snap.editorData, cellX, cellY);
      if (door && isNearRef.current(door)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        openDoorRef.current(door.id, { x: event.clientX, y: event.clientY });
        return;
      }

      const house = getHouse(snap.mapId);
      if (!house) return;
      const furniture = getHouseFurnitureAt(snap.mapId, cellX, cellY);
      if (furniture) {
        event.stopImmediatePropagation();
        event.preventDefault();
        openHouseMenuRef.current(furniture.id, { x: event.clientX, y: event.clientY });
        return;
      }
      if (event.type === "contextmenu") {
        event.stopImmediatePropagation();
        event.preventDefault();
        openHouseMenuRef.current(null, { x: event.clientX, y: event.clientY });
      }
    };
    window.addEventListener("click", onPointer, true);
    window.addEventListener("contextmenu", onPointer, true);
    return () => {
      window.removeEventListener("click", onPointer, true);
      window.removeEventListener("contextmenu", onPointer, true);
    };
  }, [socket]);

  // Keyboard/gamepad + bag entry points.
  useEffect(() => {
    const onDoorMenu = (event: Event) => {
      const snap = stateRef.current;
      if (sessionRef.current || !snap.mapId) return;
      if (snap.waiting || snap.activeNpcInteraction || otherMenuActive()) return;
      const doorId = (event as CustomEvent<{ doorId?: string }>).detail?.doorId;
      const door = (snap.editorData?.houseDoors ?? []).find((candidate) => candidate.id === doorId);
      if (!door) return;
      openDoorRef.current(door.id, anchorForCell(door.x, door.y));
    };
    const onHouseMenu = (event: Event) => {
      const snap = stateRef.current;
      if (sessionRef.current || !snap.mapId || !getHouse(snap.mapId)) return;
      if (snap.waiting || snap.activeNpcInteraction || otherMenuActive()) return;
      const furnitureId = (event as CustomEvent<{ furnitureId?: string }>).detail?.furnitureId ?? null;
      const me = playerCell();
      openHouseMenuRef.current(furnitureId, anchorForCell(me.x, me.y));
    };
    const onPlace = (event: Event) => {
      const snap = stateRef.current;
      const detail = (event as CustomEvent<{ itemId?: string; itemName?: string }>).detail;
      if (!detail?.itemId || !snap.mapId || !getHouse(snap.mapId)?.isOwner) return;
      startPlacingRef.current(detail.itemId, detail.itemName ?? detail.itemId);
    };
    window.addEventListener(HOUSE_DOOR_MENU_EVENT, onDoorMenu);
    window.addEventListener(HOUSE_MENU_EVENT, onHouseMenu);
    window.addEventListener(HOUSE_PLACE_EVENT, onPlace);
    return () => {
      window.removeEventListener(HOUSE_DOOR_MENU_EVENT, onDoorMenu);
      window.removeEventListener(HOUSE_MENU_EVENT, onHouseMenu);
      window.removeEventListener(HOUSE_PLACE_EVENT, onPlace);
    };
  }, []);

  // Server answers.
  useEffect(() => {
    const onDoorInfo = (data: { door?: HouseDoorSummary }) => {
      if (!data?.door) return;
      setSession((prev) => {
        if (!prev || prev.kind !== "door" || prev.doorId !== data.door!.doorId) return prev;
        clearTimers();
        const single = data.door!.apartments.length === 1;
        return {
          ...prev,
          door: data.door,
          phase: single ? "apartment" : "apartments",
          apartmentId: single ? data.door!.apartments[0].id : undefined,
          selected: 0
        };
      });
    };
    const onResult = (data: { action: string; ok: boolean; messageKey: string; params?: Record<string, string> }) => {
      const message = t(data.messageKey, formatParams(data.params));
      const current = sessionRef.current;
      if (data.action === "roam") return; // party window feedback goes through auth:info
      if (!current) return;
      if (data.ok && (data.action === "enter" || data.action === "leave")) {
        cancelRef.current();
        return;
      }
      if (data.action === "door-info") {
        showResult(false, message);
        return;
      }
      showResult(data.ok, message);
    };
    const onMusicList = (data: { bgms?: string[] }) => {
      const bgms = Array.isArray(data?.bgms) ? data.bgms.filter((name): name is string => typeof name === "string") : [];
      setSession((prev) => {
        if (!prev || prev.kind !== "house" || prev.phase !== "loading") return prev;
        clearTimers();
        const current = getHouse(stateRef.current.mapId)?.bgm ?? null;
        const index = current ? bgms.indexOf(current) + 1 : 0;
        return { ...prev, phase: "music", bgms, selected: Math.max(0, index) };
      });
    };
    socket.on("house:door-info", onDoorInfo);
    socket.on("house:result", onResult);
    socket.on("house:music-list", onMusicList);
    return () => {
      socket.off("house:door-info", onDoorInfo);
      socket.off("house:result", onResult);
      socket.off("house:music-list", onMusicList);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, t]);

  // ── Menu model ────────────────────────────────────────────────────────

  const apartmentStatus = (apt: HouseApartmentSummary) => {
    if (!apt.available) return t("house.status.unavailable");
    if (apt.isOwner) return t("house.status.yours") + (apt.keyCodeSet ? ` · ${t("house.status.locked")}` : "");
    if (apt.forSale) return `${t("house.status.forSale", { price: money(apt.price) })} · ${t("house.status.owned", { name: apt.ownerName ?? "?" })}`;
    if (apt.owned) return `${t("house.status.owned", { name: apt.ownerName ?? "?" })}${apt.locked ? ` · ${t("house.status.locked")}` : ""}`;
    return t("house.status.free", { price: money(apt.price) });
  };

  const submit = (event: string, payload: Record<string, unknown>) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    socket.emit(event, payload);
    setSession((prev) => (prev ? { ...prev, phase: "loading" } : prev));
  };

  const entriesFor = (current: Session): Entry[] => {
    const house = getHouse(stateRef.current.mapId);
    if (current.kind === "house") {
      const entries: Entry[] = [];
      if (current.furnitureId && house?.isOwner) {
        const piece = house.furniture.find((item) => item.id === current.furnitureId);
        entries.push({
          key: "pick",
          label: t("house.action.pick", { name: piece?.itemName ?? "" }),
          run: () => submit("house:furniture-pick", { furnitureId: current.furnitureId })
        });
      }
      if (house?.isOwner && !current.furnitureId) {
        entries.push({
          key: "rename",
          label: t("house.action.rename"),
          run: () =>
            setSession((prev) =>
              prev ? { ...prev, phase: "name", nameDraft: house.customName ? house.name : "", selected: 0 } : prev
            )
        });
        entries.push({
          key: "music",
          label: t("house.action.music"),
          run: () => {
            setSession((prev) => (prev ? { ...prev, phase: "loading" } : prev));
            socket.emit("house:music-list");
            const timeoutId = window.setTimeout(() => {
              setSession((prev) => (prev && prev.phase === "loading" && prev.kind === "house" ? { ...prev, phase: "house" } : prev));
            }, INFO_TIMEOUT_MS);
            timersRef.current.push(timeoutId);
          }
        });
      }
      entries.push({ key: "leave", label: t("house.action.leave"), run: () => submit("house:leave", {}) });
      entries.push({ key: "cancel", label: t("house.action.cancel"), run: () => cancelRef.current() });
      return entries;
    }
    if (current.kind === "door" && current.door) {
      if (current.phase === "apartments") {
        return [
          ...current.door.apartments.map<Entry>((apt) => ({
            key: apt.id,
            label: `${apt.name} — ${apartmentStatus(apt)}`,
            disabled: !apt.available,
            run: () => setSession((prev) => (prev ? { ...prev, phase: "apartment", apartmentId: apt.id, selected: 0 } : prev))
          })),
          { key: "cancel", label: t("house.action.cancel"), run: () => cancelRef.current() }
        ];
      }
      const apt = current.door.apartments.find((candidate) => candidate.id === current.apartmentId);
      if (!apt) return [{ key: "cancel", label: t("house.action.cancel"), run: () => cancelRef.current() }];
      const entries: Entry[] = [];
      if (apt.available) {
        entries.push({
          key: "enter",
          label: t("house.action.enter"),
          run: () =>
            apt.locked
              ? setSession((prev) => (prev ? { ...prev, phase: "keypad", keypadPurpose: "enter", digits: "", selected: 0 } : prev))
              : submit("house:enter", { apartmentId: apt.id })
        });
        if (!apt.owned || (apt.forSale && !apt.isOwner)) {
          entries.push({
            key: "buy",
            label: t("house.action.buy", { price: money(apt.price) }),
            run: () => submit("house:buy", { apartmentId: apt.id })
          });
        }
        if (apt.isOwner) {
          entries.push({
            key: "setKey",
            label: t("house.action.setKey"),
            run: () => setSession((prev) => (prev ? { ...prev, phase: "keypad", keypadPurpose: "setKey", digits: "", selected: 0 } : prev))
          });
          if (apt.keyCodeSet) {
            entries.push({
              key: "clearKey",
              label: t("house.action.clearKey"),
              run: () => submit("house:set-key", { apartmentId: apt.id, keyCode: null })
            });
          }
          if (apt.forSale) {
            entries.push({
              key: "cancelSale",
              label: t("house.action.cancelSale"),
              run: () => submit("house:set-sale", { apartmentId: apt.id, price: null })
            });
          } else {
            entries.push({
              key: "sell",
              label: t("house.action.sell"),
              run: () => setSession((prev) => (prev ? { ...prev, phase: "price", digits: "", selected: 0 } : prev))
            });
          }
        }
      }
      entries.push({
        key: "back",
        label: current.door.apartments.length > 1 ? t("house.action.back") : t("house.action.cancel"),
        run: () =>
          current.door!.apartments.length > 1
            ? setSession((prev) => (prev ? { ...prev, phase: "apartments", selected: 0 } : prev))
            : cancelRef.current()
      });
      return entries;
    }
    return [{ key: "cancel", label: t("house.action.cancel"), run: () => cancelRef.current() }];
  };

  const musicEntriesFor = (current: Session): Entry[] => {
    const house = getHouse(stateRef.current.mapId);
    const apartmentId = house?.apartmentId;
    return [
      {
        key: "__default",
        label: t("house.music.default"),
        run: () => submit("house:set-music", { apartmentId, bgm: null })
      },
      ...(current.bgms ?? []).map<Entry>((bgm) => ({
        key: bgm,
        label: `${house?.bgm === bgm ? "▶ " : ""}${bgm}`,
        run: () => submit("house:set-music", { apartmentId, bgm })
      })),
      { key: "back", label: t("house.action.back"), run: () => setSession((prev) => (prev ? { ...prev, phase: "house", selected: 0 } : prev)) }
    ];
  };

  const submitName = () => {
    const current = sessionRef.current;
    const house = getHouse(stateRef.current.mapId);
    if (!current || !house) return;
    const name = (current.nameDraft ?? "").trim();
    submit("house:set-name", { apartmentId: house.apartmentId, name: name || null });
  };
  const submitNameRef = useRef(submitName);
  submitNameRef.current = submitName;

  const confirmDigits = () => {
    const current = sessionRef.current;
    if (!current || !current.apartmentId) return;
    if (current.phase === "keypad") {
      if (current.digits.length < 4) return;
      if (current.keypadPurpose === "setKey") {
        submit("house:set-key", { apartmentId: current.apartmentId, keyCode: current.digits });
      } else {
        submit("house:enter", { apartmentId: current.apartmentId, keyCode: current.digits });
      }
      return;
    }
    if (current.phase === "price") {
      const price = Number(current.digits);
      if (!Number.isFinite(price) || price <= 0) return;
      submit("house:set-sale", { apartmentId: current.apartmentId, price });
    }
  };
  const confirmDigitsRef = useRef(confirmDigits);
  confirmDigitsRef.current = confirmDigits;

  const pushDigit = (digit: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const max = prev.phase === "keypad" ? 8 : 9;
      if (prev.digits.length >= max) return prev;
      return { ...prev, digits: prev.digits + digit };
    });
  };
  const popDigit = () => setSession((prev) => (prev ? { ...prev, digits: prev.digits.slice(0, -1) } : prev));
  const backFromDigits = () =>
    setSession((prev) => (prev ? { ...prev, phase: "apartment", digits: "", selected: 0 } : prev));

  const entries = session ? (session.phase === "music" ? musicEntriesFor(session) : entriesFor(session)) : [];
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // Keyboard navigation while a menu / keypad is open.
  useEffect(() => {
    if (!session || session.phase === "loading" || session.phase === "result") return undefined;
    const isDigits = session.phase === "keypad" || session.phase === "price";
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const swallow = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      if (key === "Escape") {
        swallow();
        if (isDigits) backFromDigits();
        else if (session.phase === "name" || session.phase === "music") {
          setSession((prev) => (prev ? { ...prev, phase: "house", selected: 0 } : prev));
        } else cancelRef.current();
        return;
      }
      if (session.kind === "placing") return;
      if (session.phase === "name") {
        if (key === "Enter") {
          swallow();
          submitNameRef.current();
        }
        return; // the input owns every other key
      }
      if (isDigits) {
        if (/^[0-9]$/.test(key)) {
          swallow();
          pushDigit(key);
        } else if (key === "Backspace") {
          swallow();
          popDigit();
        } else if (key === "Enter") {
          swallow();
          confirmDigitsRef.current();
        }
        return;
      }
      const count = entriesRef.current.length;
      if (key === "ArrowUp" || key === "w" || key === "W") {
        swallow();
        setSession((prev) => (prev ? { ...prev, selected: (prev.selected + count - 1) % count } : prev));
      } else if (key === "ArrowDown" || key === "s" || key === "S") {
        swallow();
        setSession((prev) => (prev ? { ...prev, selected: (prev.selected + 1) % count } : prev));
      } else if (key === "Enter" || key === " ") {
        swallow();
        const entry = entriesRef.current[sessionRef.current?.selected ?? 0];
        if (entry && !entry.disabled) entry.run();
      } else if (key.startsWith("Arrow")) {
        swallow();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [session]);

  if (!session || typeof document === "undefined") return null;

  const apt = session.door?.apartments.find((candidate) => candidate.id === session.apartmentId) ?? null;
  const house = getHouse(mapId);
  const header =
    session.kind === "placing"
      ? t("house.placing", { name: session.placeItemName ?? "" })
      : session.kind === "house"
        ? house?.name ?? t("house.doorTitle")
        : session.phase === "apartment" || session.phase === "keypad" || session.phase === "price"
          ? apt?.name ?? session.door?.name ?? t("house.doorTitle")
          : session.door?.name ?? t("house.doorTitle");
  const isDigits = session.phase === "keypad" || session.phase === "price";
  const menuOpen =
    session.phase === "apartments" || session.phase === "apartment" || session.phase === "house" || session.phase === "music";
  const isNaming = session.phase === "name";

  const overlay = (
    <Box position="fixed" inset={0} zIndex={4300} pointerEvents="none" data-game-ux="true" data-house-menu={session.phase}>
      {session.kind === "placing" && session.phase !== "result" ? (
        <Box position="fixed" left="50%" top="64px" style={{ transform: "translateX(-50%)" } as CSSProperties}>
          <Box
            bg="#1f1f1f"
            color="#ffef69"
            border="3px solid #5d5a7b"
            px={3}
            py={2}
            fontFamily="mono"
            fontWeight="800"
            fontSize="sm"
            textAlign="center"
            data-house-placing="1"
          >
            {header}
          </Box>
        </Box>
      ) : null}

      {menuOpen || isDigits || isNaming ? (
        <Box
          position="fixed"
          left={`${session.menuX}px`}
          top={`${session.menuY}px`}
          pointerEvents="auto"
          style={{ transform: "translate(-50%, calc(-100% - 12px))" } as CSSProperties}
          onClick={(event) => event.stopPropagation()}
        >
          <RetroPanel minWidth="220px" maxWidth="320px">
            <VStack align="stretch" spacing={2}>
              <HStack spacing={2} justify="center">
                <Text fontSize="18px" lineHeight="1">🏠</Text>
                <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#404040" textTransform="uppercase" noOfLines={2}>
                  {header}
                </Text>
              </HStack>
              {apt && session.phase === "apartment" ? (
                <Text fontFamily="mono" fontSize="xs" color="#4a6a4a" textAlign="center" whiteSpace="normal">
                  {apartmentStatus(apt)}
                </Text>
              ) : null}
              {session.kind === "house" && house ? (
                <Text fontFamily="mono" fontSize="xs" color="#4a6a4a" textAlign="center" whiteSpace="normal">
                  {house.isOwner
                    ? t("house.status.yours")
                    : t("house.status.owned", { name: house.ownerName ?? "—" })}
                </Text>
              ) : null}
              {isNaming ? (
                <>
                  <Text fontFamily="mono" fontSize="xs" color="#4a6a4a" textAlign="center" whiteSpace="normal">
                    {t("house.name.title")}
                  </Text>
                  <Input
                    autoFocus
                    size="sm"
                    maxLength={30}
                    fontFamily="mono"
                    bg="#101010"
                    color="#9cff8a"
                    borderColor="#5d5a7b"
                    value={session.nameDraft ?? ""}
                    placeholder={house?.name ?? ""}
                    data-house-name-input="1"
                    onChange={(event) => {
                      const nameDraft = event.target.value;
                      setSession((prev) => (prev ? { ...prev, nameDraft } : prev));
                    }}
                  />
                  <MenuChoiceButton active={false} onClick={submitName}>
                    {t("house.name.save")}
                  </MenuChoiceButton>
                  <MenuChoiceButton
                    active={false}
                    onClick={() => {
                      const current = getHouse(stateRef.current.mapId);
                      if (current) submit("house:set-name", { apartmentId: current.apartmentId, name: null });
                    }}
                  >
                    {t("house.name.reset")}
                  </MenuChoiceButton>
                  <MenuChoiceButton
                    active={false}
                    onClick={() => setSession((prev) => (prev ? { ...prev, phase: "house", selected: 0 } : prev))}
                  >
                    {t("house.action.back")}
                  </MenuChoiceButton>
                </>
              ) : isDigits ? (
                <>
                  <Text fontFamily="mono" fontSize="xs" color="#4a6a4a" textAlign="center" whiteSpace="normal">
                    {session.phase === "price"
                      ? t("house.price.title")
                      : session.keypadPurpose === "setKey"
                        ? t("house.keypad.set")
                        : t("house.keypad.enter")}
                  </Text>
                  <Box
                    bg="#101010"
                    color="#9cff8a"
                    fontFamily="mono"
                    fontSize="lg"
                    fontWeight="800"
                    textAlign="center"
                    px={2}
                    py={1}
                    minH="32px"
                    letterSpacing="0.2em"
                    data-house-keypad-value={session.digits}
                  >
                    {session.phase === "price"
                      ? session.digits
                        ? `$${session.digits}`
                        : "$"
                      : "•".repeat(session.digits.length) || " "}
                  </Box>
                  <SimpleGrid columns={3} spacing={1}>
                    {KEYPAD_KEYS.map((key) => (
                      <Button
                        key={key}
                        size="sm"
                        fontFamily="mono"
                        fontWeight="800"
                        colorScheme={key === "OK" ? "green" : key === "⌫" ? "red" : "gray"}
                        data-house-keypad-key={key}
                        onClick={() => {
                          if (key === "OK") confirmDigits();
                          else if (key === "⌫") popDigit();
                          else pushDigit(key);
                        }}
                      >
                        {key === "OK" ? t("house.keypad.ok") : key}
                      </Button>
                    ))}
                  </SimpleGrid>
                  <MenuChoiceButton active={false} onClick={backFromDigits}>
                    {t("house.action.back")}
                  </MenuChoiceButton>
                </>
              ) : (
                <Box
                  maxH={session.phase === "music" ? "260px" : undefined}
                  overflowY={session.phase === "music" ? "auto" : undefined}
                  data-house-music-list={session.phase === "music" ? "1" : undefined}
                >
                  {session.phase === "music" ? (
                    <Text fontFamily="mono" fontSize="xs" color="#4a6a4a" textAlign="center" whiteSpace="normal" mb={1}>
                      {t("house.music.title")}
                    </Text>
                  ) : null}
                  <VStack align="stretch" spacing={2}>
                    {entries.map((entry, index) => (
                      <MenuChoiceButton
                        key={entry.key}
                        active={session.selected === index}
                        isDisabled={entry.disabled}
                        onClick={() => !entry.disabled && entry.run()}
                        onMouseEnter={() => setSession((prev) => (prev ? { ...prev, selected: index } : prev))}
                      >
                        {entry.label}
                      </MenuChoiceButton>
                    ))}
                  </VStack>
                </Box>
              )}
            </VStack>
          </RetroPanel>
        </Box>
      ) : null}

      {session.phase === "result" && session.message ? (
        <Box
          position="fixed"
          left={`${session.menuX}px`}
          top={`${session.menuY - 8}px`}
          style={{ transform: "translate(-50%, -100%)" } as CSSProperties}
          pointerEvents="none"
        >
          <Box
            bg="#1f1f1f"
            color={session.ok ? "#9cff8a" : "#ffef69"}
            border="3px solid #5d5a7b"
            px={3}
            py={2}
            fontFamily="mono"
            fontWeight="800"
            fontSize="sm"
            textAlign="center"
            whiteSpace="normal"
            maxW="300px"
            data-house-result={session.ok ? "ok" : "error"}
          >
            {session.message}
          </Box>
        </Box>
      ) : null}
    </Box>
  );

  return createPortal(overlay, document.body);
};

export default HouseInteractionController;
