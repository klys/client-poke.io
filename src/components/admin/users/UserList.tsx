import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Skeleton,
  SkeletonCircle,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr
} from '@chakra-ui/react';
import type { AdminUserRole, AdminUserSummary } from '../types';

type UserListProps = {
  users: AdminUserSummary[]
  loading: boolean
  page: number
  totalPages: number
  total: number
  onlineUserIds: Set<number>
  onlineCount: number
  selectedUserId: number | null
  searchInput: string
  onSearchInputChange: (value: string) => void
  onSubmitSearch: () => void
  onSelect: (userId: number) => void
  onPrev: () => void
  onNext: () => void
}

const ROLE_COLORS: Record<AdminUserRole, string> = {
  admin: 'red',
  designer: 'green',
  moderator: 'orange',
  user: 'gray'
};

function OnlineDot({ online }: { online: boolean }) {
  return (
    <Tooltip label={online ? 'Online now' : 'Offline'} openDelay={300}>
      <Box
        w="10px"
        h="10px"
        borderRadius="full"
        bg={online ? '#37c46a' : '#cdd4c8'}
        boxShadow={online ? '0 0 0 3px rgba(55,196,106,0.20)' : 'none'}
        flexShrink={0}
      />
    </Tooltip>
  );
}

export default function UserList(props: UserListProps) {
  const {
    users,
    loading,
    page,
    totalPages,
    total,
    onlineUserIds,
    onlineCount,
    selectedUserId,
    searchInput,
    onSearchInputChange,
    onSubmitSearch,
    onSelect,
    onPrev,
    onNext
  } = props;

  return (
    <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
      <Stack spacing={5}>
        <HStack justify="space-between" align="flex-end" flexWrap="wrap" spacing={4}>
          <Box>
            <HStack spacing={2}>
              <Text fontSize="2xl" fontWeight="800" color="#1f2d22">Users</Text>
              <Badge colorScheme="green" borderRadius="full" px={2}>
                {onlineCount} online
              </Badge>
            </HStack>
            <Text color="#68776b">Search accounts, review activity, and open the editor.</Text>
          </Box>
          <HStack>
            <InputGroup>
              <InputLeftElement pointerEvents="none">🔍</InputLeftElement>
              <Input
                value={searchInput}
                onChange={(event) => onSearchInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSubmitSearch();
                  }
                }}
                placeholder="Search username, email, role..."
                bg="#f5f7f2"
              />
            </InputGroup>
            <Button colorScheme="green" onClick={onSubmitSearch}>Search</Button>
          </HStack>
        </HStack>

        <Box overflowX="auto" position="relative">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th isNumeric>Pokémon</Th>
                <Th isNumeric>Items</Th>
                <Th>Created</Th>
              </Tr>
            </Thead>
            <Tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <Tr key={`skeleton-${index}`}>
                    <Td>
                      <HStack spacing={3}>
                        <SkeletonCircle size="3" />
                        <Stack spacing={1} flex="1">
                          <Skeleton height="12px" w="60%" />
                          <Skeleton height="10px" w="40%" />
                        </Stack>
                      </HStack>
                    </Td>
                    <Td><Skeleton height="18px" w="60px" borderRadius="full" /></Td>
                    <Td isNumeric><Skeleton height="12px" w="24px" ml="auto" /></Td>
                    <Td isNumeric><Skeleton height="12px" w="24px" ml="auto" /></Td>
                    <Td><Skeleton height="12px" w="70px" /></Td>
                  </Tr>
                ))
              ) : users.length === 0 ? (
                <Tr>
                  <Td colSpan={5}>
                    <Text textAlign="center" color="#8a9782" py={6}>No users match this search.</Text>
                  </Td>
                </Tr>
              ) : (
                users.map((user) => {
                  const online = onlineUserIds.has(user.id);
                  return (
                    <Tr
                      key={user.id}
                      cursor="pointer"
                      onClick={() => onSelect(user.id)}
                      bg={selectedUserId === user.id ? '#edf7ee' : undefined}
                      _hover={{ bg: '#f4faf4' }}
                    >
                      <Td>
                        <HStack spacing={3} align="center">
                          <OnlineDot online={online} />
                          <Stack spacing={0} minW={0}>
                            <Text fontWeight="700" noOfLines={1}>{user.username}</Text>
                            <Text fontSize="xs" color="#69776b" noOfLines={1}>{user.email}</Text>
                          </Stack>
                        </HStack>
                      </Td>
                      <Td>
                        <Badge colorScheme={ROLE_COLORS[user.role]}>{user.role}</Badge>
                      </Td>
                      <Td isNumeric>{user.pokemonCount}</Td>
                      <Td isNumeric>{user.inventoryQuantity}</Td>
                      <Td>{new Date(user.createdAt).toLocaleDateString()}</Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </Box>

        <HStack justify="space-between" flexWrap="wrap" spacing={4}>
          <Text color="#657367">
            {loading
              ? 'Loading…'
              : `Page ${page} of ${totalPages} · ${total} user${total === 1 ? '' : 's'}.`}
          </Text>
          <HStack>
            <Button variant="outline" onClick={onPrev} isDisabled={page <= 1 || loading}>Previous</Button>
            <Button variant="outline" onClick={onNext} isDisabled={page >= totalPages || loading}>Next</Button>
          </HStack>
        </HStack>
      </Stack>
    </Box>
  );
}
