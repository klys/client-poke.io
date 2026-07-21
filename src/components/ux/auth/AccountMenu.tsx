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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  SimpleGrid,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import PasswordInput from './PasswordInput';
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
import { classifyInventoryItem, type ItemUsage } from '../game/itemUsage';
import { getBackendBaseUrl } from '../../game/backendConfig';
import GamepadSettings from './GamepadSettings';
import {
  AudioSettingsSection,
  ControlsSettingsSection,
  DisplaySettingsSection,
  LanguageSettingsSection
} from './GameSettingsSections';
import { useGameSettings } from '../../../settings/gameSettings';
import { useT } from '../../../i18n';
import { useCompactUx } from '../useCompactUx';
import { resolveServerAssetUrl } from '../../tilemap/serverAssets';
import WorldMapWindow, { FLY_MOVE_NAME } from '../game/WorldMapWindow';
import {
  TrainerCardView,
  TRAINER_CARD_COLORS,
  type TrainerCardTeamMember
} from '../game/TrainerCard';
import {
  getCharacterSkinPreview,
  loadCharacterSkinCatalog,
  type CharacterSkinCatalogItem
} from '../game/characterSkinCatalog';

type WindowKey = 'account' | 'settings' | 'bag' | 'pokemons' | 'map' | 'trainerCard' | 'battleHistory';
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

// i18n keys — resolved with t() at render time so titles follow the language.
const WINDOW_TITLE_KEYS: Record<WindowKey, string> = {
  account: 'menu.account',
  settings: 'menu.settings',
  bag: 'menu.bag',
  pokemons: 'menu.pokemons',
  map: 'menu.map',
  trainerCard: 'menu.trainerCard',
  battleHistory: 'menu.battleHistory'
};

const DEFAULT_POSITIONS: Record<WindowKey, WindowPosition> = {
  account: { x: 48, y: 96 },
  settings: { x: 96, y: 132 },
  bag: { x: 132, y: 84 },
  pokemons: { x: 168, y: 120 },
  map: { x: 120, y: 72 },
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

// Per-venomon stats windows (`pokemonStats:<uuid>`) must never reach
// localStorage: party members change constantly, so persisting them grew the
// windowPositions blob without bound until any setItem on this origin threw
// QuotaExceededError (the designer cache shares the same ~5MB budget).
function withoutPokemonStatsPositions(positions: Record<string, WindowPosition>) {
  return Object.fromEntries(
    Object.entries(positions).filter(([key]) => !isPokemonStatsWindowId(key as OpenWindowId))
  );
}

function persistWindowPositions(positions: Record<string, WindowPosition>) {
  try {
    window.localStorage.setItem(
      WINDOW_POSITIONS_KEY,
      JSON.stringify(withoutPokemonStatsPositions(positions))
    );
  } catch {
    // Quota exceeded or storage unavailable — keep positions in memory only.
  }
}

function loadStoredPositions() {
  try {
    const raw = window.localStorage.getItem(WINDOW_POSITIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const stored = parsed && typeof parsed === 'object'
      ? withoutPokemonStatsPositions(parsed as Record<string, WindowPosition>)
      : {};

    // Rewrite pruned data so storage bloated by older builds shrinks back.
    if (parsed && Object.keys(stored).length !== Object.keys(parsed).length) {
      persistWindowPositions(stored);
    }

    return {
      ...DEFAULT_POSITIONS,
      ...stored
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
  // On touch/small screens the desktop mechanics (free-floating draggable
  // windows positioned in px) are unusable — windows land half off-screen and
  // dragging fights scrolling. Compact mode docks every window as a
  // full-width sheet instead. Width breakpoints alone can't decide this:
  // landscape phones are wider than the md breakpoint.
  const compact = useCompactUx();
  const canDrag = dragEnabled && !compact;
  const [gameSettings] = useGameSettings();
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

    if (!canDrag) {
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
      // Settings -> Display -> Interface windows size.
      style={{ zoom: gameSettings.uiScale.interface } as React.CSSProperties}
      position="fixed"
      left={compact ? 2 : { base: 3, md: `${position.x}px` }}
      top={compact ? 2 : { base: 20, md: `${position.y}px` }}
      width={compact ? 'calc(100vw - 16px)' : { base: 'calc(100vw - 24px)', md: desktopWidth }}
      maxW={compact ? 'calc(100vw - 16px)' : 'calc(100vw - 24px)'}
      maxH={compact ? 'calc(100dvh - 16px)' : 'calc(100vh - 96px)'}
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
        px={compact ? 3 : 4}
        py={compact ? 2 : 3}
        bg="rgba(255,255,255,0.08)"
        cursor={canDrag ? 'move' : 'default'}
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
      <Box p={compact ? 3 : 4} overflowY="auto" maxH={compact ? 'calc(100dvh - 64px)' : 'calc(100vh - 156px)'}>
        {children}
      </Box>
    </Box>
  );
}

const SKIN_CHANGE_PRICE = 300;

/**
 * Danger-zone control that lets a user permanently delete their own account and
 * all related data. Deletion is two-step: request a numeric code by email, then
 * type it back to confirm. On success the server signs the socket out and the
 * auth context returns to the logged-out state (unmounting this window).
 */
function DeleteAccountSection() {
  const { user, requestAccountDeletion, confirmAccountDeletion } = useAuth();
  const t = useT();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [step, setStep] = useState<'intro' | 'code'>('intro');
  const [code, setCode] = useState('');

  const reset = () => {
    setStep('intro');
    setCode('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSendCode = () => {
    requestAccountDeletion();
    setStep('code');
  };

  const trimmedCode = code.trim();

  return (
    <>
      <Divider borderColor="whiteAlpha.300" />
      <Box borderWidth="1px" borderColor="red.400" borderRadius="8px" p={3}>
        <Text fontWeight="700" color="red.300">{t('account.dangerZone')}</Text>
        <Text fontSize="sm" color="gray.400" mt={1}>{t('account.deleteAccountHelp')}</Text>
        <Button mt={3} size="sm" colorScheme="red" variant="outline" onClick={onOpen}>
          {t('account.deleteAccount')}
        </Button>
      </Box>

      <Modal isOpen={isOpen} onClose={handleClose} isCentered>
        <ModalOverlay />
        <ModalContent bg="gray.800" color="white">
          <ModalHeader color="red.300">{t('account.deleteAccount')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {step === 'intro' ? (
              <VStack align="stretch" spacing={3}>
                <Text>{t('account.deleteConfirmWarning')}</Text>
                <Text fontSize="sm" color="gray.400">
                  {t('account.deleteCodeIntro', { email: user?.email ?? '' })}
                </Text>
              </VStack>
            ) : (
              <VStack align="stretch" spacing={3}>
                <Text fontSize="sm" color="gray.400">
                  {t('account.deleteCodeSent', { email: user?.email ?? '' })}
                </Text>
                <FormControl>
                  <FormLabel>{t('account.deleteCodeLabel')}</FormLabel>
                  <Input
                    value={code}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </FormControl>
                <Link color="teal.200" fontSize="sm" onClick={() => requestAccountDeletion()}>
                  {t('account.deleteResendCode')}
                </Link>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleClose}>
              {t('account.cancel')}
            </Button>
            {step === 'intro' ? (
              <Button colorScheme="red" onClick={handleSendCode}>
                {t('account.deleteSendCode')}
              </Button>
            ) : (
              <Button
                colorScheme="red"
                isDisabled={trimmedCode.length < 4}
                onClick={() => confirmAccountDeletion({ code: trimmedCode })}
              >
                {t('account.deleteConfirmButton')}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function ProfileTab() {
  const { user, changePassword, updateProfile } = useAuth();
  const t = useT();
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
          <Text fontSize="xs" color="gray.400">{t('account.emailStatus')}</Text>
          <Badge colorScheme={user?.emailVerified ? 'green' : 'yellow'}>
            {user?.emailVerified ? t('account.verified') : t('account.pending')}
          </Badge>
        </Box>
        <Box bg="whiteAlpha.100" p={3} borderRadius="8px">
          <Text fontSize="xs" color="gray.400">{t('account.userId')}</Text>
          <Text>{user?.id}</Text>
        </Box>
      </SimpleGrid>
      <Divider borderColor="whiteAlpha.300" />
      <FormControl>
        <FormLabel>{t('account.profileImage')}</FormLabel>
        <Input value={profileImage} onChange={(event) => setProfileImage(event.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>{t('account.description')}</FormLabel>
        <Textarea
          resize="none"
          maxLength={50}
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, 50))}
        />
        <FormHelperText color="gray.400">{description.length}/50</FormHelperText>
      </FormControl>
      <Button colorScheme="teal" onClick={() => updateProfile({ profileImage, description })}>
        {t('account.saveProfile')}
      </Button>
      <Divider borderColor="whiteAlpha.300" />
      <FormControl>
        <FormLabel>{t('account.currentPassword')}</FormLabel>
        <PasswordInput value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>{t('account.newPassword')}</FormLabel>
        <PasswordInput value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      </FormControl>
      <Button
        onClick={() => {
          changePassword({ currentPassword, newPassword });
          setCurrentPassword('');
          setNewPassword('');
        }}
      >
        {t('account.changePassword')}
      </Button>
      <Link href={BUG_REPORT_URL} isExternal color="teal.200" fontWeight="700">
        {t('account.reportBug')}
      </Link>
      <DeleteAccountSection />
    </VStack>
  );
}

/** Keeps the character-skin catalog fresh from the designer cache, and joins
 * the "players" section over the socket so it populates on a cold load. */
function useCharacterSkinCatalog(): CharacterSkinCatalogItem[] {
  const { socket, authReady, authenticated } = useAuth();
  const [catalog, setCatalog] = useState<CharacterSkinCatalogItem[]>(() => loadCharacterSkinCatalog());

  useEffect(() => {
    const sync = () => setCatalog(loadCharacterSkinCatalog());
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;
      if (detail?.sectionKey === 'players') {
        sync();
      }
    };
    sync();
    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handle);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handle);
  }, []);

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return undefined;
    }
    socket.emit('designer:section:join', { sectionKey: 'players' });
    return () => {
      socket.emit('designer:section:leave', { sectionKey: 'players' });
    };
  }, [authReady, authenticated, socket]);

  return catalog;
}

function SkinShopTab() {
  const { user, setCharacterSkin } = useAuth();
  const t = useT();
  const skins = useCharacterSkinCatalog();
  const money = user?.money ?? 0;
  const currentSkinId = user?.characterSkinId ?? '';
  const canAfford = money >= SKIN_CHANGE_PRICE;

  return (
    <VStack align="stretch" spacing={4}>
      <HStack justify="space-between">
        <Text color="gray.300">{t('skin.intro', { price: String(SKIN_CHANGE_PRICE) })}</Text>
        <Badge colorScheme="yellow">${money}</Badge>
      </HStack>
      {skins.length === 0 ? (
        <Text color="yellow.200">{t('skin.empty')}</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
          {skins.map((skin) => {
            const previewSrc = getCharacterSkinPreview(skin.profile);
            const isCurrent = skin.id === currentSkinId;
            return (
              <Box
                key={skin.id}
                p={3}
                borderRadius="8px"
                border={isCurrent ? '2px solid #38b2ac' : '1px solid rgba(255,255,255,0.14)'}
                bg={isCurrent ? 'rgba(20, 184, 166, 0.16)' : 'whiteAlpha.100'}
              >
                <Box
                  minH="120px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="8px"
                  bg="rgba(255,255,255,0.04)"
                  border="1px dashed rgba(255,255,255,0.12)"
                >
                  {previewSrc ? (
                    <Image
                      src={previewSrc}
                      alt={skin.name}
                      maxH="96px"
                      objectFit="contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <Text color="gray.400">{t('skin.noPreview')}</Text>
                  )}
                </Box>
                <Box mt={2}>
                  <Text fontWeight="800" noOfLines={1}>{skin.name}</Text>
                  <HStack mt={1} justify="space-between" align="center" spacing={2}>
                    <Text fontSize="xs" color="gray.400" noOfLines={1} flex="1" minW={0}>
                      {skin.category}
                    </Text>
                    {isCurrent ? (
                      <Badge colorScheme="teal" flexShrink={0}>{t('skin.wearing')}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        colorScheme="teal"
                        flexShrink={0}
                        isDisabled={!canAfford}
                        title={canAfford ? undefined : t('skin.notEnough', { price: String(SKIN_CHANGE_PRICE) })}
                        onClick={() => setCharacterSkin({ characterSkinId: skin.id })}
                      >
                        {t('skin.change', { price: String(SKIN_CHANGE_PRICE) })}
                      </Button>
                    )}
                  </HStack>
                </Box>
              </Box>
            );
          })}
        </SimpleGrid>
      )}
      {!canAfford ? (
        <Text color="gray.400" fontSize="sm">{t('skin.notEnough', { price: String(SKIN_CHANGE_PRICE) })}</Text>
      ) : null}
    </VStack>
  );
}

function CardColorTab() {
  const { user, updateProfile } = useAuth();
  const t = useT();
  const party = (user?.pokemonParty ?? []).slice(0, 6);
  const currentColor = user?.trainerCardColor || TRAINER_CARD_COLORS[0].key;

  return (
    <VStack align="stretch" spacing={4}>
      <Text color="gray.300">{t('card.intro')}</Text>
      <SimpleGrid columns={{ base: 5, sm: 10 }} spacing={2}>
        {TRAINER_CARD_COLORS.map((color) => (
          <Box
            key={color.key}
            as="button"
            type="button"
            aria-label={color.label}
            title={color.label}
            height="34px"
            borderRadius="8px"
            bg={color.swatch}
            border={currentColor === color.key ? '3px solid white' : '1px solid rgba(255,255,255,0.3)'}
            onClick={() => updateProfile({ trainerCardColor: color.key })}
          />
        ))}
      </SimpleGrid>
      <Divider borderColor="whiteAlpha.300" />
      <Text fontSize="xs" color="gray.400" textTransform="uppercase">{t('card.preview')}</Text>
      <TrainerCardView
        name={user?.name}
        username={user?.username}
        trainerId={user?.id}
        description={user?.description}
        characterSkinId={user?.characterSkinId}
        badges={user?.badges ?? []}
        team={toTrainerCardTeam(party)}
        colorKey={currentColor}
        medalsLabel={t('trainer.gymMedals')}
        teamLabel={t('trainer.team')}
        noDescription={t('trainer.noDescription')}
      />
    </VStack>
  );
}

function AccountWindow() {
  const t = useT();
  const tabs: Array<{ key: string; label: string; content: ReactNode }> = [
    { key: 'profile', label: t('account.tab.profile'), content: <ProfileTab /> },
    { key: 'skin', label: t('account.tab.skin'), content: <SkinShopTab /> },
    { key: 'card', label: t('account.tab.card'), content: <CardColorTab /> }
  ];

  return (
    <Tabs colorScheme="teal" variant="soft-rounded" isLazy>
      <TabList flexWrap="wrap" gap={2}>
        {tabs.map((tab) => <Tab key={tab.key}>{tab.label}</Tab>)}
      </TabList>
      <TabPanels>
        {tabs.map((tab) => <TabPanel key={tab.key} px={0}>{tab.content}</TabPanel>)}
      </TabPanels>
    </Tabs>
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
  const t = useT();

  const tabs: Array<{ key: string; label: string; content: ReactNode }> = [
    {
      key: 'gamepad',
      label: t('gamepad.title'),
      content: <GamepadSettings />
    },
    {
      key: 'display',
      label: t('settings.display.title'),
      content: (
        <VStack align="stretch" spacing={4}>
          <DisplaySettingsSection />
          <Button
            colorScheme={dragEnabled ? 'teal' : 'gray'}
            onClick={() => setDragEnabled(!dragEnabled)}
          >
            {dragEnabled ? t('settings.disableDrag') : t('settings.enableDrag')}
          </Button>
          <Button variant="outline" color="white" borderColor="whiteAlpha.400" onClick={resetPositions}>
            {t('settings.resetPositions')}
          </Button>
        </VStack>
      )
    },
    {
      key: 'audio',
      label: t('settings.audio.title'),
      content: <AudioSettingsSection />
    },
    {
      key: 'controls',
      label: t('settings.controls.title'),
      content: <ControlsSettingsSection />
    },
    {
      key: 'language',
      label: t('settings.language.title'),
      content: <LanguageSettingsSection />
    }
  ];

  return (
    <Tabs colorScheme="teal" variant="soft-rounded">
      <TabList flexWrap="wrap" gap={2}>
        {tabs.map((tab) => <Tab key={tab.key}>{tab.label}</Tab>)}
      </TabList>
      <TabPanels>
        {tabs.map((tab) => <TabPanel key={tab.key} px={0}>{tab.content}</TabPanel>)}
      </TabPanels>
    </Tabs>
  );
}

/** One selectable party Venomon card in the item-target modal. */
function ItemTargetCard({
  pokemon,
  iconSrc,
  onSelect
}: {
  pokemon: PokemonSummary;
  iconSrc: string;
  onSelect: () => void;
}) {
  const fainted = pokemon.hp <= 0;
  const hpRatio = pokemon.maxHp > 0 ? pokemon.hp / pokemon.maxHp : 0;
  const hpColor = fainted ? 'red' : hpRatio > 0.5 ? 'green' : hpRatio > 0.2 ? 'yellow' : 'red';

  return (
    <Button
      onClick={onSelect}
      variant="outline"
      height="auto"
      justifyContent="flex-start"
      p={3}
      borderColor="whiteAlpha.300"
      _hover={{ borderColor: 'teal.300', bg: 'whiteAlpha.100' }}
      width="100%"
    >
      <HStack spacing={3} width="100%" align="center">
        <Box boxSize="42px" flexShrink={0} display="flex" alignItems="center" justifyContent="center">
          {iconSrc ? (
            <Image
              src={iconSrc}
              alt={getPokemonDisplayName(pokemon)}
              boxSize="42px"
              objectFit="contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <Text fontFamily="mono" fontWeight="800">
              {(pokemon.nickname || pokemon.name).slice(0, 2).toUpperCase()}
            </Text>
          )}
        </Box>
        <Box flex={1} minW={0} textAlign="left">
          <HStack justify="space-between">
            <Text fontWeight="700" noOfLines={1}>{getPokemonDisplayName(pokemon)}</Text>
            <Badge>Lv {pokemon.level}</Badge>
          </HStack>
          <HStack mt={1} spacing={2}>
            <Progress
              value={hpRatio * 100}
              colorScheme={hpColor}
              size="sm"
              borderRadius="full"
              flex={1}
            />
            <Text fontSize="xs" color="gray.300" whiteSpace="nowrap">
              {fainted ? 'Fainted' : `${pokemon.hp}/${pokemon.maxHp}`}
            </Text>
          </HStack>
        </Box>
      </HStack>
    </Button>
  );
}

/** Modal to pick a Venomon (and, for PP items, one of its moves) for an item. */
function ItemTargetModal({
  item,
  usage,
  party,
  pokemonCatalog,
  onSelect,
  onCancel
}: {
  item: InventoryItem;
  usage: ItemUsage;
  party: PokemonSummary[];
  pokemonCatalog: Map<string, PokemonCatalogEntry>;
  onSelect: (targetPokemonId: string, targetMoveName?: string) => void;
  onCancel: () => void;
}) {
  const [selectedPokemonId, setSelectedPokemonId] = useState<string | null>(null);
  const selectedPokemon = party.find((pokemon) => pokemon.id === selectedPokemonId) ?? null;
  const needsMove = usage.target === 'pokemon-move';

  const iconFor = (pokemon: PokemonSummary) =>
    resolveServerAssetUrl(resolvePokemonCatalogEntry(pokemon, pokemonCatalog)?.profile.iconImageSrc ?? '');

  const handlePokemonClick = (pokemon: PokemonSummary) => {
    if (needsMove) {
      setSelectedPokemonId(pokemon.id);
    } else {
      onSelect(pokemon.id);
    }
  };

  return (
    <Modal isOpen onClose={onCancel} isCentered size="sm" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="#1f2937" color="white" onClick={stopUxEvent}>
        <ModalHeader>
          {needsMove && selectedPokemon
            ? `Restore which move? — ${getPokemonDisplayName(selectedPokemon)}`
            : `Use ${item.name} on…`}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {party.length === 0 ? (
            <Text color="gray.300">You have no Venomon in your party.</Text>
          ) : needsMove && selectedPokemon ? (
            <VStack align="stretch" spacing={2}>
              {(selectedPokemon.moves ?? []).length === 0 ? (
                <Text color="gray.300">This Venomon knows no moves.</Text>
              ) : (
                (selectedPokemon.moves ?? []).map((move) => {
                  const pp = selectedPokemon.movePp?.[move];
                  return (
                    <Button
                      key={move}
                      variant="outline"
                      borderColor="whiteAlpha.300"
                      justifyContent="space-between"
                      onClick={() => onSelect(selectedPokemon.id, move)}
                    >
                      <Text>{move}</Text>
                      {typeof pp === 'number' ? (
                        <Badge>PP {pp}</Badge>
                      ) : null}
                    </Button>
                  );
                })
              )}
            </VStack>
          ) : (
            <VStack align="stretch" spacing={2}>
              {party.map((pokemon) => (
                <ItemTargetCard
                  key={pokemon.id}
                  pokemon={pokemon}
                  iconSrc={iconFor(pokemon)}
                  onSelect={() => handlePokemonClick(pokemon)}
                />
              ))}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          {needsMove && selectedPokemon ? (
            <Button variant="ghost" mr="auto" onClick={() => setSelectedPokemonId(null)}>
              Back
            </Button>
          ) : null}
          <Button variant="outline" borderColor="whiteAlpha.400" onClick={onCancel}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function BagWindow({ onOpenWorldMap }: { onOpenWorldMap: () => void }) {
  const {
    user,
    useInventoryItem: requestUseInventoryItem,
    teachInventoryMove,
    throwAwayInventoryItem
  } = useAuth();
  const t = useT();
  const toast = useToast();
  const pokemonCatalog = usePokemonCatalog();
  const items = user?.inventory ?? [];
  const party = user?.pokemonParty ?? [];
  const [targetSelection, setTargetSelection] = useState<
    { item: InventoryItem; usage: ItemUsage } | null
  >(null);
  const categories: Array<{ key: InventoryItem['category'] | 'all'; label: string }> = [
    { key: 'all', label: t('bag.all') },
    { key: 'usable', label: t('bag.usable') },
    { key: 'berries', label: t('bag.berries') },
    { key: 'moves', label: t('bag.moves') },
    { key: 'quest', label: t('bag.quest') }
  ];

  const requireParty = () => {
    if (party.length === 0) {
      toast({ status: 'warning', title: 'You have no Venomon in your party.', position: 'top' });
      return false;
    }
    return true;
  };

  const handleUse = (item: InventoryItem) => {
    const usage = classifyInventoryItem(item);

    if (!usage.usable) {
      toast({ status: 'info', title: `${item.name} can't be used right now.`, position: 'top' });
      return;
    }

    // Town Map (and similar) are handled entirely client-side.
    if (usage.clientAction === 'town-map') {
      onOpenWorldMap();
      return;
    }

    // No target needed (Repel, Escape Rope, Sacred Ash, Poké Flute, key items).
    if (usage.target === 'none') {
      requestUseInventoryItem({ itemId: item.id });
      return;
    }

    if (!requireParty()) {
      return;
    }
    setTargetSelection({ item, usage });
  };

  const handleTeach = (item: InventoryItem) => {
    if (!requireParty()) {
      return;
    }
    setTargetSelection({ item, usage: { target: 'pokemon', usable: true } });
  };

  const handleTargetSelected = (targetPokemonId: string, targetMoveName?: string) => {
    const selection = targetSelection;
    setTargetSelection(null);
    if (!selection) {
      return;
    }
    if (selection.item.category === 'moves') {
      teachInventoryMove({ itemId: selection.item.id, targetPokemonId });
    } else {
      requestUseInventoryItem({ itemId: selection.item.id, targetPokemonId, targetMoveName });
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
                      {item.category === 'usable' ||
                      item.category === 'berries' ||
                      item.category === 'quest' ? (
                        <Button size="xs" colorScheme="teal" onClick={() => handleUse(item)}>
                          {t('bag.use')}
                        </Button>
                      ) : null}
                      {item.category === 'moves' ? (
                        <Button size="xs" colorScheme="purple" onClick={() => handleTeach(item)}>
                          {t('bag.teach')}
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        variant="outline"
                        color="white"
                        borderColor="whiteAlpha.400"
                        onClick={() => handleThrowAway(item)}
                      >
                        {t('bag.throwAway')}
                      </Button>
                    </HStack>
                  </Box>
                ))}
                {filteredItems.length === 0 ? <Text color="gray.400">{t('bag.empty')}</Text> : null}
              </SimpleGrid>
            </TabPanel>
          );
        })}
      </TabPanels>
      {targetSelection ? (
        <ItemTargetModal
          item={targetSelection.item}
          usage={targetSelection.usage}
          party={party}
          pokemonCatalog={pokemonCatalog}
          onSelect={handleTargetSelected}
          onCancel={() => setTargetSelection(null)}
        />
      ) : null}
    </Tabs>
  );
}

/** Maps party Venomon to the shared Trainer Card team-icon shape. */
function toTrainerCardTeam(party: PokemonSummary[]): TrainerCardTeamMember[] {
  return party.map((pokemon) => ({
    name: pokemon.name,
    nickname: pokemon.nickname,
    sourcePokemonId: pokemon.sourcePokemonId,
    id: pokemon.id
  }));
}

function TrainerCardWindow({ openBattleHistory }: { openBattleHistory: () => void }) {
  const { user } = useAuth();
  const t = useT();
  const party = (user?.pokemonParty ?? []).slice(0, 6);

  return (
    <TrainerCardView
      name={user?.name}
      username={user?.username}
      trainerId={user?.id}
      money={user?.money ?? 0}
      description={user?.description}
      characterSkinId={user?.characterSkinId}
      badges={user?.badges ?? []}
      team={toTrainerCardTeam(party)}
      colorKey={user?.trainerCardColor}
      medalsLabel={t('trainer.gymMedals')}
      teamLabel={t('trainer.team')}
      noDescription={t('trainer.noDescription')}
      footer={
        <Button width="100%" colorScheme="teal" onClick={openBattleHistory}>
          {t('trainer.battleHistory')}
        </Button>
      }
    />
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
  const t = useT();
  const history = user?.battleHistory ?? [];

  return (
    <VStack align="stretch" spacing={3}>
      {history.map((entry) => <BattleHistoryCard key={entry.id} entry={entry} />)}
      {history.length === 0 ? <Text color="gray.400">{t('history.empty')}</Text> : null}
    </VStack>
  );
}

// CanaimaDex species data, proxied by server-poke.io from pokecraft-api
// (/dex/species/<essentialsId>.json — the API key never reaches the browser).
type DexSpecies = {
  pokemonId: string;
  dexNumber: number;
  name: string;
  category: string;
  growthRate: string;
  description?: string | null;
  types: string[];
  stats: {
    catchRate?: number;
    happiness?: number;
    genderRate?: string;
    baseExp?: number;
  } | null;
  foundOn: Array<{
    mapId: number;
    mapName: string | null;
    method: string;
    levelMin: number;
    levelMax: number;
  }>;
};

type DexLookup =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'loaded'; data: DexSpecies };

// Session cache so reopening stats windows doesn't refetch (null = 404).
const dexSpeciesCache = new Map<string, DexSpecies | null>();

function useCanaimaDex(essentialsId: string | undefined): [DexLookup, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [lookup, setLookup] = useState<DexLookup>(() => {
    if (!essentialsId) {
      return { status: 'missing' };
    }
    const cached = dexSpeciesCache.get(essentialsId);
    if (cached === undefined) {
      return { status: 'loading' };
    }
    return cached === null ? { status: 'missing' } : { status: 'loaded', data: cached };
  });

  useEffect(() => {
    if (!essentialsId) {
      setLookup({ status: 'missing' });
      return;
    }

    const cached = dexSpeciesCache.get(essentialsId);
    if (cached !== undefined) {
      setLookup(cached === null ? { status: 'missing' } : { status: 'loaded', data: cached });
      return;
    }

    let cancelled = false;
    setLookup({ status: 'loading' });

    (async () => {
      try {
        const response = await fetch(
          `${getBackendBaseUrl()}/dex/species/${encodeURIComponent(essentialsId)}.json`
        );

        if (response.status === 404) {
          dexSpeciesCache.set(essentialsId, null);
          if (!cancelled) {
            setLookup({ status: 'missing' });
          }
          return;
        }
        if (!response.ok) {
          throw new Error(`dex species request failed with ${response.status}`);
        }

        const data = await response.json() as DexSpecies;
        dexSpeciesCache.set(essentialsId, data);
        if (!cancelled) {
          setLookup({ status: 'loaded', data });
        }
      } catch {
        if (!cancelled) {
          setLookup({ status: 'error' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [essentialsId, attempt]);

  const retry = () => setAttempt((value) => value + 1);
  return [lookup, retry];
}

function PokemonStatsTab({
  pokemon,
  catalogEntry
}: {
  pokemon: PokemonSummary;
  catalogEntry: PokemonCatalogEntry | null;
}) {
  return (
    <VStack align="stretch" spacing={3}>
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
        <PokemonStatTile label="Held Item" value={pokemon.heldItemName ?? 'None'} />
      </SimpleGrid>

      {!catalogEntry ? (
        <Text color="yellow.200" fontSize="sm">
          Extra stat art was not found in the local Venomon catalog, so this card is using the party data only.
        </Text>
      ) : null}
    </VStack>
  );
}

type AvailableMoveOption = {
  name: string;
  /** Learnset level the move unlocks at; null when only known from a missed battle prompt. */
  level: number | null;
  /** True when this move was offered in battle but the prompt was never answered. */
  pending: boolean;
};

/**
 * Known moves plus every move the venomon is entitled to at its current
 * level (learnset up to `level`, and any battle learn prompt that was missed
 * when the battle UI closed). Learning and forgetting go through the
 * server-validated `pokemon:learn-move` / `pokemon:forget-move` events.
 */
function PokemonMovesTab({
  pokemon,
  catalogEntry,
  onOpenWorldMap
}: {
  pokemon: PokemonSummary;
  catalogEntry: PokemonCatalogEntry | null;
  onOpenWorldMap: () => void;
}) {
  const { learnPokemonMove, forgetPokemonMove } = useAuth();
  // Move picked to learn while four moves are known — the player must choose
  // which known move it replaces before anything is sent to the server.
  const [replacingWith, setReplacingWith] = useState<string | null>(null);

  const knownMovesKey = pokemon.moves.join('|');
  useEffect(() => {
    setReplacingWith(null);
  }, [knownMovesKey, pokemon.id]);

  const availableMoves = useMemo<AvailableMoveOption[]>(() => {
    const taken = new Set(pokemon.moves.map((move) => move.toLowerCase()));
    const options: AvailableMoveOption[] = [];

    for (const moveName of pokemon.pendingMoveLearns ?? []) {
      const key = moveName.toLowerCase();
      if (!taken.has(key)) {
        taken.add(key);
        options.push({ name: moveName, level: null, pending: true });
      }
    }

    const learnable = (catalogEntry?.profile.skills ?? [])
      .filter((entry) => entry.level <= pokemon.level)
      .sort((a, b) => b.level - a.level);
    for (const entry of learnable) {
      const key = entry.skillName.toLowerCase();
      if (!taken.has(key)) {
        taken.add(key);
        options.push({ name: entry.skillName, level: entry.level, pending: false });
      }
    }

    return options;
  }, [catalogEntry, pokemon.level, pokemon.moves, pokemon.pendingMoveLearns]);

  const partyIsFull = pokemon.moves.length >= 4;

  const handleLearn = (moveName: string) => {
    if (partyIsFull) {
      setReplacingWith((current) => (current === moveName ? null : moveName));
      return;
    }
    learnPokemonMove({ pokemonId: pokemon.id, moveName });
  };

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontSize="xs" color="gray.400" mb={2}>Known moves</Text>
        {pokemon.moves.length === 0 ? (
          <Text color="gray.400">No moves learned.</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {pokemon.moves.map((move) => (
              <HStack
                key={move}
                justify="space-between"
                bg="whiteAlpha.100"
                border="1px solid rgba(255,255,255,0.12)"
                p={3}
                borderRadius="8px"
              >
                <Text fontWeight="700" fontSize="sm" noOfLines={1}>{move}</Text>
                <HStack spacing={2} flexShrink={0}>
                  {typeof pokemon.movePp?.[move] === 'number' ? (
                    <Badge colorScheme="teal">{pokemon.movePp[move]} PP</Badge>
                  ) : null}
                  {move.trim().toLowerCase() === FLY_MOVE_NAME ? (
                    <Button size="xs" colorScheme="cyan" onClick={onOpenWorldMap}>
                      Use
                    </Button>
                  ) : null}
                  {replacingWith ? (
                    <Button
                      size="xs"
                      colorScheme="orange"
                      onClick={() => {
                        learnPokemonMove({
                          pokemonId: pokemon.id,
                          moveName: replacingWith,
                          replaceMoveName: move
                        });
                        setReplacingWith(null);
                      }}
                    >
                      Replace
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      colorScheme="red"
                      isDisabled={pokemon.moves.length <= 1}
                      title={pokemon.moves.length <= 1 ? 'A venomon must keep at least one move.' : undefined}
                      onClick={() => forgetPokemonMove({ pokemonId: pokemon.id, moveName: move })}
                    >
                      Forget
                    </Button>
                  )}
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}
        {replacingWith ? (
          <HStack mt={2} justify="space-between">
            <Text fontSize="xs" color="orange.200">
              {`Pick the move to replace with ${replacingWith}.`}
            </Text>
            <Button size="xs" variant="ghost" onClick={() => setReplacingWith(null)}>
              Cancel
            </Button>
          </HStack>
        ) : null}
      </Box>

      <Box>
        <Text fontSize="xs" color="gray.400" mb={2}>Available at this level</Text>
        {availableMoves.length === 0 ? (
          <Text color="gray.400" fontSize="sm">
            {catalogEntry
              ? 'Every move available at this level is already known.'
              : 'The move list for this venomon could not be loaded.'}
          </Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {availableMoves.map((option) => (
              <HStack
                key={option.name}
                justify="space-between"
                bg="whiteAlpha.100"
                border="1px solid rgba(255,255,255,0.12)"
                p={3}
                borderRadius="8px"
              >
                <HStack spacing={2} minW={0}>
                  <Text fontWeight="700" fontSize="sm" noOfLines={1}>{option.name}</Text>
                  {option.pending ? (
                    <Badge colorScheme="orange" flexShrink={0}>Missed in battle</Badge>
                  ) : option.level !== null ? (
                    <Badge colorScheme="purple" flexShrink={0}>Lv {option.level}</Badge>
                  ) : null}
                </HStack>
                <Button
                  size="xs"
                  colorScheme="teal"
                  variant={replacingWith === option.name ? 'solid' : 'outline'}
                  flexShrink={0}
                  onClick={() => handleLearn(option.name)}
                >
                  {partyIsFull ? (replacingWith === option.name ? 'Choosing...' : 'Learn...') : 'Learn'}
                </Button>
              </HStack>
            ))}
          </VStack>
        )}
        {partyIsFull && availableMoves.length > 0 && !replacingWith ? (
          <Text mt={2} fontSize="xs" color="gray.400">
            Four moves are known — learning a new one replaces a known move.
          </Text>
        ) : null}
      </Box>
    </VStack>
  );
}

function PokemonCanaimaDexTab({
  pokemon,
  catalogEntry
}: {
  pokemon: PokemonSummary;
  catalogEntry: PokemonCatalogEntry | null;
}) {
  const essentialsId = catalogEntry?.profile.essentialsId || undefined;
  const [lookup, retry] = useCanaimaDex(essentialsId);

  if (lookup.status === 'loading') {
    return (
      <HStack spacing={3} py={4} justify="center">
        <Spinner size="sm" />
        <Text color="gray.300" fontSize="sm">Consulting the CanaimaDex...</Text>
      </HStack>
    );
  }

  if (lookup.status === 'error') {
    return (
      <VStack align="stretch" spacing={3} py={2}>
        <Text color="gray.300" fontSize="sm">
          The CanaimaDex is unreachable right now. Check your connection and try again.
        </Text>
        <Button size="sm" alignSelf="start" onClick={retry}>Retry</Button>
      </VStack>
    );
  }

  // Even without a dex record, the local catalog often carries the entry text.
  const localDescription = catalogEntry?.profile.pokedex;

  if (lookup.status === 'missing') {
    return (
      <VStack align="stretch" spacing={3} py={2}>
        {localDescription ? <Text fontSize="sm">{localDescription}</Text> : null}
        <Text color="gray.400" fontSize="sm">
          {`No CanaimaDex record was found for ${getPokemonDisplayName(pokemon)}.`}
        </Text>
      </VStack>
    );
  }

  const dex = lookup.data;
  const description = dex.description || localDescription;

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={2} flexWrap="wrap">
        <Badge colorScheme="purple">No. {dex.dexNumber}</Badge>
        {dex.category ? <Badge>{dex.category}</Badge> : null}
        {dex.types.map((type) => <Badge key={type} colorScheme="cyan">{type}</Badge>)}
      </HStack>

      {description ? (
        <Box bg="whiteAlpha.100" border="1px solid rgba(255,255,255,0.12)" p={3} borderRadius="8px">
          <Text fontSize="sm">{description}</Text>
        </Box>
      ) : null}

      <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={3}>
        <PokemonStatTile label="Growth Rate" value={dex.growthRate || 'Unknown'} />
        <PokemonStatTile
          label="Catch Rate"
          value={typeof dex.stats?.catchRate === 'number' ? String(dex.stats.catchRate) : 'Unknown'}
        />
        <PokemonStatTile
          label="Base Friendship"
          value={typeof dex.stats?.happiness === 'number' ? String(dex.stats.happiness) : 'Unknown'}
        />
      </SimpleGrid>

      <Box>
        <Text fontSize="xs" color="gray.400" mb={2}>Habitat</Text>
        {dex.foundOn.length === 0 ? (
          <Text color="gray.400" fontSize="sm">
            This venomon has not been spotted in the wild.
          </Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {dex.foundOn.map((spot) => (
              <HStack
                key={`${spot.mapId}-${spot.method}`}
                justify="space-between"
                bg="whiteAlpha.100"
                border="1px solid rgba(255,255,255,0.12)"
                p={3}
                borderRadius="8px"
              >
                <Box minW={0}>
                  <Text fontWeight="700" fontSize="sm" noOfLines={1}>
                    {spot.mapName ?? `Map #${spot.mapId}`}
                  </Text>
                  <Text color="gray.400" fontSize="xs">{spot.method}</Text>
                </Box>
                <Badge colorScheme="teal" flexShrink={0}>
                  {spot.levelMin === spot.levelMax
                    ? `Lv ${spot.levelMin}`
                    : `Lv ${spot.levelMin}-${spot.levelMax}`}
                </Badge>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}

function PokemonStatsWindow({
  pokemon,
  catalogEntry,
  onOpenWorldMap
}: {
  pokemon: PokemonSummary;
  catalogEntry: PokemonCatalogEntry | null;
  onOpenWorldMap: () => void;
}) {
  const experienceProgress = pokemon.nextLevelExperience > 0
    ? Math.min((pokemon.experience / pokemon.nextLevelExperience) * 100, 100)
    : 0;

  return (
    <VStack align="stretch" spacing={4}>
      <HStack spacing={4} align="center">
        <Avatar
          name={getPokemonDisplayName(pokemon)}
          src={resolveServerAssetUrl(catalogEntry?.profile.iconImageSrc ?? '')}
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
              src={resolveServerAssetUrl(catalogEntry.profile.frontImageSrc)}
              alt={pokemon.name}
              boxSize="88px"
              objectFit="contain"
              style={{ imageRendering: 'pixelated' }}
              flexShrink={0}
            />
          ) : (
            <Avatar
              name={pokemon.name}
              src={resolveServerAssetUrl(catalogEntry?.profile.iconImageSrc ?? '')}
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

      <Tabs variant="soft-rounded" colorScheme="teal" size="sm" isLazy>
        <TabList gap={1}>
          <Tab color="gray.300">Stats</Tab>
          <Tab color="gray.300">Moves</Tab>
          <Tab color="gray.300">CanaimaDex</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0} pb={0}>
            <PokemonStatsTab pokemon={pokemon} catalogEntry={catalogEntry} />
          </TabPanel>
          <TabPanel px={0} pb={0}>
            <PokemonMovesTab pokemon={pokemon} catalogEntry={catalogEntry} onOpenWorldMap={onOpenWorldMap} />
          </TabPanel>
          <TabPanel px={0} pb={0}>
            <PokemonCanaimaDexTab pokemon={pokemon} catalogEntry={catalogEntry} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}

function PokemonCard({
  pokemon,
  catalogEntry,
  partyIndex,
  partySize,
  onOpenStats,
  onMoveInParty
}: {
  pokemon: PokemonSummary;
  catalogEntry: PokemonCatalogEntry | null;
  partyIndex: number;
  partySize: number;
  onOpenStats: (pokemonId: string) => void;
  onMoveInParty: (partyIndex: number, direction: -1 | 1) => void;
}) {
  const { user, namePokemon, holdInventoryItem, takeHeldItem } = useAuth();
  const t = useT();

  const handleGiveHeldItem = () => {
    const berries = (user?.inventory ?? []).filter(
      (item) => item.category === 'berries' && item.quantity > 0
    );

    if (berries.length === 0) {
      window.alert('You do not have any berries to give.');
      return;
    }

    const promptText = berries
      .map((item, index) => `${index + 1}. ${item.name} x${item.quantity}`)
      .join('\n');
    const selection = window.prompt(
      `Select a berry for ${getPokemonDisplayName(pokemon)} to hold.\n`
        + `It will be used automatically during battle when its condition is met:\n${promptText}`
    );
    const selectedIndex = selection ? Number.parseInt(selection, 10) - 1 : -1;
    const item = berries[selectedIndex];

    if (item) {
      holdInventoryItem({ pokemonId: pokemon.id, itemId: item.id });
    }
  };

  const handleTakeHeldItem = () => {
    takeHeldItem({ pokemonId: pokemon.id });
  };

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
            src={resolveServerAssetUrl(catalogEntry?.profile.iconImageSrc ?? '')}
            bg="whiteAlpha.200"
            flexShrink={0}
          />
          <Box minW={0}>
            <Text fontWeight="800" noOfLines={1}>{getPokemonDisplayName(pokemon)}</Text>
            {pokemon.nickname ? <Text color="gray.400" fontSize="xs">Real name: {pokemon.name}</Text> : null}
          </Box>
        </HStack>
        <HStack spacing={2} align="start">
          {partyIndex === 0 ? <Badge colorScheme="orange">{t('party.lead')}</Badge> : null}
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
              <MenuItem isDisabled={partyIndex === 0} onClick={() => onMoveInParty(partyIndex, -1)}>
                Move Up
              </MenuItem>
              <MenuItem
                isDisabled={partyIndex >= partySize - 1}
                onClick={() => onMoveInParty(partyIndex, 1)}
              >
                Move Down
              </MenuItem>
              <MenuItem onClick={handleGiveHeldItem}>
                {pokemon.heldItemName ? 'Swap Held Berry' : 'Give Berry to Hold'}
              </MenuItem>
              {pokemon.heldItemName ? (
                <MenuItem onClick={handleTakeHeldItem}>Take Held Item</MenuItem>
              ) : null}
            </MenuList>
          </Menu>
        </HStack>
      </HStack>
      <HStack mt={2} flexWrap="wrap">
        {pokemon.types.map((type) => <Badge key={type}>{type}</Badge>)}
        {pokemon.heldItemName ? (
          <Badge colorScheme="purple">Holding: {pokemon.heldItemName}</Badge>
        ) : null}
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
      <Text mt={3} fontSize="xs" color="gray.400">{t('party.moves')}</Text>
      <Text fontSize="sm">
        {pokemon.moves
          .map((move) => typeof pokemon.movePp?.[move] === 'number' ? `${move} (${pokemon.movePp[move]} PP)` : move)
          .join(', ') || t('party.noMoves')}
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
  const { reorderPokemonParty } = useAuth();
  const t = useT();

  const handleMoveInParty = (partyIndex: number, direction: -1 | 1) => {
    const targetIndex = partyIndex + direction;
    if (targetIndex < 0 || targetIndex >= party.length) {
      return;
    }

    const order = party.map((pokemon) => pokemon.id);
    [order[partyIndex], order[targetIndex]] = [order[targetIndex], order[partyIndex]];
    reorderPokemonParty({ order });
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Text color="gray.300">{t('party.onHand')} {party.length}/6</Text>
      <Text color="gray.500" fontSize="xs">
        {t('party.orderHint')}
      </Text>
      <Grid templateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={3}>
        {party.map((pokemon, index) => (
          <PokemonCard
            key={pokemon.id}
            pokemon={pokemon}
            catalogEntry={resolvePokemonCatalogEntry(pokemon, pokemonCatalog)}
            partyIndex={index}
            partySize={party.length}
            onOpenStats={onOpenStats}
            onMoveInParty={handleMoveInParty}
          />
        ))}
      </Grid>
      {party.length === 0 ? <Text color="gray.400">{t('party.empty')}</Text> : null}
    </VStack>
  );
}

function PokemonStatsFallback({ pokemonId }: { pokemonId: string }) {
  return (
    <VStack align="stretch" spacing={3}>
      <Text color="gray.300">
        Venomon `{pokemonId}` is no longer in your party, so this stats window cannot be updated.
      </Text>
      <Text color="gray.500" fontSize="sm">
        You can close this window or reopen the Venomons list to inspect a different party member.
      </Text>
    </VStack>
  );
}

const AccountMenu = () => {
  const toast = useToast();
  const t = useT();
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
      persistWindowPositions(next);
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

      return next;
    });

    openWindow(windowId);
  };

  const setDragEnabled = (value: boolean) => {
    setDragEnabledState(value);
    try {
      window.localStorage.setItem(DRAG_SETTING_KEY, value ? '1' : '0');
    } catch {
      // Storage full/unavailable — the toggle still applies for this session.
    }
  };

  const resetPositions = () => {
    setPositions(DEFAULT_POSITIONS);
    persistWindowPositions(DEFAULT_POSITIONS);
    toast({ title: t('settings.positionsReset'), status: 'success', duration: 2000, position: 'top' });
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
      return t(WINDOW_TITLE_KEYS[windowKey]);
    }

    const pokemon = party.find((entry) => entry.id === getPokemonIdFromStatsWindow(windowKey));
    return pokemon ? `${getPokemonDisplayName(pokemon)} ${t('menu.statsSuffix')}` : t('menu.pokemonStats');
  };

  const getWindowDesktopWidth = (windowKey: OpenWindowId) => {
    if (isPokemonStatsWindowId(windowKey)) {
      return '760px';
    }

    return windowKey === 'map' ? '620px' : '460px';
  };

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
          onOpenWorldMap={() => openWindow('map')}
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
      return <BagWindow onOpenWorldMap={() => openWindow('map')} />;
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

    if (windowKey === 'map') {
      return <WorldMapWindow onRequestClose={() => closeWindow('map')} />;
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
            {t('menu.menu')}
          </Text>
          <Text as="span" ml={2}>v</Text>
        </MenuButton>
        <MenuList color="gray.900">
          <MenuItem onClick={() => openWindow('account')}>{t('menu.account')}</MenuItem>
          <MenuItem onClick={() => openWindow('settings')}>{t('menu.settings')}</MenuItem>
          <MenuItem onClick={() => openWindow('bag')}>{t('menu.bag')}</MenuItem>
          <MenuItem onClick={() => openWindow('pokemons')}>{t('menu.pokemons')}</MenuItem>
          <MenuItem onClick={() => openWindow('map')}>{t('menu.map')}</MenuItem>
          <MenuItem onClick={() => openWindow('trainerCard')}>{t('menu.trainerCard')}</MenuItem>
          <MenuItem onClick={() => openWindow('battleHistory')}>{t('menu.battleHistory')}</MenuItem>
          {hasPermission('designer.access') ? (
            <MenuItem as={RouterLink} to="/designer">{t('menu.designer')}</MenuItem>
          ) : null}
          {hasPermission('moderator.access') ? (
            <MenuItem as={RouterLink} to="/moderator">{t('menu.moderator')}</MenuItem>
          ) : null}
          {hasPermission('admin.access') ? (
            <MenuItem as={RouterLink} to="/admin">{t('menu.admin')}</MenuItem>
          ) : null}
          <MenuItem color="red.500" onClick={logout}>{t('menu.logout')}</MenuItem>
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
