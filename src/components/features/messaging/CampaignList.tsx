/**
 * CampaignList Component
 * Displays campaigns organized by status tabs with actions
 * 
 * Requirements: 2.1, 2.2, 2.4
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Clock,
  Play,
  CheckCircle,
  Edit,
  XCircle,
  Pause,
  BarChart3,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import {
  bulkCampaignService,
  Campaign,
  CampaignCategory,
} from '@/services/bulkCampaignService';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampaignListProps {
  onViewReport?: (campaignId: string) => void;
  onEdit?: (campaign: Campaign) => void;
  onMonitor?: (campaign: Campaign) => void;
}

export function CampaignList({
  onViewReport,
  onEdit,
  onMonitor,
}: CampaignListProps) {
  const [activeTab, setActiveTab] = useState<CampaignCategory>('running');
  const [campaigns, setCampaigns] = useState<Record<CampaignCategory, Campaign[]>>({
    scheduled: [],
    running: [],
    completed: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadCampaigns = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // Load active campaigns (scheduled, running, paused)
      const activeCampaigns = await bulkCampaignService.getActiveCampaigns();
      
      // Load history (all campaigns including completed)
      const historyResult = await bulkCampaignService.getCampaignHistory({ limit: 50 });
      
      // Deduplicate: use Map to keep unique campaigns by ID
      // Active campaigns take precedence (more up-to-date status)
      const campaignMap = new Map<string, Campaign>();
      
      // Add history first (will be overwritten by active if duplicate)
      historyResult.data.forEach(campaign => {
        campaignMap.set(campaign.id, campaign);
      });
      
      // Add active campaigns (overwrites duplicates from history with fresh data)
      activeCampaigns.forEach(campaign => {
        campaignMap.set(campaign.id, campaign);
      });
      
      // Convert back to array and group by category
      const allCampaigns = Array.from(campaignMap.values());
      
      // Sort by creation date (newest first)
      allCampaigns.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      const grouped = bulkCampaignService.groupByCategory(allCampaigns);
      
      setCampaigns(grouped);
    } catch (error: any) {
      // Só mostrar erro no carregamento inicial
      if (showLoading) {
        toast.error('Erro ao carregar campanhas', {
          description: error.message,
        });
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Carregamento inicial
  useEffect(() => {
    loadCampaigns();
  }, []);

  // Auto-refresh a cada 5 segundos quando há campanhas em execução
  useEffect(() => {
    const hasRunningCampaigns = campaigns.running.some(
      c => c.status === 'running' || c.status === 'paused'
    );
    
    if (!hasRunningCampaigns) return;

    const interval = setInterval(() => {
      loadCampaigns(false); // Não mostrar loading no auto-refresh
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns.running]);

  const handleCancel = async (campaign: Campaign) => {
    const confirmed = await confirm({
      title: 'Cancelar Campanha',
      description: `Tem certeza que deseja cancelar a campanha "${campaign.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Cancelar Campanha',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await bulkCampaignService.cancelCampaign(campaign.id);
        toast.success('Campanha cancelada');
        await loadCampaigns(false); // Recarregar sem mostrar loading
      } catch (error: any) {
        toast.error('Erro ao cancelar campanha', {
          description: error.message,
        });
      }
    }
  };

  const handlePause = async (campaign: Campaign) => {
    try {
      await bulkCampaignService.pauseCampaign(campaign.id);
      toast.success('Campanha pausada');
      await loadCampaigns(false); // Recarregar sem mostrar loading
    } catch (error: any) {
      toast.error('Erro ao pausar campanha', {
        description: error.message,
      });
    }
  };

  const handleResume = async (campaign: Campaign) => {
    try {
      await bulkCampaignService.resumeCampaign(campaign.id);
      toast.success('Campanha retomada');
      await loadCampaigns(false); // Recarregar sem mostrar loading
    } catch (error: any) {
      toast.error('Erro ao retomar campanha', {
        description: error.message,
      });
    }
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getSuccessRate = (campaign: Campaign) => {
    if (!campaign.totalContacts) return 0;
    return Math.round((campaign.sentCount / campaign.totalContacts) * 100);
  };

  const renderCampaignRow = (campaign: Campaign, category: CampaignCategory) => (
    <TableRow key={campaign.id}>
      <TableCell className="font-medium">{campaign.name}</TableCell>
      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
      <TableCell>
        {campaign.sentCount}/{campaign.totalContacts}
        <span className="text-muted-foreground ml-1">
          ({getSuccessRate(campaign)}%)
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {category === 'scheduled' && campaign.scheduledAt
          ? formatDate(campaign.scheduledAt)
          : formatDate(campaign.createdAt)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {category === 'scheduled' && (
            <>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(campaign)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancel(campaign)}
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          {category === 'running' && (
            <>
              {onMonitor && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMonitor(campaign)}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              )}
              {campaign.status === 'running' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePause(campaign)}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResume(campaign)}
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancel(campaign)}
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          {category === 'completed' && onViewReport && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewReport(campaign.id)}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  const tabConfig: { value: CampaignCategory; label: string; icon: React.ReactNode }[] = [
    { value: 'scheduled', label: 'Programadas', icon: <Clock className="h-4 w-4" /> },
    { value: 'running', label: 'Em Execução', icon: <Play className="h-4 w-4" /> },
    { value: 'completed', label: 'Finalizadas', icon: <CheckCircle className="h-4 w-4" /> },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeaderWithIcon
          icon={Inbox}
          iconColor="text-blue-500"
          title="Caixa de Saída"
        />
        <CardContent className="space-y-4">
          <LoadingSkeleton variant="list" count={3} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeaderWithIcon
          icon={Inbox}
          iconColor="text-blue-500"
          title="Caixa de Saída"
          action={{
            label: "Atualizar",
            onClick: loadCampaigns
          }}
        />
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CampaignCategory)}>
            <TabsList className="grid w-full grid-cols-3">
              {tabConfig.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                  <Badge variant="secondary" className="ml-1">
                    {campaigns[tab.value].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {tabConfig.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {campaigns[tab.value].length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title={`Nenhuma campanha ${tab.label.toLowerCase()}`}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns[tab.value].map((campaign) =>
                        renderCampaignRow(campaign, tab.value)
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}

export default CampaignList;
