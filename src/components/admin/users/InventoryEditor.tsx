import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  useDisclosure
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import type { AdminInventoryItem, AdminItemCatalogEntry } from '../types';
import { CATEGORY_META, CATEGORY_ORDER, ItemIcon } from './shared';

type InventoryEditorProps = {
  items: AdminInventoryItem[]
  catalog: AdminItemCatalogEntry[]
  onChange: (items: AdminInventoryItem[]) => void
}

function clampQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(9999, Math.round(value)));
}

export default function InventoryEditor({ items, catalog, onChange }: InventoryEditorProps) {
  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const setQuantity = (id: string, quantity: number) => {
    onChange(items.map((item) => (item.id === id ? { ...item, quantity: clampQuantity(quantity) } : item)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const addFromCatalog = (entry: AdminItemCatalogEntry) => {
    const existing = items.find((item) => item.id === entry.id);
    if (existing) {
      setQuantity(entry.id, existing.quantity + 1);
      return;
    }
    onChange([
      ...items,
      {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        quantity: 1,
        description: entry.description,
        iconSrc: entry.iconSrc
      }
    ]);
  };

  const sorted = useMemo(() => {
    return [...items].sort((left, right) => {
      const categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }
      return left.name.localeCompare(right.name);
    });
  }, [items]);

  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
        <HStack spacing={2}>
          <Text fontWeight="800" color="#1f2d22" fontSize="lg">Inventory</Text>
          <Badge colorScheme="green" borderRadius="full">{items.length} items</Badge>
          <Badge colorScheme="gray" borderRadius="full">{totalQuantity} total</Badge>
        </HStack>
        <AddItemPopover catalog={catalog} onAdd={addFromCatalog} />
      </HStack>

      {items.length === 0 ? (
        <Box borderRadius="16px" bg="#f6f8f3" p={6} textAlign="center" color="#68776b" border="1px dashed rgba(56,78,58,0.2)">
          The bag is empty. Use “Add item” to grant something.
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
          {sorted.map((item) => {
            const meta = CATEGORY_META[item.category];
            return (
              <HStack
                key={item.id}
                spacing={3}
                p={3}
                borderRadius="16px"
                bg="white"
                border="1px solid rgba(56,78,58,0.10)"
                align="center"
                _hover={{ borderColor: 'rgba(56,78,58,0.24)' }}
              >
                <ItemIcon src={item.iconSrc} category={item.category} alt={item.name} />
                <Stack spacing={1} flex="1" minW={0}>
                  <HStack spacing={2}>
                    <Tooltip label={item.description || item.id} openDelay={400}>
                      <Text fontWeight="700" noOfLines={1}>{item.name}</Text>
                    </Tooltip>
                  </HStack>
                  <Badge colorScheme={meta.color} borderRadius="full" alignSelf="flex-start" fontSize="0.62rem">
                    {meta.label}
                  </Badge>
                </Stack>
                <HStack spacing={1}>
                  <IconButton
                    aria-label="Decrease"
                    size="xs"
                    variant="outline"
                    onClick={() => setQuantity(item.id, item.quantity - 1)}
                    isDisabled={item.quantity <= 0}
                  >
                    −
                  </IconButton>
                  <Input
                    size="xs"
                    w="52px"
                    textAlign="center"
                    value={item.quantity}
                    onChange={(event) => setQuantity(item.id, Number(event.target.value))}
                  />
                  <IconButton
                    aria-label="Increase"
                    size="xs"
                    variant="outline"
                    onClick={() => setQuantity(item.id, item.quantity + 1)}
                  >
                    +
                  </IconButton>
                  <Tooltip label="Remove item" openDelay={400}>
                    <IconButton
                      aria-label="Remove"
                      size="xs"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => removeItem(item.id)}
                    >
                      ✕
                    </IconButton>
                  </Tooltip>
                </HStack>
              </HStack>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}

function AddItemPopover({
  catalog,
  onAdd
}: {
  catalog: AdminItemCatalogEntry[]
  onAdd: (entry: AdminItemCatalogEntry) => void
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? catalog.filter((entry) =>
          `${entry.name} ${entry.id} ${entry.category}`.toLowerCase().includes(needle))
      : catalog;
    return base.slice(0, 80);
  }, [catalog, query]);

  return (
    <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Button size="sm" colorScheme="green" isDisabled={catalog.length === 0}>
          + Add item
        </Button>
      </PopoverTrigger>
      <PopoverContent w="340px">
        <PopoverArrow />
        <PopoverHeader fontWeight="700" border="none" pb={1}>Add an item</PopoverHeader>
        <PopoverBody>
          <InputGroup size="sm" mb={2}>
            <InputLeftElement pointerEvents="none">🔍</InputLeftElement>
            <Input
              autoFocus
              placeholder="Search items..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
          <Stack spacing={1} maxH="260px" overflowY="auto">
            {filtered.length === 0 ? (
              <Text fontSize="sm" color="#68776b" py={2} textAlign="center">No matching items.</Text>
            ) : (
              filtered.map((entry) => (
                <HStack
                  key={entry.id}
                  spacing={2}
                  p={2}
                  borderRadius="10px"
                  cursor="pointer"
                  _hover={{ bg: '#f2f7f0' }}
                  onClick={() => onAdd(entry)}
                >
                  <ItemIcon src={entry.iconSrc} category={entry.category} size="30px" alt={entry.name} />
                  <Stack spacing={1} flex="1" minW={0}>
                    <Text fontSize="sm" fontWeight="600" noOfLines={1}>{entry.name}</Text>
                    <Badge colorScheme={CATEGORY_META[entry.category].color} fontSize="0.58rem" alignSelf="flex-start">
                      {CATEGORY_META[entry.category].label}
                    </Badge>
                  </Stack>
                </HStack>
              ))
            )}
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
