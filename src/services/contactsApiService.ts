/**
 * Contacts API Service
 * 
 * Frontend service for managing contacts via the backend API.
 * Replaces localStorage-based contactsStorageService.
 * 
 * Requirements: 1.1-1.5, 3.1-3.4, 4.1-4.4, 6.1-6.4, 9.1-9.4
 */

import { getCsrfToken } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// ==================== TYPES ====================

export interface Contact {
  id: string;
  tenantId: string;
  accountId: string;
  phone: string;
  name: string | null;
  avatarUrl: string | null;
  whatsappJid: string | null;
  source: 'whatsapp' | 'manual' | 'import';
  sourceInboxId: string | null;
  sourceInbox?: {
    id: string;
    name: string;
    phoneNumber?: string;
  } | null;
  linkedUserId: string | null;
  metadata: Record<string, unknown>;
  lastImportAt: string | null;
  createdBy: string;
  createdByType: 'account' | 'agent';
  updatedBy: string | null;
  updatedByType: 'account' | 'agent' | null;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
  groups?: ContactGroup[];
}

export interface Tag {
  id: string;
  tenantId: string;
  accountId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactGroup {
  id: string;
  tenantId: string;
  accountId: string;
  name: string;
  description: string | null;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboxOption {
  id: string;
  name: string;
  phoneNumber: string;
  isConnected: boolean;
  lastImportAt: string | null;
}

export interface DuplicateSet {
  id: string;
  type: 'exact_phone' | 'similar_phone' | 'similar_name';
  contacts: Contact[];
  similarity: number;
  phone?: string;
  baseName?: string;
}

export interface MergeResult {
  primaryContactId: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;
  preserveTags: boolean;
  preserveGroups: boolean;
}

export interface ContactsQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  tagIds?: string[];
  groupId?: string;
  hasName?: boolean;
  sourceInboxId?: string;
  sortBy?: 'name' | 'phone' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateContactData {
  phone: string;
  name?: string;
  avatarUrl?: string;
  whatsappJid?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateContactData {
  phone?: string;
  name?: string | null;
  avatarUrl?: string | null;
  whatsappJid?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateTagData {
  name: string;
  color?: string;
}

export interface CreateGroupData {
  name: string;
  description?: string;
}

export interface UpdateGroupData {
  name?: string;
  description?: string | null;
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
}

export interface MigrationResult {
  contacts: number;
  tags: number;
  groups: number;
  errors: string[];
}

export interface ContactStats {
  total: number;
  withName: number;
  withoutName: number;
  totalTags: number;
}

export interface LocalStorageData {
  contacts?: Array<{
    phone: string;
    name?: string;
    avatarUrl?: string;
    whatsappJid?: string;
    source?: string;
    metadata?: Record<string, unknown>;
    tagIds?: string[];
    groupIds?: string[];
  }>;
  tags?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  groups?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  total?: number;
  page?: number;
  pageSize?: number;
}

// ==================== API HELPER ====================

/**
 * Get JWT token from Supabase session for API authentication
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('[ContactsAPI] Failed to get auth token:', error);
    return null;
  }
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `/api/user/contacts${endpoint}`;
  
  // Get JWT token for Authorization header
  const authToken = await getAuthToken();
  
  // Get CSRF token for non-GET requests
  const csrfToken = (options.method && options.method !== 'GET') 
    ? await getCsrfToken() 
    : '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...(csrfToken && { 'CSRF-Token': csrfToken }),
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Error: ${response.statusText}`,
        details: data.details
      };
    }

    return data;
  } catch (error) {
    console.error('[ContactsAPI] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// ==================== CONTACTS API ====================

/**
 * Get contacts with pagination and filters
 */
export async function getContacts(
  options: ContactsQueryOptions = {}
): Promise<PaginatedResponse<Contact>> {
  const params = new URLSearchParams();
  
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  if (options.search) params.set('search', options.search);
  if (options.tagIds?.length) params.set('tagIds', options.tagIds.join(','));
  if (options.groupId) params.set('groupId', options.groupId);
  if (options.hasName !== undefined) params.set('hasName', String(options.hasName));
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);

  const queryString = params.toString();
  const endpoint = queryString ? `?${queryString}` : '';

  const response = await apiFetch<Contact[]>(endpoint);

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch contacts');
  }

  return {
    data: response.data || [],
    total: response.total || 0,
    page: response.page || 1,
    pageSize: response.pageSize || 50
  };
}

/**
 * Get contact statistics for the current account
 */
export async function getStats(): Promise<ContactStats> {
  const response = await apiFetch<ContactStats>('/stats');

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch contact stats');
  }

  return response.data || {
    total: 0,
    withName: 0,
    withoutName: 0,
    totalTags: 0
  };
}

/**
 * Get a single contact by ID
 */
export async function getContactById(id: string): Promise<Contact> {
  const response = await apiFetch<Contact>(`/${id}`);

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch contact');
  }

  if (!response.data) {
    throw new Error('Contact not found');
  }

  return response.data;
}

/**
 * Create a new contact
 */
export async function createContact(data: CreateContactData): Promise<Contact> {
  const response = await apiFetch<Contact>('', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create contact');
  }

  if (!response.data) {
    throw new Error('No contact data returned');
  }

  return response.data;
}

/**
 * Update a contact
 */
export async function updateContact(id: string, data: UpdateContactData): Promise<Contact> {
  const response = await apiFetch<Contact>(`/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to update contact');
  }

  if (!response.data) {
    throw new Error('No contact data returned');
  }

  return response.data;
}

/**
 * Delete multiple contacts
 */
export async function deleteContacts(ids: string[]): Promise<void> {
  const response = await apiFetch<{ deleted: number }>('', {
    method: 'DELETE',
    body: JSON.stringify({ ids })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to delete contacts');
  }
}

// ==================== INBOX SELECTION API ====================

/**
 * Get available inboxes for import
 */
export async function getInboxes(): Promise<InboxOption[]> {
  const response = await apiFetch<InboxOption[]>('/inboxes');

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch inboxes');
  }

  return response.data || [];
}

/**
 * Import contacts from a specific inbox
 */
export async function importFromInbox(inboxId: string): Promise<ImportResult> {
  const response = await apiFetch<ImportResult>(`/import/${inboxId}`, {
    method: 'POST'
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to import from inbox');
  }

  return response.data || { added: 0, updated: 0, unchanged: 0 };
}

// ==================== IMPORT & MIGRATION API ====================

/**
 * Import contacts from WhatsApp
 */
export async function importFromWhatsApp(
  contacts: Array<{
    phone: string;
    name?: string;
    avatarUrl?: string;
    whatsappJid?: string;
  }>
): Promise<ImportResult> {
  const response = await apiFetch<ImportResult>('/import', {
    method: 'POST',
    body: JSON.stringify({ contacts })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to import contacts');
  }

  return response.data || { imported: 0, updated: 0, skipped: 0 };
}

/**
 * Migrate contacts from localStorage to database
 */
export async function migrateFromLocalStorage(
  data: LocalStorageData
): Promise<MigrationResult> {
  const response = await apiFetch<MigrationResult>('/migrate', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to migrate contacts');
  }

  return response.data || { contacts: 0, tags: 0, groups: 0, errors: [] };
}

// ==================== DUPLICATES API ====================

/**
 * Get duplicate contact sets
 */
export async function getDuplicates(): Promise<DuplicateSet[]> {
  const response = await apiFetch<DuplicateSet[]>('/duplicates');

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch duplicates');
  }

  return response.data || [];
}

/**
 * Dismiss a duplicate pair as false positive
 */
export async function dismissDuplicate(contactId1: string, contactId2: string): Promise<void> {
  const response = await apiFetch<void>('/duplicates/dismiss', {
    method: 'POST',
    body: JSON.stringify({ contactId1, contactId2 })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to dismiss duplicate');
  }
}

/**
 * Merge duplicate contacts
 */
export async function mergeContacts(
  contactIds: string[],
  mergeData: MergeResult
): Promise<Contact> {
  const response = await apiFetch<Contact>('/merge', {
    method: 'POST',
    body: JSON.stringify({ contactIds, mergeData })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to merge contacts');
  }

  if (!response.data) {
    throw new Error('No merged contact data returned');
  }

  return response.data;
}

// ==================== TAGS API ====================

/**
 * Get all tags for the current account
 */
export async function getTags(): Promise<Tag[]> {
  const response = await apiFetch<Tag[]>('/tags');

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch tags');
  }

  return response.data || [];
}

/**
 * Create a new tag
 */
export async function createTag(data: CreateTagData): Promise<Tag> {
  const response = await apiFetch<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create tag');
  }

  if (!response.data) {
    throw new Error('No tag data returned');
  }

  return response.data;
}

/**
 * Delete a tag
 */
export async function deleteTag(id: string): Promise<void> {
  const response = await apiFetch<void>(`/tags/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to delete tag');
  }
}

/**
 * Assign tags to contacts
 */
export async function addTagsToContacts(
  contactIds: string[],
  tagIds: string[]
): Promise<void> {
  const response = await apiFetch<void>('/tags/assign', {
    method: 'POST',
    body: JSON.stringify({ contactIds, tagIds })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to assign tags');
  }
}

/**
 * Remove tags from contacts
 */
export async function removeTagsFromContacts(
  contactIds: string[],
  tagIds: string[]
): Promise<void> {
  const response = await apiFetch<void>('/tags/remove', {
    method: 'POST',
    body: JSON.stringify({ contactIds, tagIds })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to remove tags');
  }
}

// ==================== GROUPS API ====================

/**
 * Get all groups for the current account
 */
export async function getGroups(): Promise<ContactGroup[]> {
  const response = await apiFetch<ContactGroup[]>('/groups');

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch groups');
  }

  return response.data || [];
}

/**
 * Create a new group
 */
export async function createGroup(data: CreateGroupData): Promise<ContactGroup> {
  const response = await apiFetch<ContactGroup>('/groups', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create group');
  }

  if (!response.data) {
    throw new Error('No group data returned');
  }

  return response.data;
}

/**
 * Update a group
 */
export async function updateGroup(
  id: string,
  data: UpdateGroupData
): Promise<ContactGroup> {
  const response = await apiFetch<ContactGroup>(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to update group');
  }

  if (!response.data) {
    throw new Error('No group data returned');
  }

  return response.data;
}

/**
 * Delete a group
 */
export async function deleteGroup(id: string): Promise<void> {
  const response = await apiFetch<void>(`/groups/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to delete group');
  }
}

/**
 * Add contacts to a group
 */
export async function addContactsToGroup(
  groupId: string,
  contactIds: string[]
): Promise<void> {
  const response = await apiFetch<void>(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ contactIds })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to add contacts to group');
  }
}

/**
 * Remove contacts from a group
 */
export async function removeContactsFromGroup(
  groupId: string,
  contactIds: string[]
): Promise<void> {
  const response = await apiFetch<void>(`/groups/${groupId}/members`, {
    method: 'DELETE',
    body: JSON.stringify({ contactIds })
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to remove contacts from group');
  }
}

// ==================== USER CREATION API ====================

export interface CreateUserFromContactData {
  email: string;
  password?: string;
  role?: string;
}

export interface CreatedUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

/**
 * Create a user from an existing contact
 */
export async function createUserFromContact(
  contactId: string,
  userData: CreateUserFromContactData
): Promise<CreatedUser> {
  const response = await apiFetch<CreatedUser>(`/${contactId}/create-user`, {
    method: 'POST',
    body: JSON.stringify(userData)
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create user from contact');
  }

  if (!response.data) {
    throw new Error('No user data returned');
  }

  return response.data;
}

// ==================== CONVENIENCE EXPORTS ====================

export const contactsApi = {
  // Contacts
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContacts,
  
  // Stats
  getStats,
  
  // Inbox Selection
  getInboxes,
  importFromInbox,
  
  // Import & Migration
  importFromWhatsApp,
  migrateFromLocalStorage,
  
  // Duplicates
  getDuplicates,
  dismissDuplicate,
  mergeContacts,
  
  // Tags
  getTags,
  createTag,
  deleteTag,
  addTagsToContacts,
  removeTagsFromContacts,
  
  // Groups
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addContactsToGroup,
  removeContactsFromGroup,
  
  // User creation
  createUserFromContact
};

export default contactsApi;
