/**
 * ReportsPage
 * Campaign reports visualization and export
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom';
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { ReportFilters } from '@/components/features/messaging/ReportFilters';
import { ReportViewer } from '@/components/features/messaging/ReportViewer';
import {
  reportService,
  ReportFilters as ReportFiltersType,
  CampaignSummary,
} from '@/services/reportService';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { toast } from 'sonner';

export function ReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [reports, setReports] = useState<CampaignSummary[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const {
    filters,
    setFilters,
    clearFilters: clearPersistedFilters,
  } = usePersistedFilters<ReportFiltersType>({
    key: 'messaging-reports-filters',
    defaultValue: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Check for pre-selected campaign from navigation
  useEffect(() => {
    const state = location.state as { campaignId?: string } | null;
    if (state?.campaignId) {
      setSelectedCampaignId(state.campaignId);
    }
  }, [location.state]);

  const loadReports = async (page = 1) => {
    setIsLoading(true);
    try {
      const result = await reportService.list(filters, page, pagination.limit);
      setReports(result.data);
      setPagination(result.pagination);
    } catch (error: any) {
      toast.error('Erro ao carregar relatórios', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleApplyFilters = () => {
    loadReports(1);
  };

  const handleClearFilters = () => {
    clearPersistedFilters();
    loadReports(1);
  };

  const handleViewReport = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
  };

  const handleCloseReport = () => {
    setSelectedCampaignId(null);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      scheduled: { variant: 'outline', label: 'Agendada' },
      running: { variant: 'default', label: 'Em execução' },
      paused: { variant: 'secondary', label: 'Pausada' },
      completed: { variant: 'secondary', label: 'Concluída' },
      cancelled: { variant: 'destructive', label: 'Cancelada' },
      failed: { variant: 'destructive', label: 'Falhou' },
    };
    const { variant, label } = config[status] || { variant: 'outline', label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Show detailed report if selected
  if (selectedCampaignId) {
    return (
      <div className="w-full max-w-full overflow-x-hidden px-4 md:px-6 space-y-6">
        <PageHeader
          title="Detalhes do Relatório"
          backButton={{
            label: 'Voltar para lista',
            onClick: handleCloseReport,
          }}
        />
        <ReportViewer campaignId={selectedCampaignId} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 md:px-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Relatórios"
        subtitle="Visualize e exporte relatórios de campanhas"
        backButton={{
          label: 'Voltar',
          onClick: () => navigate('/user/mensagens'),
        }}
      />

      {/* Filters */}
      <ReportFilters
        filters={filters}
        onFiltersChange={setFilters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Reports List */}
      <Card>
        <CardHeaderWithIcon
          icon={BarChart3}
          iconColor="text-blue-500"
          title="Campanhas"
        />
        <CardContent>
          {isLoading ? (
            <LoadingSkeleton variant="list" count={3} />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Nenhum relatório encontrado"
              description="Crie uma campanha para ver os relatórios aqui"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contatos</TableHead>
                    <TableHead>Taxa de Entrega</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.name}</TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell>
                        {report.sentCount}/{report.totalContacts}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.deliveryRate}%</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReport(report.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {pagination.page} de {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadReports(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadReports(pagination.page + 1)}
                      disabled={!pagination.hasMore}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportsPage;
