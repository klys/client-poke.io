/**
 * Client-side payload shapes for the friends/chat sockets. Hand-written
 * mirrors of the server contracts in server-poke.io/Server/*Events.ts — the
 * client does not import server types (same pattern as battleTypes.ts).
 */

export interface SocialUserSummary {
  userId: number;
  username: string;
  /** The active character's name. */
  name: string;
  characterSkinId: string;
  /** Account identity (`accountId` = `userId`, `accountName` = `username`). */
  accountId: number;
  accountName: string;
  /** Active character identity. */
  characterId: number;
  characterName: string;
}

export interface FriendEntry extends SocialUserSummary {
  online: boolean;
  mapId?: string;
  playerId?: string;
  activeCharacterId: number | null;
  activeCharacterName: string | null;
  lastSeenAt: string | null;
}

export interface FriendRequestRecord extends SocialUserSummary {
  createdAt: string;
  requesterCharacterId?: number;
  recipientCharacterId?: number;
}

export interface BlockedAccountEntry {
  accountId: number;
  accountName: string;
}

export interface SocialPrefs {
  allowFriendRequests: boolean;
  allowTeleportRequests: boolean;
  allowChatInvites: boolean;
  /** Privacy toggles (default true, server enforced). */
  showOnlineStatus: boolean;
  showActiveCharacter: boolean;
  showCurrentMap: boolean;
  showLastSeen: boolean;
}

export interface FriendsStatePayload {
  friends: FriendEntry[];
  incoming: FriendRequestRecord[];
  outgoing: FriendRequestRecord[];
  prefs: SocialPrefs;
  /** Blocked accounts (blocking is account-level: all characters). */
  blocked: BlockedAccountEntry[];
}

/** `friends:presence` payload. */
export interface FriendPresencePayload {
  userId: number;
  accountId: number;
  accountName: string;
  online: boolean;
  mapId?: string;
  playerId?: string;
  activeCharacterId: number | null;
  activeCharacterName: string | null;
  lastSeenAt: string | null;
}

export type ChatChannel = 'map' | 'whisper' | 'global' | 'system';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  mapId?: string;
  fromUserId?: number;
  fromUsername?: string;
  fromName?: string;
  fromAccountId?: number;
  fromAccountName?: string;
  fromCharacterId?: number;
  fromCharacterName?: string;
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
  fromAccountId?: number;
  fromAccountName?: string;
  fromCharacterId?: number;
  fromCharacterName?: string;
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
