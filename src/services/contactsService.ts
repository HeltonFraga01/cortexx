/**
 * Contacts Service
 * 
 * Serviço principal de gerenciamento de contatos.
 * Implementa filtros, busca, operações com tags e grupos, exportação e estatísticas.
 */

import { Contact } from './bulkCampaignService';
import { Tag, ContactGroup } from './contactsApiService';
import { 
  validatePhoneFormat, 
  normalizePhoneNumber, 
  formatPhoneDisplay as formatPhoneUtil 
} from '@/lib/phone-utils';

export interface ContactFilters {
  search: string;
  tags: string[];
  hasName: boolean | null;
}

export interface ContactStats {
  total: number;
  withName: number;
  withoutName: number;
  totalTags: number;
  tagDistribution: Record<string, number>;
}

class ContactsService {
  /**
   * Filtra contatos baseado em múltiplos critérios
   */
  filterContacts(contacts: Contact[], filters: ContactFilters): Contact[] {
    let filtered = [...contacts];

    // Filtro de busca (nome ou telefone)
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      filtered = filtered.filter(contact => {
        const nameMatch = contact.name?.toLowerCase().includes(searchLower);
        const phoneMatch = contact.phone.includes(searchLower);
        return nameMatch || phoneMatch;
      });
    }

    // Filtro por tags (AND logic - contato deve ter todas as tags selecionadas)
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(contact => {
        if (!contact.variables?.tags) return false;
        const contactTags = Array.isArray(contact.variables.tags) 
          ? contact.variables.tags 
          : [contact.variables.tags];
        return filters.tags.every(tag => contactTags.includes(tag));
      });
    }

    // Filtro por presença de nome
    if (filters.hasName !== null) {
      filtered = filtered.filter(contact => {
        const hasName = contact.name && contact.name.trim().length > 0;
        return filters.hasName ? hasName : !hasName;
      });
    }

    return filtered;
  }

  /**
   * Busca contatos por query (nome ou telefone)
   */
  searchContacts(contacts: Contact[], query: string): Contact[] {
    if (!query?.trim()) return contacts;

    const searchLower = query.toLowerCase().trim();
    return contacts.filter(contact => {
      const nameMatch = contact.name?.toLowerCase().includes(searchLower);
      const phoneMatch = contact.phone.includes(searchLower);
      return nameMatch || phoneMatch;
    });
  }

  /**
   * Adiciona tags a contatos
   */
  addTagsToContacts(contacts: Contact[], contactIds: string[], tags: Tag[]): Contact[] {
    return contacts.map(contact => {
      if (!contactIds.includes(contact.phone)) return contact;

      const existingTags = contact.variables?.tags 
        ? (Array.isArray(contact.variables.tags) ? contact.variables.tags : [contact.variables.tags])
        : [];

      const newTags = tags.map(t => t.id);
      const uniqueTags = [...new Set([...existingTags, ...newTags])];

      return {
        ...contact,
        variables: {
          ...contact.variables,
          tags: uniqueTags,
        },
      };
    });
  }

  /**
   * Remove tags de contatos
   */
  removeTagsFromContacts(contacts: Contact[], contactIds: string[], tagIds: string[]): Contact[] {
    return contacts.map(contact => {
      if (!contactIds.includes(contact.phone)) return contact;

      const existingTags = contact.variables?.tags 
        ? (Array.isArray(contact.variables.tags) ? contact.variables.tags : [contact.variables.tags])
        : [];

      const filteredTags = existingTags.filter(tag => !tagIds.includes(tag));

      return {
        ...contact,
        variables: {
          ...contact.variables,
          tags: filteredTags,
        },
      };
    });
  }

  /**
   * Cria uma nova tag
   */
  createTag(tag: Omit<Tag, 'id'>): Tag {
    return {
      ...tag,
      id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };
  }

  /**
   * Remove uma tag (não remove dos contatos, apenas da lista de tags disponíveis)
   */
  deleteTag(tags: Tag[], tagId: string): Tag[] {
    return tags.filter(tag => tag.id !== tagId);
  }

  /**
   * Cria um novo grupo
   */
  createGroup(name: string, contactIds: string[]): ContactGroup {
    return {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      contactIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Atualiza um grupo
   */
  updateGroup(groups: ContactGroup[], groupId: string, updates: Partial<ContactGroup>): ContactGroup[] {
    return groups.map(group => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        ...updates,
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Remove um grupo
   */
  deleteGroup(groups: ContactGroup[], groupId: string): ContactGroup[] {
    return groups.filter(group => group.id !== groupId);
  }

  /**
   * Obtém contatos de um grupo
   */
  getGroupContacts(contacts: Contact[], group: ContactGroup): Contact[] {
    return contacts.filter(contact => group.contactIds.includes(contact.phone));
  }

  /**
   * Exporta contatos para CSV
   */
  exportToCSV(contacts: Contact[], tags: Tag[]): Blob {
    // Criar mapa de tags para lookup rápido
    const tagMap = new Map(tags.map(tag => [tag.id, tag.name]));

    // Cabeçalhos
    const headers = ['Telefone', 'Nome', 'Tags'];
    
    // Linhas
    const rows = contacts.map(contact => {
      const phone = this.formatPhoneDisplay(contact.phone);
      const name = contact.name || '';
      
      // Obter nomes das tags
      const contactTags = contact.variables?.tags 
        ? (Array.isArray(contact.variables.tags) ? contact.variables.tags : [contact.variables.tags])
        : [];
      const tagNames = contactTags.map(tagId => tagMap.get(tagId) || tagId).join('; ');

      return [phone, name, tagNames];
    });

    // Montar CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Criar Blob
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Formata telefone para exibição
   * Usa as novas funções de formatação do phone-utils
   */
  formatPhoneDisplay(phone: string): string {
    return formatPhoneUtil(phone);
  }

  /**
   * Calcula estatísticas dos contatos
   */
  getStats(contacts: Contact[], tags: Tag[]): ContactStats {
    const withName = contacts.filter(c => c.name && c.name.trim().length > 0).length;
    const withoutName = contacts.length - withName;

    // Distribuição de tags
    const tagDistribution: Record<string, number> = {};
    contacts.forEach(contact => {
      const contactTags = contact.variables?.tags 
        ? (Array.isArray(contact.variables.tags) ? contact.variables.tags : [contact.variables.tags])
        : [];
      
      contactTags.forEach(tagId => {
        tagDistribution[tagId] = (tagDistribution[tagId] || 0) + 1;
      });
    });

    return {
      total: contacts.length,
      withName,
      withoutName,
      totalTags: tags.length,
      tagDistribution,
    };
  }

  /**
   * Valida número de telefone
   * Usa as novas funções de validação do phone-utils
   */
  validatePhone(phone: string): { valid: boolean; reason?: string } {
    const result = validatePhoneFormat(phone);
    
    if (result.isValid) {
      return { valid: true };
    } else {
      return { valid: false, reason: result.error };
    }
  }

  /**
   * Normaliza número de telefone
   * Usa as novas funções de normalização do phone-utils
   */
  normalizePhone(phone: string): string {
    return normalizePhoneNumber(phone);
  }

  /**
   * Remove duplicados de uma lista de contatos
   */
  removeDuplicates(contacts: Contact[]): Contact[] {
    const seen = new Set<string>();
    return contacts.filter(contact => {
      if (seen.has(contact.phone)) {
        return false;
      }
      seen.add(contact.phone);
      return true;
    });
  }

  /**
   * Ordena contatos
   */
  sortContacts(contacts: Contact[], sortBy: 'name' | 'phone', order: 'asc' | 'desc' = 'asc'): Contact[] {
    const sorted = [...contacts].sort((a, b) => {
      let compareA: string;
      let compareB: string;

      if (sortBy === 'name') {
        compareA = (a.name || '').toLowerCase();
        compareB = (b.name || '').toLowerCase();
      } else {
        compareA = a.phone;
        compareB = b.phone;
      }

      if (compareA < compareB) return order === 'asc' ? -1 : 1;
      if (compareA > compareB) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  /**
   * Pagina contatos
   */
  paginateContacts(contacts: Contact[], page: number, pageSize: number): {
    contacts: Contact[];
    totalPages: number;
    currentPage: number;
  } {
    const totalPages = Math.ceil(contacts.length / pageSize);
    const currentPage = Math.min(Math.max(1, page), totalPages || 1);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      contacts: contacts.slice(startIndex, endIndex),
      totalPages,
      currentPage,
    };
  }
}

// Exportar instância singleton
export const contactsService = new ContactsService();
export default contactsService;
