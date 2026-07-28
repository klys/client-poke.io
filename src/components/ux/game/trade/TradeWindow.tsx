/**
 * The trade window: request prompts, the two-sided trade table, the final
 * confirmation screen, the private chat and the outcome banner.
 *
 * The window is a fixed overlay that owns the screen while a trade is live —
 * nothing else can be drawn over it, and it never renders untrusted content
 * (all strings arrive sanitized from the server and are rendered as text).
 *
 * The component holds no authoritative state of its own: it renders
 * `useTrade().trade` and disables controls while a request is in flight.
 */

import { Box, Button, Divider, HStack, Text, VStack } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { useAuth } from '../../../../context/authContext';
import { useT } from '../../../../i18n';
import { useGameSettings } from '../../../../settings/gameSettings';
import TradeAssetPicker from './TradeAssetPicker';
import TradeChatPanel from './TradeChatPanel';
import TradeConfirmPanel from './TradeConfirmPanel';
import TradeOfferPanel, { StatusPill } from './TradeOfferPanel';
import { useTrade } from './TradeContext';
import { EDITABLE_TRADE_STATES, otherTradeSide } from './tradeTypes';

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

/** Incoming trade requests, stacked above everything else. */
export function TradeRequestPrompts() {
  const t = useT();
  const trade = useTrade();
  const [gameSettings] = useGameSettings();

  if (trade.requests.length === 0) {
    return null;
  }

  const request = trade.requests[0];

  return (
    <Box
      style={{ zoom: gameSettings.uiScale.dialogs } as CSSProperties}
      position="fixed"
      left="50%"
      top="18px"
      transform="translateX(-50%)"
      width={{ base: 'calc(100vw - 24px)', sm: '430px' }}
      maxW="calc(100vw - 24px)"
      bg="rgba(17, 24, 39, 0.98)"
      border="1px solid rgba(255,255,255,0.18)"
      borderRadius="8px"
      boxShadow="0 18px 44px rgba(0,0,0,0.38)"
      color="white"
      p={4}
      zIndex={4400}
      data-game-ux="true"
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
    >
      <Text fontWeight="800">
        {t('trade.requestFrom', { name: request.from.displayName })}
      </Text>
      <HStack mt={1} spacing={2}>
        <Text fontSize="sm" color="gray.300">
          @{request.from.username}
        </Text>
        {request.from.newAccount ? (
          <StatusPill icon="🆕" label={t('trade.newAccount')} colorScheme="orange" />
        ) : null}
      </HStack>
      <HStack mt={4} justify="flex-end">
        <Button variant="ghost" color="gray.200" onClick={() => trade.declineRequest(request.tradeId)}>
          {t('trade.decline')}
        </Button>
        <Button colorScheme="teal" onClick={() => trade.acceptRequest(request.tradeId)}>
          {t('trade.accept')}
        </Button>
      </HStack>
    </Box>
  );
}

export default function TradeWindow() {
  const t = useT();
  const trade = useTrade();
  const { user } = useAuth();
  const [gameSettings] = useGameSettings();
  const myUserId = typeof user?.id === 'number' ? user.id : null;

  // "What changed" highlight: remember the version we last showed so a bump
  // can flash the panels the change belongs to.
  const [highlightedVersion, setHighlightedVersion] = useState<number | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const version = trade.trade?.version ?? null;
  useEffect(() => {
    if (version === null) {
      return undefined;
    }
    setHighlightedVersion(version);
    if (highlightTimer.current !== null) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => setHighlightedVersion(null), 2600);
    return () => {
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, [version]);

  const session = trade.trade;
  const outcome = trade.outcome;

  if (!trade.windowOpen || (!session && !outcome)) {
    return null;
  }

  const mySide = session?.youAre ?? 'A';
  const theirSide = otherTradeSide(mySide);
  const myOffer = session?.offers[mySide];
  const theirOffer = session?.offers[theirSide];
  const editable = Boolean(
    session && EDITABLE_TRADE_STATES.includes(session.state) && myOffer && !myOffer.locked
  );
  const inFinalConfirmation = session?.state === 'FINAL_CONFIRMATION';
  const processing = session?.state === 'PROCESSING';
  const busy = trade.pending || processing;
  const changeHighlight =
    session?.lastChange && highlightedVersion === session.version ? session.lastChange : null;

  return (
    <Box
      style={{ zoom: gameSettings.uiScale.dialogs } as CSSProperties}
      position="fixed"
      inset={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(0,0,0,0.6)"
      zIndex={4200}
      data-game-ux="true"
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
    >
      <Box
        width={{ base: 'calc(100vw - 16px)', lg: '1100px' }}
        maxW="calc(100vw - 16px)"
        maxH="calc(100dvh - 32px)"
        overflowY="auto"
        bg="rgba(17, 24, 39, 0.99)"
        border="1px solid rgba(255,255,255,0.2)"
        borderRadius="10px"
        boxShadow="0 30px 70px rgba(0,0,0,0.55)"
        color="white"
        p={4}
      >
        {/* ---- header ---- */}
        <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={2}>
          <Box>
            <Text fontWeight="900" fontSize="lg">
              {t('trade.title')}
            </Text>
            {session ? (
              <HStack spacing={2} mt={1} flexWrap="wrap">
                <StatusPill
                  icon={
                    processing
                      ? '⏱'
                      : inFinalConfirmation
                        ? '🛡'
                        : session.state === 'BOTH_LOCKED'
                          ? '🔒'
                          : '✎'
                  }
                  label={t(`trade.state.${session.state}`)}
                  colorScheme={inFinalConfirmation ? 'purple' : processing ? 'orange' : 'teal'}
                />
                <Text fontSize="xs" color="gray.400" fontFamily="mono">
                  v{session.version}
                </Text>
              </HStack>
            ) : null}
          </Box>
          {!session && outcome ? (
            <Button size="sm" variant="outline" borderColor="whiteAlpha.400" onClick={trade.closeWindow}>
              {t('trade.close')}
            </Button>
          ) : null}
        </HStack>

        {/* ---- outcome banner ---- */}
        {outcome ? (
          <Box
            mt={3}
            p={3}
            borderRadius="8px"
            border="2px solid"
            borderColor={
              outcome.kind === 'completed' ? 'green.400' : outcome.kind === 'failed' ? 'red.400' : 'gray.400'
            }
            bg={
              outcome.kind === 'completed'
                ? 'rgba(20, 83, 45, 0.4)'
                : outcome.kind === 'failed'
                  ? 'rgba(127, 29, 29, 0.4)'
                  : 'rgba(55, 65, 81, 0.5)'
            }
          >
            <Text fontWeight="900">
              {outcome.kind === 'completed' ? '✔ ' : outcome.kind === 'failed' ? '✖ ' : '• '}
              {outcome.message}
            </Text>
            {outcome.kind === 'completed' && outcome.received ? (
              <VStack align="stretch" spacing={0.5} mt={2}>
                <Text fontSize="sm" color="gray.200">
                  {t('trade.youReceived')}:{' '}
                  {[
                    ...outcome.received.venomons.map(
                      (venomon) => `${venomon.nickname || venomon.species} (Lv ${venomon.level})`
                    ),
                    ...outcome.received.items.map((item) => `${item.quantity}× ${item.name}`),
                    ...(outcome.received.currency > 0 ? [`$${outcome.received.currency}`] : [])
                  ].join(', ') || t('trade.none')}
                </Text>
                <Text fontSize="sm" color="gray.400">
                  {t('trade.youGave')}:{' '}
                  {[
                    ...(outcome.given?.venomons ?? []).map(
                      (venomon) => `${venomon.nickname || venomon.species} (Lv ${venomon.level})`
                    ),
                    ...(outcome.given?.items ?? []).map((item) => `${item.quantity}× ${item.name}`),
                    ...((outcome.given?.currency ?? 0) > 0 ? [`$${outcome.given?.currency}`] : [])
                  ].join(', ') || t('trade.none')}
                </Text>
              </VStack>
            ) : null}
            {outcome.tradeId ? (
              <Button
                mt={2}
                size="xs"
                variant="outline"
                borderColor="whiteAlpha.400"
                onClick={() => trade.reportTrade(outcome.tradeId, 'player-report')}
              >
                {t('trade.report')}
              </Button>
            ) : null}
          </Box>
        ) : null}

        {session ? (
          <>
            {/* ---- change / disconnect notices ---- */}
            {changeHighlight ? (
              <Box
                mt={3}
                p={2}
                borderRadius="6px"
                bg="rgba(120, 53, 15, 0.45)"
                border="1px solid"
                borderColor="orange.400"
              >
                <Text fontSize="sm" fontWeight="700">
                  ⚠ {changeHighlight.label}
                </Text>
                <Text fontSize="xs" color="orange.100">
                  {t('trade.reviewAgain')}
                </Text>
              </Box>
            ) : null}

            {session.disconnected[theirSide] ? (
              <Box mt={3} p={2} borderRadius="6px" bg="rgba(127, 29, 29, 0.45)" border="1px solid" borderColor="red.400">
                <Text fontSize="sm" fontWeight="700">
                  ⚡ {t('trade.partnerDisconnected')}
                </Text>
              </Box>
            ) : null}

            {trade.lastError ? (
              <Box mt={3} p={2} borderRadius="6px" bg="rgba(127, 29, 29, 0.4)" border="1px solid" borderColor="red.400">
                <HStack justify="space-between">
                  <Text fontSize="sm">✖ {trade.lastError}</Text>
                  <Button size="xs" variant="ghost" onClick={trade.clearError}>
                    ✕
                  </Button>
                </HStack>
              </Box>
            ) : null}

            <Divider my={3} borderColor="whiteAlpha.300" />

            {inFinalConfirmation && session.snapshot ? (
              <TradeConfirmPanel
                snapshot={session.snapshot}
                snapshotHash={session.snapshotHash}
                mySide={mySide}
                myConfirmed={Boolean(myOffer?.confirmed)}
                theirConfirmed={Boolean(theirOffer?.confirmed)}
                confirmAvailableAt={session.confirmAvailableAt}
                warnings={session.warnings}
                heldItemsTransferWithVenomon={session.heldItemsTransferWithVenomon}
                disabled={busy}
                onConfirm={trade.confirmTrade}
                onUnlock={trade.unlockOffer}
                onCancel={trade.cancelTrade}
              />
            ) : (
              <>
                <HStack align="stretch" spacing={3} flexDirection={{ base: 'column', md: 'row' }}>
                  {myOffer ? (
                    <TradeOfferPanel
                      title={t('trade.yourOffer')}
                      participant={session.participants[mySide]}
                      offer={myOffer}
                      isMine
                      editable={editable}
                      disconnected={session.disconnected[mySide]}
                      changed={changeHighlight?.side === mySide}
                      onRemoveItem={trade.removeItem}
                      onQuantityChange={trade.updateItem}
                      onRemoveVenomon={trade.removeVenomon}
                    />
                  ) : null}
                  {theirOffer ? (
                    <TradeOfferPanel
                      title={t('trade.theirOffer')}
                      participant={session.participants[theirSide]}
                      offer={theirOffer}
                      isMine={false}
                      editable={false}
                      disconnected={session.disconnected[theirSide]}
                      changed={changeHighlight?.side === theirSide}
                    />
                  ) : null}
                </HStack>

                <Divider my={3} borderColor="whiteAlpha.300" />

                <HStack align="stretch" spacing={4} flexDirection={{ base: 'column', lg: 'row' }}>
                  <Box flex={1.4} minW={0}>
                    <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase" mb={1}>
                      {t('trade.addToOffer')}
                    </Text>
                    {myOffer ? (
                      <TradeAssetPicker
                        offer={myOffer}
                        editable={editable}
                        onAddItem={trade.addItem}
                        onRemoveItem={trade.removeItem}
                        onAddVenomon={trade.addVenomon}
                        onRemoveVenomon={trade.removeVenomon}
                        onSetCurrency={trade.setCurrency}
                      />
                    ) : null}
                  </Box>
                  <Box flex={1} minW={0}>
                    <TradeChatPanel
                      messages={trade.messages}
                      myUserId={myUserId}
                      disabled={busy}
                      onSend={trade.sendChat}
                    />
                  </Box>
                </HStack>

                <Divider my={3} borderColor="whiteAlpha.300" />

                <HStack spacing={2} flexWrap="wrap">
                  {myOffer?.locked ? (
                    <Button colorScheme="yellow" isDisabled={busy} onClick={trade.unlockOffer}>
                      🔓 {t('trade.unlockOffer')}
                    </Button>
                  ) : (
                    <Button colorScheme="blue" isDisabled={busy} onClick={trade.lockOffer}>
                      🔒 {t('trade.lockOffer')}
                    </Button>
                  )}
                  <Button variant="ghost" colorScheme="red" isDisabled={busy} onClick={trade.cancelTrade}>
                    {t('trade.cancelTrade')}
                  </Button>
                  <Text fontSize="xs" color="gray.400">
                    {t('trade.lockHint')}
                  </Text>
                </HStack>
              </>
            )}
          </>
        ) : null}
      </Box>
    </Box>
  );
}
