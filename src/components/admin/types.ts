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

export type AdminInventoryItem = {
  id: string
  name: string
  category: 'usable' | 'berries' | 'moves' | 'quest'
  quantity: number
  description: string
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
