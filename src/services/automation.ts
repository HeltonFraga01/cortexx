/**
 * Automation Service - API client for admin automation endpoints
 */

import type {
  GlobalSettings,
  BotTemplate,
  BotTemplateInput,
  DefaultLabel,
  DefaultLabelInput,
  DefaultCannedResponse,
  DefaultCannedResponseInput,
  AuditLogFilters,
  PaginatedAuditLog,
  AutomationStatistics,
  ConfigurationExport,
  ValidationResult,
  ImportResult,
  BulkApplyInput,
  BulkResult,
  ApiResponse
} from '@/types/automation';
import { getCsrfToken } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const API_BASE = '/api/admin/automation';

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
  return data.data;
}

// Helper to get auth headers with JWT token
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.warn('Failed to get Supabase session:', error);
  }
  
  return headers;
}

// Helper to get headers with CSRF token for mutating requests
async function getMutatingHeaders(): Promise<HeadersInit> {
  const csrfToken = await getCsrfToken();
  const authHeaders = await getAuthHeaders();
  return {
    ...authHeaders,
    ...(csrfToken && { 'CSRF-Token': csrfToken })
  };
}

// ==================== Global Settings ====================

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const response = await fetch(`${API_BASE}/settings`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<GlobalSettings>(response);
}

export async function updateGlobalSettings(settings: Partial<GlobalSettings>): Promise<GlobalSettings> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(settings)
  });
  return handleResponse<GlobalSettings>(response);
}

// ==================== Bot Templates ====================

export async function getBotTemplates(): Promise<BotTemplate[]> {
  const response = await fetch(`${API_BASE}/bot-templates`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<BotTemplate[]>(response);
}

export async function createBotTemplate(data: BotTemplateInput): Promise<BotTemplate> {
  const response = await fetch(`${API_BASE}/bot-templates`, {
    method: 'POST',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return handleResponse<BotTemplate>(response);
}

export async function updateBotTemplate(id: number, data: Partial<BotTemplateInput>): Promise<BotTemplate> {
  const response = await fetch(`${API_BASE}/bot-templates/${id}`, {
    method: 'PUT',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return handleResponse<BotTemplate>(response);
}

export async function deleteBotTemplate(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/bot-templates/${id}`, {
    method: 'DELETE',
    headers: await getMutatingHeaders(),
    credentials: 'include'
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
}

export async function setDefaultBotTemplate(id: number): Promise<BotTemplate> {
  const response = await fetch(`${API_BASE}/bot-templates/${id}/set-default`, {
    method: 'POST',
    headers: await getMutatingHeaders(),
    credentials: 'include'
  });
  return handleResponse<BotTemplate>(response);
}

// ==================== Chatwoot Users & Inboxes ====================

export interface ChatwootUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accountId: string;
}

export interface ChatwootInbox {
  id: string;
  name: string;
  channelType: string;
  accountId: string;
}

export async function getChatwootUsers(): Promise<ChatwootUser[]> {
  const response = await fetch(`${API_BASE}/chatwoot-users`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<ChatwootUser[]>(response);
}

export async function getChatwootInboxes(): Promise<ChatwootInbox[]> {
  const response = await fetch(`${API_BASE}/chatwoot-inboxes`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<ChatwootInbox[]>(response);
}

// ==================== Default Labels ====================

export async function getDefaultLabels(): Promise<DefaultLabel[]> {
  const response = await fetch(`${API_BASE}/default-labels`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<DefaultLabel[]>(response);
}

export async function createDefaultLabel(data: DefaultLabelInput): Promise<DefaultLabel> {
  const response = await fetch(`${API_BASE}/default-labels`, {
    method: 'POST',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return handleResponse<DefaultLabel>(response);
}

export async function updateDefaultLabel(id: number, data: Partial<DefaultLabelInput>): Promise<DefaultLabel> {
  const response = await fetch(`${API_BASE}/default-labels/${id}`, {
    method: 'PUT',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return handleResponse<DefaultLabel>(response);
}

export async function deleteDefaultLabel(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/default-labels/${id}`, {
    method: 'DELETE',
    headers: await getMutatingHeaders(),
    credentials: 'include'
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
}

// ==================== Default Canned Responses ====================

export async function getDefaultCannedResponses(): Promise<DefaultCannedResponse[]> {
  const response = await fetch(`${API_BASE}/default-canned-responses`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<DefaultCannedResponse[]>(response);
}

export async function createDefaultCannedResponse(data: DefaultCannedResponseInput): Promise<DefaultCannedResponse> {
  const response = await fetch(`${API_BASE}/default-canned-responses`, {
    method: 'POST',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return handleResponse<DefaultCannedResponse>(response);
}

export async function updateDefaultCannedResponse(id: number, data: Partial<DefaultCannedResponseInput>): Promise<DefaultCannedResponse> {
  const response = await fetch(`${API_BASE}/default-canned-responses/${id}`, {
    method: 'PUT',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return handleResponse<DefaultCannedResponse>(response);
}

export async function deleteDefaultCannedResponse(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/default-canned-responses/${id}`, {
    method: 'DELETE',
    headers: await getMutatingHeaders(),
    credentials: 'include'
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
}

// ==================== Audit Log & Statistics ====================

export async function getAuditLog(
  filters: AuditLogFilters = {},
  pagination: { limit?: number; offset?: number } = {}
): Promise<PaginatedAuditLog> {
  const params = new URLSearchParams();
  
  if (filters.userId) params.append('userId', filters.userId);
  if (filters.automationType) params.append('automationType', filters.automationType);
  if (filters.status) params.append('status', filters.status);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (pagination.limit) params.append('limit', String(pagination.limit));
  if (pagination.offset) params.append('offset', String(pagination.offset));

  const response = await fetch(`${API_BASE}/audit-log?${params}`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<PaginatedAuditLog>(response);
}

export async function getStatistics(dateRange?: { startDate?: string; endDate?: string }): Promise<AutomationStatistics> {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
  if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

  const response = await fetch(`${API_BASE}/statistics?${params}`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse<AutomationStatistics>(response);
}

// ==================== Bulk Actions ====================

export async function bulkApply(data: BulkApplyInput): Promise<BulkResult> {
  const response = await fetch(`${API_BASE}/bulk-apply`, {
    method: 'POST',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return handleResponse<BulkResult>(response);
}

// ==================== Export/Import ====================

export async function exportConfiguration(): Promise<ConfigurationExport> {
  const response = await fetch(`${API_BASE}/export`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

export async function validateImport(config: unknown): Promise<ValidationResult> {
  const response = await fetch(`${API_BASE}/validate-import`, {
    method: 'POST',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(config)
  });
  return handleResponse<ValidationResult>(response);
}

export async function importConfiguration(config: ConfigurationExport): Promise<ImportResult> {
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: await getMutatingHeaders(),
    credentials: 'include',
    body: JSON.stringify(config)
  });
  return handleResponse<ImportResult>(response);
}

// Export all functions as a service object
export const automationService = {
  getGlobalSettings,
  updateGlobalSettings,
  getBotTemplates,
  createBotTemplate,
  updateBotTemplate,
  deleteBotTemplate,
  setDefaultBotTemplate,
  getChatwootUsers,
  getChatwootInboxes,
  getDefaultLabels,
  createDefaultLabel,
  updateDefaultLabel,
  deleteDefaultLabel,
  getDefaultCannedResponses,
  createDefaultCannedResponse,
  updateDefaultCannedResponse,
  deleteDefaultCannedResponse,
  getAuditLog,
  getStatistics,
  bulkApply,
  exportConfiguration,
  validateImport,
  importConfiguration
};
