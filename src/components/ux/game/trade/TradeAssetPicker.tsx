/**
 * The "add to your offer" side of the trade window: a searchable bag with
 * category filters, a party/storage Venomon browser, and the money input.
 *
 * Everything here only *proposes* — each control emits an intent and the panel
 * re-renders from the next authoritative `trade:state`. Quantities shown next
 * to each stack are the player's own bag totals (already server-owned state);
 * whether a stack is actually tradeable is decided by the server, which
 * rejects the add with a specific error if it is not.
 */

import {
  Badge,
  Box,
  Button,
  HStack,
  Image,
  Input,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import {
  readStoredDesignerSectionPayload
} from '../../../designer/designerCache';
import { resolveServerAssetUrl } from '../../../tilemap/serverAssets';
import { useAuth, type InventoryItem, type PokemonSummary } from '../../../../context/authContext';
import { useT } from '../../../../i18n';
import { getPokemonDisplayName } from '../pokemonName';
import type { TradeOffer } from './tradeTypes';

type CategoryKey = InventoryItem['category'] | 'all';

/** Species id -> icon path, from the cached designer catalog (same as PcBox). */
function readPokemonIconIndex() {
  const index = new Map<string, string>();
  readStoredDesignerSectionPayload('pokemons').state.items.forEach((item) => {
    const profile = (item as { pokemonProfile?: { iconImageSrc?: string } }).pokemonProfile;
    if (item.id && profile?.iconImageSrc) {
      index.set(item.id, profile.iconImageSrc);
    }
  });
  return index;
}

function VenomonCard({
  pokemon,
  iconIndex,
  offered,
  disabled,
  onToggle
}: {
  pokemon: PokemonSummary;
  iconIndex: Map<string, string>;
  offered: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const iconSrc = resolveServerAssetUrl(
    iconIndex.get(pokemon.sourcePokemonId ?? '') ?? iconIndex.get(pokemon.id) ?? ''
  );

  return (
    <Button
      onClick={onToggle}
      isDisabled={disabled}
      variant="outline"
      height="auto"
      justifyContent="flex-start"
      p={2}
      borderColor={offered ? 'green.400' : 'whiteAlpha.300'}
      bg={offered ? 'rgba(20, 83, 45, 0.35)' : undefined}
      _hover={{ borderColor: 'teal.300', bg: 'whiteAlpha.100' }}
      width="100%"
    >
      <HStack spacing={2} width="100%" align="center">
        <Box boxSize="32px" flexShrink={0} display="flex" alignItems="center" justifyContent="center">
          {iconSrc ? (
            <Image
              src={iconSrc}
              alt=""
              boxSize="32px"
              objectFit="contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <Text fontFamily="mono" fontSize="xs" aria-hidden="true">
              {(pokemon.nickname || pokemon.name).slice(0, 2).toUpperCase()}
            </Text>
          )}
        </Box>
        <Box flex={1} minW={0} textAlign="left">
          <Text fontWeight="700" fontSize="sm" noOfLines={1}>
            {getPokemonDisplayName(pokemon)}
          </Text>
          <HStack spacing={1}>
            <Badge fontSize="0.6em">
              {t('trade.level')} {pokemon.level}
            </Badge>
            {pokemon.isEgg ? (
              <Badge fontSize="0.6em" colorScheme="pink">
                🥚
              </Badge>
            ) : null}
            {pokemon.heldItemName ? (
              <Badge fontSize="0.6em" colorScheme="yellow">
                🎒
              </Badge>
            ) : null}
          </HStack>
        </Box>
        <Text fontSize="lg" aria-hidden="true">
          {offered ? '✔' : '+'}
        </Text>
      </HStack>
    </Button>
  );
}

export default function TradeAssetPicker({
  offer,
  editable,
  onAddItem,
  onRemoveItem,
  onAddVenomon,
  onRemoveVenomon,
  onSetCurrency
}: {
  offer: TradeOffer;
  editable: boolean;
  onAddItem: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onAddVenomon: (venomonId: string) => void;
  onRemoveVenomon: (venomonId: string) => void;
  onSetCurrency: (amount: number) => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [quantity, setQuantity] = useState('1');
  const [moneyInput, setMoneyInput] = useState(String(offer.currency || ''));

  const iconIndex = useMemo(readPokemonIconIndex, []);
  const inventory = user?.inventory ?? [];
  const party = user?.pokemonParty ?? [];
  const storage = user?.pokemonStorage ?? [];

  const offeredItemIds = useMemo(
    () => new Set(offer.items.map((item) => item.itemDefinitionId)),
    [offer.items]
  );
  const offeredVenomonIds = useMemo(
    () => new Set(offer.venomons.map((venomon) => venomon.venomonInstanceId)),
    [offer.venomons]
  );

  const categories: Array<{ key: CategoryKey; label: string }> = [
    { key: 'all', label: t('bag.all') },
    { key: 'usable', label: t('bag.usable') },
    { key: 'berries', label: t('bag.berries') },
    { key: 'moves', label: t('bag.moves') },
    { key: 'quest', label: t('bag.quest') }
  ];

  const visibleItems = inventory.filter((item) => {
    if (item.quantity <= 0) {
      return false;
    }
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    const needle = search.trim().toLowerCase();
    return needle.length === 0 || item.name.toLowerCase().includes(needle);
  });

  const parsedQuantity = Math.max(1, Math.min(999, Number.parseInt(quantity, 10) || 1));

  const commitMoney = () => {
    // Reject anything that is not a plain non-negative integer before it ever
    // reaches the wire; the server rejects it again regardless.
    const trimmed = moneyInput.trim();
    const amount = trimmed.length === 0 ? 0 : Number(trimmed);
    if (!Number.isInteger(amount) || amount < 0) {
      setMoneyInput(String(offer.currency));
      return;
    }
    onSetCurrency(amount);
  };

  return (
    <Tabs colorScheme="teal" variant="soft-rounded" size="sm" isLazy>
      <TabList flexWrap="wrap" gap={1}>
        <Tab>{t('trade.tabVenomons')}</Tab>
        <Tab>{t('trade.tabItems')}</Tab>
        <Tab>{t('trade.tabMoney')}</Tab>
      </TabList>
      <TabPanels>
        {/* ---- Venomons: party first, then every storage box ---- */}
        <TabPanel px={0} pt={2}>
          <VStack align="stretch" spacing={3} maxH="320px" overflowY="auto">
            <Box>
              <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase" mb={1}>
                {t('trade.party')}
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                {party.length === 0 ? (
                  <Text fontSize="sm" color="gray.500">
                    {t('trade.none')}
                  </Text>
                ) : (
                  party.map((pokemon) => (
                    <VenomonCard
                      key={pokemon.id}
                      pokemon={pokemon}
                      iconIndex={iconIndex}
                      offered={offeredVenomonIds.has(pokemon.id)}
                      disabled={!editable}
                      onToggle={() =>
                        offeredVenomonIds.has(pokemon.id)
                          ? onRemoveVenomon(pokemon.id)
                          : onAddVenomon(pokemon.id)
                      }
                    />
                  ))
                )}
              </SimpleGrid>
            </Box>

            {storage.map((box) =>
              box.pokemon.length === 0 ? null : (
                <Box key={box.id}>
                  <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase" mb={1}>
                    {box.name}
                  </Text>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                    {box.pokemon.map((pokemon) => (
                      <VenomonCard
                        key={pokemon.id}
                        pokemon={pokemon}
                        iconIndex={iconIndex}
                        offered={offeredVenomonIds.has(pokemon.id)}
                        disabled={!editable}
                        onToggle={() =>
                          offeredVenomonIds.has(pokemon.id)
                            ? onRemoveVenomon(pokemon.id)
                            : onAddVenomon(pokemon.id)
                        }
                      />
                    ))}
                  </SimpleGrid>
                </Box>
              )
            )}
          </VStack>
        </TabPanel>

        {/* ---- Items: search + category filter + quantity selector ---- */}
        <TabPanel px={0} pt={2}>
          <VStack align="stretch" spacing={2}>
            <Input
              size="sm"
              placeholder={t('trade.searchItems')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              bg="whiteAlpha.100"
              borderColor="whiteAlpha.300"
            />
            <HStack spacing={1} flexWrap="wrap">
              {categories.map((entry) => (
                <Button
                  key={entry.key}
                  size="xs"
                  variant={category === entry.key ? 'solid' : 'outline'}
                  colorScheme="teal"
                  onClick={() => setCategory(entry.key)}
                >
                  {entry.label}
                </Button>
              ))}
            </HStack>
            <HStack spacing={2}>
              <Text fontSize="sm" color="gray.300" whiteSpace="nowrap">
                {t('trade.quantity')}
              </Text>
              <Input
                size="sm"
                type="number"
                min={1}
                max={999}
                width="90px"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                bg="whiteAlpha.100"
                borderColor="whiteAlpha.300"
              />
            </HStack>

            <VStack align="stretch" spacing={1.5} maxH="260px" overflowY="auto">
              {visibleItems.length === 0 ? (
                <Text fontSize="sm" color="gray.500">
                  {t('trade.noItems')}
                </Text>
              ) : (
                visibleItems.map((item) => {
                  const offered = offeredItemIds.has(item.id);
                  return (
                    <HStack
                      key={item.id}
                      spacing={2}
                      bg={offered ? 'rgba(20, 83, 45, 0.3)' : 'whiteAlpha.100'}
                      borderRadius="6px"
                      px={2}
                      py={1.5}
                    >
                      <Box flex={1} minW={0}>
                        <Text fontWeight="700" fontSize="sm" noOfLines={1}>
                          {item.name}
                        </Text>
                        <HStack spacing={1}>
                          <Badge fontSize="0.6em" variant="outline">
                            {t(`bag.${item.category}`)}
                          </Badge>
                          <Text fontSize="xs" color="gray.400">
                            {t('trade.owned')}: {item.quantity}
                          </Text>
                        </HStack>
                      </Box>
                      <Button
                        size="xs"
                        colorScheme="teal"
                        isDisabled={!editable}
                        onClick={() => onAddItem(item.id, parsedQuantity)}
                      >
                        + {parsedQuantity}
                      </Button>
                      {offered ? (
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="ghost"
                          isDisabled={!editable}
                          aria-label={t('trade.remove')}
                          onClick={() => onRemoveItem(item.id)}
                        >
                          ✕
                        </Button>
                      ) : null}
                    </HStack>
                  );
                })
              )}
            </VStack>
          </VStack>
        </TabPanel>

        {/* ---- Money ---- */}
        <TabPanel px={0} pt={2}>
          <VStack align="stretch" spacing={2}>
            <Text fontSize="sm" color="gray.300">
              {t('trade.yourBalance')}: ${(user?.money ?? 0).toLocaleString()}
            </Text>
            <HStack>
              <Input
                size="sm"
                type="number"
                min={0}
                step={1}
                value={moneyInput}
                isDisabled={!editable}
                onChange={(event) => setMoneyInput(event.target.value)}
                bg="whiteAlpha.100"
                borderColor="whiteAlpha.300"
              />
              <Button size="sm" colorScheme="teal" isDisabled={!editable} onClick={commitMoney}>
                {t('trade.setMoney')}
              </Button>
            </HStack>
            <Text fontSize="xs" color="gray.400">
              {t('trade.moneyHint')}
            </Text>
          </VStack>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
