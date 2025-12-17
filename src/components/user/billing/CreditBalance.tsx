/**
 * CreditBalance Component
 * 
 * Displays user's credit balance:
 * - Plan tokens (included in subscription)
 * - Extra credits (purchased separately)
 * 
 * Requirements: 6.4, 6.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Coins, AlertTriangle, Plus, Sparkles, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { CreditBalance as CreditBalanceType } from '@/types/stripe'

interface CreditBalanceProps {
  onPurchase?: () => void
}

export function CreditBalance({ onPurchase }: CreditBalanceProps) {
  const [balance, setBalance] = useState<CreditBalanceType | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadBalance()
  }, [])

  async function loadBalance() {
    try {
      setLoading(true)
      const data = await stripeService.getCreditBalance()
      setBalance(data)
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar saldo de créditos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString('pt-BR')
  }

  function formatResetTime(dateStr: string | null): string {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays}d`
    if (diffHours > 0) return `${diffHours}h`
    return 'em breve'
  }

  function getUsagePercentage(used: number, limit: number): number {
    if (limit === 0) return 0
    return Math.min(100, (used / limit) * 100)
  }

  function getProgressColor(percentage: number): string {
    if (percentage >= 90) return '[&>div]:bg-destructive'
    if (percentage >= 70) return '[&>div]:bg-yellow-500'
    return ''
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!balance) {
    return null
  }

  const { planTokens, extraCredits } = balance
  const monthlyPercentage = getUsagePercentage(planTokens.monthly.used, planTokens.monthly.limit)
  const dailyPercentage = getUsagePercentage(planTokens.daily.used, planTokens.daily.limit)
  const planExhausted = planTokens.monthly.remaining === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Tokens de IA</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={onPurchase}>
            <Plus className="mr-2 h-4 w-4" />
            Comprar Extras
          </Button>
        </div>
        <CardDescription>
          Tokens disponíveis para uso com bots de IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Tokens - Monthly */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tokens do Plano (Mensal)</span>
              <Badge variant="secondary" className="text-xs">Incluído</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Renova em {formatResetTime(planTokens.monthlyResetAt)}</span>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{formatNumber(planTokens.monthly.remaining)}</span>
            <span className="text-muted-foreground">/ {formatNumber(planTokens.monthly.limit)}</span>
          </div>
          
          <Progress 
            value={monthlyPercentage} 
            className={getProgressColor(monthlyPercentage)}
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatNumber(planTokens.monthly.used)} usados</span>
            <span>{Math.round(monthlyPercentage)}% utilizado</span>
          </div>
        </div>

        {/* Plan Tokens - Daily */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Limite Diário</span>
            <span className="text-sm">
              {formatNumber(planTokens.daily.remaining)} / {formatNumber(planTokens.daily.limit)}
            </span>
          </div>
          <Progress 
            value={dailyPercentage} 
            className={`h-2 ${getProgressColor(dailyPercentage)}`}
          />
        </div>

        {/* Extra Credits */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Créditos Extras</span>
              <Badge variant="outline" className="text-xs">Compra avulsa</Badge>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatNumber(extraCredits.available)}</span>
            <span className="text-muted-foreground text-sm">tokens extras</span>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Créditos extras são usados quando os tokens do plano acabam. Não expiram.
          </p>
        </div>

        {/* Warnings */}
        {planExhausted && extraCredits.available === 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Seus tokens do plano acabaram e você não tem créditos extras. 
              Compre créditos para continuar usando os bots de IA.
            </AlertDescription>
          </Alert>
        )}

        {planExhausted && extraCredits.available > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Tokens do plano esgotados. Usando créditos extras ({formatNumber(extraCredits.available)} disponíveis).
            </AlertDescription>
          </Alert>
        )}

        {monthlyPercentage >= 80 && !planExhausted && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você já usou {Math.round(monthlyPercentage)}% dos tokens do plano este mês.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default CreditBalance
