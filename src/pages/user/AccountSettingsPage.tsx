/**
 * AccountSettingsPage - User account settings with subscription, quotas, and features
 * 
 * Uses tabs for organization: Assinatura, Quotas, Features
 * 
 * Requirements: 1.1, 1.3, 1.5
 */

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Gauge, Sparkles, Settings } from 'lucide-react'
import { SubscriptionCard } from '@/components/user/SubscriptionCard'
import { QuotaUsageCard } from '@/components/user/QuotaUsageCard'
import { FeaturesList } from '@/components/user/FeaturesList'
import { getAccountSummary, type AccountSummary } from '@/services/user-subscription'
import { useToast } from '@/hooks/use-toast'

export function AccountSettingsPage() {
  const [data, setData] = useState<AccountSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const loadData = async () => {
      try {
        const summary = await getAccountSummary()
        setData(summary)
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados da conta.',
          variant: 'destructive'
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [toast])

  const handleUpgrade = () => {
    toast({
      title: 'Upgrade',
      description: 'Entre em contato com o suporte para fazer upgrade do seu plano.'
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Configurações da Conta</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configurações da Conta</h1>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Plano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.summary.planName}</p>
              <p className="text-sm text-muted-foreground capitalize">{data.summary.status}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Quotas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {data.summary.exceededQuotas > 0 ? (
                  <span className="text-destructive">{data.summary.exceededQuotas} excedida(s)</span>
                ) : data.summary.warningQuotas > 0 ? (
                  <span className="text-yellow-600">{data.summary.warningQuotas} alerta(s)</span>
                ) : (
                  <span className="text-green-600">OK</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">{data.quotas.length} quotas monitoradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.summary.enabledFeatures}</p>
              <p className="text-sm text-muted-foreground">de {data.summary.totalFeatures} disponíveis</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="subscription" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Assinatura
          </TabsTrigger>
          <TabsTrigger value="quotas" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Quotas
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Features
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscription">
          <SubscriptionCard 
            subscription={data?.subscription || null} 
            onUpgrade={handleUpgrade}
          />
        </TabsContent>

        <TabsContent value="quotas">
          <QuotaUsageCard quotas={data?.quotas || []} />
        </TabsContent>

        <TabsContent value="features">
          <FeaturesList 
            features={data?.features || []} 
            onUpgrade={handleUpgrade}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AccountSettingsPage
