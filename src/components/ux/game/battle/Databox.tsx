import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import type { BattlePublicPokemon } from "../battleTypes";
import { STATUS_BADGES, type BattleStatusId } from "./battleEvents";
import type { BattleInterfaceConfig } from "./battleInterfaceConfig";
import { getPokemonDisplayName } from "../pokemonName";

function hpBarColor(percent: number) {
  if (percent <= 25) return "#e84b3c";
  if (percent <= 50) return "#f4c034";
  return "#4cc95e";
}

/**
 * Essentials-style databox: name + level (+ status), animated HP bar, HP
 * numbers and EXP bar on the player's side only.
 */
export default function Databox({
  pokemon,
  side,
  config,
  hpOverride,
  expOverride,
  levelOverride,
  statusOverride
}: {
  pokemon: BattlePublicPokemon;
  side: "player" | "enemy";
  config: BattleInterfaceConfig;
  hpOverride?: { hp: number; maxHp: number };
  expOverride?: { experience: number; nextLevelExperience: number };
  levelOverride?: number;
  statusOverride?: BattleStatusId | null;
}) {
  const hp = hpOverride?.hp ?? pokemon.hp;
  const maxHp = hpOverride?.maxHp ?? pokemon.maxHp;
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const level = levelOverride ?? pokemon.level;
  const status = statusOverride !== undefined ? statusOverride : pokemon.status ?? null;
  const experience = expOverride?.experience ?? pokemon.experience ?? 0;
  const nextLevelExperience = expOverride?.nextLevelExperience ?? pokemon.nextLevelExperience ?? 0;
  const expPercent =
    nextLevelExperience > 0
      ? Math.max(0, Math.min(100, (experience / nextLevelExperience) * 100))
      : level >= 100
        ? 100
        : 0;
  const isPlayer = side === "player";

  return (
    <Box
      bg={isPlayer ? config.databoxPlayerColor : config.databoxEnemyColor}
      color={config.databoxTextColor}
      border="3px solid #55524a"
      borderRadius={isPlayer ? "14px 4px 4px 14px" : "4px 14px 14px 4px"}
      boxShadow="4px 4px 0 rgba(30, 30, 30, 0.35)"
      px={{ base: 2.5, md: 4 }}
      py={{ base: 1.5, md: 2.5 }}
      width={{ base: "min(88vw, 320px)", sm: "min(44vw, 340px)", md: "380px" }}
      fontFamily="'Segoe UI', system-ui, sans-serif"
    >
      <HStack justify="space-between" align="center" spacing={2}>
        <HStack spacing={2} minW={0}>
          <Text fontSize={{ base: "sm", md: "lg" }} fontWeight="900" noOfLines={1}>
            {getPokemonDisplayName(pokemon)}
          </Text>
          {status ? (
            <Badge
              bg={STATUS_BADGES[status].color}
              color="white"
              fontSize="0.62rem"
              borderRadius="4px"
              px={1.5}
            >
              {STATUS_BADGES[status].label}
            </Badge>
          ) : null}
          {pokemon.confused ? (
            <Badge bg="#c56cd6" color="white" fontSize="0.62rem" borderRadius="4px" px={1.5}>
              CNF
            </Badge>
          ) : null}
        </HStack>
        <Text fontSize={{ base: "sm", md: "md" }} fontWeight="900" whiteSpace="nowrap">
          Lv{level}
        </Text>
      </HStack>

      <HStack mt={1.5} spacing={1.5} align="center">
        <Text fontSize="0.6rem" fontWeight="900" color="#e8a33d" letterSpacing="0.06em">
          HP
        </Text>
        <Box flex="1" h="10px" bg="#57534a" borderRadius="5px" border="1px solid #3d3a33" overflow="hidden">
          <Box
            h="100%"
            width={`${hpPercent}%`}
            bg={hpBarColor(hpPercent)}
            borderRadius="5px"
            transition="width 0.45s ease, background-color 0.45s ease"
          />
        </Box>
      </HStack>

      {isPlayer ? (
        <>
          <Text mt={0.5} textAlign="right" fontWeight="800" fontSize={{ base: "xs", md: "sm" }}>
            {hp}/{maxHp}
          </Text>
          <HStack mt={0.5} spacing={1.5} align="center">
            <Text fontSize="0.55rem" fontWeight="900" color="#4f9be8" letterSpacing="0.06em">
              EXP
            </Text>
            <Box flex="1" h="5px" bg="#57534a" borderRadius="3px" overflow="hidden">
              <Box
                h="100%"
                width={`${expPercent}%`}
                bg="#43b0e8"
                transition="width 0.6s ease"
              />
            </Box>
          </HStack>
        </>
      ) : null}
    </Box>
  );
}
