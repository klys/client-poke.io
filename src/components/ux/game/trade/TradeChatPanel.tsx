/**
 * The trade's private chat channel.
 *
 * Only the two participants can read or write it; the server scopes delivery
 * to a per-trade room and closes the channel when the trade ends.
 *
 * System messages are rendered in a visually distinct style and are the only
 * kind the server will ever emit with `messageType: 'system'` — a client
 * cannot forge one, because the type is assigned server-side and player
 * messages are always tagged with their sender.
 *
 * Text arrives already sanitized (control characters stripped, `<`/`>`/`&`
 * escaped) and is rendered as plain text, never as markup.
 */

import { Box, Button, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../../i18n';
import type { TradeChatMessage } from './tradeTypes';

const MAX_INPUT_LENGTH = 300;

export default function TradeChatPanel({
  messages,
  myUserId,
  disabled,
  onSend
}: {
  messages: TradeChatMessage[];
  myUserId: number | null;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (text.length === 0 || disabled) {
      return;
    }
    onSend(text.slice(0, MAX_INPUT_LENGTH));
    setDraft('');
  };

  return (
    <VStack align="stretch" spacing={2} height="100%" minH="180px">
      <Text fontSize="xs" fontWeight="800" color="gray.300" textTransform="uppercase">
        {t('trade.chatTitle')}
      </Text>
      <Box
        ref={scrollRef}
        flex={1}
        minH="120px"
        maxH="220px"
        overflowY="auto"
        bg="rgba(0,0,0,0.35)"
        borderRadius="6px"
        border="1px solid"
        borderColor="whiteAlpha.200"
        p={2}
      >
        <VStack align="stretch" spacing={1}>
          {messages.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              {t('trade.chatEmpty')}
            </Text>
          ) : (
            messages.map((message) =>
              message.messageType === 'system' ? (
                <HStack key={message.id} spacing={1.5} align="flex-start">
                  <Text fontSize="xs" aria-hidden="true">
                    ⓘ
                  </Text>
                  <Text fontSize="xs" color="cyan.200" fontStyle="italic" flex={1}>
                    {message.text}
                  </Text>
                </HStack>
              ) : (
                <Text key={message.id} fontSize="sm">
                  <Text
                    as="span"
                    fontWeight="800"
                    color={message.senderUserId === myUserId ? 'green.200' : 'orange.200'}
                  >
                    {message.senderUserId === myUserId ? `${t('trade.you')}: ` : `${message.senderUsername}: `}
                  </Text>
                  <Text as="span" color="gray.100">
                    {message.text}
                  </Text>
                </Text>
              )
            )
          )}
        </VStack>
      </Box>
      <HStack spacing={2}>
        <Input
          size="sm"
          value={draft}
          maxLength={MAX_INPUT_LENGTH}
          isDisabled={disabled}
          placeholder={t('trade.chatPlaceholder')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // The world listens for movement keys globally; keep them here.
            event.stopPropagation();
            if (event.key === 'Enter') {
              submit();
            }
          }}
          bg="whiteAlpha.100"
          borderColor="whiteAlpha.300"
        />
        <Button size="sm" colorScheme="teal" isDisabled={disabled || draft.trim().length === 0} onClick={submit}>
          {t('trade.send')}
        </Button>
      </HStack>
    </VStack>
  );
}
