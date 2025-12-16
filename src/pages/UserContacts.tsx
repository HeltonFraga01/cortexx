/**
 * UserContacts Page
 * 
 * Página principal de gerenciamento de contatos do usuário.
 * Permite importar, visualizar, filtrar, organizar e selecionar contatos
 * da agenda WUZAPI para envio de mensagens.
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Download, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { CardHeaderWithIcon, EmptyState } from '@/components/ui-custom';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { useContacts } from '@/hooks/useContacts';
import { useContactFilters } from '@/hooks/useContactFilters';
import { useContactSelection } from '@/hooks/useContactSelection';
import { contactsService } from '@/services/contactsService';
import { contactsStorageService } from '@/services/contactsStorageService';
import { useAuth } from '@/contexts/AuthContext';
import { useWuzAPIInstances } from '@/contexts/WuzAPIInstancesContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import { ContactsFilters } from '@/components/contacts/ContactsFilters';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { ContactsStats } from '@/components/contacts/ContactsStats';
import { ContactSelection } from '@/components/contacts/ContactSelection';
import { ContactTagsManager } from '@/components/contacts/ContactTagsManager';
import { ContactGroupsSidebar } from '@/components/contacts/ContactGroupsSidebar';
import { ContactGroupForm } from '@/components/contacts/ContactGroupForm';
import { ContactImportButton } from '@/components/contacts/ContactImportButton';
import { ContactsStatsSkeleton, ContactsTableSkeleton } from '@/components/contacts/ContactsSkeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

function UserContactsContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedInstance } = useWuzAPIInstances();
  const brandingConfig = useBrandingConfig();
  
  // Carregar preferências salvas ou usar valores padrão
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const savedPreferences = contactsStorageService.loadPreferences();
      return savedPreferences?.currentPage || 1;
    } catch (err) {
      console.error('Erro ao carregar preferências:', err);
      return 1;
    }
  });
  const [pageSize] = useState(() => {
    try {
      const savedPreferences = contactsStorageService.loadPreferences();
      return savedPreferences?.pageSize || 50;
    } catch (err) {
      console.error('Erro ao carregar preferências:', err);
      return 50;
    }
  });
  const [showTagsManager, setShowTagsManager] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  
  // Hooks
  const {
    contacts,
    tags,
    groups,
    loading,
    importContacts,
    updateContact,
    deleteContacts,
    addTag,
    addTagsToContacts,
    removeTagsFromContacts,
    createGroup,
    updateGroup,
    deleteGroup,
  } = useContacts();

  const {
    filters,
    filteredContacts,
    updateFilters,
    clearFilters,
    resultCount,
    hasActiveFilters,
  } = useContactFilters(contacts);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Salvar preferências quando página ou filtros mudarem
  useEffect(() => {
    try {
      const preferences = {
        pageSize,
        currentPage,
        filters,
        lastUpdated: new Date(),
      };
      contactsStorageService.savePreferences(preferences);
    } catch (err: any) {
      console.error('Erro ao salvar preferências:', {
        error: err,
        message: err.message,
      });
      // Não mostrar toast para evitar spam
    }
  }, [currentPage, pageSize, filters]);

  const {
    selectedIds,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
    selectFiltered,
  } = useContactSelection();

  // Calcular estatísticas com memoization
  const stats = useMemo(() => {
    return contactsService.getStats(filteredContacts, tags);
  }, [filteredContacts, tags]);

  // Memoizar contatos paginados para evitar recálculos desnecessários
  const paginatedData = useMemo(() => {
    return contactsService.paginateContacts(filteredContacts, currentPage, pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  // Handler de importação - callback para quando a importação for concluída
  const handleImportComplete = async (contacts: any[], total: number) => {
    // O ContactImportButton já fez a importação via API
    // Aqui apenas chamamos o hook para fazer o merge e atualizar o estado
    if (user?.token) {
      await importContacts(user.token, user.token);
    }
  };

  // Handler para disparar importação do EmptyState
  const handleTriggerImport = async () => {
    if (user?.token) {
      try {
        await importContacts(user.token, user.token);
      } catch (err) {
        // Erro já tratado no hook
      }
    }
  };

  // Handler para aplicar filtros a partir das estatísticas
  const handleFilterApply = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  };

  // Handler para selecionar todos os contatos filtrados
  const handleSelectAllFiltered = () => {
    selectFiltered(filteredContacts);
    toast.success(`${filteredContacts.length} contato(s) selecionado(s)`);
  };

  // Handlers para ações em massa
  const handleAddTags = () => {
    setShowTagsManager(true);
  };

  const handleApplyTags = (tagIds: string[]) => {
    const selectedPhones = Array.from(selectedIds);
    addTagsToContacts(selectedPhones, tagIds);
    setShowTagsManager(false);
  };

  const handleCreateTag = (tag: Omit<import('@/services/contactsStorageService').Tag, 'id'>) => {
    addTag(tag);
  };

  const handleRemoveTagFromContact = (contactPhone: string, tagId: string) => {
    removeTagsFromContacts([contactPhone], [tagId]);
  };

  const handleSaveGroup = () => {
    setShowGroupForm(true);
  };

  const handleCreateGroup = (name: string, contactIds: string[]) => {
    createGroup(name, contactIds);
    setShowGroupForm(false);
  };

  const handleSelectGroup = (group: import('@/services/contactsStorageService').ContactGroup) => {
    // Selecionar todos os contatos do grupo
    selectAll(group.contactIds);
  };

  const handleSendMessage = () => {
    if (selectedCount === 0) {
      toast.error('Selecione contatos primeiro');
      return;
    }

    try {
      // Obter contatos selecionados da lista completa (não filtrada)
      const selectedContacts = contacts.filter(c => selectedIds.has(c.phone));
      
      // Validar que encontramos todos os contatos selecionados
      if (selectedContacts.length !== selectedCount) {
        console.warn(
          `Selection mismatch: expected ${selectedCount} contacts, found ${selectedContacts.length}`,
          {
            selectedIds: Array.from(selectedIds),
            foundPhones: selectedContacts.map(c => c.phone),
          }
        );
        toast.warning(
          `Alguns contatos selecionados não foram encontrados. ` +
          `Enviando ${selectedContacts.length} de ${selectedCount} contatos.`
        );
      }
      
      // Converter para formato esperado pelo SendFlow
      const contactsForMessaging = selectedContacts.map(c => ({
        id: c.phone,
        phone: c.phone,
        name: c.name,
      }));
      
      // Navegar para a nova página de mensagens com contatos pré-selecionados
      navigate('/user/mensagens', {
        state: {
          contacts: contactsForMessaging,
        }
      });
      
      toast.success(`${selectedContacts.length} contato(s) adicionado(s) ao envio`);
    } catch (error) {
      console.error('Erro ao enviar para mensagens:', error);
      toast.error('Erro ao enviar contatos para mensagens');
    }
  };

  const handleExport = () => {
    const contactsToExport = selectedCount > 0
      ? contacts.filter(c => selectedIds.has(c.phone))
      : filteredContacts;

    if (contactsToExport.length === 0) {
      toast.error('Nenhum contato para exportar');
      return;
    }

    try {
      // Gerar CSV
      const blob = contactsService.exportToCSV(contactsToExport, tags);
      
      // Criar nome do arquivo com data atual
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `contatos-${date}.csv`;
      
      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${contactsToExport.length} contato(s) exportado(s) com sucesso`);
    } catch (error: any) {
      console.error('Erro ao exportar contatos:', {
        error,
        message: error.message,
        contactCount: contactsToExport.length,
        stack: error.stack,
      });
      toast.error('Erro ao exportar contatos', {
        description: error.message || 'Tente novamente',
      });
    }
  };

  // Handler para exportar contatos
  const handleExportAll = () => {
    const contactsToExport = filteredContacts.length > 0 ? filteredContacts : contacts;
    try {
      const blob = contactsService.exportToCSV(contactsToExport, tags);
      const date = new Date().toISOString().split('T')[0];
      const filename = `contatos-${date}.csv`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`${contactsToExport.length} contato(s) exportado(s)`);
    } catch (error: any) {
      console.error('Erro ao exportar contatos:', error);
      toast.error('Erro ao exportar contatos', {
        description: error.message || 'Tente novamente',
      });
    }
  };

  return (
    <div className={cn(
      "w-full max-w-full max-w-7xl mx-auto overflow-x-hidden px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6 transition-all duration-300",
      selectedCount > 0 && "pb-32 sm:pb-28"
    )}>
      {/* Header */}
      <PageHeader
        title="Gerenciamento de Contatos"
        subtitle={`Organize e gerencie seus contatos da agenda ${brandingConfig.appName}`}
        actions={[
          {
            label: 'Exportar CSV',
            onClick: handleExportAll,
            variant: 'outline',
            icon: <Download className="h-4 w-4" />,
            disabled: loading || contacts.length === 0,
          },
          {
            label: 'Novo Grupo',
            onClick: () => setShowGroupForm(true),
            variant: 'outline',
            icon: <FolderPlus className="h-4 w-4" />,
            disabled: loading || selectedCount === 0,
          },
        ]}
      >
        <ContactImportButton
          instance={user?.token || ''}
          userToken={user?.token || ''}
          onImportComplete={handleImportComplete}
          disabled={loading || !user?.token}
          variant="default"
          size="default"
          className="shrink-0"
        />
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

      {/* Main Content com Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in">
        {/* Sidebar de Grupos */}
        {contacts.length > 0 && (
          <div className="lg:col-span-1 animate-in">
            <ContactGroupsSidebar
              groups={groups}
              onCreateGroup={handleCreateGroup}
              onUpdateGroup={updateGroup}
              onDeleteGroup={deleteGroup}
              onSelectGroup={handleSelectGroup}
              selectedContactIds={Array.from(selectedIds)}
            />
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className={contacts.length > 0 ? "lg:col-span-3 animate-in" : "lg:col-span-4 animate-in"}>
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeaderWithIcon
              icon={Users}
              iconColor="text-blue-500"
              title="Seus Contatos"
            >
              <p className="text-sm text-muted-foreground">Importe contatos da agenda {brandingConfig.appName} para começar</p>
            </CardHeaderWithIcon>
            <CardContent>
              {contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum contato importado"
              description={!user?.token 
                ? 'Faça login para importar contatos da sua agenda do WhatsApp'
                : `Clique no botão abaixo para importar seus contatos da agenda ${brandingConfig.appName} e começar a gerenciá-los`
              }
              action={user?.token ? {
                label: "Importar Contatos",
                onClick: handleTriggerImport
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

              {/* Gerenciador de Tags inline */}
              {showTagsManager && (
                <ContactTagsManager
                  availableTags={tags}
                  selectedContactsCount={selectedCount}
                  onAddTags={handleApplyTags}
                  onCreateTag={handleCreateTag}
                  onClose={() => setShowTagsManager(false)}
                />
              )}

              {/* Formulário de Grupo inline */}
              {showGroupForm && (
                <ContactGroupForm
                  selectedContactsCount={selectedCount}
                  selectedContactIds={Array.from(selectedIds)}
                  onCreateGroup={handleCreateGroup}
                  onClose={() => setShowGroupForm(false)}
                />
              )}

              {/* Tabela */}
              {loading ? (
                <ContactsTableSkeleton rows={10} />
              ) : (
                <ContactsTable
                  contacts={filteredContacts}
                  tags={tags}
                  selectedIds={selectedIds}
                  onSelectionChange={(ids) => {
                    // Atualizar seleção
                    const newSelection = new Set(ids);
                    if (newSelection.size === 0) {
                      clearSelection();
                    } else {
                      selectAll(Array.from(newSelection));
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
      </div>

      {/* Floating Selection Bar */}
      <ContactSelection
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onAddTags={handleAddTags}
        onSaveGroup={handleSaveGroup}
        onSendMessage={handleSendMessage}
        onExport={handleExport}
      />
    </div>
  );
}

// Wrap with ErrorBoundary
export default function UserContacts() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('UserContacts Error:', { error, errorInfo });
        toast.error('Erro ao carregar página de contatos', {
          description: 'Tente recarregar a página',
        });
      }}
    >
      <UserContactsContent />
    </ErrorBoundary>
  );
}
