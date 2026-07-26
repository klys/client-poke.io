/**
 * Private chat window content (one per conversation, rendered inside the
 * shared DraggableWindow using the dynamic `privateChat:<id>` window ids).
 * Members can invite more friends (each invitee must accept via the
 * notification center) or leave the chat.
 */

import {
  Box,
  Button,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  VStack
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../../i18n';
import { useGameSettings } from '../../../../settings/gameSettings';
import { useSocial } from './SocialContext';

export default function PrivateChatWindow({ chatId }: { chatId: string }) {
  const t = useT();
  const social = useSocial();
  const [gameSettings] = useGameSettings();
  const [draft, setDraft] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const chat = social.privateChats[chatId];

  useEffect(() => {
    if (chat && chat.unread > 0) {
      social.markChatRead(chatId);
    }
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chat?.messages.length, chat?.unread]);

  if (!chat) {
    return <Text color="gray.400">{t('chat.privateClosed')}</Text>;
  }

  const others = chat.members.filter((member) => member.userId !== social.myUserId);
  const invitableFriends = social.friends.filter(
    (friend) =>
      friend.online &&
      !chat.members.some((member) => member.userId === friend.userId) &&
      !chat.pendingUsernames.includes(friend.username)
  );

  const send = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    social.sendPrivateMessage(chatId, text);
    setDraft('');
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontSize="sm" color="gray.300">
          {others.length > 0
            ? t('chat.withMembers', { names: others.map((member) => member.username).join(', ') })
            : t('chat.waitingForMembers')}
        </Text>
        {chat.pendingUsernames.length > 0 ? (
          <Text fontSize="xs" color="yellow.300">
            {t('chat.pendingInvites', { names: chat.pendingUsernames.join(', ') })}
          </Text>
        ) : null}
      </Box>
      <Box
        ref={messagesRef}
        bg="rgba(0,0,0,0.3)"
        border="1px solid rgba(255,255,255,0.1)"
        borderRadius="6px"
        px={3}
        py={2}
        height="220px"
        maxH="40vh"
        overflowY="auto"
      >
        {chat.messages.length === 0 ? (
          <Text fontSize="sm" color="gray.500">{t('chat.empty')}</Text>
        ) : (
          <VStack align="stretch" spacing={1}>
            {chat.messages.map((message) => {
              const mine = message.fromUserId === social.myUserId;
              const time = gameSettings.chat.showTimestamps
                ? (() => {
                    const date = new Date(message.at);
                    return Number.isNaN(date.getTime())
                      ? ''
                      : `[${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}] `;
                  })()
                : '';
              return (
                <Text key={message.id} fontSize="sm" color="whiteAlpha.900">
                  {time}
                  <Text as="span" fontWeight="700" color={mine ? 'teal.200' : 'purple.200'}>
                    {message.fromName || message.fromUsername}:{' '}
                  </Text>
                  {message.text}
                </Text>
              );
            })}
          </VStack>
        )}
      </Box>
      <HStack spacing={2}>
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
          }}
        />
        <Button size="sm" colorScheme="teal" onClick={send}>
          {t('chat.send')}
        </Button>
      </HStack>
      <HStack justify="space-between">
        <Menu placement="top-start">
          <MenuButton
            as={Button}
            size="xs"
            variant="outline"
            color="white"
            borderColor="whiteAlpha.400"
            isDisabled={invitableFriends.length === 0}
          >
            {t('chat.invite')}
          </MenuButton>
          <MenuList color="gray.900" maxH="220px" overflowY="auto">
            {invitableFriends.map((friend) => (
              <MenuItem
                key={friend.userId}
                onClick={() => social.invitePrivateChat(chatId, friend.userId)}
              >
                {friend.username}
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
        <Button
          size="xs"
          variant="ghost"
          color="red.300"
          onClick={() => social.leavePrivateChat(chatId)}
        >
          {t('chat.leave')}
        </Button>
      </HStack>
    </VStack>
  );
}
