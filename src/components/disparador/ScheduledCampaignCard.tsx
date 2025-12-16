import { useState } from 'react';
import { Users, Trash, Clock, AlertCircle, Play, Pause, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Button from '@/components/ui-custom/Button';
import { ScheduledCampaign, formatScheduledDate, isOverdue, getTimeUntilScheduled } from '@/lib/scheduled-items';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ScheduledCampaignCardProps {
  campaign: ScheduledCampaign;
  onCancel: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

export function ScheduledCampaignCard({ campaign, onCancel, onPause, onResume }: ScheduledCampaignCardProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const overdue = isOverdue(campaign.scheduledAt);
  const timeUntil = getTimeUntilScheduled(campaign.scheduledAt);
  const progress = campaign.totalContacts > 0 
    ? (campaign.sentCount / campaign.totalContacts) * 100 
    : 0;

  const handleCancel = () => {
    if (confirmCancel) {
      onCancel(campaign.id);
    } else {
      setConfirmCancel(true);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmCancel(false);
  };

  const getStatusBadge = () => {
    switch (campaign.status) {
      case 'scheduled':
        return <Badge variant="outline">Agendada</Badge>;
      case 'running':
        return <Badge className="bg-green-500">Em Execução</Badge>;
      case 'paused':
        return <Badge variant="secondary">Pausada</Badge>;
      case 'completed':
        return <Badge variant="secondary">Concluída</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge>{campaign.status}</Badge>;
    }
  };

  return (
    <div
      className={cn(
        'border border-border rounded-lg p-4 relative hover:bg-muted/50 transition-colors',
        overdue && campaign.status === 'scheduled' && 'border-destructive/50 bg-destructive/5'
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">{campaign.name}</span>
            {getStatusBadge()}
          </div>

          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {formatScheduledDate(campaign.scheduledAt)}
              {campaign.status === 'scheduled' && !overdue && (
                <span className="ml-2 text-xs">({timeUntil})</span>
              )}
            </span>
            {overdue && campaign.status === 'scheduled' && (
              <Badge variant="destructive" className="ml-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                Atrasado
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
            <div>
              <span className="font-medium">Total de Contatos:</span>{' '}
              {campaign.totalContacts}
            </div>
            <div>
              <span className="font-medium">Tipo:</span>{' '}
              {campaign.messageType === 'text' ? 'Texto' : 'Mídia'}
            </div>
          </div>

          {(campaign.status === 'running' || campaign.status === 'completed') && (
            <div className="space-y-2 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">
                  {campaign.sentCount} / {campaign.totalContacts}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Enviadas: {campaign.sentCount}</span>
                <span>Falhas: {campaign.failedCount}</span>
                {campaign.successRate !== undefined && (
                  <span>Taxa: {campaign.successRate.toFixed(1)}%</span>
                )}
              </div>
            </div>
          )}

          <div className="text-sm mt-2">
            <span className="font-medium">Instância:</span>{' '}
            <span className="font-mono text-xs">{campaign.instance.substring(0, 8)}...</span>
          </div>
        </div>

        <div className="ml-4 flex flex-col gap-2">
          {campaign.status === 'running' && onPause && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPause(campaign.id)}
              title="Pausar campanha"
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}

          {campaign.status === 'paused' && onResume && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onResume(campaign.id)}
              title="Retomar campanha"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}

          {(campaign.status === 'scheduled' || campaign.status === 'running' || campaign.status === 'paused') && (
            confirmCancel ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancel}
                  className="flex items-center gap-1"
                  size="sm"
                >
                  <X className="h-3.5 w-3.5" />
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelConfirm}
                  size="sm"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="text-destructive hover:text-destructive"
                title="Cancelar campanha"
              >
                <Trash className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
