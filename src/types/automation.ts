/**
 * TypeScript types for Admin Automation Tools
 */

// Global Settings
export interface AutomationsEnabled {
  bot: boolean;
  labels: boolean;
  cannedResponses: boolean;
  webhooks: boolean;
}

export interface GlobalSettings {
  automationsEnabled: AutomationsEnabled;
  defaultBotTemplateId: number | null;
  defaultWebhookUrl: string | null;
  defaultWebhookEvents: string[];
  auditLogRetentionDays: number;
}

// Bot Template Inbox Assignment
export interface InboxAssignment {
  userId: string;
  userName?: string;
  inboxId: string;
  inboxName?: string;
}

// Bot Template
export interface BotTemplate {
  id: number;
  name: string;
  description: string | null;
  outgoingUrl: string;
  includeHistory: boolean;
  isDefault: boolean;
  // Legacy single assignment (for backward compatibility)
  chatwootUserId: string | null;
  chatwootInboxId: string | null;
  // New multiple assignments
  inboxAssignments?: InboxAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface BotTemplateInput {
  name: string;
  description?: string;
  outgoingUrl: string;
  includeHistory?: boolean;
  // Legacy single assignment (for backward compatibility)
  chatwootUserId?: string | null;
  chatwootInboxId?: string | null;
  // New multiple assignments
  inboxAssignments?: InboxAssignment[];
}

// Chatwoot User (Agent) for selection
export interface ChatwootUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accountId: string;
}

// Chatwoot Inbox for selection
export interface ChatwootInbox {
  id: string;
  name: string;
  channelType: string;
  accountId: string;
}

// Default Label
export interface DefaultLabel {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DefaultLabelInput {
  name: string;
  color: string;
  sortOrder?: number;
}

// Default Canned Response
export interface DefaultCannedResponse {
  id: number;
  shortcut: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DefaultCannedResponseInput {
  shortcut: string;
  content: string;
  sortOrder?: number;
}

// Audit Log
export type AutomationType = 'bot' | 'labels' | 'canned_responses' | 'webhooks' | 'quotas';
export type AuditLogStatus = 'success' | 'failed';

export interface AuditLogEntry {
  id: number;
  userId: string;
  automationType: AutomationType;
  details: Record<string, unknown> | null;
  status: AuditLogStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  userId?: string;
  automationType?: AutomationType;
  status?: AuditLogStatus;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedAuditLog {
  entries: AuditLogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Statistics
export interface AutomationTypeStats {
  total: number;
  success: number;
  failed: number;
}

export interface AutomationStatistics {
  totalAutomations: number;
  successCount: number;
  failureCount: number;
  successRate: string;
  byType: Record<string, AutomationTypeStats>;
  recentFailures: AuditLogEntry[];
}

// Configuration Export/Import
export interface ConfigurationExport {
  version: string;
  exportedAt: string;
  globalSettings: GlobalSettings;
  botTemplates: BotTemplate[];
  defaultLabels: DefaultLabel[];
  defaultCannedResponses: DefaultCannedResponse[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ImportResult {
  globalSettings: boolean;
  botTemplates: { imported: number; skipped: number };
  defaultLabels: { imported: number; skipped: number };
  defaultCannedResponses: { imported: number; skipped: number };
}

// Bulk Actions
export interface BulkApplyInput {
  userIds: string[];
  automationTypes?: string[];
}

export interface BulkResult {
  totalUsers: number;
  successCount: number;
  failureCount: number;
  failures: { userId: string; error: string }[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
