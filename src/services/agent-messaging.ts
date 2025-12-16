/**
 * Agent Messaging Service
 * 
 * API client for agent messaging endpoints - uses Bearer token authentication.
 * Messages are sent using the owner's quota.
 */

import { getAgentToken } from './agent-auth'

const API_BASE = ''

// Helper to get request options with agent token
function getRequestOptions(): RequestInit {
  const token = getAgentToken()
  return {
    headers: token ? { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  }
}

// Helper to get request options with CSRF token
async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const token = getAgentToken()
  let csrfToken: string | null = null
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include'
    })
    const data = await response.json()
    csrfToken = data.csrfToken
  } catch (error) {
    console.error('Failed to get CSRF token:', error)
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }
  
  return {
    headers,
    credentials: 'include'
  }
}

// ==================== Types ====================

export interface AgentInbox {
  id: string
  name: string
  phoneNumber: string
  connected: boolean
  wuzapiToken?: string
}

export interface QuotaInfo {
  daily: {
    limit: number
    used: number
    remaining: number
  }
  monthly: {
    limit: number
    used: number
    remaining: number
  }
}

export interface SendTextMessageData {
  Phone: string
  Body: string
  inboxId: string
  variables?: Record<string, string>
}

export interface SendImageMessageData {
  Phone: string
  Image: string
  Caption?: string
  inboxId: string
}

export interface SendDocumentMessageData {
  Phone: string
  Document: string
  FileName?: string
  Caption?: string
  inboxId: string
}

export interface SendAudioMessageData {
  Phone: string
  Audio: string
  inboxId: string
}

export interface SendMessageResponse {
  success: boolean
  message?: string
  data?: unknown
  error?: string
}

// ==================== API Functions ====================

/**
 * Get agent's available inboxes for messaging
 */
export async function getAgentInboxes(): Promise<AgentInbox[]> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/inboxes`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar caixas de entrada')
  }
  
  return result.data || []
}

/**
 * Get owner's quota info
 */
export async function getAgentQuota(): Promise<QuotaInfo> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/quota`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar informações de quota')
  }
  
  return result.data
}

/**
 * Send a text message
 */
export async function sendAgentTextMessage(data: SendTextMessageData): Promise<SendMessageResponse> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/send/text`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Falha ao enviar mensagem')
  }
  
  return result
}

/**
 * Send an image message
 */
export async function sendAgentImageMessage(data: SendImageMessageData): Promise<SendMessageResponse> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/send/image`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Falha ao enviar imagem')
  }
  
  return result
}

/**
 * Send a document message
 */
export async function sendAgentDocumentMessage(data: SendDocumentMessageData): Promise<SendMessageResponse> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/send/document`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Falha ao enviar documento')
  }
  
  return result
}

/**
 * Send an audio message
 */
export async function sendAgentAudioMessage(data: SendAudioMessageData): Promise<SendMessageResponse> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/send/audio`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Falha ao enviar áudio')
  }
  
  return result
}


// ==================== Template Types ====================

export interface AgentTemplate {
  id: string
  agentId: string
  accountId: string
  name: string
  content: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateData {
  name: string
  content: string
  config?: Record<string, unknown>
}

export interface UpdateTemplateData {
  name?: string
  content?: string
  config?: Record<string, unknown>
}

// ==================== Campaign Types ====================

export interface CampaignContact {
  phone: string
  name?: string
  variables?: Record<string, string>
}

export interface HumanizationConfig {
  minDelay?: number
  maxDelay?: number
  randomize?: boolean
}

export interface ScheduleConfig {
  scheduledAt?: string
  sendingWindow?: {
    days?: number[]
    startHour?: number
    endHour?: number
  }
}

export interface CampaignMessage {
  content: string
  type?: 'text' | 'image' | 'document' | 'audio'
}

export interface CreateCampaignData {
  name: string
  inboxId: string
  messages: CampaignMessage[]
  contacts: CampaignContact[]
  humanization?: {
    delayMin?: number
    delayMax?: number
    randomizeOrder?: boolean
  }
  schedule?: {
    scheduledAt?: string
    sendingWindow?: {
      startTime?: string
      endTime?: string
      days?: number[]
    }
  }
}

export interface AgentCampaign {
  id: string
  agentId: string
  accountId: string
  inboxId: string
  name: string
  status: 'pending' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  totalContacts: number
  sentCount: number
  failedCount: number
  currentPosition: number
  config: {
    messages: CampaignMessage[]
    humanization: HumanizationConfig
    schedule?: ScheduleConfig
  }
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  progress: number
  contacts?: AgentCampaignContact[]
}

export interface AgentCampaignContact {
  id: string
  campaignId: string
  phone: string
  name?: string
  variables: Record<string, string>
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sentAt?: string
  errorMessage?: string
  messageId?: string
  createdAt: string
}

// ==================== Report Types ====================

export interface AgentReport extends AgentCampaign {
  deliveryRate: number
}

// ==================== Draft Types ====================

export interface AgentDraft {
  data: {
    sendType?: string
    recipients?: CampaignContact[]
    messages?: CampaignMessage[]
    humanization?: HumanizationConfig
    schedule?: ScheduleConfig
    inboxId?: string
  }
  updatedAt: string
}

// ==================== Template API Functions ====================

/**
 * Get agent's templates
 */
export async function getAgentTemplates(): Promise<AgentTemplate[]> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/templates`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar templates')
  }
  
  return result.data || []
}

/**
 * Create a new template
 */
export async function createAgentTemplate(data: CreateTemplateData): Promise<AgentTemplate> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/templates`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao criar template')
  }
  
  return result.data
}

/**
 * Get a single template
 */
export async function getAgentTemplate(templateId: string): Promise<AgentTemplate> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/templates/${templateId}`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar template')
  }
  
  return result.data
}

/**
 * Update a template
 */
export async function updateAgentTemplate(templateId: string, data: UpdateTemplateData): Promise<AgentTemplate> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/templates/${templateId}`, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atualizar template')
  }
  
  return result.data
}

/**
 * Delete a template
 */
export async function deleteAgentTemplate(templateId: string): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/templates/${templateId}`, {
    ...options,
    method: 'DELETE'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao excluir template')
  }
}

// ==================== Campaign API Functions ====================

/**
 * Create a new campaign
 */
export async function createAgentCampaign(data: CreateCampaignData): Promise<AgentCampaign> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/campaigns`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Falha ao criar campanha')
  }
  
  return result.data
}

/**
 * Get agent's campaigns
 */
export async function getAgentCampaigns(filters?: {
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
}): Promise<AgentCampaign[]> {
  const options = getRequestOptions()
  const params = new URLSearchParams()
  if (filters?.status) params.append('status', filters.status)
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  if (filters?.limit) params.append('limit', String(filters.limit))
  
  const url = `${API_BASE}/api/agent/messaging/campaigns${params.toString() ? '?' + params.toString() : ''}`
  const response = await fetch(url, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar campanhas')
  }
  
  return result.data || []
}

/**
 * Get a single campaign with contacts
 */
export async function getAgentCampaign(campaignId: string): Promise<AgentCampaign> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/campaigns/${campaignId}`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar campanha')
  }
  
  return result.data
}

/**
 * Start a campaign
 */
export async function startAgentCampaign(campaignId: string): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/campaigns/${campaignId}/start`, {
    ...options,
    method: 'POST'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao iniciar campanha')
  }
}

/**
 * Pause a campaign
 */
export async function pauseAgentCampaign(campaignId: string): Promise<AgentCampaign> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/campaigns/${campaignId}/pause`, {
    ...options,
    method: 'PUT'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao pausar campanha')
  }
  
  return result.data
}

/**
 * Resume a campaign
 */
export async function resumeAgentCampaign(campaignId: string): Promise<AgentCampaign> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/campaigns/${campaignId}/resume`, {
    ...options,
    method: 'PUT'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao retomar campanha')
  }
  
  return result.data
}

/**
 * Cancel a campaign
 */
export async function cancelAgentCampaign(campaignId: string): Promise<AgentCampaign> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/campaigns/${campaignId}/cancel`, {
    ...options,
    method: 'PUT'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao cancelar campanha')
  }
  
  return result.data
}

// ==================== Report API Functions ====================

/**
 * Get agent's reports (completed campaigns)
 */
export async function getAgentReports(filters?: {
  startDate?: string
  endDate?: string
}): Promise<AgentReport[]> {
  const options = getRequestOptions()
  const params = new URLSearchParams()
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  
  const url = `${API_BASE}/api/agent/messaging/reports${params.toString() ? '?' + params.toString() : ''}`
  const response = await fetch(url, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar relatórios')
  }
  
  return result.data || []
}

/**
 * Get a single report with contacts
 */
export async function getAgentReport(reportId: string): Promise<AgentReport> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/reports/${reportId}`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar relatório')
  }
  
  return result.data
}

/**
 * Export report as CSV (returns blob URL)
 */
export async function exportAgentReport(reportId: string): Promise<string> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/reports/${reportId}/export`, options)
  
  if (!response.ok) {
    const result = await response.json()
    throw new Error(result.error || 'Falha ao exportar relatório')
  }
  
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

// ==================== Draft API Functions ====================

/**
 * Save a draft
 */
export async function saveAgentDraft(data: AgentDraft['data']): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/drafts`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({ data })
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao salvar rascunho')
  }
}

/**
 * Load a draft
 */
export async function loadAgentDraft(): Promise<AgentDraft | null> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/messaging/drafts`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar rascunho')
  }
  
  return result.data
}

/**
 * Clear a draft
 */
export async function clearAgentDraft(): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/messaging/drafts`, {
    ...options,
    method: 'DELETE'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao limpar rascunho')
  }
}
