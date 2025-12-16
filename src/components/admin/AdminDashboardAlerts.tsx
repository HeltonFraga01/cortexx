/**
 * AdminDashboardAlerts Component
 * 
 * Display active alerts with actions.
 * Requirements: 5.5
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { adminDashboardService } from '@/services/admin-dashboard'
import type { DashboardAlert, AlertSeverity } from '@/types/admin-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, AlertCircle, Info, Bell, RefreshCw, Loader2 } from 'lucide-react'

export function AdminDashboardAlerts() {
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      setIsLoading(true)
      const data = await adminDashboardService.getAlerts()
      setAlerts(data)
    } catch (error) {
      toast.error('Falha ao carregar alertas')
    } finally {
      setIsLoading(false)
    }
  }

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getSeverityBadge = (severity: AlertSeverity) => {
    const variants: Record<AlertSeverity, 'default' | 'secondary' | 'destructive'> = {
      info: 'secondary',
      warning: 'default',
      error: 'destructive',
    }
    return <Badge variant={variants[severity]}>{severity}</Badge>
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas
          </CardTitle>
          <CardDescription>Alertas e notificações do sistema</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={loadAlerts} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum alerta ativo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getSeverityBadge(alert.severity)}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(alert.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  {alert.userId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Usuário: {alert.userId.substring(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
