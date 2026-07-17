import { Box, keyframes } from "@chakra-ui/react";
import { useMemo } from "react";
import {
  BATTLE_INTRO_EFFECTS,
  type BattleIntroEffect,
  type BattleInterfaceConfig
} from "./battleInterfaceConfig";

/**
 * Battle entry transitions. The designer config picks one, or "random"
 * (the default) draws a different one each battle:
 *  - flash-wipe: screen flash + split wipe (classic Essentials feel)
 *  - fade:       plain fade from black
 *  - iris:       black iris shrinking to the center
 *  - blinds:     vertical blinds opening
 *  - checker:    checkerboard tiles flipping away
 *  - shutter:    horizontal slats sliding out alternately
 * All run within the 1.7s window the event queue holds the intro for.
 */

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

const introIris = keyframes`
  0% { clip-path: circle(120% at 50% 50%); }
  45% { clip-path: circle(120% at 50% 50%); }
  100% { clip-path: circle(0% at 50% 50%); }
`;

const introBlind = keyframes`
  0% { transform: scaleX(1); }
  50% { transform: scaleX(1); }
  100% { transform: scaleX(0); }
`;

const introCheckerTile = keyframes`
  0% { transform: scale(1); opacity: 1; }
  55% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
`;

const introShutterLeft = keyframes`
  0% { transform: translateX(0); }
  45% { transform: translateX(0); }
  100% { transform: translateX(-102%); }
`;

const introShutterRight = keyframes`
  0% { transform: translateX(0); }
  45% { transform: translateX(0); }
  100% { transform: translateX(102%); }
`;

function FlashOverlay({ durationMs = 900 }: { durationMs?: number }) {
  return (
    <Box
      position="absolute"
      inset={0}
      bg="white"
      animation={`${introFlash} ${durationMs}ms linear forwards`}
    />
  );
}

export default function BattleIntro({ config }: { config: BattleInterfaceConfig }) {
  // "random" resolves once per mount (i.e. once per battle); the component
  // stays mounted for the whole intro so the pick never changes mid-play.
  const effect: BattleIntroEffect | "none" = useMemo(() => {
    if (config.introTransition === "none") {
      return "none";
    }
    if (config.introTransition === "random") {
      return BATTLE_INTRO_EFFECTS[Math.floor(Math.random() * BATTLE_INTRO_EFFECTS.length)];
    }
    return config.introTransition;
  }, [config.introTransition]);

  if (effect === "none") {
    return null;
  }

  if (effect === "fade") {
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

  if (effect === "iris") {
    return (
      <Box position="absolute" inset={0} zIndex={50} pointerEvents="none" overflow="hidden">
        <FlashOverlay />
        <Box
          position="absolute"
          inset={0}
          bg="#141414"
          animation={`${introIris} 1.65s ease-in-out forwards`}
        />
      </Box>
    );
  }

  if (effect === "blinds") {
    const blindCount = 8;
    return (
      <Box position="absolute" inset={0} zIndex={50} pointerEvents="none" overflow="hidden">
        <FlashOverlay />
        {Array.from({ length: blindCount }, (_, index) => (
          <Box
            key={index}
            position="absolute"
            top={0}
            left={`${(index / blindCount) * 100}%`}
            width={`${100 / blindCount + 0.2}%`}
            height="100%"
            bg="#141414"
            transformOrigin={index % 2 === 0 ? "left center" : "right center"}
            animation={`${introBlind} 1.55s ease-in ${index * 45}ms forwards`}
          />
        ))}
      </Box>
    );
  }

  if (effect === "checker") {
    const columns = 8;
    const rows = 5;
    return (
      <Box position="absolute" inset={0} zIndex={50} pointerEvents="none" overflow="hidden">
        <FlashOverlay />
        {Array.from({ length: columns * rows }, (_, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          // Diagonal stagger so the board sweeps from a corner.
          const delayMs = (column + row) * 55;
          return (
            <Box
              key={index}
              position="absolute"
              left={`${(column / columns) * 100}%`}
              top={`${(row / rows) * 100}%`}
              width={`${100 / columns + 0.2}%`}
              height={`${100 / rows + 0.2}%`}
              bg="#141414"
              animation={`${introCheckerTile} 1.2s ease-in ${delayMs}ms forwards`}
            />
          );
        })}
      </Box>
    );
  }

  if (effect === "shutter") {
    const slatCount = 6;
    return (
      <Box position="absolute" inset={0} zIndex={50} pointerEvents="none" overflow="hidden">
        <FlashOverlay />
        {Array.from({ length: slatCount }, (_, index) => (
          <Box
            key={index}
            position="absolute"
            left={0}
            top={`${(index / slatCount) * 100}%`}
            width="100%"
            height={`${100 / slatCount + 0.2}%`}
            bg="#141414"
            animation={`${index % 2 === 0 ? introShutterLeft : introShutterRight} 1.6s ease-in ${index * 40}ms forwards`}
          />
        ))}
      </Box>
    );
  }

  // flash-wipe (classic default)
  return (
    <Box position="absolute" inset={0} zIndex={50} pointerEvents="none" overflow="hidden">
      <FlashOverlay />
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
