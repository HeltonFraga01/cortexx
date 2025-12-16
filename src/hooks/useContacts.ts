/**
 * useContacts Hook
 * 
 * Hook principal para gerenciamento de contatos.
 * Gerencia estado, importação, atualização e persistência de contatos.
 */

import { useState, useEffect, useCallback } from 'react';
import { Contact } from '@/services/bulkCampaignService';
import { Tag, ContactGroup } from '@/services/contactsStorageService';
import { contactsStorageService } from '@/services/contactsStorageService';
import { contactImportService } from '@/services/contactImportService';
import { contactsService } from '@/services/contactsService';
import { toast } from 'sonner';

interface UseContactsReturn {
  contacts: Contact[];
  tags: Tag[];
  groups: ContactGroup[];
  loading: boolean;
  error: string | null;
  importContacts: (instance: string, token: string) => Promise<void>;
  updateContact: (phone: string, updates: Partial<Contact>) => void;
  deleteContacts: (phones: string[]) => void;
  addTag: (tag: Omit<Tag, 'id'>) => void;
  removeTag: (tagId: string) => void;
  addTagsToContacts: (contactPhones: string[], tagIds: string[]) => void;
  removeTagsFromContacts: (contactPhones: string[], tagIds: string[]) => void;
  createGroup: (name: string, contactIds: string[]) => void;
  updateGroup: (groupId: string, updates: Partial<ContactGroup>) => void;
  deleteGroup: (groupId: string) => void;
  refreshContacts: () => void;
}

export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados do localStorage ao montar
  useEffect(() => {
    try {
      const loadedContacts = contactsStorageService.loadContacts();
      const loadedTags = contactsStorageService.loadTags();
      const loadedGroups = contactsStorageService.loadGroups();

      setContacts(loadedContacts);
      setTags(loadedTags);
      setGroups(loadedGroups);

      // Limpar dados antigos
      contactsStorageService.cleanOldData(7);
    } catch (err: any) {
      const errorMessage = 'Erro ao carregar dados salvos';
      console.error(errorMessage, { error: err });
      setError(errorMessage);
      toast.error(errorMessage, {
        description: 'Os dados podem estar corrompidos. Tente importar novamente.',
      });
    }
  }, []);

  // Salvar contatos quando mudarem
  useEffect(() => {
    if (contacts.length > 0) {
      try {
        contactsStorageService.saveContacts(contacts);
      } catch (err: any) {
        console.error('Erro ao salvar contatos:', { error: err });
        // Não mostrar toast aqui para evitar spam, apenas log
      }
    }
  }, [contacts]);

  // Salvar tags quando mudarem
  useEffect(() => {
    if (tags.length > 0) {
      try {
        contactsStorageService.saveTags(tags);
      } catch (err: any) {
        console.error('Erro ao salvar tags:', { error: err });
        // Não mostrar toast aqui para evitar spam, apenas log
      }
    }
  }, [tags]);

  // Salvar grupos quando mudarem
  useEffect(() => {
    if (groups.length > 0) {
      try {
        contactsStorageService.saveGroups(groups);
      } catch (err: any) {
        console.error('Erro ao salvar grupos:', { error: err });
        // Não mostrar toast aqui para evitar spam, apenas log
      }
    }
  }, [groups]);

  // Importar contatos da WUZAPI
  const importContacts = useCallback(async (instance: string, token: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('📥 Iniciando importação de contatos', {
        instance,
        tokenPrefix: token.substring(0, 8) + '...',
        existingContactsCount: contacts.length
      });

      // Buscar novos contatos da WUZAPI
      const result = await contactImportService.importFromWuzapi(instance, token);
      
      console.log('✅ Contatos recebidos da WUZAPI', {
        newContactsCount: result.contacts.length,
        hasWarning: !!result.warning
      });

      // Carregar contatos existentes do storage (para garantir dados mais recentes)
      const existingContacts = contactsStorageService.loadContacts();
      
      console.log('📂 Contatos existentes carregados', {
        existingCount: existingContacts.length
      });

      // Fazer merge inteligente dos contatos
      const mergedContacts = contactsStorageService.mergeContacts(
        result.contacts,
        existingContacts
      );
      
      console.log('🔄 Merge concluído', {
        totalContacts: mergedContacts.length,
        newContacts: result.contacts.length,
        existingContacts: existingContacts.length
      });

      // Salvar contatos mesclados com metadados
      contactsStorageService.saveContactsWithMetadata(mergedContacts, instance);
      
      // Atualizar estado
      setContacts(mergedContacts);

      // Calcular estatísticas para o toast
      const added = mergedContacts.length - existingContacts.length;
      const updated = result.contacts.length - added;

      console.log('📊 Estatísticas da importação', {
        total: mergedContacts.length,
        added,
        updated,
        unchanged: existingContacts.length - updated
      });

      // Mostrar mensagem de sucesso com detalhes
      if (added > 0 && updated > 0) {
        toast.success('Contatos importados com sucesso', {
          description: `${added} novos, ${updated} atualizados`
        });
      } else if (added > 0) {
        toast.success(`${added} novos contatos importados`);
      } else if (updated > 0) {
        toast.success(`${updated} contatos atualizados`);
      } else {
        toast.success('Contatos sincronizados', {
          description: 'Nenhuma alteração necessária'
        });
      }

      // Mostrar aviso se houver
      if (result.warning) {
        toast.warning('Atenção', {
          description: result.warning
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao importar contatos';
      setError(errorMessage);
      
      // Log detalhado do erro para debugging
      console.error('❌ Erro ao importar contatos:', {
        error: err,
        instance,
        message: errorMessage,
        stack: err.stack,
        response: err.response?.data
      });
      
      // Re-throw para que o componente possa tratar
      throw err;
    } finally {
      setLoading(false);
    }
  }, [contacts]);

  // Atualizar um contato
  const updateContact = useCallback((phone: string, updates: Partial<Contact>) => {
    try {
      setContacts(prev => prev.map(contact => 
        contact.phone === phone 
          ? { ...contact, ...updates }
          : contact
      ));
    } catch (err: any) {
      const errorMessage = 'Erro ao atualizar contato';
      console.error(errorMessage, { error: err, phone, updates });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Deletar contatos
  const deleteContacts = useCallback((phones: string[]) => {
    try {
      setContacts(prev => prev.filter(contact => !phones.includes(contact.phone)));
      toast.success(`${phones.length} contato(s) removido(s)`);
    } catch (err: any) {
      const errorMessage = 'Erro ao remover contatos';
      console.error(errorMessage, { error: err, phones });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Adicionar nova tag
  const addTag = useCallback((tag: Omit<Tag, 'id'>) => {
    try {
      const newTag = contactsService.createTag(tag);
      setTags(prev => [...prev, newTag]);
      toast.success(`Tag "${tag.name}" criada`);
    } catch (err: any) {
      const errorMessage = 'Erro ao criar tag';
      console.error(errorMessage, { error: err, tag });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Remover tag
  const removeTag = useCallback((tagId: string) => {
    try {
      setTags(prev => contactsService.deleteTag(prev, tagId));
      toast.success('Tag removida');
    } catch (err: any) {
      const errorMessage = 'Erro ao remover tag';
      console.error(errorMessage, { error: err, tagId });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Adicionar tags a contatos
  const addTagsToContacts = useCallback((contactPhones: string[], tagIds: string[]) => {
    try {
      const tagsToAdd = tags.filter(t => tagIds.includes(t.id));
      setContacts(prev => contactsService.addTagsToContacts(prev, contactPhones, tagsToAdd));
      toast.success(`Tags adicionadas a ${contactPhones.length} contato(s)`);
    } catch (err: any) {
      const errorMessage = 'Erro ao adicionar tags';
      console.error(errorMessage, { error: err, contactPhones, tagIds });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, [tags]);

  // Remover tags de contatos
  const removeTagsFromContacts = useCallback((contactPhones: string[], tagIds: string[]) => {
    try {
      setContacts(prev => contactsService.removeTagsFromContacts(prev, contactPhones, tagIds));
      toast.success(`Tags removidas de ${contactPhones.length} contato(s)`);
    } catch (err: any) {
      const errorMessage = 'Erro ao remover tags';
      console.error(errorMessage, { error: err, contactPhones, tagIds });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Criar grupo
  const createGroup = useCallback((name: string, contactIds: string[]) => {
    try {
      const newGroup = contactsService.createGroup(name, contactIds);
      setGroups(prev => [...prev, newGroup]);
      toast.success(`Grupo "${name}" criado com ${contactIds.length} contato(s)`);
    } catch (err: any) {
      const errorMessage = 'Erro ao criar grupo';
      console.error(errorMessage, { error: err, name, contactIds });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Atualizar grupo
  const updateGroup = useCallback((groupId: string, updates: Partial<ContactGroup>) => {
    try {
      setGroups(prev => contactsService.updateGroup(prev, groupId, updates));
      toast.success('Grupo atualizado');
    } catch (err: any) {
      const errorMessage = 'Erro ao atualizar grupo';
      console.error(errorMessage, { error: err, groupId, updates });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Deletar grupo
  const deleteGroup = useCallback((groupId: string) => {
    try {
      setGroups(prev => contactsService.deleteGroup(prev, groupId));
      toast.success('Grupo removido');
    } catch (err: any) {
      const errorMessage = 'Erro ao remover grupo';
      console.error(errorMessage, { error: err, groupId });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  // Recarregar contatos do storage
  const refreshContacts = useCallback(() => {
    try {
      const loadedContacts = contactsStorageService.loadContacts();
      const loadedTags = contactsStorageService.loadTags();
      const loadedGroups = contactsStorageService.loadGroups();

      setContacts(loadedContacts);
      setTags(loadedTags);
      setGroups(loadedGroups);
    } catch (err: any) {
      const errorMessage = 'Erro ao recarregar contatos';
      console.error(errorMessage, { error: err });
      toast.error(errorMessage, {
        description: err.message || 'Tente novamente',
      });
    }
  }, []);

  return {
    contacts,
    tags,
    groups,
    loading,
    error,
    importContacts,
    updateContact,
    deleteContacts,
    addTag,
    removeTag,
    addTagsToContacts,
    removeTagsFromContacts,
    createGroup,
    updateGroup,
    deleteGroup,
    refreshContacts,
  };
}
