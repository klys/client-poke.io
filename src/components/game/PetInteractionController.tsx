/**
 * House pets UX (server: components/HousePets.ts) — one centered window,
 * same look as the apartment/house window, listing the venomons that live
 * in the house the player stands in and what lies on its floor.
 *
 *  OPEN   the 🐾 button next to the notification bell (AccountMenu; shown
 *         inside your own house, or in another's house where one of your
 *         venomons lives), or clicking an egg / mess on the floor
 *         (PET_MENU_EVENT with a groundId).
 *  PET    → Feed (pick a berry from the bag) · Play (drops the ball) ·
 *         Pet it · Take it back to the party (owner only).
 *  FLOOR  → Collect egg (the mother's owner) · Clean up mess (anyone).
 *
 * Every action is validated server-side and answered with `pet:result`.
 */
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, Button, Flex, HStack, Image, Progress, Text, VStack } from "@chakra-ui/react";
import type { Socket } from "socket.io-client";
import { AppContext } from "../../context/appContext";
import { useAuth } from "../../context/authContext";
import { useCompactUx } from "../ux/useCompactUx";
import { UX_LAYER } from "../ux/layers";
import { useT } from "../../i18n";
import { resolveServerAssetUrl } from "../tilemap/serverAssets";
import { GenderMark } from "../ux/game/GenderMark";
import { getHouse } from "./houses";
import { PET_MENU_EVENT, useHousePets, type HousePet, type PetGroundThing } from "./housePets";

const RESULT_LINGER_MS = 2200;
const PANEL_BORDER = "#5d5a7b";
const INK = "#404040";
const MUTED = "#4a6a4a";

type Phase = "list" | "pet" | "feed" | "loading" | "result";

interface Session {
  phase: Phase;
  returnPhase?: Phase;
  petId?: string;
  groundId?: string;
  selected: number;
  notice?: { ok: boolean; message: string };
  message?: string;
  ok?: boolean;
}

type Entry = { key: string; label: ReactNode; disabled?: boolean; secondary?: boolean; run: () => void };

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
      data-pet-entry={testId}
      data-pet-entry-active={active ? "1" : undefined}
    >
      {children}
    </Button>
  );
}

function NeedBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  // Needs: low is good. Mood: high is good.
  const good = invert ? value : 100 - value;
  const scheme = good >= 60 ? "green" : good >= 30 ? "yellow" : "red";
  return (
    <HStack spacing={2} align="center">
      <Text fontFamily="mono" fontSize="10px" fontWeight="800" color={MUTED} w="88px" flexShrink={0} textTransform="uppercase">
        {label}
      </Text>
      <Progress value={value} size="sm" colorScheme={scheme} flex="1" borderRadius="2px" bg="#e6e3d8" />
      <Text fontFamily="mono" fontSize="10px" fontWeight="800" color={INK} w="32px" textAlign="right">
        {value}
      </Text>
    </HStack>
  );
}

function petStateLabel(pet: HousePet, t: (key: string) => string) {
  if (pet.sick) return t("pet.state.sick");
  if (pet.eggDueAt) return t("pet.state.egg");
  if (pet.courting) return t("pet.state.courting");
  if (pet.hunger >= 60) return t("pet.state.hungry");
  if (pet.boredom >= 70) return t("pet.state.bored");
  if (pet.loneliness >= 70) return t("pet.state.lonely");
  return t("pet.state.happy");
}

const PetInteractionController = ({ socket, mapId }: { socket: Socket; mapId: string | null }) => {
  const t = useT();
  const compact = useCompactUx();
  const { user } = useAuth();
  const { waiting, activeNpcInteraction } = useContext(AppContext);
  const { pets, ground } = useHousePets(mapId);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;
  const timersRef = useRef<number[]>([]);
  const submitLockRef = useRef(false);
  const myCharacterId = user?.characterId ?? null;

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (session) document.body.dataset.petMenuActive = "1";
    else delete document.body.dataset.petMenuActive;
    return () => {
      delete document.body.dataset.petMenuActive;
    };
  }, [session]);

  // Leaving the house closes the window.
  useEffect(() => {
    setSession(null);
  }, [mapId]);

  const cancel = () => {
    clearTimers();
    submitLockRef.current = false;
    setSession(null);
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  // Open from the 🐾 button / floor clicks.
  useEffect(() => {
    const onOpen = (event: Event) => {
      if (!mapId || !getHouse(mapId) || waiting || activeNpcInteraction) return;
      if (document.body.dataset.eventActive === "1" || document.body.dataset.houseMenuActive === "1") return;
      const detail = (event as CustomEvent<{ groundId?: string; petId?: string }>).detail ?? {};
      clearTimers();
      submitLockRef.current = false;
      if (detail.petId) setSession({ phase: "pet", petId: detail.petId, selected: 0 });
      else if (detail.groundId) setSession({ phase: "list", groundId: detail.groundId, selected: 0 });
      else setSession((prev) => (prev ? null : { phase: "list", selected: 0 }));
    };
    window.addEventListener(PET_MENU_EVENT, onOpen);
    return () => window.removeEventListener(PET_MENU_EVENT, onOpen);
  }, [mapId, waiting, activeNpcInteraction]);

  // Server answers.
  useEffect(() => {
    const onResult = (data: { action: string; ok: boolean; messageKey: string; params?: Record<string, string> }) => {
      const current = sessionRef.current;
      if (!current) return;
      const message = t(data.messageKey, data.params);
      clearTimers();
      submitLockRef.current = false;
      if (data.ok) {
        setSession((prev) => (prev ? { ...prev, phase: "result", ok: true, message, notice: undefined } : prev));
        const id = window.setTimeout(() => setSession(null), RESULT_LINGER_MS);
        timersRef.current.push(id);
        return;
      }
      setSession((prev) => (prev ? { ...prev, phase: prev.returnPhase ?? "list", notice: { ok: false, message } } : prev));
    };
    socket.on("pet:result", onResult);
    return () => {
      socket.off("pet:result", onResult);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, t]);

  const submit = (event: string, payload: Record<string, unknown>) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    socket.emit(event, payload);
    setSession((prev) => (prev ? { ...prev, phase: "loading", returnPhase: prev.phase === "feed" ? "pet" : prev.phase, notice: undefined } : prev));
  };
  const goTo = (phase: Phase, patch: Partial<Session> = {}) =>
    setSession((prev) => (prev ? { ...prev, phase, selected: 0, notice: undefined, ...patch } : prev));

  const isMine = (pet: HousePet) => myCharacterId !== null && pet.ownerCharacterId === myCharacterId;
  const berries = (user?.inventory ?? []).filter((item) => item.category === "berries" && item.quantity > 0);

  const groundEntry = (thing: PetGroundThing): Entry => {
    if (thing.kind === "mess") {
      return {
        key: `ground-${thing.id}`,
        label: `🧽 ${t("pet.action.clean", { name: thing.byPetName })}`,
        run: () => submit("house:pet-clean", { groundId: thing.id })
      };
    }
    const mine = myCharacterId !== null && thing.ownerCharacterId === myCharacterId;
    return {
      key: `ground-${thing.id}`,
      label: `🥚 ${mine ? t("pet.action.collectEgg", { name: thing.byPetName }) : t("pet.action.eggNotYours", { name: thing.byPetName })}`,
      disabled: !mine,
      run: () => submit("house:pet-collect-egg", { groundId: thing.id })
    };
  };

  const entriesFor = (current: Session): Entry[] => {
    if (current.phase === "list") {
      const petEntries = pets.map<Entry>((pet) => ({
        key: `pet-${pet.id}`,
        label: (
          <Flex w="100%" align="center" gap={2}>
            {pet.iconImageSrc ? (
              <Image src={resolveServerAssetUrl(pet.iconImageSrc)} alt={pet.name} boxSize="28px" objectFit="contain" style={{ imageRendering: "pixelated" }} flexShrink={0} />
            ) : null}
            <Box flex="1" minW={0}>
              <HStack spacing={1}>
                <Text textTransform="uppercase" whiteSpace="normal">{pet.name}</Text>
                <GenderMark gender={pet.gender} />
                <Text fontSize="xs" color={MUTED}>Nv {pet.level}</Text>
              </HStack>
              <Text fontSize="xs" color={MUTED} fontWeight="600" whiteSpace="normal" mt="2px">
                {petStateLabel(pet, t)} · {isMine(pet) ? t("pet.yours") : t("pet.owner", { name: pet.ownerName })}
              </Text>
            </Box>
            <Box
              flexShrink={0}
              px={2}
              py="2px"
              borderRadius="4px"
              fontFamily="mono"
              fontSize="10px"
              fontWeight="800"
              bg={pet.mood >= 60 ? "#2f9e44" : pet.mood >= 30 ? "#f59f00" : "#c92a2a"}
              color="#ffffff"
              data-pet-mood={pet.mood}
            >
              {pet.mood}%
            </Box>
          </Flex>
        ),
        run: () => goTo("pet", { petId: pet.id })
      }));
      // A floor click puts that thing first.
      const sortedGround = [...ground].sort((a, b) => (a.id === current.groundId ? -1 : b.id === current.groundId ? 1 : 0));
      return [
        ...sortedGround.map(groundEntry),
        ...petEntries,
        { key: "cancel", label: t("house.action.cancel"), secondary: true, run: () => cancelRef.current() }
      ];
    }
    if (current.phase === "pet") {
      const pet = pets.find((candidate) => candidate.id === current.petId);
      if (!pet) return [{ key: "back", label: t("house.action.back"), secondary: true, run: () => goTo("list") }];
      const entries: Entry[] = [
        { key: "feed", label: `🍓 ${t("pet.action.feed")}`, run: () => goTo("feed") },
        { key: "play", label: `⚽ ${t("pet.action.play")}`, run: () => submit("house:pet-play", { petId: pet.id }) },
        { key: "caress", label: `❤️ ${t("pet.action.caress")}`, run: () => submit("house:pet-caress", { petId: pet.id }) }
      ];
      if (isMine(pet)) {
        entries.push({ key: "take", label: `🎒 ${t("pet.action.take")}`, run: () => submit("house:pet-take", { petId: pet.id }) });
      }
      entries.push({ key: "back", label: t("house.action.back"), secondary: true, run: () => goTo("list") });
      return entries;
    }
    if (current.phase === "feed") {
      return [
        ...berries.map<Entry>((item) => ({
          key: `berry-${item.id}`,
          label: `🍓 ${item.name} ×${item.quantity}`,
          run: () => submit("house:pet-feed", { petId: current.petId, itemId: item.id })
        })),
        { key: "back", label: t("house.action.back"), secondary: true, run: () => goTo("pet") }
      ];
    }
    return [];
  };

  const entries = session ? entriesFor(session) : [];
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // Keyboard navigation.
  useEffect(() => {
    if (!session || session.phase === "loading") return undefined;
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
        if (session.phase === "list") cancelRef.current();
        else if (session.phase === "feed") goTo("pet");
        else goTo("list");
        return;
      }
      const count = entriesRef.current.length;
      if (count === 0) return;
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

  const house = getHouse(mapId);
  const pet = session.petId ? pets.find((candidate) => candidate.id === session.petId) ?? null : null;
  const header = session.phase === "pet" || session.phase === "feed" ? pet?.name ?? t("pet.title") : t("pet.title");
  const subtitle =
    session.phase === "list"
      ? house?.name ?? ""
      : session.phase === "feed"
        ? t("pet.feed.title")
        : pet
          ? `${pet.species} · ${petStateLabel(pet, t)} · ${isMine(pet) ? t("pet.yours") : t("pet.owner", { name: pet.ownerName })}`
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
      data-pet-notice={session.notice.ok ? "ok" : "error"}
    >
      {session.notice.message}
    </Box>
  ) : null;

  const renderBody = () => {
    if (session.phase === "loading") {
      return (
        <Text fontFamily="mono" fontSize="xs" color={MUTED} textAlign="center" fontWeight="600">
          {t("house.window.loading")}
        </Text>
      );
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
          data-pet-result={session.ok ? "ok" : "error"}
        >
          {session.message}
        </Box>
      );
    }
    return (
      <VStack align="stretch" spacing={2}>
        {noticeBox}
        {session.phase === "list" && pets.length === 0 && ground.length === 0 ? (
          <Text fontFamily="mono" fontSize="xs" color={MUTED} textAlign="center" fontWeight="600" whiteSpace="normal" data-pet-empty="1">
            {t("pet.window.empty")}
          </Text>
        ) : null}
        {session.phase === "pet" && pet ? (
          <Box border={`3px solid ${PANEL_BORDER}`} bg="#ffffff" px={3} py={2} data-pet-card={pet.id}>
            <VStack align="stretch" spacing={1}>
              <NeedBar label={t("pet.need.mood")} value={pet.mood} invert />
              <NeedBar label={t("pet.need.hunger")} value={pet.hunger} />
              <NeedBar label={t("pet.need.boredom")} value={pet.boredom} />
              <NeedBar label={t("pet.need.loneliness")} value={pet.loneliness} />
            </VStack>
          </Box>
        ) : null}
        {session.phase === "feed" && berries.length === 0 ? (
          <Text fontFamily="mono" fontSize="xs" color={MUTED} textAlign="center" fontWeight="600" whiteSpace="normal">
            {t("pet.feed.empty")}
          </Text>
        ) : null}
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

  const overlay = (
    <Box position="fixed" inset={0} zIndex={UX_LAYER.SYSTEM_UX} pointerEvents="none" data-game-ux="true" data-pet-menu={session.phase}>
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
        data-pet-window="1"
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
              🐾
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
              data-pet-title="1"
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
              data-pet-close="1"
            >
              ✕
            </Button>
          </Flex>
          {subtitle ? (
            <Text fontFamily="mono" fontSize="xs" color={MUTED} textAlign="center" whiteSpace="normal" fontWeight="600" mb={2}>
              {subtitle}
            </Text>
          ) : null}
          <Box flex="1" minH={0} overflowY="auto" pr="2px" data-pet-body={session.phase}>
            {renderBody()}
          </Box>
          {!compact && session.phase === "list" ? (
            <Box mt={2} pt={2} borderTop="2px dashed #b9b8cc">
              <Text fontFamily="mono" fontSize="10px" color="#8a89a8" textAlign="center" fontWeight="700" whiteSpace="normal">
                {t("pet.window.hint")}
              </Text>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );

  return createPortal(overlay, document.body);
};

export default PetInteractionController;
