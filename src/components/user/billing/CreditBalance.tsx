/**
 * CreditBalance Component
 * 
 * Displays user's credit balance with low balance warning.
 * Requirements: 6.4, 6.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, AlertTriangle, Plus } from 'lucide-react'
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!balance) {
    return null
  }

  const usagePercentage = balance.lowBalanceThreshold > 0
    ? Math.min(100, (balance.available / balance.lowBalanceThreshold) * 100)
    : 100

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle>Saldo de Créditos</CardTitle>
          </div>
          <Button size="sm" onClick={onPurchase}>
            <Plus className="mr-2 h-4 w-4" />
            Comprar Créditos
          </Button>
        </div>
        <CardDescription>
          Créditos disponíveis para uso em recursos do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{balance.available.toLocaleString('pt-BR')}</span>
          <span className="text-muted-foreground">créditos</span>
        </div>

        {balance.pending > 0 && (
          <p className="text-sm text-muted-foreground">
            + {balance.pending.toLocaleString('pt-BR')} créditos pendentes
          </p>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Nível do saldo</span>
            <span className={balance.isLow ? 'text-destructive' : 'text-muted-foreground'}>
              {balance.isLow ? 'Baixo' : 'Normal'}
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={balance.isLow ? '[&>div]:bg-destructive' : ''}
          />
        </div>

        {balance.isLow && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Seu saldo de créditos está baixo. Considere comprar mais créditos para evitar interrupções.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default CreditBalance
