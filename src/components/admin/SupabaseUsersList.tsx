import { useState, useEffect } from 'react';
import { adminUsersService, SupabaseUser, CreateSupabaseUserDTO } from '@/services/admin-users';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, Search, Plus, Trash2, Check, X, RefreshCw, Loader2, Shield, Phone, Mail } from 'lucide-react';
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SupabaseUsersList() {
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  
  // Create User State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newUserData, setNewUserData] = useState<CreateSupabaseUserDTO>({
    email: '',
    password: '',
    email_confirm: true,
    user_metadata: {
      role: 'user'
    }
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminUsersService.listUsers(page, perPage, searchTerm);
      setUsers(data);
    } catch (error) {
      console.error('Erro ao buscar usuários Supabase:', error);
      toast.error('Erro ao carregar usuários do Supabase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [page, searchTerm]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.email || !newUserData.password) {
      toast.error('Email e senha são obrigatórios');
      return;
    }

    try {
      setCreateLoading(true);
      await adminUsersService.createUser(newUserData);
      toast.success('Usuário criado com sucesso');
      setIsCreateOpen(false);
      setNewUserData({
        email: '',
        password: '',
        email_confirm: true,
        user_metadata: { role: 'user' }
      });
      void fetchUsers();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar usuário');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Tem certeza que deseja remover o usuário ${email}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await adminUsersService.deleteUser(id);
      toast.success(`Usuário ${email} removido com sucesso`);
      void fetchUsers();
    } catch (error) {
        console.error('Erro ao remover usuário:', error);
        toast.error('Erro ao remover usuário');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">Usuários do Supabase</h2>
        <div className="flex gap-2 w-full sm:w-auto">
             <Button onClick={() => void fetchUsers()} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
             </Button>
             <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário Supabase</DialogTitle>
                  <DialogDescription>
                    Este usuário poderá fazer login no sistema.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={newUserData.email}
                      onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={newUserData.password}
                      onChange={e => setNewUserData({...newUserData, password: e.target.value})}
                      required 
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone (Opcional)</Label>
                    <Input 
                      id="phone" 
                      type="text" 
                      value={newUserData.phone || ''}
                      onChange={e => setNewUserData({...newUserData, phone: e.target.value})}
                      placeholder="+55..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <input 
                                type="radio" 
                                id="role-user" 
                                name="role" 
                                checked={newUserData.user_metadata?.role === 'user'} 
                                onChange={() => setNewUserData({...newUserData, user_metadata: { ...newUserData.user_metadata, role: 'user' }})}
                                className="h-4 w-4"
                            />
                            <Label htmlFor="role-user">Usuário</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input 
                                type="radio" 
                                id="role-admin" 
                                name="role" 
                                checked={newUserData.user_metadata?.role === 'admin'} 
                                onChange={() => setNewUserData({...newUserData, user_metadata: { ...newUserData.user_metadata, role: 'admin' }})}
                                className="h-4 w-4"
                            />
                            <Label htmlFor="role-admin">Admin</Label>
                        </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                        type="checkbox" 
                        id="email_confirm" 
                        checked={newUserData.email_confirm}
                        onChange={e => setNewUserData({...newUserData, email_confirm: e.target.checked})}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="email_confirm">Confirmar Email Automaticamente</Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createLoading}>
                        {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Usuário'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>

       <Card>
        <CardContent className="pt-6">
          <div className="relative mb-6">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {loading ? (
             <LoadingSkeleton variant="list" count={5} />
          ) : users.length === 0 ? (
             <EmptyState
                icon={Users}
                title="Nenhum usuário encontrado"
                description={searchTerm ? "Tente uma busca diferente" : "Nenhum usuário Supabase encontrado"}
              />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Confirmado</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    {user.email || 'Sem email'}
                                </span>
                                {user.phone && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                        <Phone className="h-3 w-3" />
                                        {user.phone}
                                    </span>
                                )}
                                <span className="text-xs text-muted-foreground font-mono mt-1">ID: {user.id.substring(0, 8)}...</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            {user.user_metadata?.role === 'admin' ? (
                                <Badge variant="default" className="bg-red-100 text-red-800 hover:bg-red-200">
                                    <Shield className="h-3 w-3 mr-1" /> Admin
                                </Badge>
                            ) : (
                                <Badge variant="secondary">User</Badge>
                            )}
                        </TableCell>
                         <TableCell>
                            {user.email_confirmed_at ? (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                    <Check className="h-3 w-3 mr-1" /> Sim
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                                    <X className="h-3 w-3 mr-1" /> Não
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.last_sign_in_at)}
                        </TableCell>
                        <TableCell className="text-right">
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => void handleDeleteUser(user.id, user.email || '')}
                             >
                                <Trash2 className="h-4 w-4" />
                             </Button>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          <div className="flex justify-between items-center mt-4">
             <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
             >
                Anterior
             </Button>
             <span className="text-sm text-muted-foreground">Página {page}</span>
             <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => p + 1)}
                disabled={users.length < perPage}
             >
                Próxima
             </Button>
          </div>
        </CardContent>
       </Card>
    </div>
  );
}
