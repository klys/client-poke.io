import {
  Badge,
  Box,
  HStack,
  SimpleGrid,
  Stack,
  Text
} from '@chakra-ui/react';
import type { OnlineMapOverview } from './types';

type MapsOverviewProps = {
  maps: OnlineMapOverview[]
  totalOnlinePlayers: number
  fetchedAt: string | null
  emptyMessage: string
}

export default function MapsOverview({
  maps,
  totalOnlinePlayers,
  fetchedAt,
  emptyMessage
}: MapsOverviewProps) {
  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={4}>
        <Box>
          <Text fontSize="sm" textTransform="uppercase" letterSpacing="0.18em" color="#6a7a63" fontWeight="700">
            Live Maps
          </Text>
          <Text fontSize="2xl" fontWeight="800" color="#1f2d22">
            {totalOnlinePlayers} online player{totalOnlinePlayers === 1 ? '' : 's'}
          </Text>
        </Box>
        <Badge alignSelf="center" px={3} py={1} borderRadius="full" colorScheme="green">
          {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleString()}` : 'Waiting for server'}
        </Badge>
      </HStack>

      {maps.length === 0 ? (
        <Box borderRadius="24px" border="1px solid rgba(57, 79, 57, 0.14)" bg="white" p={6}>
          <Text color="#546357">{emptyMessage}</Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5}>
          {maps.map((map) => (
            <Box
              key={map.mapId}
              borderRadius="24px"
              border="1px solid rgba(57, 79, 57, 0.14)"
              bg="white"
              p={5}
              boxShadow="0 18px 40px rgba(46, 67, 52, 0.08)"
            >
              <HStack justify="space-between" mb={4} spacing={3}>
                <Box>
                  <Text fontSize="lg" fontWeight="800" color="#223126">
                    {map.mapId}
                  </Text>
                  <Text fontSize="sm" color="#68776b">
                    Active connections in this map
                  </Text>
                </Box>
                <Badge colorScheme="teal" px={3} py={1} borderRadius="full">
                  {map.onlinePlayers} online
                </Badge>
              </HStack>

              <Stack spacing={3}>
                {map.players.map((player) => (
                  <Box
                    key={player.playerId}
                    borderRadius="16px"
                    bg="#f6f7f1"
                    border="1px solid rgba(57, 79, 57, 0.10)"
                    px={4}
                    py={3}
                  >
                    <HStack justify="space-between" align="flex-start" spacing={3}>
                      <Box>
                        <Text fontWeight="700" color="#223126">
                          {player.username || player.name || player.playerId}
                        </Text>
                        <Text fontSize="sm" color="#667469">
                          {player.name || 'Unnamed trainer'}
                        </Text>
                      </Box>
                      <Badge colorScheme="gray">
                        {player.connectedSockets} socket{player.connectedSockets === 1 ? '' : 's'}
                      </Badge>
                    </HStack>
                    <Text mt={2} fontSize="sm" color="#5d6c60">
                      User #{player.userId ?? 'guest'} at ({player.x}, {player.y})
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
