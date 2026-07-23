import {
  Badge,
  Box,
  Center,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Wrap,
  WrapItem
} from '@chakra-ui/react';
import type { AdminUserStorage } from '../types';
import { PokemonAvatar } from './shared';

type StorageViewerProps = {
  storage: AdminUserStorage | null
  loading: boolean
}

/**
 * Read-only view of a trainer's public profile and PC box storage. Editing
 * stored venomons is out of scope for the admin panel — gifts go through the
 * Party tab; this exists so admins can see what a player has stashed away.
 */
export default function StorageViewer({ storage, loading }: StorageViewerProps) {
  if (loading && !storage) {
    return (
      <Center py={10}>
        <Spinner color="green.400" />
      </Center>
    );
  }

  if (!storage) {
    return <Text color="#8a9782">Unable to load this trainer's storage.</Text>;
  }

  const { profile, boxes } = storage;
  const storedCount = boxes.reduce((total, box) => total + box.pokemon.length, 0);
  const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;

  return (
    <Stack spacing={5}>
      <Box
        borderRadius="20px"
        border="1px solid rgba(56,78,58,0.12)"
        bg={profile.trainerCardColor || '#f6f8f3'}
        p={4}
      >
        <HStack align="flex-start" spacing={4} flexWrap="wrap">
          <Box
            w="64px"
            h="64px"
            borderRadius="16px"
            bg="rgba(255,255,255,0.8)"
            backgroundImage={profile.profileImage ? `url(${profile.profileImage})` : undefined}
            backgroundSize="cover"
            backgroundPosition="center"
            border="1px solid rgba(56,78,58,0.15)"
          />
          <Stack spacing={1} flex="1" minW="200px">
            <HStack spacing={2} flexWrap="wrap">
              <Text fontWeight="800" fontSize="lg" color="#1f2d22">{profile.name || profile.username}</Text>
              <Badge colorScheme="purple" borderRadius="full">@{profile.username}</Badge>
            </HStack>
            {profile.description ? (
              <Text fontSize="sm" color="#4a5a45">{profile.description}</Text>
            ) : null}
            <Wrap spacing={2} pt={1}>
              <WrapItem>
                <Badge colorScheme="yellow" borderRadius="full">${profile.money}</Badge>
              </WrapItem>
              <WrapItem>
                <Badge colorScheme="orange" borderRadius="full">
                  {profile.badges.length} badge{profile.badges.length === 1 ? '' : 's'}
                </Badge>
              </WrapItem>
              {profile.characterSkinId ? (
                <WrapItem>
                  <Badge colorScheme="teal" borderRadius="full">{profile.characterSkinId}</Badge>
                </WrapItem>
              ) : null}
              {createdAt && !Number.isNaN(createdAt.getTime()) ? (
                <WrapItem>
                  <Badge colorScheme="gray" borderRadius="full">
                    Joined {createdAt.toLocaleDateString()}
                  </Badge>
                </WrapItem>
              ) : null}
            </Wrap>
          </Stack>
        </HStack>
      </Box>

      <HStack spacing={2}>
        <Text fontWeight="800" color="#1f2d22">PC Box</Text>
        <Badge colorScheme="green" borderRadius="full">
          {storedCount} stored venomon{storedCount === 1 ? '' : 's'}
        </Badge>
      </HStack>

      {boxes.map((box) => (
        <Box key={box.id} borderRadius="16px" border="1px solid rgba(56,78,58,0.10)" p={3}>
          <HStack justify="space-between" mb={box.pokemon.length > 0 ? 3 : 0}>
            <Text fontWeight="700" color="#223126">{box.name}</Text>
            <Badge colorScheme="gray" borderRadius="full">{box.pokemon.length}/{box.capacity}</Badge>
          </HStack>
          {box.pokemon.length === 0 ? (
            <Text fontSize="sm" color="#8a9782">Empty.</Text>
          ) : (
            <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2}>
              {box.pokemon.map((pokemon) => (
                <HStack
                  key={pokemon.id}
                  spacing={2}
                  p={2}
                  borderRadius="12px"
                  bg="#f6f8f3"
                  border="1px solid rgba(56,78,58,0.08)"
                >
                  <PokemonAvatar iconImageSrc={pokemon.iconImageSrc} name={pokemon.name} size="34px" />
                  <Stack spacing={0} minW={0}>
                    <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                      {pokemon.nickname || pokemon.name}
                    </Text>
                    <Text fontSize="xs" color="#68776b">Lv {pokemon.level}</Text>
                  </Stack>
                </HStack>
              ))}
            </SimpleGrid>
          )}
        </Box>
      ))}
    </Stack>
  );
}
