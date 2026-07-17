import { Box, keyframes } from "@chakra-ui/react";
import { useMemo } from "react";

/**
 * Procedural move animation for moves without a migrated skillsGfx record
 * (only ~125 of 661 Venova moves have one). Renders a short particle burst
 * over the target slot, themed by the move's type: colors, particle shape
 * and motion all come from the type so Fire looks like rising embers, Water
 * like falling droplets, Electric like sparks, and so on.
 */

export const FALLBACK_ANIMATION_MS = 820;

type Motion = "burst" | "rise" | "fall" | "swirl" | "pulse" | "streak";
type Shape = "circle" | "square" | "diamond" | "spark" | "ring" | "leaf";

type TypeFx = { colors: [string, string, string]; shape: Shape; motion: Motion };

const TYPE_FX: Record<string, TypeFx> = {
  NORMAL: { colors: ["#fffbe8", "#e8ddb0", "#a8a878"], shape: "circle", motion: "burst" },
  FIRE: { colors: ["#ffe066", "#ff8f3c", "#f0402e"], shape: "circle", motion: "rise" },
  WATER: { colors: ["#dff2ff", "#6bb8f8", "#2a6fd8"], shape: "circle", motion: "fall" },
  ELECTRIC: { colors: ["#fffbc2", "#ffe23c", "#e8a800"], shape: "spark", motion: "burst" },
  GRASS: { colors: ["#e2f8c2", "#78c850", "#3e8f38"], shape: "leaf", motion: "swirl" },
  ICE: { colors: ["#f2fdff", "#a8e6f0", "#58b8d8"], shape: "diamond", motion: "fall" },
  FIGHTING: { colors: ["#ffd2c2", "#e86a4a", "#c03028"], shape: "square", motion: "burst" },
  POISON: { colors: ["#eec8f6", "#b05cc8", "#7a2d96"], shape: "circle", motion: "rise" },
  GROUND: { colors: ["#f6e6b2", "#d8b860", "#a8842e"], shape: "square", motion: "fall" },
  FLYING: { colors: ["#ffffff", "#d4dcff", "#a890f0"], shape: "spark", motion: "streak" },
  PSYCHIC: { colors: ["#ffd2e6", "#f85888", "#c22462"], shape: "ring", motion: "pulse" },
  BUG: { colors: ["#eef6a8", "#a8b820", "#6a7a12"], shape: "circle", motion: "swirl" },
  ROCK: { colors: ["#eadfba", "#b8a038", "#7c6a22"], shape: "square", motion: "fall" },
  GHOST: { colors: ["#d6c8fa", "#8a70c2", "#4c3a78"], shape: "circle", motion: "swirl" },
  DRAGON: { colors: ["#cebcff", "#7038f8", "#3a12a8"], shape: "diamond", motion: "burst" },
  DARK: { colors: ["#b0a094", "#584838", "#241c14"], shape: "circle", motion: "pulse" },
  STEEL: { colors: ["#ffffff", "#d8d8e8", "#9090a8"], shape: "diamond", motion: "burst" },
  FAIRY: { colors: ["#ffffff", "#ffc9dd", "#ee80aa"], shape: "circle", motion: "swirl" }
};

const DEFAULT_FX: TypeFx = TYPE_FX.NORMAL;

const motionBurst = keyframes`
  0% { transform: translate(0, 0) scale(0.3) rotate(var(--rot)); opacity: 0; }
  12% { opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot)); opacity: 0; }
`;

const motionRise = keyframes`
  0% { transform: translate(var(--dx), 26px) scale(0.6) rotate(var(--rot)); opacity: 0; }
  18% { opacity: 1; }
  55% { opacity: 0.85; }
  100% { transform: translate(calc(var(--dx) * 1.35), -72px) scale(1.05) rotate(var(--rot)); opacity: 0; }
`;

const motionFall = keyframes`
  0% { transform: translate(var(--dx), -68px) scale(0.7) rotate(var(--rot)); opacity: 0; }
  16% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(calc(var(--dx) * 0.7), 44px) scale(1) rotate(calc(var(--rot) + 40deg)); opacity: 0; }
`;

const motionSwirl = keyframes`
  0% { transform: translate(0, 0) scale(0.5) rotate(0deg); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1) rotate(300deg); opacity: 0; }
`;

const motionPulse = keyframes`
  0% { transform: translate(0, 0) scale(0.25); opacity: 0; }
  25% { opacity: 0.95; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1.7); opacity: 0; }
`;

const motionStreak = keyframes`
  0% { transform: translate(calc(var(--dx) * -1.6), var(--dy)) rotate(var(--rot)); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(calc(var(--dx) * 1.6), var(--dy)) rotate(var(--rot)); opacity: 0; }
`;

const MOTIONS: Record<Motion, ReturnType<typeof keyframes>> = {
  burst: motionBurst,
  rise: motionRise,
  fall: motionFall,
  swirl: motionSwirl,
  pulse: motionPulse,
  streak: motionStreak
};

const flashPop = keyframes`
  0% { transform: scale(0.2); opacity: 0.9; }
  100% { transform: scale(1.5); opacity: 0; }
`;

/** Deterministic 0..1 value per particle so renders never jitter. */
function seededUnit(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function shapeStyle(shape: Shape, size: number, color: string): React.CSSProperties {
  switch (shape) {
    case "square":
      return { width: size, height: size, background: color, borderRadius: "2px" };
    case "diamond":
      return { width: size, height: size, background: color, borderRadius: "2px", clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" };
    case "spark":
      return { width: Math.max(3, size * 0.3), height: size * 1.6, background: color, borderRadius: "2px" };
    case "ring":
      return { width: size * 1.4, height: size * 1.4, border: `3px solid ${color}`, borderRadius: "50%", background: "transparent" };
    case "leaf":
      return { width: size, height: size * 1.25, background: color, borderRadius: "80% 0 80% 0" };
    default:
      return { width: size, height: size, background: color, borderRadius: "50%" };
  }
}

export default function FallbackMoveAnimation({
  moveType,
  animationSpeed
}: {
  moveType: string;
  animationSpeed: number;
}) {
  const fx = TYPE_FX[moveType.trim().toUpperCase()] ?? DEFAULT_FX;
  const durationMs = FALLBACK_ANIMATION_MS / Math.max(0.25, animationSpeed);

  const particles = useMemo(() => {
    const count = 16;
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 + seededUnit(index, 1) * 0.7;
      const distance = 42 + seededUnit(index, 2) * 58;
      const size = 9 + Math.round(seededUnit(index, 3) * 10);
      return {
        dx: Math.round(Math.cos(angle) * distance),
        dy: Math.round(Math.sin(angle) * distance * (fx.motion === "streak" ? 0.4 : 1)),
        rot: Math.round(seededUnit(index, 4) * 90 - 45),
        size,
        color: fx.colors[index % fx.colors.length],
        delayMs: (index % 4) * 55
      };
    });
  }, [fx]);

  return (
    <Box
      position="absolute"
      inset={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
      zIndex={5}
    >
      <Box
        position="absolute"
        width="90px"
        height="90px"
        borderRadius="50%"
        bg={`radial-gradient(circle, ${fx.colors[0]} 0%, transparent 65%)`}
        animation={`${flashPop} ${Math.round(durationMs * 0.5)}ms ease-out forwards`}
      />
      {particles.map((particle, index) => (
        <Box
          key={index}
          position="absolute"
          style={
            {
              ...shapeStyle(fx.shape, particle.size, particle.color),
              "--dx": `${particle.dx}px`,
              "--dy": `${particle.dy}px`,
              "--rot": `${particle.rot}deg`,
              boxShadow: `0 0 8px ${particle.color}66`
            } as React.CSSProperties
          }
          animation={`${MOTIONS[fx.motion]} ${Math.round(durationMs * 0.92)}ms ease-out ${particle.delayMs}ms forwards`}
          opacity={0}
        />
      ))}
    </Box>
  );
}
