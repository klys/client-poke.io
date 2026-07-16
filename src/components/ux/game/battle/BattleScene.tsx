import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  SimpleGrid,
  Text,
  VStack,
  keyframes
} from "@chakra-ui/react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, ReactNode, RefObject, SyntheticEvent } from "react";
import { useGameSettings } from "../../../../settings/gameSettings";
import { useT } from "../../../../i18n";
import { AppContext } from "../../../../context/appContext";
import { resolveServerAssetUrl } from "../../../tilemap/serverAssets";
import type {
  BattleAction,
  BattlePublicItem,
  BattlePublicPokemon,
  BattlePublicState
} from "../battleTypes";
import { getPokemonDisplayName } from "../pokemonName";
import type { BattleSequencedEvent } from "./battleEvents";
import BattleIntro from "./BattleIntro";
import Databox from "./Databox";
import EvolutionScreen from "./EvolutionScreen";
import LevelUpWindow from "./LevelUpWindow";
import MoveAnimationPlayer from "./MoveAnimationPlayer";
import MoveLearnPrompt from "./MoveLearnPrompt";
import { readBattleBackgroundImages, useBattleInterfaceConfig } from "./battleInterfaceConfig";
import { useBattleEventQueue, type BattleSpriteFx } from "./useBattleEventQueue";

type BattleView = "menu" | "fight" | "bag" | "bagTarget" | "pokemon";

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * D-pad / keyboard navigation across the battle UI.
 *
 * The battle scene is pointer-driven; controllers reach it through the same
 * synthesized KeyboardEvents the gamepad bridges emit (GamepadControls.tsx,
 * the Electron preload): arrows walk the visible enabled buttons, Confirm
 * (Enter) presses the highlighted one, Cancel (Escape) backs out of a
 * sub-menu via `backRef`. Works for the physical keyboard too.
 *
 * Selection is DOM-driven on purpose — buttons come and go per view (moves,
 * bag, party), so we walk what is actually on screen instead of mirroring
 * every view's layout in state. Native Enter on a focused button already
 * clicks (trusted events), so only synthetic presses click manually.
 */
function useBattlePadNavigation(
  rootRef: RefObject<HTMLDivElement>,
  active: boolean,
  backRef: MutableRefObject<() => boolean>
) {
  useEffect(() => {
    if (!active) {
      return;
    }

    let highlighted: HTMLButtonElement | null = null;

    const clearHighlight = () => {
      if (highlighted) {
        highlighted.style.outline = "";
        highlighted.style.outlineOffset = "";
        highlighted = null;
      }
    };

    const visibleButtons = () => {
      const root = rootRef.current;
      if (!root) return [] as HTMLButtonElement[];
      return (Array.from(root.querySelectorAll("button")) as HTMLButtonElement[]).filter(
        (button) => !button.disabled && button.offsetParent !== null
      );
    };

    const highlight = (button: HTMLButtonElement) => {
      clearHighlight();
      highlighted = button;
      button.style.outline = "3px solid rgba(255,255,255,0.95)";
      button.style.outlineOffset = "1px";
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const currentIndex = (list: HTMLButtonElement[]) => {
      const activeEl = document.activeElement as HTMLButtonElement | null;
      if (activeEl && list.includes(activeEl)) return list.indexOf(activeEl);
      if (highlighted && list.includes(highlighted)) return list.indexOf(highlighted);
      return -1;
    };

    // First arrow press lands on the command area (FIGHT/BAG/...), not the
    // LOG toggle that happens to come first in DOM order.
    const preferredIndex = (list: HTMLButtonElement[]) => {
      const commands = rootRef.current?.querySelector('[data-battle-commands="true"]');
      if (commands) {
        const first = list.findIndex((button) => commands.contains(button));
        if (first >= 0) return first;
      }
      return 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      if (key === "ArrowRight" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowUp") {
        const list = visibleButtons();
        if (list.length === 0) return;
        event.preventDefault();
        const forward = key === "ArrowRight" || key === "ArrowDown";
        const index = currentIndex(list);
        const next =
          index === -1 ? preferredIndex(list) : (index + (forward ? 1 : -1) + list.length) % list.length;
        highlight(list[next]);
        return;
      }

      if (key === "Enter") {
        // Trusted Enter on a focused button clicks natively; synthetic
        // (gamepad-bridge) events need the click dispatched by hand.
        if (event.isTrusted) return;
        const list = visibleButtons();
        const index = currentIndex(list);
        if (index >= 0) list[index].click();
        return;
      }

      if (key === "Escape") {
        if (backRef.current()) {
          event.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearHighlight();
    };
  }, [active, rootRef, backRef]);
}

const attackLungePlayer = keyframes`
  0% { transform: translate(0, 0); }
  40% { transform: translate(34px, -18px); }
  100% { transform: translate(0, 0); }
`;

const attackLungeEnemy = keyframes`
  0% { transform: translate(0, 0); }
  40% { transform: translate(-34px, 18px); }
  100% { transform: translate(0, 0); }
`;

const hitShake = keyframes`
  0%, 100% { transform: translateX(0); opacity: 1; }
  20% { transform: translateX(-9px); opacity: 0.35; }
  40% { transform: translateX(8px); opacity: 1; }
  60% { transform: translateX(-6px); opacity: 0.35; }
  80% { transform: translateX(5px); opacity: 1; }
`;

const faintDrop = keyframes`
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(70px); opacity: 0; }
`;

const enterRise = keyframes`
  0% { transform: translateY(26px) scale(0.6); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
`;

const ballWobble = keyframes`
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-22deg); }
  75% { transform: rotate(22deg); }
`;

function spriteFxAnimation(fx: BattleSpriteFx, isPlayerSide: boolean) {
  switch (fx) {
    case "attack":
      return `${isPlayerSide ? attackLungePlayer : attackLungeEnemy} 0.55s ease`;
    case "hit":
      return `${hitShake} 0.55s linear`;
    case "faint":
      return `${faintDrop} 0.8s ease-in forwards`;
    case "enter":
      return `${enterRise} 0.55s ease-out`;
    default:
      return undefined;
  }
}

function TypewriterText({
  text,
  msPerChar,
  color
}: {
  text: string;
  msPerChar: number;
  color: string;
}) {
  const [visibleCount, setVisibleCount] = useState(text.length);
  const previousTextRef = useRef(text);

  useEffect(() => {
    if (previousTextRef.current === text) {
      return;
    }

    previousTextRef.current = text;
    if (msPerChar <= 0) {
      setVisibleCount(text.length);
      return;
    }

    setVisibleCount(0);
    const interval = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= text.length) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, msPerChar);

    return () => window.clearInterval(interval);
  }, [text, msPerChar]);

  return (
    <Text
      color={color}
      fontWeight="800"
      fontSize={{ base: "md", md: "xl" }}
      lineHeight="1.35"
      whiteSpace="pre-wrap"
    >
      {text.slice(0, visibleCount)}
    </Text>
  );
}

/** Fixed-size, responsive battle log (replaces the old ever-growing window). */
function BattleLogPanel({
  logs,
  rows,
  onClose
}: {
  logs: string[];
  rows: number;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = 26;

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [logs.length]);

  return (
    <Box
      position="absolute"
      right={{ base: "6px", md: "16px" }}
      bottom={{ base: "150px", md: "186px" }}
      zIndex={24}
      width={{ base: "min(92vw, 330px)", md: "400px" }}
      bg="rgba(24, 28, 38, 0.94)"
      border="2px solid rgba(255,255,255,0.28)"
      borderRadius="8px"
      p={2.5}
      onClick={stopUxEvent}
    >
      <HStack justify="space-between" mb={1.5}>
        <Text fontSize="xs" fontWeight="900" color="teal.200" letterSpacing="0.08em">
          BATTLE LOG
        </Text>
        <Button size="xs" variant="ghost" color="white" onClick={onClose}>
          Close
        </Button>
      </HStack>
      <Box
        ref={scrollRef}
        height={`${rows * rowHeight}px`}
        overflowY="auto"
        overscrollBehavior="contain"
        pr={1}
      >
        {logs.map((entry, index) => (
          <Text
            key={`${index}-${entry.slice(0, 24)}`}
            color="whiteAlpha.900"
            fontSize="sm"
            fontWeight="600"
            lineHeight={`${rowHeight}px`}
            noOfLines={1}
          >
            {entry}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function MenuButton({
  children,
  onClick,
  isDisabled,
  colorScheme = "gray"
}: {
  children: ReactNode;
  onClick: () => void;
  isDisabled?: boolean;
  colorScheme?: string;
}) {
  return (
    <Button
      colorScheme={colorScheme}
      variant="solid"
      fontWeight="900"
      fontSize={{ base: "md", md: "lg" }}
      minH={{ base: "44px", md: "52px" }}
      borderRadius="6px"
      border="2px solid rgba(0,0,0,0.35)"
      isDisabled={isDisabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

const TYPE_COLORS: Record<string, string> = {
  NORMAL: "#a8a878", FIRE: "#f08030", WATER: "#6890f0", ELECTRIC: "#f8d030",
  GRASS: "#78c850", ICE: "#98d8d8", FIGHTING: "#c03028", POISON: "#a040a0",
  GROUND: "#e0c068", FLYING: "#a890f0", PSYCHIC: "#f85888", BUG: "#a8b820",
  ROCK: "#b8a038", GHOST: "#705898", DRAGON: "#7038f8", DARK: "#705848",
  STEEL: "#b8b8d0", FAIRY: "#ee99ac"
};

function typeColor(type: string) {
  return TYPE_COLORS[type.trim().toUpperCase()] ?? "#68a090";
}

export default function BattleScene() {
  const { socket, battle: rawBattle, battleEvents, clearBattle } = useContext(AppContext);
  const battle = rawBattle as BattlePublicState | null;
  const events = (battleEvents ?? []) as BattleSequencedEvent[];
  const config = useBattleInterfaceConfig();
  const [gameSettings] = useGameSettings();
  const t = useT();
  const [view, setView] = useState<BattleView>("menu");
  const [selectedItem, setSelectedItem] = useState<BattlePublicItem | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const selfSideId = battle?.self.id ?? null;
  const { playback, dismissLevelUp, dismissLearnPrompt } = useBattleEventQueue({
    battle,
    events,
    config,
    selfSideId
  });

  useEffect(() => {
    setView("menu");
    setSelectedItem(null);
  }, [battle?.id, battle?.turn]);

  const mustReplace = Boolean(battle?.mustSelectReplacement) && battle?.status === "active";
  const queueBusy = playback.queueBusy;

  // Controller navigation (see useBattlePadNavigation). The back handler
  // mirrors the on-screen Back buttons: bag-target returns to the bag, other
  // sub-views return to the command menu, and a forced replacement pick
  // cannot be escaped.
  const navRootRef = useRef<HTMLDivElement>(null);
  const navBackRef = useRef<() => boolean>(() => false);
  navBackRef.current = () => {
    if (view === "bagTarget") {
      setView("bag");
      return true;
    }
    if (view === "fight" || view === "bag" || (view === "pokemon" && !mustReplace)) {
      setView("menu");
      return true;
    }
    return false;
  };
  useBattlePadNavigation(navRootRef, Boolean(battle), navBackRef);

  // A fainted active mon forces the switch panel open until a replacement is picked.
  useEffect(() => {
    if (mustReplace && !queueBusy && view !== "pokemon") {
      setView("pokemon");
      setSelectedItem(null);
    }
  }, [mustReplace, queueBusy, view]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!battle?.turnEndsAt) {
      return null;
    }
    return Math.max(0, Math.ceil((new Date(battle.turnEndsAt).getTime() - now) / 1000));
  }, [battle?.turnEndsAt, now]);

  const backgroundImages = useMemo(() => readBattleBackgroundImages(config), [config]);

  if (!battle) {
    return null;
  }

  const sendAction = (action: BattleAction) => {
    const canSendReplacement = mustReplace && action.type === "pokemon";
    if (!battle.canAct && !canSendReplacement) {
      return;
    }

    socket.emit("battle:action", { battleId: battle.id, action });
    setView("menu");
    setSelectedItem(null);
  };

  const resolveLearnPrompt = (pokemonId: string) => (moveName: string, replaceMoveName: string | null) => {
    socket.emit("battle:learn-move", {
      pokemonId,
      moveName,
      ...(replaceMoveName ? { replaceMoveName } : {})
    });
    dismissLearnPrompt(pokemonId, moveName);
  };

  const selfPokemon = battle.self.activePokemon;
  const enemyPokemon = battle.opponent.activePokemon;
  const selfIsA = battle.self.id === "a";
  const fxForSelf = playback.spriteFx[battle.self.id];
  const fxForEnemy = playback.spriteFx[battle.opponent.id];
  const actionDisabled = !battle.canAct || battle.status !== "active" || playback.queueBusy;
  const switchDisabled = battle.status !== "active"
    || playback.queueBusy
    || (!battle.canAct && !mustReplace);
  const idleMessage = battle.result
    ?? (mustReplace
      ? "Choose your next Venomon."
      : battle.waitingForOpponent
        ? "Waiting for the other trainer..."
        : `What will ${getPokemonDisplayName(selfPokemon)} do?`);
  const message = playback.message ?? idleMessage;
  const showCommandMenu = !playback.queueBusy && battle.status === "active" && battle.canAct;
  const enemyBallVisible = playback.catchPlayback !== null || playback.enemyCaught;
  // A battler disappears only after its faint drop has fully played (the
  // queue sets the flag then), and a caught mon stays inside the ball.
  const selfHidden = playback.fainted[battle.self.id];
  const enemyHidden = playback.enemyCaught || playback.fainted[battle.opponent.id];
  const showEndConfirm = battle.status === "ended" && !playback.queueBusy;

  const renderSprite = (
    pokemon: BattlePublicPokemon,
    perspective: "back" | "front",
    fx: BattleSpriteFx,
    hidden: boolean
  ) => {
    const src = resolveServerAssetUrl(
      perspective === "back"
        ? pokemon.backImageSrc || pokemon.frontImageSrc
        : pokemon.frontImageSrc || pokemon.backImageSrc
    );

    if (hidden) {
      return null;
    }

    return src ? (
      <img
        src={src}
        alt={getPokemonDisplayName(pokemon)}
        style={{
          maxWidth: perspective === "back" ? "min(52vw, 300px)" : "min(40vw, 240px)",
          maxHeight: perspective === "back" ? "min(30vh, 280px)" : "min(26vh, 230px)",
          imageRendering: "pixelated",
          objectFit: "contain"
        }}
      />
    ) : (
      <Box
        width={{ base: "110px", md: "170px" }}
        height={{ base: "110px", md: "170px" }}
        borderRadius="50%"
        bg="rgba(255,255,255,0.25)"
        border="3px solid rgba(255,255,255,0.4)"
      />
    );
  };

  const messageWindowHeight = { base: `${86 + config.messageRows * 22}px`, md: `${96 + config.messageRows * 26}px` };

  return (
    <Box
      ref={navRootRef}
      // Settings -> Display -> Battle interface size. zoom scales the px-sized
      // UI (databoxes, message window, menus) while %/vw layout stays fluid.
      style={{ zoom: gameSettings.uiScale.battle } as CSSProperties}
      position="fixed"
      inset={0}
      zIndex={4200}
      data-game-ux="true"
      bg={
        backgroundImages.backgroundSrc
          ? undefined
          : "linear-gradient(180deg, #8fd3e8 0%, #cdeec3 58%, #9ed88f 100%)"
      }
      backgroundImage={backgroundImages.backgroundSrc ? `url(${backgroundImages.backgroundSrc})` : undefined}
      backgroundSize="cover"
      backgroundPosition="center"
      overflow="hidden"
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
    >
      {/* Enemy base + battler */}
      <Box
        position="absolute"
        right={{ base: "4%", md: "10%" }}
        top={{ base: "13%", md: "12%" }}
        width={{ base: "46%", md: "34%" }}
        display="flex"
        alignItems="flex-end"
        justifyContent="center"
      >
        <Box
          position="absolute"
          bottom="-6px"
          width="100%"
          height={{ base: "36px", md: "54px" }}
          borderRadius="50%"
          bg="rgba(60, 90, 60, 0.35)"
          backgroundImage={backgroundImages.enemyBaseSrc ? `url(${backgroundImages.enemyBaseSrc})` : undefined}
          backgroundSize="100% 100%"
        />
        <Box position="relative" animation={spriteFxAnimation(fxForEnemy, false)}>
          {enemyBallVisible ? (
            <Box
              width={{ base: "40px", md: "52px" }}
              height={{ base: "40px", md: "52px" }}
              borderRadius="50%"
              bg="linear-gradient(180deg, #e84b3c 0 46%, #26262b 46% 56%, #f2f2f2 56% 100%)"
              border="3px solid #26262b"
              animation={
                playback.catchPlayback && playback.catchPlayback.stage > 0
                  ? `${ballWobble} 0.55s ease`
                  : undefined
              }
              key={playback.catchPlayback?.stage ?? 0}
            />
          ) : (
            renderSprite(enemyPokemon, "front", fxForEnemy, enemyHidden)
          )}
        </Box>
        {playback.activeAnimation && playback.activeAnimation.targetSideId === battle.opponent.id ? (
          <MoveAnimationPlayer
            key={playback.activeAnimation.key}
            gfx={playback.activeAnimation.gfx}
            animationSpeed={config.animationSpeed}
            onFinished={() => undefined}
          />
        ) : null}
      </Box>

      {/* Player base + battler */}
      <Box
        position="absolute"
        left={{ base: "2%", md: "8%" }}
        bottom={messageWindowHeight}
        mb={{ base: "6px", md: "14px" }}
        width={{ base: "52%", md: "38%" }}
        display="flex"
        alignItems="flex-end"
        justifyContent="center"
      >
        <Box
          position="absolute"
          bottom="-8px"
          width="100%"
          height={{ base: "40px", md: "62px" }}
          borderRadius="50%"
          bg="rgba(60, 90, 60, 0.4)"
          backgroundImage={backgroundImages.playerBaseSrc ? `url(${backgroundImages.playerBaseSrc})` : undefined}
          backgroundSize="100% 100%"
        />
        <Box position="relative" animation={spriteFxAnimation(fxForSelf, true)}>
          {renderSprite(selfPokemon, "back", fxForSelf, selfHidden)}
        </Box>
        {playback.activeAnimation && playback.activeAnimation.targetSideId === battle.self.id ? (
          <MoveAnimationPlayer
            key={playback.activeAnimation.key}
            gfx={playback.activeAnimation.gfx}
            animationSpeed={config.animationSpeed}
            onFinished={() => undefined}
          />
        ) : null}
      </Box>

      {/* Databoxes */}
      <Box position="absolute" left={{ base: "6px", md: "20px" }} top={{ base: "8px", md: "20px" }}>
        <Databox
          pokemon={enemyPokemon}
          side="enemy"
          config={config}
          hpOverride={playback.displayHp[enemyPokemon.id]}
          levelOverride={playback.displayLevel[enemyPokemon.id]}
          statusOverride={
            enemyPokemon.id in playback.displayStatus
              ? playback.displayStatus[enemyPokemon.id]
              : undefined
          }
        />
      </Box>
      <Box
        position="absolute"
        right={{ base: "6px", md: "20px" }}
        bottom={messageWindowHeight}
        mb={{ base: "6px", md: "14px" }}
      >
        <Databox
          pokemon={selfPokemon}
          side="player"
          config={config}
          hpOverride={playback.displayHp[selfPokemon.id]}
          expOverride={playback.displayExp[selfPokemon.id]}
          levelOverride={playback.displayLevel[selfPokemon.id]}
          statusOverride={
            selfPokemon.id in playback.displayStatus
              ? playback.displayStatus[selfPokemon.id]
              : undefined
          }
        />
      </Box>

      {/* Turn timer + log toggle */}
      <HStack position="absolute" top={{ base: "8px", md: "20px" }} right={{ base: "6px", md: "20px" }} spacing={2}>
        {battle.kind === "trainer" && secondsLeft !== null ? (
          <Badge colorScheme={secondsLeft <= 10 ? "red" : "purple"} fontSize="0.9rem" px={3} py={1.5}>
            {secondsLeft}s
          </Badge>
        ) : null}
        {config.showBattleLog ? (
          <Button size="sm" variant="solid" colorScheme="blackAlpha" onClick={() => setLogOpen((open) => !open)}>
            {t('battle.log')}
          </Button>
        ) : null}
      </HStack>

      {logOpen && config.showBattleLog ? (
        <BattleLogPanel logs={battle.log} rows={config.logRows} onClose={() => setLogOpen(false)} />
      ) : null}

      {/* Message window + command menus */}
      <Grid
        data-battle-commands="true"
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        height={messageWindowHeight}
        templateColumns={showCommandMenu && view === "menu" ? { base: "1fr 46%", md: "1fr 34%" } : "1fr"}
        bg={config.messageBoxColor}
        borderTop={`4px solid ${config.messageBoxBorderColor}`}
        p={{ base: 2, md: 3 }}
        gap={2}
      >
        <Box
          border={`2px solid ${config.messageBoxBorderColor}`}
          borderRadius="8px"
          px={{ base: 3, md: 5 }}
          py={{ base: 2, md: 3 }}
          overflow="hidden"
          display={view === "menu" ? "block" : "none"}
        >
          <TypewriterText
            text={message}
            msPerChar={playback.queueBusy ? config.textSpeedMsPerChar : 0}
            color={config.messageBoxTextColor}
          />
          {showEndConfirm ? (
            <Flex justify="flex-end" mt={1}>
              <Button
                size="sm"
                colorScheme="blue"
                fontWeight="900"
                border="2px solid rgba(0,0,0,0.35)"
                onClick={() => clearBattle()}
              >
                {t('battle.ok')}
              </Button>
            </Flex>
          ) : null}
        </Box>

        {showCommandMenu && view === "menu" ? (
          <SimpleGrid columns={2} spacing={1.5}>
            <MenuButton colorScheme="red" onClick={() => setView("fight")}>{t('battle.fight')}</MenuButton>
            <MenuButton colorScheme="yellow" onClick={() => setView("bag")}>{t('battle.bag')}</MenuButton>
            <MenuButton colorScheme="green" onClick={() => setView("pokemon")}>{t('battle.pokemon')}</MenuButton>
            <MenuButton
              colorScheme="blue"
              onClick={() => sendAction({ type: battle.kind === "trainer" ? "surrender" : "run" })}
            >
              {battle.kind === "trainer" ? t('battle.giveUp') : t('battle.run')}
            </MenuButton>
          </SimpleGrid>
        ) : null}

        {view === "fight" ? (
          <Grid templateColumns={{ base: "1fr", sm: "1fr auto" }} gap={2} overflow="hidden">
            <SimpleGrid columns={2} spacing={1.5}>
              {selfPokemon.moves.map((move) => (
                <Button
                  key={move.id}
                  size="sm"
                  minH={{ base: "40px", md: "48px" }}
                  justifyContent="space-between"
                  bg={typeColor(move.type)}
                  color="white"
                  border="2px solid rgba(0,0,0,0.35)"
                  _hover={{ filter: "brightness(1.12)" }}
                  isDisabled={move.currentPp <= 0 || actionDisabled}
                  onClick={() => sendAction({ type: "fight", moveId: move.id })}
                >
                  <Text as="span" noOfLines={1} fontWeight="900">{move.name}</Text>
                  <Text as="span" fontSize="xs" fontWeight="800">
                    {move.currentPp}/{move.maxPp}
                  </Text>
                </Button>
              ))}
              {selfPokemon.moves.length === 0 ? (
                <Text color={config.messageBoxTextColor} fontWeight="800">
                  {t('battle.noMoves')}
                </Text>
              ) : null}
            </SimpleGrid>
            <VStack justify="center" spacing={1}>
              <Button size="sm" variant="outline" color={config.messageBoxTextColor} onClick={() => setView("menu")}>
                {t('battle.back')}
              </Button>
            </VStack>
          </Grid>
        ) : null}

        {view === "bag" ? (
          <Box overflowY="auto" overscrollBehavior="contain">
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={1.5}>
              {battle.availableItems.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  justifyContent="space-between"
                  colorScheme="teal"
                  variant="solid"
                  title={item.canUse ? item.description : t('battle.itemLocked')}
                  isDisabled={!item.canUse || actionDisabled}
                  onClick={() => {
                    if (item.category === "usable" || item.category === "berries") {
                      setSelectedItem(item);
                      setView("bagTarget");
                    } else {
                      sendAction({ type: "bag", itemId: item.id });
                    }
                  }}
                >
                  <Text as="span" noOfLines={1}>{item.name}</Text>
                  <Text as="span" fontSize="xs">x{item.quantity}</Text>
                </Button>
              ))}
              {battle.availableItems.length === 0 ? (
                <Text color={config.messageBoxTextColor} fontWeight="800">{t('battle.noItems')}</Text>
              ) : null}
            </SimpleGrid>
            <Button mt={2} size="sm" variant="outline" color={config.messageBoxTextColor} onClick={() => setView("menu")}>
              {t('battle.back')}
            </Button>
          </Box>
        ) : null}

        {view === "bagTarget" ? (
          <Box overflowY="auto" overscrollBehavior="contain">
            <Text color={config.messageBoxTextColor} fontWeight="900" mb={1.5}>
              {t('battle.useOn', { name: selectedItem?.name ?? 'item' })}
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={1.5}>
              {battle.self.party.map((pokemon) => (
                <Button
                  key={pokemon.id}
                  size="sm"
                  justifyContent="space-between"
                  colorScheme="teal"
                  variant={pokemon.id === selfPokemon.id ? "solid" : "outline"}
                  color={pokemon.id === selfPokemon.id ? undefined : config.messageBoxTextColor}
                  isDisabled={!selectedItem || actionDisabled}
                  onClick={() => {
                    if (selectedItem) {
                      sendAction({ type: "bag", itemId: selectedItem.id, targetPokemonId: pokemon.id });
                    }
                  }}
                >
                  <Text as="span" noOfLines={1}>{getPokemonDisplayName(pokemon)}</Text>
                  <Text as="span" fontSize="xs">{pokemon.hp}/{pokemon.maxHp}</Text>
                </Button>
              ))}
            </SimpleGrid>
            <Button mt={2} size="sm" variant="outline" color={config.messageBoxTextColor} onClick={() => setView("bag")}>
              {t('battle.back')}
            </Button>
          </Box>
        ) : null}

        {view === "pokemon" ? (
          <Box overflowY="auto" overscrollBehavior="contain">
            {mustReplace ? (
              <Text color={config.messageBoxTextColor} fontWeight="900" mb={1.5}>
                {t('battle.chooseNext')}
              </Text>
            ) : null}
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={1.5}>
              {battle.self.party.map((pokemon) => (
                <Button
                  key={pokemon.id}
                  size="sm"
                  justifyContent="space-between"
                  colorScheme="orange"
                  variant={pokemon.id === selfPokemon.id ? "solid" : "outline"}
                  color={pokemon.id === selfPokemon.id ? undefined : config.messageBoxTextColor}
                  isDisabled={pokemon.id === selfPokemon.id || pokemon.hp <= 0 || switchDisabled}
                  onClick={() => sendAction({ type: "pokemon", pokemonId: pokemon.id })}
                >
                  <Text as="span" noOfLines={1}>{getPokemonDisplayName(pokemon)}</Text>
                  <Text as="span" fontSize="xs">{pokemon.hp}/{pokemon.maxHp}</Text>
                </Button>
              ))}
            </SimpleGrid>
            {!mustReplace ? (
              <Button mt={2} size="sm" variant="outline" color={config.messageBoxTextColor} onClick={() => setView("menu")}>
                {t('battle.back')}
              </Button>
            ) : null}
          </Box>
        ) : null}
      </Grid>

      {/* Overlays */}
      {playback.activeLevelUp ? (
        <LevelUpWindow levelUp={playback.activeLevelUp} onDismiss={dismissLevelUp} />
      ) : null}
      {playback.learnPrompts.map((prompt) => (
        <MoveLearnPrompt
          key={`${prompt.pokemonId}-${prompt.moveName}`}
          prompt={prompt}
          onResolve={resolveLearnPrompt(prompt.pokemonId)}
        />
      ))}
      {playback.activeEvolution ? <EvolutionScreen evolution={playback.activeEvolution} /> : null}
      {playback.introPlaying ? <BattleIntro config={config} /> : null}

      {/* Battle summary */}
      {battle.summary && !playback.queueBusy && !playback.activeEvolution ? (
        <Box
          position="absolute"
          left="50%"
          top="42%"
          transform="translate(-50%, -50%)"
          zIndex={35}
          width={{ base: "calc(100vw - 32px)", sm: "440px" }}
          bg="rgba(17, 24, 39, 0.96)"
          border="1px solid rgba(255,255,255,0.2)"
          borderRadius="10px"
          boxShadow="0 24px 70px rgba(0,0,0,0.48)"
          p={5}
          color="white"
        >
          <Text fontSize="xs" color="teal.200" fontWeight="900">{t('battle.result')}</Text>
          <Text mt={2} fontSize="xl" fontWeight="900">{battle.summary.result}</Text>
          <SimpleGrid mt={3} columns={2} spacing={3}>
            <Box bg="whiteAlpha.100" borderRadius="8px" p={3}>
              <Text fontSize="xs" color="gray.300">{t('battle.winner')}</Text>
              <Text fontWeight="800">{battle.summary.winnerName ?? "—"}</Text>
            </Box>
            <Box bg="whiteAlpha.100" borderRadius="8px" p={3}>
              <Text fontSize="xs" color="gray.300">{t('battle.loser')}</Text>
              <Text fontWeight="800">{battle.summary.loserName ?? "—"}</Text>
            </Box>
          </SimpleGrid>
        </Box>
      ) : null}

    </Box>
  );
}
