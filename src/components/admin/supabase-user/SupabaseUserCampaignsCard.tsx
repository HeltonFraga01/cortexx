/**
 * SupabaseUserCampaignsCard
 * 
 * Displays user's recent campaigns
 */

import { Megaphone, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { UserCampaign } from '@/types/supabase-user'

interface SupabaseUserCampaignsCardProps {
  campaigns: UserCampaign[]
}

export function SupabaseUserCampaignsCard({ campaigns }: SupabaseUserCampaignsCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluída
          </Badge>
        )
      case 'running':
      case 'in_progress':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Clock className="h-3 w-3 mr-1" />
            Em Andamento
          </Badge>
        )
      case 'pending':
      case 'scheduled':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        )
      case 'paused':
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pausada
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        )
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const getProgress = (campaign: UserCampaign) => {
    if (!campaign.total_contacts || campaign.total_contacts === 0) return 0
    const sent = campaign.sent_count || 0
    return Math.round((sent / campaign.total_contacts) * 100)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campanhas Recentes
          </div>
          <Badge variant="secondary">{campaigns.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma campanha encontrada
          </p>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div 
                key={campaign.id} 
                className="p-3 bg-muted/50 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(campaign.created_at)}
                    </p>
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>
                {campaign.total_contacts && campaign.total_contacts > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>
                        {campaign.sent_count || 0} / {campaign.total_contacts}
                        {campaign.failed_count ? ` (${campaign.failed_count} falhas)` : ''}
                      </span>
                    </div>
                    <Progress value={getProgress(campaign)} className="h-2" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
