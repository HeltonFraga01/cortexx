/**
 * Custom Field Service
 * 
 * Handles custom field definition management including CRUD operations,
 * field value management, and search by custom fields.
 * 
 * Requirements: 6.1, 6.2 (Contact CRM Evolution)
 */

import { supabase } from '@/lib/supabase'

// Types
export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url' | 'email' | 'phone'

export interface CustomFieldDefinition {
  id: string
  name: string
  label: string
  fieldType: FieldType
  options: string[] | null
  isRequired: boolean
  isSearchable: boolean
  displayOrder: number
  defaultValue: string | null
  validationRules: {
    min?: number
    max?: number
    pattern?: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface CreateFieldData {
  name: string
  label: string
  fieldType: FieldType
  options?: string[]
  isRequired?: boolean
  isSearchable?: boolean
  displayOrder?: number
  defaultValue?: string
  validationRules?: {
    min?: number
    max?: number
    pattern?: string
  }
}

export interface UpdateFieldData {
  label?: string
  options?: string[]
  isRequired?: boolean
  isSearchable?: boolean
  displayOrder?: number
  defaultValue?: string | null
  validationRules?: {
    min?: number
    max?: number
    pattern?: string
  } | null
}

export interface FieldOrderUpdate {
  id: string
  displayOrder: number
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
const API_BASE = '/api/user/custom-fields'

/**
 * Get all custom field definitions
 */
export async function getFieldDefinitions(): Promise<CustomFieldDefinition[]> {
  const headers = await getAuthHeaders()
  const response = await fetch(API_BASE, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch custom fields')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Create a new custom field definition
 */
export async function createField(data: CreateFieldData): Promise<CustomFieldDefinition> {
  const headers = await getAuthHeaders()
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create custom field')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Update a custom field definition
 */
export async function updateField(fieldId: string, data: UpdateFieldData): Promise<CustomFieldDefinition> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/${fieldId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update custom field')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Delete a custom field definition
 */
export async function deleteField(fieldId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/${fieldId}`, {
    method: 'DELETE',
    headers
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete custom field')
  }
}

/**
 * Reorder custom field definitions
 */
export async function reorderFields(order: FieldOrderUpdate[]): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/reorder`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ order })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to reorder custom fields')
  }
}

/**
 * Set a custom field value for a contact
 */
export async function setContactFieldValue(
  contactId: string,
  fieldName: string,
  value: unknown
): Promise<Record<string, unknown>> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/${fieldName}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ value })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to set custom field value')
  }
  
  const result = await response.json()
  return result.data.customFields
}

/**
 * Set multiple custom field values for a contact
 */
export async function setContactFields(
  contactId: string,
  fields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ fields })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to set custom fields')
  }
  
  const result = await response.json()
  return result.data.customFields
}

/**
 * Set multiple custom field values for a contact (alias for setContactFields)
 */
export async function setContactCustomFields(
  contactId: string,
  values: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return setContactFields(contactId, values)
}

/**
 * Search contacts by custom field value
 */
export async function searchByField(
  fieldName: string,
  value: unknown,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ data: unknown[]; total: number; page: number; pageSize: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  params.set('fieldName', fieldName)
  params.set('value', String(value))
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  
  const response = await fetch(`${API_BASE}/search?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to search by custom field')
  }
  
  return response.json()
}

/**
 * Get field type label
 */
export function getFieldTypeLabel(type: FieldType): string {
  const labels: Record<FieldType, string> = {
    text: 'Texto',
    number: 'Número',
    date: 'Data',
    dropdown: 'Lista suspensa',
    checkbox: 'Caixa de seleção',
    url: 'URL',
    email: 'E-mail',
    phone: 'Telefone'
  }
  return labels[type] || type
}

/**
 * Get field type icon name
 */
export function getFieldTypeIcon(type: FieldType): string {
  const icons: Record<FieldType, string> = {
    text: 'Type',
    number: 'Hash',
    date: 'Calendar',
    dropdown: 'ChevronDown',
    checkbox: 'CheckSquare',
    url: 'Link',
    email: 'Mail',
    phone: 'Phone'
  }
  return icons[type] || 'Type'
}

/**
 * Validate field name format
 */
export function validateFieldName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Nome é obrigatório' }
  }
  
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return { 
      valid: false, 
      error: 'Nome deve começar com letra minúscula e conter apenas letras minúsculas, números e underscores' 
    }
  }
  
  return { valid: true }
}

/**
 * Generate field name from label
 */
export function generateFieldName(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '') // Trim underscores
    .replace(/^(\d)/, '_$1') // Prefix with underscore if starts with number
}
