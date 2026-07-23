import {
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
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
  Wrap,
  WrapItem,
  useDisclosure
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import type { AdminPokemonCatalogEntry, AdminPokemonSummary } from '../types';
import { HpBar, PokemonAvatar, TypeBadge } from './shared';

type PokemonEditorProps = {
  party: AdminPokemonSummary[]
  catalog: AdminPokemonCatalogEntry[]
  onChange: (party: AdminPokemonSummary[]) => void
}

const MAX_PARTY = 6;

function makeId() {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `mon-${globalCrypto.randomUUID()}`;
  }
  return `mon-${Math.abs(Math.floor(performance.now() * 1000)).toString(36)}-${party_counter()}`;
}

let counter = 0;
function party_counter() {
  counter += 1;
  return counter.toString(36);
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

export default function PokemonEditor({ party, catalog, onChange }: PokemonEditorProps) {
  const update = (id: string, patch: Partial<AdminPokemonSummary>) => {
    onChange(party.map((pokemon) => (pokemon.id === id ? { ...pokemon, ...patch } : pokemon)));
  };

  const remove = (id: string) => {
    onChange(party.filter((pokemon) => pokemon.id !== id));
  };

  const addFromCatalog = (entry: AdminPokemonCatalogEntry) => {
    if (party.length >= MAX_PARTY) {
      return;
    }
    const baseHp = entry.hp > 0 ? entry.hp : 20;
    onChange([
      ...party,
      {
        id: makeId(),
        sourcePokemonId: entry.id,
        name: entry.name,
        level: 5,
        types: Array.isArray(entry.types) ? entry.types : [],
        hp: baseHp,
        maxHp: baseHp,
        moves: [],
        movePp: {},
        status: null,
        experience: 0,
        experienceCurve: 'medium',
        nextLevelExperience: 100,
        statBonuses: {
          hp: 0,
          attack: 0,
          defense: 0,
          specialAttack: 0,
          specialDefense: 0,
          speed: 0
        },
        iconImageSrc: entry.iconImageSrc
      }
    ]);
  };

  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
        <HStack spacing={2}>
          <Text fontWeight="800" color="#1f2d22" fontSize="lg">Pokémon Party</Text>
          <Badge colorScheme="green" borderRadius="full">{party.length}/{MAX_PARTY}</Badge>
        </HStack>
        <AddPokemonPopover catalog={catalog} onAdd={addFromCatalog} disabled={party.length >= MAX_PARTY} />
      </HStack>

      {party.length === 0 ? (
        <Box borderRadius="16px" bg="#f6f8f3" p={6} textAlign="center" color="#68776b" border="1px dashed rgba(56,78,58,0.2)">
          No Pokémon in the party. Use “Add Pokémon” to grant one.
        </Box>
      ) : (
        <Stack spacing={3}>
          {party.map((pokemon) => (
            <PokemonCard
              key={pokemon.id}
              pokemon={pokemon}
              onUpdate={(patch) => update(pokemon.id, patch)}
              onRemove={() => remove(pokemon.id)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function PokemonCard({
  pokemon,
  onUpdate,
  onRemove
}: {
  pokemon: AdminPokemonSummary
  onUpdate: (patch: Partial<AdminPokemonSummary>) => void
  onRemove: () => void
}) {
  const { isOpen, onToggle } = useDisclosure();

  return (
    <Box borderRadius="18px" bg="white" border="1px solid rgba(56,78,58,0.10)" p={4}>
      <HStack align="flex-start" spacing={3}>
        <PokemonAvatar
          iconImageSrc={pokemon.iconImageSrc}
          frontImageSrc={pokemon.frontImageSrc}
          name={pokemon.name}
        />

        <Stack spacing={2} flex="1" minW={0}>
          <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={2}>
            <Stack spacing={0} minW={0}>
              <Input
                size="sm"
                variant="flushed"
                fontWeight="700"
                value={pokemon.nickname ?? ''}
                placeholder={pokemon.name}
                onChange={(event) => onUpdate({ nickname: event.target.value })}
                maxW="200px"
              />
              <Text fontSize="xs" color="#68776b">{pokemon.name}</Text>
            </Stack>
            <HStack spacing={2}>
              <HStack spacing={1}>
                <Text fontSize="xs" color="#68776b">Lv</Text>
                <Input
                  size="xs"
                  w="56px"
                  textAlign="center"
                  value={pokemon.level}
                  onChange={(event) => onUpdate({ level: clampInt(Number(event.target.value), 1, 100) })}
                />
              </HStack>
              <Tooltip label="Remove from party" openDelay={400}>
                <IconButton aria-label="Remove" size="xs" colorScheme="red" variant="ghost" onClick={onRemove}>
                  ✕
                </IconButton>
              </Tooltip>
            </HStack>
          </HStack>

          <Wrap spacing={1}>
            {pokemon.types.map((type) => (
              <WrapItem key={type}>
                <TypeBadge type={type} />
              </WrapItem>
            ))}
          </Wrap>

          <Box>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="xs" color="#68776b">HP</Text>
              <HStack spacing={1}>
                <Input
                  size="xs"
                  w="56px"
                  textAlign="center"
                  value={pokemon.hp}
                  onChange={(event) => onUpdate({ hp: clampInt(Number(event.target.value), 0, pokemon.maxHp) })}
                />
                <Text fontSize="xs" color="#8a9782">/ {pokemon.maxHp}</Text>
                <Button size="xs" variant="outline" colorScheme="green" onClick={() => onUpdate({ hp: pokemon.maxHp })}>
                  Heal
                </Button>
              </HStack>
            </HStack>
            <HpBar hp={pokemon.hp} maxHp={pokemon.maxHp} />
          </Box>

          <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={onToggle}>
            {isOpen ? '▲ Hide details' : '▼ Moves & stats'}
          </Button>

          <Collapse in={isOpen} animateOpacity>
            <Stack spacing={3} pt={1}>
              <Box>
                <Text fontSize="xs" fontWeight="700" color="#4a5a45" mb={1}>Moves</Text>
                {pokemon.moves.length === 0 ? (
                  <Text fontSize="xs" color="#8a9782">No moves.</Text>
                ) : (
                  <Wrap spacing={1}>
                    {pokemon.moves.map((move) => (
                      <WrapItem key={move}>
                        <Badge colorScheme="blue" borderRadius="full" fontSize="0.62rem">{move}</Badge>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
              </Box>

              <Divider />

              <Box>
                <Text fontSize="xs" fontWeight="700" color="#4a5a45" mb={2}>Stat bonuses</Text>
                <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2}>
                  {([
                    ['hp', 'HP'],
                    ['attack', 'Atk'],
                    ['defense', 'Def'],
                    ['specialAttack', 'Sp.Atk'],
                    ['specialDefense', 'Sp.Def'],
                    ['speed', 'Speed']
                  ] as Array<[keyof AdminPokemonSummary['statBonuses'], string]>).map(([key, label]) => (
                    <HStack key={key} spacing={1}>
                      <Text fontSize="xs" color="#68776b" flex="1">{label}</Text>
                      <Input
                        size="xs"
                        w="60px"
                        textAlign="center"
                        value={pokemon.statBonuses[key]}
                        onChange={(event) =>
                          onUpdate({
                            statBonuses: {
                              ...pokemon.statBonuses,
                              [key]: clampInt(Number(event.target.value), -999, 999)
                            }
                          })}
                      />
                    </HStack>
                  ))}
                </SimpleGrid>
              </Box>

              <Text fontSize="0.68rem" color="#9aa694">
                Experience {pokemon.experience} · {pokemon.experienceCurve} curve · next at {pokemon.nextLevelExperience}
              </Text>
            </Stack>
          </Collapse>
        </Stack>
      </HStack>
    </Box>
  );
}

function AddPokemonPopover({
  catalog,
  onAdd,
  disabled
}: {
  catalog: AdminPokemonCatalogEntry[]
  onAdd: (entry: AdminPokemonCatalogEntry) => void
  disabled: boolean
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? catalog.filter((entry) => `${entry.name} ${entry.id}`.toLowerCase().includes(needle))
      : catalog;
    return base.slice(0, 80);
  }, [catalog, query]);

  return (
    <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Button size="sm" colorScheme="green" isDisabled={disabled || catalog.length === 0}>
          + Add Pokémon
        </Button>
      </PopoverTrigger>
      <PopoverContent w="340px">
        <PopoverArrow />
        <PopoverHeader fontWeight="700" border="none" pb={1}>Add a Pokémon</PopoverHeader>
        <PopoverBody>
          <InputGroup size="sm" mb={2}>
            <InputLeftElement pointerEvents="none">🔍</InputLeftElement>
            <Input
              autoFocus
              placeholder="Search species..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
          <Stack spacing={1} maxH="260px" overflowY="auto">
            {filtered.length === 0 ? (
              <Text fontSize="sm" color="#68776b" py={2} textAlign="center">No matching species.</Text>
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
                  <PokemonAvatar iconImageSrc={entry.iconImageSrc} name={entry.name} size="34px" />
                  <Stack spacing={1} flex="1" minW={0}>
                    <Text fontSize="sm" fontWeight="600" noOfLines={1}>{entry.name}</Text>
                    <Wrap spacing={1}>
                      {entry.types.map((type) => (
                        <WrapItem key={type}>
                          <TypeBadge type={type} />
                        </WrapItem>
                      ))}
                    </Wrap>
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
