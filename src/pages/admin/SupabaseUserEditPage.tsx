/**
 * SupabaseUserEditPage - Comprehensive User Data Panel
 * 
 * Displays ALL user data from database with modern UI.
 * Requirements: 1.3, 8.1, 8.2, 8.3, 8.4, 8.6
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, Loader2, AlertCircle, RefreshCw, 
  MessageSquare, Users, CreditCard, Activity, Inbox
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SupabaseUserInfoCard } from '@/components/admin/supabase-user/SupabaseUserInfoCard'
import { SupabaseUserAccountCard } from '@/components/admin/supabase-user/SupabaseUserAccountCard'
import { SupabaseUserSubscriptionCard } from '@/components/admin/supabase-user/SupabaseUserSubscriptionCard'
import { SupabaseUserQuotaCard } from '@/components/admin/supabase-user/SupabaseUserQuotaCard'
import { SupabaseUserActionsCard } from '@/components/admin/supabase-user/SupabaseUserActionsCard'
import { SupabaseUserStatsCard } from '@/components/admin/supabase-user/SupabaseUserStatsCard'
import { SupabaseUserInboxesCard } from '@/components/admin/supabase-user/SupabaseUserInboxesCard'
import { SupabaseUserAgentsCard } from '@/components/admin/supabase-user/SupabaseUserAgentsCard'
import { SupabaseUserBotsCard } from '@/components/admin/supabase-user/SupabaseUserBotsCard'
import { SupabaseUserCampaignsCard } from '@/components/admin/supabase-user/SupabaseUserCampaignsCard'
import { SupabaseUserActivityCard } from '@/components/admin/supabase-user/SupabaseUserActivityCard'
import { SupabaseUserResourcesCard } from '@/components/admin/supabase-user/SupabaseUserResourcesCard'
import { supabaseUserService } from '@/services/supabase-user'
import type { SupabaseUserFull } from '@/types/supabase-user'

export function SupabaseUserEditPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userData, setUserData] = useState<SupabaseUserFull | null>(null)

  const loadUserData = useCallback(async () => {
    if (!userId) {
      setError('ID do usuário não fornecido')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      const data = await supabaseUserService.getFullUser(userId)
      setUserData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar usuário'
      setError(message)
      toast.error('Erro ao carregar dados do usuário')
    } finally {
      setLoading(false)
    }
  }, [userId])
  
  useEffect(() => {
    loadUserData()
  }, [loadUserData])
  
  const handleBackToList = () => {
    navigate('/admin/multi-user')
  }
  
  const handleRefresh = () => {
    loadUserData()
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando dados do usuário...</p>
        </div>
      </div>
    )
  }
  
  if (error || !userData) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error || 'Usuário não encontrado'}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button onClick={handleBackToList}>Voltar à Lista</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {userData.user.user_metadata?.name || userData.user.email || 'Usuário'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {userData.account?.name || 'Sem conta vinculada'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>
      
      {/* Stats Overview */}
      <SupabaseUserStatsCard stats={userData.stats} />
      
      {/* Main Content with Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="overview" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Recursos</span>
          </TabsTrigger>
          <TabsTrigger value="messaging" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Mensagens</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Faturamento</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Atividade</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SupabaseUserInfoCard 
              user={userData.user} 
              onUpdate={handleRefresh}
            />
            <SupabaseUserAccountCard 
              account={userData.account}
              userId={userData.user.id}
              onUpdate={handleRefresh}
            />
            <SupabaseUserActionsCard 
              user={userData.user}
              account={userData.account}
              onUpdate={handleRefresh}
              onDelete={handleBackToList}
            />
          </div>
        </TabsContent>
        
        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SupabaseUserInboxesCard 
              inboxes={userData.inboxes} 
              userId={userData.user.id}
              onUpdate={handleRefresh}
            />
            <SupabaseUserAgentsCard agents={userData.agents} />
            <SupabaseUserBotsCard bots={userData.bots} />
            <SupabaseUserResourcesCard 
              teams={userData.teams}
              labels={userData.labels}
              webhooks={userData.webhooks}
              databaseConnections={userData.databaseConnections}
            />
          </div>
        </TabsContent>
        
        {/* Messaging Tab */}
        <TabsContent value="messaging" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SupabaseUserCampaignsCard campaigns={userData.campaigns} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5" />
                  Resumo de Mensagens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{userData.stats.messages}</p>
                    <p className="text-sm text-muted-foreground">Mensagens (30 dias)</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{userData.stats.templates}</p>
                    <p className="text-sm text-muted-foreground">Templates</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{userData.stats.cannedResponses}</p>
                    <p className="text-sm text-muted-foreground">Respostas Rápidas</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{userData.stats.scheduledMessages}</p>
                    <p className="text-sm text-muted-foreground">Agendadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SupabaseUserSubscriptionCard 
              subscription={userData.subscription}
              userId={userData.user.id}
              userName={userData.user.email || ''}
              onUpdate={handleRefresh}
            />
            <SupabaseUserQuotaCard 
              quotas={userData.quotas}
              planLimits={userData.planLimits}
              subscription={userData.subscription}
            />
            {/* Credit Transactions */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Transações de Crédito
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userData.creditTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma transação de crédito
                  </p>
                ) : (
                  <div className="space-y-2">
                    {userData.creditTransactions.map((tx) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{tx.description || tx.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <span className={`font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <SupabaseUserActivityCard auditLog={userData.auditLog} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SupabaseUserEditPage
