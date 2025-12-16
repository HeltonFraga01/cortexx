import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Shield, Check, X, Search, Database } from 'lucide-react';
import { toast } from 'sonner';
import { tablePermissionsService, TablePermission } from '@/services/table-permissions';

export default function TablePermissionsManager() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<TablePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    user_id: '',
    table_name: '',
    can_read: false,
    can_write: false,
    can_delete: false,
  });

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await tablePermissionsService.getPermissions();
      
      if (response.success && response.data) {
        setPermissions(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleStartEdit = (permission: TablePermission) => {
    setEditingId(permission.id);
    setFormData({
      user_id: permission.user_id,
      table_name: permission.table_name,
      can_read: permission.can_read === 1,
      can_write: permission.can_write === 1,
      can_delete: permission.can_delete === 1,
    });
    setShowNewForm(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowNewForm(false);
    setFormData({
      user_id: '',
      table_name: '',
      can_read: false,
      can_write: false,
      can_delete: false,
    });
  };

  const handleShowNewForm = () => {
    setShowNewForm(true);
    setEditingId(null);
    setFormData({
      user_id: '',
      table_name: '',
      can_read: false,
      can_write: false,
      can_delete: false,
    });
  };

  const handleSave = async () => {
    // Validar
    const validation = tablePermissionsService.validateCreatePermission(formData);
    if (!validation.isValid) {
      toast.error(validation.errors.join(', '));
      return;
    }

    if (editingId) {
      // Atualizar
      const response = await tablePermissionsService.updatePermission(editingId, {
        can_read: formData.can_read,
        can_write: formData.can_write,
        can_delete: formData.can_delete,
      });

      if (response.success) {
        toast.success('Permissão atualizada com sucesso');
        await fetchPermissions();
        handleCancelEdit();
      } else {
        toast.error(response.error || 'Erro ao atualizar permissão');
      }
    } else {
      // Criar
      const response = await tablePermissionsService.createPermission(formData);

      if (response.success) {
        toast.success('Permissão criada com sucesso');
        await fetchPermissions();
        handleCancelEdit();
      } else {
        toast.error(response.error || 'Erro ao criar permissão');
      }
    }
  };

  const handleDelete = async (permission: TablePermission) => {
    if (!confirm(`Tem certeza que deseja deletar a permissão de ${permission.user_id} para a tabela ${permission.table_name}?`)) {
      return;
    }

    const response = await tablePermissionsService.deletePermission(permission.id);

    if (response.success) {
      toast.success('Permissão deletada com sucesso');
      await fetchPermissions();
    } else {
      toast.error(response.error || 'Erro ao deletar permissão');
    }
  };

  const filteredPermissions = permissions.filter(p =>
    p.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gerenciamento de Permissões de Tabela
              </CardTitle>
              <CardDescription>
                Configure quais usuários podem acessar e modificar dados de cada tabela
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/tables')} 
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                Ver Tabelas
              </Button>
              {!showNewForm && !editingId && (
                <Button onClick={handleShowNewForm} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Permissão
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Formulário Inline de Nova Permissão */}
              {showNewForm && (
                <Card className="border-2 border-primary">
                  <CardHeader>
                    <CardTitle className="text-base">Nova Permissão</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="user_id">ID do Usuário (Token) *</Label>
                        <Input
                          id="user_id"
                          value={formData.user_id}
                          onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                          placeholder="user_token_123"
                        />
                        <p className="text-xs text-muted-foreground">
                          Token de autenticação do usuário
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="table_name">Nome da Tabela *</Label>
                        <Input
                          id="table_name"
                          value={formData.table_name}
                          onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                          placeholder="customers"
                        />
                        <p className="text-xs text-muted-foreground">
                          Nome da tabela no banco de dados
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Permissões</Label>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="can_read"
                          checked={formData.can_read}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, can_read: checked as boolean })
                          }
                        />
                        <label
                          htmlFor="can_read"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Leitura (SELECT)
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="can_write"
                          checked={formData.can_write}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, can_write: checked as boolean })
                          }
                        />
                        <label
                          htmlFor="can_write"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Escrita (INSERT, UPDATE)
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="can_delete"
                          checked={formData.can_delete}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, can_delete: checked as boolean })
                          }
                        />
                        <label
                          htmlFor="can_delete"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Exclusão (DELETE)
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="outline" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button onClick={handleSave}>
                        <Check className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Busca */}
              {!showNewForm && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por usuário ou tabela..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}

              {/* Lista de Permissões */}
              {filteredPermissions.length === 0 && !showNewForm ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'Nenhuma permissão encontrada' : 'Nenhuma permissão configurada'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPermissions.map((permission) => {
                    const isEditing = editingId === permission.id;

                    if (isEditing) {
                      return (
                        <Card key={permission.id} className="border-2 border-primary">
                          <CardHeader>
                            <CardTitle className="text-base">Editar Permissão</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>ID do Usuário</Label>
                                <Input value={formData.user_id} disabled />
                              </div>

                              <div className="space-y-2">
                                <Label>Nome da Tabela</Label>
                                <Input value={formData.table_name} disabled />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <Label>Permissões</Label>
                              
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit_can_read_${permission.id}`}
                                  checked={formData.can_read}
                                  onCheckedChange={(checked) =>
                                    setFormData({ ...formData, can_read: checked as boolean })
                                  }
                                />
                                <label
                                  htmlFor={`edit_can_read_${permission.id}`}
                                  className="text-sm font-medium"
                                >
                                  Leitura (SELECT)
                                </label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit_can_write_${permission.id}`}
                                  checked={formData.can_write}
                                  onCheckedChange={(checked) =>
                                    setFormData({ ...formData, can_write: checked as boolean })
                                  }
                                />
                                <label
                                  htmlFor={`edit_can_write_${permission.id}`}
                                  className="text-sm font-medium"
                                >
                                  Escrita (INSERT, UPDATE)
                                </label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit_can_delete_${permission.id}`}
                                  checked={formData.can_delete}
                                  onCheckedChange={(checked) =>
                                    setFormData({ ...formData, can_delete: checked as boolean })
                                  }
                                />
                                <label
                                  htmlFor={`edit_can_delete_${permission.id}`}
                                  className="text-sm font-medium"
                                >
                                  Exclusão (DELETE)
                                </label>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                              <Button variant="outline" onClick={handleCancelEdit}>
                                <X className="h-4 w-4 mr-2" />
                                Cancelar
                              </Button>
                              <Button onClick={handleSave}>
                                <Check className="h-4 w-4 mr-2" />
                                Salvar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <Card key={permission.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-5 gap-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Usuário</p>
                                <p className="text-sm font-mono">
                                  {permission.user_id.substring(0, 20)}
                                  {permission.user_id.length > 20 && '...'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Tabela</p>
                                <p className="text-sm font-medium">{permission.table_name}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Leitura</p>
                                {permission.can_read === 1 ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-gray-400 mx-auto" />
                                )}
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Escrita</p>
                                {permission.can_write === 1 ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-gray-400 mx-auto" />
                                )}
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Exclusão</p>
                                {permission.can_delete === 1 ? (
                                  <Check className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-gray-400 mx-auto" />
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(permission)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(permission)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Estatísticas */}
              {!showNewForm && (
                <div className="text-sm text-muted-foreground">
                  Total: {filteredPermissions.length} permissão(ões)
                  {searchTerm && ` (filtrado de ${permissions.length})`}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
