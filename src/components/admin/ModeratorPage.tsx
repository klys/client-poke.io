import {
  Box,
  Button,
  HStack,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/authContext';
import MapsOverview from './MapsOverview';
import type { OnlineMapOverview } from './types';

export default function ModeratorPage() {
  const toast = useToast();
  const { socket } = useAuth();
  const [maps, setMaps] = useState<OnlineMapOverview[]>([]);
  const [totalOnlinePlayers, setTotalOnlinePlayers] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const loadMaps = useCallback(() => {
    socket?.emit('moderation:maps:list');
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleMaps = (payload: {
      maps: OnlineMapOverview[]
      totalOnlinePlayers: number
      fetchedAt: string
    }) => {
      setMaps(payload.maps);
      setTotalOnlinePlayers(payload.totalOnlinePlayers);
      setFetchedAt(payload.fetchedAt);
    };

    const handleError = ({ message }: { message: string }) => {
      toast({
        title: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
        position: 'top'
      });
    };

    socket.on('moderation:maps:list', handleMaps);
    socket.on('moderation:error', handleError);
    loadMaps();

    return () => {
      socket.off('moderation:maps:list', handleMaps);
      socket.off('moderation:error', handleError);
    };
  }, [loadMaps, socket, toast]);

  return (
    <Box minH="100vh" bg="linear-gradient(180deg, #f6f0e5 0%, #ece2d2 100%)" px={{ base: 4, lg: 8 }} py={{ base: 5, lg: 8 }}>
      <Box maxW="1280px" mx="auto">
        <Stack spacing={6}>
          <Box
            borderRadius="32px"
            bg="rgba(255,255,255,0.88)"
            border="1px solid rgba(105, 80, 53, 0.14)"
            boxShadow="0 28px 60px rgba(105, 80, 53, 0.12)"
            p={{ base: 5, lg: 8 }}
          >
            <Stack spacing={4}>
              <Box>
                <Text fontSize="sm" textTransform="uppercase" letterSpacing="0.18em" color="#8a6a49" fontWeight="700">
                  Moderator
                </Text>
                <Text fontSize={{ base: '2xl', lg: '4xl' }} fontWeight="900" color="#362414" lineHeight="1">
                  Watch live map activity without leaving the client.
                </Text>
              </Box>
              <HStack spacing={3} flexWrap="wrap">
                <Button colorScheme="orange" variant="outline" onClick={loadMaps}>
                  Refresh Overview
                </Button>
                <Button as={RouterLink} to="/" variant="ghost">
                  Back To Game
                </Button>
              </HStack>
            </Stack>
          </Box>

          <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(105, 80, 53, 0.10)">
            <MapsOverview
              maps={maps}
              totalOnlinePlayers={totalOnlinePlayers}
              fetchedAt={fetchedAt}
              emptyMessage="No players are online right now."
            />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
