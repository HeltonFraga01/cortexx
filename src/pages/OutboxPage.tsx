/**
 * OutboxPage
 * Campaign management page organized by status
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Send } from 'lucide-react';
import { CampaignList } from '@/components/features/messaging/CampaignList';
import { CampaignMonitor } from '@/components/features/messaging/CampaignMonitor';
import { Campaign } from '@/services/bulkCampaignService';

export function OutboxPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [monitoringCampaign, setMonitoringCampaign] = useState<Campaign | null>(null);

  // Check for highlighted campaign from navigation
  const highlightedCampaignId = (location.state as { highlightedCampaignId?: string } | null)?.highlightedCampaignId;

  const handleViewReport = (campaignId: string) => {
    navigate(`/user/mensagens/relatorios`, {
      state: { campaignId },
    });
  };

  const handleMonitor = (campaign: Campaign) => {
    setMonitoringCampaign(campaign);
  };

  const handleCloseMonitor = () => {
    setMonitoringCampaign(null);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 md:px-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Caixa de Saída"
        subtitle="Gerencie suas campanhas de mensagens"
        backButton={{
          label: 'Voltar',
          onClick: () => navigate('/user/mensagens'),
        }}
        actions={[
          {
            label: 'Nova Campanha',
            onClick: () => navigate('/user/mensagens'),
            icon: <Send className="h-4 w-4" />,
          },
        ]}
      />

      {/* Campaign Monitor (if monitoring) */}
      {monitoringCampaign && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              Monitorando: {monitoringCampaign.name}
            </h2>
            <Button variant="outline" size="sm" onClick={handleCloseMonitor}>
              Fechar Monitor
            </Button>
          </div>
          <CampaignMonitor
            campaignId={monitoringCampaign.id}
            onComplete={handleCloseMonitor}
          />
        </div>
      )}

      {/* Campaign List */}
      <CampaignList
        onViewReport={handleViewReport}
        onMonitor={handleMonitor}
      />
    </div>
  );
}

export default OutboxPage;
