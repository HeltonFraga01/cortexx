import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { automationService } from '@/services/automation';
import type { AuditLogEntry, AuditLogFilters, AutomationStatistics } from '@/types/automation';

const AUTOMATION_TYPE_LABELS: Record<string, string> = {
  bot: 'Bot',
  labels: 'Labels',
  canned_responses: 'Respostas Rápidas',
  webhooks: 'Webhooks',
  quotas: 'Quotas'
};

export default function AutomationAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [statistics, setStatistics] = useState<AutomationStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [pagination, setPagination] = useState({ limit: 20, offset: 0, total: 0, hasMore: false });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, [filters, pagination.offset]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [logData, statsData] = await Promise.all([
        automationService.getAuditLog(filters, { limit: pagination.limit, offset: pagination.offset }),
        automationService.getStatistics()
      ]);
      setEntries(logData.entries);
      setPagination(prev => ({ ...prev, ...logData.pagination }));
      setStatistics(statsData);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handlePrevPage = () => {
    setPagination(prev => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit)
    }));
  };

  const handleNextPage = () => {
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-4">
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{statistics.totalAutomations}</div>
              <p className="text-xs text-muted-foreground">Total (7 dias)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{statistics.successCount}</div>
              <p className="text-xs text-muted-foreground">Sucesso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{statistics.failureCount}</div>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{statistics.successRate}%</div>
              <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Log de Auditoria</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showFilters && (
            <div className="grid gap-4 md:grid-cols-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={filters.automationType || ''}
                  onValueChange={(value) => handleFilterChange('automationType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="bot">Bot</SelectItem>
                    <SelectItem value="labels">Labels</SelectItem>
                    <SelectItem value="canned_responses">Respostas Rápidas</SelectItem>
                    <SelectItem value="webhooks">Webhooks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="failed">Falha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum registro encontrado
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate">
                        {entry.userId}
                      </TableCell>
                      <TableCell>
                        {AUTOMATION_TYPE_LABELS[entry.automationType] || entry.automationType}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.status === 'success' ? 'default' : 'destructive'}>
                          {entry.status === 'success' ? 'Sucesso' : 'Falha'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.errorMessage || (entry.details ? JSON.stringify(entry.details) : '-')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + entries.length, pagination.total)} de {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={pagination.offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!pagination.hasMore}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
