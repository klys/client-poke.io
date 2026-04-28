import {
  Badge,
  Box,
  Button,
  Grid,
  HStack,
  Progress,
  SimpleGrid,
  Text,
  VStack
} from "@chakra-ui/react";
import { useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import { AppContext } from "../../../context/appContext";
import type { BattleAction, BattlePublicPokemon, BattlePublicState } from "./battleTypes";

type BattleView = "menu" | "fight" | "bag" | "pokemon";

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

function hpColor(value: number) {
  if (value <= 25) return "red";
  if (value <= 50) return "yellow";
  return "green";
}

function PokemonStatusBox({
  pokemon,
  align = "left"
}: {
  pokemon: BattlePublicPokemon;
  align?: "left" | "right";
}) {
  const hpPercent = pokemon.maxHp > 0 ? (pokemon.hp / pokemon.maxHp) * 100 : 0;

  return (
    <Box
      bg="#fffbea"
      color="#2d2926"
      border="4px solid #464236"
      borderRadius="8px"
      boxShadow="8px 8px 0 rgba(38, 50, 44, 0.45)"
      p={{ base: 3, md: 4 }}
      width={{ base: "min(92vw, 380px)", md: "420px" }}
      justifySelf={align === "right" ? "end" : "start"}
    >
      <HStack justify="space-between" align="center">
        <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="900" noOfLines={1}>
          {pokemon.name}
        </Text>
        <Badge colorScheme="purple" fontSize="0.8rem">Lv {pokemon.level}</Badge>
      </HStack>
      <HStack mt={2} spacing={2}>
        {pokemon.types.map((type) => (
          <Badge key={type} colorScheme="teal">{type}</Badge>
        ))}
      </HStack>
      <HStack mt={3} spacing={2}>
        <Text fontSize="xs" fontWeight="900" color="orange.500">HP</Text>
        <Progress
          value={hpPercent}
          colorScheme={hpColor(hpPercent)}
          height="8px"
          borderRadius="3px"
          flex="1"
          bg="#4b4b4b"
        />
      </HStack>
      <Text mt={2} textAlign="right" fontWeight="800">
        {pokemon.hp}/{pokemon.maxHp}
      </Text>
    </Box>
  );
}

function PokemonSprite({
  pokemon,
  perspective
}: {
  pokemon: BattlePublicPokemon;
  perspective: "back" | "front";
}) {
  const src = perspective === "back"
    ? pokemon.backImageSrc || pokemon.frontImageSrc
    : pokemon.frontImageSrc || pokemon.backImageSrc;

  return (
    <Box
      minH={{ base: "140px", md: "220px" }}
      display="flex"
      alignItems="end"
      justifyContent="center"
    >
      {src ? (
        <img
          src={src}
          alt={pokemon.name}
          style={{
            maxWidth: "min(42vw, 260px)",
            maxHeight: "240px",
            imageRendering: "pixelated",
            objectFit: "contain"
          }}
        />
      ) : (
        <Box
          width={{ base: "120px", md: "190px" }}
          height={{ base: "120px", md: "190px" }}
          borderRadius="50%"
          bg="rgba(255,255,255,0.28)"
          border="3px solid rgba(255,255,255,0.45)"
        />
      )}
    </Box>
  );
}

function ActionButton({
  children,
  onClick,
  isDisabled
}: {
  children: ReactNode;
  onClick: () => void;
  isDisabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      justifyContent="flex-start"
      fontSize={{ base: "lg", md: "2xl" }}
      fontWeight="900"
      color="#3f3f46"
      minH="54px"
      borderRadius="4px"
      _hover={{ bg: "#e8e3df" }}
      isDisabled={isDisabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export default function BattleOverlay() {
  const { socket, battle: rawBattle } = useContext(AppContext);
  const battle = rawBattle as BattlePublicState | null;
  const [view, setView] = useState<BattleView>("menu");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setView("menu");
  }, [battle?.id, battle?.turn]);

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

  if (!battle) {
    return null;
  }

  const sendAction = (action: BattleAction) => {
    if (!battle.canAct) {
      return;
    }

    socket.emit("battle:action", {
      battleId: battle.id,
      action
    });
    setView("menu");
  };

  const activeLog = battle.result ?? battle.log[battle.log.length - 1] ?? `What will ${battle.self.activePokemon.name} do?`;
  const actionDisabled = !battle.canAct || battle.status !== "active";

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={4200}
      data-game-ux="true"
      bg="linear-gradient(180deg, #b9e7ef 0%, #eff8d6 36%, #daf4c2 100%)"
      color="white"
      overflow="hidden"
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
    >
      <Box
        position="absolute"
        inset={0}
        opacity={0.42}
        backgroundImage="repeating-linear-gradient(0deg, rgba(255,255,255,0.56) 0 8px, rgba(151,207,128,0.35) 8px 16px)"
      />
      <Grid
        position="relative"
        zIndex={1}
        templateRows="auto 1fr auto"
        minH="100vh"
        p={{ base: 3, md: 6 }}
        gap={3}
      >
        <Grid templateColumns="1fr 1fr" alignItems="start">
          <PokemonStatusBox pokemon={battle.opponent.activePokemon} />
          <Box textAlign="right">
            {battle.kind === "trainer" && secondsLeft !== null ? (
              <Badge colorScheme={secondsLeft <= 10 ? "red" : "purple"} fontSize="1rem" px={3} py={2}>
                {secondsLeft}s
              </Badge>
            ) : null}
          </Box>
        </Grid>

        <Grid templateColumns="1fr 1fr" alignItems="center">
          <PokemonSprite pokemon={battle.self.activePokemon} perspective="back" />
          <PokemonSprite pokemon={battle.opponent.activePokemon} perspective="front" />
          <Box gridColumn="2" justifySelf="end">
            <PokemonStatusBox pokemon={battle.self.activePokemon} align="right" />
          </Box>
        </Grid>

        <Grid
          templateColumns={{ base: "1fr", md: "1fr 0.96fr" }}
          minH={{ base: "230px", md: "190px" }}
          borderTop="8px solid #3f354f"
          bg="#3f354f"
          gap={2}
        >
          <Box
            bg="#6fa7a4"
            border="6px solid #d94841"
            borderRadius="8px"
            p={{ base: 4, md: 6 }}
            display="flex"
            alignItems="center"
          >
            <Text fontSize={{ base: "xl", md: "3xl" }} fontWeight="900" lineHeight="1.35">
              {battle.waitingForOpponent
                ? "Waiting for the other trainer..."
                : activeLog}
            </Text>
          </Box>

          <Box
            bg="#f8f4f1"
            border="6px solid #746893"
            borderRadius="8px"
            p={{ base: 3, md: 4 }}
            color="#3f3f46"
          >
            {view === "menu" ? (
              <SimpleGrid columns={2} spacing={2} h="100%">
                <ActionButton isDisabled={actionDisabled} onClick={() => setView("fight")}>FIGHT</ActionButton>
                <ActionButton isDisabled={actionDisabled} onClick={() => setView("bag")}>BAG</ActionButton>
                <ActionButton isDisabled={actionDisabled} onClick={() => setView("pokemon")}>POKEMON</ActionButton>
                <ActionButton
                  isDisabled={actionDisabled}
                  onClick={() => sendAction({ type: battle.kind === "trainer" ? "surrender" : "run" })}
                >
                  {battle.kind === "trainer" ? "SURRENDER" : "RUN"}
                </ActionButton>
              </SimpleGrid>
            ) : null}

            {view === "fight" ? (
              <VStack align="stretch" spacing={2}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2}>
                  {battle.self.activePokemon.moves.map((move) => (
                    <Button
                      key={move.id}
                      minH="58px"
                      justifyContent="space-between"
                      borderRadius="4px"
                      colorScheme="purple"
                      variant="outline"
                      isDisabled={move.currentPp <= 0 || actionDisabled}
                      onClick={() => sendAction({ type: "fight", moveId: move.id })}
                    >
                      <Text as="span" noOfLines={1}>{move.name}</Text>
                      <Text as="span" fontSize="xs">PP {move.currentPp}/{move.maxPp}</Text>
                    </Button>
                  ))}
                </SimpleGrid>
                <Button variant="ghost" onClick={() => setView("menu")}>Back</Button>
              </VStack>
            ) : null}

            {view === "bag" ? (
              <VStack align="stretch" spacing={2}>
                {battle.availableItems.length > 0 ? battle.availableItems.map((item) => (
                  <Button
                    key={item.id}
                    minH="54px"
                    justifyContent="space-between"
                    borderRadius="4px"
                    colorScheme="teal"
                    variant="outline"
                    title={item.canUse ? item.description : "This item needs designer battle effects."}
                    isDisabled={!item.canUse || actionDisabled}
                    onClick={() => sendAction({
                      type: "bag",
                      itemId: item.id,
                      targetPokemonId: battle.self.activePokemon.id
                    })}
                  >
                    <Text as="span" noOfLines={1}>{item.name}</Text>
                    <Text as="span" fontSize="xs">x{item.quantity}</Text>
                  </Button>
                )) : (
                  <Text color="gray.500" fontWeight="800">No usable items.</Text>
                )}
                <Button variant="ghost" onClick={() => setView("menu")}>Back</Button>
              </VStack>
            ) : null}

            {view === "pokemon" ? (
              <VStack align="stretch" spacing={2}>
                {battle.self.party.map((pokemon) => (
                  <Button
                    key={pokemon.id}
                    minH="54px"
                    justifyContent="space-between"
                    borderRadius="4px"
                    colorScheme="orange"
                    variant={pokemon.id === battle.self.activePokemon.id ? "solid" : "outline"}
                    isDisabled={pokemon.id === battle.self.activePokemon.id || pokemon.hp <= 0 || actionDisabled}
                    onClick={() => sendAction({ type: "pokemon", pokemonId: pokemon.id })}
                  >
                    <Text as="span" noOfLines={1}>{pokemon.name}</Text>
                    <Text as="span" fontSize="xs">HP {pokemon.hp}/{pokemon.maxHp}</Text>
                  </Button>
                ))}
                <Button variant="ghost" onClick={() => setView("menu")}>Back</Button>
              </VStack>
            ) : null}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
