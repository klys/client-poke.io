/**
 * Social state hub: friends list, friend requests, notification center
 * entries, map chat feed and private chat sessions.
 *
 * Mounted inside the game's AppContext provider so it can register its own
 * listeners on the shared game socket (the same pattern feature components
 * like TrainerInteractions use). All server events land here; UI components
 * (FriendsWindow, ChatBar, NotificationsBell, PrivateChatWindow) only read
 * this context and call its action helpers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode
} from 'react';
import { AppContext } from '../../../../context/appContext';
import { useAuth } from '../../../../context/authContext';
import { getActiveLanguage, translate } from '../../../../i18n';
import { loadGameSettings } from '../../../../settings/gameSettings';
import { ensureNotificationPermission, notifyNative } from './notify';
import type {
  ChatMessage,
  FriendPresencePayload,
  FriendsStatePayload,
  PrivateChatMemberEntry,
  PrivateChatMessage,
  PrivateChatSession,
  SocialNotification,
  SocialPrefs
} from './socialTypes';

const MAX_MAP_MESSAGES = 120;
const MAX_PRIVATE_MESSAGES = 200;
const MAX_NOTIFICATIONS = 30;
const MAX_BUBBLE_TEXT = 90;

/** A transient speech bubble over a talking player's sprite. */
export interface ChatBubble {
  messageId: string;
  text: string;
}

interface SocialState {
  friends: FriendsStatePayload['friends'];
  incoming: FriendsStatePayload['incoming'];
  outgoing: FriendsStatePayload['outgoing'];
  blocked: FriendsStatePayload['blocked'];
  prefs: SocialPrefs | null;
  notifications: SocialNotification[];
  mapMessages: ChatMessage[];
  mapUnread: number;
  mapChatOpen: boolean;
  privateChats: Record<string, PrivateChatSession>;
  /** Bumped when some UI wants a chat window opened/focused. */
  focusChat: { chatId: string; nonce: number } | null;
  /** Speech bubbles by playerId (`user:<id>`), pruned after their duration. */
  bubbles: Record<string, ChatBubble>;
}

const INITIAL_STATE: SocialState = {
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
  prefs: null,
  notifications: [],
  mapMessages: [],
  mapUnread: 0,
  mapChatOpen: false,
  privateChats: {},
  focusChat: null,
  bubbles: {}
};

type SocialAction =
  | { type: 'friends-state'; payload: FriendsStatePayload }
  | { type: 'presence'; payload: FriendPresencePayload }
  | { type: 'notification-add'; payload: SocialNotification }
  | { type: 'notification-remove'; id: string }
  | { type: 'notifications-clear' }
  | { type: 'map-message'; payload: ChatMessage }
  | { type: 'map-chat-open'; open: boolean }
  | { type: 'private-state'; payload: { chatId: string; members: PrivateChatMemberEntry[]; pendingUsernames: string[] } }
  | { type: 'private-message'; payload: PrivateChatMessage }
  | { type: 'private-closed'; chatId: string }
  | { type: 'chat-read'; chatId: string }
  | { type: 'focus-chat'; chatId: string }
  | { type: 'bubble-show'; playerId: string; bubble: ChatBubble }
  | { type: 'bubble-expire'; playerId: string; messageId: string };

function reducer(state: SocialState, action: SocialAction): SocialState {
  switch (action.type) {
    case 'friends-state': {
      // Keep friend-request notifications in sync with the authoritative
      // pending list: requests that arrived while offline appear, requests
      // answered from the Friends window disappear.
      const incoming = action.payload.incoming ?? [];
      const notifications = [
        ...state.notifications.filter(
          (entry) =>
            entry.kind !== 'friend-request' ||
            incoming.some((request) => `friend-request-${request.userId}` === entry.id)
        ),
        ...incoming
          .filter(
            (request) =>
              !state.notifications.some((entry) => entry.id === `friend-request-${request.userId}`)
          )
          .map((request) => ({
            id: `friend-request-${request.userId}`,
            kind: 'friend-request' as const,
            fromUsername: request.username,
            userId: request.userId,
            at: Date.now()
          }))
      ].slice(-MAX_NOTIFICATIONS);
      return {
        ...state,
        friends: action.payload.friends ?? [],
        incoming,
        outgoing: action.payload.outgoing ?? [],
        blocked: action.payload.blocked ?? [],
        prefs: action.payload.prefs ?? state.prefs,
        notifications
      };
    }
    case 'presence':
      return {
        ...state,
        friends: state.friends.map((friend) =>
          friend.userId === action.payload.userId
            ? {
                ...friend,
                online: action.payload.online,
                mapId: action.payload.mapId,
                playerId: action.payload.playerId,
                accountName: action.payload.accountName ?? friend.accountName,
                activeCharacterId: action.payload.activeCharacterId ?? null,
                activeCharacterName: action.payload.activeCharacterName ?? null,
                lastSeenAt: action.payload.lastSeenAt ?? friend.lastSeenAt ?? null
              }
            : friend
        )
      };
    case 'notification-add':
      return {
        ...state,
        notifications: [
          ...state.notifications.filter((entry) => entry.id !== action.payload.id),
          action.payload
        ].slice(-MAX_NOTIFICATIONS)
      };
    case 'notification-remove':
      return {
        ...state,
        notifications: state.notifications.filter((entry) => entry.id !== action.id)
      };
    case 'notifications-clear':
      return { ...state, notifications: state.notifications.filter((entry) => entry.kind !== 'info') };
    case 'map-message':
      return {
        ...state,
        mapMessages: [...state.mapMessages, action.payload].slice(-MAX_MAP_MESSAGES),
        mapUnread: state.mapChatOpen ? 0 : state.mapUnread + 1
      };
    case 'map-chat-open':
      return { ...state, mapChatOpen: action.open, mapUnread: action.open ? 0 : state.mapUnread };
    case 'private-state': {
      const existing = state.privateChats[action.payload.chatId];
      return {
        ...state,
        privateChats: {
          ...state.privateChats,
          [action.payload.chatId]: {
            chatId: action.payload.chatId,
            members: action.payload.members,
            pendingUsernames: action.payload.pendingUsernames,
            messages: existing?.messages ?? [],
            unread: existing?.unread ?? 0
          }
        }
      };
    }
    case 'private-message': {
      const chat = state.privateChats[action.payload.chatId];
      if (!chat) {
        // Message for a chat we have no state for yet — synthesize a shell;
        // the authoritative member list arrives with chat:private-state.
        return {
          ...state,
          privateChats: {
            ...state.privateChats,
            [action.payload.chatId]: {
              chatId: action.payload.chatId,
              members: [],
              pendingUsernames: [],
              messages: [action.payload],
              unread: 1
            }
          }
        };
      }
      return {
        ...state,
        privateChats: {
          ...state.privateChats,
          [action.payload.chatId]: {
            ...chat,
            messages: [...chat.messages, action.payload].slice(-MAX_PRIVATE_MESSAGES),
            unread: chat.unread + 1
          }
        }
      };
    }
    case 'private-closed': {
      const next = { ...state.privateChats };
      delete next[action.chatId];
      return { ...state, privateChats: next };
    }
    case 'chat-read': {
      const chat = state.privateChats[action.chatId];
      if (!chat || chat.unread === 0) {
        return state;
      }
      return {
        ...state,
        privateChats: { ...state.privateChats, [action.chatId]: { ...chat, unread: 0 } }
      };
    }
    case 'focus-chat':
      return {
        ...state,
        focusChat: { chatId: action.chatId, nonce: (state.focusChat?.nonce ?? 0) + 1 }
      };
    case 'bubble-show':
      return {
        ...state,
        bubbles: { ...state.bubbles, [action.playerId]: action.bubble }
      };
    case 'bubble-expire': {
      // Only clear if a newer message has not replaced this bubble already.
      if (state.bubbles[action.playerId]?.messageId !== action.messageId) {
        return state;
      }
      const bubbles = { ...state.bubbles };
      delete bubbles[action.playerId];
      return { ...state, bubbles };
    }
    default:
      return state;
  }
}

export interface SocialApi extends SocialState {
  myUserId: number | null;
  myMapId: string | null;
  requestFriend: (username: string) => void;
  /** Preferred over `requestFriend` when the account id is known (trainer card). */
  requestFriendByAccountId: (accountId: number) => void;
  respondToFriendRequest: (userId: number, accepted: boolean) => void;
  cancelFriendRequest: (userId: number) => void;
  removeFriend: (userId: number) => void;
  blockAccount: (accountId: number) => void;
  unblockAccount: (accountId: number) => void;
  setSocialPrefs: (updates: Partial<SocialPrefs>) => void;
  requestTeleport: (userId: number) => void;
  sendMapMessage: (text: string) => void;
  setMapChatOpen: (open: boolean) => void;
  createPrivateChat: (userIds: number[]) => void;
  invitePrivateChat: (chatId: string, userId: number) => void;
  sendPrivateMessage: (chatId: string, text: string) => void;
  leavePrivateChat: (chatId: string) => void;
  markChatRead: (chatId: string) => void;
  requestOpenChat: (chatId: string) => void;
  dismissNotification: (id: string) => void;
  respondToNotification: (notification: SocialNotification, accepted: boolean) => void;
}

export const SocialContext = createContext<SocialApi | null>(null);

export function useSocial(): SocialApi {
  const api = useContext(SocialContext);
  if (!api) {
    throw new Error('useSocial must be used inside <SocialProvider>');
  }
  return api;
}

let notificationSequence = 0;
function nextNotificationId(prefix: string) {
  notificationSequence += 1;
  return `${prefix}-${Date.now()}-${notificationSequence}`;
}

function nativeNotify(titleKey: string, params: Record<string, string>) {
  if (!loadGameSettings().chat.nativeNotifications) {
    return;
  }
  const language = getActiveLanguage();
  notifyNative(translate('social.notificationTitle', language), translate(titleKey, language, params));
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { socket, players, myplayer } = useContext(AppContext);
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const myUserId: number | null = typeof user?.id === 'number' ? user.id : null;

  // The local player's current map (same-map gating for friend actions).
  const myMapId: string | null = useMemo(() => {
    const me: any = Object.values(players ?? {}).find(
      (player: any) => player?.playerId === myplayer
    );
    return me?.currentMapId ?? null;
  }, [players, myplayer]);

  // Keep a ref of chat ids so brand-new chats can auto-focus their window.
  const knownChatIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleFriendsState = (data: FriendsStatePayload) => {
      dispatch({ type: 'friends-state', payload: data });
    };
    const handlePresence = (data: any) => {
      dispatch({ type: 'presence', payload: data });
    };
    const handleFriendRequestReceived = (data: any) => {
      if (!data?.from) return;
      dispatch({
        type: 'notification-add',
        payload: {
          id: `friend-request-${data.from.userId}`,
          kind: 'friend-request',
          fromUsername: data.from.username,
          userId: data.from.userId,
          at: Date.now()
        }
      });
      nativeNotify('social.native.friendRequest', { name: data.from.username });
    };
    const handleFriendRequestAccepted = (data: any) => {
      if (!data?.by) return;
      dispatch({
        type: 'notification-add',
        payload: {
          id: nextNotificationId('friend-accepted'),
          kind: 'friend-accepted',
          fromUsername: data.by.username,
          userId: data.by.userId,
          at: Date.now()
        }
      });
      nativeNotify('social.native.friendAccepted', { name: data.by.username });
    };
    const handleFriendRemoved = () => {
      socket.emit('friends:list');
    };
    const handleTeleportRequest = (data: any) => {
      if (!data?.from) return;
      dispatch({
        type: 'notification-add',
        payload: {
          id: `teleport-${data.requestId}`,
          kind: 'teleport-request',
          fromUsername: data.from.username,
          requestId: data.requestId,
          at: Date.now()
        }
      });
      nativeNotify('social.native.teleportRequest', { name: data.from.username });
    };
    const handleTeleportResponse = (data: any) => {
      // Remove the actionable entry if it is still pending on our side.
      dispatch({ type: 'notification-remove', id: `teleport-${data?.requestId}` });
      const language = getActiveLanguage();
      dispatch({
        type: 'notification-add',
        payload: {
          id: nextNotificationId('teleport-outcome'),
          kind: 'info',
          fromUsername: data?.byUsername ?? '',
          text: data?.accepted
            ? translate('social.teleportAccepted', language, { name: data?.byUsername ?? '' })
            : data?.expired
              ? translate('social.teleportExpired', language)
              : translate('social.teleportDeclined', language, { name: data?.byUsername ?? '' }),
          at: Date.now()
        }
      });
    };
    const handleChatInviteReceived = (data: any) => {
      if (!data?.from) return;
      dispatch({
        type: 'notification-add',
        payload: {
          id: `chat-invite-${data.inviteId}`,
          kind: 'chat-invite',
          fromUsername: data.from.username,
          inviteId: data.inviteId,
          chatId: data.chatId,
          at: Date.now()
        }
      });
      nativeNotify('social.native.chatInvite', { name: data.from.username });
    };
    const handleChatInviteResponse = (data: any) => {
      if (data?.accepted) {
        return; // the accepted member shows up via chat:private-state
      }
      const language = getActiveLanguage();
      dispatch({
        type: 'notification-add',
        payload: {
          id: nextNotificationId('chat-invite-outcome'),
          kind: 'info',
          fromUsername: data?.byUsername ?? '',
          text: data?.byUsername
            ? translate('social.chatInviteDeclined', language, { name: data.byUsername })
            : translate('social.chatInviteExpired', language),
          at: Date.now()
        }
      });
    };
    const handleChatMessage = (data: ChatMessage) => {
      dispatch({ type: 'map-message', payload: data });
      if (data?.channel === 'whisper' && data.fromUserId !== myUserId) {
        nativeNotify('social.native.whisper', { name: data.fromName || data.fromUsername || '' });
      }
      // Speech bubble over the talking player's sprite (same-map messages
      // only reach same-map clients, so no extra map check is needed).
      if (data?.channel === 'map' && typeof data.fromUserId === 'number') {
        const chatSettings = loadGameSettings().chat;
        if (!chatSettings.bubblesEnabled) {
          return;
        }
        const playerId = `user:${data.fromUserId}`;
        const bubble: ChatBubble = {
          messageId: data.id,
          text:
            data.text.length > MAX_BUBBLE_TEXT
              ? `${data.text.slice(0, MAX_BUBBLE_TEXT)}…`
              : data.text
        };
        dispatch({ type: 'bubble-show', playerId, bubble });
        window.setTimeout(() => {
          dispatch({ type: 'bubble-expire', playerId, messageId: data.id });
        }, Math.round(chatSettings.bubbleDurationSeconds * 1000));
      }
    };
    const handleChatError = (data: any) => {
      dispatch({
        type: 'map-message',
        payload: {
          id: nextNotificationId('chat-error'),
          channel: 'system',
          text: String(data?.message ?? ''),
          at: new Date().toISOString()
        }
      });
    };
    const handleFriendsError = (data: any) => {
      const language = getActiveLanguage();
      dispatch({
        type: 'notification-add',
        payload: {
          id: nextNotificationId('friends-error'),
          kind: 'info',
          fromUsername: '',
          text: String(data?.message ?? translate('social.genericError', language)),
          at: Date.now()
        }
      });
    };
    const handlePrivateState = (data: any) => {
      if (!data?.chatId) return;
      dispatch({
        type: 'private-state',
        payload: {
          chatId: data.chatId,
          members: Array.isArray(data.members) ? data.members : [],
          pendingUsernames: Array.isArray(data.pendingUsernames) ? data.pendingUsernames : []
        }
      });
      if (!knownChatIdsRef.current.has(data.chatId)) {
        knownChatIdsRef.current.add(data.chatId);
        dispatch({ type: 'focus-chat', chatId: data.chatId });
      }
    };
    const handlePrivateMessage = (data: PrivateChatMessage) => {
      if (!data?.chatId) return;
      dispatch({ type: 'private-message', payload: data });
      if (data.fromUserId !== myUserId) {
        nativeNotify('social.native.privateMessage', { name: data.fromName || data.fromUsername });
      }
    };
    const handlePrivateClosed = (data: any) => {
      if (!data?.chatId) return;
      knownChatIdsRef.current.delete(data.chatId);
      dispatch({ type: 'private-closed', chatId: data.chatId });
    };

    // House pets: alerts persisted on the character (pet:notifications on
    // join) and live ones; both live in the bell until dismissed.
    const petNotification = (raw: any): SocialNotification | null => {
      if (!raw || typeof raw.id !== 'string' || typeof raw.text !== 'string') return null;
      return {
        id: `pet-${raw.id}`,
        kind: 'pet',
        fromUsername: typeof raw.petName === 'string' ? raw.petName : '',
        text: translate('social.petAlert', getActiveLanguage(), { text: raw.text }),
        petNotificationId: raw.id,
        mapId: typeof raw.mapId === 'string' ? raw.mapId : undefined,
        at: typeof raw.at === 'number' ? raw.at : Date.now()
      };
    };
    const handlePetNotification = (data: any) => {
      const notification = petNotification(data?.notification);
      if (!notification) return;
      dispatch({ type: 'notification-add', payload: notification });
      nativeNotify('social.native.pet', { text: data.notification.text });
    };
    const handlePetNotifications = (data: any) => {
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      for (const raw of list) {
        const notification = petNotification(raw);
        if (notification) dispatch({ type: 'notification-add', payload: notification });
      }
    };
    socket.on('pet:notification', handlePetNotification);
    socket.on('pet:notifications', handlePetNotifications);
    socket.on('friends:state', handleFriendsState);
    socket.on('friends:presence', handlePresence);
    socket.on('friends:request-received', handleFriendRequestReceived);
    socket.on('friends:request-accepted', handleFriendRequestAccepted);
    socket.on('friends:removed', handleFriendRemoved);
    socket.on('friends:teleport-request', handleTeleportRequest);
    socket.on('friends:teleport-response', handleTeleportResponse);
    socket.on('friends:error', handleFriendsError);
    socket.on('chat:message', handleChatMessage);
    socket.on('chat:error', handleChatError);
    socket.on('chat:invite-received', handleChatInviteReceived);
    socket.on('chat:invite-response', handleChatInviteResponse);
    socket.on('chat:private-state', handlePrivateState);
    socket.on('chat:private-message', handlePrivateMessage);
    socket.on('chat:private-closed', handlePrivateClosed);

    return () => {
      socket.off('friends:state', handleFriendsState);
      socket.off('pet:notification', handlePetNotification);
      socket.off('pet:notifications', handlePetNotifications);
      socket.off('friends:presence', handlePresence);
      socket.off('friends:request-received', handleFriendRequestReceived);
      socket.off('friends:request-accepted', handleFriendRequestAccepted);
      socket.off('friends:removed', handleFriendRemoved);
      socket.off('friends:teleport-request', handleTeleportRequest);
      socket.off('friends:teleport-response', handleTeleportResponse);
      socket.off('friends:error', handleFriendsError);
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:error', handleChatError);
      socket.off('chat:invite-received', handleChatInviteReceived);
      socket.off('chat:invite-response', handleChatInviteResponse);
      socket.off('chat:private-state', handlePrivateState);
      socket.off('chat:private-message', handlePrivateMessage);
      socket.off('chat:private-closed', handlePrivateClosed);
    };
  }, [socket, myUserId]);

  // Initial snapshot + permission priming. Waits until the player joined the
  // world (myplayer set): the game socket only authenticates during
  // addPlayer, so asking earlier races auth and yields a login error.
  useEffect(() => {
    if (!socket || myUserId === null || !myplayer) {
      return;
    }
    socket.emit('friends:list');
    if (loadGameSettings().chat.nativeNotifications) {
      void ensureNotificationPermission();
    }
  }, [socket, myUserId, myplayer]);

  const emit = useCallback(
    (event: string, payload?: unknown) => {
      if (socket) {
        socket.emit(event, payload);
      }
    },
    [socket]
  );

  const respondToNotification = useCallback(
    (notification: SocialNotification, accepted: boolean) => {
      if (notification.kind === 'friend-request' && typeof notification.userId === 'number') {
        emit('friends:respond', { userId: notification.userId, accepted });
      } else if (notification.kind === 'teleport-request' && notification.requestId) {
        emit('friends:teleport-respond', { requestId: notification.requestId, accepted });
      } else if (notification.kind === 'chat-invite' && notification.inviteId) {
        emit('chat:invite-respond', { inviteId: notification.inviteId, accepted });
      }
      dispatch({ type: 'notification-remove', id: notification.id });
    },
    [emit]
  );

  const api: SocialApi = {
    ...state,
    myUserId,
    myMapId,
    requestFriend: (username) => emit('friends:request', { username }),
    requestFriendByAccountId: (accountId) => emit('friends:request', { accountId }),
    respondToFriendRequest: (userId, accepted) => emit('friends:respond', { userId, accepted }),
    cancelFriendRequest: (userId) => emit('friends:cancel-request', { userId }),
    removeFriend: (userId) => emit('friends:remove', { userId }),
    blockAccount: (accountId) => emit('friends:block', { accountId }),
    unblockAccount: (accountId) => emit('friends:unblock', { accountId }),
    setSocialPrefs: (updates) => emit('friends:set-prefs', updates),
    requestTeleport: (userId) => emit('friends:teleport-request', { userId }),
    sendMapMessage: (text) => emit('chat:map-message', { text }),
    setMapChatOpen: (open) => dispatch({ type: 'map-chat-open', open }),
    createPrivateChat: (userIds) => emit('chat:private-create', { userIds }),
    invitePrivateChat: (chatId, userId) => emit('chat:private-invite', { chatId, userId }),
    sendPrivateMessage: (chatId, text) => emit('chat:private-message', { chatId, text }),
    leavePrivateChat: (chatId) => emit('chat:private-leave', { chatId }),
    markChatRead: (chatId) => dispatch({ type: 'chat-read', chatId }),
    requestOpenChat: (chatId) => dispatch({ type: 'focus-chat', chatId }),
    dismissNotification: (id) => {
      const entry = stateRef.current.notifications.find((candidate) => candidate.id === id);
      if (entry?.kind === 'pet' && entry.petNotificationId) {
        emit('pet:notification-dismiss', { id: entry.petNotificationId });
      }
      dispatch({ type: 'notification-remove', id });
    },
    respondToNotification
  };

  return <SocialContext.Provider value={api}>{children}</SocialContext.Provider>;
}
