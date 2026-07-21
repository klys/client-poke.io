import {
  Badge,
  Box,
  Divider,
  HStack,
  Image,
  SimpleGrid,
  Text,
  Tooltip,
  VStack,
  type BoxProps
} from '@chakra-ui/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveServerAssetUrl } from '../../tilemap/serverAssets';
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail
} from '../../designer/designerCache';
import { getCharacterSkinPreview, loadCharacterSkinCatalog } from './characterSkinCatalog';
import { GYM_BADGES } from './badgeCatalog';

/** A party member, normalized so both the owner's card (full PokemonSummary)
 * and another player's card (a lightweight species reference) share one view. */
export type TrainerCardTeamMember = {
  name: string;
  nickname?: string;
  sourcePokemonId?: string;
  id?: string;
};

// -- Trainer Card background palette ---------------------------------------
export type TrainerCardColorKey =
  | 'teal' | 'crimson' | 'violet' | 'gold'
  | 'slate' | 'emerald' | 'rose' | 'indigo' | 'sky' | 'amber';

export type TrainerCardColor = {
  key: TrainerCardColorKey;
  label: string;
  gradient: string;
  swatch: string;
};

// The first entry is the default (matches the legacy card gradient).
export const TRAINER_CARD_COLORS: TrainerCardColor[] = [
  { key: 'teal', label: 'Teal', gradient: 'linear-gradient(135deg, #0f766e 0%, #1f2937 100%)', swatch: '#0f766e' },
  { key: 'crimson', label: 'Crimson', gradient: 'linear-gradient(135deg, #9b1c31 0%, #1f2937 100%)', swatch: '#9b1c31' },
  { key: 'violet', label: 'Violet', gradient: 'linear-gradient(135deg, #6d28d9 0%, #1f2937 100%)', swatch: '#6d28d9' },
  { key: 'gold', label: 'Gold', gradient: 'linear-gradient(135deg, #b45309 0%, #1f2937 100%)', swatch: '#b45309' },
  { key: 'slate', label: 'Slate', gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)', swatch: '#334155' },
  { key: 'emerald', label: 'Emerald', gradient: 'linear-gradient(135deg, #047857 0%, #1f2937 100%)', swatch: '#047857' },
  { key: 'rose', label: 'Rose', gradient: 'linear-gradient(135deg, #be185d 0%, #1f2937 100%)', swatch: '#be185d' },
  { key: 'indigo', label: 'Indigo', gradient: 'linear-gradient(135deg, #4338ca 0%, #1f2937 100%)', swatch: '#4338ca' },
  { key: 'sky', label: 'Sky', gradient: 'linear-gradient(135deg, #0369a1 0%, #1f2937 100%)', swatch: '#0369a1' },
  { key: 'amber', label: 'Amber', gradient: 'linear-gradient(135deg, #a16207 0%, #1f2937 100%)', swatch: '#a16207' }
];

export const DEFAULT_TRAINER_CARD_COLOR: TrainerCardColorKey = 'teal';

export function resolveTrainerCardGradient(colorKey: string | undefined): string {
  const match = TRAINER_CARD_COLORS.find((color) => color.key === colorKey);
  return (match ?? TRAINER_CARD_COLORS[0]).gradient;
}

// -- Skin front picture -----------------------------------------------------
/** Resolves the front-facing (standing-down) sprite URL for a skin id. */
function useSkinFrontSprite(characterSkinId: string | undefined): string {
  const [catalog, setCatalog] = useState(() => loadCharacterSkinCatalog());

  useEffect(() => {
    const sync = () => setCatalog(loadCharacterSkinCatalog());
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;
      if (detail?.sectionKey === 'players') {
        sync();
      }
    };
    sync();
    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handle);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handle);
  }, []);

  return useMemo(() => {
    if (!characterSkinId) {
      return '';
    }
    const profile = catalog.find((skin) => skin.id === characterSkinId)?.profile;
    return getCharacterSkinPreview(profile);
  }, [catalog, characterSkinId]);
}

// -- Team animated icons ----------------------------------------------------
/** Species id -> animated icon URL, from the designer "pokemons" section. */
function usePokemonIconMap(): Map<string, string> {
  const build = () => {
    const items = readStoredDesignerSectionPayload('pokemons').state.items;
    return new Map(
      items
        .map((item) => {
          const iconImageSrc = item.pokemonProfile?.iconImageSrc;
          return iconImageSrc ? ([item.id, iconImageSrc] as const) : null;
        })
        .filter((entry): entry is readonly [string, string] => entry !== null)
    );
  };

  const [map, setMap] = useState<Map<string, string>>(build);

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;
      if (detail?.sectionKey === 'pokemons') {
        setMap(build());
      }
    };
    setMap(build());
    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handle);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handle);
  }, []);

  return map;
}

/** A row of the team's animated icons only — no names, levels or HP. */
export function TeamIconsStrip({
  team,
  emptyLabel = 'No Venomon on hand.'
}: {
  team: TrainerCardTeamMember[];
  emptyLabel?: string;
}) {
  const iconMap = usePokemonIconMap();

  if (team.length === 0) {
    return <Text color="whiteAlpha.700" fontSize="sm">{emptyLabel}</Text>;
  }

  return (
    <HStack spacing={2} flexWrap="wrap">
      {team.map((member, index) => {
        const iconSrc = resolveServerAssetUrl(
          iconMap.get(member.sourcePokemonId ?? '') ?? iconMap.get(member.id ?? '') ?? ''
        );
        const label = member.nickname || member.name;
        return (
          <Tooltip key={`${member.id ?? member.sourcePokemonId ?? member.name}-${index}`} label={label} hasArrow>
            <Box
              boxSize="46px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="blackAlpha.400"
              borderRadius="8px"
              border="1px solid rgba(255,255,255,0.14)"
            >
              {iconSrc ? (
                <Image
                  src={iconSrc}
                  alt={label}
                  maxH="40px"
                  maxW="40px"
                  objectFit="contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <Text fontFamily="mono" fontWeight="800" fontSize="sm">
                  {label.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </HStack>
  );
}

// -- Gym medals -------------------------------------------------------------
/** All eight gym medals; earned ones in colour, the rest greyed silhouettes. */
export function GymMedals({ badges }: { badges: number[] }) {
  const earned = useMemo(() => new Set(badges), [badges]);

  return (
    <SimpleGrid columns={{ base: 4, sm: 8 }} spacing={2}>
      {GYM_BADGES.map((badge) => {
        const isEarned = earned.has(badge.index);
        return (
          <Tooltip
            key={badge.index}
            label={isEarned ? badge.name : `${badge.name} (not earned)`}
            hasArrow
          >
            <Box
              boxSize="42px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg={isEarned ? 'whiteAlpha.300' : 'blackAlpha.400'}
              borderRadius="full"
              border={isEarned ? '1px solid rgba(255,255,255,0.55)' : '1px dashed rgba(255,255,255,0.2)'}
            >
              <Image
                src={resolveServerAssetUrl(badge.iconPath)}
                alt={badge.name}
                maxH="34px"
                maxW="34px"
                objectFit="contain"
                style={{
                  imageRendering: 'pixelated',
                  filter: isEarned ? 'none' : 'grayscale(1) brightness(0.5)',
                  opacity: isEarned ? 1 : 0.55
                }}
              />
            </Box>
          </Tooltip>
        );
      })}
    </SimpleGrid>
  );
}

// -- Full card --------------------------------------------------------------
export type TrainerCardViewProps = {
  name?: string;
  username?: string;
  trainerId?: number;
  money?: number;
  description?: string;
  characterSkinId?: string;
  badges: number[];
  team: TrainerCardTeamMember[];
  colorKey?: string;
  medalsLabel: string;
  teamLabel: string;
  noDescription: string;
  footer?: ReactNode;
} & BoxProps;

/**
 * The presentational Trainer Card, shared by the menu window (own card, with
 * money + battle history) and the map click-a-player card (public, no money).
 */
export function TrainerCardView({
  name,
  username,
  trainerId,
  money,
  description,
  characterSkinId,
  badges,
  team,
  colorKey,
  medalsLabel,
  teamLabel,
  noDescription,
  footer,
  ...boxProps
}: TrainerCardViewProps) {
  const frontSprite = useSkinFrontSprite(characterSkinId);
  const displayName = name || username || 'Trainer';

  return (
    <Box
      bg={resolveTrainerCardGradient(colorKey)}
      p={5}
      borderRadius="10px"
      color="white"
      boxShadow="inset 0 0 0 1px rgba(255,255,255,0.08)"
      {...boxProps}
    >
      <HStack spacing={4} align="center">
        <Box
          boxSize="96px"
          flexShrink={0}
          display="flex"
          alignItems="flex-end"
          justifyContent="center"
          bg="blackAlpha.400"
          borderRadius="10px"
          border="1px solid rgba(255,255,255,0.18)"
          overflow="hidden"
        >
          {frontSprite ? (
            <Image
              src={frontSprite}
              alt={`${displayName} skin`}
              maxH="90px"
              objectFit="contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <Text fontSize="3xl" fontWeight="900" opacity={0.7}>
              {displayName.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </Box>
        <Box minW={0}>
          {typeof trainerId === 'number' ? (
            <Text fontSize="xs" color="whiteAlpha.800">TRAINER ID #{trainerId}</Text>
          ) : null}
          <Text fontSize="2xl" fontWeight="800" noOfLines={1}>{displayName}</Text>
          {username ? <Text color="whiteAlpha.800" noOfLines={1}>@{username}</Text> : null}
          {typeof money === 'number' ? (
            <Text fontWeight="800" color="yellow.100" mt={1}>${money}</Text>
          ) : null}
        </Box>
      </HStack>

      <Text mt={3} minH="24px" color="whiteAlpha.900">{description || noDescription}</Text>

      <Divider my={4} borderColor="whiteAlpha.400" />
      <Text fontSize="xs" fontWeight="700" color="whiteAlpha.800" mb={2} textTransform="uppercase">
        {medalsLabel}
      </Text>
      <GymMedals badges={badges} />

      <Divider my={4} borderColor="whiteAlpha.400" />
      <Text fontSize="xs" fontWeight="700" color="whiteAlpha.800" mb={2} textTransform="uppercase">
        {teamLabel}
      </Text>
      <TeamIconsStrip team={team} />

      {footer ? <VStack mt={4} spacing={3} align="stretch">{footer}</VStack> : null}
    </Box>
  );
}
