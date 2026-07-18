import { Badge, Box, Button, HStack, Text, VStack, useToast } from '@chakra-ui/react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppContext } from '../../../context/appContext';
import { useAuth } from '../../../context/authContext';
import { useT } from '../../../i18n';
import {
  buildWorldMapLayout,
  resolveWorldMapLocation,
  type WorldMapPlacement,
} from '../../game/worldMap';

export const FLY_MOVE_NAME = 'volar';

export function partyKnowsFly(party: Array<{ moves?: string[] }>): boolean {
  return party.some((pokemon) =>
    (pokemon.moves ?? []).some((move) => move.trim().toLowerCase() === FLY_MOVE_NAME)
  );
}

// Rendered size the map scales itself into (the window supplies the chrome).
const VIEWPORT_WIDTH = 552;
const VIEWPORT_HEIGHT = 380;
const MIN_PX_PER_CELL = 0.7;
const MAX_PX_PER_CELL = 4;

const TOWN_COLOR = '#e05d5d';
const ROUTE_COLOR = '#3f7d4e';
const CURRENT_OUTLINE = '#ffef69';

const WorldMapWindow = ({ onRequestClose }: { onRequestClose?: () => void }) => {
  const { players, myplayer, playableMapsState, socket } = useContext(AppContext);
  const { user } = useAuth();
  const t = useT();
  const toast = useToast();

  const layout = useMemo(() => buildWorldMapLayout(playableMapsState), [playableMapsState]);

  // NOT memoized on `players`: the app reducer mutates the players array in
  // place, so its reference is stable and a memo would never see moves. The
  // provider still re-renders consumers on every dispatch, so computing per
  // render keeps the marker (and the fly auto-close below) live.
  const currentPlayer = Object.values(players as Record<string, any>).find(
    (entry: any) => entry?.playerId === myplayer
  );
  const currentMapId: string | null = currentPlayer?.currentMapId ?? null;

  const location = useMemo(
    () => resolveWorldMapLocation(playableMapsState, layout, currentMapId),
    [playableMapsState, layout, currentMapId]
  );

  const canFly = partyKnowsFly(user?.pokemonParty ?? []);
  const [selectedTown, setSelectedTown] = useState<WorldMapPlacement | null>(null);
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

  if (layout.placements.length === 0) {
    return <Text color="gray.400">{t('map.empty')}</Text>;
  }

  const pxPerCell = Math.min(
    MAX_PX_PER_CELL,
    Math.max(
      MIN_PX_PER_CELL,
      Math.min(VIEWPORT_WIDTH / layout.widthCells, VIEWPORT_HEIGHT / layout.heightCells)
    )
  );
  const canvasWidth = Math.ceil(layout.widthCells * pxPerCell);
  const canvasHeight = Math.ceil(layout.heightCells * pxPerCell);

  const markerPosition = location
    ? {
        left:
          (location.placement.cellX +
            (location.isExact && currentPlayer
              ? Math.min(
                  location.placement.widthCells,
                  Math.max(0, (currentPlayer.x ?? 0) / location.placement.cellSize)
                )
              : location.placement.widthCells / 2)) * pxPerCell,
        top:
          (location.placement.cellY +
            (location.isExact && currentPlayer
              ? Math.min(
                  location.placement.heightCells,
                  Math.max(0, (currentPlayer.y ?? 0) / location.placement.cellSize)
                )
              : location.placement.heightCells / 2)) * pxPerCell,
      }
    : null;

  const handleTownClick = (placement: WorldMapPlacement) => {
    if (!canFly || placement.mapId === location?.placement.mapId) {
      return;
    }
    setSelectedTown((current) => (current?.mapId === placement.mapId ? null : placement));
  };

  const handleFly = () => {
    if (!selectedTown || !socket) {
      return;
    }
    setFlyingTo(selectedTown.mapId);
    socket.emit('player:fly', { mapId: selectedTown.mapId });
    setSelectedTown(null);
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Box
        maxH={`${VIEWPORT_HEIGHT}px`}
        overflow="auto"
        bg="#0e1a2b"
        border="1px solid rgba(255,255,255,0.14)"
        borderRadius="10px"
        p={2}
      >
        <Box position="relative" width={`${canvasWidth}px`} height={`${canvasHeight}px`} mx="auto">
          {layout.placements.map((placement) => {
            const isCurrent = placement.mapId === location?.placement.mapId;
            const isSelected = placement.mapId === selectedTown?.mapId;
            const clickable = canFly && placement.isTown && !isCurrent;

            return (
              <Box
                key={placement.mapId}
                position="absolute"
                left={`${placement.cellX * pxPerCell}px`}
                top={`${placement.cellY * pxPerCell}px`}
                width={`${Math.max(3, placement.widthCells * pxPerCell)}px`}
                height={`${Math.max(3, placement.heightCells * pxPerCell)}px`}
                bg={placement.isTown ? TOWN_COLOR : ROUTE_COLOR}
                opacity={placement.isTown ? 0.95 : 0.75}
                borderRadius="3px"
                border={
                  isCurrent
                    ? `2px solid ${CURRENT_OUTLINE}`
                    : isSelected
                      ? '2px solid #7fd4ff'
                      : '1px solid rgba(0,0,0,0.45)'
                }
                cursor={clickable ? 'pointer' : 'default'}
                title={placement.name}
                onClick={() => handleTownClick(placement)}
                _hover={clickable ? { filter: 'brightness(1.25)' } : undefined}
                overflow="hidden"
              >
                {placement.isTown ? (
                  <Text
                    fontSize="10px"
                    fontWeight="700"
                    color="whiteAlpha.900"
                    px={1}
                    noOfLines={2}
                    lineHeight="1.1"
                    pointerEvents="none"
                  >
                    {placement.name}
                  </Text>
                ) : null}
              </Box>
            );
          })}
          {markerPosition ? (
            <Box
              position="absolute"
              left={`${markerPosition.left}px`}
              top={`${markerPosition.top}px`}
              transform="translate(-50%, -50%)"
              width="12px"
              height="12px"
              borderRadius="full"
              bg="#ffef69"
              border="2px solid #1f1f1f"
              boxShadow="0 0 0 4px rgba(255,239,105,0.35)"
              pointerEvents="none"
              sx={{
                animation: 'world-map-pulse 1.4s ease-in-out infinite',
                '@keyframes world-map-pulse': {
                  '0%, 100%': { boxShadow: '0 0 0 3px rgba(255,239,105,0.45)' },
                  '50%': { boxShadow: '0 0 0 8px rgba(255,239,105,0.12)' },
                },
              }}
            />
          ) : null}
        </Box>
      </Box>

      <HStack justify="space-between" align="center" minH="24px">
        <HStack spacing={2} minW={0}>
          <Badge colorScheme="yellow" flexShrink={0}>{t('map.youAreHere')}</Badge>
          <Text fontSize="sm" color="gray.200" noOfLines={1}>
            {location
              ? location.isExact
                ? location.placement.name
                : `${location.placement.name} (${t('map.indoors')})`
              : t('map.unknownLocation')}
          </Text>
        </HStack>
        <HStack spacing={3} flexShrink={0}>
          <HStack spacing={1}>
            <Box w="10px" h="10px" borderRadius="2px" bg={TOWN_COLOR} />
            <Text fontSize="xs" color="gray.400">{t('map.towns')}</Text>
          </HStack>
          <HStack spacing={1}>
            <Box w="10px" h="10px" borderRadius="2px" bg={ROUTE_COLOR} />
            <Text fontSize="xs" color="gray.400">{t('map.routes')}</Text>
          </HStack>
        </HStack>
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
