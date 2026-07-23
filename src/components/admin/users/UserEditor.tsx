import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import type {
  AdminCatalogPayload,
  AdminEventState,
  AdminInventoryItem,
  AdminPokemonSummary,
  AdminUserDetails,
  AdminUserRole,
  AdminUserStorage
} from '../types';
import EventStateEditor from './EventStateEditor';
import InventoryEditor from './InventoryEditor';
import MapLocationEditor from './MapLocationEditor';
import PokemonEditor from './PokemonEditor';
import SecurityPanel from './SecurityPanel';
import StorageViewer from './StorageViewer';

// Partial on purpose: each tab applies only its own fields and the server
// updates just what is present in the payload.
export type UserUpdatePayload = Partial<{
  name: string
  role: AdminUserRole
  profileImage: string
  description: string
  trainerGender: string
  money: number
  emailVerified: boolean
  savedLocation: { mapId: string; x: number; y: number }
  inventory: AdminInventoryItem[]
  pokemonParty: AdminPokemonSummary[]
}>

type UserEditorProps = {
  user: AdminUserDetails
  catalog: AdminCatalogPayload
  online: boolean
  isSaving: boolean
  isSettingPassword: boolean
  isSendingRecovery: boolean
  isDeleting: boolean
  isDisconnecting: boolean
  eventState: AdminEventState | null
  eventStateLoading: boolean
  isSavingEventState: boolean
  storage: AdminUserStorage | null
  storageLoading: boolean
  onSave: (updates: UserUpdatePayload) => void
  onResetProgress: () => void
  onSetPassword: (newPassword: string) => void
  onSendRecovery: () => void
  onDeleteUser: () => void
  onDisconnect: () => void
  onLoadEventState: () => void
  onSaveEventState: (next: { switches: Record<string, boolean>; variables: Record<string, number> }) => void
  onLoadStorage: () => void
}

type EditorState = {
  name: string
  role: AdminUserRole
  profileImage: string
  description: string
  trainerGender: string
  money: string
  emailVerified: boolean
  mapId: string
  mapX: string
  mapY: string
  inventory: AdminInventoryItem[]
  pokemonParty: AdminPokemonSummary[]
}

type EditableTab = 'profile' | 'location' | 'inventory' | 'party'

const TAB_FIELDS: Record<EditableTab, Array<keyof EditorState>> = {
  profile: ['name', 'role', 'profileImage', 'description', 'trainerGender', 'money', 'emailVerified'],
  location: ['mapId', 'mapX', 'mapY'],
  inventory: ['inventory'],
  party: ['pokemonParty']
};

function buildEditorState(user: AdminUserDetails): EditorState {
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
    inventory: user.inventory,
    pokemonParty: user.pokemonParty
  };
}

// Enrichment fields (icons) are read-only decorations; drop them before saving
// so they never leak into persisted storage.
function stripInventory(items: AdminInventoryItem[]) {
  return items.map(({ iconSrc, ...rest }) => rest);
}

function stripParty(party: AdminPokemonSummary[]) {
  return party.map(({ iconImageSrc, frontImageSrc, ...rest }) => rest);
}

function DirtyDot() {
  return <Box as="span" ml={2} w="7px" h="7px" borderRadius="full" bg="#e0a13c" display="inline-block" />;
}

export default function UserEditor(props: UserEditorProps) {
  const {
    user,
    catalog,
    online,
    isSaving,
    isSettingPassword,
    isSendingRecovery,
    isDeleting,
    isDisconnecting,
    eventState,
    eventStateLoading,
    isSavingEventState,
    storage,
    storageLoading,
    onSave,
    onResetProgress,
    onSetPassword,
    onSendRecovery,
    onDeleteUser,
    onDisconnect,
    onLoadEventState,
    onSaveEventState,
    onLoadStorage
  } = props;
  const toast = useToast();
  const [editor, setEditor] = useState<EditorState>(() => buildEditorState(user));
  const [dirtyTabs, setDirtyTabs] = useState<Set<EditableTab>>(() => new Set());
  const [savingTab, setSavingTab] = useState<EditableTab | null>(null);
  const [variablesDirty, setVariablesDirty] = useState(false);
  const dirtyTabsRef = useRef(dirtyTabs);
  dirtyTabsRef.current = dirtyTabs;

  // Lazy per-tab data: request event state / storage the first time their
  // tabs are opened (index matches the TabList order below).
  const requestedRef = useRef<{ variables: boolean; storage: boolean }>({ variables: false, storage: false });
  const handleTabChange = (index: number) => {
    if (index === 4 && !requestedRef.current.variables) {
      requestedRef.current.variables = true;
      onLoadEventState();
    }
    if (index === 5 && !requestedRef.current.storage) {
      requestedRef.current.storage = true;
      onLoadStorage();
    }
  };

  // Re-seed whenever a different user is opened or the server returns a fresh
  // copy after an apply — but keep the local edits of tabs that still have
  // unapplied changes, so applying one tab never clobbers another.
  useEffect(() => {
    setEditor((current) => {
      const fresh = buildEditorState(user);
      dirtyTabsRef.current.forEach((tab) => {
        TAB_FIELDS[tab].forEach((field) => {
          (fresh as any)[field] = current[field];
        });
      });
      return fresh;
    });
  }, [user]);

  useEffect(() => {
    if (!isSaving) {
      setSavingTab(null);
    }
  }, [isSaving]);

  const patchTab = (tab: EditableTab) => (next: Partial<EditorState>) => {
    setEditor((current) => ({ ...current, ...next }));
    setDirtyTabs((current) => {
      if (current.has(tab)) {
        return current;
      }
      const nextSet = new Set(current);
      nextSet.add(tab);
      return nextSet;
    });
  };

  const patchProfile = patchTab('profile');
  const patchLocation = patchTab('location');
  const patchInventory = patchTab('inventory');
  const patchParty = patchTab('party');

  const markClean = (tab: EditableTab) => {
    setDirtyTabs((current) => {
      if (!current.has(tab)) {
        return current;
      }
      const nextSet = new Set(current);
      nextSet.delete(tab);
      return nextSet;
    });
  };

  const apply = (tab: EditableTab, updates: UserUpdatePayload) => {
    setSavingTab(tab);
    markClean(tab);
    onSave(updates);
  };

  const applyProfile = () => {
    const money = Number(editor.money);
    if (!Number.isFinite(money)) {
      toast({ title: 'Money must be a valid number.', status: 'error', duration: 3500, position: 'top' });
      return;
    }

    apply('profile', {
      name: editor.name,
      role: editor.role,
      profileImage: editor.profileImage,
      description: editor.description,
      trainerGender: editor.trainerGender,
      money,
      emailVerified: editor.emailVerified
    });
  };

  const applyLocation = () => {
    const trimmedMapId = editor.mapId.trim();
    if (!trimmedMapId) {
      toast({ title: 'Choose a map before applying the location.', status: 'error', duration: 3500, position: 'top' });
      return;
    }

    const mapX = Number(editor.mapX);
    const mapY = Number(editor.mapY);
    if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
      toast({ title: 'Map coordinates must be numbers.', status: 'error', duration: 3500, position: 'top' });
      return;
    }

    apply('location', { savedLocation: { mapId: trimmedMapId, x: mapX, y: mapY } });
  };

  const applyInventory = () => {
    apply('inventory', { inventory: stripInventory(editor.inventory) });
  };

  const applyParty = () => {
    apply('party', { pokemonParty: stripParty(editor.pokemonParty) });
  };

  const resetProgress = () => {
    const confirmed = window.confirm(
      `Reset ${user.username}'s adventure? Their party, inventory, money, battle history, and saved location will return to a fresh start.`
    );
    if (confirmed) {
      onResetProgress();
    }
  };

  const applyButton = (tab: EditableTab, onApply: () => void) => (
    <HStack justify="flex-end" pt={2}>
      <Button
        colorScheme="green"
        onClick={onApply}
        isLoading={isSaving && savingTab === tab}
        isDisabled={isSaving && savingTab !== tab}
      >
        Apply
      </Button>
    </HStack>
  );

  return (
    <Stack spacing={5}>
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={3}>
        <Box>
          <HStack spacing={2}>
            <Text fontSize="xl" fontWeight="800" color="#1f2d22">{user.username}</Text>
            <Badge colorScheme={online ? 'green' : 'gray'} borderRadius="full">
              {online ? '● Online' : 'Offline'}
            </Badge>
          </HStack>
          <Text color="#657367">{user.email}</Text>
        </Box>
        <HStack spacing={2}>
          <Tooltip
            label={online ? 'Drop every live session of this trainer' : 'This trainer is not connected'}
            openDelay={300}
          >
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              isDisabled={!online}
              isLoading={isDisconnecting}
              onClick={() => {
                if (window.confirm(`Disconnect ${user.username} from the game? They can log back in at any time.`)) {
                  onDisconnect();
                }
              }}
            >
              Disconnect
            </Button>
          </Tooltip>
          <Badge colorScheme="purple">User #{user.id}</Badge>
        </HStack>
      </HStack>

      <Tabs colorScheme="green" variant="soft-rounded" size="sm" isLazy onChange={handleTabChange}>
        <TabList flexWrap="wrap" gap={1}>
          <Tab>Profile{dirtyTabs.has('profile') ? <DirtyDot /> : null}</Tab>
          <Tab>Location{dirtyTabs.has('location') ? <DirtyDot /> : null}</Tab>
          <Tab>Inventory{dirtyTabs.has('inventory') ? <DirtyDot /> : null}</Tab>
          <Tab>Party{dirtyTabs.has('party') ? <DirtyDot /> : null}</Tab>
          <Tab>Variables{variablesDirty ? <DirtyDot /> : null}</Tab>
          <Tab>PC Box</Tab>
          <Tab>Security</Tab>
          <Tab color="#a13636">Danger Zone</Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <Stack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Name</FormLabel>
                  <Input value={editor.name} onChange={(event) => patchProfile({ name: event.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel>Role</FormLabel>
                  <Select value={editor.role} onChange={(event) => patchProfile({ role: event.target.value as AdminUserRole })}>
                    <option value="admin">admin</option>
                    <option value="designer">designer</option>
                    <option value="moderator">moderator</option>
                    <option value="user">user</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Trainer Gender</FormLabel>
                  <Input value={editor.trainerGender} onChange={(event) => patchProfile({ trainerGender: event.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel>Money</FormLabel>
                  <Input value={editor.money} onChange={(event) => patchProfile({ money: event.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel>Email Verified</FormLabel>
                  <Select
                    value={editor.emailVerified ? 'yes' : 'no'}
                    onChange={(event) => patchProfile({ emailVerified: event.target.value === 'yes' })}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Profile Image</FormLabel>
                  <Input value={editor.profileImage} onChange={(event) => patchProfile({ profileImage: event.target.value })} />
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea value={editor.description} onChange={(event) => patchProfile({ description: event.target.value })} rows={2} />
              </FormControl>

              {applyButton('profile', applyProfile)}
            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={4}>
              <MapLocationEditor
                mapId={editor.mapId}
                x={editor.mapX}
                y={editor.mapY}
                maps={catalog.maps}
                onChange={(next) => patchLocation({
                  ...(next.mapId !== undefined ? { mapId: next.mapId } : {}),
                  ...(next.x !== undefined ? { mapX: next.x } : {}),
                  ...(next.y !== undefined ? { mapY: next.y } : {})
                })}
              />
              {applyButton('location', applyLocation)}
            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={4}>
              <InventoryEditor
                items={editor.inventory}
                catalog={catalog.items}
                onChange={(inventory) => patchInventory({ inventory })}
              />
              {applyButton('inventory', applyInventory)}
            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={4}>
              <PokemonEditor
                party={editor.pokemonParty}
                catalog={catalog.pokemons}
                onChange={(pokemonParty) => patchParty({ pokemonParty })}
              />
              {applyButton('party', applyParty)}
            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <EventStateEditor
              state={eventState}
              loading={eventStateLoading}
              onDirty={() => setVariablesDirty(true)}
              onApply={(next) => {
                setVariablesDirty(false);
                onSaveEventState(next);
              }}
              isSaving={isSavingEventState}
              applyDisabled={false}
            />
          </TabPanel>

          <TabPanel px={0}>
            <StorageViewer storage={storage} loading={storageLoading} />
          </TabPanel>

          <TabPanel px={0}>
            <SecurityPanel
              username={user.username}
              onSetPassword={onSetPassword}
              onSendRecovery={onSendRecovery}
              isSettingPassword={isSettingPassword}
              isSendingRecovery={isSendingRecovery}
            />
          </TabPanel>

          <TabPanel px={0}>
            <Box borderRadius="20px" border="1px solid #f0c4c4" bg="#fdf3f3" p={4}>
              <Text fontWeight="800" color="#a13636" mb={2}>Danger zone</Text>
              <HStack justify="space-between" flexWrap="wrap" spacing={3}>
                <Box>
                  <Text fontWeight="600" fontSize="sm">Reset adventure</Text>
                  <Text fontSize="xs" color="#9a6b6b">Wipes party, inventory, money, battles, and location — the account stays.</Text>
                </Box>
                <Button colorScheme="red" variant="outline" onClick={resetProgress}>Reset adventure</Button>
              </HStack>
              <Divider my={3} borderColor="#f0c4c4" />
              <HStack justify="space-between" flexWrap="wrap" spacing={3}>
                <Box>
                  <Text fontWeight="600" fontSize="sm">Delete user</Text>
                  <Text fontSize="xs" color="#9a6b6b">Permanently removes the account and all of its data. Cannot be undone.</Text>
                </Box>
                <DeleteUserButton username={user.username} isDeleting={isDeleting} onConfirm={onDeleteUser} />
              </HStack>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Stack>
  );
}

function DeleteUserButton({
  username,
  isDeleting,
  onConfirm
}: {
  username: string
  isDeleting: boolean
  onConfirm: () => void
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [confirmText, setConfirmText] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const canDelete = confirmText.trim() === username;

  const close = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <>
      <Button colorScheme="red" onClick={onOpen}>Delete user</Button>
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={close} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="20px">
            <AlertDialogHeader fontWeight="800">Delete {username}?</AlertDialogHeader>
            <AlertDialogBody>
              <Text mb={3} color="#54615a">
                This permanently deletes the account and <b>all of its data</b> — party, inventory,
                money, battle history, saved location, and event progress. This cannot be undone.
              </Text>
              <FormControl>
                <FormLabel fontSize="sm">Type <b>{username}</b> to confirm</FormLabel>
                <Input
                  autoFocus
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={username}
                />
              </FormControl>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={close} variant="ghost">Cancel</Button>
              <Button
                colorScheme="red"
                ml={3}
                isDisabled={!canDelete}
                isLoading={isDeleting}
                onClick={() => {
                  onConfirm();
                  close();
                }}
              >
                Delete permanently
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
