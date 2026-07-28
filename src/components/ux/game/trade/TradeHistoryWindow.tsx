/**
 * The player-facing trade history (Menu -> Trade History).
 *
 * Shows date, the other player's display name, what was given and received,
 * and the completion status. It deliberately shows nothing else: the audit
 * record's security metadata (IP prefixes, platforms, session references) is
 * moderator-only and never reaches this view.
 */

import { Badge, Box, Button, Divider, HStack, Image, Text, VStack } from '@chakra-ui/react';
import { useEffect } from 'react';
import { resolveServerAssetUrl } from '../../../tilemap/serverAssets';
import { useT } from '../../../../i18n';
import { useTrade } from './TradeContext';
import type { TradeExchangeSummary } from './tradeTypes';

function ExchangeColumn({ label, summary }: { label: string; summary: TradeExchangeSummary }) {
  const t = useT();
  const isEmpty =
    summary.items.length === 0 && summary.venomons.length === 0 && summary.currency === 0;

  return (
    <Box flex={1} minW={0}>
      <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase">
        {label}
      </Text>
      {isEmpty ? (
        <Text fontSize="sm" color="gray.500">
          {t('trade.none')}
        </Text>
      ) : (
        <VStack align="stretch" spacing={0.5} mt={1}>
          {summary.currency > 0 ? (
            <Text fontSize="sm" color="yellow.200" fontWeight="700">
              ${summary.currency.toLocaleString()}
            </Text>
          ) : null}
          {summary.venomons.map((venomon, index) => (
            <HStack key={`${venomon.species}-${index}`} spacing={1.5}>
              {venomon.iconImageSrc ? (
                <Image
                  src={resolveServerAssetUrl(venomon.iconImageSrc)}
                  alt=""
                  boxSize="22px"
                  objectFit="contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : null}
              <Text fontSize="sm">
                {venomon.nickname || venomon.species}{' '}
                <Text as="span" color="gray.400">
                  Lv {venomon.level}
                </Text>
              </Text>
            </HStack>
          ))}
          {summary.items.map((item, index) => (
            <HStack key={`${item.name}-${index}`} spacing={1.5}>
              {item.iconSrc ? (
                <Image
                  src={resolveServerAssetUrl(item.iconSrc)}
                  alt=""
                  boxSize="18px"
                  objectFit="contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : null}
              <Text fontSize="sm">
                <Text as="span" fontWeight="800" color="yellow.200">
                  ×{item.quantity}
                </Text>{' '}
                {item.name}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}

export default function TradeHistoryWindow() {
  const t = useT();
  const trade = useTrade();
  const page = trade.history;

  useEffect(() => {
    trade.loadHistory(1);
    // Loading once when the window opens is intentional; the Refresh button
    // and the pager cover everything else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;

  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.300">
          {page ? t('trade.historyCount', { total: String(page.total) }) : t('trade.loading')}
        </Text>
        <Button size="xs" variant="outline" borderColor="whiteAlpha.400" onClick={() => trade.loadHistory(page?.page ?? 1)}>
          {t('trade.refresh')}
        </Button>
      </HStack>

      {trade.historyLoading ? <Text color="gray.400">{t('trade.loading')}</Text> : null}

      {page && page.entries.length === 0 && !trade.historyLoading ? (
        <Text color="gray.400">{t('trade.historyEmpty')}</Text>
      ) : null}

      <VStack align="stretch" spacing={3}>
        {(page?.entries ?? []).map((entry) => (
          <Box
            key={entry.tradeId}
            bg="rgba(0,0,0,0.3)"
            border="1px solid"
            borderColor="whiteAlpha.200"
            borderRadius="8px"
            p={3}
          >
            <HStack justify="space-between" flexWrap="wrap" gap={1}>
              <Text fontWeight="700" fontSize="sm">
                {entry.partnerDisplayName}{' '}
                <Text as="span" color="gray.400">
                  (@{entry.partnerUsername})
                </Text>
              </Text>
              <HStack spacing={2}>
                <Badge colorScheme={entry.result === 'COMPLETED' ? 'green' : 'red'}>
                  {entry.result === 'COMPLETED' ? `✔ ${t('trade.completed')}` : `✖ ${t('trade.failed')}`}
                </Badge>
                <Text fontSize="xs" color="gray.400">
                  {new Date(entry.completedAt).toLocaleString()}
                </Text>
              </HStack>
            </HStack>
            <Divider my={2} borderColor="whiteAlpha.200" />
            <HStack align="flex-start" spacing={4} flexDirection={{ base: 'column', md: 'row' }}>
              <ExchangeColumn label={t('trade.youGave')} summary={entry.given} />
              <ExchangeColumn label={t('trade.youReceived')} summary={entry.received} />
            </HStack>
            <Button
              mt={2}
              size="xs"
              variant="ghost"
              colorScheme="orange"
              onClick={() => trade.reportTrade(entry.tradeId, 'player-report')}
            >
              {t('trade.report')}
            </Button>
          </Box>
        ))}
      </VStack>

      {page && totalPages > 1 ? (
        <HStack justify="center" spacing={2}>
          <Button
            size="xs"
            isDisabled={page.page <= 1}
            onClick={() => trade.loadHistory(page.page - 1)}
          >
            ←
          </Button>
          <Text fontSize="sm">
            {page.page} / {totalPages}
          </Text>
          <Button
            size="xs"
            isDisabled={page.page >= totalPages}
            onClick={() => trade.loadHistory(page.page + 1)}
          >
            →
          </Button>
        </HStack>
      ) : null}
    </VStack>
  );
}
