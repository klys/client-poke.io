/**
 * Friends window content (rendered inside the shared DraggableWindow).
 *
 * Tabs:
 *  - Friends: the list with per-friend actions (private chat, teleport,
 *    battle challenge / trade — same map only —, unfriend).
 *  - Requests: incoming (accept/decline) and outgoing (cancel) requests.
 *  - Add: send a friend request by exact username.
 *  - Config: server-enforced social preferences.
 */

import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack
} from '@chakra-ui/react';
import { useContext, useState, type ReactNode } from 'react';
import { AppContext } from '../../../../context/appContext';
import { useT } from '../../../../i18n';
import { useSocial } from './SocialContext';
import type { FriendEntry } from './socialTypes';

function FriendRow({ friend }: { friend: FriendEntry }) {
  const t = useT();
  const social = useSocial();
  const { socket } = useContext(AppContext);
  const sameMap = friend.online && Boolean(friend.mapId) && friend.mapId === social.myMapId;

  return (
    <HStack
      justify="space-between"
      bg="whiteAlpha.100"
      border="1px solid rgba(255,255,255,0.1)"
      borderRadius="6px"
      px={3}
      py={2}
    >
      <Box>
        <HStack spacing={2}>
          <Box
            width="8px"
            height="8px"
            borderRadius="full"
            bg={friend.online ? 'green.400' : 'gray.500'}
          />
          <Text fontWeight="700">{friend.username}</Text>
        </HStack>
        <Text fontSize="xs" color="gray.400">
          {friend.online
            ? sameMap
              ? t('friends.onSameMap')
              : t('friends.online')
            : t('friends.offline')}
        </Text>
      </Box>
      <Menu placement="bottom-end">
        <MenuButton as={Button} size="sm" variant="outline" color="white" borderColor="whiteAlpha.400">
          {t('friends.actions')}
        </MenuButton>
        <MenuList color="gray.900">
          <MenuItem onClick={() => social.createPrivateChat([friend.userId])}>
            {t('friends.privateChat')}
          </MenuItem>
          <MenuItem
            isDisabled={!friend.online}
            onClick={() => social.requestTeleport(friend.userId)}
          >
            {t('friends.teleportTo')}
          </MenuItem>
          <MenuItem
            isDisabled={!sameMap || !friend.playerId}
            onClick={() => {
              if (friend.playerId) {
                socket.emit('battle:challenge-player', { targetPlayerId: friend.playerId });
              }
            }}
          >
            {t('friends.challenge')}{!sameMap ? ` (${t('friends.sameMapOnly')})` : ''}
          </MenuItem>
          <MenuItem
            isDisabled={!sameMap || !friend.playerId}
            onClick={() => {
              if (friend.playerId) {
                socket.emit('battle:trade-request', { targetPlayerId: friend.playerId });
              }
            }}
          >
            {t('friends.trade')}{!sameMap ? ` (${t('friends.sameMapOnly')})` : ''}
          </MenuItem>
          <MenuItem color="red.500" onClick={() => social.removeFriend(friend.userId)}>
            {t('friends.unfriend')}
          </MenuItem>
        </MenuList>
      </Menu>
    </HStack>
  );
}

function FriendsTab() {
  const t = useT();
  const social = useSocial();

  if (social.friends.length === 0) {
    return <Text color="gray.400">{t('friends.emptyList')}</Text>;
  }

  const sorted = [...social.friends].sort((a, b) => {
    if (a.online !== b.online) {
      return a.online ? -1 : 1;
    }
    return a.username.localeCompare(b.username);
  });

  return (
    <VStack align="stretch" spacing={2}>
      {sorted.map((friend) => (
        <FriendRow key={friend.userId} friend={friend} />
      ))}
    </VStack>
  );
}

function RequestsTab() {
  const t = useT();
  const social = useSocial();

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontWeight="700" mb={2}>{t('friends.incomingRequests')}</Text>
        {social.incoming.length === 0 ? (
          <Text color="gray.400" fontSize="sm">{t('friends.noIncoming')}</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {social.incoming.map((request) => (
              <HStack
                key={request.userId}
                justify="space-between"
                bg="whiteAlpha.100"
                borderRadius="6px"
                px={3}
                py={2}
              >
                <Text fontWeight="700">{request.username}</Text>
                <HStack>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="gray.300"
                    onClick={() => social.respondToFriendRequest(request.userId, false)}
                  >
                    {t('social.decline')}
                  </Button>
                  <Button
                    size="xs"
                    colorScheme="teal"
                    onClick={() => social.respondToFriendRequest(request.userId, true)}
                  >
                    {t('social.accept')}
                  </Button>
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>
      <Box>
        <Text fontWeight="700" mb={2}>{t('friends.outgoingRequests')}</Text>
        {social.outgoing.length === 0 ? (
          <Text color="gray.400" fontSize="sm">{t('friends.noOutgoing')}</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {social.outgoing.map((request) => (
              <HStack
                key={request.userId}
                justify="space-between"
                bg="whiteAlpha.100"
                borderRadius="6px"
                px={3}
                py={2}
              >
                <Text fontWeight="700">{request.username}</Text>
                <Button
                  size="xs"
                  variant="ghost"
                  color="gray.300"
                  onClick={() => social.cancelFriendRequest(request.userId)}
                >
                  {t('friends.cancelRequest')}
                </Button>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}

function AddFriendTab() {
  const t = useT();
  const social = useSocial();
  const [username, setUsername] = useState('');

  const submit = () => {
    const value = username.trim();
    if (!value) {
      return;
    }
    social.requestFriend(value);
    setUsername('');
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Text color="gray.300" fontSize="sm">{t('friends.addHint')}</Text>
      <HStack>
        <Input
          value={username}
          placeholder={t('friends.usernamePlaceholder')}
          bg="rgba(0,0,0,0.35)"
          border="1px solid rgba(255,255,255,0.14)"
          _placeholder={{ color: 'gray.500' }}
          onChange={(event) => setUsername(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              submit();
            }
          }}
        />
        <Button colorScheme="teal" onClick={submit}>
          {t('friends.sendRequest')}
        </Button>
      </HStack>
    </VStack>
  );
}

function ConfigTab() {
  const t = useT();
  const social = useSocial();
  const prefs = social.prefs;

  const row = (label: string, key: 'allowFriendRequests' | 'allowTeleportRequests' | 'allowChatInvites') => (
    <HStack justify="space-between">
      <Text>{label}</Text>
      <Switch
        colorScheme="teal"
        isChecked={prefs?.[key] !== false}
        onChange={(event) => social.setSocialPrefs({ [key]: event.target.checked })}
      />
    </HStack>
  );

  return (
    <VStack align="stretch" spacing={4}>
      <Text color="gray.300" fontSize="sm">{t('friends.configHint')}</Text>
      {row(t('friends.allowRequests'), 'allowFriendRequests')}
      {row(t('friends.allowTeleports'), 'allowTeleportRequests')}
      {row(t('friends.allowChatInvites'), 'allowChatInvites')}
    </VStack>
  );
}

export default function FriendsWindow() {
  const t = useT();
  const social = useSocial();
  const pendingCount = social.incoming.length;

  const tabs: Array<{ key: string; label: ReactNode; content: ReactNode }> = [
    { key: 'friends', label: t('friends.tab.friends'), content: <FriendsTab /> },
    {
      key: 'requests',
      label: (
        <HStack spacing={1}>
          <Text as="span">{t('friends.tab.requests')}</Text>
          {pendingCount > 0 ? (
            <Badge borderRadius="full" colorScheme="red" variant="solid" fontSize="0.7em">
              {pendingCount}
            </Badge>
          ) : null}
        </HStack>
      ),
      content: <RequestsTab />
    },
    { key: 'add', label: t('friends.tab.add'), content: <AddFriendTab /> },
    { key: 'config', label: t('friends.tab.config'), content: <ConfigTab /> }
  ];

  return (
    <Tabs colorScheme="teal" variant="soft-rounded">
      <TabList flexWrap="wrap" gap={2}>
        {tabs.map((tab) => <Tab key={tab.key}>{tab.label}</Tab>)}
      </TabList>
      <TabPanels>
        {tabs.map((tab) => <TabPanel key={tab.key} px={0}>{tab.content}</TabPanel>)}
      </TabPanels>
    </Tabs>
  );
}
