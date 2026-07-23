/**
 * Click-to-fish UX. When the player taps an adjacent, fishable water tile and
 * owns a rod, this takes over the click (instead of walking there), pops a
 * "Fish / Cancel" prompt anchored at the tile, plays a short casting animation,
 * and emits `fishing:cast`. The server validates and casts; a bite arrives as a
 * normal `battle:state`, so no separate inventory trip is needed.
 */
import { CSSProperties, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { Socket } from "socket.io-client";
import { AppContext } from "../../context/appContext";
import { useAuth } from "../../context/authContext";
import { bestFishingRodTier } from "../ux/game/itemUsage";
import { isFishableWaterCell } from "./fishing";
import { MenuChoiceButton, RetroPanel } from "../ux/game/NpcInteractions";
import type { PlayableMapTileMapProfile } from "../tilemap/tileMapTypes";

const MIN_CAST_MS = 1300; // keep the bobber up at least this long for feel
const RESULT_LINGER_MS = 1900; // how long the outcome text stays on screen
const FISH_STYLE_ID = "pokecraft-fishing-anim";

type Phase = "prompt" | "casting" | "result";

interface FishSession {
  cellX: number;
  cellY: number;
  menuX: number;
  menuY: number;
  bobberX: number;
  bobberY: number;
  phase: Phase;
  status?: "bite" | "no-bite" | "error";
  message?: string;
}

interface FishingControllerProps {
  socket: Socket;
  player: { x?: number; y?: number } | null;
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

const FishingController = ({ socket, player, mapId, cellSize, tileMap }: FishingControllerProps) => {
  const { waiting, activeNpcInteraction } = useContext(AppContext);
  const { user } = useAuth();
  const [session, setSession] = useState<FishSession | null>(null);

  const rodTier = bestFishingRodTier(user?.inventory ?? []);

  // Live snapshot for the window-level (capture-phase) click handler.
  const stateRef = useRef({ player, mapId, cellSize, tileMap, rodTier, hasSession: false, waiting, activeNpcInteraction });
  stateRef.current = {
    player,
    mapId,
    cellSize,
    tileMap,
    rodTier,
    hasSession: session !== null,
    waiting,
    activeNpcInteraction
  };
  const sessionRef = useRef<FishSession | null>(session);
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

  // Capture-phase click: runs before UserControl's move handler so a tap on
  // fishable water opens the prompt instead of walking the player to the shore.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const snap = stateRef.current;
      if (snap.hasSession) return;
      if (!snap.rodTier || !snap.player || !snap.mapId || !snap.tileMap) return;
      if (snap.waiting || snap.activeNpcInteraction || isEventDialogActive()) return;
      if (isUxTarget(event.target)) return;

      const map = document.getElementById("map");
      const target = event.target as Node | null;
      if (!map || !target || !map.contains(target)) return;

      const rect = map.getBoundingClientRect();
      const size = snap.cellSize || 32;
      const cellX = Math.floor((event.clientX - rect.left) / size);
      const cellY = Math.floor((event.clientY - rect.top) / size);

      const playerCellX = Math.round((snap.player.x ?? 0) / size);
      const playerCellY = Math.round((snap.player.y ?? 0) / size);
      const distance = Math.abs(cellX - playerCellX) + Math.abs(cellY - playerCellY);
      if (distance !== 1) return;

      if (!isFishableWaterCell(snap.mapId, snap.tileMap, cellX, cellY)) return;

      // It's an adjacent water tile and we hold a rod: take over the click.
      event.stopImmediatePropagation();
      event.preventDefault();
      setSession({
        cellX,
        cellY,
        menuX: event.clientX,
        menuY: event.clientY,
        bobberX: rect.left + cellX * size + size / 2,
        bobberY: rect.top + cellY * size + size / 2,
        phase: "prompt"
      });
    };

    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  // Fishing outcome from the server. Keep the animation up for a beat, then
  // reveal the message; a bite is handed off to the battle screen.
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

  const startCast = () => {
    if (!session) return;
    clearTimers();
    castStartRef.current = performance.now();
    socket.emit("fishing:cast", { x: session.cellX, y: session.cellY });
    setSession({ ...session, phase: "casting" });
  };

  if (!session || typeof document === "undefined") {
    return null;
  }

  const overlay = (
    <Box position="fixed" inset={0} zIndex={4300} pointerEvents="none" data-game-ux="true">
      {/* Bobber + ripple over the water tile (casting / result phases). */}
      {session.phase !== "prompt" ? (
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

      {/* Fish / Cancel prompt anchored just above the tapped tile. */}
      {session.phase === "prompt" ? (
        <Box
          position="fixed"
          left={`${session.menuX}px`}
          top={`${session.menuY}px`}
          style={{ transform: "translate(-50%, calc(-100% - 12px))" } as CSSProperties}
        >
          <RetroPanel minWidth="150px" maxWidth="200px">
            <VStack align="stretch" spacing={2}>
              <HStack spacing={2} justify="center">
                <Text fontSize="18px" lineHeight="1">
                  🎣
                </Text>
                <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#404040" textTransform="uppercase">
                  Water
                </Text>
              </HStack>
              <MenuChoiceButton active onClick={startCast}>
                Fish
              </MenuChoiceButton>
              <MenuChoiceButton active={false} onClick={cancel}>
                Cancel
              </MenuChoiceButton>
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

export default FishingController;
