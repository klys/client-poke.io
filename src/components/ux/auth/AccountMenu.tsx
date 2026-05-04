import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Progress,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  useAuth,
  type BattleHistoryEntry,
  type InventoryItem,
  type PokemonSummary
} from '../../../context/authContext';
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail
} from '../../designer/designerCache';
import type { DesignerItemSeed, DesignerPokemonProfile } from '../../designer/designerSections';
import { getPokemonDisplayName, validatePokemonNickname } from '../game/pokemonName';

type WindowKey = 'account' | 'settings' | 'bag' | 'pokemons' | 'trainerCard' | 'battleHistory';
type PokemonStatsWindowId = `pokemonStats:${string}`;
type OpenWindowId = WindowKey | PokemonStatsWindowId;

type WindowPosition = {
  x: number;
  y: number;
};

type DraggableWindowProps = {
  id: OpenWindowId;
  title: string;
  dragEnabled: boolean;
  position: WindowPosition;
  desktopWidth?: string;
  zIndex: number;
  onMove: (id: OpenWindowId, position: WindowPosition) => void;
  onFocus: (id: OpenWindowId) => void;
  onClose: (id: OpenWindowId) => void;
  children: ReactNode;
};

const WINDOW_TITLES: Record<WindowKey, string> = {
  account: 'Account',
  settings: 'Settings',
  bag: 'Bag',
  pokemons: 'Pokemons',
  trainerCard: 'Trainer Card',
  battleHistory: 'Battle History'
};

const DEFAULT_POSITIONS: Record<WindowKey, WindowPosition> = {
  account: { x: 48, y: 96 },
  settings: { x: 96, y: 132 },
  bag: { x: 132, y: 84 },
  pokemons: { x: 168, y: 120 },
  trainerCard: { x: 210, y: 156 },
  battleHistory: { x: 246, y: 192 }
};

const WINDOW_POSITIONS_KEY = 'client-poke.io.ux.windowPositions';
const DRAG_SETTING_KEY = 'client-poke.io.ux.dragWindows';
const BUG_REPORT_URL = 'https://github.com/klys/pokecraft/issues';
const POKEMON_STATS_WINDOW_POSITION: WindowPosition = { x: 224, y: 96 };
const POKEMON_STATS_WINDOW_OFFSET = 28;

type PokemonCatalogEntry = {
  id: string;
  name: string;
  profile: DesignerPokemonProfile;
};

function stopUxEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function toPokemonCatalogEntry(item: DesignerItemSeed): PokemonCatalogEntry | null {
  if (!item.pokemonProfile) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    profile: item.pokemonProfile
  };
}

function readPokemonCatalog() {
  return readStoredDesignerSectionPayload('pokemons').state.items
    .map(toPokemonCatalogEntry)
    .filter(Boolean) as PokemonCatalogEntry[];
}

function usePokemonCatalog() {
  const [catalog, setCatalog] = useState<PokemonCatalogEntry[]>(() => readPokemonCatalog());

  useEffect(() => {
    const syncCatalog = () => {
      setCatalog(readPokemonCatalog());
    };

    const handleDesignerCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;

      if (detail?.sectionKey === 'pokemons') {
        syncCatalog();
      }
    };

    syncCatalog();
    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);

    return () => {
      window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);
    };
  }, []);

  return useMemo(
    () => new Map(catalog.map((pokemon) => [pokemon.id, pokemon])),
    [catalog]
  );
}

function resolvePokemonCatalogEntry(
  pokemon: PokemonSummary,
  pokemonCatalog: Map<string, PokemonCatalogEntry>
) {
  return pokemonCatalog.get(pokemon.sourcePokemonId ?? '') ?? pokemonCatalog.get(pokemon.id) ?? null;
}

function MoreActionsIcon() {
  return (
    <Icon viewBox="0 0 24 24" boxSize={4}>
      <circle cx="6.5" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="17.5" cy="12" r="1.75" fill="currentColor" />
    </Icon>
  );
}

function PokemonStatTile({ label, value }: { label: string; value: string }) {
  return (
    <Box bg="whiteAlpha.100" border="1px solid rgba(255,255,255,0.12)" p={3} borderRadius="8px">
      <Text fontSize="xs" color="gray.400">{label}</Text>
      <Text fontWeight="700">{value}</Text>
    </Box>
  );
}

function loadStoredPositions() {
  try {
    const raw = window.localStorage.getItem(WINDOW_POSITIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return {
      ...DEFAULT_POSITIONS,
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    } as Record<string, WindowPosition>;
  } catch {
    return DEFAULT_POSITIONS;
  }
}

function createPokemonStatsWindowId(pokemonId: string): PokemonStatsWindowId {
  return `pokemonStats:${pokemonId}`;
}

function isPokemonStatsWindowId(value: OpenWindowId): value is PokemonStatsWindowId {
  return value.startsWith('pokemonStats:');
}

function getPokemonIdFromStatsWindow(value: PokemonStatsWindowId) {
  return value.slice('pokemonStats:'.length);
}

function DraggableWindow({
  id,
  title,
  dragEnabled,
  position,
  desktopWidth = '460px',
  zIndex,
  onMove,
  onFocus,
  onClose,
  children
}: DraggableWindowProps) {
  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    onFocus(id);
    stopUxEvent(event);

    if (!dragEnabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;

    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    stopUxEvent(event);
    const desktopWidthValue = desktopWidth.endsWith('px')
      ? Number.parseInt(desktopWidth, 10)
      : 460;
    const maxX = Math.max(8, window.innerWidth - Math.min(desktopWidthValue, window.innerWidth - 24));
    const maxY = Math.max(8, window.innerHeight - 120);

    onMove(id, {
      x: Math.max(8, Math.min(dragStart.originX + event.clientX - dragStart.startX, maxX)),
      y: Math.max(8, Math.min(dragStart.originY + event.clientY - dragStart.startY, maxY))
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null;
    }
  };

  return (
    <Box
      position="fixed"
      left={{ base: 3, md: `${position.x}px` }}
      top={{ base: 20, md: `${position.y}px` }}
      width={{ base: 'calc(100vw - 24px)', md: desktopWidth }}
      maxW="calc(100vw - 24px)"
      maxH="calc(100vh - 96px)"
      overflow="hidden"
      bg="rgba(17, 24, 39, 0.97)"
      border="1px solid rgba(255,255,255,0.16)"
      borderRadius="8px"
      boxShadow="0 24px 60px rgba(0,0,0,0.42)"
      color="white"
      zIndex={zIndex}
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={(event) => {
        onFocus(id);
        stopUxEvent(event);
      }}
      data-game-ux="true"
    >
      <HStack
        justify="space-between"
        px={4}
        py={3}
        bg="rgba(255,255,255,0.08)"
        cursor={dragEnabled ? 'move' : 'default'}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Text fontWeight="700">{title}</Text>
        <Button
          aria-label={`Close ${title}`}
          size="sm"
          variant="ghost"
          color="white"
          onPointerDown={stopUxEvent}
          onMouseDown={stopUxEvent}
          onClick={() => onClose(id)}
        >
          X
        </Button>
      </HStack>
      <Box p={4} overflowY="auto" maxH="calc(100vh - 156px)">
        {children}
      </Box>
    </Box>
  );
}

function AccountWindow() {
  const { user, changePassword, updateProfile } = useAuth();
  const [profileImage, setProfileImage] = useState(user?.profileImage ?? '');
  const [description, setDescription] = useState(user?.description ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setProfileImage(user?.profileImage ?? '');
    setDescription(user?.description ?? '');
  }, [user?.description, user?.profileImage]);

  return (
    <VStack align="stretch" spacing={4}>
      <HStack spacing={4}>
        <Avatar name={user?.name} src={user?.profileImage} size="lg" />
        <Box>
          <Text fontWeight="700">{user?.name}</Text>
          <Text color="gray.300">@{user?.username}</Text>
          <Text color="gray.300">{user?.email}</Text>
        </Box>
      </HStack>
      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
        <Box bg="whiteAlpha.100" p={3} borderRadius="8px">
          <Text fontSize="xs" color="gray.400">Email status</Text>
          <Badge colorScheme={user?.emailVerified ? 'green' : 'yellow'}>
            {user?.emailVerified ? 'Verified' : 'Pending'}
          </Badge>
        </Box>
        <Box bg="whiteAlpha.100" p={3} borderRadius="8px">
          <Text fontSize="xs" color="gray.400">User ID</Text>
          <Text>{user?.id}</Text>
        </Box>
      </SimpleGrid>
      <Divider borderColor="whiteAlpha.300" />
      <FormControl>
        <FormLabel>Profile image URL</FormLabel>
        <Input value={profileImage} onChange={(event) => setProfileImage(event.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>Short description</FormLabel>
        <Textarea
          resize="none"
          maxLength={50}
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, 50))}
        />
        <FormHelperText color="gray.400">{description.length}/50</FormHelperText>
      </FormControl>
      <Button colorScheme="teal" onClick={() => updateProfile({ profileImage, description })}>
        Save profile
      </Button>
      <Divider borderColor="whiteAlpha.300" />
      <FormControl>
        <FormLabel>Current password</FormLabel>
        <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>New password</FormLabel>
        <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      </FormControl>
      <Button
        onClick={() => {
          changePassword({ currentPassword, newPassword });
          setCurrentPassword('');
          setNewPassword('');
        }}
      >
        Change password
      </Button>
      <Link href={BUG_REPORT_URL} isExternal color="teal.200" fontWeight="700">
        Report bug
      </Link>
    </VStack>
  );
}

function SettingsWindow({
  dragEnabled,
  setDragEnabled,
  resetPositions
}: {
  dragEnabled: boolean;
  setDragEnabled: (value: boolean) => void;
  resetPositions: () => void;
}) {
  return (
    <VStack align="stretch" spacing={4}>
      <Button
        colorScheme={dragEnabled ? 'teal' : 'gray'}
        onClick={() => setDragEnabled(!dragEnabled)}
      >
        {dragEnabled ? 'Disable draggable screen' : 'Enable draggable screen'}
      </Button>
      <Button variant="outline" color="white" borderColor="whiteAlpha.400" onClick={resetPositions}>
        Reset screen positions
      </Button>
    </VStack>
  );
}

function BagWindow() {
  const {
    user,
    useInventoryItem: requestUseInventoryItem,
    teachInventoryMove,
    throwAwayInventoryItem
  } = useAuth();
  const items = user?.inventory ?? [];
  const party = user?.pokemonParty ?? [];
  const categories: Array<{ key: InventoryItem['category'] | 'all'; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'usable', label: 'Usable' },
    { key: 'berries', label: 'Berries' },
    { key: 'moves', label: 'Moves' },
    { key: 'quest', label: 'Quest Items' }
  ];
  const selectPokemonTarget = (item: InventoryItem) => {
    if (party.length === 0) {
      window.alert('You do not have Pokemon in your party.');
      return null;
    }

    const promptText = party
      .map((pokemon, index) => `${index + 1}. ${getPokemonDisplayName(pokemon)} HP ${pokemon.hp}/${pokemon.maxHp}`)
      .join('\n');
    const selection = window.prompt(`Select a Pokemon for ${item.name}:\n${promptText}`);
    const selectedIndex = selection ? Number.parseInt(selection, 10) - 1 : -1;

    return party[selectedIndex]?.id ?? null;
  };

  const handleUse = (item: InventoryItem) => {
    const targetPokemonId = selectPokemonTarget(item);

    if (targetPokemonId) {
      requestUseInventoryItem({ itemId: item.id, targetPokemonId });
    }
  };

  const handleTeach = (item: InventoryItem) => {
    const targetPokemonId = selectPokemonTarget(item);

    if (targetPokemonId) {
      teachInventoryMove({ itemId: item.id, targetPokemonId });
    }
  };

  const handleThrowAway = (item: InventoryItem) => {
    const quantityText = window.prompt(`How many ${item.name} do you want to throw away?`, '1');
    const quantity = quantityText ? Number.parseInt(quantityText, 10) : Number.NaN;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    throwAwayInventoryItem({
      itemId: item.id,
      quantity: Math.min(item.quantity, Math.round(quantity))
    });
  };

  return (
    <Tabs colorScheme="teal" variant="soft-rounded">
      <TabList flexWrap="wrap" gap={2}>
        {categories.map((category) => <Tab key={category.key}>{category.label}</Tab>)}
      </TabList>
      <TabPanels>
        {categories.map((category) => {
          const filteredItems = category.key === 'all'
            ? items
            : items.filter((item) => item.category === category.key);

          return (
            <TabPanel key={category.key} px={0}>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                {filteredItems.map((item) => (
                  <Box
                    key={item.id}
                    title={item.description}
                    bg="whiteAlpha.100"
                    border="1px solid rgba(255,255,255,0.12)"
                    p={3}
                    borderRadius="8px"
                  >
                    <HStack justify="space-between">
                      <Text fontWeight="700">{item.name}</Text>
                      <Badge>x{item.quantity}</Badge>
                    </HStack>
                    <Text color="gray.300" fontSize="sm">{item.description}</Text>
                    <HStack mt={3} spacing={2} flexWrap="wrap">
                      {item.category === 'usable' || item.category === 'berries' ? (
                        <Button size="xs" colorScheme="teal" onClick={() => handleUse(item)}>
                          Use
                        </Button>
                      ) : null}
                      {item.category === 'moves' ? (
                        <Button size="xs" colorScheme="purple" onClick={() => handleTeach(item)}>
                          Teach
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        variant="outline"
                        color="white"
                        borderColor="whiteAlpha.400"
                        onClick={() => handleThrowAway(item)}
                      >
                        Throw Away
                      </Button>
                    </HStack>
                  </Box>
                ))}
                {filteredItems.length === 0 ? <Text color="gray.400">No items in this pocket.</Text> : null}
              </SimpleGrid>
            </TabPanel>
          );
        })}
      </TabPanels>
    </Tabs>
  );
}

function TrainerCardWindow({ openBattleHistory }: { openBattleHistory: () => void }) {
  const { user } = useAuth();

  return (
    <Box bg="linear-gradient(135deg, #0f766e 0%, #1f2937 100%)" p={5} borderRadius="8px">
      <HStack spacing={4} align="center">
        <Avatar name={user?.name} src={user?.profileImage} size="xl" />
        <Box>
          <Text fontSize="xs" color="teal.100">TRAINER ID #{user?.id}</Text>
          <Text fontSize="2xl" fontWeight="800">{user?.name}</Text>
          <Text color="teal.100">@{user?.username}</Text>
        </Box>
      </HStack>
      <Divider my={4} borderColor="whiteAlpha.400" />
      <Text fontWeight="800" color="yellow.100">${user?.money ?? 0}</Text>
      <Text minH="24px">{user?.description || 'No description set.'}</Text>
      <Button mt={4} width="100%" colorScheme="teal" onClick={openBattleHistory}>
        Battle History
      </Button>
    </Box>
  );
}

function BattleHistoryCard({ entry }: { entry: BattleHistoryEntry }) {
  const endedAt = entry.endedAt ? new Date(entry.endedAt) : null;

  return (
    <Box bg="whiteAlpha.100" border="1px solid rgba(255,255,255,0.12)" p={3} borderRadius="8px">
      <HStack justify="space-between" align="start">
        <Box minW={0}>
          <Text fontWeight="800" noOfLines={1}>{entry.result}</Text>
          <Text color="gray.300" fontSize="sm" noOfLines={1}>Opponent: {entry.opponentName}</Text>
        </Box>
        <Badge colorScheme={entry.kind === 'trainer' ? 'red' : 'green'}>{entry.kind}</Badge>
      </HStack>
      <SimpleGrid mt={3} columns={2} spacing={2}>
        <Box>
          <Text fontSize="xs" color="gray.400">Winner</Text>
          <Text fontSize="sm">{entry.winnerName ?? 'No winner'}</Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="gray.400">Loser</Text>
          <Text fontSize="sm">{entry.loserName ?? 'No loser'}</Text>
        </Box>
      </SimpleGrid>
      <Text mt={3} fontSize="xs" color="gray.400">
        {endedAt ? endedAt.toLocaleString() : 'Unknown date'}
      </Text>
      <Box mt={3} maxH="150px" overflowY="auto" bg="blackAlpha.300" borderRadius="6px" p={2}>
        {entry.log.slice(-15).map((line, index) => (
          <Text key={`${entry.id}-${index}`} fontSize="xs" color="gray.200">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function BattleHistoryWindow() {
  const { user } = useAuth();
  const history = user?.battleHistory ?? [];

  return (
    <VStack align="stretch" spacing={3}>
      {history.map((entry) => <BattleHistoryCard key={entry.id} entry={entry} />)}
      {history.length === 0 ? <Text color="gray.400">No battles recorded yet.</Text> : null}
    </VStack>
  );
}

function PokemonStatsWindow({
  pokemon,
  catalogEntry
}: {
  pokemon: PokemonSummary;
  catalogEntry: PokemonCatalogEntry | null;
}) {
  const experienceProgress = pokemon.nextLevelExperience > 0
    ? Math.min((pokemon.experience / pokemon.nextLevelExperience) * 100, 100)
    : 0;

  return (
    <VStack align="stretch" spacing={4}>
      <HStack spacing={4} align="center">
        <Avatar
          name={getPokemonDisplayName(pokemon)}
          src={catalogEntry?.profile.iconImageSrc}
          bg="whiteAlpha.200"
        />
        <Box minW={0}>
          <Text fontWeight="800" noOfLines={1}>{getPokemonDisplayName(pokemon)}</Text>
          <Text color="gray.300" fontSize="sm" noOfLines={1}>
            {pokemon.nickname ? `Species: ${pokemon.name}` : pokemon.name}
          </Text>
        </Box>
      </HStack>
      <Box
        p={4}
        borderRadius="10px"
        bg="linear-gradient(135deg, rgba(20, 184, 166, 0.18) 0%, rgba(59, 130, 246, 0.12) 100%)"
        border="1px solid rgba(255,255,255,0.1)"
      >
        <HStack align="center" spacing={4}>
          {catalogEntry?.profile.frontImageSrc ? (
            <Image
              src={catalogEntry.profile.frontImageSrc}
              alt={pokemon.name}
              boxSize="88px"
              objectFit="contain"
              style={{ imageRendering: 'pixelated' }}
              flexShrink={0}
            />
          ) : (
            <Avatar
              name={pokemon.name}
              src={catalogEntry?.profile.iconImageSrc}
              size="xl"
              bg="whiteAlpha.200"
              flexShrink={0}
            />
          )}
          <Box minW={0} flex="1">
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme="teal">Lv {pokemon.level}</Badge>
              {pokemon.types.map((type) => <Badge key={type}>{type}</Badge>)}
            </HStack>
            <Text mt={3} fontSize="sm">HP {pokemon.hp}/{pokemon.maxHp}</Text>
            <Progress
              value={pokemon.maxHp > 0 ? (pokemon.hp / pokemon.maxHp) * 100 : 0}
              colorScheme="green"
              size="sm"
              borderRadius="8px"
            />
            <Text mt={3} fontSize="sm">EXP {pokemon.experience}/{pokemon.nextLevelExperience}</Text>
            <Progress value={experienceProgress} colorScheme="teal" size="sm" borderRadius="8px" />
          </Box>
        </HStack>
      </Box>

      <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={3}>
        <PokemonStatTile label="Level" value={String(pokemon.level)} />
        <PokemonStatTile label="Experience Curve" value={pokemon.experienceCurve} />
        <PokemonStatTile label="Experience" value={`${pokemon.experience}/${pokemon.nextLevelExperience}`} />
        <PokemonStatTile label="HP" value={`${pokemon.hp}/${pokemon.maxHp}`} />
        <PokemonStatTile
          label="Attack"
          value={catalogEntry ? String(catalogEntry.profile.attack) : 'Unknown'}
        />
        <PokemonStatTile
          label="Defense"
          value={catalogEntry ? String(catalogEntry.profile.defense) : 'Unknown'}
        />
        <PokemonStatTile
          label="Sp. Attack"
          value={catalogEntry ? String(catalogEntry.profile.specialAttack) : 'Unknown'}
        />
        <PokemonStatTile
          label="Sp. Defense"
          value={catalogEntry ? String(catalogEntry.profile.specialDefense) : 'Unknown'}
        />
        <PokemonStatTile
          label="Speed"
          value={catalogEntry ? String(catalogEntry.profile.speed) : 'Unknown'}
        />
      </SimpleGrid>

      <Box bg="whiteAlpha.100" border="1px solid rgba(255,255,255,0.12)" p={3} borderRadius="8px">
        <Text fontSize="xs" color="gray.400">Moves</Text>
        <Text mt={1} fontSize="sm">
          {pokemon.moves
            .map((move) => typeof pokemon.movePp?.[move] === 'number' ? `${move} (${pokemon.movePp[move]} PP)` : move)
            .join(', ') || 'No moves learned.'}
        </Text>
      </Box>

      {!catalogEntry ? (
        <Text color="yellow.200" fontSize="sm">
          Extra stat art was not found in the local Pokemon catalog, so this card is using the party data only.
        </Text>
      ) : null}
    </VStack>
  );
}

function PokemonCard({
  pokemon,
  catalogEntry,
  onOpenStats
}: {
  pokemon: PokemonSummary;
  catalogEntry: PokemonCatalogEntry | null;
  onOpenStats: (pokemonId: string) => void;
}) {
  const { namePokemon } = useAuth();
  const handleSelectName = () => {
    const value = window.prompt(`Select a name for ${pokemon.name}. Letters only, no spaces, max 10 characters.`);
    if (value === null) {
      return;
    }

    const nickname = value.trim();
    const validationMessage = validatePokemonNickname(nickname);
    if (validationMessage) {
      window.alert(validationMessage);
      return;
    }

    namePokemon({ pokemonId: pokemon.id, nickname });
  };

  return (
    <Box bg="whiteAlpha.100" border="1px solid rgba(255,255,255,0.12)" p={3} borderRadius="8px">
      <HStack justify="space-between" align="start" spacing={3}>
        <HStack spacing={3} minW={0} align="start">
          <Avatar
            size="sm"
            name={pokemon.name}
            src={catalogEntry?.profile.iconImageSrc}
            bg="whiteAlpha.200"
            flexShrink={0}
          />
          <Box minW={0}>
            <Text fontWeight="800" noOfLines={1}>{getPokemonDisplayName(pokemon)}</Text>
            {pokemon.nickname ? <Text color="gray.400" fontSize="xs">Real name: {pokemon.name}</Text> : null}
          </Box>
        </HStack>
        <HStack spacing={2} align="start">
          <Badge colorScheme="teal">Lv {pokemon.level}</Badge>
          <Menu placement="bottom-end">
            <MenuButton
              as={IconButton}
              aria-label={`Open options for ${getPokemonDisplayName(pokemon)}`}
              size="xs"
              variant="ghost"
              color="white"
              icon={<MoreActionsIcon />}
            />
            <MenuList color="gray.900">
              <MenuItem onClick={() => onOpenStats(pokemon.id)}>Stats</MenuItem>
              <MenuItem onClick={handleSelectName}>{pokemon.nickname ? 'Rename' : 'Select Name'}</MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </HStack>
      <HStack mt={2}>
        {pokemon.types.map((type) => <Badge key={type}>{type}</Badge>)}
      </HStack>
      <Text mt={3} fontSize="sm">HP {pokemon.hp}/{pokemon.maxHp}</Text>
      <Progress value={(pokemon.hp / pokemon.maxHp) * 100} colorScheme="green" size="sm" borderRadius="8px" />
      <Text mt={3} fontSize="sm">EXP {pokemon.experience}/{pokemon.nextLevelExperience}</Text>
      <Progress
        value={pokemon.nextLevelExperience > 0 ? Math.min((pokemon.experience / pokemon.nextLevelExperience) * 100, 100) : 0}
        colorScheme="teal"
        size="sm"
        borderRadius="8px"
      />
      <Text mt={3} fontSize="xs" color="gray.400">Moves</Text>
      <Text fontSize="sm">
        {pokemon.moves
          .map((move) => typeof pokemon.movePp?.[move] === 'number' ? `${move} (${pokemon.movePp[move]} PP)` : move)
          .join(', ') || 'No moves learned.'}
      </Text>
    </Box>
  );
}

function PokemonsWindow({
  party,
  pokemonCatalog,
  onOpenStats
}: {
  party: PokemonSummary[];
  pokemonCatalog: Map<string, PokemonCatalogEntry>;
  onOpenStats: (pokemonId: string) => void;
}) {
  return (
    <VStack align="stretch" spacing={3}>
      <Text color="gray.300">Pokemon on hand: {party.length}/6</Text>
      <Grid templateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={3}>
        {party.map((pokemon) => (
          <PokemonCard
            key={pokemon.id}
            pokemon={pokemon}
            catalogEntry={resolvePokemonCatalogEntry(pokemon, pokemonCatalog)}
            onOpenStats={onOpenStats}
          />
        ))}
      </Grid>
      {party.length === 0 ? <Text color="gray.400">No Pokemon in your party yet.</Text> : null}
    </VStack>
  );
}

function PokemonStatsFallback({ pokemonId }: { pokemonId: string }) {
  return (
    <VStack align="stretch" spacing={3}>
      <Text color="gray.300">
        Pokemon `{pokemonId}` is no longer in your party, so this stats window cannot be updated.
      </Text>
      <Text color="gray.500" fontSize="sm">
        You can close this window or reopen the Pokemon list to inspect a different party member.
      </Text>
    </VStack>
  );
}

const AccountMenu = () => {
  const toast = useToast();
  const { hasPermission, logout, user } = useAuth();
  const pokemonCatalog = usePokemonCatalog();
  const party = (user?.pokemonParty ?? []).slice(0, 6);
  const [openWindows, setOpenWindows] = useState<OpenWindowId[]>([]);
  const [positions, setPositions] = useState<Record<string, WindowPosition>>(() => loadStoredPositions());
  const [dragEnabled, setDragEnabledState] = useState(() => window.localStorage.getItem(DRAG_SETTING_KEY) !== '0');

  const orderedWindows = useMemo(() => openWindows, [openWindows]);

  const openWindow = (windowKey: OpenWindowId) => {
    setOpenWindows((current) =>
      current.includes(windowKey)
        ? [...current.filter((item) => item !== windowKey), windowKey]
        : [...current, windowKey]
    );
  };

  const closeWindow = (windowKey: OpenWindowId) => {
    setOpenWindows((current) => current.filter((item) => item !== windowKey));
  };

  const focusWindow = (windowKey: OpenWindowId) => {
    setOpenWindows((current) => {
      if (!current.includes(windowKey) || current[current.length - 1] === windowKey) {
        return current;
      }

      return [...current.filter((item) => item !== windowKey), windowKey];
    });
  };

  const moveWindow = (windowKey: OpenWindowId, position: WindowPosition) => {
    setPositions((current) => {
      const next = { ...current, [windowKey]: position };
      window.localStorage.setItem(WINDOW_POSITIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const openPokemonStatsWindow = (pokemonId: string) => {
    const windowId = createPokemonStatsWindowId(pokemonId);

    setPositions((current) => {
      if (current[windowId]) {
        return current;
      }

      const statsWindowCount = openWindows.filter(isPokemonStatsWindowId).length;
      const next = {
        ...current,
        [windowId]: {
          x: Math.max(
            8,
            Math.min(
              POKEMON_STATS_WINDOW_POSITION.x + (statsWindowCount * POKEMON_STATS_WINDOW_OFFSET),
              Math.max(8, window.innerWidth - 780)
            )
          ),
          y: Math.max(
            8,
            Math.min(
              POKEMON_STATS_WINDOW_POSITION.y + (statsWindowCount * POKEMON_STATS_WINDOW_OFFSET),
              Math.max(8, window.innerHeight - 180)
            )
          )
        }
      };

      window.localStorage.setItem(WINDOW_POSITIONS_KEY, JSON.stringify(next));
      return next;
    });

    openWindow(windowId);
  };

  const setDragEnabled = (value: boolean) => {
    setDragEnabledState(value);
    window.localStorage.setItem(DRAG_SETTING_KEY, value ? '1' : '0');
  };

  const resetPositions = () => {
    setPositions(DEFAULT_POSITIONS);
    window.localStorage.setItem(WINDOW_POSITIONS_KEY, JSON.stringify(DEFAULT_POSITIONS));
    toast({ title: 'Window positions reset.', status: 'success', duration: 2000, position: 'top' });
  };

  useEffect(() => {
    const partyIds = new Set(party.map((pokemon) => pokemon.id));

    setOpenWindows((current) => {
      const next = current.filter((windowId) => (
        !isPokemonStatsWindowId(windowId) || partyIds.has(getPokemonIdFromStatsWindow(windowId))
      ));

      return next.length === current.length ? current : next;
    });
  }, [party]);

  const getWindowTitle = (windowKey: OpenWindowId) => {
    if (!isPokemonStatsWindowId(windowKey)) {
      return WINDOW_TITLES[windowKey];
    }

    const pokemon = party.find((entry) => entry.id === getPokemonIdFromStatsWindow(windowKey));
    return pokemon ? `${getPokemonDisplayName(pokemon)} Stats` : 'Pokemon Stats';
  };

  const getWindowDesktopWidth = (windowKey: OpenWindowId) => (
    isPokemonStatsWindowId(windowKey) ? '760px' : '460px'
  );

  const renderWindow = (windowKey: OpenWindowId) => {
    if (isPokemonStatsWindowId(windowKey)) {
      const pokemonId = getPokemonIdFromStatsWindow(windowKey);
      const pokemon = party.find((entry) => entry.id === pokemonId) ?? null;

      if (!pokemon) {
        return <PokemonStatsFallback pokemonId={pokemonId} />;
      }

      return (
        <PokemonStatsWindow
          pokemon={pokemon}
          catalogEntry={resolvePokemonCatalogEntry(pokemon, pokemonCatalog)}
        />
      );
    }

    if (windowKey === 'account') {
      return <AccountWindow />;
    }

    if (windowKey === 'settings') {
      return (
        <SettingsWindow
          dragEnabled={dragEnabled}
          setDragEnabled={setDragEnabled}
          resetPositions={resetPositions}
        />
      );
    }

    if (windowKey === 'bag') {
      return <BagWindow />;
    }

    if (windowKey === 'pokemons') {
      return (
        <PokemonsWindow
          party={party}
          pokemonCatalog={pokemonCatalog}
          onOpenStats={openPokemonStatsWindow}
        />
      );
    }

    if (windowKey === 'battleHistory') {
      return <BattleHistoryWindow />;
    }

    return <TrainerCardWindow openBattleHistory={() => openWindow('battleHistory')} />;
  };

  return (
    <Box
      position="fixed"
      top={{ base: 4, md: 6 }}
      right={{ base: 4, md: 6 }}
      zIndex={3800}
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
      data-game-ux="true"
    >
      <Menu>
        <MenuButton as={Button} colorScheme="teal" variant="solid" boxShadow="lg">
          <Text as="span" display={{ base: 'none', sm: 'inline' }}>
            {user?.username ?? 'Account'}
          </Text>
          <Text as="span" display={{ base: 'inline', sm: 'none' }}>
            Menu
          </Text>
          <Text as="span" ml={2}>v</Text>
        </MenuButton>
        <MenuList color="gray.900">
          <MenuItem onClick={() => openWindow('account')}>Account</MenuItem>
          <MenuItem onClick={() => openWindow('settings')}>Settings</MenuItem>
          <MenuItem onClick={() => openWindow('bag')}>Bag</MenuItem>
          <MenuItem onClick={() => openWindow('pokemons')}>Pokemons</MenuItem>
          <MenuItem onClick={() => openWindow('trainerCard')}>Trainer Card</MenuItem>
          <MenuItem onClick={() => openWindow('battleHistory')}>Battle History</MenuItem>
          {hasPermission('designer.access') ? (
            <MenuItem as={RouterLink} to="/designer">Designer</MenuItem>
          ) : null}
          {hasPermission('moderator.access') ? (
            <MenuItem as={RouterLink} to="/moderator">Moderator</MenuItem>
          ) : null}
          {hasPermission('admin.access') ? (
            <MenuItem as={RouterLink} to="/admin">Admin</MenuItem>
          ) : null}
          <MenuItem color="red.500" onClick={logout}>Log out</MenuItem>
        </MenuList>
      </Menu>
      {orderedWindows.map((windowKey) => (
        <DraggableWindow
          key={windowKey}
          id={windowKey}
          title={getWindowTitle(windowKey)}
          dragEnabled={dragEnabled}
          position={positions[windowKey] ?? DEFAULT_POSITIONS[windowKey as WindowKey] ?? POKEMON_STATS_WINDOW_POSITION}
          desktopWidth={getWindowDesktopWidth(windowKey)}
          zIndex={3600 + orderedWindows.indexOf(windowKey)}
          onMove={moveWindow}
          onFocus={focusWindow}
          onClose={closeWindow}
        >
          {renderWindow(windowKey)}
        </DraggableWindow>
      ))}
    </Box>
  );
};

export default AccountMenu;
