/**
 * BotQuotaConfig Component
 * 
 * Admin interface for configuring bot usage quotas per user.
 * Lists users, shows their inboxes, and allows quota configuration.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { WuzAPIService, WuzAPIUser } from '@/services/wuzapi'
import { adminUserInboxesService, UserInbox } from '@/services/admin-user-inboxes'
import { adminQuotasService } from '@/services/admin-quotas'
import type { UserQuota, QuotaType } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Search,
  RefreshCw,
  User,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Bot,
  Inbox,
  Settings,
  ArrowLeft,
  Gauge,
  X,
  Check,
} from 'lucide-react'

// Bot quota types
const BOT_QUOTA_TYPES: QuotaType[] = [
  'max_bot_calls_per_day',
  'max_bot_calls_per_month',
  'max_bot_messages_per_day',
  'max_bot_messages_per_month',
  'max_bot_tokens_per_day',
  'max_bot_tokens_per_month',
]

const quotaLabels: Record<string, string> = {
  max_bot_calls_per_day: 'Chamadas Bot/Dia',
  max_bot_calls_per_month: 'Chamadas Bot/Mês',
  max_bot_messages_per_day: 'Msgs Bot/Dia',
  max_bot_messages_per_month: 'Msgs Bot/Mês',
  max_bot_tokens_per_day: 'Tokens IA/Dia',
  max_bot_tokens_per_month: 'Tokens IA/Mês',
}

export function BotQuotaConfig() {
  const [users, setUsers] = useState<WuzAPIUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<WuzAPIUser | null>(null)
  const [userInboxes, setUserInboxes] = useState<UserInbox[]>([])
  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([])
  const [loadingInboxes, setLoadingInboxes] = useState(false)
  const [loadingQuotas, setLoadingQuotas] = useState(false)
  const [editingQuota, setEditingQuota] = useState<QuotaType | null>(null)
  const [newLimit, setNewLimit] = useState('')
  const [savingQuota, setSavingQuota] = useState(false)
  const itemsPerPage = 10

  const wuzapi = new WuzAPIService()

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const usersData = await wuzapi.getUsers()
      setUsers(usersData)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const fetchUserInboxes = async (userId: string) => {
    try {
      setLoadingInboxes(true)
      const response = await adminUserInboxesService.getUserInboxes(userId)
      setUserInboxes(response.data || [])
    } catch (error) {
      console.error('Error fetching user inboxes:', error)
      toast.error('Erro ao carregar caixas de entrada')
      setUserInboxes([])
    } finally {
      setLoadingInboxes(false)
    }
  }

  const fetchUserQuotas = async (userId: string) => {
    try {
      setLoadingQuotas(true)
      const quotas = await adminQuotasService.getUserQuotas(userId)
      // Filter only bot quotas
      const botQuotas = quotas.filter(q => BOT_QUOTA_TYPES.includes(q.quotaType))
      setUserQuotas(botQuotas)
    } catch (error) {
      console.error('Error fetching user quotas:', error)
      toast.error('Erro ao carregar cotas')
      setUserQuotas([])
    } finally {
      setLoadingQuotas(false)
    }
  }

  const handleSelectUser = async (user: WuzAPIUser) => {
    setSelectedUser(user)
    await Promise.all([
      fetchUserInboxes(user.id),
      fetchUserQuotas(user.id)
    ])
  }

  const handleBackToList = () => {
    setSelectedUser(null)
    setUserInboxes([])
    setUserQuotas([])
    setEditingQuota(null)
  }

  const handleEditQuota = (quotaType: QuotaType, currentLimit: number) => {
    setEditingQuota(quotaType)
    setNewLimit(currentLimit.toString())
  }

  const handleSaveQuota = async () => {
    if (!selectedUser || !editingQuota || !newLimit) return

    try {
      setSavingQuota(true)
      await adminQuotasService.setQuotaOverride(selectedUser.id, editingQuota, {
        limit: parseInt(newLimit),
        reason: 'Configurado via painel de cotas de bot'
      })
      toast.success('Cota atualizada com sucesso')
      setEditingQuota(null)
      await fetchUserQuotas(selectedUser.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar cota')
    } finally {
      setSavingQuota(false)
    }
  }

  const handleRemoveOverride = async (quotaType: QuotaType) => {
    if (!selectedUser) return

    try {
      await adminQuotasService.removeQuotaOverride(selectedUser.id, quotaType)
      toast.success('Override removido')
      await fetchUserQuotas(selectedUser.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover override')
    }
  }

  const handleCancelEdit = () => {
    setEditingQuota(null)
    setNewLimit('')
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-primary'
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.jid.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // User detail view
  if (selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Cotas de Bot - {selectedUser.name}</h2>
            <p className="text-muted-foreground text-sm">
              Configure as cotas de uso de bot para este usuário
            </p>
          </div>
        </div>

        {/* User Inboxes */}
        <Card>
          <CardHeaderWithIcon
            icon={Inbox}
            iconColor="text-blue-500"
            title="Caixas de Entrada"
          >
            <p className="text-sm text-muted-foreground">
              Inboxes WhatsApp deste usuário
            </p>
          </CardHeaderWithIcon>
          <CardContent>
            {loadingInboxes ? (
              <LoadingSkeleton variant="list" count={3} />
            ) : userInboxes.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nenhuma inbox encontrada"
                description="Este usuário ainda não possui caixas de entrada configuradas"
              />
            ) : (
              <div className="space-y-3">
                {userInboxes.map((inbox) => (
                  <div
                    key={inbox.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${inbox.wuzapiConnected ? 'bg-green-100' : 'bg-muted'}`}>
                        {inbox.wuzapiConnected ? (
                          <Wifi className="h-4 w-4 text-green-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{inbox.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {inbox.phoneNumber || inbox.channelType}
                        </p>
                      </div>
                    </div>
                    <Badge variant={inbox.wuzapiConnected ? 'default' : 'outline'}>
                      {inbox.wuzapiConnected ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bot Quotas */}
        <Card>
          <CardHeaderWithIcon
            icon={Gauge}
            iconColor="text-purple-500"
            title="Cotas de Bot"
          >
            <p className="text-sm text-muted-foreground">
              Limites de uso de bot para este usuário
            </p>
          </CardHeaderWithIcon>
          <CardContent className="space-y-4">
            {loadingQuotas ? (
              <LoadingSkeleton variant="list" count={6} />
            ) : userQuotas.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="Nenhuma cota configurada"
                description="Este usuário não possui cotas de bot configuradas"
              />
            ) : (
              userQuotas.map((quota) => (
                <div key={quota.quotaType} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {quotaLabels[quota.quotaType] || quota.quotaType}
                      </span>
                      {quota.source === 'override' && (
                        <Badge variant="outline" className="text-xs">Override</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingQuota === quota.quotaType ? (
                        <>
                          <Input
                            type="number"
                            min="0"
                            value={newLimit}
                            onChange={(e) => setNewLimit(e.target.value)}
                            className="w-24 h-8"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleSaveQuota}
                            disabled={savingQuota}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground">
                            {quota.currentUsage.toLocaleString()} / {quota.limit.toLocaleString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleEditQuota(quota.quotaType, quota.limit)}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          {quota.source === 'override' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => handleRemoveOverride(quota.quotaType)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={quota.percentage}
                    className="h-2"
                    indicatorClassName={getProgressColor(quota.percentage)}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // User list view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Configurar Cotas de Bot</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Selecione um usuário para configurar as cotas de uso de bot
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={fetchUsers} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeaderWithIcon
          icon={Users}
          iconColor="text-blue-500"
          title={`Usuários (${filteredUsers.length})`}
        >
          <p className="text-sm text-muted-foreground">
            Clique em um usuário para configurar suas cotas de bot
          </p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" count={5} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Nenhum usuário encontrado"
                description={searchTerm ? "Tente uma busca diferente" : "Nenhum usuário cadastrado"}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Usuário</TableHead>
                    <TableHead className="w-[20%]">Status</TableHead>
                    <TableHead className="w-[30%]">JID WhatsApp</TableHead>
                    <TableHead className="w-[10%] text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow
                      key={user.token || user.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectUser(user)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={user.loggedIn ? 'bg-green-100 text-green-700' : 'bg-muted'}>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.jid ? user.jid.split(':')[0] : 'Não conectado'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.loggedIn ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Wifi className="h-3 w-3 mr-1" />
                            Logado
                          </Badge>
                        ) : user.connected ? (
                          <Badge variant="secondary">
                            <Wifi className="h-3 w-3 mr-1" />
                            Conectado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Offline
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                          {user.jid || 'Não conectado'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          <Bot className="h-4 w-4 mr-1" />
                          Cotas
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {!loading && filteredUsers.length > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
