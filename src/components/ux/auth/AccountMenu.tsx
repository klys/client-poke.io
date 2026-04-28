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
import { useAuth, type InventoryItem, type PokemonSummary } from '../../../context/authContext';

type WindowKey = 'account' | 'settings' | 'bag' | 'pokemons' | 'trainerCard';

type WindowPosition = {
  x: number;
  y: number;
};

type DraggableWindowProps = {
  id: WindowKey;
  title: string;
  dragEnabled: boolean;
  position: WindowPosition;
  onMove: (id: WindowKey, position: WindowPosition) => void;
  onClose: (id: WindowKey) => void;
  children: ReactNode;
};

const WINDOW_TITLES: Record<WindowKey, string> = {
  account: 'Account',
  settings: 'Settings',
  bag: 'Bag',
  pokemons: 'Pokemons',
  trainerCard: 'Trainer Card'
};

const DEFAULT_POSITIONS: Record<WindowKey, WindowPosition> = {
  account: { x: 48, y: 96 },
  settings: { x: 96, y: 132 },
  bag: { x: 132, y: 84 },
  pokemons: { x: 168, y: 120 },
  trainerCard: { x: 210, y: 156 }
};

const WINDOW_POSITIONS_KEY = 'client-poke.io.ux.windowPositions';
const DRAG_SETTING_KEY = 'client-poke.io.ux.dragWindows';
const BUG_REPORT_URL = 'https://github.com/klys/pokecraft/issues';

function stopUxEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function loadStoredPositions() {
  try {
    const raw = window.localStorage.getItem(WINDOW_POSITIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return {
      ...DEFAULT_POSITIONS,
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    } as Record<WindowKey, WindowPosition>;
  } catch {
    return DEFAULT_POSITIONS;
  }
}

function DraggableWindow({
  id,
  title,
  dragEnabled,
  position,
  onMove,
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
    const maxX = Math.max(8, window.innerWidth - 320);
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
      width={{ base: 'calc(100vw - 24px)', md: '460px' }}
      maxW="calc(100vw - 24px)"
      maxH="calc(100vh - 96px)"
      overflow="hidden"
      bg="rgba(17, 24, 39, 0.97)"
      border="1px solid rgba(255,255,255,0.16)"
      borderRadius="8px"
      boxShadow="0 24px 60px rgba(0,0,0,0.42)"
      color="white"
      zIndex={3600}
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
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
  const { user } = useAuth();
  const items = user?.inventory ?? [];
  const categories: Array<{ key: InventoryItem['category'] | 'all'; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'usable', label: 'Usable' },
    { key: 'berries', label: 'Berries' },
    { key: 'moves', label: 'Moves' },
    { key: 'quest', label: 'Quest Items' }
  ];

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

function TrainerCardWindow() {
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
    </Box>
  );
}

function PokemonCard({ pokemon }: { pokemon: PokemonSummary }) {
  return (
    <Box bg="whiteAlpha.100" border="1px solid rgba(255,255,255,0.12)" p={3} borderRadius="8px">
      <HStack justify="space-between">
        <Text fontWeight="800">{pokemon.name}</Text>
        <Badge colorScheme="teal">Lv {pokemon.level}</Badge>
      </HStack>
      <HStack mt={2}>
        {pokemon.types.map((type) => <Badge key={type}>{type}</Badge>)}
      </HStack>
      <Text mt={3} fontSize="sm">HP {pokemon.hp}/{pokemon.maxHp}</Text>
      <Progress value={(pokemon.hp / pokemon.maxHp) * 100} colorScheme="green" size="sm" borderRadius="8px" />
      <Text mt={3} fontSize="xs" color="gray.400">Moves</Text>
      <Text fontSize="sm">
        {pokemon.moves
          .map((move) => typeof pokemon.movePp?.[move] === 'number' ? `${move} (${pokemon.movePp[move]} PP)` : move)
          .join(', ') || 'No moves learned.'}
      </Text>
    </Box>
  );
}

function PokemonsWindow() {
  const { user } = useAuth();
  const party = (user?.pokemonParty ?? []).slice(0, 6);

  return (
    <VStack align="stretch" spacing={3}>
      <Text color="gray.300">Pokemon on hand: {party.length}/6</Text>
      <Grid templateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={3}>
        {party.map((pokemon) => <PokemonCard key={pokemon.id} pokemon={pokemon} />)}
      </Grid>
      {party.length === 0 ? <Text color="gray.400">No Pokemon in your party yet.</Text> : null}
    </VStack>
  );
}

const AccountMenu = () => {
  const toast = useToast();
  const { logout, user } = useAuth();
  const [openWindows, setOpenWindows] = useState<WindowKey[]>([]);
  const [positions, setPositions] = useState<Record<WindowKey, WindowPosition>>(() => loadStoredPositions());
  const [dragEnabled, setDragEnabledState] = useState(() => window.localStorage.getItem(DRAG_SETTING_KEY) !== '0');

  const orderedWindows = useMemo(() => openWindows, [openWindows]);

  const openWindow = (windowKey: WindowKey) => {
    setOpenWindows((current) =>
      current.includes(windowKey) ? current : [...current, windowKey]
    );
  };

  const closeWindow = (windowKey: WindowKey) => {
    setOpenWindows((current) => current.filter((item) => item !== windowKey));
  };

  const moveWindow = (windowKey: WindowKey, position: WindowPosition) => {
    setPositions((current) => {
      const next = { ...current, [windowKey]: position };
      window.localStorage.setItem(WINDOW_POSITIONS_KEY, JSON.stringify(next));
      return next;
    });
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

  const renderWindow = (windowKey: WindowKey) => {
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
      return <PokemonsWindow />;
    }

    return <TrainerCardWindow />;
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
          <MenuItem color="red.500" onClick={logout}>Log out</MenuItem>
        </MenuList>
      </Menu>
      {orderedWindows.map((windowKey) => (
        <DraggableWindow
          key={windowKey}
          id={windowKey}
          title={WINDOW_TITLES[windowKey]}
          dragEnabled={dragEnabled}
          position={positions[windowKey] ?? DEFAULT_POSITIONS[windowKey]}
          onMove={moveWindow}
          onClose={closeWindow}
        >
          {renderWindow(windowKey)}
        </DraggableWindow>
      ))}
    </Box>
  );
};

export default AccountMenu;
