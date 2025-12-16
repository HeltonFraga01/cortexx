/**
 * UserDetailPage Component
 * 
 * Displays user profile, subscription, quotas, features with tabs.
 * Requirements: 6.2
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { adminSubscriptionsService } from '@/services/admin-subscriptions'
import { adminQuotasService } from '@/services/admin-quotas'
import { adminFeaturesService } from '@/services/admin-features'
import type { UserSubscription, UserQuota, UserFeature } from '@/types/admin-management'
import { UserSubscriptionCard } from './UserSubscriptionCard'
import { UserQuotasCard } from './UserQuotasCard'
import { UserFeaturesCard } from './UserFeaturesCard'
import { UserActionsCard } from './UserActionsCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Loader2 } from 'lucide-react'

interface UserDetailPageProps {
  userId: string
  onBack?: () => void
}

export function UserDetailPage({ userId, onBack }: UserDetailPageProps) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [quotas, setQuotas] = useState<UserQuota[]>([])
  const [features, setFeatures] = useState<UserFeature[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadUserData()
  }, [userId])

  const loadUserData = async () => {
    try {
      setIsLoading(true)
      const [subData, quotaData, featureData] = await Promise.all([
        adminSubscriptionsService.getSubscription(userId).catch(() => null),
        adminQuotasService.getUserQuotas(userId).catch(() => []),
        adminFeaturesService.getUserFeatures(userId).catch(() => []),
      ])
      setSubscription(subData)
      setQuotas(quotaData)
      setFeatures(featureData)
    } catch (error) {
      toast.error('Falha ao carregar dados do usuário')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            Detalhes do Usuário
          </h1>
          <p className="text-muted-foreground text-sm">ID: {userId}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="actions">Ações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <UserSubscriptionCard
              userId={userId}
              subscription={subscription}
              onUpdate={loadUserData}
            />
            <Card>
              <CardHeader>
                <CardTitle>Resumo de Uso</CardTitle>
                <CardDescription>Principais métricas do usuário</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quotas.slice(0, 4).map((quota) => (
                    <div key={quota.quotaType} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {quota.quotaType.replace(/_/g, ' ').replace(/max /i, '')}
                      </span>
                      <span className="font-medium">
                        {quota.currentUsage} / {quota.limit}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quotas" className="mt-6">
          <UserQuotasCard
            userId={userId}
            quotas={quotas}
            onUpdate={loadUserData}
          />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <UserFeaturesCard
            userId={userId}
            features={features}
            onUpdate={loadUserData}
          />
        </TabsContent>

        <TabsContent value="actions" className="mt-6">
          <div className="max-w-md">
            <UserActionsCard
              userId={userId}
              subscriptionStatus={subscription?.status}
              onUpdate={loadUserData}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
