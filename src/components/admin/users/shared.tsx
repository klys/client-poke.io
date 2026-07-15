import { Badge, Box, Image, Text, Tooltip } from '@chakra-ui/react';
import { resolveServerAssetUrl } from '../../tilemap/serverAssets';
import type { AdminInventoryCategory } from '../types';

// Pokemon elemental type -> accent color. Keys are matched case-insensitively
// so designer data ("GRASS", "Fire", "water") all resolve.
const TYPE_COLORS: Record<string, string> = {
  normal: '#9fa19f',
  fire: '#e8663d',
  water: '#4d90d5',
  electric: '#f2c94c',
  grass: '#5fbb6d',
  ice: '#74cec0',
  fighting: '#ce4069',
  poison: '#a552cc',
  ground: '#d97845',
  flying: '#8fa8dd',
  psychic: '#f85c8a',
  bug: '#8cb230',
  rock: '#c8b686',
  ghost: '#5269ac',
  dragon: '#0a6dc4',
  dark: '#5a5366',
  steel: '#5a8ea1',
  fairy: '#ec8fe6'
};

export function typeColor(type: string): string {
  return TYPE_COLORS[type.trim().toLowerCase()] ?? '#7c8b74';
}

export const CATEGORY_META: Record<AdminInventoryCategory, { label: string; color: string; emoji: string }> = {
  usable: { label: 'Usable', color: 'blue', emoji: '🧪' },
  berries: { label: 'Berries', color: 'pink', emoji: '🍓' },
  moves: { label: 'Moves', color: 'purple', emoji: '💿' },
  quest: { label: 'Quest', color: 'orange', emoji: '🗝️' }
};

export const CATEGORY_ORDER: AdminInventoryCategory[] = ['usable', 'berries', 'moves', 'quest'];

export function TypeBadge({ type }: { type: string }) {
  const color = typeColor(type);
  return (
    <Badge
      textTransform="uppercase"
      fontSize="0.62rem"
      letterSpacing="0.06em"
      px={2}
      py="1px"
      borderRadius="full"
      color="white"
      bg={color}
    >
      {type}
    </Badge>
  );
}

// Item icon with graceful fallback to a category emoji when the designer
// catalog has no icon (or the asset fails to load).
export function ItemIcon({
  src,
  category,
  size = '40px',
  alt
}: {
  src?: string
  category: AdminInventoryCategory
  size?: string
  alt?: string
}) {
  const resolved = src ? resolveServerAssetUrl(src) : '';
  const fallbackEmoji = CATEGORY_META[category].emoji;

  return (
    <Box
      w={size}
      h={size}
      minW={size}
      borderRadius="12px"
      bg="#f2f5ee"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      border="1px solid rgba(56,78,58,0.08)"
    >
      {resolved ? (
        <Image
          src={resolved}
          alt={alt ?? 'item'}
          w="82%"
          h="82%"
          objectFit="contain"
          sx={{ imageRendering: 'pixelated' }}
          fallback={<Text fontSize="lg">{fallbackEmoji}</Text>}
        />
      ) : (
        <Text fontSize="lg">{fallbackEmoji}</Text>
      )}
    </Box>
  );
}

// Pokemon icon sprite (menu icon preferred, front sprite as fallback).
export function PokemonAvatar({
  iconImageSrc,
  frontImageSrc,
  name,
  size = '56px'
}: {
  iconImageSrc?: string
  frontImageSrc?: string
  name: string
  size?: string
}) {
  const primary = iconImageSrc || frontImageSrc || '';
  const resolved = primary ? resolveServerAssetUrl(primary) : '';

  return (
    <Box
      w={size}
      h={size}
      minW={size}
      borderRadius="14px"
      bg="radial-gradient(circle at 50% 35%, #ffffff 0%, #eef3ea 70%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      border="1px solid rgba(56,78,58,0.10)"
    >
      {resolved ? (
        <Tooltip label={name} openDelay={400}>
          <Image
            src={resolved}
            alt={name}
            w="90%"
            h="90%"
            objectFit="contain"
            sx={{ imageRendering: 'pixelated' }}
            fallback={<Text fontSize="xl">❔</Text>}
          />
        </Tooltip>
      ) : (
        <Text fontSize="xl">❔</Text>
      )}
    </Box>
  );
}

// Compact HP bar coloured by remaining ratio.
export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const safeMax = maxHp > 0 ? maxHp : Math.max(hp, 1);
  const ratio = Math.max(0, Math.min(1, hp / safeMax));
  const color = ratio > 0.5 ? '#4caf50' : ratio > 0.2 ? '#f2b705' : '#e8663d';

  return (
    <Box w="100%" h="6px" borderRadius="full" bg="#e4e9df" overflow="hidden">
      <Box w={`${ratio * 100}%`} h="100%" bg={color} transition="width 0.2s ease" />
    </Box>
  );
}
