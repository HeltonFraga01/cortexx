/**
 * ResellerDashboardPage - Reseller dashboard with Connect status and sales
 * 
 * Requirements: 9.3, 9.4, 10.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Package, DollarSign, Users } from 'lucide-react'
import { ConnectOnboarding } from '@/components/reseller/ConnectOnboarding'
import { toast } from 'sonner'
import { stripeService } from '@/services/stripe'
import type { ConnectStatus, AffiliateEarnings } from '@/types/stripe'

export function ResellerDashboardPage() {
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [earnings, setEarnings] = useState<AffiliateEarnings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [status, earningsData] = await Promise.allSettled([
        stripeService.getConnectStatus(),
        stripeService.getAffiliateEarnings(),
      ])

      if (status.status === 'fulfilled') {
        setConnectStatus(status.value)
      }
      if (earningsData.status === 'fulfilled') {
        setEarnings(earningsData.value)
      }
    } catch (error) {
      toast.error('Falha ao carregar dados do revendedor')
    } finally {
      setLoading(false)
    }
  }

  const isActive = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Painel do Revendedor</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Painel do Revendedor</h1>
      </div>

      {/* Summary Cards */}
      {isActive && earnings && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Ganho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(earnings.totalEarned / 100)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pendente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(earnings.pendingPayout / 100)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Indicações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{earnings.referralCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Conversão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {(earnings.conversionRate * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="connect" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connect" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Conta Stripe
          </TabsTrigger>
          {isActive && (
            <>
              <TabsTrigger value="pricing" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Preços
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Vendas
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="connect">
          <ConnectOnboarding onStatusChange={setConnectStatus} />
        </TabsContent>

        {isActive && (
          <>
            <TabsContent value="pricing">
              <Card>
                <CardHeader>
                  <CardTitle>Configuração de Preços</CardTitle>
                  <CardDescription>
                    Configure os preços dos pacotes de créditos para seus clientes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Em breve: Configure sua margem de lucro em cada pacote de créditos.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Vendas</CardTitle>
                  <CardDescription>
                    Acompanhe suas vendas e comissões.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Em breve: Visualize o histórico completo de vendas.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

export default ResellerDashboardPage
