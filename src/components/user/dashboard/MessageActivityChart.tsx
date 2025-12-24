/**
 * MessageActivityChart Component
 * Line chart showing messages sent and received over time
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { cn } from '@/lib/utils'
import type { MessageActivityChartProps } from '@/types/dashboard'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="font-medium mb-2">{label && formatDate(label)}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {entry.name === 'incoming' ? 'Recebidas' : 'Enviadas'}:
          </span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function MessageActivityChart({
  data,
  viewMode,
  onViewModeChange,
  isLoading
}: MessageActivityChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-1 pt-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-7 w-28" />
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const hasData = data.length > 0 && data.some(d => d.incoming > 0 || d.outgoing > 0)

  return (
    <Card>
      <CardHeader className="pb-1 pt-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Atividade de Mensagens
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'daily' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => onViewModeChange('daily')}
            >
              Diário
            </Button>
            <Button
              variant={viewMode === 'hourly' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => onViewModeChange('hourly')}
            >
              Por hora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {!hasData ? (
          <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados de mensagens no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (value === 'incoming' ? 'Recebidas' : 'Enviadas')}
                wrapperStyle={{ fontSize: '11px' }}
              />
              <Line
                type="monotone"
                dataKey="incoming"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="outgoing"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default MessageActivityChart
