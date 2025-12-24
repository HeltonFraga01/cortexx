/**
 * ContactGrowthChart Component
 * Bar chart showing new contacts per day with cumulative trend line
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ContactGrowthChartProps } from '@/types/dashboard'

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
            {entry.name === 'newContacts' ? 'Novos' : 'Total'}:
          </span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ContactGrowthChart({
  data,
  totalContacts,
  growthPercentage,
  isLoading,
  compact = false
}: ContactGrowthChartProps & { compact?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent className={compact ? 'pt-0' : ''}>
          <Skeleton className={compact ? 'h-[140px] w-full' : 'h-[200px] w-full'} />
        </CardContent>
      </Card>
    )
  }

  const hasData = data.length > 0 && data.some(d => d.newContacts > 0)
  const isPositiveGrowth = growthPercentage >= 0

  return (
    <Card>
      <CardHeader className={compact ? 'pb-1 pt-3' : 'pb-2'}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Crescimento de Contatos
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={compact ? 'text-lg font-bold' : 'text-2xl font-bold'}>{totalContacts.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">contatos totais</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'flex items-center gap-1',
                isPositiveGrowth ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'
              )}
            >
              {isPositiveGrowth ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(growthPercentage)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? 'pt-0 pb-2' : ''}>
        {!hasData ? (
          <div className={cn(
            'flex items-center justify-center text-muted-foreground text-sm',
            compact ? 'h-[100px]' : 'h-[200px]'
          )}>
            Sem dados de contatos no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={compact ? 140 : 200}>
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                width={30}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                width={30}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (value === 'newContacts' ? 'Novos contatos' : 'Acumulado')}
                wrapperStyle={{ fontSize: '11px' }}
              />
              <Bar
                yAxisId="left"
                dataKey="newContacts"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default ContactGrowthChart
