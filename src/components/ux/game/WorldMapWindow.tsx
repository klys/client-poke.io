import {
  Badge,
  Box,
  Button,
  HStack,
  Image,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppContext } from '../../../context/appContext';
import { useAuth } from '../../../context/authContext';
import { useT } from '../../../i18n';
import { getFlyablePoints, resolveTownMapLocation } from '../../game/worldMap';
import { TOWN_MAP_GRID_PX, TOWN_MAP_POINTS, type TownMapPoint } from '../../game/townMapData';
import {
  getCharacterSkinPreview,
  loadCharacterSkinCatalog,
} from './characterSkinCatalog';
import {
  DESIGNER_CACHE_UPDATED_EVENT,
} from '../../designer/designerCache';
import {
  getPlayableMapBackgroundStyle,
  getPlayableMapById,
} from '../../game/playableMapRuntime';
import TileMapSurface from '../../game/TileMapSurface';

export const FLY_MOVE_NAME = 'volar';

export function partyKnowsFly(party: Array<{ moves?: string[] }>): boolean {
  return party.some((pokemon) =>
    (pokemon.moves ?? []).some((move) => move.trim().toLowerCase() === FLY_MOVE_NAME)
  );
}

// Original region image + marker sprites (public/townmap/, from the game's
// Graphics/Pictures). The image is 480x320 with 16px grid squares; the
// fly/cursor sprites are 32x32 drawn centered over a square (both are
// 2-frame 64x32 strips — the CSS crop shows the first frame).
const REGION_IMAGE_WIDTH = 480;
const REGION_IMAGE_HEIGHT = 320;
const MARKER_SIZE = 32;

// The scaled-down "current map" view fits inside the same footprint as the
// region image so the window keeps one size across tabs.
const MINIMAP_MAX_WIDTH = 480;
const MINIMAP_MAX_HEIGHT = 320;

const townmapAsset = (name: string) => `${process.env.PUBLIC_URL ?? ''}/townmap/${name}`;

function markerOffsetPx(grid: number) {
  return grid * TOWN_MAP_GRID_PX + TOWN_MAP_GRID_PX / 2 - MARKER_SIZE / 2;
}

/** Standing-down sprite of the player's chosen skin ('' when unavailable). */
function usePlayerSkinSprite(characterSkinId: string | undefined) {
  const [catalog, setCatalog] = useState(() => loadCharacterSkinCatalog());

  useEffect(() => {
    const sync = () => setCatalog(loadCharacterSkinCatalog());
    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, sync);
  }, []);

  return useMemo(() => {
    if (!characterSkinId) {
      return '';
    }
    const profile = catalog.find((item) => item.id === characterSkinId)?.profile;
    return getCharacterSkinPreview(profile);
  }, [catalog, characterSkinId]);
}

/** Player position marker: the chosen skin standing south, or the original
 *  generic map head when the skin (or its sprite) is unavailable. */
const PlayerMarker = ({ skinSprite, testId }: { skinSprite: string; testId: string }) => (
  <Box
    width={`${MARKER_SIZE}px`}
    height={`${MARKER_SIZE}px`}
    data-testid={testId}
    pointerEvents="none"
    sx={{
      animation: 'world-map-pulse 1.4s ease-in-out infinite',
      '@keyframes world-map-pulse': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.55 },
      },
    }}
  >
    {skinSprite ? (
      // Skins are 32x48; anchor to the marker's bottom center so the feet
      // sit on the marked square, mirroring the in-world sprite anchor.
      <Image
        src={skinSprite}
        alt=""
        position="absolute"
        bottom="0"
        left="50%"
        transform="translateX(-50%)"
        width="22px"
        height="auto"
        draggable={false}
        sx={{ imageRendering: 'pixelated' }}
      />
    ) : (
      <Box
        position="absolute"
        inset={0}
        backgroundImage={`url(${townmapAsset('mapPlayer000.png')})`}
      />
    )}
  </Box>
);

const CurrentMapPanel = ({
  skinSprite,
}: {
  skinSprite: string;
}) => {
  const { players, myplayer, playableMapsState } = useContext(AppContext);
  const t = useT();

  const currentPlayer = Object.values(players as Record<string, any>).find(
    (entry: any) => entry?.playerId === myplayer
  );
  const currentMapId: string | null = currentPlayer?.currentMapId ?? null;

  const activeMap = useMemo(
    () => getPlayableMapById(currentMapId, playableMapsState),
    [currentMapId, playableMapsState]
  );

  if (!activeMap) {
    return <Text color="gray.400" fontSize="sm">{t('map.unknownLocation')}</Text>;
  }

  const pixelWidth = activeMap.config.width * activeMap.config.cellSize;
  const pixelHeight = activeMap.config.height * activeMap.config.cellSize;
  const scale = Math.min(1, MINIMAP_MAX_WIDTH / pixelWidth, MINIMAP_MAX_HEIGHT / pixelHeight);
  const scaledWidth = Math.round(pixelWidth * scale);
  const scaledHeight = Math.round(pixelHeight * scale);
  const tileMap = activeMap.editorData.tileMap?.baked ? activeMap.editorData.tileMap : null;

  const playerX = Number(currentPlayer?.x ?? 0);
  const playerY = Number(currentPlayer?.y ?? 0);

  return (
    <VStack align="stretch" spacing={2}>
      <Box
        bg="#0e1a2b"
        border="1px solid rgba(255,255,255,0.14)"
        borderRadius="10px"
        p={2}
        display="flex"
        justifyContent="center"
      >
        <Box
          position="relative"
          width={`${scaledWidth}px`}
          height={`${scaledHeight}px`}
          overflow="hidden"
          borderRadius="4px"
        >
          {/* The exact baked in-game map, scaled down as one block. */}
          <Box
            position="absolute"
            left={0}
            top={0}
            width={`${pixelWidth}px`}
            height={`${pixelHeight}px`}
            transform={`scale(${scale})`}
            transformOrigin="top left"
            style={tileMap ? { backgroundColor: activeMap.config.backgroundColor } : getPlayableMapBackgroundStyle(activeMap.config)}
          >
            {tileMap ? (
              <>
                <TileMapSurface tileMap={tileMap} plane="background" zIndex={0} />
                <TileMapSurface tileMap={tileMap} plane="foreground" zIndex={1} />
              </>
            ) : null}
          </Box>
          {/* Marker drawn unscaled on top so it stays visible on huge maps. */}
          <Box
            position="absolute"
            left={`${playerX * scale}px`}
            top={`${playerY * scale}px`}
            transform="translate(-50%, -100%)"
          >
            <PlayerMarker skinSprite={skinSprite} testId="minimap-marker" />
          </Box>
        </Box>
      </Box>
      <Text fontSize="xs" color="gray.400" textAlign="center" noOfLines={1}>
        {activeMap.item.name}
      </Text>
    </VStack>
  );
};

const WorldMapWindow = ({ onRequestClose }: { onRequestClose?: () => void }) => {
  const { players, myplayer, playableMapsState, socket } = useContext(AppContext);
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();

  const flyablePoints = useMemo(() => getFlyablePoints(playableMapsState), [playableMapsState]);
  const flyableNames = useMemo(
    () => new Set(flyablePoints.map((point) => point.name)),
    [flyablePoints]
  );

  // NOT memoized on `players`: the app reducer mutates the players array in
  // place, so its reference is stable and a memo would never see moves. The
  // provider still re-renders consumers on every dispatch, so computing per
  // render keeps the marker (and the fly auto-close below) live.
  const currentPlayer = Object.values(players as Record<string, any>).find(
    (entry: any) => entry?.playerId === myplayer
  );
  const currentMapId: string | null = currentPlayer?.currentMapId ?? null;

  const location = useMemo(
    () => resolveTownMapLocation(playableMapsState, currentMapId),
    [playableMapsState, currentMapId]
  );

  const skinSprite = usePlayerSkinSprite(
    currentPlayer?.characterSkinId || user?.characterSkinId
  );

  const canFly = partyKnowsFly(user?.pokemonParty ?? []);
  const [selectedTown, setSelectedTown] = useState<TownMapPoint | null>(null);
  const [flyingTo, setFlyingTo] = useState<string | null>(null);
  const flyingToRef = useRef<string | null>(null);
  flyingToRef.current = flyingTo;

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleFlyError = (data: { message?: string }) => {
      setFlyingTo(null);
      toast({
        title: data?.message ?? t('map.flyFailed'),
        status: 'error',
        duration: 4000,
        position: 'top',
      });
    };

    socket.on('player:fly-error', handleFlyError);

    return () => {
      socket.off('player:fly-error', handleFlyError);
    };
  }, [socket, t, toast]);

  // The flight is confirmed by the world itself: the teleport lands the
  // player on the destination map, so close the window once that happens.
  useEffect(() => {
    if (flyingToRef.current && currentMapId === flyingToRef.current) {
      setFlyingTo(null);
      onRequestClose?.();
    }
  }, [currentMapId, onRequestClose]);

  const handleTownClick = (point: TownMapPoint) => {
    if (!canFly || !point.fly || point.fly.mapId === currentMapId) {
      return;
    }
    setSelectedTown((current) => (current?.name === point.name ? null : point));
  };

  const regionView = (
    <Box
      bg="#0e1a2b"
      border="1px solid rgba(255,255,255,0.14)"
      borderRadius="10px"
      p={2}
      overflow="auto"
    >
      <Box
        position="relative"
        width={`${REGION_IMAGE_WIDTH}px`}
        height={`${REGION_IMAGE_HEIGHT}px`}
        mx="auto"
        sx={{ imageRendering: 'pixelated' }}
      >
        <Image
          src={townmapAsset('mapRegion0.png')}
          alt={t('menu.map')}
          width={`${REGION_IMAGE_WIDTH}px`}
          height={`${REGION_IMAGE_HEIGHT}px`}
          draggable={false}
          pointerEvents="none"
        />

        {/* Every named section gets a hover tooltip on its grid square;
            flyable towns are additionally clickable with the wing icon. */}
        {TOWN_MAP_POINTS.map((point, index) => {
          const flyable = flyableNames.has(point.name) && Boolean(point.fly);
          const isSelected = flyable && selectedTown?.name === point.name;
          const clickable = flyable && canFly && point.fly!.mapId !== currentMapId;

          return (
            <Tooltip
              key={`${point.gridX}-${point.gridY}-${index}`}
              label={point.poi ? `${point.name} — ${point.poi}` : point.name}
              placement="top"
              hasArrow
              openDelay={100}
              bg="gray.800"
              color="white"
              fontSize="xs"
            >
              <Box
                position="absolute"
                left={`${markerOffsetPx(point.gridX)}px`}
                top={`${markerOffsetPx(point.gridY)}px`}
                width={`${MARKER_SIZE}px`}
                height={`${MARKER_SIZE}px`}
                cursor={clickable ? 'pointer' : 'default'}
                data-townmap-name={point.name}
                onClick={() => handleTownClick(point)}
                _hover={{ filter: 'brightness(1.3)' }}
              >
                {clickable ? (
                  <Box
                    width={`${MARKER_SIZE}px`}
                    height={`${MARKER_SIZE}px`}
                    backgroundImage={`url(${townmapAsset('mapFly.png')})`}
                    backgroundPosition="0 0"
                    opacity={isSelected ? 1 : 0.85}
                    pointerEvents="none"
                  />
                ) : null}
                {isSelected ? (
                  <Box
                    position="absolute"
                    inset={0}
                    backgroundImage={`url(${townmapAsset('mapCursor.png')})`}
                    backgroundPosition="0 0"
                    pointerEvents="none"
                  />
                ) : null}
              </Box>
            </Tooltip>
          );
        })}

        {location ? (
          <Box
            position="absolute"
            left={`${markerOffsetPx(location.gridX)}px`}
            top={`${markerOffsetPx(location.gridY)}px`}
            pointerEvents="none"
          >
            <PlayerMarker skinSprite={skinSprite} testId="worldmap-marker" />
          </Box>
        ) : null}
      </Box>
    </Box>
  );

  return (
    <VStack align="stretch" spacing={3}>
      <Tabs variant="soft-rounded" colorScheme="teal" size="sm" isLazy>
        <TabList gap={1}>
          <Tab color="gray.300">{t('map.regionTab')}</Tab>
          <Tab color="gray.300">{t('map.currentMapTab')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0} pb={0}>
            {regionView}
          </TabPanel>
          <TabPanel px={0} pb={0}>
            <CurrentMapPanel skinSprite={skinSprite} />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <HStack justify="flex-start" align="center" minH="24px" spacing={2}>
        <Badge colorScheme="yellow" flexShrink={0}>{t('map.youAreHere')}</Badge>
        <Text fontSize="sm" color="gray.200" noOfLines={1}>
          {location
            ? location.isExact
              ? location.mapName
              : `${location.mapName} (${t('map.indoors')})`
            : t('map.unknownLocation')}
        </Text>
      </HStack>

      {canFly ? (
        selectedTown ? (
          <HStack
            justify="space-between"
            bg="whiteAlpha.100"
            border="1px solid rgba(255,255,255,0.12)"
            borderRadius="8px"
            p={2}
          >
            <Text fontSize="sm" color="gray.100" noOfLines={1}>
              {`${t('map.flyTo')} ${selectedTown.name}?`}
            </Text>
            <HStack spacing={2} flexShrink={0}>
              <Button
                size="xs"
                colorScheme="teal"
                isLoading={flyingTo !== null}
                onClick={() => {
                  if (!selectedTown?.fly || !socket) {
                    return;
                  }
                  setFlyingTo(selectedTown.fly.mapId);
                  socket.emit('player:fly', { mapId: selectedTown.fly.mapId });
                  setSelectedTown(null);
                }}
              >
                {t('map.fly')}
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setSelectedTown(null)}>
                {t('map.cancel')}
              </Button>
            </HStack>
          </HStack>
        ) : (
          <Text fontSize="xs" color="gray.400">{t('map.flyHint')}</Text>
        )
      ) : (
        <Text fontSize="xs" color="gray.500">{t('map.noFly')}</Text>
      )}
    </VStack>
  );
};

export default WorldMapWindow;
