/**
 * One side of the trade table: "Your Offer" or "Their Offer".
 *
 * The two panels are deliberately never symmetric on screen — the local
 * player's side is labelled, badged and the only one with remove controls, so
 * there is no way to confuse whose assets are whose.
 *
 * Status is never communicated by colour alone: every state carries an icon
 * and a text label (see `StatusPill`).
 */

import { Badge, Box, Button, HStack, Image, Text, Tooltip, VStack } from '@chakra-ui/react';
import { resolveServerAssetUrl } from '../../../tilemap/serverAssets';
import { useT } from '../../../../i18n';
import type { TradeOffer, TradeOfferItem, TradeOfferVenomon, TradeParticipant } from './tradeTypes';

const RARITY_LABEL: Record<TradeOfferItem['rarity'], string> = {
  common: 'trade.rarity.common',
  uncommon: 'trade.rarity.uncommon',
  rare: 'trade.rarity.rare',
  epic: 'trade.rarity.epic'
};

const RARITY_COLOR: Record<TradeOfferItem['rarity'], string> = {
  common: 'gray',
  uncommon: 'green',
  rare: 'blue',
  epic: 'purple'
};

/** Icon + text + colour. Never colour on its own — see the file header. */
export function StatusPill({
  icon,
  label,
  colorScheme
}: {
  icon: string;
  label: string;
  colorScheme: string;
}) {
  return (
    <Badge
      colorScheme={colorScheme}
      variant="solid"
      borderRadius="full"
      px={2}
      display="inline-flex"
      alignItems="center"
      gap={1}
      fontSize="0.7em"
    >
      <Text as="span" aria-hidden="true">
        {icon}
      </Text>
      <Text as="span">{label}</Text>
    </Badge>
  );
}

function ItemRow({
  item,
  editable,
  onRemove,
  onQuantityChange
}: {
  item: TradeOfferItem;
  editable: boolean;
  onRemove?: (itemId: string) => void;
  onQuantityChange?: (itemId: string, quantity: number) => void;
}) {
  const t = useT();
  const iconSrc = resolveServerAssetUrl(item.iconSrc ?? '');

  return (
    <HStack
      spacing={2}
      align="center"
      bg="whiteAlpha.100"
      borderRadius="6px"
      px={2}
      py={1.5}
      borderLeft="3px solid"
      borderLeftColor={`${RARITY_COLOR[item.rarity]}.400`}
    >
      <Box boxSize="28px" flexShrink={0} display="flex" alignItems="center" justifyContent="center">
        {iconSrc ? (
          <Image
            src={iconSrc}
            alt=""
            boxSize="28px"
            objectFit="contain"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <Text fontSize="xs" fontFamily="mono" aria-hidden="true">
            {item.name.slice(0, 2).toUpperCase()}
          </Text>
        )}
      </Box>
      <Box flex={1} minW={0}>
        <HStack spacing={2} align="baseline">
          {/* Quantity leads the row so it can never be visually buried. */}
          <Text fontWeight="900" fontSize="md" color="yellow.200" whiteSpace="nowrap">
            ×{item.quantity}
          </Text>
          <Text fontWeight="700" noOfLines={1} title={item.name}>
            {item.name}
          </Text>
        </HStack>
        <HStack spacing={1} mt={0.5}>
          <Badge fontSize="0.62em" colorScheme={RARITY_COLOR[item.rarity]}>
            {t(RARITY_LABEL[item.rarity])}
          </Badge>
          <Badge fontSize="0.62em" variant="outline">
            {t(`bag.${item.category}`)}
          </Badge>
          {item.restricted ? (
            <Badge fontSize="0.62em" colorScheme="orange">
              ⚠ {t('trade.restricted')}
            </Badge>
          ) : null}
        </HStack>
      </Box>
      {editable ? (
        <HStack spacing={1}>
          <Button
            size="xs"
            variant="ghost"
            aria-label={t('trade.decreaseQuantity')}
            onClick={() => onQuantityChange?.(item.itemDefinitionId, Math.max(0, item.quantity - 1))}
          >
            −
          </Button>
          <Button
            size="xs"
            variant="ghost"
            aria-label={t('trade.increaseQuantity')}
            onClick={() => onQuantityChange?.(item.itemDefinitionId, item.quantity + 1)}
          >
            +
          </Button>
          <Button
            size="xs"
            colorScheme="red"
            variant="ghost"
            aria-label={t('trade.remove')}
            onClick={() => onRemove?.(item.itemDefinitionId)}
          >
            ✕
          </Button>
        </HStack>
      ) : null}
    </HStack>
  );
}

function VenomonRow({
  venomon,
  editable,
  onRemove
}: {
  venomon: TradeOfferVenomon;
  editable: boolean;
  onRemove?: (venomonId: string) => void;
}) {
  const t = useT();
  const iconSrc = resolveServerAssetUrl(venomon.iconImageSrc ?? '');
  const displayName = venomon.nickname && venomon.nickname.length > 0 ? venomon.nickname : venomon.species;

  return (
    <HStack
      spacing={2}
      align="flex-start"
      bg="whiteAlpha.100"
      borderRadius="6px"
      px={2}
      py={1.5}
      borderLeft="3px solid"
      borderLeftColor={`${RARITY_COLOR[venomon.rarity]}.400`}
    >
      <Box boxSize="34px" flexShrink={0} display="flex" alignItems="center" justifyContent="center">
        {iconSrc ? (
          <Image
            src={iconSrc}
            alt=""
            boxSize="34px"
            objectFit="contain"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <Text fontSize="xs" fontFamily="mono" aria-hidden="true">
            {displayName.slice(0, 2).toUpperCase()}
          </Text>
        )}
      </Box>
      <Box flex={1} minW={0}>
        <HStack spacing={2} align="baseline" flexWrap="wrap">
          <Text fontWeight="700" noOfLines={1}>
            {displayName}
          </Text>
          <Badge colorScheme="teal" fontSize="0.68em">
            {t('trade.level')} {venomon.level}
          </Badge>
          {venomon.isEgg ? (
            <Badge colorScheme="pink" fontSize="0.68em">
              🥚 {t('trade.egg')}
            </Badge>
          ) : null}
          {venomon.shiny ? (
            <Badge colorScheme="yellow" fontSize="0.68em">
              ✨ {t('trade.shiny')}
            </Badge>
          ) : null}
          {venomon.form ? (
            <Badge variant="outline" fontSize="0.68em">
              {venomon.form}
            </Badge>
          ) : null}
          <Badge variant="outline" fontSize="0.68em">
            {venomon.source === 'party' ? t('trade.fromParty') : t('trade.fromStorage')}
          </Badge>
        </HStack>

        {/* An alias that hides the real species is the classic trade scam. */}
        {venomon.nicknameDiffersFromSpecies ? (
          <Text fontSize="xs" color="orange.200" fontWeight="700" mt={0.5}>
            ⚠ {t('trade.nicknameWarning', { species: venomon.species })}
          </Text>
        ) : null}

        <HStack spacing={2} mt={0.5} flexWrap="wrap">
          {venomon.types.map((type) => (
            <Badge key={type} fontSize="0.6em" variant="subtle">
              {type}
            </Badge>
          ))}
          {venomon.gender ? (
            <Badge fontSize="0.6em" variant="subtle">
              {venomon.gender}
            </Badge>
          ) : null}
          {venomon.nature ? (
            <Badge fontSize="0.6em" variant="subtle">
              {venomon.nature}
            </Badge>
          ) : null}
          {venomon.ability ? (
            <Badge fontSize="0.6em" variant="subtle">
              {venomon.ability}
            </Badge>
          ) : null}
        </HStack>

        <Text fontSize="xs" color="gray.300" mt={0.5}>
          {t('trade.hp')} {venomon.hp}/{venomon.maxHp}
        </Text>

        {venomon.moves.length > 0 ? (
          <Text fontSize="xs" color="gray.400" noOfLines={2}>
            {venomon.moves.join(' · ')}
          </Text>
        ) : null}

        {/* Held items travel with the Venomon — one rule, stated everywhere. */}
        {venomon.heldItemName ? (
          <Text fontSize="xs" color="yellow.200" fontWeight="700" mt={0.5}>
            🎒 {t('trade.holdingItem', { item: venomon.heldItemName })}
          </Text>
        ) : null}
      </Box>
      {editable ? (
        <Button
          size="xs"
          colorScheme="red"
          variant="ghost"
          aria-label={t('trade.remove')}
          onClick={() => onRemove?.(venomon.venomonInstanceId)}
        >
          ✕
        </Button>
      ) : null}
    </HStack>
  );
}

export default function TradeOfferPanel({
  title,
  participant,
  offer,
  isMine,
  editable,
  disconnected,
  changed,
  onRemoveItem,
  onQuantityChange,
  onRemoveVenomon
}: {
  title: string;
  participant: TradeParticipant;
  offer: TradeOffer;
  isMine: boolean;
  editable: boolean;
  disconnected: boolean;
  /** Highlights the panel when this side's offer just moved. */
  changed: boolean;
  onRemoveItem?: (itemId: string) => void;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onRemoveVenomon?: (venomonId: string) => void;
}) {
  const t = useT();
  const isEmpty = offer.items.length === 0 && offer.venomons.length === 0 && offer.currency === 0;

  return (
    <VStack
      align="stretch"
      spacing={2}
      flex={1}
      minW={0}
      bg={isMine ? 'rgba(20, 83, 45, 0.28)' : 'rgba(30, 41, 59, 0.5)'}
      border="2px solid"
      borderColor={changed ? 'orange.300' : isMine ? 'green.500' : 'whiteAlpha.300'}
      borderRadius="8px"
      p={3}
    >
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={1}>
        <Box minW={0}>
          <Text fontWeight="900" fontSize="sm" letterSpacing="0.04em" textTransform="uppercase">
            {isMine ? '▸ ' : ''}
            {title}
          </Text>
          <Tooltip label={`@${participant.username}`}>
            <Text fontSize="sm" color="gray.200" noOfLines={1}>
              {participant.displayName}{' '}
              <Text as="span" color="gray.400">
                (@{participant.username})
              </Text>
            </Text>
          </Tooltip>
        </Box>
        <VStack align="flex-end" spacing={1}>
          {offer.confirmed ? (
            <StatusPill icon="✔" label={t('trade.statusConfirmed')} colorScheme="green" />
          ) : offer.locked ? (
            <StatusPill icon="🔒" label={t('trade.statusLocked')} colorScheme="blue" />
          ) : (
            <StatusPill icon="✎" label={t('trade.statusEditing')} colorScheme="gray" />
          )}
          {disconnected ? (
            <StatusPill icon="⚡" label={t('trade.statusDisconnected')} colorScheme="red" />
          ) : null}
          {participant.newAccount ? (
            <StatusPill icon="🆕" label={t('trade.newAccount')} colorScheme="orange" />
          ) : null}
        </VStack>
      </HStack>

      <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={2}>
        <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase" mb={1}>
          {t('trade.money')}
        </Text>
        <Text fontWeight="900" fontSize="lg" color={offer.currency > 0 ? 'yellow.200' : 'gray.500'}>
          ${offer.currency.toLocaleString()}
        </Text>
      </Box>

      <Box>
        <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase" mb={1}>
          {t('trade.venomons')} ({offer.venomons.length})
        </Text>
        <VStack align="stretch" spacing={1.5}>
          {offer.venomons.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              {t('trade.none')}
            </Text>
          ) : (
            offer.venomons.map((venomon) => (
              <VenomonRow
                key={venomon.venomonInstanceId}
                venomon={venomon}
                editable={editable}
                onRemove={onRemoveVenomon}
              />
            ))
          )}
        </VStack>
      </Box>

      <Box>
        <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase" mb={1}>
          {t('trade.items')} ({offer.items.length})
        </Text>
        <VStack align="stretch" spacing={1.5}>
          {offer.items.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              {t('trade.none')}
            </Text>
          ) : (
            offer.items.map((item) => (
              <ItemRow
                key={item.itemDefinitionId}
                item={item}
                editable={editable}
                onRemove={onRemoveItem}
                onQuantityChange={onQuantityChange}
              />
            ))
          )}
        </VStack>
      </Box>

      {isEmpty ? (
        <Text fontSize="sm" color="orange.200" fontWeight="700">
          ⚠ {t('trade.offeringNothing')}
        </Text>
      ) : null}
    </VStack>
  );
}
