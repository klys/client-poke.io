/**
 * Bottom map-chat bar. Collapsible so it never blocks the view; on compact
 * (touch) screens it docks bottom-center between the virtual d-pad (left)
 * and action buttons (right) and starts collapsed.
 *
 * The input doubles as a command console — messages starting with "/" are
 * resolved server-side (/w, /global, /help, /ayuda).
 */

import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Text,
  VStack
} from '@chakra-ui/react';
import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useT } from '../../../../i18n';
import { useGameSettings } from '../../../../settings/gameSettings';
import { useCompactUx } from '../../useCompactUx';
import { useSocial } from './SocialContext';
import type { ChatMessage } from './socialTypes';

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.4L4 21.2A1 1 0 0 1 2.4 20.4V5a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function formatTime(at: string) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function MessageLine({
  message,
  showTimestamps,
  t
}: {
  message: ChatMessage;
  showTimestamps: boolean;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const time = showTimestamps ? formatTime(message.at) : '';
  if (message.channel === 'system') {
    return (
      <Text fontSize="sm" color="gray.400" fontStyle="italic">
        {time ? `[${time}] ` : ''}{message.text}
      </Text>
    );
  }
  if (message.channel === 'global') {
    return (
      <Text fontSize="sm" color="orange.300">
        {time ? `[${time}] ` : ''}
        <Text as="span" fontWeight="800">[{t('chat.globalTag')}] {message.fromName || message.fromUsername}: </Text>
        {message.text}
      </Text>
    );
  }
  if (message.channel === 'whisper') {
    return (
      <Text fontSize="sm" color="purple.300">
        {time ? `[${time}] ` : ''}
        <Text as="span" fontWeight="700">
          {t('chat.whisperTag', { from: message.fromUsername ?? '', to: message.toUsername ?? '' })}{' '}
        </Text>
        {message.text}
      </Text>
    );
  }
  return (
    <Text fontSize="sm" color="whiteAlpha.900">
      {time ? `[${time}] ` : ''}
      <Text as="span" fontWeight="700" color="teal.200">{message.fromName || message.fromUsername}: </Text>
      {message.text}
    </Text>
  );
}

export default function ChatBar() {
  const t = useT();
  const social = useSocial();
  const [gameSettings] = useGameSettings();
  const compact = useCompactUx();
  const [draft, setDraft] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const open = social.mapChatOpen;

  // Stick to the latest message while the feed is open.
  useEffect(() => {
    if (open && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [open, social.mapMessages]);

  if (!gameSettings.chat.enabled) {
    return null;
  }

  const send = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    social.sendMapMessage(text);
    setDraft('');
  };

  const positionProps = compact
    ? { left: '50%', transform: 'translateX(-50%)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }
    : { left: '12px', bottom: '12px' };

  if (!open) {
    return (
      <Box
        position="fixed"
        zIndex={3400}
        data-game-ux="true"
        onClick={stopUxEvent}
        onPointerDown={stopUxEvent}
        {...positionProps}
      >
        <Box position="relative">
          <IconButton
            aria-label={t('chat.open')}
            icon={<ChatIcon />}
            size={compact ? 'sm' : 'md'}
            colorScheme="teal"
            variant="solid"
            opacity={0.9}
            boxShadow="lg"
            onClick={() => social.setMapChatOpen(true)}
          />
          {social.mapUnread > 0 ? (
            <Badge
              position="absolute"
              top="-6px"
              right="-6px"
              borderRadius="full"
              colorScheme="red"
              variant="solid"
              fontSize="0.7em"
              pointerEvents="none"
            >
              {social.mapUnread > 9 ? '9+' : social.mapUnread}
            </Badge>
          ) : null}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      // Settings -> Display -> NPC dialog size drives chat scale too.
      style={{ zoom: gameSettings.uiScale.dialogs } as CSSProperties}
      position="fixed"
      zIndex={3400}
      width={compact ? 'min(72vw, 340px)' : '380px'}
      maxW="calc(100vw - 24px)"
      bg="rgba(17, 24, 39, 0.88)"
      border="1px solid rgba(255,255,255,0.16)"
      borderRadius="8px"
      boxShadow="0 12px 32px rgba(0,0,0,0.4)"
      color="white"
      data-game-ux="true"
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
      {...positionProps}
    >
      <HStack px={3} py={1.5} justify="space-between" bg="rgba(255,255,255,0.06)">
        <Text fontWeight="700" fontSize="sm">{t('chat.mapChat')}</Text>
        <Button size="xs" variant="ghost" color="gray.300" onClick={() => social.setMapChatOpen(false)}>
          {t('chat.hide')}
        </Button>
      </HStack>
      <Box
        ref={messagesRef}
        px={3}
        py={2}
        maxH={compact ? '26vh' : '200px'}
        minH="60px"
        overflowY="auto"
      >
        {social.mapMessages.length === 0 ? (
          <Text fontSize="sm" color="gray.500">{t('chat.empty')}</Text>
        ) : (
          <VStack align="stretch" spacing={1}>
            {social.mapMessages.map((message) => (
              <MessageLine
                key={message.id}
                message={message}
                showTimestamps={gameSettings.chat.showTimestamps}
                t={t}
              />
            ))}
          </VStack>
        )}
      </Box>
      <HStack px={2} py={2} spacing={2}>
        <Input
          size="sm"
          value={draft}
          placeholder={t('chat.placeholder')}
          bg="rgba(0,0,0,0.35)"
          border="1px solid rgba(255,255,255,0.14)"
          _placeholder={{ color: 'gray.500' }}
          maxLength={300}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              send();
            }
            if (event.key === 'Escape') {
              (event.target as HTMLInputElement).blur();
            }
          }}
          onKeyUp={stopUxEvent}
        />
        <Button size="sm" colorScheme="teal" onClick={send}>
          {t('chat.send')}
        </Button>
      </HStack>
    </Box>
  );
}
