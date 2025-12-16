/**
 * ContactGroupsSidebar Component
 * 
 * Sidebar para gerenciar grupos de contatos salvos.
 * Permite criar, editar, deletar e selecionar grupos inline.
 */

import { useState } from 'react';
import { FolderPlus, Edit2, Trash2, Users, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContactGroup } from '@/services/contactsStorageService';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface ContactGroupsSidebarProps {
  groups: ContactGroup[];
  onCreateGroup: (name: string, contactIds: string[]) => void;
  onUpdateGroup: (groupId: string, updates: Partial<ContactGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onSelectGroup: (group: ContactGroup) => void;
  selectedContactIds: string[];
}

export function ContactGroupsSidebar({
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSelectGroup,
  selectedContactIds,
}: ContactGroupsSidebarProps) {
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Criar novo grupo
  const handleCreateGroup = () => {
    if (newGroupName.trim() && selectedContactIds.length > 0) {
      onCreateGroup(newGroupName.trim(), selectedContactIds);
      setNewGroupName('');
      setShowNewGroupForm(false);
    }
  };

  // Cancelar criação
  const handleCancelCreate = () => {
    setNewGroupName('');
    setShowNewGroupForm(false);
  };

  // Iniciar edição
  const handleStartEdit = (group: ContactGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  // Salvar edição
  const handleSaveEdit = () => {
    if (editingGroupId && editingGroupName.trim()) {
      onUpdateGroup(editingGroupId, { name: editingGroupName.trim() });
      setEditingGroupId(null);
      setEditingGroupName('');
    }
  };

  // Cancelar edição
  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  // Deletar grupo com confirmação
  const handleDeleteGroup = async (group: ContactGroup) => {
    const confirmed = await confirm({
      title: 'Confirmar Exclusão',
      description: `Tem certeza que deseja excluir o grupo "${group.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (confirmed) {
      onDeleteGroup(group.id);
    }
  };

  return (
    <>
      <Card role="region" aria-label="Grupos de contatos salvos">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              Grupos Salvos
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewGroupForm(true)}
              disabled={selectedContactIds.length === 0 || showNewGroupForm}
              aria-label={selectedContactIds.length === 0 ? 'Selecione contatos primeiro para criar um grupo' : 'Criar novo grupo'}
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Formulário de novo grupo inline */}
          {showNewGroupForm && (
            <div className="p-3 border rounded-md bg-muted/50 space-y-2 animate-slide-in" role="form" aria-label="Criar novo grupo">
              <p className="text-sm font-medium" id="new-group-label">
                Novo Grupo ({selectedContactIds.length} {selectedContactIds.length === 1 ? 'contato' : 'contatos'})
              </p>
              <Input
                placeholder="Nome do grupo"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup();
                  if (e.key === 'Escape') handleCancelCreate();
                }}
                autoFocus
                aria-label="Nome do novo grupo"
                aria-describedby="new-group-label"
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelCreate}
                  aria-label="Cancelar criação de grupo"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  aria-label="Criar grupo"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* Lista de grupos */}
          {groups.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8" role="status">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
              <p>Nenhum grupo salvo</p>
              <p className="text-xs mt-1">
                Selecione contatos e clique em + para criar
              </p>
            </div>
          ) : (
            <nav className="space-y-1" aria-label="Lista de grupos">
              {groups.map(group => (
                <div
                  key={group.id}
                  className="p-2 rounded-md border hover:bg-accent transition-colors"
                >
                  {editingGroupId === group.id ? (
                    // Modo de edição inline
                    <div className="space-y-2" role="form" aria-label={`Editar grupo ${group.name}`}>
                      <Input
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="h-8"
                        autoFocus
                        aria-label={`Editar nome do grupo ${group.name}`}
                      />
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          aria-label="Cancelar edição"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={!editingGroupName.trim()}
                          aria-label="Salvar alterações"
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Modo de visualização
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => onSelectGroup(group)}
                        className="flex-1 text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded p-1"
                        aria-label={`Selecionar grupo ${group.name} com ${group.contactIds.length} contato${group.contactIds.length !== 1 ? 's' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">
                            {group.name}
                          </span>
                          <Badge variant="secondary" className="text-xs ml-2" aria-label={`${group.contactIds.length} contatos`}>
                            {group.contactIds.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(group.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </button>
                      <div className="flex items-center gap-1" role="group" aria-label="Ações do grupo">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(group)}
                          aria-label={`Editar nome do grupo ${group.name}`}
                        >
                          <Edit2 className="h-3 w-3" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGroup(group)}
                          className="text-destructive hover:text-destructive"
                          aria-label={`Excluir grupo ${group.name}`}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog />
    </>
  );
}
