/**
 * Client-side payload shapes for the friends/chat sockets. Hand-written
 * mirrors of the server contracts in server-poke.io/Server/*Events.ts — the
 * client does not import server types (same pattern as battleTypes.ts).
 */

export interface SocialUserSummary {
  userId: number;
  username: string;
  name: string;
  characterSkinId: string;
}

export interface FriendEntry extends SocialUserSummary {
  online: boolean;
  mapId?: string;
  playerId?: string;
}

export interface FriendRequestRecord extends SocialUserSummary {
  createdAt: string;
}

export interface SocialPrefs {
  allowFriendRequests: boolean;
  allowTeleportRequests: boolean;
  allowChatInvites: boolean;
}

export interface FriendsStatePayload {
  friends: FriendEntry[];
  incoming: FriendRequestRecord[];
  outgoing: FriendRequestRecord[];
  prefs: SocialPrefs;
}

export type ChatChannel = 'map' | 'whisper' | 'global' | 'system';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  mapId?: string;
  fromUserId?: number;
  fromUsername?: string;
  fromName?: string;
  toUsername?: string;
  text: string;
  at: string;
}

export interface PrivateChatMemberEntry extends SocialUserSummary {
  online: boolean;
}

export interface PrivateChatMessage {
  chatId: string;
  id: string;
  fromUserId: number;
  fromUsername: string;
  fromName: string;
  text: string;
  at: string;
}

export interface PrivateChatSession {
  chatId: string;
  members: PrivateChatMemberEntry[];
  pendingUsernames: string[];
  messages: PrivateChatMessage[];
  unread: number;
}

export type SocialNotificationKind =
  | 'friend-request'
  | 'friend-accepted'
  | 'teleport-request'
  | 'chat-invite'
  | 'info';

/**
 * One actionable entry in the notification center. `kind` decides which
 * accept/decline sockets the panel fires; `info` entries are dismiss-only.
 */
export interface SocialNotification {
  id: string;
  kind: SocialNotificationKind;
  fromUsername: string;
  /** friend-request / friend-accepted: the other account's user id. */
  userId?: number;
  /** teleport-request approval token. */
  requestId?: string;
  /** chat-invite approval token + target chat. */
  inviteId?: string;
  chatId?: string;
  /** Pre-rendered text for `info` entries (already translated). */
  text?: string;
  at: number;
}
