/**
 * Contacts Storage Service
 * 
 * Serviço de persistência local para contatos, tags, grupos e preferências.
 * Utiliza localStorage para armazenamento e implementa limpeza automática de dados antigos.
 */

import { Contact } from './bulkCampaignService';

const IS_DEVELOPMENT = import.meta.env.DEV;

export interface ContactMetadata {
  lastImportDate?: string;
  sourceInstance?: string;
  dataVersion?: string;
  tags?: string[];
  groups?: string[];
  customFields?: Record<string, any>;
}

export interface StorageMetadata {
  lastImportDate: string;
  sourceInstance?: string;
  dataVersion: string;
  totalContacts: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface ContactGroup {
  id: string;
  name: string;
  contactIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  pageSize: number;
  currentPage: number;
  filters: {
    search: string;
    tags: string[];
    hasName: boolean | null;
  };
  lastUpdated: Date;
}

const STORAGE_KEYS = {
  CONTACTS: 'wuzapi_contacts',
  TAGS: 'wuzapi_tags',
  GROUPS: 'wuzapi_groups',
  PREFERENCES: 'wuzapi_contacts_preferences',
  LAST_IMPORT: 'wuzapi_last_import',
  METADATA: 'wuzapi_contacts_metadata',
  CONTACTS_BY_INSTANCE: 'wuzapi_contacts_by_instance', // Novo: contatos separados por instância
};

const CURRENT_DATA_VERSION = '1.0.0';

class ContactsStorageService {
  /**
   * Salva contatos no localStorage
   */
  saveContacts(contacts: Contact[]): void {
    try {
      const data = {
        contacts,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(data));
    } catch (error: any) {
      console.error('Erro ao salvar contatos:', {
        error,
        message: error.message,
        contactCount: contacts.length,
        storageKey: STORAGE_KEYS.CONTACTS,
      });
      throw new Error(`Falha ao salvar contatos: ${error.message || 'Espaço insuficiente no localStorage'}`);
    }
  }

  /**
   * Carrega contatos do localStorage
   */
  loadContacts(): Contact[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONTACTS);
      if (!data) return [];

      const parsed = JSON.parse(data);
      return parsed.contacts || [];
    } catch (error: any) {
      console.error('Erro ao carregar contatos:', {
        error,
        message: error.message,
        storageKey: STORAGE_KEYS.CONTACTS,
      });
      // Tentar limpar dados corrompidos
      try {
        localStorage.removeItem(STORAGE_KEYS.CONTACTS);
      } catch (cleanupError) {
        console.error('Erro ao limpar dados corrompidos:', cleanupError);
      }
      return [];
    }
  }

  /**
   * Mescla novos contatos com contatos existentes de forma inteligente
   * 
   * Regras de merge:
   * - Usa telefone como chave única
   * - Mantém dados existentes (tags, grupos, customFields)
   * - Atualiza apenas campos vazios ou nulos
   * - Preserva metadados importantes
   * 
   * @param newContacts - Novos contatos a serem mesclados
   * @param existingContacts - Contatos já existentes (opcional, carrega do storage se não fornecido)
   * @returns Array de contatos mesclados
   */
  mergeContacts(newContacts: Contact[], existingContacts?: Contact[]): Contact[] {
    try {
      if (IS_DEVELOPMENT) {
        console.log('🔄 Iniciando merge de contatos', {
          newContactsCount: newContacts.length,
          existingContactsCount: existingContacts?.length || 'carregando do storage'
        });
      }

      // Carregar contatos existentes se não fornecidos
      const existing = existingContacts || this.loadContacts();

      // Criar Map para acesso rápido por telefone
      const contactsMap = new Map<string, Contact>();

      // Primeiro, adicionar todos os contatos existentes ao Map
      existing.forEach(contact => {
        contactsMap.set(contact.phone, { ...contact });
      });

      if (IS_DEVELOPMENT) {
        console.log('📊 Contatos existentes carregados', {
          total: contactsMap.size,
          samplePhones: Array.from(contactsMap.keys()).slice(0, 3).map(p => p.substring(0, 8) + '...')
        });
      }

      // Processar novos contatos
      let updated = 0;
      let added = 0;

      newContacts.forEach(newContact => {
        const existingContact = contactsMap.get(newContact.phone);

        if (existingContact) {
          // Contato já existe - fazer merge inteligente
          const merged: Contact = {
            ...existingContact,
            // Atualizar nome apenas se o novo tiver nome e o existente não tiver
            name: existingContact.name || newContact.name,
            // Mesclar variáveis, mantendo as existentes e adicionando novas
            variables: {
              ...newContact.variables,
              ...existingContact.variables, // Existentes têm prioridade
            }
          };

          contactsMap.set(newContact.phone, merged);
          updated++;

          if (IS_DEVELOPMENT) {
            console.log('🔄 Contato atualizado', {
              phone: newContact.phone.substring(0, 8) + '...',
              hadName: !!existingContact.name,
              hasName: !!merged.name,
              variablesCount: Object.keys(merged.variables || {}).length
            });
          }
        } else {
          // Contato novo - adicionar
          contactsMap.set(newContact.phone, { ...newContact });
          added++;

          if (IS_DEVELOPMENT) {
            console.log('➕ Contato adicionado', {
              phone: newContact.phone.substring(0, 8) + '...',
              hasName: !!newContact.name,
              variablesCount: Object.keys(newContact.variables || {}).length
            });
          }
        }
      });

      const mergedContacts = Array.from(contactsMap.values());

      if (IS_DEVELOPMENT) {
        console.log('✅ Merge concluído', {
          total: mergedContacts.length,
          added,
          updated,
          unchanged: existing.length - updated
        });
      }

      return mergedContacts;
    } catch (error: any) {
      console.error('❌ Erro ao mesclar contatos:', {
        error,
        message: error.message,
        newContactsCount: newContacts.length
      });
      // Em caso de erro, retornar os novos contatos
      return newContacts;
    }
  }

  /**
   * Limpa todos os contatos e metadados
   */
  clearContacts(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CONTACTS);
      localStorage.removeItem(STORAGE_KEYS.METADATA);

      if (IS_DEVELOPMENT) {
        console.log('🗑️ Contatos e metadados limpos');
      }
    } catch (error: any) {
      console.error('Erro ao limpar contatos:', {
        error,
        message: error.message,
        storageKey: STORAGE_KEYS.CONTACTS,
      });
      throw new Error(`Falha ao limpar contatos: ${error.message}`);
    }
  }

  /**
   * Salva tags no localStorage
   */
  saveTags(tags: Tag[]): void {
    try {
      const data = {
        tags,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar tags:', error);
    }
  }

  /**
   * Carrega tags do localStorage
   */
  loadTags(): Tag[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TAGS);
      if (!data) return [];

      const parsed = JSON.parse(data);
      return parsed.tags || [];
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
      return [];
    }
  }

  /**
   * Salva grupos no localStorage
   */
  saveGroups(groups: ContactGroup[]): void {
    try {
      const data = {
        groups,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar grupos:', error);
    }
  }

  /**
   * Carrega grupos do localStorage
   */
  loadGroups(): ContactGroup[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (!data) return [];

      const parsed = JSON.parse(data);
      return parsed.groups || [];
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
      return [];
    }
  }

  /**
   * Salva preferências do usuário
   */
  savePreferences(prefs: UserPreferences): void {
    try {
      const data = {
        ...prefs,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    }
  }

  /**
   * Carrega preferências do usuário
   */
  loadPreferences(): UserPreferences | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
      return null;
    }
  }

  /**
   * Registra timestamp da última importação
   */
  setLastImport(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_IMPORT, new Date().toISOString());
    } catch (error) {
      console.error('Erro ao registrar última importação:', error);
    }
  }

  /**
   * Obtém timestamp da última importação
   */
  getLastImport(): Date | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAST_IMPORT);
      if (!data) return null;

      return new Date(data);
    } catch (error) {
      console.error('Erro ao obter última importação:', error);
      return null;
    }
  }

  /**
   * Limpa dados antigos (mais de X dias)
   */
  cleanOldData(daysOld = 7): void {
    try {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);

      // Verificar contatos
      const contactsData = localStorage.getItem(STORAGE_KEYS.CONTACTS);
      if (contactsData) {
        const parsed = JSON.parse(contactsData);
        const timestamp = new Date(parsed.timestamp);
        if (timestamp < cutoffDate) {
          this.clearContacts();
          if (IS_DEVELOPMENT) {
            console.log('Contatos antigos removidos');
          }
        }
      }

      // Verificar tags
      const tagsData = localStorage.getItem(STORAGE_KEYS.TAGS);
      if (tagsData) {
        const parsed = JSON.parse(tagsData);
        const timestamp = new Date(parsed.timestamp);
        if (timestamp < cutoffDate) {
          localStorage.removeItem(STORAGE_KEYS.TAGS);
          if (IS_DEVELOPMENT) {
            console.log('Tags antigas removidas');
          }
        }
      }

      // Verificar grupos
      const groupsData = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (groupsData) {
        const parsed = JSON.parse(groupsData);
        const timestamp = new Date(parsed.timestamp);
        if (timestamp < cutoffDate) {
          localStorage.removeItem(STORAGE_KEYS.GROUPS);
          if (IS_DEVELOPMENT) {
            console.log('Grupos antigos removidos');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao limpar dados antigos:', error);
    }
  }

  /**
   * Limpa todos os dados de contatos
   */
  clearAll(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      if (IS_DEVELOPMENT) {
        console.log('Todos os dados de contatos foram limpos');
      }
    } catch (error) {
      console.error('Erro ao limpar todos os dados:', error);
    }
  }

  /**
   * Obtém tamanho aproximado dos dados armazenados (em KB)
   */
  getStorageSize(): number {
    try {
      let totalSize = 0;
      Object.values(STORAGE_KEYS).forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      });
      return Math.round(totalSize / 1024); // Retorna em KB
    } catch (error) {
      console.error('Erro ao calcular tamanho do storage:', error);
      return 0;
    }
  }

  /**
   * Atualiza metadados de importação (privado)
   * 
   * @param instance - Nome da instância de origem
   * @param contactCount - Número total de contatos
   */
  private updateMetadata(instance?: string, contactCount?: number): void {
    try {
      const metadata: StorageMetadata = {
        lastImportDate: new Date().toISOString(),
        sourceInstance: instance,
        dataVersion: CURRENT_DATA_VERSION,
        totalContacts: contactCount || this.loadContacts().length
      };

      localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));

      if (IS_DEVELOPMENT) {
        console.log('📝 Metadados atualizados', {
          lastImportDate: metadata.lastImportDate,
          sourceInstance: metadata.sourceInstance,
          totalContacts: metadata.totalContacts,
          dataVersion: metadata.dataVersion
        });
      }
    } catch (error: any) {
      console.error('Erro ao atualizar metadados:', {
        error,
        message: error.message
      });
    }
  }

  /**
   * Obtém metadados de importação
   * 
   * @returns Metadados ou null se não existirem
   */
  getMetadata(): StorageMetadata | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.METADATA);
      if (!data) return null;

      const metadata = JSON.parse(data) as StorageMetadata;

      if (IS_DEVELOPMENT) {
        console.log('📖 Metadados carregados', {
          lastImportDate: metadata.lastImportDate,
          sourceInstance: metadata.sourceInstance,
          totalContacts: metadata.totalContacts,
          dataVersion: metadata.dataVersion
        });
      }

      return metadata;
    } catch (error: any) {
      console.error('Erro ao carregar metadados:', {
        error,
        message: error.message
      });
      return null;
    }
  }

  /**
   * Salva contatos com metadados atualizados
   * 
   * @param contacts - Contatos a serem salvos
   * @param instance - Nome da instância de origem (opcional)
   */
  saveContactsWithMetadata(contacts: Contact[], instance?: string): void {
    try {
      // Se instância fornecida, salvar separadamente
      if (instance) {
        this.saveContactsByInstance(contacts, instance);
      } else {
        // Salvar no storage global (compatibilidade)
        this.saveContacts(contacts);
      }

      // Atualizar metadados
      this.updateMetadata(instance, contacts.length);

      if (IS_DEVELOPMENT) {
        console.log('💾 Contatos e metadados salvos', {
          contactCount: contacts.length,
          instance: instance || 'global'
        });
      }
    } catch (error: any) {
      console.error('Erro ao salvar contatos com metadados:', {
        error,
        message: error.message,
        contactCount: contacts.length
      });
      throw error;
    }
  }

  /**
   * Salva contatos separados por instância
   * 
   * @param contacts - Contatos a serem salvos
   * @param instance - Nome da instância
   */
  saveContactsByInstance(contacts: Contact[], instance: string): void {
    try {
      // Carregar dados existentes
      const allData = this.loadAllInstancesData();

      // Atualizar dados da instância
      allData[instance] = {
        contacts,
        timestamp: new Date().toISOString(),
      };

      // Salvar de volta
      localStorage.setItem(STORAGE_KEYS.CONTACTS_BY_INSTANCE, JSON.stringify(allData));

      if (IS_DEVELOPMENT) {
        console.log('💾 Contatos salvos por instância', {
          instance,
          contactCount: contacts.length,
          totalInstances: Object.keys(allData).length
        });
      }
    } catch (error: any) {
      console.error('Erro ao salvar contatos por instância:', {
        error,
        message: error.message,
        instance,
        contactCount: contacts.length
      });
      throw new Error(`Falha ao salvar contatos da instância: ${error.message}`);
    }
  }

  /**
   * Carrega contatos de uma instância específica
   * 
   * @param instance - Nome da instância (opcional)
   * @returns Array de contatos da instância ou todos se não especificado
   */
  loadContactsByInstance(instance?: string): Contact[] {
    try {
      // Se não especificou instância, retornar do storage global
      if (!instance) {
        return this.loadContacts();
      }

      const allData = this.loadAllInstancesData();
      const instanceData = allData[instance];

      if (!instanceData) {
        if (IS_DEVELOPMENT) {
          console.log('📂 Nenhum contato encontrado para instância', { instance });
        }
        return [];
      }

      if (IS_DEVELOPMENT) {
        console.log('📂 Contatos carregados da instância', {
          instance,
          contactCount: instanceData.contacts.length,
          timestamp: instanceData.timestamp
        });
      }

      return instanceData.contacts || [];
    } catch (error: any) {
      console.error('Erro ao carregar contatos da instância:', {
        error,
        message: error.message,
        instance
      });
      return [];
    }
  }

  /**
   * Carrega dados de todas as instâncias
   * 
   * @returns Objeto com dados de todas as instâncias
   */
  private loadAllInstancesData(): Record<string, { contacts: Contact[]; timestamp: string }> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONTACTS_BY_INSTANCE);
      if (!data) return {};

      return JSON.parse(data);
    } catch (error: any) {
      console.error('Erro ao carregar dados de instâncias:', {
        error,
        message: error.message
      });
      return {};
    }
  }

  /**
   * Lista todas as instâncias com contatos salvos
   * 
   * @returns Array com informações de cada instância
   */
  listInstances(): { instance: string; contactCount: number; timestamp: string }[] {
    try {
      const allData = this.loadAllInstancesData();

      return Object.entries(allData).map(([instance, data]) => ({
        instance,
        contactCount: data.contacts.length,
        timestamp: data.timestamp
      }));
    } catch (error: any) {
      console.error('Erro ao listar instâncias:', {
        error,
        message: error.message
      });
      return [];
    }
  }

  /**
   * Remove contatos de uma instância específica
   * 
   * @param instance - Nome da instância
   */
  clearContactsByInstance(instance: string): void {
    try {
      const allData = this.loadAllInstancesData();
      delete allData[instance];

      localStorage.setItem(STORAGE_KEYS.CONTACTS_BY_INSTANCE, JSON.stringify(allData));

      if (IS_DEVELOPMENT) {
        console.log('🗑️ Contatos da instância removidos', { instance });
      }
    } catch (error: any) {
      console.error('Erro ao remover contatos da instância:', {
        error,
        message: error.message,
        instance
      });
      throw new Error(`Falha ao remover contatos da instância: ${error.message}`);
    }
  }
}

// Exportar instância singleton
export const contactsStorageService = new ContactsStorageService();
export default contactsStorageService;
