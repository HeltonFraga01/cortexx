/**
 * CampaignMonitor Component
 * Real-time progress monitoring for running campaigns
 * 
 * Requirements: 2.3, 2.5, 2.6
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Pause,
  XCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  Users,
  Activity,
} from 'lucide-react';
import {
  bulkCampaignService,
  CampaignProgress,
} from '@/services/bulkCampaignService';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { toast } from 'sonner';

interface CampaignMonitorProps {
  campaignId: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  refreshInterval?: number;
}

export function CampaignMonitor({
  campaignId,
  onPause,
  onResume,
  onCancel,
  onComplete,
  refreshInterval = 3000,
}: CampaignMonitorProps) {
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadProgress = async () => {
    try {
      const data = await bulkCampaignService.getCampaignProgress(campaignId);
      setProgress(data);
      
      // Check if completed
      if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'failed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        onComplete?.();
      }
    } catch (error: any) {
      console.error('Erro ao carregar progresso:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
    
    // Set up polling
    intervalRef.current = setInterval(loadProgress, refreshInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [campaignId, refreshInterval]);

  const handlePause = async () => {
    setIsPausing(true);
    try {
      await bulkCampaignService.pauseCampaign(campaignId);
      toast.success('Campanha pausada');
      loadProgress();
      onPause?.();
    } catch (error: any) {
      toast.error('Erro ao pausar campanha', {
        description: error.message,
      });
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await bulkCampaignService.resumeCampaign(campaignId);
      toast.success('Campanha retomada');
      loadProgress();
      onResume?.();
    } catch (error: any) {
      toast.error('Erro ao retomar campanha', {
        description: error.message,
      });
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: 'Cancelar Campanha',
      description: 'Tem certeza que deseja cancelar esta campanha? As mensagens já enviadas não serão afetadas.',
      confirmText: 'Cancelar Campanha',
      variant: 'destructive',
    });

    if (confirmed) {
      setIsCancelling(true);
      try {
        await bulkCampaignService.cancelCampaign(campaignId);
        toast.success('Campanha cancelada');
        loadProgress();
        onCancel?.();
      } catch (error: any) {
        toast.error('Erro ao cancelar campanha', {
          description: error.message,
        });
      } finally {
        setIsCancelling(false);
      }
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      running: { color: 'text-green-500', icon: <Activity className="h-5 w-5 animate-pulse" />, label: 'Em execução' },
      paused: { color: 'text-yellow-500', icon: <Pause className="h-5 w-5" />, label: 'Pausada' },
      completed: { color: 'text-gray-500', icon: <CheckCircle className="h-5 w-5" />, label: 'Concluída' },
      cancelled: { color: 'text-red-500', icon: <XCircle className="h-5 w-5" />, label: 'Cancelada' },
      failed: { color: 'text-red-500', icon: <AlertCircle className="h-5 w-5" />, label: 'Falhou' },
    };
    return configs[status] || { color: 'text-gray-500', icon: <Clock className="h-5 w-5" />, label: status };
  };

  if (isLoading || !progress) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const { stats, status, enhanced } = progress;
  const progressPercent = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
  const statusConfig = getStatusConfig(status);
  const isActive = status === 'running' || status === 'paused';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Monitor de Campanha
            </CardTitle>
            <div className={`flex items-center gap-2 ${statusConfig.color}`}>
              {statusConfig.icon}
              <span className="font-medium">{statusConfig.label}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-2xl font-bold">{stats.total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg bg-green-500/10">
              <Send className="h-5 w-5 text-green-500 mb-1" />
              <span className="text-2xl font-bold text-green-600">{stats.sent}</span>
              <span className="text-xs text-muted-foreground">Enviados</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-500 mb-1" />
              <span className="text-2xl font-bold text-yellow-600">{stats.pending}</span>
              <span className="text-xs text-muted-foreground">Pendentes</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg bg-red-500/10">
              <AlertCircle className="h-5 w-5 text-red-500 mb-1" />
              <span className="text-2xl font-bold text-red-600">{stats.failed}</span>
              <span className="text-xs text-muted-foreground">Erros</span>
            </div>
          </div>

          {/* Current Contact Being Processed */}
          {(status === 'running' || status === 'paused') && progress.currentContact && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className={`h-4 w-4 text-primary ${status === 'running' ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-medium">
                    {status === 'running' ? 'Enviando agora' : 'Próximo contato'}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Telefone:</span>
                    <span className="font-mono">{progress.currentContact.phone}</span>
                  </div>
                  {progress.currentContact.name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Nome:</span>
                      <span>{progress.currentContact.name}</span>
                    </div>
                  )}
                  {(progress.currentIndex !== undefined || progress.currentContact.position) && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Posição:</span>
                      <span>
                        {progress.currentContact.position || (progress.currentIndex + 1)} de {stats.total}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Enhanced Stats */}
          {enhanced && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                {enhanced.estimatedTimeRemaining && (
                  <div>
                    <span className="text-muted-foreground">Tempo restante:</span>
                    <span className="ml-2 font-medium">{enhanced.estimatedTimeRemaining}</span>
                  </div>
                )}
                {enhanced.averageSpeed > 0 && (
                  <div>
                    <span className="text-muted-foreground">Velocidade:</span>
                    <span className="ml-2 font-medium">{enhanced.averageSpeed.toFixed(1)} msg/min</span>
                  </div>
                )}
                {enhanced.elapsedTime && (
                  <div>
                    <span className="text-muted-foreground">Tempo decorrido:</span>
                    <span className="ml-2 font-medium">{enhanced.elapsedTime}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Recent Errors */}
          {enhanced?.recentErrors && enhanced.recentErrors.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Erros Recentes ({enhanced.recentErrors.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {enhanced.recentErrors.slice(0, 5).map((error, index) => (
                    <div key={index} className="text-xs p-2 rounded bg-destructive/10 border border-destructive/20">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="font-mono">{error.contactPhone}</span>
                        {error.contactName && (
                          <span className="text-muted-foreground">({error.contactName})</span>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-1">
                        {error.errorType && <Badge variant="outline" className="mr-2 text-xs">{error.errorType}</Badge>}
                        {error.errorMessage}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          {isActive && (
            <>
              <Separator />
              <div className="flex items-center justify-end gap-2">
                {status === 'running' ? (
                  <Button
                    variant="outline"
                    onClick={handlePause}
                    disabled={isPausing}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    {isPausing ? 'Pausando...' : 'Pausar'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleResume}
                    disabled={isResuming}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isResuming ? 'Retomando...' : 'Retomar'}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {isCancelling ? 'Cancelando...' : 'Cancelar'}
                </Button>
              </div>
            </>
          )}

          {/* Success Rate */}
          <div className="text-center text-sm text-muted-foreground">
            Taxa de sucesso: <span className="font-medium">{stats.successRate.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}

export default CampaignMonitor;
