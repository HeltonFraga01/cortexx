import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigationPaths } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

import { WuzAPIService, WuzAPIUser } from '@/services/wuzapi';
import { automationService } from '@/services/automation';
import { adminSubscriptionsService } from '@/services/admin-subscriptions';
import { adminPlansService } from '@/services/admin-plans';
import type { UserSubscription, Plan } from '@/types/admin-management';
import { 
  Plus, 
  Edit, 
  Wifi, 
  WifiOff, 
  User,
  Users,
  RefreshCw,
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  QrCode,
  Trash2,
  ExternalLink,
  Hash,
  Settings,
  Bot,
  Tags,
  MessageSquareText,
  Zap,
  CreditCard,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface UserWithAvatar extends WuzAPIUser {
  avatarUrl?: string;
  avatarLoading?: boolean;
  subscription?: UserSubscription | null;
  planName?: string;
}

export function WuzapiUsersList() {
  const navigate = useNavigate();
  // Removed unused brandingConfig
  const [users, setUsers] = useState<UserWithAvatar[]>([]);
  // Removed unused plans state
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const itemsPerPage = 10;

  const wuzapi = new WuzAPIService();

  // Helper to get subscription status badge
  const getSubscriptionStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline" className="text-xs">Sem plano</Badge>;
    
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Ativo' },
      trial: { variant: 'secondary', label: 'Trial' },
      past_due: { variant: 'destructive', label: 'Pendente' },
      canceled: { variant: 'outline', label: 'Cancelado' },
      expired: { variant: 'destructive', label: 'Expirado' },
      suspended: { variant: 'destructive', label: 'Suspenso' },
    };
    
    const config = statusConfig[status] ?? { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  // Bulk action handlers
  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(paginatedUsers.map(u => u.token)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleBulkAction = async (automationTypes: string[]) => {
    if (selectedUsers.size === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }

    try {
      setBulkActionLoading(true);
      const result = await automationService.bulkApply({
        userIds: Array.from(selectedUsers),
        automationTypes
      });

      if (result.failureCount === 0) {
        toast.success(`Automação aplicada com sucesso a ${result.successCount} usuário(s)`);
      } else if (result.successCount > 0) {
        toast.warning(`Aplicado a ${result.successCount} usuário(s), ${result.failureCount} falha(s)`);
      } else {
        toast.error(`Falha ao aplicar automação: ${result.failures[0]?.error ?? 'Erro desconhecido'}`);
      }

      setSelectedUsers(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao aplicar automação');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Buscar avatar de um usuário
  const fetchUserAvatar = useCallback(async (user: UserWithAvatar) => {
    if (!user.jid || !user.loggedIn || user.avatarUrl) return;
    
    try {
      // Extrair telefone do JID (formato: 5531xxxxx:xx@s.whatsapp.net)
      const phone = user.jid.split(':')[0];
      if (!phone) return;
      
      const avatarData = await wuzapi.getAvatar(user.token, phone, false);
      if (avatarData?.URL) {
        setUsers(prev => prev.map(u => 
          u.id === user.id ? { ...u, avatarUrl: avatarData.URL, avatarLoading: false } : u
        ));
      }
    } catch {
      // Silenciosamente falha - avatar não disponível
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, avatarLoading: false } : u
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users and plans in parallel
      const [usersData, plansData] = await Promise.all([
        wuzapi.getUsers(),
        adminPlansService.listPlans().catch(() => [] as Plan[])
      ]);
      
      // Create a map of plan IDs to names (kept for future use if needed)
      const _planMap = new Map(plansData.map(p => [p.id, p.name]));
      void _planMap; // Suppress unused variable warning
      
      const usersWithAvatarState = usersData.map(u => ({ ...u, avatarLoading: true }));
      setUsers(usersWithAvatarState);
      
      // NOTE: WUZAPI users don't have Supabase subscriptions
      // Subscriptions are managed via Supabase Auth users, not WUZAPI instances
      // The subscription fetch was removed to prevent 404 errors
      
      // Buscar avatares em paralelo (com limite)
      const loggedInUsers = usersWithAvatarState.filter(u => u.loggedIn && u.jid);
      for (const user of loggedInUsers.slice(0, 10)) {
        void fetchUserAvatar(user);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      toast.success('Token copiado!');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error('Erro ao copiar token');
    }
  };

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      toast.success('ID copiado!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar ID');
    }
  };

  const handleGenerateQR = (userId: string) => {
    navigate(`/admin/users/edit/${userId}?action=qr`);
  };

  const handleOpenWebhook = (webhookUrl: string) => {
    if (webhookUrl) {
      window.open(webhookUrl, '_blank');
    } else {
      toast.error('Webhook não configurado');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.jid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset para primeira página quando buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Função para navegar para a página de criação de usuário
  const handleNavigateToCreateUser = () => {
    navigate(navigationPaths.admin.newUser);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Usuários do Sistema</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie as instâncias WuzAPI conectadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk Actions Dropdown */}
          {selectedUsers.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={bulkActionLoading}>
                  <Zap className="h-4 w-4 mr-2" />
                  Ações ({selectedUsers.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => void handleBulkAction(['bot'])}>
                  <Bot className="h-4 w-4 mr-2" />
                  Aplicar Bot Padrão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleBulkAction(['labels'])}>
                  <Tags className="h-4 w-4 mr-2" />
                  Aplicar Labels Padrão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleBulkAction(['canned_responses'])}>
                  <MessageSquareText className="h-4 w-4 mr-2" />
                  Aplicar Respostas Rápidas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleBulkAction(['bot', 'labels', 'canned_responses'])}>
                  <Zap className="h-4 w-4 mr-2" />
                  Aplicar Todas Automações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={() => void fetchUsers()} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleNavigateToCreateUser} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="sm:inline">Novo Usuário</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={Users}
          iconColor="text-blue-500"
          title={`Usuários (${filteredUsers.length})`}
        >
          <p className="text-sm text-muted-foreground">Lista de todos os usuários cadastrados no sistema</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="listItem" count={5} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Nenhum usuário encontrado"
                description={searchTerm ? "Tente uma busca diferente" : "Crie o primeiro usuário"}
              />
            </div>
          ) : (
            <>
              {/* Dica de scroll para mobile */}
              <div className="sm:hidden text-xs text-muted-foreground text-center py-2 px-4 bg-muted/50 border-b">
                ← Deslize horizontalmente para ver mais →
              </div>
              <div className="w-full overflow-x-auto -mx-0 sm:mx-0">
                <Table className="w-full min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] px-2">
                        <Checkbox
                          checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUsers.has(u.token))}
                          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead className="w-[18%] px-3 sm:px-6">Usuário</TableHead>
                      <TableHead className="w-[8%] px-2 sm:px-4">Conexão</TableHead>
                      <TableHead className="w-[10%] px-2 sm:px-4">Plano</TableHead>
                      <TableHead className="w-[8%] px-2 sm:px-4">Assinatura</TableHead>
                      <TableHead className="w-[10%] px-2 sm:px-4">ID</TableHead>
                      <TableHead className="w-[10%] px-2 sm:px-4">Token</TableHead>
                      <TableHead className="w-[16%] px-2 sm:px-4">JID WhatsApp</TableHead>
                      <TableHead className="w-[10%] text-right px-3 sm:px-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.token || user.id || user.name} className="group hover:bg-muted/50">
                      <TableCell className="px-2">
                        <Checkbox
                          checked={selectedUsers.has(user.token)}
                          onCheckedChange={(checked) => handleSelectUser(user.token, checked as boolean)}
                          aria-label={`Selecionar ${user.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium px-3 sm:px-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                            {user.avatarUrl ? (
                              <AvatarImage 
                                src={user.avatarUrl} 
                                alt={user.name}
                                className="object-cover"
                              />
                            ) : null}
                            <AvatarFallback className={user.loggedIn ? 'bg-green-100 text-green-700' : 'bg-muted'}>
                              {user.avatarLoading ? (
                                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-sm">{user.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {user.jid ? user.jid.split(':')[0] : 'Não conectado'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        {user.loggedIn ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs whitespace-nowrap">
                            <Wifi className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Logado</span>
                            <span className="sm:hidden">On</span>
                          </Badge>
                        ) : user.connected ? (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            <Wifi className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Conectado</span>
                            <span className="sm:hidden">Con</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs whitespace-nowrap text-muted-foreground">
                            <WifiOff className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Offline</span>
                            <span className="sm:hidden">Off</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium truncate max-w-[80px]" title={user.planName || 'Sem plano'}>
                            {user.planName || '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        {getSubscriptionStatusBadge(user.subscription?.status)}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-1 rounded font-mono truncate max-w-[80px]" title={user.id ?? ''}>
                            {user.id?.substring(0, 8) ?? '-'}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => void handleCopyId(user.id)}
                            title="Copiar ID completo"
                          >
                            {copiedId === user.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Hash className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-1 rounded font-mono">
                            {user.token?.substring(0, 6) ?? '-'}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => void handleCopyToken(user.token)}
                            title="Copiar token completo"
                          >
                            {copiedToken === user.token ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <div className="min-w-0">
                          <span className="text-xs text-muted-foreground block truncate max-w-[150px]" title={user.jid || 'Não conectado'}>
                            {user.jid || 'Não conectado'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-3 sm:px-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/admin/users/edit/${user.id}`)}
                            className="h-8"
                          >
                            <Edit className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Editar</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => navigate(`/admin/users/${user.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/admin/users/edit/${user.id}`)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Configurações
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGenerateQR(user.id)}>
                                <QrCode className="h-4 w-4 mr-2" />
                                Gerar QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleCopyId(user.id)}>
                                <Hash className="h-4 w-4 mr-2" />
                                Copiar ID
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleCopyToken(user.token)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar Token
                              </DropdownMenuItem>
                              {user.webhook && (
                                <DropdownMenuItem onClick={() => handleOpenWebhook(user.webhook)}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Abrir Webhook
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => navigate(`/admin/users/edit/${user.id}?action=delete`)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover Usuário
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>

        {/* Paginação */}
        {!loading && filteredUsers.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length} usuários
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
