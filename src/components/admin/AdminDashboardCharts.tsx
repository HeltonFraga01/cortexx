/**
 * AdminDashboardCharts Component
 * 
 * Display growth charts and trends.
 * Requirements: 5.1
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { adminDashboardService } from '@/services/admin-dashboard'
import type { GrowthMetric } from '@/types/admin-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Loader2 } from 'lucide-react'

export function AdminDashboardCharts() {
  const [growthData, setGrowthData] = useState<GrowthMetric[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadGrowthData()
  }, [])

  const loadGrowthData = async () => {
    try {
      setIsLoading(true)
      const data = await adminDashboardService.getGrowthMetrics()
      setGrowthData(data)
    } catch (error) {
      toast.error('Falha ao carregar dados de crescimento')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    })
  }

  // Calculate max value for scaling
  const maxUsers = Math.max(...growthData.map(d => d.totalUsers), 1)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Crescimento de Usuários
        </CardTitle>
        <CardDescription>Evolução do número de usuários nos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {growthData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Sem dados de crescimento disponíveis</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simple bar chart */}
            <div className="flex items-end gap-1 h-40">
              {growthData.slice(-14).map((metric, index) => {
                const height = (metric.totalUsers / maxUsers) * 100
                return (
                  <div
                    key={metric.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${metric.totalUsers} usuários em ${formatDate(metric.date)}`}
                    />
                    {index % 2 === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(metric.date)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {growthData[growthData.length - 1]?.totalUsers || 0}
                </p>
                <p className="text-xs text-muted-foreground">Usuários Atuais</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {growthData.length > 1 
                    ? growthData[growthData.length - 1].totalUsers - growthData[0].totalUsers
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">Crescimento no Período</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {growthData.length > 1
                    ? Math.round(((growthData[growthData.length - 1].totalUsers - growthData[0].totalUsers) / Math.max(growthData[0].totalUsers, 1)) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Taxa de Crescimento</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
