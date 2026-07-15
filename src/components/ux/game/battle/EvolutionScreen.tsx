import { Box, Text, keyframes } from "@chakra-ui/react";
import type { ActiveEvolution } from "./useBattleEventQueue";
import { resolveServerAssetUrl } from "../../../tilemap/serverAssets";

const evolutionGlow = keyframes`
  0% { filter: brightness(1); transform: scale(1); }
  35% { filter: brightness(6) saturate(0); transform: scale(0.92); }
  65% { filter: brightness(6) saturate(0); transform: scale(1.12); }
  100% { filter: brightness(1); transform: scale(1); }
`;

/** Full-screen evolution sequence played when a battle ends with an evolution. */
export default function EvolutionScreen({ evolution }: { evolution: ActiveEvolution }) {
  return (
    <Box
      position="absolute"
      inset={0}
      zIndex={40}
      bg="radial-gradient(circle at 50% 42%, #274069 0%, #101726 78%)"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={6}
    >
      <Box animation={`${evolutionGlow} 3.2s ease-in-out forwards`}>
        {evolution.frontImageSrc ? (
          <img
            src={resolveServerAssetUrl(evolution.frontImageSrc)}
            alt={evolution.toName}
            style={{
              width: "min(46vw, 240px)",
              height: "min(46vw, 240px)",
              objectFit: "contain",
              imageRendering: "pixelated"
            }}
          />
        ) : (
          <Box
            width="200px"
            height="200px"
            borderRadius="50%"
            bg="rgba(255,255,255,0.25)"
          />
        )}
      </Box>
      <Text color="white" fontWeight="900" fontSize={{ base: "lg", md: "2xl" }} textAlign="center" px={4}>
        {evolution.fromName} is evolving into {evolution.toName}!
      </Text>
    </Box>
  );
}
