import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/authContext';
import MapsOverview from './MapsOverview';
import type {
  AdminRoleDefinition,
  AdminRolePermission,
  AdminUserDetails,
  AdminUserRole,
  AdminUserSummary,
  OnlineMapOverview
} from './types';

type AdminSection = 'users' | 'maps' | 'roles';

type AdminPageProps = {
  section: AdminSection
}

type UserListPayload = {
  users: AdminUserSummary[]
  search: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const PERMISSION_OPTIONS: Array<{ value: AdminRolePermission; label: string }> = [
  { value: 'game.access', label: 'Game Access' },
  { value: 'designer.access', label: 'Designer Access' },
  { value: 'moderator.access', label: 'Moderator Access' },
  { value: 'admin.access', label: 'Admin Access' }
];

const SECTION_LABELS: Record<AdminSection, string> = {
  users: 'Users',
  maps: 'Maps',
  roles: 'Roles Manager'
};

const INITIAL_USER_LIST: UserListPayload = {
  users: [],
  search: '',
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1
};

function createUserEditorState(user: AdminUserDetails | null) {
  if (!user) {
    return {
      name: '',
      role: 'user' as AdminUserRole,
      profileImage: '',
      description: '',
      trainerGender: '',
      money: '0',
      emailVerified: false,
      mapId: '',
      mapX: '0',
      mapY: '0',
      inventoryJson: '[]',
      pokemonPartyJson: '[]',
      battleHistoryJson: '[]'
    };
  }

  return {
    name: user.name,
    role: user.role,
    profileImage: user.profileImage,
    description: user.description,
    trainerGender: user.trainerGender,
    money: String(user.money),
    emailVerified: user.emailVerified,
    mapId: user.savedLocation?.mapId ?? '',
    mapX: String(user.savedLocation?.x ?? 0),
    mapY: String(user.savedLocation?.y ?? 0),
    inventoryJson: JSON.stringify(user.inventory, null, 2),
    pokemonPartyJson: JSON.stringify(user.pokemonParty, null, 2),
    battleHistoryJson: JSON.stringify(user.battleHistory, null, 2)
  };
}

function tryParseJson<T>(value: string, label: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

export default function AdminPage({ section }: AdminPageProps) {
  const toast = useToast();
  const { socket } = useAuth();
  const [userList, setUserList] = useState<UserListPayload>(INITIAL_USER_LIST);
  const [searchInput, setSearchInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [userEditor, setUserEditor] = useState(() => createUserEditorState(null));
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [maps, setMaps] = useState<OnlineMapOverview[]>([]);
  const [totalOnlinePlayers, setTotalOnlinePlayers] = useState(0);
  const [mapsFetchedAt, setMapsFetchedAt] = useState<string | null>(null);
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, { description: string; permissions: AdminRolePermission[] }>>({});
  const [isSavingRoleKey, setIsSavingRoleKey] = useState<string | null>(null);
  const selectedUserIdRef = useRef<number | null>(null);

  const loadUsers = useCallback((page = userList.page, search = userList.search) => {
    socket?.emit('admin:users:list', {
      page,
      pageSize: userList.pageSize,
      search
    });
  }, [socket, userList.page, userList.pageSize, userList.search]);

  const loadMaps = useCallback(() => {
    socket?.emit('moderation:maps:list');
  }, [socket]);

  const loadRoles = useCallback(() => {
    socket?.emit('admin:roles:list');
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleUsers = (payload: UserListPayload) => {
      setUserList(payload);
      setSearchInput(payload.search);
    };

    const handleUserDetails = ({ user }: { user: AdminUserDetails | null }) => {
      setSelectedUser(user);
      selectedUserIdRef.current = user?.id ?? null;
      setUserEditor(createUserEditorState(user));
      setIsSavingUser(false);
      loadUsers();
    };

    const handleRoles = ({ roles: nextRoles }: { roles: AdminRoleDefinition[] }) => {
      setRoles(nextRoles);
      setRoleDrafts(nextRoles.reduce<Record<string, { description: string; permissions: AdminRolePermission[] }>>((accumulator, role) => {
        accumulator[role.key] = {
          description: role.description,
          permissions: role.permissions
        };
        return accumulator;
      }, {}));
      setIsSavingRoleKey(null);
    };

    const handleMaps = (payload: {
      maps: OnlineMapOverview[]
      totalOnlinePlayers: number
      fetchedAt: string
    }) => {
      setMaps(payload.maps);
      setTotalOnlinePlayers(payload.totalOnlinePlayers);
      setMapsFetchedAt(payload.fetchedAt);
    };

    const handleAdminError = ({ message }: { message: string }) => {
      setIsSavingUser(false);
      setIsSavingRoleKey(null);
      toast({
        title: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
        position: 'top'
      });
    };

    const handleModerationError = ({ message }: { message: string }) => {
      toast({
        title: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
        position: 'top'
      });
    };

    socket.on('admin:users:list', handleUsers);
    socket.on('admin:user:details', handleUserDetails);
    socket.on('admin:roles:list', handleRoles);
    socket.on('moderation:maps:list', handleMaps);
    socket.on('admin:error', handleAdminError);
    socket.on('moderation:error', handleModerationError);

    return () => {
      socket.off('admin:users:list', handleUsers);
      socket.off('admin:user:details', handleUserDetails);
      socket.off('admin:roles:list', handleRoles);
      socket.off('moderation:maps:list', handleMaps);
      socket.off('admin:error', handleAdminError);
      socket.off('moderation:error', handleModerationError);
    };
  }, [loadUsers, socket, toast]);

  useEffect(() => {
    if (section === 'users') {
      loadUsers();
      return;
    }

    if (section === 'maps') {
      loadMaps();
      return;
    }

    loadRoles();
  }, [loadMaps, loadRoles, loadUsers, section]);

  const selectedUserStats = useMemo(() => ({
    pokemonCount: selectedUser?.pokemonParty.length ?? 0,
    inventoryCount: selectedUser?.inventory.length ?? 0,
    battleHistoryCount: selectedUser?.battleHistory.length ?? 0
  }), [selectedUser]);

  const openUser = (userId: number) => {
    selectedUserIdRef.current = userId;
    socket?.emit('admin:user:get', { userId });
  };

  const saveUser = () => {
    if (!selectedUser) {
      return;
    }

    try {
      const money = Number(userEditor.money);
      const mapX = Number(userEditor.mapX);
      const mapY = Number(userEditor.mapY);

      if (!Number.isFinite(money)) {
        throw new Error('Money must be a valid number.');
      }

      setIsSavingUser(true);
      socket?.emit('admin:user:update', {
        userId: selectedUser.id,
        updates: {
          name: userEditor.name,
          role: userEditor.role,
          profileImage: userEditor.profileImage,
          description: userEditor.description,
          trainerGender: userEditor.trainerGender,
          money,
          emailVerified: userEditor.emailVerified,
          savedLocation: userEditor.mapId.trim()
            ? {
                mapId: userEditor.mapId.trim(),
                x: mapX,
                y: mapY
              }
            : undefined,
          inventory: tryParseJson(userEditor.inventoryJson, 'Inventory'),
          pokemonParty: tryParseJson(userEditor.pokemonPartyJson, 'Pokemon party'),
          battleHistory: tryParseJson(userEditor.battleHistoryJson, 'Battle history')
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare user update.';
      toast({
        title: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
        position: 'top'
      });
      setIsSavingUser(false);
    }
  };

  const saveRole = (roleKey: AdminUserRole) => {
    const draft = roleDrafts[roleKey];
    if (!draft) {
      return;
    }

    setIsSavingRoleKey(roleKey);
    socket?.emit('admin:role:update', {
      roleKey,
      description: draft.description,
      permissions: draft.permissions
    });
  };

  return (
    <Box minH="100vh" bg="linear-gradient(180deg, #eef4ea 0%, #dde7db 100%)" px={{ base: 4, lg: 8 }} py={{ base: 5, lg: 8 }}>
      <Box maxW="1400px" mx="auto">
        <Stack spacing={6}>
          <Box
            borderRadius="32px"
            bg="rgba(255,255,255,0.84)"
            border="1px solid rgba(56, 78, 58, 0.14)"
            boxShadow="0 28px 60px rgba(52, 68, 53, 0.12)"
            p={{ base: 5, lg: 8 }}
          >
            <Stack spacing={5}>
              <Box>
                <Text fontSize="sm" textTransform="uppercase" letterSpacing="0.18em" color="#6a7a63" fontWeight="700">
                  Admin
                </Text>
                <Text fontSize={{ base: '2xl', lg: '4xl' }} fontWeight="900" color="#1f2d22" lineHeight="1">
                  Control roles, users, and live world visibility.
                </Text>
              </Box>

              <HStack spacing={3} flexWrap="wrap">
                {(['users', 'maps', 'roles'] as AdminSection[]).map((item) => (
                  <Button
                    key={item}
                    as={RouterLink}
                    to={item === 'users' ? '/admin/users' : item === 'maps' ? '/admin/maps' : '/admin/roles'}
                    colorScheme={section === item ? 'green' : 'gray'}
                    variant={section === item ? 'solid' : 'outline'}
                    borderRadius="full"
                  >
                    {SECTION_LABELS[item]}
                  </Button>
                ))}
                <Button as={RouterLink} to="/" variant="ghost" colorScheme="gray" borderRadius="full">
                  Back To Game
                </Button>
              </HStack>
            </Stack>
          </Box>

          {section === 'users' ? (
            <Grid templateColumns={{ base: '1fr', xl: '1.2fr 0.8fr' }} gap={6}>
              <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
                <Stack spacing={5}>
                  <HStack justify="space-between" align="flex-end" flexWrap="wrap" spacing={4}>
                    <Box>
                      <Text fontSize="2xl" fontWeight="800" color="#1f2d22">Users</Text>
                      <Text color="#68776b">Search accounts, review activity, and open a granular editor.</Text>
                    </Box>
                    <HStack>
                      <Input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search username, email, role..."
                        bg="#f5f7f2"
                      />
                      <Button colorScheme="green" onClick={() => loadUsers(1, searchInput)}>
                        Search
                      </Button>
                    </HStack>
                  </HStack>

                  <Box overflowX="auto">
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>User</Th>
                          <Th>Role</Th>
                          <Th>Pokemon</Th>
                          <Th>Inventory</Th>
                          <Th>Created</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {userList.users.map((user) => (
                          <Tr
                            key={user.id}
                            cursor="pointer"
                            onClick={() => openUser(user.id)}
                            bg={selectedUser?.id === user.id ? '#edf7ee' : undefined}
                            _hover={{ bg: '#f4faf4' }}
                          >
                            <Td>
                              <Stack spacing={0}>
                                <Text fontWeight="700">{user.username}</Text>
                                <Text fontSize="xs" color="#69776b">{user.email}</Text>
                              </Stack>
                            </Td>
                            <Td>
                              <Badge colorScheme={user.role === 'admin' ? 'red' : user.role === 'designer' ? 'green' : user.role === 'moderator' ? 'orange' : 'gray'}>
                                {user.role}
                              </Badge>
                            </Td>
                            <Td>{user.pokemonCount}</Td>
                            <Td>{user.inventoryQuantity}</Td>
                            <Td>{new Date(user.createdAt).toLocaleDateString()}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>

                  <HStack justify="space-between" flexWrap="wrap" spacing={4}>
                    <Text color="#657367">
                      Showing page {userList.page} of {userList.totalPages} for {userList.total} user{userList.total === 1 ? '' : 's'}.
                    </Text>
                    <HStack>
                      <Button variant="outline" onClick={() => loadUsers(Math.max(1, userList.page - 1))} isDisabled={userList.page <= 1}>
                        Previous
                      </Button>
                      <Button variant="outline" onClick={() => loadUsers(Math.min(userList.totalPages, userList.page + 1))} isDisabled={userList.page >= userList.totalPages}>
                        Next
                      </Button>
                    </HStack>
                  </HStack>
                </Stack>
              </Box>

              <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
                {!selectedUser ? (
                  <Stack spacing={3}>
                    <Text fontSize="xl" fontWeight="800" color="#1f2d22">User Editor</Text>
                    <Text color="#657367">Choose a user from the list to edit roles, party data, inventory, battle history, and saved map position.</Text>
                  </Stack>
                ) : (
                  <Stack spacing={5}>
                    <HStack justify="space-between" align="flex-start">
                      <Box>
                        <Text fontSize="xl" fontWeight="800" color="#1f2d22">{selectedUser.username}</Text>
                        <Text color="#657367">{selectedUser.email}</Text>
                      </Box>
                      <Badge colorScheme="purple">User #{selectedUser.id}</Badge>
                    </HStack>

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <FormControl>
                        <FormLabel>Name</FormLabel>
                        <Input value={userEditor.name} onChange={(event) => setUserEditor((current) => ({ ...current, name: event.target.value }))} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Role</FormLabel>
                        <Select value={userEditor.role} onChange={(event) => setUserEditor((current) => ({ ...current, role: event.target.value as AdminUserRole }))}>
                          <option value="admin">admin</option>
                          <option value="designer">designer</option>
                          <option value="moderator">moderator</option>
                          <option value="user">user</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Profile Image</FormLabel>
                        <Input value={userEditor.profileImage} onChange={(event) => setUserEditor((current) => ({ ...current, profileImage: event.target.value }))} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Trainer Gender</FormLabel>
                        <Input value={userEditor.trainerGender} onChange={(event) => setUserEditor((current) => ({ ...current, trainerGender: event.target.value }))} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Money</FormLabel>
                        <Input value={userEditor.money} onChange={(event) => setUserEditor((current) => ({ ...current, money: event.target.value }))} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Email Verified</FormLabel>
                        <Select value={userEditor.emailVerified ? 'yes' : 'no'} onChange={(event) => setUserEditor((current) => ({ ...current, emailVerified: event.target.value === 'yes' }))}>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </Select>
                      </FormControl>
                    </SimpleGrid>

                    <FormControl>
                      <FormLabel>Description</FormLabel>
                      <Textarea value={userEditor.description} onChange={(event) => setUserEditor((current) => ({ ...current, description: event.target.value }))} rows={3} />
                    </FormControl>

                    <Box borderRadius="20px" bg="#f6f8f3" p={4}>
                      <Text fontWeight="800" mb={3}>Saved Map Position</Text>
                      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                        <FormControl>
                          <FormLabel>Map Id</FormLabel>
                          <Input value={userEditor.mapId} onChange={(event) => setUserEditor((current) => ({ ...current, mapId: event.target.value }))} />
                        </FormControl>
                        <FormControl>
                          <FormLabel>X</FormLabel>
                          <Input value={userEditor.mapX} onChange={(event) => setUserEditor((current) => ({ ...current, mapX: event.target.value }))} />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Y</FormLabel>
                          <Input value={userEditor.mapY} onChange={(event) => setUserEditor((current) => ({ ...current, mapY: event.target.value }))} />
                        </FormControl>
                      </SimpleGrid>
                    </Box>

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <Badge colorScheme="green" px={3} py={2} borderRadius="full">
                        {selectedUserStats.pokemonCount} Pokemon
                      </Badge>
                      <Badge colorScheme="blue" px={3} py={2} borderRadius="full">
                        {selectedUserStats.inventoryCount} Inventory Entries
                      </Badge>
                      <Badge colorScheme="orange" px={3} py={2} borderRadius="full">
                        {selectedUserStats.battleHistoryCount} Battles
                      </Badge>
                    </SimpleGrid>

                    <FormControl>
                      <FormLabel>Inventory JSON</FormLabel>
                      <Textarea value={userEditor.inventoryJson} onChange={(event) => setUserEditor((current) => ({ ...current, inventoryJson: event.target.value }))} rows={8} fontFamily="mono" fontSize="sm" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Pokemon Party JSON</FormLabel>
                      <Textarea value={userEditor.pokemonPartyJson} onChange={(event) => setUserEditor((current) => ({ ...current, pokemonPartyJson: event.target.value }))} rows={8} fontFamily="mono" fontSize="sm" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Battle History JSON</FormLabel>
                      <Textarea value={userEditor.battleHistoryJson} onChange={(event) => setUserEditor((current) => ({ ...current, battleHistoryJson: event.target.value }))} rows={8} fontFamily="mono" fontSize="sm" />
                    </FormControl>

                    <Button colorScheme="green" onClick={saveUser} isLoading={isSavingUser}>
                      Save User Changes
                    </Button>
                  </Stack>
                )}
              </Box>
            </Grid>
          ) : null}

          {section === 'maps' ? (
            <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
              <Stack spacing={4}>
                <HStack justify="space-between" flexWrap="wrap" spacing={4}>
                  <Box>
                    <Text fontSize="2xl" fontWeight="800" color="#1f2d22">Maps With Active Online Players</Text>
                    <Text color="#68776b">See where the live population is gathering right now.</Text>
                  </Box>
                  <Button colorScheme="green" variant="outline" onClick={loadMaps}>Refresh</Button>
                </HStack>
                <MapsOverview
                  maps={maps}
                  totalOnlinePlayers={totalOnlinePlayers}
                  fetchedAt={mapsFetchedAt}
                  emptyMessage="No active players are connected right now."
                />
              </Stack>
            </Box>
          ) : null}

          {section === 'roles' ? (
            <Stack spacing={5}>
              {roles.map((role) => {
                const draft = roleDrafts[role.key];

                return (
                  <Box key={role.key} borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
                    <Stack spacing={4}>
                      <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={4}>
                        <Box>
                          <Text fontSize="2xl" fontWeight="800" color="#1f2d22">{role.name}</Text>
                          <Text color="#68776b">{role.userCount} assigned user{role.userCount === 1 ? '' : 's'}</Text>
                        </Box>
                        <Badge colorScheme={role.key === 'admin' ? 'red' : role.key === 'designer' ? 'green' : role.key === 'moderator' ? 'orange' : 'gray'}>
                          {role.key}
                        </Badge>
                      </HStack>

                      <FormControl>
                        <FormLabel>Description</FormLabel>
                        <Textarea
                          value={draft?.description ?? role.description}
                          onChange={(event) => setRoleDrafts((current) => ({
                            ...current,
                            [role.key]: {
                              description: event.target.value,
                              permissions: current[role.key]?.permissions ?? role.permissions
                            }
                          }))}
                          rows={3}
                        />
                      </FormControl>

                      <Stack spacing={3}>
                        <Text fontWeight="700" color="#223126">Permissions</Text>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                          {PERMISSION_OPTIONS.map((permission) => {
                            const checked = (draft?.permissions ?? role.permissions).includes(permission.value);

                            return (
                              <Button
                                key={permission.value}
                                variant={checked ? 'solid' : 'outline'}
                                colorScheme={checked ? 'green' : 'gray'}
                                justifyContent="flex-start"
                                onClick={() => {
                                  if (role.key === 'admin') {
                                    return;
                                  }

                                  setRoleDrafts((current) => {
                                    const currentPermissions = current[role.key]?.permissions ?? role.permissions;
                                    const nextPermissions = checked
                                      ? currentPermissions.filter((item) => item !== permission.value)
                                      : [...currentPermissions, permission.value];

                                    return {
                                      ...current,
                                      [role.key]: {
                                        description: current[role.key]?.description ?? role.description,
                                        permissions: nextPermissions
                                      }
                                    };
                                  });
                                }}
                                isDisabled={role.key === 'admin'}
                              >
                                {permission.label}
                              </Button>
                            );
                          })}
                        </SimpleGrid>
                      </Stack>

                      <Button
                        alignSelf="flex-start"
                        colorScheme="green"
                        onClick={() => saveRole(role.key)}
                        isLoading={isSavingRoleKey === role.key}
                      >
                        Save Role
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
