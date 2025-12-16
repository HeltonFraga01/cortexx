/**
 * UserQuotasCard Component
 * 
 * Displays quotas with usage bars and override options.
 * Requirements: 3.4
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { adminQuotasService } from '@/services/admin-quotas'
import type { UserQuota, QuotaType } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Gauge, Settings, X } from 'lucide-react'

interface UserQuotasCardProps {
  userId: string
  quotas: UserQuota[]
  onUpdate?: () => void
}

const quotaLabels: Record<QuotaType, string> = {
  max_agents: 'Agentes',
  max_connections: 'Conexões',
  max_messages_per_day: 'Mensagens/Dia',
  max_messages_per_month: 'Mensagens/Mês',
  max_inboxes: 'Inboxes',
  max_teams: 'Times',
  max_webhooks: 'Webhooks',
  max_campaigns: 'Campanhas',
  max_storage_mb: 'Armazenamento (MB)',
  max_bots: 'Bots',
  // Bot usage quotas
  max_bot_calls_per_day: 'Chamadas Bot/Dia',
  max_bot_calls_per_month: 'Chamadas Bot/Mês',
  max_bot_messages_per_day: 'Msgs Bot/Dia',
  max_bot_messages_per_month: 'Msgs Bot/Mês',
  max_bot_tokens_per_day: 'Tokens IA/Dia',
  max_bot_tokens_per_month: 'Tokens IA/Mês',
}

export function UserQuotasCard({ userId, quotas, onUpdate }: UserQuotasCardProps) {
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [selectedQuota, setSelectedQuota] = useState<UserQuota | null>(null)
  const [newLimit, setNewLimit] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenOverride = (quota: UserQuota) => {
    setSelectedQuota(quota)
    setNewLimit(quota.limit.toString())
    setReason('')
    setOverrideDialogOpen(true)
  }

  const handleSetOverride = async () => {
    if (!selectedQuota || !newLimit) return

    try {
      setIsLoading(true)
      await adminQuotasService.setQuotaOverride(userId, selectedQuota.quotaType, {
        limit: parseInt(newLimit),
        reason: reason || undefined
      })
      toast.success('Override aplicado com sucesso')
      setOverrideDialogOpen(false)
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao aplicar override')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveOverride = async (quotaType: QuotaType) => {
    try {
      await adminQuotasService.removeQuotaOverride(userId, quotaType)
      toast.success('Override removido')
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao remover override')
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-primary'
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Quotas de Uso
          </CardTitle>
          <CardDescription>Limites e uso atual de recursos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quotas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma quota configurada</p>
          ) : (
            quotas.map((quota) => (
              <div key={quota.quotaType} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {quotaLabels[quota.quotaType] || quota.quotaType}
                    </span>
                    {quota.source === 'override' && (
                      <Badge variant="outline" className="text-xs">Override</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {quota.currentUsage.toLocaleString()} / {quota.limit.toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleOpenOverride(quota)}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    {quota.source === 'override' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleRemoveOverride(quota.quotaType)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <Progress
                  value={quota.percentage}
                  className="h-2"
                  indicatorClassName={getProgressColor(quota.percentage)}
                />
                {quota.overrideReason && (
                  <p className="text-xs text-muted-foreground">
                    Motivo: {quota.overrideReason}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Override de Quota</DialogTitle>
            <DialogDescription>
              {selectedQuota && quotaLabels[selectedQuota.quotaType]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Novo Limite</label>
              <Input
                type="number"
                min="0"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                placeholder="Digite o novo limite"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo para o override..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSetOverride} disabled={!newLimit || isLoading}>
              {isLoading ? 'Aplicando...' : 'Aplicar Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
