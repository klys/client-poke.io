/**
 * The anti-scam final confirmation screen.
 *
 * Rules this screen enforces visually (the server enforces them for real):
 *   - it shows the complete, server-issued snapshot, fully expanded — no
 *     collapsed sections, no scrolling-away of assets behind a summary;
 *   - both players confirm the *same* snapshot hash, which is displayed so
 *     the two screens can be compared out loud if anyone is suspicious;
 *   - the Confirm button is unavailable until the review countdown elapses;
 *   - offers are not editable here — the only way back is Unlock, which
 *     returns the trade to the open state and clears both confirmations.
 */

import { Badge, Box, Button, Divider, HStack, Image, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { resolveServerAssetUrl } from '../../../tilemap/serverAssets';
import { useT } from '../../../../i18n';
import type { TradeSideKey, TradeSnapshot, TradeWarning, TradeWarningCode } from './tradeTypes';

const WARNING_ICON: Record<TradeWarningCode, string> = {
  ONE_SIDED: '🎁',
  UNBALANCED: '⚖',
  RARE_ASSET: '💎',
  NICKNAMED_VENOMON: '🏷',
  EGG_INCLUDED: '🥚',
  HELD_ITEM_TRANSFERS: '🎒',
  NEW_ACCOUNT: '🆕',
  SIMILAR_ITEM_NAMES: '👁',
  LARGE_CURRENCY: '💰'
};

function SnapshotSide({
  snapshot,
  side,
  heading
}: {
  snapshot: TradeSnapshot;
  side: TradeSideKey;
  heading: string;
}) {
  const t = useT();
  const offer = snapshot.offers[side];
  const participant = snapshot.participants[side];
  const isEmpty = offer.items.length === 0 && offer.venomons.length === 0 && offer.currency === 0;

  return (
    <VStack
      align="stretch"
      spacing={2}
      flex={1}
      minW={0}
      bg="rgba(0,0,0,0.3)"
      border="1px solid"
      borderColor="whiteAlpha.300"
      borderRadius="8px"
      p={3}
    >
      <Box>
        <Text fontSize="xs" fontWeight="900" textTransform="uppercase" letterSpacing="0.05em">
          {heading}
        </Text>
        <Text fontSize="sm" color="gray.200">
          {participant.displayName}{' '}
          <Text as="span" color="gray.400">
            (@{participant.username})
          </Text>
        </Text>
      </Box>
      <Divider borderColor="whiteAlpha.300" />

      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.300">
          {t('trade.money')}
        </Text>
        <Text fontWeight="900" color={offer.currency > 0 ? 'yellow.200' : 'gray.500'}>
          ${offer.currency.toLocaleString()}
        </Text>
      </HStack>

      <Box>
        <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase">
          {t('trade.venomons')} ({offer.venomons.length})
        </Text>
        {offer.venomons.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            {t('trade.none')}
          </Text>
        ) : (
          <VStack align="stretch" spacing={1} mt={1}>
            {offer.venomons.map((venomon) => (
              <HStack key={venomon.venomonInstanceId} spacing={2} align="flex-start">
                {venomon.iconImageSrc ? (
                  <Image
                    src={resolveServerAssetUrl(venomon.iconImageSrc)}
                    alt=""
                    boxSize="28px"
                    objectFit="contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : null}
                <Box flex={1} minW={0}>
                  <HStack spacing={1.5} flexWrap="wrap">
                    <Text fontWeight="700" fontSize="sm">
                      {venomon.nickname || venomon.species}
                    </Text>
                    <Badge fontSize="0.62em" colorScheme="teal">
                      {t('trade.level')} {venomon.level}
                    </Badge>
                    {venomon.isEgg ? (
                      <Badge fontSize="0.62em" colorScheme="pink">
                        🥚 {t('trade.egg')}
                      </Badge>
                    ) : null}
                    {venomon.shiny ? (
                      <Badge fontSize="0.62em" colorScheme="yellow">
                        ✨ {t('trade.shiny')}
                      </Badge>
                    ) : null}
                    {venomon.form ? (
                      <Badge fontSize="0.62em" variant="outline">
                        {venomon.form}
                      </Badge>
                    ) : null}
                  </HStack>
                  {venomon.nicknameDiffersFromSpecies ? (
                    <Text fontSize="xs" color="orange.200" fontWeight="700">
                      ⚠ {t('trade.nicknameWarning', { species: venomon.species })}
                    </Text>
                  ) : null}
                  {venomon.heldItemName ? (
                    <Text fontSize="xs" color="yellow.200">
                      🎒 {t('trade.holdingItem', { item: venomon.heldItemName })}
                    </Text>
                  ) : null}
                  <Text fontSize="xs" color="gray.400" noOfLines={2}>
                    {venomon.moves.join(' · ')}
                  </Text>
                </Box>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>

      <Box>
        <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase">
          {t('trade.items')} ({offer.items.length})
        </Text>
        {offer.items.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            {t('trade.none')}
          </Text>
        ) : (
          <VStack align="stretch" spacing={1} mt={1}>
            {offer.items.map((item) => (
              <HStack key={item.itemDefinitionId} spacing={2}>
                {item.iconSrc ? (
                  <Image
                    src={resolveServerAssetUrl(item.iconSrc)}
                    alt=""
                    boxSize="22px"
                    objectFit="contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : null}
                <Text fontWeight="900" color="yellow.200" whiteSpace="nowrap">
                  ×{item.quantity}
                </Text>
                <Text fontSize="sm" flex={1} noOfLines={1}>
                  {item.name}
                </Text>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>

      {isEmpty ? (
        <Text fontSize="sm" color="orange.200" fontWeight="700">
          ⚠ {t('trade.offeringNothing')}
        </Text>
      ) : null}
    </VStack>
  );
}

export default function TradeConfirmPanel({
  snapshot,
  snapshotHash,
  mySide,
  myConfirmed,
  theirConfirmed,
  confirmAvailableAt,
  warnings,
  heldItemsTransferWithVenomon,
  disabled,
  onConfirm,
  onUnlock,
  onCancel
}: {
  snapshot: TradeSnapshot;
  /** The hash both players must confirm; shown so it can be compared aloud. */
  snapshotHash: string | null;
  mySide: TradeSideKey;
  myConfirmed: boolean;
  theirConfirmed: boolean;
  confirmAvailableAt: number | null;
  warnings: TradeWarning[];
  heldItemsTransferWithVenomon: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onUnlock: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const theirSide: TradeSideKey = mySide === 'A' ? 'B' : 'A';
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (confirmAvailableAt === null) {
      setSecondsLeft(0);
      return undefined;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((confirmAvailableAt - Date.now()) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [confirmAvailableAt]);

  const countdownActive = secondsLeft > 0;

  return (
    <VStack align="stretch" spacing={3}>
      <Box
        bg="rgba(127, 29, 29, 0.45)"
        border="2px solid"
        borderColor="red.400"
        borderRadius="8px"
        p={3}
      >
        <Text fontWeight="900" fontSize="sm">
          ⚠ {t('trade.finalWarningTitle')}
        </Text>
        <Text fontSize="sm" color="red.100" mt={1}>
          {t('trade.finalWarningBody')}
        </Text>
      </Box>

      <HStack align="stretch" spacing={3} flexDirection={{ base: 'column', md: 'row' }}>
        <SnapshotSide snapshot={snapshot} side={mySide} heading={t('trade.youGive')} />
        <SnapshotSide snapshot={snapshot} side={theirSide} heading={t('trade.youReceive')} />
      </HStack>

      {heldItemsTransferWithVenomon ? (
        <Text fontSize="xs" color="yellow.200">
          🎒 {t('trade.heldItemRule')}
        </Text>
      ) : null}

      {warnings.length > 0 ? (
        <Box bg="rgba(120, 53, 15, 0.4)" border="1px solid" borderColor="orange.400" borderRadius="8px" p={2}>
          <Text fontSize="xs" fontWeight="900" textTransform="uppercase" mb={1}>
            {t('trade.warningsTitle')}
          </Text>
          <VStack align="stretch" spacing={0.5}>
            {warnings.map((warning, index) => (
              <Text key={`${warning.code}-${index}`} fontSize="xs" color="orange.100">
                {WARNING_ICON[warning.code] ?? '⚠'} {warning.detail ?? t(`trade.warning.${warning.code}`)}
              </Text>
            ))}
          </VStack>
          <Text fontSize="xs" color="gray.300" mt={1} fontStyle="italic">
            {t('trade.warningsAdvisory')}
          </Text>
        </Box>
      ) : null}

      <HStack spacing={3} flexWrap="wrap">
        <Text fontSize="xs" color="gray.400" fontFamily="mono">
          {t('trade.snapshotId')}: {snapshot.tradeId.slice(0, 8)} · v{snapshot.version}
        </Text>
        <Text fontSize="xs" color="gray.400" fontFamily="mono">
          {t('trade.snapshotHash')}: {(snapshotHash ?? '').slice(0, 16)}
        </Text>
      </HStack>

      <HStack spacing={4} flexWrap="wrap">
        <HStack spacing={1}>
          <Text aria-hidden="true">{myConfirmed ? '✔' : '⏳'}</Text>
          <Text fontSize="sm" color={myConfirmed ? 'green.200' : 'gray.300'}>
            {myConfirmed ? t('trade.youConfirmed') : t('trade.youNotConfirmed')}
          </Text>
        </HStack>
        <HStack spacing={1}>
          <Text aria-hidden="true">{theirConfirmed ? '✔' : '⏳'}</Text>
          <Text fontSize="sm" color={theirConfirmed ? 'green.200' : 'gray.300'}>
            {theirConfirmed
              ? t('trade.theyConfirmed', { name: snapshot.participants[theirSide].displayName })
              : t('trade.theyNotConfirmed', { name: snapshot.participants[theirSide].displayName })}
          </Text>
        </HStack>
      </HStack>

      <HStack spacing={2} flexWrap="wrap">
        <Button
          colorScheme="green"
          isDisabled={disabled || myConfirmed || countdownActive}
          onClick={onConfirm}
        >
          {countdownActive
            ? t('trade.confirmIn', { seconds: String(secondsLeft) })
            : myConfirmed
              ? t('trade.confirmed')
              : t('trade.confirmFinal')}
        </Button>
        <Button variant="outline" borderColor="whiteAlpha.500" isDisabled={disabled} onClick={onUnlock}>
          {t('trade.backToEditing')}
        </Button>
        <Button variant="ghost" colorScheme="red" isDisabled={disabled} onClick={onCancel}>
          {t('trade.cancelTrade')}
        </Button>
      </HStack>
    </VStack>
  );
}
