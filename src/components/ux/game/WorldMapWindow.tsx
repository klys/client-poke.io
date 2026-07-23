import { Badge, Box, Button, HStack, Image, Text, VStack, useToast } from '@chakra-ui/react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppContext } from '../../../context/appContext';
import { useAuth } from '../../../context/authContext';
import { useT } from '../../../i18n';
import { getFlyablePoints, resolveTownMapLocation } from '../../game/worldMap';
import { TOWN_MAP_GRID_PX, type TownMapPoint } from '../../game/townMapData';

export const FLY_MOVE_NAME = 'volar';

export function partyKnowsFly(party: Array<{ moves?: string[] }>): boolean {
  return party.some((pokemon) =>
    (pokemon.moves ?? []).some((move) => move.trim().toLowerCase() === FLY_MOVE_NAME)
  );
}

// Original region image + marker sprites (public/townmap/, from the game's
// Graphics/Pictures). The image is 480x320 with 16px grid squares; the
// player/fly/cursor sprites are 32x32 drawn centered over a square (fly and
// cursor are 2-frame 64x32 strips — the CSS crop shows the first frame).
const REGION_IMAGE_WIDTH = 480;
const REGION_IMAGE_HEIGHT = 320;
const MARKER_SIZE = 32;

const townmapAsset = (name: string) => `${process.env.PUBLIC_URL ?? ''}/townmap/${name}`;

function markerOffsetPx(grid: number) {
  return grid * TOWN_MAP_GRID_PX + TOWN_MAP_GRID_PX / 2 - MARKER_SIZE / 2;
}

const WorldMapWindow = ({ onRequestClose }: { onRequestClose?: () => void }) => {
  const { players, myplayer, playableMapsState, socket } = useContext(AppContext);
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();

  const flyablePoints = useMemo(() => getFlyablePoints(playableMapsState), [playableMapsState]);

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

  const handleFly = () => {
    if (!selectedTown?.fly || !socket) {
      return;
    }
    setFlyingTo(selectedTown.fly.mapId);
    socket.emit('player:fly', { mapId: selectedTown.fly.mapId });
    setSelectedTown(null);
  };

  return (
    <VStack align="stretch" spacing={3}>
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

          {flyablePoints.map((point) => {
            const isSelected = selectedTown?.name === point.name;
            const clickable = canFly && point.fly!.mapId !== currentMapId;

            return (
              <Box
                key={`${point.gridX}-${point.gridY}-${point.name}`}
                position="absolute"
                left={`${markerOffsetPx(point.gridX)}px`}
                top={`${markerOffsetPx(point.gridY)}px`}
                width={`${MARKER_SIZE}px`}
                height={`${MARKER_SIZE}px`}
                cursor={clickable ? 'pointer' : 'default'}
                title={point.name}
                onClick={() => handleTownClick(point)}
                _hover={clickable ? { filter: 'brightness(1.3)' } : undefined}
              >
                {canFly && clickable ? (
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
            );
          })}

          {location ? (
            <Box
              position="absolute"
              left={`${markerOffsetPx(location.gridX)}px`}
              top={`${markerOffsetPx(location.gridY)}px`}
              width={`${MARKER_SIZE}px`}
              height={`${MARKER_SIZE}px`}
              backgroundImage={`url(${townmapAsset('mapPlayer000.png')})`}
              pointerEvents="none"
              sx={{
                animation: 'world-map-pulse 1.4s ease-in-out infinite',
                '@keyframes world-map-pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.55 },
                },
              }}
            />
          ) : null}
        </Box>
      </Box>

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
              <Button size="xs" colorScheme="teal" isLoading={flyingTo !== null} onClick={handleFly}>
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
