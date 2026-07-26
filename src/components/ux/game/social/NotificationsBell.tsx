/**
 * Notification center: a bell button (rendered next to the account menu
 * button) with an unread badge and a dropdown panel. Friend requests,
 * teleport requests and chat invitations are actionable (accept/decline);
 * informational entries can only be dismissed.
 */

import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack
} from '@chakra-ui/react';
import { useState, type SyntheticEvent } from 'react';
import { useT } from '../../../../i18n';
import { useSocial } from './SocialContext';
import type { SocialNotification } from './socialTypes';

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 22a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 22Zm7.2-6v-5.2c0-3.3-1.8-6.1-4.8-6.8V3.2a2.4 2.4 0 1 0-4.8 0V4c-3 .7-4.8 3.4-4.8 6.8V16l-1.9 1.9a1 1 0 0 0 .7 1.7h15.7a1 1 0 0 0 .7-1.7L19.2 16Z" />
    </svg>
  );
}

function notificationText(
  notification: SocialNotification,
  t: (key: string, params?: Record<string, string>) => string
) {
  switch (notification.kind) {
    case 'friend-request':
      return t('social.friendRequestFrom', { name: notification.fromUsername });
    case 'friend-accepted':
      return t('social.friendAcceptedBy', { name: notification.fromUsername });
    case 'teleport-request':
      return t('social.teleportRequestFrom', { name: notification.fromUsername });
    case 'chat-invite':
      return t('social.chatInviteFrom', { name: notification.fromUsername });
    default:
      return notification.text ?? '';
  }
}

export default function NotificationsBell() {
  const t = useT();
  const social = useSocial();
  const [open, setOpen] = useState(false);
  const count = social.notifications.length;
  const actionable = (kind: SocialNotification['kind']) =>
    kind === 'friend-request' || kind === 'teleport-request' || kind === 'chat-invite';

  return (
    <Box position="relative" data-game-ux="true" onClick={stopUxEvent} onPointerDown={stopUxEvent}>
      <Box position="relative">
        <IconButton
          aria-label={t('social.notifications')}
          icon={<BellIcon />}
          colorScheme="teal"
          variant="solid"
          boxShadow="lg"
          onClick={() => setOpen((value) => !value)}
        />
        {count > 0 ? (
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
            {count > 9 ? '9+' : count}
          </Badge>
        ) : null}
      </Box>
      {open ? (
        <Box
          position="absolute"
          right={0}
          top="46px"
          width={{ base: 'calc(100vw - 32px)', sm: '320px' }}
          maxH="60vh"
          overflowY="auto"
          bg="rgba(17, 24, 39, 0.98)"
          border="1px solid rgba(255,255,255,0.18)"
          borderRadius="8px"
          boxShadow="0 18px 44px rgba(0,0,0,0.38)"
          color="white"
          p={3}
          zIndex={4200}
        >
          <HStack justify="space-between" mb={2}>
            <Text fontWeight="700">{t('social.notifications')}</Text>
            <Button size="xs" variant="ghost" color="gray.300" onClick={() => setOpen(false)}>
              {t('social.close')}
            </Button>
          </HStack>
          {count === 0 ? (
            <Text color="gray.400" fontSize="sm">
              {t('social.noNotifications')}
            </Text>
          ) : (
            <VStack align="stretch" spacing={2}>
              {[...social.notifications].reverse().map((notification) => (
                <Box
                  key={notification.id}
                  bg="whiteAlpha.100"
                  border="1px solid rgba(255,255,255,0.1)"
                  borderRadius="6px"
                  p={2}
                >
                  <Text fontSize="sm">{notificationText(notification, t)}</Text>
                  <HStack mt={2} justify="flex-end" spacing={2}>
                    {actionable(notification.kind) ? (
                      <>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="gray.300"
                          onClick={() => social.respondToNotification(notification, false)}
                        >
                          {t('social.decline')}
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="teal"
                          onClick={() => social.respondToNotification(notification, true)}
                        >
                          {t('social.accept')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        color="gray.300"
                        onClick={() => social.dismissNotification(notification.id)}
                      >
                        {t('social.dismiss')}
                      </Button>
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      ) : null}
    </Box>
  );
}
