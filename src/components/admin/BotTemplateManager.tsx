import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Star, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { automationService } from '@/services/automation';
import { WuzAPIService, type WuzAPIUser } from '@/services/wuzapi';
import { adminUserInboxesService, type UserInbox } from '@/services/admin-user-inboxes';
import type { BotTemplate, BotTemplateInput, InboxAssignment } from '@/types/automation';

const wuzapiService = new WuzAPIService();

export default function BotTemplateManager() {
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [systemUsers, setSystemUsers] = useState<WuzAPIUser[]>([]);
  
  // Estado para adicionar nova inbox
  const [selectedUserId, setSelectedUserId] = useState<string>('none');
  const [selectedInboxId, setSelectedInboxId] = useState<string>('none');
  const [availableInboxes, setAvailableInboxes] = useState<UserInbox[]>([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);
  
  // Cache de nomes para exibição
  const [inboxNamesCache, setInboxNamesCache] = useState<Record<string, string>>({});
  const [userNamesCache, setUserNamesCache] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<BotTemplateInput>({
    name: '',
    description: '',
    outgoingUrl: '',
    includeHistory: false,
    inboxAssignments: []
  });

  useEffect(() => {
    loadTemplates();
    loadSystemUsers();
  }, []);

  // Carregar nomes das inboxes para os templates existentes
  useEffect(() => {
    const loadInboxNamesForTemplates = async () => {
      // Coletar todos os userIds únicos dos templates
      const userIds = new Set<string>();
      templates.forEach(t => {
        if (t.chatwootUserId) userIds.add(t.chatwootUserId);
        t.inboxAssignments?.forEach(a => userIds.add(a.userId));
      });

      // Carregar inboxes de cada usuário
      for (const userId of userIds) {
        try {
          const response = await adminUserInboxesService.getUserInboxes(userId);
          if (response.success && response.data) {
            const newCache: Record<string, string> = {};
            response.data.forEach(inbox => {
              newCache[inbox.id] = inbox.name;
            });
            setInboxNamesCache(prev => ({ ...prev, ...newCache }));
          }
        } catch {
          // Silently fail
        }
      }
    };

    if (templates.length > 0) {
      loadInboxNamesForTemplates();
    }
  }, [templates]);

  // Carregar inboxes quando o usuário for selecionado para adicionar
  useEffect(() => {
    if (selectedUserId && selectedUserId !== 'none') {
      loadUserInboxes(selectedUserId);
    } else {
      setAvailableInboxes([]);
      setSelectedInboxId('none');
    }
  }, [selectedUserId]);

  const loadSystemUsers = async () => {
    try {
      const users = await wuzapiService.getUsers();
      setSystemUsers(users || []);
      // Criar cache de nomes
      const cache: Record<string, string> = {};
      (users || []).forEach(u => { cache[u.id] = u.name; });
      setUserNamesCache(cache);
    } catch (error) {
      console.error('Failed to load system users:', error);
      toast.error('Erro ao carregar usuários do sistema');
    }
  };

  const loadUserInboxes = async (userId: string) => {
    try {
      setLoadingInboxes(true);
      const response = await adminUserInboxesService.getUserInboxes(userId);
      if (response.success && response.data) {
        // Garantir que os IDs sejam strings
        const normalizedInboxes = response.data.map(inbox => ({
          ...inbox,
          id: String(inbox.id)
        }));
        setAvailableInboxes(normalizedInboxes);
        // Atualizar cache de nomes
        const newCache: Record<string, string> = {};
        normalizedInboxes.forEach(inbox => {
          newCache[inbox.id] = inbox.name;
        });
        setInboxNamesCache(prev => ({ ...prev, ...newCache }));
      } else {
        setAvailableInboxes([]);
      }
    } catch (error) {
      console.warn('Failed to load user inboxes:', error);
      setAvailableInboxes([]);
    } finally {
      setLoadingInboxes(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await automationService.getBotTemplates();
      setTemplates(data);
    } catch {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInbox = () => {
    console.log('handleAddInbox called', { selectedUserId, selectedInboxId });
    
    if (!selectedUserId || selectedUserId === 'none' || !selectedInboxId || selectedInboxId === 'none') {
      toast.error('Selecione um usuário e uma caixa de entrada');
      return;
    }

    // Verificar se já existe
    const exists = formData.inboxAssignments?.some(
      a => a.userId === selectedUserId && a.inboxId === selectedInboxId
    );
    if (exists) {
      toast.error('Esta caixa de entrada já foi adicionada');
      return;
    }

    const userName = userNamesCache[selectedUserId] || selectedUserId;
    const inboxName = inboxNamesCache[selectedInboxId] || selectedInboxId;

    console.log('Adding inbox assignment', { userId: selectedUserId, userName, inboxId: selectedInboxId, inboxName });

    const newAssignment: InboxAssignment = {
      userId: selectedUserId,
      userName,
      inboxId: selectedInboxId,
      inboxName
    };

    setFormData(prev => {
      const updated = {
        ...prev,
        inboxAssignments: [...(prev.inboxAssignments || []), newAssignment]
      };
      console.log('Updated formData', updated);
      return updated;
    });

    // Limpar seleção
    setSelectedUserId('none');
    setSelectedInboxId('none');
    setAvailableInboxes([]);
    
    toast.success('Caixa de entrada adicionada');
  };

  const handleRemoveInbox = (index: number) => {
    setFormData(prev => ({
      ...prev,
      inboxAssignments: prev.inboxAssignments?.filter((_, i) => i !== index) || []
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.outgoingUrl.trim()) {
      toast.error('Nome e URL são obrigatórios');
      return;
    }

    try {
      if (editingId) {
        await automationService.updateBotTemplate(editingId, formData);
        toast.success('Template atualizado');
      } else {
        await automationService.createBotTemplate(formData);
        toast.success('Template criado');
      }
      resetForm();
      loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar template');
    }
  };

  const handleEdit = async (template: BotTemplate) => {
    // Converter formato legado para novo formato se necessário
    let assignments: InboxAssignment[] = template.inboxAssignments || [];
    
    // Se tem formato legado e não tem novo formato, converter
    if (template.chatwootUserId && template.chatwootInboxId && assignments.length === 0) {
      assignments = [{
        userId: template.chatwootUserId,
        userName: userNamesCache[template.chatwootUserId] || template.chatwootUserId,
        inboxId: template.chatwootInboxId,
        inboxName: inboxNamesCache[template.chatwootInboxId] || template.chatwootInboxId
      }];
    }
    
    setFormData({
      name: template.name,
      description: template.description || '',
      outgoingUrl: template.outgoingUrl,
      includeHistory: template.includeHistory,
      inboxAssignments: assignments
    });
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await automationService.deleteBotTemplate(deleteId);
      toast.success('Template excluído');
      loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir template');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await automationService.setDefaultBotTemplate(id);
      toast.success('Template definido como padrão');
      loadTemplates();
    } catch {
      toast.error('Erro ao definir template padrão');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', outgoingUrl: '', includeHistory: false, inboxAssignments: [] });
    setSelectedUserId('none');
    setSelectedInboxId('none');
    setAvailableInboxes([]);
    setEditingId(null);
    setShowForm(false);
  };

  // Helper para exibir inboxes na tabela
  const getInboxDisplay = (template: BotTemplate) => {
    const assignments = template.inboxAssignments || [];
    
    // Se tem formato legado
    if (template.chatwootUserId && template.chatwootInboxId && assignments.length === 0) {
      const userName = userNamesCache[template.chatwootUserId] || '';
      const inboxName = inboxNamesCache[template.chatwootInboxId] || template.chatwootInboxId;
      return `${userName ? userName + ': ' : ''}${inboxName}`;
    }
    
    if (assignments.length === 0) return '-';
    if (assignments.length === 1) {
      const a = assignments[0];
      const userName = a.userName || userNamesCache[a.userId] || '';
      const inboxName = a.inboxName || inboxNamesCache[a.inboxId] || a.inboxId;
      return `${userName ? userName + ': ' : ''}${inboxName}`;
    }
    return `${assignments.length} caixas`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Templates de Bot</CardTitle>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingId ? 'Editar Template' : 'Novo Template'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <Input
                    value={formData.outgoingUrl}
                    onChange={(e) => setFormData({ ...formData, outgoingUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              {/* Seção de Caixas de Entrada */}
              <div className="space-y-3">
                <Label>Caixas de Entrada</Label>
                
                {/* Lista de inboxes adicionadas */}
                {formData.inboxAssignments && formData.inboxAssignments.length > 0 && (
                  <div className="space-y-2">
                    {formData.inboxAssignments.map((assignment, index) => {
                      const userName = assignment.userName || userNamesCache[assignment.userId] || assignment.userId;
                      const inboxName = assignment.inboxName || inboxNamesCache[assignment.inboxId] || assignment.inboxId;
                      return (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <Badge variant="outline">{userName}</Badge>
                          <span className="text-sm">{inboxName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-6 w-6 p-0"
                            onClick={() => handleRemoveInbox(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Formulário para adicionar nova inbox */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Usuário</Label>
                    <Select value={selectedUserId} onValueChange={(value) => {
                      console.log('User selected:', value);
                      setSelectedUserId(value);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione...</SelectItem>
                        {systemUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Caixa de Entrada</Label>
                    <Select
                      value={selectedInboxId}
                      onValueChange={(value) => {
                        console.log('Inbox selected:', value);
                        setSelectedInboxId(value);
                      }}
                      disabled={!selectedUserId || selectedUserId === 'none' || loadingInboxes || (availableInboxes.length === 0 && !loadingInboxes && selectedUserId !== 'none')}
                    >
                      <SelectTrigger>
                        {loadingInboxes ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Carregando...</span>
                          </div>
                        ) : availableInboxes.length === 0 && selectedUserId !== 'none' ? (
                          <span className="text-muted-foreground">Nenhuma inbox disponível</span>
                        ) : (
                          <SelectValue placeholder={selectedUserId !== 'none' ? "Selecione..." : "Selecione um usuário"} />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {availableInboxes.length === 0 ? (
                          <SelectItem value="none" disabled>Nenhuma inbox disponível</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {availableInboxes.map((inbox) => (
                              <SelectItem key={inbox.id} value={inbox.id}>
                                {inbox.name} {inbox.wuzapiConnected && <Badge variant="outline" className="ml-2 text-xs">Conectado</Badge>}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddInbox}
                    disabled={!selectedUserId || selectedUserId === 'none' || !selectedInboxId || selectedInboxId === 'none'}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.includeHistory}
                  onCheckedChange={(checked) => setFormData({ ...formData, includeHistory: checked })}
                />
                <Label>Incluir histórico de mensagens</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhum template cadastrado
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Caixas de Entrada</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead className="w-[150px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {template.name}
                      {template.isDefault && (
                        <Badge variant="secondary">
                          <Star className="h-3 w-3 mr-1" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {template.outgoingUrl}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getInboxDisplay(template)}
                  </TableCell>
                  <TableCell>{template.includeHistory ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!template.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(template.id)}
                          title="Definir como padrão"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(template.id)}
                        disabled={template.isDefault}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
