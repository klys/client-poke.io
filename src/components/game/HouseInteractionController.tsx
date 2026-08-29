/**
 * Housing UX — the single client entry point for apartments and houses
 * (server: components/Housing.ts). Every input method funnels into one
 * centered window; every choice is validated server-side and answered with
 * `house:result`.
 *
 *  DOOR   step onto / click / tap / right-click / face an apartment door cell
 *         (an editor `houseDoors` placement) → apartments window
 *         (house:door-info) → Enter · Buy · Set key code · Put up for sale · …
 *         A locked apartment asks for its code on a keypad before entering.
 *  HOUSE  inside an instance: right-click the floor, or click / face a
 *         piece of furniture → Pick up · Rename · Music (owner) · Leave.
 *  PLACE  the bag's "Place" on a furniture item (HOUSE_PLACE_EVENT) arms a
 *         placement: the next click on a floor tile places it there.
 *
 * The door window opens on its own when the player walks onto the door cell
 * (a "portal" feel) and does not re-open until the player steps off and back
 * on; landing on the door after leaving the house never re-opens it.
 */
import { CSSProperties, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, Button, Flex, Input, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import type { Socket } from "socket.io-client";
import { AppContext } from "../../context/appContext";
import { useCompactUx } from "../ux/useCompactUx";
import { UX_LAYER } from "../ux/layers";
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

interface Notice {
  ok: boolean;
  message: string;
}

interface Session {
  kind: "door" | "house" | "placing";
  phase: Phase;
  /** Where a failed request returns to (the phase that issued it). */
  returnPhase?: Phase;
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
  /** Inline feedback shown inside the window (errors keep the window open). */
  notice?: Notice;
  /** Result phase: the closing message. */
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

type Entry = {
  key: string;
  label: ReactNode;
  disabled?: boolean;
  /** Secondary entries (back/cancel) render muted at the end of the list. */
  secondary?: boolean;
  run: () => void;
};

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
    document.body.dataset.berryMenuActive === "1" ||
    document.body.dataset.petMenuActive === "1");

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

/** Money params arrive as plain numbers; the UI shows them with the $ sign. */
const money = (value: number | string) => `$${Number(value).toLocaleString("es-VE")}`;
const formatParams = (params?: Record<string, string>) =>
  params && typeof params.price === "string" ? { ...params, price: money(params.price) } : params;

const PANEL_BORDER = "#5d5a7b";
const INK = "#404040";
const MUTED = "#4a6a4a";

/** A wrapping, full-width choice row — labels never overflow the window. */
function WindowButton({
  active,
  disabled,
  secondary,
  onClick,
  onMouseEnter,
  children,
  testId
}: {
  active?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  children: ReactNode;
  testId?: string;
}) {
  const compact = useCompactUx();
  return (
    <Button
      variant="unstyled"
      width="100%"
      height="auto"
      minH={compact ? "40px" : "44px"}
      px={3}
      py={2}
      display="flex"
      justifyContent="flex-start"
      textAlign="left"
      whiteSpace="normal"
      border="3px solid"
      borderColor={active ? "#ff7b73" : secondary ? "#b9b8cc" : "#8a89a8"}
      bg={active ? "#fff3cf" : secondary ? "#f1efe6" : "#ffffff"}
      color={secondary ? "#6b6b7b" : INK}
      fontFamily="mono"
      fontSize={compact ? "sm" : "md"}
      fontWeight="800"
      lineHeight="1.2"
      opacity={disabled ? 0.45 : 1}
      cursor={disabled ? "not-allowed" : "pointer"}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      data-house-entry={testId}
      data-house-entry-active={active ? "1" : undefined}
    >
      {children}
    </Button>
  );
}

function Chip({ tone, children }: { tone: "free" | "yours" | "owned" | "forSale" | "unavailable"; children: ReactNode }) {
  const palette: Record<typeof tone, { bg: string; color: string }> = {
    free: { bg: "#2f9e44", color: "#ffffff" },
    yours: { bg: "#f59f00", color: "#1f1f1f" },
    owned: { bg: "#868e96", color: "#ffffff" },
    forSale: { bg: "#1c7ed6", color: "#ffffff" },
    unavailable: { bg: "#c92a2a", color: "#ffffff" }
  };
  return (
    <Box
      flexShrink={0}
      px={2}
      py="2px"
      borderRadius="4px"
      fontFamily="mono"
      fontSize="10px"
      fontWeight="800"
      textTransform="uppercase"
      letterSpacing="0.04em"
      bg={palette[tone].bg}
      color={palette[tone].color}
      data-house-chip={tone}
    >
      {children}
    </Box>
  );
}

const Hint = ({ children }: { children: ReactNode }) => (
  <Text fontFamily="mono" fontSize="xs" color={MUTED} textAlign="center" whiteSpace="normal" fontWeight="600">
    {children}
  </Text>
);

const HouseInteractionController = ({ socket, player, mapId, cellSize, editorData }: Props) => {
  const t = useT();
  const compact = useCompactUx();
  const { waiting, activeNpcInteraction } = useContext(AppContext);
  const [session, setSession] = useState<Session | null>(null);

  const stateRef = useRef({ player, mapId, cellSize, editorData, waiting, activeNpcInteraction });
  stateRef.current = { player, mapId, cellSize, editorData, waiting, activeNpcInteraction };
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;
  const timersRef = useRef<number[]>([]);
  const submitLockRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  // Freeze walk/interact input while a window is up (placement keeps walking).
  useEffect(() => {
    const menuOpen = session !== null && session.kind !== "placing";
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

  const openDoor = (doorId: string) => {
    clearTimers();
    submitLockRef.current = false;
    setSession({ kind: "door", phase: "loading", selected: 0, doorId, digits: "" });
    socket.emit("house:door-info", { doorId });
    const timeoutId = window.setTimeout(() => {
      setSession((prev) => (prev && prev.phase === "loading" && prev.kind === "door" && !prev.door ? null : prev));
    }, INFO_TIMEOUT_MS);
    timersRef.current.push(timeoutId);
  };

  const openHouseMenu = (furnitureId: string | null) => {
    clearTimers();
    submitLockRef.current = false;
    setSession({ kind: "house", phase: "house", selected: 0, furnitureId, digits: "" });
  };

  const startPlacing = (itemId: string, itemName: string) => {
    clearTimers();
    submitLockRef.current = false;
    setSession({ kind: "placing", phase: "placing", selected: 0, placeItemId: itemId, placeItemName: itemName, digits: "" });
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

  const canOpen = () => {
    const snap = stateRef.current;
    return Boolean(snap.mapId && snap.player) && !snap.waiting && !snap.activeNpcInteraction && !otherMenuActive();
  };

  // ── Step-on trigger ───────────────────────────────────────────────────
  // Walking onto a door cell opens the window like a portal would. Only the
  // transition onto the cell counts: dismissing the window while standing on
  // the door, or landing on it after leaving the house, must not re-open it.
  const size = cellSize || 32;
  const cellX = player && typeof player.x === "number" ? Math.round(player.x / size) : null;
  const cellY = player && typeof player.y === "number" ? Math.round(player.y / size) : null;
  const lastCellRef = useRef<string | null>(null);
  useEffect(() => {
    lastCellRef.current = null;
  }, [mapId]);
  useEffect(() => {
    if (cellX === null || cellY === null || !mapId) return;
    const key = `${mapId}:${cellX},${cellY}`;
    if (lastCellRef.current === key) return;
    const previous = lastCellRef.current;
    lastCellRef.current = key;
    // First fix on a map = spawn / teleport landing, never a step.
    if (previous === null) return;
    if (sessionRef.current || !canOpen()) return;
    const door = getHouseDoorAt(stateRef.current.editorData, cellX, cellY);
    if (!door) return;
    socket.emit("stopMove");
    openDoorRef.current(door.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellX, cellY, mapId, socket]);

  // ── Result plumbing ───────────────────────────────────────────────────

  /** Closing message: shown inside the window (or as a toast), then closes. */
  const showResult = (ok: boolean, message: string) => {
    clearTimers();
    submitLockRef.current = false;
    setSession((prev) => (prev ? { ...prev, phase: "result", ok, message, notice: undefined } : prev));
    const id = window.setTimeout(() => setSession(null), RESULT_LINGER_MS);
    timersRef.current.push(id);
  };

  /** Failure: back to the phase that asked, with the reason inline. */
  const showFailure = (message: string) => {
    clearTimers();
    submitLockRef.current = false;
    setSession((prev) => {
      if (!prev) return prev;
      const phase = prev.returnPhase ?? (prev.kind === "door" ? (prev.door ? "apartment" : "apartments") : prev.kind === "house" ? "house" : "placing");
      return {
        ...prev,
        phase,
        digits: phase === "keypad" ? "" : prev.digits,
        notice: { ok: false, message }
      };
    });
    if (sessionRef.current?.kind === "placing") {
      const id = window.setTimeout(() => setSession((prev) => (prev ? { ...prev, notice: undefined } : prev)), RESULT_LINGER_MS);
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
        // The window has its own backdrop; anything that reaches here is
        // outside it, so just swallow the click (never walk under a window).
        event.stopImmediatePropagation();
        event.preventDefault();
        if (current.phase === "result") cancelRef.current();
        return;
      }
      if (!overMap || !map || !snap.player || !snap.mapId) return;
      if (snap.waiting || snap.activeNpcInteraction || otherMenuActive()) return;

      const rect = map.getBoundingClientRect();
      const cell = snap.cellSize || 32;
      const clickX = Math.floor((event.clientX - rect.left) / cell);
      const clickY = Math.floor((event.clientY - rect.top) / cell);

      if (current?.kind === "placing" && current.phase === "result") {
        // The "placed" toast is still up: this click is not another placement,
        // dismiss the toast and handle it like any other click (e.g. on the
        // piece just placed).
        cancelRef.current();
      } else if (current?.kind === "placing") {
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
        socket.emit("house:furniture-place", { itemId: current.placeItemId, x: clickX, y: clickY });
        setSession((prev) => (prev ? { ...prev, phase: "loading", returnPhase: "placing", notice: undefined } : prev));
        return;
      }

      const door = getHouseDoorAt(snap.editorData, clickX, clickY);
      if (door && isNearRef.current(door)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        openDoorRef.current(door.id);
        return;
      }

      const house = getHouse(snap.mapId);
      if (!house) return;
      const furniture = getHouseFurnitureAt(snap.mapId, clickX, clickY, cell);
      if (furniture) {
        event.stopImmediatePropagation();
        event.preventDefault();
        openHouseMenuRef.current(furniture.id);
        return;
      }
      if (event.type === "contextmenu") {
        event.stopImmediatePropagation();
        event.preventDefault();
        openHouseMenuRef.current(null);
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
      if (sessionRef.current || !canOpen()) return;
      const doorId = (event as CustomEvent<{ doorId?: string }>).detail?.doorId;
      const door = (snap.editorData?.houseDoors ?? []).find((candidate) => candidate.id === doorId);
      if (!door) return;
      openDoorRef.current(door.id);
    };
    const onHouseMenu = (event: Event) => {
      const snap = stateRef.current;
      if (sessionRef.current || !snap.mapId || !getHouse(snap.mapId) || !canOpen()) return;
      const furnitureId = (event as CustomEvent<{ furnitureId?: string }>).detail?.furnitureId ?? null;
      openHouseMenuRef.current(furnitureId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          selected: 0,
          notice: undefined
        };
      });
    };
    const onResult = (data: { action: string; ok: boolean; messageKey: string; params?: Record<string, string> }) => {
      const message = t(data.messageKey, formatParams(data.params));
      const current = sessionRef.current;
      if (!current) return;
      if (data.ok && (data.action === "enter" || data.action === "leave")) {
        cancelRef.current();
        return;
      }
      if (data.action === "door-info" || data.ok) {
        showResult(data.ok, message);
        return;
      }
      showFailure(message);
    };
    const onMusicList = (data: { bgms?: string[] }) => {
      const bgms = Array.isArray(data?.bgms) ? data.bgms.filter((name): name is string => typeof name === "string") : [];
      setSession((prev) => {
        if (!prev || prev.kind !== "house" || prev.phase !== "loading") return prev;
        clearTimers();
        const current = getHouse(stateRef.current.mapId)?.bgm ?? null;
        const index = current ? bgms.indexOf(current) + 1 : 0;
        return { ...prev, phase: "music", bgms, selected: Math.max(0, index), notice: undefined };
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

  const apartmentChip = (apt: HouseApartmentSummary) => {
    if (!apt.available) return <Chip tone="unavailable">{t("house.chip.unavailable")}</Chip>;
    if (apt.isOwner) return <Chip tone="yours">{t("house.chip.yours")}</Chip>;
    if (apt.forSale) return <Chip tone="forSale">{t("house.chip.forSale")}</Chip>;
    if (apt.owned) return <Chip tone="owned">{t("house.chip.owned")}</Chip>;
    return <Chip tone="free">{t("house.chip.free")}</Chip>;
  };

  const submit = (event: string, payload: Record<string, unknown>) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    socket.emit(event, payload);
    setSession((prev) => (prev ? { ...prev, phase: "loading", returnPhase: prev.phase, notice: undefined } : prev));
  };

  const goTo = (phase: Phase, patch: Partial<Session> = {}) =>
    setSession((prev) => (prev ? { ...prev, phase, selected: 0, notice: undefined, ...patch } : prev));

  const cancelEntry = (): Entry => ({ key: "cancel", label: t("house.action.cancel"), secondary: true, run: () => cancelRef.current() });

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
          run: () => goTo("name", { nameDraft: house.customName ? house.name : "" })
        });
        entries.push({
          key: "music",
          label: t("house.action.music"),
          run: () => {
            setSession((prev) => (prev ? { ...prev, phase: "loading", returnPhase: "house", notice: undefined } : prev));
            socket.emit("house:music-list");
            const timeoutId = window.setTimeout(() => {
              setSession((prev) => (prev && prev.phase === "loading" && prev.kind === "house" ? { ...prev, phase: "house" } : prev));
            }, INFO_TIMEOUT_MS);
            timersRef.current.push(timeoutId);
          }
        });
      }
      entries.push({ key: "leave", label: t("house.action.leave"), run: () => submit("house:leave", {}) });
      entries.push(cancelEntry());
      return entries;
    }
    if (current.kind === "door" && current.door) {
      if (current.phase === "apartments") {
        return [
          ...current.door.apartments.map<Entry>((apt) => ({
            key: apt.id,
            label: (
              <Flex w="100%" align="center" gap={2}>
                <Box flex="1" minW={0}>
                  <Text textTransform="uppercase" whiteSpace="normal">
                    {apt.name}
                  </Text>
                  <Text fontSize="xs" color={MUTED} fontWeight="600" whiteSpace="normal" mt="2px">
                    {apartmentStatus(apt)}
                  </Text>
                </Box>
                {apartmentChip(apt)}
              </Flex>
            ),
            disabled: !apt.available,
            run: () => goTo("apartment", { apartmentId: apt.id })
          })),
          cancelEntry()
        ];
      }
      const apt = current.door.apartments.find((candidate) => candidate.id === current.apartmentId);
      if (!apt) return [cancelEntry()];
      const entries: Entry[] = [];
      if (apt.available) {
        entries.push({
          key: "enter",
          label: `🚪 ${t("house.action.enter")}`,
          run: () =>
            apt.locked ? goTo("keypad", { keypadPurpose: "enter", digits: "" }) : submit("house:enter", { apartmentId: apt.id })
        });
        if (!apt.owned || (apt.forSale && !apt.isOwner)) {
          entries.push({
            key: "buy",
            label: `💰 ${t("house.action.buy", { price: money(apt.price) })}`,
            run: () => submit("house:buy", { apartmentId: apt.id })
          });
        }
        if (apt.isOwner) {
          entries.push({
            key: "setKey",
            label: `🔑 ${t("house.action.setKey")}`,
            run: () => goTo("keypad", { keypadPurpose: "setKey", digits: "" })
          });
          if (apt.keyCodeSet) {
            entries.push({
              key: "clearKey",
              label: `🔓 ${t("house.action.clearKey")}`,
              run: () => submit("house:set-key", { apartmentId: apt.id, keyCode: null })
            });
          }
          if (apt.forSale) {
            entries.push({
              key: "cancelSale",
              label: `🏷️ ${t("house.action.cancelSale")}`,
              run: () => submit("house:set-sale", { apartmentId: apt.id, price: null })
            });
          } else {
            entries.push({
              key: "sell",
              label: `🏷️ ${t("house.action.sell")}`,
              run: () => goTo("price", { digits: "" })
            });
          }
        }
      }
      const multiple = current.door.apartments.length > 1;
      entries.push({
        key: "back",
        label: multiple ? t("house.action.back") : t("house.action.cancel"),
        secondary: true,
        run: () => (multiple ? goTo("apartments") : cancelRef.current())
      });
      return entries;
    }
    return [cancelEntry()];
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
        label: `${house?.bgm === bgm ? "▶ " : "♪ "}${bgm}`,
        run: () => submit("house:set-music", { apartmentId, bgm })
      })),
      { key: "back", label: t("house.action.back"), secondary: true, run: () => goTo("house") }
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
      return { ...prev, digits: prev.digits + digit, notice: undefined };
    });
  };
  const popDigit = () => setSession((prev) => (prev ? { ...prev, digits: prev.digits.slice(0, -1) } : prev));
  const backFromDigits = () => goTo("apartment", { digits: "" });

  const entries = session ? (session.phase === "music" ? musicEntriesFor(session) : entriesFor(session)) : [];
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // Keep the keyboard-selected row visible in long lists (music).
  useEffect(() => {
    const active = bodyRef.current?.querySelector<HTMLElement>('[data-house-entry-active="1"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [session?.selected, session?.phase]);

  // Keyboard navigation while a window / keypad is open.
  useEffect(() => {
    if (!session || session.phase === "loading") return undefined;
    const isDigits = session.phase === "keypad" || session.phase === "price";
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const swallow = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      if (session.phase === "result") {
        if (key === "Escape" || key === "Enter" || key === " ") {
          swallow();
          cancelRef.current();
        }
        return;
      }
      if (key === "Escape") {
        swallow();
        if (isDigits) backFromDigits();
        else if (session.phase === "name" || session.phase === "music") goTo("house");
        else {
          const back = entriesRef.current.find((entry) => entry.key === "back");
          if (back) back.run();
          else cancelRef.current();
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const windowOpen = session.kind !== "placing";
  const subtitle =
    session.phase === "apartments"
      ? t("house.window.pickApartment")
      : session.phase === "apartment" && apt
        ? apartmentStatus(apt)
        : session.kind === "house" && house && session.phase === "house"
          ? house.isOwner
            ? t("house.status.yours")
            : t("house.status.owned", { name: house.ownerName ?? "—" })
          : session.phase === "name"
            ? t("house.name.title")
            : session.phase === "music"
              ? t("house.music.title")
              : session.phase === "price"
                ? t("house.price.title")
                : session.phase === "keypad"
                  ? session.keypadPurpose === "setKey"
                    ? t("house.keypad.set")
                    : t("house.keypad.enter")
                  : null;

  const noticeBox = session.notice ? (
    <Box
      bg={session.notice.ok ? "#e6f7e3" : "#ffe3e0"}
      border="2px solid"
      borderColor={session.notice.ok ? "#2f9e44" : "#c92a2a"}
      color={session.notice.ok ? "#1b5e20" : "#8a1c1c"}
      px={2}
      py={1}
      fontFamily="mono"
      fontSize="xs"
      fontWeight="800"
      textAlign="center"
      whiteSpace="normal"
      data-house-notice={session.notice.ok ? "ok" : "error"}
    >
      {session.notice.message}
    </Box>
  ) : null;

  const renderBody = () => {
    if (session.phase === "loading") {
      return <Hint>{t("house.window.loading")}</Hint>;
    }
    if (session.phase === "result") {
      return (
        <Box
          bg="#1f1f1f"
          color={session.ok ? "#9cff8a" : "#ffef69"}
          border={`3px solid ${PANEL_BORDER}`}
          px={3}
          py={3}
          fontFamily="mono"
          fontWeight="800"
          fontSize="sm"
          textAlign="center"
          whiteSpace="normal"
          data-house-result={session.ok ? "ok" : "error"}
        >
          {session.message}
        </Box>
      );
    }
    if (session.phase === "name") {
      return (
        <VStack align="stretch" spacing={2}>
          {noticeBox}
          <Input
            autoFocus
            size="md"
            maxLength={30}
            fontFamily="mono"
            fontWeight="700"
            bg="#101010"
            color="#9cff8a"
            borderColor={PANEL_BORDER}
            borderWidth="3px"
            borderRadius="0"
            _focus={{ borderColor: "#ff7b73", boxShadow: "none" }}
            value={session.nameDraft ?? ""}
            placeholder={house?.name ?? ""}
            data-house-name-input="1"
            onChange={(event) => {
              const nameDraft = event.target.value;
              setSession((prev) => (prev ? { ...prev, nameDraft, notice: undefined } : prev));
            }}
          />
          <WindowButton onClick={submitName} testId="saveName">
            💾 {t("house.name.save")}
          </WindowButton>
          <WindowButton
            testId="resetName"
            onClick={() => {
              const current = getHouse(stateRef.current.mapId);
              if (current) submit("house:set-name", { apartmentId: current.apartmentId, name: null });
            }}
          >
            {t("house.name.reset")}
          </WindowButton>
          <WindowButton secondary onClick={() => goTo("house")} testId="back">
            {t("house.action.back")}
          </WindowButton>
        </VStack>
      );
    }
    if (isDigits) {
      return (
        <VStack align="stretch" spacing={2}>
          {noticeBox}
          <Box
            bg="#101010"
            color="#9cff8a"
            fontFamily="mono"
            fontSize="2xl"
            fontWeight="800"
            textAlign="center"
            px={2}
            py={2}
            minH="48px"
            letterSpacing="0.25em"
            border={`3px solid ${PANEL_BORDER}`}
            data-house-keypad-value={session.digits}
          >
            {session.phase === "price" ? (session.digits ? `$${session.digits}` : "$") : "•".repeat(session.digits.length) || " "}
          </Box>
          <SimpleGrid columns={3} spacing={2}>
            {KEYPAD_KEYS.map((key) => (
              <Button
                key={key}
                variant="unstyled"
                height={compact ? "44px" : "52px"}
                fontFamily="mono"
                fontWeight="800"
                fontSize={key === "OK" ? "md" : "xl"}
                border="3px solid"
                borderColor={key === "OK" ? "#2f9e44" : key === "⌫" ? "#c92a2a" : "#8a89a8"}
                bg={key === "OK" ? "#e6f7e3" : key === "⌫" ? "#ffe3e0" : "#ffffff"}
                color={INK}
                _active={{ bg: "#fff3cf" }}
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
          <WindowButton secondary onClick={backFromDigits} testId="back">
            {t("house.action.back")}
          </WindowButton>
        </VStack>
      );
    }
    return (
      <VStack align="stretch" spacing={2}>
        {noticeBox}
        {entries.map((entry, index) => (
          <WindowButton
            key={entry.key}
            active={session.selected === index}
            disabled={entry.disabled}
            secondary={entry.secondary}
            onClick={() => !entry.disabled && entry.run()}
            onMouseEnter={() => setSession((prev) => (prev ? { ...prev, selected: index } : prev))}
            testId={entry.key}
          >
            {entry.label}
          </WindowButton>
        ))}
      </VStack>
    );
  };

  // Two roots on purpose: the placement banner lives with the other action
  // menus (NPC_DIALOG_TOP), while the window is a real window and sits at
  // SYSTEM_UX — above the touch pad, which would otherwise cover its rows.
  const overlay = (
    <Box position="fixed" inset={0} zIndex={windowOpen ? UX_LAYER.SYSTEM_UX : UX_LAYER.NPC_DIALOG_TOP} pointerEvents="none" data-game-ux="true" data-house-menu={session.phase}>
      {session.kind === "placing" ? (
        <Box position="fixed" left="50%" top="64px" style={{ transform: "translateX(-50%)" } as CSSProperties} maxW="92vw">
          <VStack spacing={1} align="stretch">
            <Box
              bg="#1f1f1f"
              color="#ffef69"
              border={`3px solid ${PANEL_BORDER}`}
              px={3}
              py={2}
              fontFamily="mono"
              fontWeight="800"
              fontSize="sm"
              textAlign="center"
              whiteSpace="normal"
              data-house-placing="1"
            >
              {session.phase === "result" ? session.message : header}
            </Box>
            {session.notice ? (
              <Box
                bg="#1f1f1f"
                color="#ff9c93"
                border={`3px solid ${PANEL_BORDER}`}
                px={3}
                py={1}
                fontFamily="mono"
                fontWeight="800"
                fontSize="xs"
                textAlign="center"
                whiteSpace="normal"
                data-house-notice="error"
              >
                {session.notice.message}
              </Box>
            ) : null}
          </VStack>
        </Box>
      ) : null}

      {windowOpen ? (
        <Box
          position="fixed"
          inset={0}
          bg="rgba(0, 0, 0, 0.45)"
          pointerEvents="auto"
          display="flex"
          alignItems="center"
          justifyContent="center"
          px={3}
          py={4}
          onClick={cancel}
          onContextMenu={(event) => {
            event.preventDefault();
            cancel();
          }}
          data-house-window={session.kind}
        >
          <Box
            role="dialog"
            aria-label={header}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            w="100%"
            maxW={compact ? "380px" : "460px"}
            maxH="min(84vh, 680px)"
            display="flex"
            flexDirection="column"
            bg="#f7f4eb"
            border={`4px solid ${PANEL_BORDER}`}
            boxShadow="0 8px 0 rgba(122, 215, 255, 0.75)"
            px={compact ? 3 : 4}
            py={compact ? 3 : 4}
          >
            <Flex align="center" gap={2} pb={2} mb={2} borderBottom={`3px solid ${PANEL_BORDER}`}>
              <Text fontSize="22px" lineHeight="1">
                🏠
              </Text>
              <Text
                flex="1"
                minW={0}
                fontFamily="mono"
                fontWeight="800"
                fontSize={compact ? "sm" : "md"}
                color={INK}
                textTransform="uppercase"
                whiteSpace="normal"
                noOfLines={2}
                data-house-title="1"
              >
                {header}
              </Text>
              <Button
                variant="unstyled"
                minW="32px"
                h="32px"
                border="3px solid #8a89a8"
                bg="#ffffff"
                color={INK}
                fontFamily="mono"
                fontWeight="800"
                lineHeight="1"
                onClick={cancel}
                aria-label={t("house.action.close")}
                data-house-close="1"
              >
                ✕
              </Button>
            </Flex>
            {subtitle ? (
              <Box mb={2}>
                <Hint>{subtitle}</Hint>
              </Box>
            ) : null}
            <Box ref={bodyRef} flex="1" minH={0} overflowY="auto" pr="2px" data-house-body={session.phase}>
              {renderBody()}
            </Box>
            {!compact && session.phase !== "result" && session.phase !== "loading" ? (
              <Box mt={2} pt={2} borderTop="2px dashed #b9b8cc">
                <Text fontFamily="mono" fontSize="10px" color="#8a89a8" textAlign="center" fontWeight="700">
                  {t("house.window.hint")}
                </Text>
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}
    </Box>
  );

  return createPortal(overlay, document.body);
};

export default HouseInteractionController;
