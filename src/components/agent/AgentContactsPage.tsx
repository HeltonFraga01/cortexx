/**
 * AgentContactsPage
 * 
 * Página de contatos do agente - mesma funcionalidade que UserContacts
 * mas com dados filtrados pelas caixas de entrada atribuídas ao agente.
 */

import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Download, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { CardHeaderWithIcon, EmptyState } from '@/components/ui-custom'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAgentContacts } from '@/hooks/useAgentContacts'
import { useContactFilters } from '@/hooks/useContactFilters'
import { useContactSelection } from '@/hooks/useContactSelection'
import { contactsService } from '@/services/contactsService'
import { AgentInboxProvider, useAgentInbox } from '@/contexts/AgentInboxContext'
import { ContactsFilters } from '@/components/contacts/ContactsFilters'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { ContactsStats } from '@/components/contacts/ContactsStats'
import { ContactSelection } from '@/components/contacts/ContactSelection'
import { ContactsStatsSkeleton, ContactsTableSkeleton } from '@/components/contacts/ContactsSkeleton'
import ErrorBoundary from '@/components/ErrorBoundary'

function AgentContactsContent() {
  const navigate = useNavigate()
  const { inboxes, isLoading: isLoadingInboxes } = useAgentInbox()
  
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  
  // Hooks
  const {
    contacts,
    tags,
    loading,
    importing,
    importContacts,
    refreshContacts,
    updateContact,
    deleteContacts,
    addTagsToContacts,
    removeTagsFromContacts,
  } = useAgentContacts()

  const {
    filters,
    filteredContacts,
    updateFilters,
    clearFilters,
    resultCount,
    hasActiveFilters,
  } = useContactFilters(contacts)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  const {
    selectedIds,
    selectedCount,
    selectAll,
    clearSelection,
    selectFiltered,
  } = useContactSelection()

  // Calcular estatísticas
  const stats = useMemo(() => {
    return contactsService.getStats(filteredContacts, tags)
  }, [filteredContacts, tags])

  // Handler para aplicar filtros a partir das estatísticas
  const handleFilterApply = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters)
  }

  // Handler para selecionar todos os contatos filtrados
  const handleSelectAllFiltered = () => {
    selectFiltered(filteredContacts)
    toast.success(`${filteredContacts.length} contato(s) selecionado(s)`)
  }

  // Handler para remover tag de contato
  const handleRemoveTagFromContact = (contactPhone: string, tagId: string) => {
    removeTagsFromContacts([contactPhone], [tagId])
  }

  // Handler para enviar mensagem
  const handleSendMessage = () => {
    if (selectedCount === 0) {
      toast.error('Selecione contatos primeiro')
      return
    }

    try {
      const selectedContacts = contacts.filter(c => selectedIds.has(c.phone))
      
      const contactsForMessaging = selectedContacts.map(c => ({
        id: c.phone,
        phone: c.phone,
        name: c.name,
      }))
      
      // Navegar para chat do agente com contatos pré-selecionados
      navigate('/agent/chat', {
        state: {
          contacts: contactsForMessaging,
        }
      })
      
      toast.success(`${selectedContacts.length} contato(s) selecionado(s) para conversa`)
    } catch (error) {
      console.error('Erro ao enviar para chat:', error)
      toast.error('Erro ao selecionar contatos para conversa')
    }
  }

  // Handler para exportar contatos
  const handleExport = () => {
    const contactsToExport = selectedCount > 0
      ? contacts.filter(c => selectedIds.has(c.phone))
      : filteredContacts

    if (contactsToExport.length === 0) {
      toast.error('Nenhum contato para exportar')
      return
    }

    try {
      const blob = contactsService.exportToCSV(contactsToExport, tags)
      const date = new Date().toISOString().split('T')[0]
      const filename = `contatos-agente-${date}.csv`
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success(`${contactsToExport.length} contato(s) exportado(s) com sucesso`)
    } catch (error: any) {
      console.error('Erro ao exportar contatos:', error)
      toast.error('Erro ao exportar contatos', {
        description: error.message || 'Tente novamente',
      })
    }
  }

  // Handler para exportar todos
  const handleExportAll = () => {
    const contactsToExport = filteredContacts.length > 0 ? filteredContacts : contacts
    try {
      const blob = contactsService.exportToCSV(contactsToExport, tags)
      const date = new Date().toISOString().split('T')[0]
      const filename = `contatos-agente-${date}.csv`
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success(`${contactsToExport.length} contato(s) exportado(s)`)
    } catch (error: any) {
      console.error('Erro ao exportar contatos:', error)
      toast.error('Erro ao exportar contatos', {
        description: error.message || 'Tente novamente',
      })
    }
  }

  // Verificar se tem caixas de entrada
  if (!isLoadingInboxes && inboxes.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 py-3 sm:py-6">
        <EmptyState
          icon={Users}
          title="Nenhuma caixa de entrada atribuída"
          description="Você não tem caixas de entrada atribuídas. Entre em contato com o administrador."
        />
      </div>
    )
  }

  return (
    <div className={cn(
      "w-full max-w-7xl mx-auto overflow-x-hidden px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6 transition-all duration-300",
      selectedCount > 0 && "pb-32 sm:pb-28"
    )}>
      {/* Header */}
      <PageHeader
        title="Contatos"
        subtitle={`Contatos das suas caixas de entrada (${contacts.length} contatos)`}
        actions={[
          {
            label: 'Exportar CSV',
            onClick: handleExportAll,
            variant: 'outline',
            icon: <Download className="h-4 w-4" />,
            disabled: loading || importing || contacts.length === 0,
          },
        ]}
      >
        <Button
          variant="default"
          size="default"
          onClick={importContacts}
          disabled={loading || importing || inboxes.length === 0}
          className="shrink-0"
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Importar da Agenda
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={refreshContacts}
          disabled={loading || importing}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      {loading && contacts.length === 0 ? (
        <ContactsStatsSkeleton />
      ) : (
        <ContactsStats 
          stats={stats} 
          onFilterApply={handleFilterApply}
        />
      )}

      {/* Main Content */}
      <div className="animate-in">
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardHeaderWithIcon
            icon={Users}
            iconColor="text-blue-500"
            title="Seus Contatos"
          >
            <p className="text-sm text-muted-foreground">
              Contatos extraídos das conversas nas suas caixas de entrada
            </p>
          </CardHeaderWithIcon>
          <CardContent>
            {contacts.length === 0 && !loading ? (
              <EmptyState
                icon={Users}
                title="Nenhum contato importado"
                description="Clique no botão abaixo para importar seus contatos da agenda WhatsApp e começar a gerenciá-los"
                action={inboxes.length > 0 ? {
                  label: importing ? "Importando..." : "Importar Contatos",
                  onClick: importContacts,
                  disabled: importing
                } : undefined}
              />
            ) : (
              <div className="space-y-4">
                {/* Filtros */}
                <ContactsFilters
                  filters={filters}
                  onFiltersChange={updateFilters}
                  availableTags={tags}
                  resultCount={resultCount}
                  totalCount={contacts.length}
                  hasActiveFilters={hasActiveFilters}
                  onSelectAllFiltered={handleSelectAllFiltered}
                />

                {/* Tabela */}
                {loading ? (
                  <ContactsTableSkeleton rows={10} />
                ) : (
                  <ContactsTable
                    contacts={filteredContacts}
                    tags={tags}
                    selectedIds={selectedIds}
                    onSelectionChange={(ids) => {
                      const newSelection = new Set(ids)
                      if (newSelection.size === 0) {
                        clearSelection()
                      } else {
                        selectAll(Array.from(newSelection))
                      }
                    }}
                    onContactUpdate={updateContact}
                    onContactDelete={deleteContacts}
                    onAddTagsToContact={addTagsToContacts}
                    onRemoveTagFromContact={handleRemoveTagFromContact}
                    page={currentPage}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Selection Bar */}
      <ContactSelection
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onAddTags={() => toast.info('Gerenciamento de tags não disponível para agentes')}
        onSaveGroup={() => toast.info('Gerenciamento de grupos não disponível para agentes')}
        onSendMessage={handleSendMessage}
        onExport={handleExport}
      />
    </div>
  )
}

// Wrap with ErrorBoundary and AgentInboxProvider
export default function AgentContactsPage() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('AgentContactsPage Error:', { error, errorInfo })
        toast.error('Erro ao carregar página de contatos', {
          description: 'Tente recarregar a página',
        })
      }}
    >
      <AgentInboxProvider>
        <AgentContactsContent />
      </AgentInboxProvider>
    </ErrorBoundary>
  )
}
