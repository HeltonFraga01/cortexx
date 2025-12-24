/**
 * CampaignStatusCard Component
 * Displays active campaigns with progress and recent completed campaign
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Megaphone, Play, Pause, CheckCircle, Clock, Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CampaignStatusProps, CampaignSummary } from '@/types/dashboard'

const statusConfig = {
  draft: { label: 'Rascunho', icon: Clock, color: 'bg-gray-100 text-gray-800' },
  scheduled: { label: 'Agendada', icon: Clock, color: 'bg-blue-100 text-blue-800' },
  running: { label: 'Em execução', icon: Play, color: 'bg-green-100 text-green-800' },
  paused: { label: 'Pausada', icon: Pause, color: 'bg-orange-100 text-orange-800' },
  completed: { label: 'Concluída', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelada', icon: AlertCircle, color: 'bg-red-100 text-red-800' }
}

function CampaignItem({
  campaign,
  onClick
}: {
  campaign: CampaignSummary
  onClick: () => void
}) {
  const config = statusConfig[campaign.status] || statusConfig.draft
  const Icon = config.icon

  return (
    <div
      className="p-2 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm truncate flex-1">{campaign.name}</p>
        <Badge className={cn('text-[10px] px-1.5 py-0', config.color)}>
          <Icon className="h-2.5 w-2.5 mr-0.5" />
          {config.label}
        </Badge>
      </div>
      
      {campaign.status === 'running' && (
        <div className="mt-1.5 space-y-0.5">
          <Progress value={campaign.progress} className="h-1.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{campaign.sentCount} enviadas</span>
            <span>{campaign.progress}%</span>
          </div>
        </div>
      )}
      
      {campaign.status !== 'running' && (
        <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
          <span>Total: {campaign.totalContacts}</span>
          <span className="text-green-600">{campaign.sentCount} ok</span>
          {campaign.failedCount > 0 && (
            <span className="text-red-600">{campaign.failedCount} falhas</span>
          )}
        </div>
      )}
    </div>
  )
}

export function CampaignStatusCard({
  activeCampaigns,
  recentCampaign,
  onCampaignClick,
  isLoading
}: CampaignStatusProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-2 px-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="px-3 pb-2 space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const hasNoCampaigns = activeCampaigns.length === 0 && !recentCampaign

  if (hasNoCampaigns) {
    return (
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
            Campanhas
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex flex-col items-center justify-center py-3 text-center">
            <Megaphone className="h-8 w-8 text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground mb-2">
              Nenhuma campanha criada
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate('/user/campaigns/new')}
            >
              <Plus className="h-3 w-3 mr-1" />
              Criar campanha
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
            Campanhas
          </CardTitle>
          {activeCampaigns.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600">
              {activeCampaigns.length} ativa{activeCampaigns.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-2 space-y-2">
        {/* Active campaigns */}
        {activeCampaigns.map((campaign) => (
          <CampaignItem
            key={campaign.id}
            campaign={campaign}
            onClick={() => onCampaignClick(campaign.id)}
          />
        ))}

        {/* Recent completed campaign */}
        {recentCampaign && activeCampaigns.length === 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Última campanha</p>
            <CampaignItem
              campaign={recentCampaign}
              onClick={() => onCampaignClick(recentCampaign.id)}
            />
          </div>
        )}

        {/* View all link */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => navigate('/user/campaigns')}
        >
          Ver todas
        </Button>
      </CardContent>
    </Card>
  )
}

export default CampaignStatusCard
