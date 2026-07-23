export type AdminRolePermission =
  | 'game.access'
  | 'designer.access'
  | 'moderator.access'
  | 'admin.access'

export type AdminUserRole =
  | 'admin'
  | 'designer'
  | 'moderator'
  | 'user'

export type AdminSavedLocation = {
  mapId: string
  x: number
  y: number
}

export type AdminInventoryCategory = 'usable' | 'berries' | 'moves' | 'quest'

export type AdminInventoryItem = {
  id: string
  name: string
  category: AdminInventoryCategory
  quantity: number
  description: string
  /** Root-relative asset path, resolved via assetUrl(). Present on read only. */
  iconSrc?: string
}

export type AdminPokemonSummary = {
  id: string
  sourcePokemonId?: string
  name: string
  nickname?: string
  level: number
  types: string[]
  hp: number
  maxHp: number
  moves: string[]
  movePp?: Record<string, number>
  experience: number
  experienceCurve: 'fast' | 'medium' | 'slow'
  nextLevelExperience: number
  statBonuses: {
    hp: number
    attack: number
    defense: number
    specialAttack: number
    specialDefense: number
    speed: number
  }
  /** Root-relative asset paths, resolved via assetUrl(). Present on read only. */
  iconImageSrc?: string
  frontImageSrc?: string
  ivs?: Record<string, number>
  evs?: Record<string, number>
  status?: { id: string; counter: number } | null
  heldItemId?: string
  heldItemName?: string
  pendingMoveLearns?: string[]
}

export type AdminItemCatalogEntry = {
  id: string
  name: string
  category: AdminInventoryCategory
  description: string
  iconSrc: string
}

export type AdminPokemonCatalogEntry = {
  id: string
  name: string
  types: string[]
  iconImageSrc: string
  hp: number
}

export type AdminMapCatalogEntry = {
  mapId: string
  name: string
  category: string
}

export type AdminCatalogPayload = {
  items: AdminItemCatalogEntry[]
  pokemons: AdminPokemonCatalogEntry[]
  maps: AdminMapCatalogEntry[]
}

export type AdminBattleHistoryEntry = {
  id: string
  battleId: string
  kind: 'wild' | 'trainer'
  opponentName: string
  winnerName: string | null
  loserName: string | null
  result: string
  startedAt: string
  endedAt: string
  log: string[]
}

export type AdminUserSummary = {
  id: number
  name: string
  username: string
  email: string
  emailVerified: boolean
  role: AdminUserRole
  permissions: AdminRolePermission[]
  profileImage: string
  description: string
  trainerGender: string
  money: number
  pokemonCount: number
  inventoryItemCount: number
  inventoryQuantity: number
  battleHistoryCount: number
  createdAt: string
  savedLocation: AdminSavedLocation | null
}

export type AdminUserDetails = {
  id: number
  name: string
  username: string
  email: string
  emailVerified: boolean
  profileImage: string
  description: string
  trainerGender: string
  money: number
  inventory: AdminInventoryItem[]
  pokemonParty: AdminPokemonSummary[]
  battleHistory: AdminBattleHistoryEntry[]
  role: AdminUserRole
  permissions: AdminRolePermission[]
  createdAt: string
  savedLocation: AdminSavedLocation | null
}

export type AdminRoleDefinition = {
  key: AdminUserRole
  name: string
  description: string
  permissions: AdminRolePermission[]
  userCount: number
}

export type ApiKeyScope = 'read' | 'write' | 'admin'

export type ApiKeySummary = {
  id: number
  name: string
  keyPrefix: string
  scopes: ApiKeyScope[]
  createdBy: string | null
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  enabled: boolean
  status: 'active' | 'revoked' | 'disabled' | 'expired'
}

export type CreatedApiKey = {
  key: string
  meta: ApiKeySummary
}

export type AdminEventState = {
  switches: Record<string, boolean>
  variables: Record<string, number>
  selfSwitches: Record<string, boolean>
}

export type AdminStorageBox = {
  id: string
  name: string
  capacity: number
  pokemon: AdminPokemonSummary[]
}

export type AdminTrainerProfile = {
  name: string
  username: string
  description: string
  profileImage: string
  characterSkinId: string
  trainerCardColor: string
  badges: number[]
  money: number
  createdAt: string
}

export type AdminUserStorage = {
  boxes: AdminStorageBox[]
  profile: AdminTrainerProfile
}

export type OnlineMapOverview = {
  mapId: string
  onlinePlayers: number
  players: Array<{
    playerId: string
    userId: number | null
    username: string
    name: string
    x: number
    y: number
    connectedSockets: number
  }>
}
