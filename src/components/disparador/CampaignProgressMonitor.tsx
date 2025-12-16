/**
 * CampaignProgressMonitor Component
 * 
 * Monitora o progresso de campanhas em execução em tempo real
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Pause, 
  Play, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertCircle,
  TrendingUp,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { bulkCampaignService, type Campaign, type CampaignProgress } from '@/services/bulkCampaignService';
import { CampaignEditModal } from './CampaignEditModal';

interface CampaignProgressMonitorProps {
  userToken: string;
  instance?: string;
  onCampaignComplete?: (campaignId: string) => void;
}

export function CampaignProgressMonitor({ 
  userToken, 
  instance,
  onCampaignComplete 
}: CampaignProgressMonitorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [progressData, setProgressData] = useState<Record<string, CampaignProgress>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Fetch active campaigns
  const fetchActiveCampaigns = async () => {
    try {
      const activeCampaigns = await bulkCampaignService.getActiveCampaigns(instance);
      setCampaigns(activeCampaigns);

      // Only fetch progress if there are active campaigns
      if (activeCampaigns.length > 0) {
        // Fetch progress for each campaign
        const progressPromises = activeCampaigns.map(campaign =>
          bulkCampaignService.getCampaignProgress(campaign.id)
            .then(progress => ({ id: campaign.id, progress }))
            .catch((error) => {
              // Silently handle errors for individual campaigns
              console.warn(`Failed to fetch progress for campaign ${campaign.id}:`, error.message);
              return null;
            })
        );

        const results = await Promise.all(progressPromises);
        const newProgressData: Record<string, CampaignProgress> = {};
        
        results.forEach(result => {
          if (result) {
            newProgressData[result.id] = result.progress;
          }
        });

        setProgressData(newProgressData);
      } else {
        // Clear progress data if no campaigns
        setProgressData({});
      }
    } catch (error: any) {
      // Only log error, don't show toast for empty state
      if (error.response?.status !== 404) {
        console.error('Error fetching campaigns:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Polling effect
  useEffect(() => {
    fetchActiveCampaigns();

    const interval = setInterval(() => {
      fetchActiveCampaigns();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [userToken, instance]);

  // Check for completed campaigns
  useEffect(() => {
    campaigns.forEach(campaign => {
      const progress = progressData[campaign.id];
      if (progress && progress.status === 'completed') {
        onCampaignComplete?.(campaign.id);
      }
    });
  }, [progressData]);

  // Pause campaign
  const handlePause = async (campaignId: string) => {
    try {
      setActionLoading(prev => ({ ...prev, [campaignId]: true }));
      await bulkCampaignService.pauseCampaign(campaignId);
      toast.success('Campanha pausada');
      await fetchActiveCampaigns();
    } catch (error: any) {
      toast.error('Erro ao pausar: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  // Resume campaign
  const handleResume = async (campaignId: string) => {
    try {
      setActionLoading(prev => ({ ...prev, [campaignId]: true }));
      await bulkCampaignService.resumeCampaign(campaignId);
      toast.success('Campanha retomada');
      await fetchActiveCampaigns();
    } catch (error: any) {
      toast.error('Erro ao retomar: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  // Cancel campaign
  const handleCancel = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta campanha?')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [campaignId]: true }));
      await bulkCampaignService.cancelCampaign(campaignId);
      toast.success('Campanha cancelada');
      await fetchActiveCampaigns();
    } catch (error: any) {
      toast.error('Erro ao cancelar: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  // Open edit modal
  const handleEdit = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setEditModalOpen(true);
  };

  // Handle edit success
  const handleEditSuccess = () => {
    fetchActiveCampaigns();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-2">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">Nenhuma campanha ativa</h3>
            <p className="text-sm text-muted-foreground">
              Crie uma nova campanha para começar
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map(campaign => {
        const progress = progressData[campaign.id];
        const isLoading = actionLoading[campaign.id];
        const percentage = progress 
          ? Math.round((progress.stats.sent / progress.stats.total) * 100)
          : 0;

        return (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {campaign.name}
                    <Badge variant={
                      campaign.status === 'running' ? 'default' :
                      campaign.status === 'paused' ? 'secondary' :
                      'outline'
                    }>
                      {bulkCampaignService.getStatusLabel(campaign.status)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Instância: {campaign.instance}
                  </CardDescription>
                </div>

                <div className="flex gap-2">
                  {/* Edit button - show for paused, running, scheduled */}
                  {['paused', 'running', 'scheduled'].includes(campaign.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(campaign)}
                      disabled={isLoading}
                      title="Editar configurações"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}

                  {campaign.status === 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePause(campaign.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar
                        </>
                      )}
                    </Button>
                  )}

                  {campaign.status === 'paused' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResume(campaign.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Retomar
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancel(campaign.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progresso</span>
                  <span className="text-muted-foreground">{percentage}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>

              {/* Statistics */}
              {progress && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{progress.stats.total}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <p className="text-sm text-muted-foreground">Enviados</p>
                    </div>
                    <p className="text-2xl font-bold text-green-500">
                      {progress.stats.sent}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-500">
                      {progress.stats.pending}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <p className="text-sm text-muted-foreground">Falhas</p>
                    </div>
                    <p className="text-2xl font-bold text-red-500">
                      {progress.stats.failed}
                    </p>
                  </div>
                </div>
              )}

              {/* Success Rate */}
              {progress && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="font-medium">Taxa de Sucesso</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {progress.stats.successRate.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Current Contact */}
              {progress?.currentContact && campaign.status === 'running' && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    <strong>Processando:</strong>{' '}
                    {progress.currentContact.name || progress.currentContact.phone}
                  </AlertDescription>
                </Alert>
              )}

              {/* Enhanced Progress Info */}
              {progress?.enhanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Estimated Time Remaining */}
                  {progress.enhanced.estimatedTimeRemaining && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Tempo restante</p>
                        <p className="font-semibold">{progress.enhanced.estimatedTimeRemaining}</p>
                      </div>
                    </div>
                  )}

                  {/* Average Speed */}
                  {progress.enhanced.averageSpeed > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Velocidade média</p>
                        <p className="font-semibold">{progress.enhanced.averageSpeed} msg/min</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Errors */}
              {progress?.enhanced?.recentErrors && progress.enhanced.recentErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Últimos erros ({progress.enhanced.recentErrors.length})</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {progress.enhanced.recentErrors.slice(-5).map((error, index) => (
                      <div key={index} className="text-xs p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                        <div className="flex justify-between">
                          <span className="font-medium text-red-700 dark:text-red-400">
                            {error.contactPhone || 'Contato desconhecido'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {error.errorType}
                          </Badge>
                        </div>
                        <p className="text-red-600 dark:text-red-300 mt-1">{error.errorMessage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy Estimated Time (fallback) */}
              {!progress?.enhanced?.estimatedTimeRemaining && progress?.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Tempo estimado restante:</strong>{' '}
                    {bulkCampaignService.formatDuration(progress.estimatedTimeRemaining)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Timestamps */}
              {progress && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {progress.startedAt && (
                    <p>Iniciado: {new Date(progress.startedAt).toLocaleString('pt-BR')}</p>
                  )}
                  {progress.pausedAt && (
                    <p>Pausado: {new Date(progress.pausedAt).toLocaleString('pt-BR')}</p>
                  )}
                  {progress.completedAt && (
                    <p>Concluído: {new Date(progress.completedAt).toLocaleString('pt-BR')}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Modal */}
      <CampaignEditModal
        campaign={selectedCampaign}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
