/**
 * BulkDispatcherDashboard Component
 * 
 * Dashboard principal para gerenciar campanhas de disparo em massa
 * Organiza todos os componentes em tabs
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Activity, 
  History, 
  BarChart3,
  AlertCircle,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { CampaignBuilder } from './CampaignBuilder';
import { CampaignProgressMonitor } from './CampaignProgressMonitor';
import { CampaignReportViewer } from './CampaignReportViewer';
import { bulkCampaignService, type Campaign } from '@/services/bulkCampaignService';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface BulkDispatcherDashboardProps {
  instance: string;
  userToken: string;
}

export function BulkDispatcherDashboard({ instance, userToken }: BulkDispatcherDashboardProps) {
  const [activeTab, setActiveTab] = useState('new');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{
    campaigns: Campaign[];
    loading: boolean;
    page: number;
    totalPages: number;
    total: number;
  }>({
    campaigns: [],
    loading: false,
    page: 1,
    totalPages: 1,
    total: 0
  });
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Handle campaign created
  const handleCampaignCreated = (campaignId: string) => {
    // Switch to active campaigns tab
    setActiveTab('active');
  };

  // Handle campaign completed
  const handleCampaignComplete = (campaignId: string) => {
    // Could show notification or auto-refresh history
  };

  // Load history
  const loadHistory = async (page = 1) => {
    try {
      setHistoryData(prev => ({ ...prev, loading: true }));
      
      const result = await bulkCampaignService.getCampaignHistory({
        page,
        limit: 10,
        instance
      });

      setHistoryData({
        campaigns: result.data,
        loading: false,
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
        total: result.pagination.total
      });
    } catch (error) {
      setHistoryData(prev => ({ ...prev, loading: false }));
      toast.error('Erro ao carregar histórico');
    }
  };

  // View report
  const handleViewReport = (campaignId: string) => {
    setSelectedReportId(campaignId);
    setActiveTab('reports');
  };

  // Delete campaign
  const handleDeleteCampaign = async (campaign: Campaign) => {
    // Verificar se campanha está em execução
    if (campaign.status === 'running') {
      toast.error('Não é possível excluir uma campanha em execução');
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmar Exclusão',
      description: `Tem certeza que deseja excluir a campanha "${campaign.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await bulkCampaignService.deleteCampaign(campaign.id);
      toast.success('Campanha excluída com sucesso');
      
      // Recarregar histórico
      loadHistory(historyData.page);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir campanha');
    }
  };

  // Load history when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'history' && historyData.campaigns.length === 0) {
      loadHistory();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Disparo em Massa Avançado</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Crie e gerencie campanhas de disparo com humanização e agendamento
        </p>
      </div>

      {/* Connection Status */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs sm:text-sm">
          <strong>Instância ativa:</strong> <span className="break-all">{instance}</span>
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 gap-1 p-1 sm:gap-2 sm:p-1.5">
          <TabsTrigger value="new" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Nova Campanha</span>
            <span className="sm:hidden">Nova</span>
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Ativas</span>
            <span className="sm:hidden">Ativas</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <span className="sm:hidden">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Relatórios</span>
            <span className="sm:hidden">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        {/* New Campaign Tab */}
        <TabsContent value="new" className="space-y-4">
          <CampaignBuilder
            instance={instance}
            userToken={userToken}
            onCampaignCreated={handleCampaignCreated}
          />
        </TabsContent>

        {/* Active Campaigns Tab */}
        <TabsContent value="active" className="space-y-4">
          <CampaignProgressMonitor
            userToken={userToken}
            instance={instance}
            onCampaignComplete={handleCampaignComplete}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {historyData.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : historyData.campaigns.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <History className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Nenhuma campanha no histórico</h3>
                  <p className="text-sm text-muted-foreground">
                    Campanhas concluídas aparecerão aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Info de paginação no topo */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p>
                      Mostrando {((historyData.page - 1) * 10) + 1} a {Math.min(historyData.page * 10, historyData.total)} de {historyData.total} campanhas
                    </p>
                  </div>

                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[150px]">Nome</TableHead>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="text-center min-w-[80px]">Contatos</TableHead>
                          <TableHead className="text-center min-w-[80px]">Enviados</TableHead>
                          <TableHead className="text-center min-w-[80px]">Falhas</TableHead>
                          <TableHead className="text-center min-w-[70px]">Taxa</TableHead>
                          <TableHead className="min-w-[100px]">Data</TableHead>
                          <TableHead className="text-right min-w-[150px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyData.campaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {campaign.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                campaign.status === 'completed' ? 'default' :
                                campaign.status === 'cancelled' ? 'secondary' :
                                campaign.status === 'failed' ? 'destructive' :
                                'outline'
                              }>
                                {bulkCampaignService.getStatusLabel(campaign.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{campaign.totalContacts}</TableCell>
                            <TableCell className="text-center text-green-600 font-medium">
                              {campaign.sentCount}
                            </TableCell>
                            <TableCell className="text-center text-red-600 font-medium">
                              {campaign.failedCount}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {campaign.successRate || 0}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {campaign.completedAt 
                                ? new Date(campaign.completedAt).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })
                                : new Date(campaign.createdAt).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewReport(campaign.id)}
                                >
                                  Ver Relatório
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteCampaign(campaign)}
                                  disabled={campaign.status === 'running'}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {historyData.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        Página {historyData.page} de {historyData.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadHistory(historyData.page - 1)}
                          disabled={historyData.page === 1 || historyData.loading}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Anterior
                        </Button>
                        
                        {/* Números de página */}
                        <div className="hidden sm:flex items-center gap-1">
                          {Array.from({ length: Math.min(5, historyData.totalPages) }, (_, i) => {
                            let pageNum;
                            if (historyData.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (historyData.page <= 3) {
                              pageNum = i + 1;
                            } else if (historyData.page >= historyData.totalPages - 2) {
                              pageNum = historyData.totalPages - 4 + i;
                            } else {
                              pageNum = historyData.page - 2 + i;
                            }
                            
                            return (
                              <Button
                                key={pageNum}
                                size="sm"
                                variant={historyData.page === pageNum ? 'default' : 'outline'}
                                onClick={() => loadHistory(pageNum)}
                                disabled={historyData.loading}
                                className="w-8 h-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadHistory(historyData.page + 1)}
                          disabled={historyData.page === historyData.totalPages || historyData.loading}
                        >
                          Próxima
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          {selectedReportId ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setSelectedReportId(null)}
              >
                ← Voltar
              </Button>
              <CampaignReportViewer
                campaignId={selectedReportId}
                userToken={userToken}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Selecione uma campanha</h3>
                  <p className="text-sm text-muted-foreground">
                    Vá para o histórico e clique em "Ver Relatório" para visualizar detalhes
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <ConfirmDialog />
    </div>
  );
}


export default BulkDispatcherDashboard;
