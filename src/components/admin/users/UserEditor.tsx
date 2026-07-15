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
  Text,
  Textarea,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import type {
  AdminCatalogPayload,
  AdminInventoryItem,
  AdminPokemonSummary,
  AdminUserDetails,
  AdminUserRole
} from '../types';
import InventoryEditor from './InventoryEditor';
import MapLocationEditor from './MapLocationEditor';
import PokemonEditor from './PokemonEditor';
import SecurityPanel from './SecurityPanel';

export type UserUpdatePayload = {
  name: string
  role: AdminUserRole
  profileImage: string
  description: string
  trainerGender: string
  money: number
  emailVerified: boolean
  savedLocation?: { mapId: string; x: number; y: number }
  inventory: AdminInventoryItem[]
  pokemonParty: AdminPokemonSummary[]
}

type UserEditorProps = {
  user: AdminUserDetails
  catalog: AdminCatalogPayload
  online: boolean
  isSaving: boolean
  isSettingPassword: boolean
  isSendingRecovery: boolean
  isDeleting: boolean
  onSave: (updates: UserUpdatePayload) => void
  onResetProgress: () => void
  onSetPassword: (newPassword: string) => void
  onSendRecovery: () => void
  onDeleteUser: () => void
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

export default function UserEditor(props: UserEditorProps) {
  const {
    user,
    catalog,
    online,
    isSaving,
    isSettingPassword,
    isSendingRecovery,
    isDeleting,
    onSave,
    onResetProgress,
    onSetPassword,
    onSendRecovery,
    onDeleteUser
  } = props;
  const toast = useToast();
  const [editor, setEditor] = useState<EditorState>(() => buildEditorState(user));

  // Re-seed the form whenever a different user is opened or the server returns
  // a fresh copy after a save/reset.
  useEffect(() => {
    setEditor(buildEditorState(user));
  }, [user]);

  const patch = (next: Partial<EditorState>) => setEditor((current) => ({ ...current, ...next }));

  const save = () => {
    const money = Number(editor.money);
    if (!Number.isFinite(money)) {
      toast({ title: 'Money must be a valid number.', status: 'error', duration: 3500, position: 'top' });
      return;
    }

    const trimmedMapId = editor.mapId.trim();
    const mapX = Number(editor.mapX);
    const mapY = Number(editor.mapY);
    if (trimmedMapId && (!Number.isFinite(mapX) || !Number.isFinite(mapY))) {
      toast({ title: 'Map coordinates must be numbers.', status: 'error', duration: 3500, position: 'top' });
      return;
    }

    onSave({
      name: editor.name,
      role: editor.role,
      profileImage: editor.profileImage,
      description: editor.description,
      trainerGender: editor.trainerGender,
      money,
      emailVerified: editor.emailVerified,
      savedLocation: trimmedMapId ? { mapId: trimmedMapId, x: mapX, y: mapY } : undefined,
      inventory: stripInventory(editor.inventory),
      pokemonParty: stripParty(editor.pokemonParty)
    });
  };

  const resetProgress = () => {
    const confirmed = window.confirm(
      `Reset ${user.username}'s adventure? Their party, inventory, money, battle history, and saved location will return to a fresh start.`
    );
    if (confirmed) {
      onResetProgress();
    }
  };

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
        <Badge colorScheme="purple">User #{user.id}</Badge>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <FormControl>
          <FormLabel>Name</FormLabel>
          <Input value={editor.name} onChange={(event) => patch({ name: event.target.value })} />
        </FormControl>
        <FormControl>
          <FormLabel>Role</FormLabel>
          <Select value={editor.role} onChange={(event) => patch({ role: event.target.value as AdminUserRole })}>
            <option value="admin">admin</option>
            <option value="designer">designer</option>
            <option value="moderator">moderator</option>
            <option value="user">user</option>
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>Trainer Gender</FormLabel>
          <Input value={editor.trainerGender} onChange={(event) => patch({ trainerGender: event.target.value })} />
        </FormControl>
        <FormControl>
          <FormLabel>Money</FormLabel>
          <Input value={editor.money} onChange={(event) => patch({ money: event.target.value })} />
        </FormControl>
        <FormControl>
          <FormLabel>Email Verified</FormLabel>
          <Select
            value={editor.emailVerified ? 'yes' : 'no'}
            onChange={(event) => patch({ emailVerified: event.target.value === 'yes' })}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>Profile Image</FormLabel>
          <Input value={editor.profileImage} onChange={(event) => patch({ profileImage: event.target.value })} />
        </FormControl>
      </SimpleGrid>

      <FormControl>
        <FormLabel>Description</FormLabel>
        <Textarea value={editor.description} onChange={(event) => patch({ description: event.target.value })} rows={2} />
      </FormControl>

      <MapLocationEditor
        mapId={editor.mapId}
        x={editor.mapX}
        y={editor.mapY}
        maps={catalog.maps}
        onChange={(next) => patch({
          ...(next.mapId !== undefined ? { mapId: next.mapId } : {}),
          ...(next.x !== undefined ? { mapX: next.x } : {}),
          ...(next.y !== undefined ? { mapY: next.y } : {})
        })}
      />

      <Divider />

      <InventoryEditor
        items={editor.inventory}
        catalog={catalog.items}
        onChange={(inventory) => patch({ inventory })}
      />

      <Divider />

      <PokemonEditor
        party={editor.pokemonParty}
        catalog={catalog.pokemons}
        onChange={(pokemonParty) => patch({ pokemonParty })}
      />

      <Divider />

      <SecurityPanel
        username={user.username}
        onSetPassword={onSetPassword}
        onSendRecovery={onSendRecovery}
        isSettingPassword={isSettingPassword}
        isSendingRecovery={isSendingRecovery}
      />

      <HStack spacing={3} flexWrap="wrap" position="sticky" bottom={0} bg="white" py={2}>
        <Button colorScheme="green" onClick={save} isLoading={isSaving} size="lg">
          Save changes
        </Button>
      </HStack>

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
