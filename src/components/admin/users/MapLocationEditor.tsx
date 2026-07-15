import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import type { AdminMapCatalogEntry } from '../types';

type MapLocationEditorProps = {
  mapId: string
  x: string
  y: string
  maps: AdminMapCatalogEntry[]
  onChange: (next: { mapId?: string; x?: string; y?: string }) => void
}

export default function MapLocationEditor({ mapId, x, y, maps, onChange }: MapLocationEditorProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [query, setQuery] = useState('');

  const selected = useMemo(() => maps.find((entry) => entry.mapId === mapId) ?? null, [maps, mapId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? maps.filter((entry) => `${entry.name} ${entry.mapId} ${entry.category}`.toLowerCase().includes(needle))
      : maps;
    return base.slice(0, 120);
  }, [maps, query]);

  const label = selected ? selected.name : mapId ? mapId : 'Choose a map…';

  return (
    <Box borderRadius="20px" bg="#f6f8f3" p={4}>
      <HStack justify="space-between" mb={3} flexWrap="wrap">
        <Text fontWeight="800">Location</Text>
        {mapId ? <Badge colorScheme="green" borderRadius="full">{mapId}</Badge> : null}
      </HStack>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
        <FormControl gridColumn={{ md: 'span 3' }}>
          <FormLabel fontSize="sm">Map</FormLabel>
          <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-start" isLazy matchWidth>
            <PopoverTrigger>
              <Button
                w="100%"
                justifyContent="space-between"
                variant="outline"
                bg="white"
                fontWeight="600"
                rightIcon={<Text as="span">▾</Text>}
                isDisabled={maps.length === 0}
              >
                <Text noOfLines={1}>{label}</Text>
              </Button>
            </PopoverTrigger>
            <PopoverContent w="100%">
              <PopoverArrow />
              <PopoverBody>
                <InputGroup size="sm" mb={2}>
                  <InputLeftElement pointerEvents="none">🔍</InputLeftElement>
                  <Input
                    autoFocus
                    placeholder="Search maps..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </InputGroup>
                <Stack spacing={1} maxH="260px" overflowY="auto">
                  {filtered.length === 0 ? (
                    <Text fontSize="sm" color="#68776b" py={2} textAlign="center">No matching maps.</Text>
                  ) : (
                    filtered.map((entry) => (
                      <HStack
                        key={entry.mapId}
                        p={2}
                        borderRadius="10px"
                        cursor="pointer"
                        bg={entry.mapId === mapId ? '#e7f4e8' : undefined}
                        _hover={{ bg: '#f2f7f0' }}
                        onClick={() => {
                          onChange({ mapId: entry.mapId });
                          onClose();
                          setQuery('');
                        }}
                      >
                        <Stack spacing={0} flex="1" minW={0}>
                          <Text fontSize="sm" fontWeight="600" noOfLines={1}>{entry.name}</Text>
                          <Text fontSize="0.66rem" color="#8a9782" noOfLines={1}>{entry.category || entry.mapId}</Text>
                        </Stack>
                      </HStack>
                    ))
                  )}
                </Stack>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">X</FormLabel>
          <Input bg="white" value={x} onChange={(event) => onChange({ x: event.target.value })} />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Y</FormLabel>
          <Input bg="white" value={y} onChange={(event) => onChange({ y: event.target.value })} />
        </FormControl>
      </SimpleGrid>
      <Text fontSize="xs" color="#8a9782" mt={2}>
        Saving a new location teleports the trainer instantly if they are online.
      </Text>
    </Box>
  );
}
