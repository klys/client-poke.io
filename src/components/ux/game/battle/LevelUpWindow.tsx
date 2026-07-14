import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { STAT_DISPLAY_NAMES, type BattleStatKey } from "./battleEvents";
import type { ActiveLevelUp } from "./useBattleEventQueue";

const STAT_ORDER: BattleStatKey[] = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed"
];

/**
 * Classic level-up window: shows how many points each stat grew for this
 * level (species growth rules) and the resulting totals.
 */
export default function LevelUpWindow({
  levelUp,
  onDismiss
}: {
  levelUp: ActiveLevelUp;
  onDismiss: () => void;
}) {
  return (
    <Box
      position="absolute"
      right={{ base: "8px", md: "24px" }}
      bottom={{ base: "150px", md: "190px" }}
      zIndex={30}
      bg="#f8f4e8"
      color="#3a3a32"
      border="3px solid #55524a"
      borderRadius="10px"
      boxShadow="6px 6px 0 rgba(30,30,30,0.4)"
      px={4}
      py={3}
      minW={{ base: "230px", md: "270px" }}
      onClick={onDismiss}
      cursor="pointer"
    >
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="900" fontSize="md" noOfLines={1}>
          {levelUp.pokemonName}
        </Text>
        <Text fontWeight="900" fontSize="md" color="#c2551f">
          Lv{levelUp.level}!
        </Text>
      </HStack>
      <VStack spacing={0.5} align="stretch">
        {STAT_ORDER.map((stat) => {
          const gain = levelUp.statGains[stat];
          if (!gain) {
            return null;
          }
          return (
            <HStack key={stat} justify="space-between" fontSize="sm">
              <Text fontWeight="700">{STAT_DISPLAY_NAMES[stat]}</Text>
              <HStack spacing={3}>
                <Text fontWeight="900" color="#2f855a" minW="34px" textAlign="right">
                  +{gain.gain}
                </Text>
                <Text fontWeight="800" minW="34px" textAlign="right">
                  {gain.after}
                </Text>
              </HStack>
            </HStack>
          );
        })}
      </VStack>
      <Button size="xs" mt={2} width="100%" colorScheme="orange" variant="solid" onClick={onDismiss}>
        OK
      </Button>
    </Box>
  );
}
