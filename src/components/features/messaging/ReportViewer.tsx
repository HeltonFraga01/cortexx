/**
 * ReportViewer Component
 * Displays detailed campaign report with metrics and export options
 * 
 * Requirements: 3.2, 3.4, 3.5
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState, StatsCard } from '@/components/ui-custom';
import {
  Download,
  FileText,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Send,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { reportService, CampaignReport } from '@/services/reportService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportViewerProps {
  campaignId: string;
  onExport?: (format: 'csv' | 'pdf') => void;
}

export function ReportViewer({ campaignId, onExport }: ReportViewerProps) {
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const data = await reportService.getDetail(campaignId);
      setReport(data);
    } catch (error: any) {
      toast.error('Erro ao carregar relatório', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [campaignId]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    try {
      await reportService.downloadReport(campaignId, format);
      toast.success(`Relatório exportado em ${format.toUpperCase()}`);
      onExport?.(format);
    } catch (error: any) {
      toast.error('Erro ao exportar relatório', {
        description: error.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      sent: { variant: 'default', label: 'Enviado' },
      failed: { variant: 'destructive', label: 'Falhou' },
      pending: { variant: 'outline', label: 'Pendente' },
    };
    const { variant, label } = config[status] || { variant: 'outline', label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeaderWithIcon
          icon={BarChart3}
          iconColor="text-blue-500"
          title="Relatório da Campanha"
        />
        <CardContent className="space-y-4">
          <LoadingSkeleton variant="stats" />
          <LoadingSkeleton variant="card" />
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={FileText}
            title="Relatório não encontrado"
            description="O relatório solicitado não existe ou foi removido"
          />
        </CardContent>
      </Card>
    );
  }

  const { campaign, metrics, contacts } = report;
  const errorTypes = Object.entries(metrics.errorsByType);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl truncate min-w-0">
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{campaign.name}</span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="w-full sm:w-auto flex-shrink-0"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground block text-xs">Instância:</span>
              <span className="font-medium break-all text-xs sm:text-sm">{campaign.instance}</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block text-xs">Criada em:</span>
              <span className="font-medium text-xs sm:text-sm">{formatDate(campaign.createdAt)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block text-xs">Iniciada em:</span>
              <span className="font-medium text-xs sm:text-sm">{formatDate(campaign.startedAt)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block text-xs">Concluída em:</span>
              <span className="font-medium text-xs sm:text-sm">{formatDate(campaign.completedAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Contatos"
          value={campaign.totalContacts}
          icon={Users}
          variant="blue"
        />
        <StatsCard
          title="Enviados"
          value={campaign.sentCount}
          icon={Send}
          variant="green"
        />
        <StatsCard
          title="Erros"
          value={campaign.failedCount}
          icon={XCircle}
          variant="red"
        />
        <StatsCard
          title="Taxa de Entrega"
          value={`${metrics.deliveryRate}%`}
          icon={TrendingUp}
          variant="purple"
        />
      </div>

      {/* Delivery Rate Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxa de Entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={metrics.deliveryRate} className="h-4" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>0%</span>
            <span>{metrics.deliveryRate.toFixed(1)}%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* Error Breakdown */}
      {errorTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Erros por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errorTypes.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{reportService.getErrorTypeLabel(type)}</span>
                  <Badge variant="destructive">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Métricas Adicionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Tempo médio de envio</p>
                <p className="font-medium">
                  {metrics.averageSendTime > 0
                    ? reportService.formatDuration(metrics.averageSendTime)
                    : '-'}
                </p>
              </div>
            </div>
            {metrics.totalDuration && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Duração total</p>
                  <p className="font-medium">
                    {reportService.formatDuration(metrics.totalDuration)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhes dos Contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Enviado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.slice(0, 100).map((contact, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{contact.phone}</TableCell>
                    <TableCell>{contact.name || '-'}</TableCell>
                    <TableCell>{getStatusBadge(contact.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {contact.errorMessage || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.sentAt ? formatDate(contact.sentAt) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {contacts.length > 100 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Mostrando 100 de {contacts.length} contatos. Exporte o relatório para ver todos.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportViewer;
