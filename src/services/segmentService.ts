/**
 * Segment Service
 * 
 * Handles dynamic contact segment management including CRUD operations,
 * segment evaluation, membership, and pre-built templates.
 * 
 * Requirements: 7.1, 7.4 (Contact CRM Evolution)
 */

import { supabase } from '@/lib/supabase'

// Types
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in'

export interface SegmentCondition {
  field: string
  operator: ConditionOperator
  value: unknown
}

export interface SegmentGroup {
  logic: 'AND' | 'OR'
  conditions: (SegmentCondition | SegmentGroup)[]
}

export interface Segment {
  id: string
  name: string
  description: string | null
  conditions: SegmentGroup
  isTemplate: boolean
  templateKey: string | null
  memberCount: number
  lastEvaluatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SegmentTemplate {
  key: string
  name: string
  description: string
  conditions: SegmentGroup
}

export interface SegmentMember {
  id: string
  name: string | null
  phone: string
  leadScore: number
  leadTier: 'cold' | 'warm' | 'hot' | 'vip'
  lifetimeValueCents: number
}

export interface CreateSegmentData {
  name: string
  description?: string
  conditions: SegmentGroup
}

export interface UpdateSegmentData {
  name?: string
  description?: string | null
  conditions?: SegmentGroup
}

export interface SegmentPreview {
  count: number
  sample: SegmentMember[]
}

// Helper to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`
  }
}

// API base URL
const API_BASE = '/api/user/segments'

/**
 * Get all segments
 */
export async function getSegments(): Promise<Segment[]> {
  const headers = await getAuthHeaders()
  const response = await fetch(API_BASE, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch segments')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get segment by ID
 */
export async function getSegment(segmentId: string): Promise<Segment> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/${segmentId}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch segment')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Create a new segment
 */
export async function createSegment(data: CreateSegmentData): Promise<Segment> {
  const headers = await getAuthHeaders()
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create segment')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Update a segment
 */
export async function updateSegment(segmentId: string, data: UpdateSegmentData): Promise<Segment> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/${segmentId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update segment')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Delete a segment
 */
export async function deleteSegment(segmentId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/${segmentId}`, {
    method: 'DELETE',
    headers
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete segment')
  }
}

/**
 * Get segment members
 */
export async function getSegmentMembers(
  segmentId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ data: SegmentMember[]; total: number; page: number; pageSize: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  
  const response = await fetch(`${API_BASE}/${segmentId}/members?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch segment members')
  }
  
  return response.json()
}

/**
 * Re-evaluate segment membership
 */
export async function evaluateSegment(segmentId: string): Promise<{ memberCount: number }> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/${segmentId}/evaluate`, {
    method: 'POST',
    headers
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to evaluate segment')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get pre-built segment templates
 */
export async function getTemplates(): Promise<SegmentTemplate[]> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/templates`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch templates')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Create segment from template
 */
export async function createFromTemplate(templateKey: string): Promise<Segment> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/from-template`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ templateKey })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create segment from template')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Preview segment (evaluate without saving)
 */
export async function previewSegment(conditions: SegmentGroup): Promise<SegmentPreview> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conditions })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to preview segment')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get operator label
 */
export function getOperatorLabel(operator: ConditionOperator): string {
  const labels: Record<ConditionOperator, string> = {
    equals: 'é igual a',
    not_equals: 'é diferente de',
    greater_than: 'é maior que',
    less_than: 'é menor que',
    contains: 'contém',
    in: 'está em',
    not_in: 'não está em'
  }
  return labels[operator] || operator
}

/**
 * Get available fields for segmentation
 */
export function getAvailableFields(): Array<{
  name: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'date'
  operators: ConditionOperator[]
}> {
  return [
    { name: 'lead_score', label: 'Lead Score', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'lead_tier', label: 'Lead Tier', type: 'string', operators: ['equals', 'not_equals', 'in', 'not_in'] },
    { name: 'lifetime_value_cents', label: 'LTV (centavos)', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'purchase_count', label: 'Número de Compras', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'credit_balance', label: 'Saldo de Créditos', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'is_active', label: 'Ativo', type: 'boolean', operators: ['equals'] },
    { name: 'bulk_messaging_opt_in', label: 'Opt-in Mensagens', type: 'boolean', operators: ['equals'] },
    { name: 'created_at', label: 'Data de Criação', type: 'date', operators: ['greater_than', 'less_than'] },
    { name: 'last_interaction_at', label: 'Última Interação', type: 'date', operators: ['greater_than', 'less_than'] },
    { name: 'last_purchase_at', label: 'Última Compra', type: 'date', operators: ['greater_than', 'less_than'] }
  ]
}

/**
 * Create an empty condition
 */
export function createEmptyCondition(): SegmentCondition {
  return {
    field: 'lead_score',
    operator: 'greater_than',
    value: 0
  }
}

/**
 * Create an empty group
 */
export function createEmptyGroup(logic: 'AND' | 'OR' = 'AND'): SegmentGroup {
  return {
    logic,
    conditions: [createEmptyCondition()]
  }
}

/**
 * Validate segment conditions
 */
export function validateConditions(conditions: SegmentGroup): { valid: boolean; error?: string } {
  if (!conditions.logic || !['AND', 'OR'].includes(conditions.logic)) {
    return { valid: false, error: 'Operador lógico inválido' }
  }
  
  if (!conditions.conditions || conditions.conditions.length === 0) {
    return { valid: false, error: 'Pelo menos uma condição é necessária' }
  }
  
  for (const condition of conditions.conditions) {
    if ('logic' in condition) {
      // Nested group
      const result = validateConditions(condition)
      if (!result.valid) return result
    } else {
      // Simple condition
      if (!condition.field) {
        return { valid: false, error: 'Campo é obrigatório em todas as condições' }
      }
      if (!condition.operator) {
        return { valid: false, error: 'Operador é obrigatório em todas as condições' }
      }
    }
  }
  
  return { valid: true }
}
