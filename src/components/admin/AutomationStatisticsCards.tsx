import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/ui-custom/StatsCard';
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton';
import { automationService } from '@/services/automation';
import type { AutomationStatistics, AuditLogEntry } from '@/types/automation';
import { 
  Bot, 
  Tags, 
  MessageSquareText, 
  Webhook,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

const AUTOMATION_TYPE_LABELS: Record<string, string> = {
  bot: 'Bot',
  labels: 'Labels',
  canned_responses: 'Respostas Rápidas',
  webhooks: 'Webhooks',
  quotas: 'Quotas'
};

const AUTOMATION_TYPE_ICONS: Record<string, React.ElementType> = {
  bot: Bot,
  labels: Tags,
  canned_responses: MessageSquareText,
  webhooks: Webhook
};

interface AutomationStatisticsCardsProps {
  onNavigateToAuditLog?: () => void;
}

export default function AutomationStatisticsCards({ onNavigateToAuditLog }: AutomationStatisticsCardsProps) {
  const [statistics, setStatistics] = useState<AutomationStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const data = await automationService.getStatistics();
        setStatistics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatistics, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Automações</h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-muted-foreground">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return null;
  }

  const successRate = statistics.totalAutomations > 0 
    ? Math.round((statistics.successCount / statistics.totalAutomations) * 100) 
    : 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Automações (últimos 7 dias)</h3>
        {onNavigateToAuditLog && (
          <button
            onClick={onNavigateToAuditLog}
            className="text-sm text-primary hover:underline"
          >
            Ver log completo →
          </button>
        )}
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total de Automações"
          value={statistics.totalAutomations}
          icon={TrendingUp}
          variant="blue"
        />

        <StatsCard
          title="Taxa de Sucesso"
          value={`${successRate}%`}
          icon={CheckCircle2}
          variant={successRate >= 90 ? 'green' : successRate >= 70 ? 'orange' : 'red'}
        />

        <StatsCard
          title="Sucessos"
          value={statistics.successCount}
          icon={CheckCircle2}
          variant="green"
        />

        <StatsCard
          title="Falhas"
          value={statistics.failureCount}
          icon={XCircle}
          variant={statistics.failureCount > 0 ? 'red' : 'green'}
        />
      </div>

      {/* By Type Breakdown */}
      {Object.keys(statistics.byType).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Por Tipo de Automação</CardTitle>
            <CardDescription>Distribuição de automações por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(statistics.byType).map(([type, stats]) => {
                const Icon = AUTOMATION_TYPE_ICONS[type] || Bot;
                const typeSuccessRate = stats.total > 0 
                  ? Math.round((stats.success / stats.total) * 100) 
                  : 100;
                
                return (
                  <div 
                    key={type} 
                    className="flex items-center space-x-3 p-3 rounded-lg border bg-card"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {AUTOMATION_TYPE_LABELS[type] || type}
                        </span>
                        <Badge 
                          variant={typeSuccessRate >= 90 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {typeSuccessRate}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats.success} sucesso / {stats.failed} falha
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Failures */}
      {statistics.recentFailures && statistics.recentFailures.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
              Falhas Recentes
            </CardTitle>
            <CardDescription>Últimas automações que falharam</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.recentFailures.slice(0, 5).map((failure: AuditLogEntry) => (
                <div 
                  key={failure.id} 
                  className="flex items-center justify-between p-2 rounded border bg-destructive/5"
                >
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">
                      {AUTOMATION_TYPE_LABELS[failure.automationType] || failure.automationType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • Usuário: {failure.userId.substring(0, 8)}...
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(failure.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
