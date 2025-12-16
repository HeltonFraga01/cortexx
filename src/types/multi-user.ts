/**
 * Multi-User System Types
 * 
 * TypeScript interfaces for the multi-user inbox system.
 */

// ==================== ACCOUNT ====================

export interface Account {
  id: string
  name: string
  ownerUserId: string
  wuzapiToken: string
  timezone: string
  locale: string
  status: AccountStatus
  settings: AccountSettings
  createdAt: string
  updatedAt: string
}

export type AccountStatus = 'active' | 'inactive' | 'suspended'

export interface AccountSettings {
  maxAgents?: number
  maxInboxes?: number
  maxTeams?: number
  features?: string[]
}

// ==================== AGENT ====================

export interface Agent {
  id: string
  accountId: string
  email: string
  name: string
  avatarUrl?: string
  role: AgentRole
  customRoleId?: string
  availability: AvailabilityStatus
  status: AgentStatus
  lastActivityAt?: string
  createdAt: string
  updatedAt: string
}

export type AgentRole = 'owner' | 'administrator' | 'agent' | 'viewer'
export type AvailabilityStatus = 'online' | 'busy' | 'offline'
export type AgentStatus = 'active' | 'inactive' | 'pending'

export interface AgentWithPermissions extends Agent {
  permissions: Permission[]
}

// ==================== INVITATION ====================

export interface Invitation {
  id: string
  accountId: string
  email?: string
  token: string
  role: AgentRole
  customRoleId?: string
  expiresAt: string
  usedAt?: string
  createdBy: string
  createdAt: string
}

export interface InvitationValidation {
  valid: boolean
  invitation?: {
    role: AgentRole
    email?: string
    expiresAt: string
  }
  account?: {
    id: string
    name: string
  }
}


// ==================== TEAM ====================

export interface Team {
  id: string
  accountId: string
  name: string
  description?: string
  allowAutoAssign: boolean
  createdAt: string
  updatedAt: string
}

export interface TeamWithStats extends Team {
  memberCount: number
}

export interface TeamWithMembers extends Team {
  members: TeamMember[]
  stats: TeamStats
}

export interface TeamMember {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: AgentRole
  availability: AvailabilityStatus
  status: AgentStatus
  joinedAt: string
}

export interface TeamStats {
  totalMembers: number
  onlineMembers: number
}

// ==================== INBOX ====================

export interface Inbox {
  id: string
  accountId: string
  name: string
  description?: string
  channelType: string
  phoneNumber?: string
  enableAutoAssignment: boolean
  autoAssignmentConfig: AutoAssignmentConfig
  greetingEnabled: boolean
  greetingMessage?: string
  wuzapiToken?: string
  wuzapiUserId?: string
  wuzapiConnected?: boolean
  createdAt: string
  updatedAt: string
}

export interface AutoAssignmentConfig {
  strategy?: 'round_robin' | 'load_balanced' | 'random'
  maxAssignments?: number
  maxConversationsPerAgent?: number | null
}

export interface InboxWithStats extends Inbox {
  memberCount: number
}

export interface InboxWithMembers extends Inbox {
  members: InboxMember[]
}

export interface InboxMember {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: AgentRole
  availability: AvailabilityStatus
  status: AgentStatus
  assignedAt: string
}

// ==================== CUSTOM ROLE ====================

export interface CustomRole {
  id: string
  accountId: string
  name: string
  description?: string
  permissions: Permission[]
  createdAt: string
  updatedAt: string
}

export interface CustomRoleWithUsage extends CustomRole {
  usageCount: number
}

// ==================== PERMISSIONS ====================

export type Permission =
  | 'conversations:view'
  | 'conversations:create'
  | 'conversations:assign'
  | 'conversations:delete'
  | 'messages:send'
  | 'messages:delete'
  | 'contacts:view'
  | 'contacts:create'
  | 'contacts:edit'
  | 'contacts:delete'
  | 'agents:view'
  | 'agents:create'
  | 'agents:edit'
  | 'agents:delete'
  | 'teams:view'
  | 'teams:manage'
  | 'inboxes:view'
  | 'inboxes:manage'
  | 'reports:view'
  | 'settings:view'
  | 'settings:edit'
  | 'webhooks:manage'
  | 'integrations:manage'

export interface DefaultRole {
  name: AgentRole
  permissions: Permission[] | ['*']
  isDefault: true
}

export interface RolesResponse {
  defaultRoles: DefaultRole[]
  customRoles: CustomRole[]
  availablePermissions: Permission[]
}

// ==================== SESSION ====================

export interface AgentSession {
  id: string
  agentId: string
  accountId: string
  token: string
  ipAddress?: string
  userAgent?: string
  expiresAt: string
  createdAt: string
  lastActivityAt: string
}

// ==================== AUDIT LOG ====================

export interface AuditLog {
  id: string
  accountId: string
  agentId?: string
  action: string
  resourceType: string
  resourceId?: string
  details: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface AuditLogPagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface AuditLogResponse {
  logs: AuditLog[]
  pagination: AuditLogPagination
}

// ==================== DTOs ====================

export interface CreateAgentDTO {
  email: string
  password: string
  name: string
  role?: AgentRole
  avatarUrl?: string
  customRoleId?: string
}

export interface UpdateAgentDTO {
  name?: string
  avatarUrl?: string
  availability?: AvailabilityStatus
}

export interface CreateInvitationDTO {
  email?: string
  role?: AgentRole
  customRoleId?: string
}

export interface RegisterAgentDTO {
  email: string
  password: string
  name: string
  avatarUrl?: string
}

export interface CreateTeamDTO {
  name: string
  description?: string
  allowAutoAssign?: boolean
}

export interface UpdateTeamDTO {
  name?: string
  description?: string
  allowAutoAssign?: boolean
}

export interface WuzapiConfig {
  webhook?: string
  events?: string
  history?: number
}

export interface CreateInboxDTO {
  name: string
  description?: string
  channelType?: string
  phoneNumber?: string
  enableAutoAssignment?: boolean
  autoAssignmentConfig?: AutoAssignmentConfig
  greetingEnabled?: boolean
  greetingMessage?: string
  wuzapiConfig?: WuzapiConfig
}

export interface UpdateInboxDTO {
  name?: string
  description?: string
  phoneNumber?: string
  enableAutoAssignment?: boolean
  autoAssignmentConfig?: AutoAssignmentConfig
  greetingEnabled?: boolean
  greetingMessage?: string
}

export interface CreateCustomRoleDTO {
  name: string
  description?: string
  permissions: Permission[]
}

export interface UpdateCustomRoleDTO {
  name?: string
  description?: string
  permissions?: Permission[]
}

export interface LoginDTO {
  accountId: string
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  expiresAt: string
  agent: Agent
  account: {
    id: string
    name: string
  }
  permissions: Permission[]
}

export interface ChangePasswordDTO {
  currentPassword: string
  newPassword: string
}

// ==================== QUERY FILTERS ====================

export interface AgentFilters {
  status?: AgentStatus
  role?: AgentRole
  availability?: AvailabilityStatus
  limit?: number
  offset?: number
}

export interface AuditLogFilters {
  agentId?: string
  action?: string
  resourceType?: string
  resourceId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface InvitationFilters {
  status?: 'pending' | 'used' | 'expired'
}


// ==================== AGENT PERMISSIONS MANAGEMENT ====================

export interface DatabaseAccessConfig {
  connectionId: string
  accessLevel: DatabaseAccessLevel
}

export type DatabaseAccessLevel = 'none' | 'view' | 'full'

export interface AgentWithDetails extends Agent {
  teams: Team[]
  inboxes: Inbox[]
  databaseAccess: DatabaseAccessConfig[]
  permissions: Permission[]
}

export interface AgentDetailsResponse {
  agent: Agent
  teams: Team[]
  inboxes: Inbox[]
  databaseAccess: DatabaseAccessConfig[]
  permissions: Permission[]
}

export interface AgentUpdates {
  name?: string
  avatarUrl?: string
  availability?: AvailabilityStatus
  role?: AgentRole
  customRoleId?: string | null
  teamIds?: string[]
  inboxIds?: string[]
  databaseAccess?: DatabaseAccessConfig[]
  permissions?: Permission[]
}

export interface AgentInlineEditorProps {
  agent: Agent
  teams: Team[]
  inboxes: Inbox[]
  databaseConnections: DatabaseConnection[]
  customRoles: CustomRole[]
  onSave: (updates: AgentUpdates) => Promise<void>
  onCancel: () => void
  isExpanded: boolean
}

export interface DatabaseConnection {
  id: string
  name: string
  type: string
  baseUrl?: string
  tableName?: string
}

export interface AgentSummaryBadgesProps {
  agent: AgentWithDetails
  onTeamClick?: () => void
  onInboxClick?: () => void
  onDatabaseClick?: () => void
}

// ==================== BULK OPERATIONS ====================

export type BulkActionType = 
  | 'addTeams' 
  | 'removeTeams' 
  | 'addInboxes' 
  | 'removeInboxes' 
  | 'setRole' 
  | 'setDatabaseAccess'

export interface BulkActionRequest {
  agentIds: string[]
  action: BulkActionType
  data: BulkActionData
}

export interface BulkActionData {
  teamIds?: string[]
  inboxIds?: string[]
  role?: AgentRole
  customRoleId?: string | null
  databaseAccess?: DatabaseAccessConfig[]
}

export interface BulkActionResult {
  success: boolean
  updatedCount: number
  errors?: string[]
}

// ==================== PERMISSION VALIDATION ====================

export interface PermissionValidationResult {
  allowed: boolean
  reason?: string
  deniedPermissions?: Permission[]
  escalatedPermissions?: Permission[]
}

export interface PermissionConflictResult {
  hasConflicts: boolean
  conflicts: string[]
}

export interface ActiveSessionsImpact {
  hasActiveSessions: boolean
  sessionCount: number
}

// ==================== UPDATE DTOs ====================

export interface UpdateAgentTeamsDTO {
  teamIds: string[]
}

export interface UpdateAgentInboxesDTO {
  inboxIds: string[]
}

export interface UpdateAgentDatabaseAccessDTO {
  access: DatabaseAccessConfig[]
}

export interface UpdateAgentPermissionsDTO {
  role?: AgentRole
  customRoleId?: string | null
  permissions?: Permission[]
}
