import {
  Badge,
  Box,
  HStack,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr
} from '@chakra-ui/react';
import { useMemo } from 'react';
import type { OnlineMapOverview } from './types';

type OnlinePlayersOverviewProps = {
  maps: OnlineMapOverview[]
  totalOnlinePlayers: number
  fetchedAt: string | null
  emptyMessage: string
}

type OnlinePlayerRow = OnlineMapOverview['players'][number] & {
  mapId: string
}

export default function OnlinePlayersOverview({
  maps,
  totalOnlinePlayers,
  fetchedAt,
  emptyMessage
}: OnlinePlayersOverviewProps) {
  const players = useMemo<OnlinePlayerRow[]>(
    () => maps
      .flatMap((map) => map.players.map((player) => ({ ...player, mapId: map.mapId })))
      .sort((a, b) => (a.username || a.name || a.playerId).localeCompare(b.username || b.name || b.playerId)),
    [maps]
  );

  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={4}>
        <Box>
          <Text fontSize="sm" textTransform="uppercase" letterSpacing="0.18em" color="#6a7a63" fontWeight="700">
            Online Players
          </Text>
          <Text fontSize="2xl" fontWeight="800" color="#1f2d22">
            {totalOnlinePlayers} online player{totalOnlinePlayers === 1 ? '' : 's'}
          </Text>
        </Box>
        <Badge alignSelf="center" px={3} py={1} borderRadius="full" colorScheme="green">
          {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleString()}` : 'Waiting for server'}
        </Badge>
      </HStack>

      {players.length === 0 ? (
        <Box borderRadius="24px" border="1px solid rgba(57, 79, 57, 0.14)" bg="white" p={6}>
          <Text color="#546357">{emptyMessage}</Text>
        </Box>
      ) : (
        <TableContainer
          borderRadius="24px"
          border="1px solid rgba(57, 79, 57, 0.14)"
          bg="white"
          boxShadow="0 18px 40px rgba(46, 67, 52, 0.08)"
        >
          <Table variant="simple">
            <Thead bg="#f6f7f1">
              <Tr>
                <Th color="#546357">Player</Th>
                <Th color="#546357">User</Th>
                <Th color="#546357">Map</Th>
                <Th color="#546357" isNumeric>Position</Th>
                <Th color="#546357" isNumeric>Sockets</Th>
              </Tr>
            </Thead>
            <Tbody>
              {players.map((player) => (
                <Tr key={player.playerId}>
                  <Td>
                    <Text fontWeight="700" color="#223126">
                      {player.username || player.name || player.playerId}
                    </Text>
                    <Text fontSize="sm" color="#667469">
                      {player.name || 'Unnamed trainer'}
                    </Text>
                  </Td>
                  <Td>
                    <Badge colorScheme={player.userId === null ? 'gray' : 'green'}>
                      {player.userId === null ? 'guest' : `#${player.userId}`}
                    </Badge>
                  </Td>
                  <Td>
                    <Text color="#223126">{player.mapId}</Text>
                  </Td>
                  <Td isNumeric>
                    <Text color="#5d6c60">({player.x}, {player.y})</Text>
                  </Td>
                  <Td isNumeric>
                    <Badge colorScheme="gray">
                      {player.connectedSockets}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
