/**
 * LeadScoreCard Component
 * 
 * Displays lead score (0-100) with progress bar and tier badge.
 * Allows manual score adjustment.
 * 
 * Requirements: 2.1, 2.5 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Edit2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadTier, LeadScoreBreakdown } from '@/types/crm'

interface LeadScoreCardProps {
  score: number
  tier: LeadTier
  lastUpdated?: string
  breakdown?: LeadScoreBreakdown
  onUpdateScore?: (score: number) => Promise<void>
  isLoading?: boolean
}

const tierConfig: Record<LeadTier, { label: string; color: string; bgColor: string }> = {
  cold: { label: 'Frio', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  warm: { label: 'Morno', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  hot: { label: 'Quente', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  vip: { label: 'VIP', color: 'text-purple-700', bgColor: 'bg-purple-100' }
}

export function LeadScoreCard({
  score,
  tier,
  lastUpdated,
  breakdown,
  onUpdateScore,
  isLoading
}: LeadScoreCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(score))
  const [isSaving, setIsSaving] = useState(false)

  const config = tierConfig[tier]

  const handleSave = async () => {
    const newScore = parseInt(editValue, 10)
    if (isNaN(newScore) || newScore < 0 || newScore > 100) return
    
    setIsSaving(true)
    try {
      await onUpdateScore?.(newScore)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(String(score))
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-6 w-16" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Lead Score
          </CardTitle>
          {onUpdateScore && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 w-7 p-0"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-20 h-8"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-3xl font-bold">{score}</div>
        )}

        <Progress value={score} className="h-2" />

        <div className="flex items-center justify-between">
          <Badge className={cn(config.bgColor, config.color, 'hover:' + config.bgColor)}>
            {config.label}
          </Badge>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {new Date(lastUpdated).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {breakdown && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Composição</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mensagens</span>
                <span className="font-medium">+{breakdown.messages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compras</span>
                <span className="font-medium">+{breakdown.purchases}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recência</span>
                <span className="font-medium">+{breakdown.recency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custom</span>
                <span className="font-medium">+{breakdown.custom}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LeadScoreCard
