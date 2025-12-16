/**
 * CampaignReportViewer Component
 * 
 * Visualiza relatórios detalhados de campanhas concluídas
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  FileText,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { bulkCampaignService, type CampaignReport } from '@/services/bulkCampaignService';
import { VariationStatsCard } from '@/components/user/VariationStatsCard';

interface CampaignReportViewerProps {
  campaignId: string;
  userToken: string;
}

export function CampaignReportViewer({ campaignId, userToken }: CampaignReportViewerProps) {
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Fetch report
  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const reportData = await bulkCampaignService.getCampaignReport(campaignId);
        setReport(reportData);
      } catch (error: any) {
        toast.error('Erro ao carregar relatório: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [campaignId, userToken]);

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const blob = await bulkCampaignService.exportReportCSV(campaignId);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${report?.campaignName.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Relatório exportado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao exportar: ' + error.message);
    } finally {
      setExporting(false);
    }
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

  if (!report) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-2">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">Relatório não encontrado</h3>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errorEntries = Object.entries(report.errorsByType).filter(([_, count]) => count > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>{report.campaignName}</CardTitle>
              <CardDescription>Instância: {report.instance}</CardDescription>
            </div>
            <Button onClick={handleExportCSV} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="variations" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Variações
          </TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total de Contatos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{report.stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Enviados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{report.stats.sent}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Falhas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">{report.stats.failed}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Taxa de Sucesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{report.stats.successRate.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Linha do Tempo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Iniciado</span>
                <span className="text-sm font-medium">
                  {new Date(report.executedAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Concluído</span>
                <span className="text-sm font-medium">
                  {new Date(report.completedAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Duração</span>
                <span className="text-sm font-medium">
                  {bulkCampaignService.formatDuration(report.duration)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo de Mensagem</span>
                <Badge variant="outline">{report.config.messageType}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Delay</span>
                <span className="text-sm font-medium">
                  {report.config.delayMin}s - {report.config.delayMax}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ordem Randomizada</span>
                <Badge variant={report.config.randomizeOrder ? 'default' : 'secondary'}>
                  {report.config.randomizeOrder ? 'Sim' : 'Não'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Error Breakdown */}
          {errorEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Erros por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorEntries.map(([type, count]) => {
                    const percentage = ((count / report.stats.total) * 100).toFixed(1);
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {bulkCampaignService.getErrorMessage(type)}
                          </span>
                          <span className="text-muted-foreground">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
          {report.stats.failed === 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <strong>Campanha 100% bem-sucedida!</strong> Todas as mensagens foram enviadas sem erros.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Tab: Variações */}
        <TabsContent value="variations" className="space-y-6">
          <VariationStatsCard
            campaignId={campaignId}
            userToken={userToken}
            expanded={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
