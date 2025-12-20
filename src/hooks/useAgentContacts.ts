/**
 * useAgentContacts Hook
 * 
 * Hook para gerenciamento de contatos do agente.
 * Busca contatos do backend filtrados pelas caixas de entrada do agente.
 * Fornece a mesma interface que useContacts para compatibilidade com componentes.
 */

import { useState, useEffect, useCallback } from 'react'
import { Contact } from '@/services/bulkCampaignService'
import { Tag, ContactGroup } from '@/services/contactsStorageService'
import { getMyContacts, importContactsFromInbox, type AgentContact } from '@/services/agent-data'
import { useAgentInbox } from '@/contexts/AgentInboxContext'
import { toast } from 'sonner'

interface UseAgentContactsReturn {
  contacts: Contact[]
  tags: Tag[]
  groups: ContactGroup[]
  loading: boolean
  importing: boolean
  error: string | null
  total: number
  importContacts: () => Promise<void>
  updateContact: (phone: string, updates: Partial<Contact>) => void
  deleteContacts: (phones: string[]) => void
  addTag: (tag: Omit<Tag, 'id'>) => void
  removeTag: (tagId: string) => void
  addTagsToContacts: (contactPhones: string[], tagIds: string[]) => void
  removeTagsFromContacts: (contactPhones: string[], tagIds: string[]) => void
  createGroup: (name: string, contactIds: string[]) => void
  updateGroup: (groupId: string, updates: Partial<ContactGroup>) => void
  deleteGroup: (groupId: string) => void
  refreshContacts: () => void
}

/**
 * Converte AgentContact para Contact (formato usado pelos componentes)
 */
function agentContactToContact(agentContact: AgentContact & { variables?: Record<string, string> }): Contact {
  return {
    phone: agentContact.phone,
    name: agentContact.name || '',
    variables: agentContact.variables || {}
  }
}

/**
 * Remove contatos duplicados baseado no telefone
 */
function deduplicateContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>()
  return contacts.filter(contact => {
    const phone = contact.phone.replace(/\D/g, '')
    if (seen.has(phone)) {
      return false
    }
    seen.add(phone)
    return true
  })
}

export function useAgentContacts(): UseAgentContactsReturn {
  const { inboxes } = useAgentInbox()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tags e grupos são gerenciados localmente para o agente
  const [tags] = useState<Tag[]>([])
  const [groups] = useState<ContactGroup[]>([])

  // Buscar contatos do backend
  const fetchContacts = useCallback(async () => {
    if (inboxes.length === 0) {
      setContacts([])
      setTotal(0)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Buscar todos os contatos (sem paginação no hook, paginação é feita no componente)
      const result = await getMyContacts({ limit: 10000 })
      
      const convertedContacts = result.contacts.map(agentContactToContact)
      // Remove duplicados que podem vir de múltiplas inboxes
      const uniqueContacts = deduplicateContacts(convertedContacts)
      setContacts(uniqueContacts)
      setTotal(uniqueContacts.length)
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar contatos'
      setError(errorMessage)
      console.error('Erro ao carregar contatos do agente:', err)
    } finally {
      setLoading(false)
    }
  }, [inboxes])

  // Carregar contatos quando inboxes mudar
  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Importar contatos de todas as inboxes do agente
  const importContacts = useCallback(async () => {
    if (inboxes.length === 0) {
      toast.error('Nenhuma caixa de entrada atribuída')
      return
    }

    setImporting(true)
    setError(null)

    try {
      // Import from all inboxes in parallel for better performance
      const importPromises = inboxes.map(async (inbox) => {
        try {
          const result = await importContactsFromInbox(inbox.id)
          return { inbox: inbox.name, imported: result.imported, success: true }
        } catch (err: any) {
          console.error(`Erro ao importar da inbox ${inbox.name}:`, err)
          return { inbox: inbox.name, imported: 0, success: false, error: err.message }
        }
      })

      const results = await Promise.all(importPromises)
      
      const totalImported = results.reduce((sum, r) => sum + r.imported, 0)
      const failedInboxes = results.filter(r => !r.success)

      // Recarregar contatos após importação
      await fetchContacts()

      if (failedInboxes.length > 0 && failedInboxes.length === inboxes.length) {
        toast.error('Erro ao importar contatos de todas as caixas')
      } else if (totalImported > 0) {
        toast.success(`${totalImported} contato(s) importado(s) com sucesso`)
      } else {
        toast.info('Nenhum novo contato para importar')
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao importar contatos'
      setError(errorMessage)
      toast.error('Erro ao importar contatos', { description: errorMessage })
    } finally {
      setImporting(false)
    }
  }, [inboxes, fetchContacts])

  // Atualizar contato localmente (não persiste no backend por enquanto)
  const updateContact = useCallback((phone: string, updates: Partial<Contact>) => {
    setContacts(prev => prev.map(contact => 
      contact.phone === phone 
        ? { ...contact, ...updates }
        : contact
    ))
  }, [])

  // Deletar contatos localmente (não persiste no backend por enquanto)
  const deleteContacts = useCallback((phones: string[]) => {
    setContacts(prev => prev.filter(contact => !phones.includes(contact.phone)))
    toast.success(`${phones.length} contato(s) removido(s) da lista`)
  }, [])

  // Funções de tags - não implementadas para agente por enquanto
  const addTag = useCallback(() => {
    toast.info('Gerenciamento de tags não disponível para agentes')
  }, [])

  const removeTag = useCallback(() => {
    toast.info('Gerenciamento de tags não disponível para agentes')
  }, [])

  const addTagsToContacts = useCallback(() => {
    toast.info('Gerenciamento de tags não disponível para agentes')
  }, [])

  const removeTagsFromContacts = useCallback(() => {
    toast.info('Gerenciamento de tags não disponível para agentes')
  }, [])

  // Funções de grupos - não implementadas para agente por enquanto
  const createGroup = useCallback(() => {
    toast.info('Gerenciamento de grupos não disponível para agentes')
  }, [])

  const updateGroup = useCallback(() => {
    toast.info('Gerenciamento de grupos não disponível para agentes')
  }, [])

  const deleteGroup = useCallback(() => {
    toast.info('Gerenciamento de grupos não disponível para agentes')
  }, [])

  // Recarregar contatos
  const refreshContacts = useCallback(() => {
    fetchContacts()
  }, [fetchContacts])

  return {
    contacts,
    tags,
    groups,
    loading,
    importing,
    error,
    total,
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
  }
}
