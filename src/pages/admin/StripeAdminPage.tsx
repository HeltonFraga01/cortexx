/**
 * StripeAdminPage - Admin page for Stripe configuration and analytics
 * 
 * Requirements: 1.1, 2.4, 12.1, 13.1
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreditCard, Package, TrendingUp, Users } from 'lucide-react'
import { StripeSettings } from '@/components/admin/stripe/StripeSettings'
import { PlanSync } from '@/components/admin/stripe/PlanSync'
import { PaymentAnalytics } from '@/components/admin/stripe/PaymentAnalytics'
import { AffiliateConfig } from '@/components/admin/stripe/AffiliateConfig'

export function StripeAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Stripe & Pagamentos</h1>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Afiliados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <StripeSettings />
        </TabsContent>

        <TabsContent value="plans">
          <PlanSync />
        </TabsContent>

        <TabsContent value="analytics">
          <PaymentAnalytics />
        </TabsContent>

        <TabsContent value="affiliates">
          <AffiliateConfig />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default StripeAdminPage
