/**
 * Water interaction UX — the single client entry point for Fish / Surf / Dive.
 *
 * Every input method funnels into the same contextual menu:
 *  - mouse click / tap on an adjacent water tile (capture-phase, steals the
 *    click from click-to-move)
 *  - right-click (contextmenu) on an adjacent water tile
 *  - action button / gamepad / virtual pad facing water (Map.tsx dispatches
 *    "pokecraft:water-menu" from the shared interact-front path)
 *  - using a fishing rod from the bag ("pokecraft:use-rod" casts at the faced
 *    tile directly)
 *
 * The menu opens with the server's answer to `field:actions` (which actions
 * are legal for that cell right now, plus the owned rods), so all gating is
 * server-authoritative; this component only renders availability and sends
 * the chosen action. Fishing outcomes arrive over `fishing:result`; a bite is
 * followed by a normal `battle:state`.
 */
import { CSSProperties, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { Socket } from "socket.io-client";
import { AppContext } from "../../context/appContext";
import { isFishableWaterCell } from "./fishing";
import { MenuChoiceButton, RetroPanel } from "../ux/game/NpcInteractions";
import type { PlayableMapTileMapProfile } from "../tilemap/tileMapTypes";

const MIN_CAST_MS = 1300; // keep the bobber up at least this long for feel
const RESULT_LINGER_MS = 1900; // how long the outcome text stays on screen
const ACTIONS_TIMEOUT_MS = 2500; // give up when field:actions gets no answer
const FISH_STYLE_ID = "pokecraft-fishing-anim";

export const WATER_MENU_EVENT = "pokecraft:water-menu";
export const USE_ROD_EVENT = "pokecraft:use-rod";

type Phase = "loading" | "menu" | "rods" | "casting" | "result";

interface RodOption {
  itemId: string;
  name: string;
  tier: string;
}

interface WaterActions {
  fish: { available: boolean; reason?: string; rods: RodOption[] };
  surf: { available: boolean; reason?: string };
  dive: { available: boolean; reason?: string };
}

interface WaterSession {
  cellX: number;
  cellY: number;
  menuX: number;
  menuY: number;
  bobberX: number;
  bobberY: number;
  phase: Phase;
  actions?: WaterActions;
  selected: number;
  status?: "bite" | "no-bite" | "error";
  message?: string;
}

interface WaterInteractionControllerProps {
  socket: Socket;
  player: { x?: number; y?: number; angle?: number } | null;
  mapId: string | null;
  cellSize: number;
  tileMap: PlayableMapTileMapProfile | null;
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
  typeof document !== "undefined" && document.body.dataset.eventActive === "1";

function ensureFishingStyles() {
  if (typeof document === "undefined" || document.getElementById(FISH_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = FISH_STYLE_ID;
  style.textContent =
    "@keyframes pokecraftBob{0%,100%{transform:translate(-50%,-45%)}50%{transform:translate(-50%,-70%)}}" +
    "@keyframes pokecraftRipple{0%{transform:translate(-50%,-50%) scale(0.4);opacity:0.7}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}";
  document.head.appendChild(style);
}

/** Facing cell from the shared angle mapping (90/450=up, 180=right, 0/360=left, else down). */
const facingCellFor = (player: { x?: number; y?: number; angle?: number }, cellSize: number) => {
  const playerCellX = Math.round((player.x ?? 0) / cellSize);
  const playerCellY = Math.round((player.y ?? 0) / cellSize);
  const angle = player.angle ?? 270;
  const delta =
    angle === 90 || angle === 450
      ? { x: 0, y: -1 }
      : angle === 180
        ? { x: 1, y: 0 }
        : angle === 0 || angle === 360
          ? { x: -1, y: 0 }
          : { x: 0, y: 1 };
  return { x: playerCellX + delta.x, y: playerCellY + delta.y };
};

type MenuEntryKey = "fish" | "surf" | "dive" | "cancel";

const MENU_LABELS: Record<MenuEntryKey, string> = {
  fish: "🎣 Pescar",
  surf: "🌊 Surfear",
  dive: "🤿 Bucear",
  cancel: "Cancelar"
};

const WaterInteractionController = ({
  socket,
  player,
  mapId,
  cellSize,
  tileMap
}: WaterInteractionControllerProps) => {
  const { waiting, activeNpcInteraction } = useContext(AppContext);
  const [session, setSession] = useState<WaterSession | null>(null);

  // Live snapshot for the window-level (capture-phase) handlers.
  const stateRef = useRef({ player, mapId, cellSize, tileMap, hasSession: false, waiting, activeNpcInteraction });
  stateRef.current = {
    player,
    mapId,
    cellSize,
    tileMap,
    hasSession: session !== null,
    waiting,
    activeNpcInteraction
  };
  const sessionRef = useRef<WaterSession | null>(session);
  sessionRef.current = session;
  const castStartRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    ensureFishingStyles();
    return () => clearTimers();
  }, []);

  // Freeze walk/interact input while the menu is up (UserControl checks this).
  useEffect(() => {
    const menuOpen = session !== null && session.phase !== "casting" && session.phase !== "result";
    if (menuOpen) {
      document.body.dataset.waterMenuActive = "1";
    } else {
      delete document.body.dataset.waterMenuActive;
    }
    return () => {
      delete document.body.dataset.waterMenuActive;
    };
  }, [session]);

  /** Open the contextual menu at a water cell and ask the server what's legal. */
  const openMenuAt = (cellX: number, cellY: number, anchorX?: number, anchorY?: number) => {
    const snap = stateRef.current;
    const map = document.getElementById("map");
    if (!map) return;
    const rect = map.getBoundingClientRect();
    const size = snap.cellSize || 32;
    const bobberX = rect.left + cellX * size + size / 2;
    const bobberY = rect.top + cellY * size + size / 2;
    clearTimers();
    setSession({
      cellX,
      cellY,
      menuX: anchorX ?? bobberX,
      menuY: anchorY ?? bobberY - size / 2,
      bobberX,
      bobberY,
      phase: "loading",
      selected: 0
    });
    socket.emit("field:actions", { x: cellX, y: cellY });
    const timeoutId = window.setTimeout(() => {
      setSession((prev) => (prev && prev.phase === "loading" ? null : prev));
    }, ACTIONS_TIMEOUT_MS);
    timersRef.current.push(timeoutId);
  };
  const openMenuAtRef = useRef(openMenuAt);
  openMenuAtRef.current = openMenuAt;

  const startCast = (cellX: number, cellY: number, rodItemId?: string) => {
    clearTimers();
    castStartRef.current = performance.now();
    socket.emit("fishing:cast", { x: cellX, y: cellY, rodItemId });
    setSession((prev) => {
      const map = document.getElementById("map");
      const rect = map?.getBoundingClientRect();
      const size = stateRef.current.cellSize || 32;
      const bobberX = (rect?.left ?? 0) + cellX * size + size / 2;
      const bobberY = (rect?.top ?? 0) + cellY * size + size / 2;
      return {
        cellX,
        cellY,
        menuX: prev?.menuX ?? bobberX,
        menuY: prev?.menuY ?? bobberY,
        bobberX,
        bobberY,
        phase: "casting",
        selected: 0
      };
    });
  };
  const startCastRef = useRef(startCast);
  startCastRef.current = startCast;

  // Pointer entry points: capture-phase click AND contextmenu on an adjacent
  // water tile take over the pointer event (instead of walking / browser menu).
  useEffect(() => {
    const tryOpenFromPointer = (event: MouseEvent) => {
      const snap = stateRef.current;
      if (snap.hasSession) return false;
      if (!snap.player || !snap.mapId || !snap.tileMap) return false;
      if (snap.waiting || snap.activeNpcInteraction || isEventDialogActive()) return false;
      if (isUxTarget(event.target)) return false;

      const map = document.getElementById("map");
      const target = event.target as Node | null;
      if (!map || !target || !map.contains(target)) return false;

      const rect = map.getBoundingClientRect();
      const size = snap.cellSize || 32;
      const cellX = Math.floor((event.clientX - rect.left) / size);
      const cellY = Math.floor((event.clientY - rect.top) / size);

      const playerCellX = Math.round((snap.player.x ?? 0) / size);
      const playerCellY = Math.round((snap.player.y ?? 0) / size);
      const distance = Math.abs(cellX - playerCellX) + Math.abs(cellY - playerCellY);
      if (distance !== 1) return false;

      if (!isFishableWaterCell(snap.mapId, snap.tileMap, cellX, cellY)) return false;

      event.stopImmediatePropagation();
      event.preventDefault();
      openMenuAtRef.current(cellX, cellY, event.clientX, event.clientY);
      return true;
    };

    const onClick = (event: MouseEvent) => {
      tryOpenFromPointer(event);
    };
    const onContextMenu = (event: MouseEvent) => {
      tryOpenFromPointer(event);
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, []);

  // Keyboard/gamepad entry point: Map.tsx dispatches this when the action
  // button is pressed while facing water (all pads funnel through that path).
  useEffect(() => {
    const onWaterMenu = (event: Event) => {
      const snap = stateRef.current;
      if (snap.hasSession) return;
      if (snap.waiting || snap.activeNpcInteraction || isEventDialogActive()) return;
      const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail;
      if (!detail || typeof detail.x !== "number" || typeof detail.y !== "number") return;
      openMenuAtRef.current(detail.x, detail.y);
    };

    // Bag entry point: using a rod casts straight at the faced tile — same
    // server validation as every other cast.
    const onUseRod = (event: Event) => {
      const snap = stateRef.current;
      if (snap.hasSession || !snap.player) return;
      if (snap.waiting || snap.activeNpcInteraction || isEventDialogActive()) return;
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      const facing = facingCellFor(snap.player, snap.cellSize || 32);
      startCastRef.current(facing.x, facing.y, detail?.itemId);
    };

    window.addEventListener(WATER_MENU_EVENT, onWaterMenu);
    window.addEventListener(USE_ROD_EVENT, onUseRod);
    return () => {
      window.removeEventListener(WATER_MENU_EVENT, onWaterMenu);
      window.removeEventListener(USE_ROD_EVENT, onUseRod);
    };
  }, []);

  // Server's availability answer for the queried cell.
  useEffect(() => {
    const onActions = (data: { x: number; y: number; actions: WaterActions }) => {
      setSession((prev) => {
        if (!prev || prev.phase !== "loading" || prev.cellX !== data.x || prev.cellY !== data.y) {
          return prev;
        }
        clearTimers();
        const order: Array<"fish" | "surf" | "dive"> = ["fish", "surf", "dive"];
        const firstAvailable = order.findIndex((key) => data.actions[key]?.available);
        return {
          ...prev,
          phase: "menu",
          actions: data.actions,
          selected: firstAvailable >= 0 ? firstAvailable : 3
        };
      });
    };

    socket.on("field:actions-result", onActions);
    return () => {
      socket.off("field:actions-result", onActions);
    };
  }, [socket]);

  // Fishing outcome. Keep the animation up for a beat, then reveal the
  // message; a bite is handed off to the battle screen.
  useEffect(() => {
    const onResult = (data: { status: "bite" | "no-bite" | "error"; message: string }) => {
      const current = sessionRef.current;
      if (!current) return;
      const elapsed = performance.now() - castStartRef.current;
      const wait = Math.max(0, MIN_CAST_MS - elapsed);
      const revealId = window.setTimeout(() => {
        if (data.status === "bite") {
          // The wild battle (battle:state) takes over the screen.
          setSession(null);
          return;
        }
        setSession((prev) =>
          prev ? { ...prev, phase: "result", status: data.status, message: data.message } : prev
        );
        const clearId = window.setTimeout(() => setSession(null), RESULT_LINGER_MS);
        timersRef.current.push(clearId);
      }, wait);
      timersRef.current.push(revealId);
    };

    socket.on("fishing:result", onResult);
    return () => {
      socket.off("fishing:result", onResult);
    };
  }, [socket]);

  const cancel = () => {
    clearTimers();
    setSession(null);
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  const confirmEntry = (index: number) => {
    const current = sessionRef.current;
    if (!current?.actions) return;

    if (current.phase === "rods") {
      const rods = current.actions.fish.rods;
      if (index >= rods.length) {
        cancel();
        return;
      }
      startCast(current.cellX, current.cellY, rods[index]?.itemId);
      return;
    }

    const order: MenuEntryKey[] = ["fish", "surf", "dive", "cancel"];
    const key = order[index] ?? "cancel";
    if (key === "cancel") {
      cancel();
      return;
    }
    const action = current.actions[key];
    if (!action?.available) {
      return; // disabled entries only show their reason
    }
    if (key === "fish") {
      const rods = current.actions.fish.rods;
      if (rods.length > 1) {
        setSession({ ...current, phase: "rods", selected: 0 });
        return;
      }
      startCast(current.cellX, current.cellY, rods[0]?.itemId);
      return;
    }
    if (key === "surf") {
      socket.emit("player:surf", { x: current.cellX, y: current.cellY });
      cancel();
      return;
    }
    socket.emit("player:dive");
    cancel();
  };
  const confirmEntryRef = useRef(confirmEntry);
  confirmEntryRef.current = confirmEntry;

  // Keyboard/gamepad navigation while the menu is open. GamepadControls and
  // VirtualControls dispatch synthetic KeyboardEvents, so this one listener
  // serves every input method.
  useEffect(() => {
    const menuOpen = session !== null && (session.phase === "menu" || session.phase === "rods");
    if (!menuOpen) {
      return undefined;
    }
    const entryCount =
      session.phase === "rods" ? (session.actions?.fish.rods.length ?? 0) + 1 : 4;

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "ArrowUp" || key === "w" || key === "W") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSession((prev) =>
          prev ? { ...prev, selected: (prev.selected + entryCount - 1) % entryCount } : prev
        );
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
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [session]);

  if (!session || typeof document === "undefined") {
    return null;
  }

  const order: MenuEntryKey[] = ["fish", "surf", "dive", "cancel"];
  const selectedKey = order[session.selected] ?? "cancel";
  const selectedReason =
    session.phase === "menu" && session.actions && selectedKey !== "cancel"
      ? session.actions[selectedKey]?.available
        ? undefined
        : session.actions[selectedKey]?.reason
      : undefined;

  const overlay = (
    <Box position="fixed" inset={0} zIndex={4300} pointerEvents="none" data-game-ux="true">
      {/* Bobber + ripple over the water tile (casting / result phases). */}
      {session.phase === "casting" || session.phase === "result" ? (
        <Box
          position="fixed"
          left={`${session.bobberX}px`}
          top={`${session.bobberY}px`}
          style={{ transform: "translate(-50%, -50%)" } as CSSProperties}
          pointerEvents="none"
        >
          <Box
            position="absolute"
            left="0"
            top="6px"
            width="26px"
            height="26px"
            borderRadius="full"
            border="2px solid #7ad7ff"
            style={
              {
                transform: "translate(-50%, -50%)",
                animation: "pokecraftRipple 1.1s ease-out infinite"
              } as CSSProperties
            }
          />
          {session.phase === "casting" ? (
            <Text
              position="absolute"
              fontSize="22px"
              lineHeight="1"
              style={
                { transform: "translate(-50%, -45%)", animation: "pokecraftBob 0.9s ease-in-out infinite" } as CSSProperties
              }
            >
              🎣
            </Text>
          ) : null}
        </Box>
      ) : null}

      {/* Contextual menu anchored just above the targeted tile. */}
      {session.phase === "menu" || session.phase === "rods" ? (
        <Box
          position="fixed"
          left={`${session.menuX}px`}
          top={`${session.menuY}px`}
          style={{ transform: "translate(-50%, calc(-100% - 12px))" } as CSSProperties}
        >
          <RetroPanel minWidth="170px" maxWidth="230px">
            <VStack align="stretch" spacing={2}>
              <HStack spacing={2} justify="center">
                <Text fontSize="18px" lineHeight="1">
                  🌊
                </Text>
                <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#404040" textTransform="uppercase">
                  {session.phase === "rods" ? "Elige caña" : "Agua"}
                </Text>
              </HStack>
              {session.phase === "rods"
                ? [
                    ...(session.actions?.fish.rods ?? []).map((rod, index) => (
                      <MenuChoiceButton
                        key={rod.itemId}
                        active={session.selected === index}
                        onClick={() => confirmEntry(index)}
                        onMouseEnter={() =>
                          setSession((prev) => (prev ? { ...prev, selected: index } : prev))
                        }
                      >
                        {`🎣 ${rod.name}`}
                      </MenuChoiceButton>
                    )),
                    <MenuChoiceButton
                      key="rods-cancel"
                      active={session.selected === (session.actions?.fish.rods.length ?? 0)}
                      onClick={cancel}
                      onMouseEnter={() =>
                        setSession((prev) =>
                          prev
                            ? { ...prev, selected: prev.actions?.fish.rods.length ?? 0 }
                            : prev
                        )
                      }
                    >
                      Cancelar
                    </MenuChoiceButton>
                  ]
                : order.map((key, index) => {
                    const action = key === "cancel" ? null : session.actions?.[key];
                    const disabled = key !== "cancel" && !action?.available;
                    return (
                      <MenuChoiceButton
                        key={key}
                        active={session.selected === index}
                        isDisabled={disabled}
                        onClick={() => confirmEntry(index)}
                        onMouseEnter={() =>
                          setSession((prev) => (prev ? { ...prev, selected: index } : prev))
                        }
                      >
                        {MENU_LABELS[key]}
                      </MenuChoiceButton>
                    );
                  })}
              {selectedReason ? (
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  color="#7a4a4a"
                  textAlign="center"
                  whiteSpace="normal"
                >
                  {selectedReason}
                </Text>
              ) : null}
            </VStack>
          </RetroPanel>
        </Box>
      ) : null}

      {/* Outcome text (no-bite / error). */}
      {session.phase === "result" ? (
        <Box
          position="fixed"
          left={`${session.bobberX}px`}
          top={`${session.bobberY - 44}px`}
          style={{ transform: "translate(-50%, -100%)" } as CSSProperties}
          pointerEvents="none"
        >
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
            whiteSpace="nowrap"
          >
            {session.message}
          </Box>
        </Box>
      ) : null}
    </Box>
  );

  return createPortal(overlay, document.body);
};

export default WaterInteractionController;
