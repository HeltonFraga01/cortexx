/**
 * ConnectOnboarding Component
 * 
 * Handles Stripe Connect onboarding flow for resellers.
 * Requirements: 9.1, 9.2, 9.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw,
  CreditCard,
  Wallet,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { stripeService } from '@/services/stripe'
import type { ConnectStatus } from '@/types/stripe'

interface ConnectOnboardingProps {
  onStatusChange?: (status: ConnectStatus) => void
}

export function ConnectOnboarding({ onStatusChange }: ConnectOnboardingProps) {
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      setLoading(true)
      const data = await stripeService.getConnectStatus()
      setStatus(data)
      onStatusChange?.(data)
    } catch (error) {
      // No connected account yet - this is expected for new users
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartOnboarding() {
    try {
      setOnboarding(true)
      const { url } = await stripeService.startConnectOnboarding()
      window.location.href = url
    } catch (error) {
      toast.error('Falha ao iniciar onboarding. Tente novamente.')
      setOnboarding(false)
    }
  }

  async function handleOpenDashboard() {
    try {
      const { url } = await stripeService.getExpressDashboardLink()
      window.open(url, '_blank')
    } catch (error) {
      toast.error('Falha ao abrir dashboard. Tente novamente.')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  // No connected account - show onboarding CTA
  if (!status) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Torne-se um Revendedor</CardTitle>
          </div>
          <CardDescription>
            Conecte sua conta Stripe para começar a vender pacotes de créditos para seus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <CreditCard className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Receba Pagamentos</p>
                <p className="text-sm text-muted-foreground">
                  Aceite cartões de crédito e débito diretamente.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Wallet className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Defina Seus Preços</p>
                <p className="text-sm text-muted-foreground">
                  Configure sua margem de lucro em cada pacote.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Building2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Dashboard Próprio</p>
                <p className="text-sm text-muted-foreground">
                  Acompanhe vendas e recebimentos no Stripe.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStartOnboarding} disabled={onboarding} className="w-full">
            {onboarding ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                Começar Onboarding
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Connected account exists - show status
  const isFullyActive = status.chargesEnabled && status.payoutsEnabled && status.detailsSubmitted

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Conta Stripe Connect</CardTitle>
          </div>
          <Badge variant={isFullyActive ? 'default' : 'secondary'}>
            {isFullyActive ? 'Ativa' : 'Pendente'}
          </Badge>
        </div>
        <CardDescription>
          Gerencie sua conta de revendedor conectada ao Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status indicators */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {status.chargesEnabled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span>Receber Pagamentos</span>
            </div>
            <Badge variant={status.chargesEnabled ? 'default' : 'outline'}>
              {status.chargesEnabled ? 'Habilitado' : 'Pendente'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {status.payoutsEnabled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span>Receber Transferências</span>
            </div>
            <Badge variant={status.payoutsEnabled ? 'default' : 'outline'}>
              {status.payoutsEnabled ? 'Habilitado' : 'Pendente'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {status.detailsSubmitted ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span>Dados Completos</span>
            </div>
            <Badge variant={status.detailsSubmitted ? 'default' : 'outline'}>
              {status.detailsSubmitted ? 'Completo' : 'Pendente'}
            </Badge>
          </div>
        </div>

        {/* Action required alert */}
        {status.requiresAction && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ação Necessária</AlertTitle>
            <AlertDescription>
              Complete o cadastro da sua conta para começar a receber pagamentos.
            </AlertDescription>
          </Alert>
        )}

        {/* Account ID */}
        <div className="text-sm text-muted-foreground">
          ID da Conta: <code className="bg-muted px-1 rounded">{status.accountId}</code>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        {status.requiresAction ? (
          <Button onClick={handleStartOnboarding} disabled={onboarding} className="flex-1">
            {onboarding ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                Completar Cadastro
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleOpenDashboard} variant="outline" className="flex-1">
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir Dashboard Stripe
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={loadStatus}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

export default ConnectOnboarding
