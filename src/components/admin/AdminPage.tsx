import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/authContext';
import ApiKeysManager from './ApiKeysManager';
import MapsOverview from './MapsOverview';
import UsersSection from './users/UsersSection';
import type {
  AdminRoleDefinition,
  AdminRolePermission,
  AdminUserRole,
  OnlineMapOverview
} from './types';

type AdminSection = 'users' | 'maps' | 'roles' | 'apikeys';

type AdminPageProps = {
  section: AdminSection
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
  roles: 'Roles Manager',
  apikeys: 'API Keys'
};

const SECTION_ROUTES: Record<AdminSection, string> = {
  users: '/admin/users',
  maps: '/admin/maps',
  roles: '/admin/roles',
  apikeys: '/admin/api-keys'
};

export default function AdminPage({ section }: AdminPageProps) {
  const toast = useToast();
  const { socket } = useAuth();
  const [maps, setMaps] = useState<OnlineMapOverview[]>([]);
  const [totalOnlinePlayers, setTotalOnlinePlayers] = useState(0);
  const [mapsFetchedAt, setMapsFetchedAt] = useState<string | null>(null);
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, { description: string; permissions: AdminRolePermission[] }>>({});
  const [isSavingRoleKey, setIsSavingRoleKey] = useState<string | null>(null);

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

    // Re-request the active section's data after a reconnect — any response
    // that was in flight when the socket dropped is gone for good.
    const handleReconnect = () => {
      if (section === 'maps') {
        loadMaps();
      } else if (section === 'roles') {
        loadRoles();
      }
    };

    const handleDisconnect = () => {
      setIsSavingRoleKey(null);
    };

    socket.on('admin:roles:list', handleRoles);
    socket.on('moderation:maps:list', handleMaps);
    socket.on('admin:error', handleAdminError);
    socket.on('moderation:error', handleModerationError);
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('admin:roles:list', handleRoles);
      socket.off('moderation:maps:list', handleMaps);
      socket.off('admin:error', handleAdminError);
      socket.off('moderation:error', handleModerationError);
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, toast, section, loadMaps, loadRoles]);

  useEffect(() => {
    if (section === 'maps') {
      loadMaps();
      return;
    }

    if (section === 'roles') {
      loadRoles();
    }
    // 'users' is self-loading via <UsersSection />; 'apikeys' via <ApiKeysManager />
  }, [loadMaps, loadRoles, section]);

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
                {(['users', 'maps', 'roles', 'apikeys'] as AdminSection[]).map((item) => (
                  <Button
                    key={item}
                    as={RouterLink}
                    to={SECTION_ROUTES[item]}
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

          {section === 'users' ? <UsersSection socket={socket} /> : null}

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

          {section === 'apikeys' ? <ApiKeysManager /> : null}
        </Stack>
      </Box>
    </Box>
  );
}
