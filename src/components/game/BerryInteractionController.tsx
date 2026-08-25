/**
 * Berry plot UX — the single client entry point for the global berry plots.
 *
 * Every input method funnels into one contextual menu anchored on the plot:
 *  - mouse click / tap / right-click on an adjacent plot tile (capture-phase,
 *    steals the click from click-to-move)
 *  - action button / gamepad / virtual pad facing a plot (Map.tsx dispatches
 *    "pokecraft:berry-menu" from the shared interact-front path)
 *
 * Plot with a plant:   Collect (once ripe) · Clear the soil · Do nothing
 * Empty soil:          Plant a berry (→ pick one from the bag) · Do nothing
 *
 * The menu opens with the server's answer to `berry:actions` (what is legal
 * right now plus the plantable berries in the bag); every choice is
 * re-validated server-side. Outcomes arrive as `berry:result` i18n keys and
 * the plot itself updates for everybody through `berry:update`.
 */
import { CSSProperties, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { Socket } from "socket.io-client";
import { AppContext } from "../../context/appContext";
import { MenuChoiceButton, RetroPanel } from "../ux/game/NpcInteractions";
import { useT } from "../../i18n";
import {
  BERRY_MENU_EVENT,
  BERRY_RIPE_STAGE,
  berryMsUntilRipe,
  berryServerNow,
  berryStage,
  formatBerryCountdown,
  getBerryPlot,
  getBerryPlotAt,
  type BerryPlot
} from "./berryPlots";

const ACTIONS_TIMEOUT_MS = 2500;
const RESULT_LINGER_MS = 2200;

type Phase = "loading" | "menu" | "berries" | "result";

interface BerryOption {
  itemId: string;
  berryId: string;
  name: string;
  quantity: number;
  hoursPerStage: number;
}

interface BerryActions {
  plot: BerryPlot | null;
  berries: BerryOption[];
  canPlant: boolean;
  canHarvest: boolean;
  canClear: boolean;
  reasonKey?: string;
}

interface BerrySession {
  plotId: string;
  cellX: number;
  cellY: number;
  menuX: number;
  menuY: number;
  phase: Phase;
  actions?: BerryActions;
  selected: number;
  message?: string;
  ok?: boolean;
}

interface BerryInteractionControllerProps {
  socket: Socket;
  player: { x?: number; y?: number; angle?: number } | null;
  mapId: string | null;
  cellSize: number;
}

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

const isEventDialogActive = () =>
  typeof document !== "undefined" &&
  (document.body.dataset.eventActive === "1" || document.body.dataset.waterMenuActive === "1");

type MenuEntry = { key: "collect" | "clear" | "plant" | "cancel"; disabled: boolean; reasonKey?: string };

function menuEntriesFor(actions: BerryActions | undefined): MenuEntry[] {
  if (!actions) return [{ key: "cancel", disabled: false }];
  if (actions.plot?.berryId) {
    return [
      { key: "collect", disabled: !actions.canHarvest, reasonKey: actions.canHarvest ? undefined : "berry.reason.notRipe" },
      { key: "clear", disabled: !actions.canClear },
      { key: "cancel", disabled: false }
    ];
  }
  return [
    { key: "plant", disabled: !actions.canPlant, reasonKey: actions.canPlant ? undefined : actions.reasonKey ?? "berry.reason.noBerries" },
    { key: "cancel", disabled: false }
  ];
}

const BerryInteractionController = ({ socket, player, mapId, cellSize }: BerryInteractionControllerProps) => {
  const t = useT();
  const { waiting, activeNpcInteraction } = useContext(AppContext);
  const [session, setSession] = useState<BerrySession | null>(null);
  const [, setClockTick] = useState(0);

  const stateRef = useRef({ player, mapId, cellSize, hasSession: false, waiting, activeNpcInteraction });
  stateRef.current = { player, mapId, cellSize, hasSession: session !== null, waiting, activeNpcInteraction };
  const sessionRef = useRef<BerrySession | null>(session);
  sessionRef.current = session;
  const timersRef = useRef<number[]>([]);
  // Synchronous guard against a double-submit: two keydowns can land in the
  // same frame (before React re-renders), so a state-based check is not
  // enough — an emitted action flips this immediately and it clears when the
  // result arrives or the menu closes.
  const submitLockRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  // Freeze walk/interact input while the menu is up (UserControl checks this).
  useEffect(() => {
    const menuOpen = session !== null && session.phase !== "result";
    if (menuOpen) {
      document.body.dataset.berryMenuActive = "1";
    } else {
      delete document.body.dataset.berryMenuActive;
    }
    return () => {
      delete document.body.dataset.berryMenuActive;
    };
  }, [session]);

  // Live countdown in the menu hint while it's open.
  useEffect(() => {
    if (!session || session.phase !== "menu") return undefined;
    const id = window.setInterval(() => setClockTick((value) => (value + 1) % 1000), 1000);
    return () => window.clearInterval(id);
  }, [session]);

  const openMenuFor = (plot: BerryPlot, anchorX?: number, anchorY?: number) => {
    const snap = stateRef.current;
    const map = document.getElementById("map");
    if (!map) return;
    const rect = map.getBoundingClientRect();
    const size = snap.cellSize || 32;
    const centerX = rect.left + plot.x * size + size / 2;
    const topY = rect.top + plot.y * size;
    clearTimers();
    submitLockRef.current = false;
    setSession({
      plotId: plot.id,
      cellX: plot.x,
      cellY: plot.y,
      menuX: anchorX ?? centerX,
      menuY: anchorY ?? topY,
      phase: "loading",
      selected: 0
    });
    socket.emit("berry:actions", { plotId: plot.id });
    const timeoutId = window.setTimeout(() => {
      setSession((prev) => (prev && prev.phase === "loading" ? null : prev));
    }, ACTIONS_TIMEOUT_MS);
    timersRef.current.push(timeoutId);
  };
  const openMenuForRef = useRef(openMenuFor);
  openMenuForRef.current = openMenuFor;

  const isAdjacent = (plot: BerryPlot) => {
    const snap = stateRef.current;
    if (!snap.player) return false;
    const size = snap.cellSize || 32;
    const playerCellX = Math.round((snap.player.x ?? 0) / size);
    const playerCellY = Math.round((snap.player.y ?? 0) / size);
    return Math.abs(plot.x - playerCellX) + Math.abs(plot.y - playerCellY) === 1;
  };

  // Pointer entry point: click / tap / right-click on an adjacent plot tile.
  useEffect(() => {
    const tryOpenFromPointer = (event: MouseEvent) => {
      const snap = stateRef.current;
      if (snap.hasSession || !snap.player || !snap.mapId) return false;
      if (snap.waiting || snap.activeNpcInteraction || isEventDialogActive()) return false;
      if (isUxTarget(event.target)) return false;

      const map = document.getElementById("map");
      const target = event.target as Node | null;
      if (!map || !target || !map.contains(target)) return false;

      const rect = map.getBoundingClientRect();
      const size = snap.cellSize || 32;
      const cellX = Math.floor((event.clientX - rect.left) / size);
      const cellY = Math.floor((event.clientY - rect.top) / size);
      const plot = getBerryPlotAt(snap.mapId, cellX, cellY);
      if (!plot || !isAdjacent(plot)) return false;

      event.stopImmediatePropagation();
      event.preventDefault();
      openMenuForRef.current(plot, event.clientX, event.clientY);
      return true;
    };

    const onClick = (event: MouseEvent) => {
      tryOpenFromPointer(event);
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("contextmenu", onClick, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("contextmenu", onClick, true);
    };
  }, []);

  // Keyboard/gamepad entry point (Map.tsx interact-front while facing a plot).
  useEffect(() => {
    const onBerryMenu = (event: Event) => {
      const snap = stateRef.current;
      if (snap.hasSession || !snap.mapId) return;
      if (snap.waiting || snap.activeNpcInteraction || isEventDialogActive()) return;
      const detail = (event as CustomEvent<{ plotId?: string }>).detail;
      if (!detail?.plotId) return;
      const plot = getBerryPlot(snap.mapId, detail.plotId);
      if (!plot) return;
      openMenuForRef.current(plot);
    };
    window.addEventListener(BERRY_MENU_EVENT, onBerryMenu);
    return () => window.removeEventListener(BERRY_MENU_EVENT, onBerryMenu);
  }, []);

  // Server answers.
  useEffect(() => {
    const onActions = (data: { plotId: string } & BerryActions) => {
      setSession((prev) => {
        if (!prev || prev.phase !== "loading" || prev.plotId !== data.plotId) return prev;
        clearTimers();
        const actions: BerryActions = {
          plot: data.plot ?? null,
          berries: Array.isArray(data.berries) ? data.berries : [],
          canPlant: data.canPlant === true,
          canHarvest: data.canHarvest === true,
          canClear: data.canClear === true,
          reasonKey: data.reasonKey
        };
        const entries = menuEntriesFor(actions);
        const firstEnabled = entries.findIndex((entry) => !entry.disabled);
        return { ...prev, phase: "menu", actions, selected: Math.max(0, firstEnabled) };
      });
    };
    const onResult = (data: { ok: boolean; plotId: string; messageKey: string; params?: Record<string, string> }) => {
      submitLockRef.current = false;
      const message = t(data.messageKey, data.params);
      setSession((prev) => {
        if (!prev || prev.plotId !== data.plotId) return prev;
        return { ...prev, phase: "result", ok: data.ok, message };
      });
      clearTimers();
      const clearId = window.setTimeout(() => setSession(null), RESULT_LINGER_MS);
      timersRef.current.push(clearId);
    };
    socket.on("berry:actions-result", onActions);
    socket.on("berry:result", onResult);
    return () => {
      socket.off("berry:actions-result", onActions);
      socket.off("berry:result", onResult);
    };
  }, [socket, t]);

  const cancel = () => {
    clearTimers();
    submitLockRef.current = false;
    setSession(null);
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  const confirmEntry = (index: number) => {
    const current = sessionRef.current;
    // A submit is already in flight (or the outcome is showing): a second
    // rapid confirm must not fire another plant/harvest/clear.
    if (!current?.actions || submitLockRef.current) return;
    if (current.phase === "loading" || current.phase === "result") return;

    if (current.phase === "berries") {
      const berries = current.actions.berries;
      if (index >= berries.length) {
        cancel();
        return;
      }
      submitLockRef.current = true;
      socket.emit("berry:plant", { plotId: current.plotId, itemId: berries[index].itemId });
      setSession({ ...current, phase: "loading", selected: 0 });
      return;
    }

    const entries = menuEntriesFor(current.actions);
    const entry = entries[index] ?? entries[entries.length - 1];
    if (entry.key === "cancel") {
      cancel();
      return;
    }
    if (entry.disabled) return;
    if (entry.key === "plant") {
      setSession({ ...current, phase: "berries", selected: 0 });
      return;
    }
    submitLockRef.current = true;
    socket.emit(entry.key === "collect" ? "berry:harvest" : "berry:clear", { plotId: current.plotId });
    setSession({ ...current, phase: "loading", selected: 0 });
  };
  const confirmEntryRef = useRef(confirmEntry);
  confirmEntryRef.current = confirmEntry;

  // Keyboard/gamepad navigation while the menu is open.
  useEffect(() => {
    const menuOpen = session !== null && (session.phase === "menu" || session.phase === "berries");
    if (!menuOpen) return undefined;
    const entryCount =
      session.phase === "berries"
        ? (session.actions?.berries.length ?? 0) + 1
        : menuEntriesFor(session.actions).length;

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "ArrowUp" || key === "w" || key === "W") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSession((prev) => (prev ? { ...prev, selected: (prev.selected + entryCount - 1) % entryCount } : prev));
        return;
      }
      if (key === "ArrowDown" || key === "s" || key === "S") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSession((prev) => (prev ? { ...prev, selected: (prev.selected + 1) % entryCount } : prev));
        return;
      }
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
        confirmEntryRef.current(sessionRef.current?.selected ?? 0);
        return;
      }
      if (key === "Escape" || key === "Backspace") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelRef.current();
        return;
      }
      if (key.startsWith("Arrow")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [session]);

  if (!session || typeof document === "undefined") return null;

  const livePlot = (mapId && getBerryPlot(mapId, session.plotId)) || session.actions?.plot || null;
  const stage = livePlot ? berryStage(livePlot, berryServerNow()) : 0;
  const entries = menuEntriesFor(session.actions);
  const selectedEntry = session.phase === "menu" ? entries[session.selected] : undefined;

  // Status line under the entries: growth stage + countdown, or a refusal.
  let hint: string | undefined;
  if (session.phase === "menu" && livePlot?.berryId) {
    const parts: string[] = [t(`berry.stage.${Math.max(1, stage)}`)];
    if (stage < BERRY_RIPE_STAGE) parts.push(t("berry.ripeIn", { remaining: formatBerryCountdown(berryMsUntilRipe(livePlot)) }));
    if (livePlot.plantedBy) parts.push(t("berry.plantedBy", { name: livePlot.plantedBy }));
    hint = parts.join(" · ");
  } else if (session.phase === "menu" && selectedEntry?.disabled && selectedEntry.reasonKey) {
    hint = t(selectedEntry.reasonKey);
  }

  const headerLabel =
    session.phase === "berries"
      ? t("berry.choose")
      : livePlot?.berryId
        ? livePlot.berryId
        : t("berry.title");

  const overlay = (
    <Box position="fixed" inset={0} zIndex={4300} pointerEvents="none" data-game-ux="true" data-berry-menu={session.phase}>
      {session.phase === "menu" || session.phase === "berries" ? (
        <Box
          position="fixed"
          left={`${session.menuX}px`}
          top={`${session.menuY}px`}
          style={{ transform: "translate(-50%, calc(-100% - 12px))" } as CSSProperties}
        >
          <RetroPanel minWidth="190px" maxWidth="260px">
            <VStack align="stretch" spacing={2}>
              <HStack spacing={2} justify="center">
                <Text fontSize="18px" lineHeight="1">
                  {livePlot?.berryId ? (stage >= BERRY_RIPE_STAGE ? "🍓" : "🌱") : "🟫"}
                </Text>
                <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#404040" textTransform="uppercase">
                  {headerLabel}
                </Text>
              </HStack>
              {session.phase === "berries"
                ? [
                    ...(session.actions?.berries ?? []).map((berry, index) => (
                      <MenuChoiceButton
                        key={berry.itemId}
                        active={session.selected === index}
                        onClick={() => confirmEntry(index)}
                        onMouseEnter={() => setSession((prev) => (prev ? { ...prev, selected: index } : prev))}
                      >
                        {`🍓 ${berry.name} ×${berry.quantity}`}
                      </MenuChoiceButton>
                    )),
                    <MenuChoiceButton
                      key="berries-cancel"
                      active={session.selected === (session.actions?.berries.length ?? 0)}
                      onClick={cancel}
                      onMouseEnter={() =>
                        setSession((prev) => (prev ? { ...prev, selected: prev.actions?.berries.length ?? 0 } : prev))
                      }
                    >
                      {t("berry.action.cancel")}
                    </MenuChoiceButton>
                  ]
                : entries.map((entry, index) => (
                    <MenuChoiceButton
                      key={entry.key}
                      active={session.selected === index}
                      isDisabled={entry.disabled}
                      onClick={() => confirmEntry(index)}
                      onMouseEnter={() => setSession((prev) => (prev ? { ...prev, selected: index } : prev))}
                    >
                      {t(`berry.action.${entry.key}`)}
                    </MenuChoiceButton>
                  ))}
              {session.phase === "berries" && session.selected < (session.actions?.berries.length ?? 0) ? (
                <Text fontFamily="mono" fontSize="xs" color="#4a6a4a" textAlign="center" whiteSpace="normal">
                  {t("berry.growsIn", {
                    hours: String((session.actions?.berries[session.selected]?.hoursPerStage ?? 0) * 4)
                  })}
                </Text>
              ) : null}
              {hint ? (
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  color={selectedEntry?.disabled ? "#7a4a4a" : "#4a6a4a"}
                  textAlign="center"
                  whiteSpace="normal"
                >
                  {hint}
                </Text>
              ) : null}
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
            maxW="280px"
            data-berry-result={session.ok ? "ok" : "error"}
          >
            {session.message}
          </Box>
        </Box>
      ) : null}
    </Box>
  );

  return createPortal(overlay, document.body);
};

export default BerryInteractionController;
