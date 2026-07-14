import { Box, keyframes } from "@chakra-ui/react";
import type { BattleInterfaceConfig } from "./battleInterfaceConfig";

const introFlash = keyframes`
  0% { opacity: 0; }
  12% { opacity: 1; }
  24% { opacity: 0; }
  36% { opacity: 1; }
  48% { opacity: 0; }
  60% { opacity: 1; }
  100% { opacity: 0; }
`;

const introWipeLeft = keyframes`
  0% { transform: translateX(0); }
  55% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
`;

const introWipeRight = keyframes`
  0% { transform: translateX(0); }
  55% { transform: translateX(0); }
  100% { transform: translateX(100%); }
`;

const introFade = keyframes`
  0% { opacity: 1; }
  60% { opacity: 1; }
  100% { opacity: 0; }
`;

/**
 * Battle entry transition: screen flash followed by a split wipe that
 * reveals the battle scene (classic Essentials feel).
 */
export default function BattleIntro({ config }: { config: BattleInterfaceConfig }) {
  if (config.introTransition === "none") {
    return null;
  }

  if (config.introTransition === "fade") {
    return (
      <Box
        position="absolute"
        inset={0}
        zIndex={50}
        bg="black"
        pointerEvents="none"
        animation={`${introFade} 1.6s ease forwards`}
      />
    );
  }

  return (
    <Box position="absolute" inset={0} zIndex={50} pointerEvents="none" overflow="hidden">
      <Box
        position="absolute"
        inset={0}
        bg="white"
        animation={`${introFlash} 0.9s linear forwards`}
      />
      <Box
        position="absolute"
        top={0}
        left={0}
        width="50.5%"
        height="100%"
        bg="#141414"
        animation={`${introWipeLeft} 1.7s ease-in forwards`}
      />
      <Box
        position="absolute"
        top={0}
        right={0}
        width="50.5%"
        height="100%"
        bg="#141414"
        animation={`${introWipeRight} 1.7s ease-in forwards`}
      />
    </Box>
  );
}
