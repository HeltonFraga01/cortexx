/**
 * useContacts Hook
 * 
 * Hook principal para gerenciamento de contatos.
 * Usa API backend com Supabase para persistência.
 * Detecta e oferece migração de dados do localStorage.
 * 
 * Requirements: 1.5, 6.1, 6.2, 6.3, 6.4, 8.4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  contactsApi,
  Contact,
  Tag,
  ContactGroup,
  ContactsQueryOptions,
  PaginatedResponse,
  CreateContactData,
  UpdateContactData,
  CreateTagData,
  CreateGroupData,
  UpdateGroupData,
  LocalStorageData,
  MigrationResult,
  ContactStats,
  DuplicateSet,
  MergeResult
} from '@/services/contactsApiService';

// Re-export types for consumers
export type { Contact, Tag, ContactGroup, ContactsQueryOptions, PaginatedResponse, ContactStats, DuplicateSet, MergeResult };

// localStorage keys for migration detection
const STORAGE_KEYS = {
  CONTACTS: 'wuzapi_contacts',
  TAGS: 'wuzapi_tags',
  GROUPS: 'wuzapi_groups',
};

interface UseContactsOptions {
  autoLoad?: boolean;
  pageSize?: number;
}

interface UseContactsReturn {
  // Data
  contacts: Contact[];
  tags: Tag[];
  groups: ContactGroup[];
  stats: ContactStats;
  inboxes: Array<{ id: string; name: string; phoneNumber?: string }>;
  
  // Pagination
  total: number;
  page: number;
  pageSize: number;
  
  // State
  loading: boolean;
  error: string | null;
  
  // Migration
  hasLocalStorageData: boolean;
  migrationPending: boolean;
  migrateFromLocalStorage: () => Promise<MigrationResult>;
  dismissMigration: () => void;
  
  // Contacts CRUD
  loadContacts: (options?: ContactsQueryOptions) => Promise<void>;
  createContact: (data: CreateContactData) => Promise<Contact>;
  updateContact: (id: string, updates: UpdateContactData) => Promise<Contact>;
  deleteContacts: (ids: string[]) => Promise<void>;
  
  // Import
  importContacts: (contacts: Array<{ phone: string; name?: string; avatarUrl?: string; whatsappJid?: string }>) => Promise<void>;
  
  // Duplicates
  duplicates: DuplicateSet[];
  duplicatesLoading: boolean;
  loadDuplicates: () => Promise<void>;
  dismissDuplicate: (contactId1: string, contactId2: string) => Promise<void>;
  mergeContacts: (contactIds: string[], mergeData: MergeResult) => Promise<Contact>;
  
  // Tags
  loadTags: () => Promise<void>;
  addTag: (data: CreateTagData) => Promise<Tag>;
  removeTag: (tagId: string) => Promise<void>;
  addTagsToContacts: (contactIds: string[], tagIds: string[]) => Promise<void>;
  removeTagsFromContacts: (contactIds: string[], tagIds: string[]) => Promise<void>;
  
  // Groups
  loadGroups: () => Promise<void>;
  createGroup: (data: CreateGroupData) => Promise<ContactGroup>;
  updateGroup: (groupId: string, updates: UpdateGroupData) => Promise<ContactGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  addContactsToGroup: (groupId: string, contactIds: string[]) => Promise<void>;
  removeContactsFromGroup: (groupId: string, contactIds: string[]) => Promise<void>;
  
  // Inboxes
  loadInboxes: () => Promise<void>;
  
  // Stats
  loadStats: () => Promise<void>;
  
  // Refresh
  refreshContacts: () => Promise<void>;
}

/**
 * Check if there's data in localStorage that needs migration
 */
function checkLocalStorageData(): LocalStorageData | null {
  try {
    const contactsRaw = localStorage.getItem(STORAGE_KEYS.CONTACTS);
    const tagsRaw = localStorage.getItem(STORAGE_KEYS.TAGS);
    const groupsRaw = localStorage.getItem(STORAGE_KEYS.GROUPS);

    if (!contactsRaw && !tagsRaw && !groupsRaw) {
      return null;
    }

    const data: LocalStorageData = {};

    if (contactsRaw) {
      const parsed = JSON.parse(contactsRaw);
      if (parsed.contacts?.length > 0) {
        data.contacts = parsed.contacts.map((c: Record<string, unknown>) => ({
          phone: c.phone as string,
          name: c.name as string | undefined,
          avatarUrl: c.avatarUrl as string | undefined,
          whatsappJid: c.whatsappJid as string | undefined,
          source: c.source as string | undefined,
          metadata: c.variables as Record<string, unknown> | undefined,
        }));
      }
    }

    if (tagsRaw) {
      const parsed = JSON.parse(tagsRaw);
      if (parsed.tags?.length > 0) {
        data.tags = parsed.tags.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          name: t.name as string,
          color: t.color as string | undefined,
        }));
      }
    }

    if (groupsRaw) {
      const parsed = JSON.parse(groupsRaw);
      if (parsed.groups?.length > 0) {
        data.groups = parsed.groups.map((g: Record<string, unknown>) => ({
          id: g.id as string,
          name: g.name as string,
          description: g.description as string | undefined,
        }));
      }
    }

    // Return null if no actual data
    if (!data.contacts?.length && !data.tags?.length && !data.groups?.length) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Clear localStorage after successful migration
 */
function clearLocalStorageData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONTACTS);
    localStorage.removeItem(STORAGE_KEYS.TAGS);
    localStorage.removeItem(STORAGE_KEYS.GROUPS);
    localStorage.removeItem('wuzapi_contacts_metadata');
    localStorage.removeItem('wuzapi_contacts_preferences');
    localStorage.removeItem('wuzapi_last_import');
    localStorage.removeItem('wuzapi_contacts_by_instance');
  } catch {
    // Ignore errors
  }
}

export function useContacts(options: UseContactsOptions = {}): UseContactsReturn {
  const { autoLoad = true, pageSize: defaultPageSize = 50 } = options;

  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [inboxes, setInboxes] = useState<Array<{ id: string; name: string; phoneNumber?: string }>>([]);
  const [stats, setStats] = useState<ContactStats>({
    total: 0,
    withName: 0,
    withoutName: 0,
    totalTags: 0
  });

  // Duplicates state
  const [duplicates, setDuplicates] = useState<DuplicateSet[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);

  // Pagination state
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Loading/error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Migration state
  const [localStorageData, setLocalStorageData] = useState<LocalStorageData | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [migrationDismissed, setMigrationDismissed] = useState(false);

  // Track if initial load has happened
  const initialLoadDone = useRef(false);

  // Check for localStorage data on mount
  useEffect(() => {
    const data = checkLocalStorageData();
    if (data) {
      setLocalStorageData(data);
      setMigrationPending(true);
    }
  }, []);

  // Load contacts from API
  const loadContacts = useCallback(async (queryOptions: ContactsQueryOptions = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await contactsApi.getContacts({
        page: queryOptions.page || page,
        pageSize: queryOptions.pageSize || pageSize,
        ...queryOptions
      });

      setContacts(response.data);
      setTotal(response.total);
      setPage(response.page);
      setPageSize(response.pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar contatos';
      setError(message);
      toast.error('Erro ao carregar contatos', { description: message });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  // Load tags from API
  const loadTags = useCallback(async () => {
    try {
      const data = await contactsApi.getTags();
      setTags(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar tags';
      toast.error('Erro ao carregar tags', { description: message });
    }
  }, []);

  // Load groups from API
  const loadGroups = useCallback(async () => {
    try {
      const data = await contactsApi.getGroups();
      setGroups(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar grupos';
      toast.error('Erro ao carregar grupos', { description: message });
    }
  }, []);

  // Load inboxes from API
  const loadInboxes = useCallback(async () => {
    try {
      const data = await contactsApi.getInboxes();
      setInboxes(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar inboxes';
      toast.error('Erro ao carregar inboxes', { description: message });
    }
  }, []);

  // Load stats from API
  const loadStats = useCallback(async () => {
    try {
      const data = await contactsApi.getStats();
      setStats(data);
    } catch (err) {
      // Silently fail - stats are not critical
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Load duplicates from API
  const loadDuplicates = useCallback(async () => {
    try {
      setDuplicatesLoading(true);
      const data = await contactsApi.getDuplicates();
      setDuplicates(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar duplicados';
      toast.error('Erro ao carregar duplicados', { description: message });
    } finally {
      setDuplicatesLoading(false);
    }
  }, []);

  // Dismiss duplicate pair
  const dismissDuplicate = useCallback(async (contactId1: string, contactId2: string): Promise<void> => {
    try {
      await contactsApi.dismissDuplicate(contactId1, contactId2);
      // Remove the dismissed pair from duplicates
      setDuplicates(prev => prev.filter(set => 
        !(set.contacts.some(c => c.id === contactId1) && set.contacts.some(c => c.id === contactId2))
      ));
      toast.success('Duplicado dispensado');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao dispensar duplicado';
      toast.error('Erro ao dispensar duplicado', { description: message });
      throw err;
    }
  }, []);

  // Merge contacts
  const mergeContacts = useCallback(async (contactIds: string[], mergeData: MergeResult): Promise<Contact> => {
    try {
      setLoading(true);
      const mergedContact = await contactsApi.mergeContacts(contactIds, mergeData);
      
      // Remove merged contacts from list and add the new one
      setContacts(prev => {
        const filtered = prev.filter(c => !contactIds.includes(c.id));
        return [mergedContact, ...filtered];
      });
      
      // Remove the merged set from duplicates
      setDuplicates(prev => prev.filter(set => 
        !set.contacts.some(c => contactIds.includes(c.id))
      ));
      
      // Update total count (merged contacts reduce total)
      setTotal(prev => prev - (contactIds.length - 1));
      
      toast.success(`${contactIds.length} contatos mesclados com sucesso`);
      return mergedContact;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao mesclar contatos';
      toast.error('Erro ao mesclar contatos', { description: message });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (autoLoad && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadContacts();
      loadTags();
      loadGroups();
      loadInboxes();
      loadStats();
    }
  }, [autoLoad, loadContacts, loadTags, loadGroups, loadInboxes, loadStats]);

  // Create contact
  const createContact = useCallback(async (data: CreateContactData): Promise<Contact> => {
    try {
      setLoading(true);
      const contact = await contactsApi.createContact(data);
      setContacts(prev => [contact, ...prev]);
      setTotal(prev => prev + 1);
      toast.success('Contato criado com sucesso');
      return contact;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar contato';
      toast.error('Erro ao criar contato', { description: message });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update contact
  const updateContact = useCallback(async (id: string, updates: UpdateContactData): Promise<Contact> => {
    try {
      setLoading(true);
      const contact = await contactsApi.updateContact(id, updates);
      setContacts(prev => prev.map(c => c.id === id ? contact : c));
      toast.success('Contato atualizado');
      return contact;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar contato';
      toast.error('Erro ao atualizar contato', { description: message });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete contacts
  const deleteContacts = useCallback(async (ids: string[]): Promise<void> => {
    try {
      setLoading(true);
      await contactsApi.deleteContacts(ids);
      setContacts(prev => prev.filter(c => !ids.includes(c.id)));
      setTotal(prev => prev - ids.length);
      toast.success(`${ids.length} contato(s) removido(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover contatos';
      toast.error('Erro ao remover contatos', { description: message });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Import contacts from WhatsApp
  const importContacts = useCallback(async (
    contactsToImport: Array<{ phone: string; name?: string; avatarUrl?: string; whatsappJid?: string }>
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const result = await contactsApi.importFromWhatsApp(contactsToImport);

      // Reload contacts and stats after import
      await Promise.all([loadContacts(), loadStats()]);

      if (result.imported > 0 && result.updated > 0) {
        toast.success('Contatos importados', {
          description: `${result.imported} novos, ${result.updated} atualizados`
        });
      } else if (result.imported > 0) {
        toast.success(`${result.imported} novos contatos importados`);
      } else if (result.updated > 0) {
        toast.success(`${result.updated} contatos atualizados`);
      } else {
        toast.success('Contatos sincronizados', {
          description: 'Nenhuma alteração necessária'
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao importar contatos';
      setError(message);
      toast.error('Erro ao importar contatos', { description: message });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadContacts, loadStats]);

  // Add tag
  const addTag = useCallback(async (data: CreateTagData): Promise<Tag> => {
    try {
      const tag = await contactsApi.createTag(data);
      setTags(prev => [...prev, tag]);
      toast.success(`Tag "${data.name}" criada`);
      return tag;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar tag';
      toast.error('Erro ao criar tag', { description: message });
      throw err;
    }
  }, []);

  // Remove tag
  const removeTag = useCallback(async (tagId: string): Promise<void> => {
    try {
      await contactsApi.deleteTag(tagId);
      setTags(prev => prev.filter(t => t.id !== tagId));
      toast.success('Tag removida');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover tag';
      toast.error('Erro ao remover tag', { description: message });
      throw err;
    }
  }, []);

  // Add tags to contacts
  const addTagsToContacts = useCallback(async (contactIds: string[], tagIds: string[]): Promise<void> => {
    try {
      await contactsApi.addTagsToContacts(contactIds, tagIds);
      // Reload contacts to get updated tags
      await loadContacts();
      toast.success(`Tags adicionadas a ${contactIds.length} contato(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar tags';
      toast.error('Erro ao adicionar tags', { description: message });
      throw err;
    }
  }, [loadContacts]);

  // Remove tags from contacts
  const removeTagsFromContacts = useCallback(async (contactIds: string[], tagIds: string[]): Promise<void> => {
    try {
      await contactsApi.removeTagsFromContacts(contactIds, tagIds);
      // Reload contacts to get updated tags
      await loadContacts();
      toast.success(`Tags removidas de ${contactIds.length} contato(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover tags';
      toast.error('Erro ao remover tags', { description: message });
      throw err;
    }
  }, [loadContacts]);

  // Create group
  const createGroup = useCallback(async (data: CreateGroupData): Promise<ContactGroup> => {
    try {
      const group = await contactsApi.createGroup(data);
      setGroups(prev => [...prev, group]);
      toast.success(`Grupo "${data.name}" criado`);
      return group;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar grupo';
      toast.error('Erro ao criar grupo', { description: message });
      throw err;
    }
  }, []);

  // Update group
  const updateGroup = useCallback(async (groupId: string, updates: UpdateGroupData): Promise<ContactGroup> => {
    try {
      const group = await contactsApi.updateGroup(groupId, updates);
      setGroups(prev => prev.map(g => g.id === groupId ? group : g));
      toast.success('Grupo atualizado');
      return group;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar grupo';
      toast.error('Erro ao atualizar grupo', { description: message });
      throw err;
    }
  }, []);

  // Delete group
  const deleteGroup = useCallback(async (groupId: string): Promise<void> => {
    try {
      await contactsApi.deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast.success('Grupo removido');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover grupo';
      toast.error('Erro ao remover grupo', { description: message });
      throw err;
    }
  }, []);

  // Add contacts to group
  const addContactsToGroup = useCallback(async (groupId: string, contactIds: string[]): Promise<void> => {
    try {
      await contactsApi.addContactsToGroup(groupId, contactIds);
      // Reload groups to get updated count
      await loadGroups();
      toast.success(`${contactIds.length} contato(s) adicionado(s) ao grupo`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar contatos ao grupo';
      toast.error('Erro ao adicionar contatos ao grupo', { description: message });
      throw err;
    }
  }, [loadGroups]);

  // Remove contacts from group
  const removeContactsFromGroup = useCallback(async (groupId: string, contactIds: string[]): Promise<void> => {
    try {
      await contactsApi.removeContactsFromGroup(groupId, contactIds);
      // Reload groups to get updated count
      await loadGroups();
      toast.success(`${contactIds.length} contato(s) removido(s) do grupo`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover contatos do grupo';
      toast.error('Erro ao remover contatos do grupo', { description: message });
      throw err;
    }
  }, [loadGroups]);

  // Migrate from localStorage
  const migrateFromLocalStorage = useCallback(async (): Promise<MigrationResult> => {
    if (!localStorageData) {
      return { contacts: 0, tags: 0, groups: 0, errors: [] };
    }

    try {
      setLoading(true);
      const result = await contactsApi.migrateFromLocalStorage(localStorageData);

      if (result.errors.length === 0) {
        // Clear localStorage on success
        clearLocalStorageData();
        setLocalStorageData(null);
        setMigrationPending(false);

        // Reload data
        await loadContacts();
        await loadTags();
        await loadGroups();

        toast.success('Migração concluída', {
          description: `${result.contacts} contatos, ${result.tags} tags, ${result.groups} grupos migrados`
        });
      } else {
        toast.warning('Migração parcial', {
          description: `${result.errors.length} erro(s) durante a migração`
        });
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na migração';
      toast.error('Erro na migração', { description: message });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [localStorageData, loadContacts, loadTags, loadGroups]);

  // Dismiss migration
  const dismissMigration = useCallback(() => {
    setMigrationDismissed(true);
    setMigrationPending(false);
  }, []);

  // Refresh all data
  const refreshContacts = useCallback(async () => {
    await Promise.all([
      loadContacts(),
      loadTags(),
      loadGroups(),
      loadStats()
    ]);
  }, [loadContacts, loadTags, loadGroups, loadStats]);

  return {
    // Data
    contacts,
    tags,
    groups,
    inboxes,
    stats,

    // Pagination
    total,
    page,
    pageSize,

    // State
    loading,
    error,

    // Migration
    hasLocalStorageData: !!localStorageData && !migrationDismissed,
    migrationPending: migrationPending && !migrationDismissed,
    migrateFromLocalStorage,
    dismissMigration,

    // Contacts CRUD
    loadContacts,
    createContact,
    updateContact,
    deleteContacts,

    // Import
    importContacts,

    // Duplicates
    duplicates,
    duplicatesLoading,
    loadDuplicates,
    dismissDuplicate,
    mergeContacts,

    // Tags
    loadTags,
    addTag,
    removeTag,
    addTagsToContacts,
    removeTagsFromContacts,

    // Groups
    loadGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addContactsToGroup,
    removeContactsFromGroup,

    // Inboxes
    loadInboxes,

    // Stats
    loadStats,

    // Refresh
    refreshContacts,
  };
}
