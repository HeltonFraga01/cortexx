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

import { WuzAPIService, Inbox } from '@/services/wuzapi';
import { automationService } from '@/services/automation';
import { adminPlansService } from '@/services/admin-plans';
import type { Plan } from '@/types/admin-management';
import { 
  Plus, 
  Edit, 
  Wifi, 
  WifiOff, 
  Inbox as InboxIcon,
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
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface InboxWithAvatar extends Inbox {
  avatarUrl?: string;
  avatarLoading?: boolean;
}

/**
 * Lista de Caixas de Entrada (Inboxes) WhatsApp.
 * 
 * Este componente exibe todas as caixas de entrada conectadas via WUZAPI,
 * permitindo gerenciar conexões WhatsApp, webhooks e automações.
 */
export function InboxList() {
  const navigate = useNavigate();
  const [inboxes, setInboxes] = useState<InboxWithAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInboxes, setSelectedInboxes] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const itemsPerPage = 10;

  const wuzapi = new WuzAPIService();

  // Bulk action handlers
  const handleSelectInbox = (inboxToken: string, checked: boolean) => {
    setSelectedInboxes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(inboxToken);
      } else {
        newSet.delete(inboxToken);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInboxes(new Set(paginatedInboxes.map(i => i.token)));
    } else {
      setSelectedInboxes(new Set());
    }
  };

  const handleBulkAction = async (automationTypes: string[]) => {
    if (selectedInboxes.size === 0) {
      toast.error('Selecione pelo menos uma caixa de entrada');
      return;
    }

    try {
      setBulkActionLoading(true);
      const result = await automationService.bulkApply({
        userIds: Array.from(selectedInboxes),
        automationTypes
      });

      if (result.failureCount === 0) {
        toast.success(`Automação aplicada com sucesso a ${result.successCount} caixa(s) de entrada`);
      } else if (result.successCount > 0) {
        toast.warning(`Aplicado a ${result.successCount} caixa(s), ${result.failureCount} falha(s)`);
      } else {
        toast.error(`Falha ao aplicar automação: ${result.failures[0]?.error ?? 'Erro desconhecido'}`);
      }

      setSelectedInboxes(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao aplicar automação');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Buscar avatar de uma caixa de entrada
  const fetchInboxAvatar = useCallback(async (inbox: InboxWithAvatar) => {
    if (!inbox.jid || !inbox.loggedIn || inbox.avatarUrl) return;
    
    try {
      const phone = inbox.jid.split(':')[0];
      if (!phone) return;
      
      const avatarData = await wuzapi.getAvatar(inbox.token, phone, false);
      if (avatarData?.URL) {
        setInboxes(prev => prev.map(i => 
          i.id === inbox.id ? { ...i, avatarUrl: avatarData.URL, avatarLoading: false } : i
        ));
      }
    } catch {
      setInboxes(prev => prev.map(i => 
        i.id === inbox.id ? { ...i, avatarLoading: false } : i
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInboxes = async () => {
    try {
      setLoading(true);
      
      const [inboxesData] = await Promise.all([
        wuzapi.listInboxes(),
        adminPlansService.listPlans().catch(() => [] as Plan[])
      ]);
      
      const inboxesWithAvatarState = inboxesData.map(i => ({ ...i, avatarLoading: true }));
      setInboxes(inboxesWithAvatarState);
      
      // Buscar avatares em paralelo (com limite)
      const loggedInInboxes = inboxesWithAvatarState.filter(i => i.loggedIn && i.jid);
      for (const inbox of loggedInInboxes.slice(0, 10)) {
        void fetchInboxAvatar(inbox);
      }
    } catch (error) {
      console.error('Error fetching inboxes:', error);
      toast.error('Erro ao carregar caixas de entrada');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInboxes();
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

  const handleGenerateQR = (inboxId: string) => {
    navigate(`/admin/inboxes/edit/${inboxId}?action=qr`);
  };

  const handleOpenWebhook = (webhookUrl: string) => {
    if (webhookUrl) {
      window.open(webhookUrl, '_blank');
    } else {
      toast.error('Webhook não configurado');
    }
  };

  const filteredInboxes = inboxes.filter(inbox =>
    inbox.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inbox.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inbox.jid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginação
  const totalPages = Math.ceil(filteredInboxes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInboxes = filteredInboxes.slice(startIndex, endIndex);

  // Reset para primeira página quando buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleNavigateToCreateInbox = () => {
    navigate(navigationPaths.admin.newUser); // TODO: Atualizar para /admin/inboxes/new
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Caixas de Entrada</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie suas conexões WhatsApp via WUZAPI
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk Actions Dropdown */}
          {selectedInboxes.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={bulkActionLoading}>
                  <Zap className="h-4 w-4 mr-2" />
                  Ações ({selectedInboxes.size})
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
          <Button onClick={() => void fetchInboxes()} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleNavigateToCreateInbox} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="sm:inline">Nova Caixa de Entrada</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar caixas de entrada..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inboxes Table */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={InboxIcon}
          iconColor="text-blue-500"
          title={`Caixas de Entrada (${filteredInboxes.length})`}
        >
          <p className="text-sm text-muted-foreground">Lista de todas as conexões WhatsApp cadastradas</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="listItem" count={5} />
            </div>
          ) : filteredInboxes.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={InboxIcon}
                title="Nenhuma caixa de entrada encontrada"
                description={searchTerm ? "Tente uma busca diferente" : "Crie a primeira caixa de entrada"}
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
                          checked={paginatedInboxes.length > 0 && paginatedInboxes.every(i => selectedInboxes.has(i.token))}
                          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead className="w-[22%] px-3 sm:px-6">Caixa de Entrada</TableHead>
                      <TableHead className="w-[10%] px-2 sm:px-4">Conexão</TableHead>
                      <TableHead className="w-[12%] px-2 sm:px-4">ID</TableHead>
                      <TableHead className="w-[12%] px-2 sm:px-4">Token</TableHead>
                      <TableHead className="w-[20%] px-2 sm:px-4">JID WhatsApp</TableHead>
                      <TableHead className="w-[14%] text-right px-3 sm:px-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {paginatedInboxes.map((inbox) => (
                    <TableRow key={inbox.token || inbox.id || inbox.name} className="group hover:bg-muted/50">
                      <TableCell className="px-2">
                        <Checkbox
                          checked={selectedInboxes.has(inbox.token)}
                          onCheckedChange={(checked) => handleSelectInbox(inbox.token, checked as boolean)}
                          aria-label={`Selecionar ${inbox.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium px-3 sm:px-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                            {inbox.avatarUrl ? (
                              <AvatarImage 
                                src={inbox.avatarUrl} 
                                alt={inbox.name}
                                className="object-cover"
                              />
                            ) : null}
                            <AvatarFallback className={inbox.loggedIn ? 'bg-green-100 text-green-700' : 'bg-muted'}>
                              {inbox.avatarLoading ? (
                                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <InboxIcon className="h-4 w-4" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-sm">{inbox.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {inbox.jid ? inbox.jid.split(':')[0] : 'Não conectado'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        {inbox.loggedIn ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs whitespace-nowrap">
                            <Wifi className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Logado</span>
                            <span className="sm:hidden">On</span>
                          </Badge>
                        ) : inbox.connected ? (
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
                          <code className="text-xs bg-muted px-1.5 py-1 rounded font-mono truncate max-w-[80px]" title={inbox.id ?? ''}>
                            {inbox.id?.substring(0, 8) ?? '-'}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => void handleCopyId(inbox.id)}
                            title="Copiar ID completo"
                          >
                            {copiedId === inbox.id ? (
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
                            {inbox.token?.substring(0, 6) ?? '-'}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => void handleCopyToken(inbox.token)}
                            title="Copiar token completo"
                          >
                            {copiedToken === inbox.token ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <div className="min-w-0">
                          <span className="text-xs text-muted-foreground block truncate max-w-[150px]" title={inbox.jid || 'Não conectado'}>
                            {inbox.jid || 'Não conectado'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-3 sm:px-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/admin/inboxes/edit/${inbox.id}`)}
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
                              <DropdownMenuItem onClick={() => navigate(`/admin/inboxes/${inbox.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/admin/inboxes/edit/${inbox.id}`)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Configurações
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGenerateQR(inbox.id)}>
                                <QrCode className="h-4 w-4 mr-2" />
                                Gerar QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleCopyId(inbox.id)}>
                                <Hash className="h-4 w-4 mr-2" />
                                Copiar ID
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleCopyToken(inbox.token)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar Token
                              </DropdownMenuItem>
                              {inbox.webhook && (
                                <DropdownMenuItem onClick={() => handleOpenWebhook(inbox.webhook)}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Abrir Webhook
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => navigate(`/admin/inboxes/edit/${inbox.id}?action=delete`)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover Caixa de Entrada
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
        {!loading && filteredInboxes.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredInboxes.length)} de {filteredInboxes.length} caixas de entrada
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

/**
 * @deprecated Use InboxList instead. Este componente será removido em versão futura.
 */
export const WuzapiUsersList = InboxList;
