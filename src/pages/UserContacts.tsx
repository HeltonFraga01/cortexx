/**
 * UserContacts Page
 * 
 * Página principal de gerenciamento de contatos do usuário.
 * Usa API backend com Supabase para persistência.
 * Permite importar, visualizar, filtrar, organizar e selecionar contatos.
 * 
 * Requirements: 1.5, 6.1, 6.2, 6.3, 6.4, 8.1, 8.3
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Download, FolderPlus, AlertTriangle, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardHeaderWithIcon, EmptyState } from '@/components/ui-custom';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { useContacts, Contact, Tag, ContactGroup } from '@/hooks/useContacts';
import { useContactFilters } from '@/hooks/useContactFilters';
import { useContactSelection } from '@/hooks/useContactSelection';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import { ContactsFilters } from '@/components/contacts/ContactsFilters';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { ContactsStats } from '@/components/contacts/ContactsStats';
import { ContactSelection } from '@/components/contacts/ContactSelection';
import { ContactTagsManager } from '@/components/contacts/ContactTagsManager';
import { ContactGroupsSidebar } from '@/components/contacts/ContactGroupsSidebar';
import { ContactGroupForm } from '@/components/contacts/ContactGroupForm';
import { ContactImportButton } from '@/components/contacts/ContactImportButton';
import { ContactUserCreationForm } from '@/components/contacts/ContactUserCreationForm';
import { ContactsStatsSkeleton, ContactsTableSkeleton } from '@/components/contacts/ContactsSkeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

// Migration banner component
function MigrationBanner({ 
  onMigrate, 
  onDismiss, 
  isLoading 
}: { 
  onMigrate: () => void; 
  onDismiss: () => void; 
  isLoading: boolean;
}) {
  return (
    <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
            <Database className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-medium text-amber-800 dark:text-amber-200">
              Dados locais encontrados
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Encontramos contatos salvos localmente no seu navegador. 
              Deseja migrar esses dados para o servidor? Isso permitirá acessar 
              seus contatos de qualquer dispositivo.
            </p>
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                onClick={onMigrate}
                disabled={isLoading}
              >
                {isLoading ? 'Migrando...' : 'Migrar dados'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onDismiss}
                disabled={isLoading}
              >
                Ignorar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserContactsContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const brandingConfig = useBrandingConfig();
  
  // UI state
  const [showTagsManager, setShowTagsManager] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showUserCreation, setShowUserCreation] = useState(false);
  
  // Contacts hook with API
  const {
    contacts,
    tags,
    groups,
    stats,
    total,
    page,
    pageSize,
    loading,
    error,
    hasLocalStorageData,
    migrationPending,
    migrateFromLocalStorage,
    dismissMigration,
    loadContacts,
    createContact,
    updateContact,
    deleteContacts,
    importContacts,
    loadTags,
    addTag,
    removeTag,
    addTagsToContacts,
    removeTagsFromContacts,
    loadGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addContactsToGroup,
    removeContactsFromGroup,
    refreshContacts,
  } = useContacts();

  // Filters hook (client-side filtering for current page)
  const {
    filters,
    filteredContacts,
    updateFilters,
    clearFilters,
    resultCount,
    hasActiveFilters,
  } = useContactFilters(contacts);

  // Selection hook
  const {
    selectedIds,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
    selectFiltered,
  } = useContactSelection();

  // Use stats from server - no need to calculate locally
  // The stats object from useContacts already has: total, withName, withoutName, totalTags

  // Handle page change - reload from server
  const handlePageChange = useCallback((newPage: number) => {
    loadContacts({ 
      page: newPage, 
      pageSize,
      search: filters.search || undefined,
      hasName: filters.hasName ?? undefined,
      tagIds: filters.tags.length > 0 ? filters.tags : undefined,
    });
  }, [loadContacts, pageSize, filters]);

  // Handle filter changes - reload from server with filters
  useEffect(() => {
    if (hasActiveFilters) {
      loadContacts({
        page: 1,
        pageSize,
        search: filters.search || undefined,
        hasName: filters.hasName ?? undefined,
        tagIds: filters.tags.length > 0 ? filters.tags : undefined,
      });
    }
  }, [filters.search, filters.hasName, filters.tags, hasActiveFilters, loadContacts, pageSize]);

  // Handle import from WhatsApp
  const handleImportComplete = useCallback(async (importedContacts: Array<{ phone: string; name?: string }>) => {
    try {
      await importContacts(importedContacts.map(c => ({
        phone: c.phone,
        name: c.name,
      })));
    } catch {
      // Error already handled in hook
    }
  }, [importContacts]);

  // Handle migration
  const handleMigrate = useCallback(async () => {
    try {
      await migrateFromLocalStorage();
    } catch {
      // Error already handled in hook
    }
  }, [migrateFromLocalStorage]);

  // Handle filter apply from stats
  const handleFilterApply = useCallback((newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  }, [updateFilters]);

  // Handle select all filtered
  const handleSelectAllFiltered = useCallback(() => {
    selectFiltered(filteredContacts.map(c => ({ phone: c.phone })));
    toast.success(`${filteredContacts.length} contato(s) selecionado(s)`);
  }, [selectFiltered, filteredContacts]);

  // Tags handlers
  const handleAddTags = useCallback(() => {
    setShowTagsManager(true);
  }, []);

  const handleApplyTags = useCallback(async (tagIds: string[]) => {
    const selectedContactIds = contacts
      .filter(c => selectedIds.has(c.phone))
      .map(c => c.id);
    
    if (selectedContactIds.length > 0) {
      await addTagsToContacts(selectedContactIds, tagIds);
    }
    setShowTagsManager(false);
  }, [contacts, selectedIds, addTagsToContacts]);

  const handleCreateTag = useCallback(async (tag: { name: string; color?: string }) => {
    await addTag(tag);
  }, [addTag]);

  const handleRemoveTagFromContact = useCallback(async (contactPhone: string, tagId: string) => {
    const contact = contacts.find(c => c.phone === contactPhone);
    if (contact) {
      await removeTagsFromContacts([contact.id], [tagId]);
    }
  }, [contacts, removeTagsFromContacts]);

  // Group handlers
  const handleSaveGroup = useCallback(() => {
    setShowGroupForm(true);
  }, []);

  const handleCreateGroup = useCallback(async (name: string, contactIds: string[]) => {
    await createGroup({ name });
    // TODO: Add contacts to group after creation
    setShowGroupForm(false);
  }, [createGroup]);

  const handleSelectGroup = useCallback((group: ContactGroup) => {
    // Select all contacts in the group
    // Note: This would need the group members to be loaded
    toast.info('Seleção de grupo em desenvolvimento');
  }, []);

  // Send message handler
  const handleSendMessage = useCallback(() => {
    if (selectedCount === 0) {
      toast.error('Selecione contatos primeiro');
      return;
    }

    const selectedContacts = contacts.filter(c => selectedIds.has(c.phone));
    
    const contactsForMessaging = selectedContacts.map(c => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
    }));
    
    navigate('/user/mensagens', {
      state: { contacts: contactsForMessaging }
    });
    
    toast.success(`${selectedContacts.length} contato(s) adicionado(s) ao envio`);
  }, [selectedCount, contacts, selectedIds, navigate]);

  // User creation handler
  const handleUserCreationSuccess = useCallback((userData: { name: string; token: string; phone: string }) => {
    toast.success('Usuário criado com sucesso!', {
      description: `Token: ${userData.token.substring(0, 12)}...`
    });
    setShowUserCreation(false);
  }, []);

  // Export handler
  const handleExport = useCallback(() => {
    const contactsToExport = selectedCount > 0
      ? contacts.filter(c => selectedIds.has(c.phone))
      : filteredContacts;

    if (contactsToExport.length === 0) {
      toast.error('Nenhum contato para exportar');
      return;
    }

    try {
      // Generate CSV
      const headers = ['phone', 'name', 'tags'];
      const rows = contactsToExport.map(c => [
        c.phone,
        c.name || '',
        c.tags?.map(t => t.name).join(';') || ''
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    } catch (err) {
      toast.error('Erro ao exportar contatos');
    }
  }, [selectedCount, contacts, selectedIds, filteredContacts]);

  // Contact update handler (adapts old interface to new)
  const handleContactUpdate = useCallback(async (phone: string, updates: Partial<Contact>) => {
    const contact = contacts.find(c => c.phone === phone);
    if (contact) {
      await updateContact(contact.id, {
        name: updates.name,
        phone: updates.phone,
      });
    }
  }, [contacts, updateContact]);

  // Contact delete handler (adapts old interface to new)
  const handleContactDelete = useCallback(async (phones: string[]) => {
    const contactIds = contacts
      .filter(c => phones.includes(c.phone))
      .map(c => c.id);
    
    if (contactIds.length > 0) {
      await deleteContacts(contactIds);
    }
  }, [contacts, deleteContacts]);

  // Add tags to contact handler (adapts old interface)
  const handleAddTagsToContact = useCallback(async (contactPhones: string[], tagIds: string[]) => {
    const contactIds = contacts
      .filter(c => contactPhones.includes(c.phone))
      .map(c => c.id);
    
    if (contactIds.length > 0) {
      await addTagsToContacts(contactIds, tagIds);
    }
  }, [contacts, addTagsToContacts]);

  // Calculate total pages
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className={cn(
      "w-full max-w-7xl mx-auto overflow-x-hidden px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6 transition-all duration-300",
      selectedCount > 0 && "pb-32 sm:pb-28"
    )}>
      {/* Header */}
      <PageHeader
        title="Gerenciamento de Contatos"
        subtitle={`Organize e gerencie seus contatos da agenda ${brandingConfig.appName}`}
        actions={[
          {
            label: 'Exportar CSV',
            onClick: handleExport,
            variant: 'outline',
            icon: <Download className="h-4 w-4" />,
            disabled: loading || contacts.length === 0,
          },
          {
            label: 'Criar Usuário',
            onClick: () => setShowUserCreation(true),
            variant: 'outline',
            icon: <Users className="h-4 w-4" />,
            disabled: loading,
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

      {/* Migration Banner */}
      {migrationPending && (
        <MigrationBanner
          onMigrate={handleMigrate}
          onDismiss={dismissMigration}
          isLoading={loading}
        />
      )}

      {/* Error Banner */}
      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button size="sm" variant="outline" onClick={refreshContacts}>
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {loading && contacts.length === 0 ? (
        <ContactsStatsSkeleton />
      ) : (
        <ContactsStats 
          stats={stats} 
          onFilterApply={handleFilterApply}
        />
      )}

      {/* Main Content with Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in">
        {/* Groups Sidebar */}
        {contacts.length > 0 && (
          <div className="lg:col-span-1 animate-in">
            <ContactGroupsSidebar
              groups={groups}
              onCreateGroup={handleCreateGroup}
              onUpdateGroup={(id, updates) => updateGroup(id, updates)}
              onDeleteGroup={deleteGroup}
              onSelectGroup={handleSelectGroup}
              selectedContactIds={Array.from(selectedIds)}
            />
          </div>
        )}

        {/* Main Content */}
        <div className={contacts.length > 0 ? "lg:col-span-3 animate-in" : "lg:col-span-4 animate-in"}>
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeaderWithIcon
              icon={Users}
              iconColor="text-blue-500"
              title="Seus Contatos"
            >
              <p className="text-sm text-muted-foreground">
                {total > 0 
                  ? `${total} contato(s) no total • Página ${page} de ${totalPages}`
                  : `Importe contatos da agenda ${brandingConfig.appName} para começar`
                }
              </p>
            </CardHeaderWithIcon>
            <CardContent>
              {contacts.length === 0 && !loading ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum contato importado"
                  description={!user?.token 
                    ? 'Faça login para importar contatos da sua agenda do WhatsApp'
                    : `Clique no botão acima para importar seus contatos da agenda ${brandingConfig.appName}`
                  }
                />
              ) : (
                <div className="space-y-4">
                  {/* Filters */}
                  <ContactsFilters
                    filters={filters}
                    onFiltersChange={updateFilters}
                    availableTags={tags}
                    resultCount={resultCount}
                    totalCount={total}
                    hasActiveFilters={hasActiveFilters}
                    onSelectAllFiltered={handleSelectAllFiltered}
                  />

                  {/* Tags Manager inline */}
                  {showTagsManager && (
                    <ContactTagsManager
                      availableTags={tags}
                      selectedContactsCount={selectedCount}
                      onAddTags={handleApplyTags}
                      onCreateTag={handleCreateTag}
                      onClose={() => setShowTagsManager(false)}
                    />
                  )}

                  {/* Group Form inline */}
                  {showGroupForm && (
                    <ContactGroupForm
                      selectedContactsCount={selectedCount}
                      selectedContactIds={Array.from(selectedIds)}
                      onCreateGroup={handleCreateGroup}
                      onClose={() => setShowGroupForm(false)}
                    />
                  )}

                  {/* User Creation Form inline */}
                  {showUserCreation && (
                    <ContactUserCreationForm
                      onSuccess={handleUserCreationSuccess}
                      onCancel={() => setShowUserCreation(false)}
                    />
                  )}

                  {/* Table */}
                  {loading ? (
                    <ContactsTableSkeleton rows={10} />
                  ) : (
                    <ContactsTable
                      contacts={filteredContacts}
                      tags={tags}
                      selectedIds={selectedIds}
                      onSelectionChange={(ids) => {
                        const newSelection = new Set(ids);
                        if (newSelection.size === 0) {
                          clearSelection();
                        } else {
                          selectAll(Array.from(newSelection));
                        }
                      }}
                      onContactUpdate={handleContactUpdate}
                      onContactDelete={handleContactDelete}
                      onAddTagsToContact={handleAddTagsToContact}
                      onRemoveTagFromContact={handleRemoveTagFromContact}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={handlePageChange}
                      totalPages={totalPages}
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
