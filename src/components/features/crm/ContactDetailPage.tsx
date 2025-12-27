/**
 * ContactDetailPage Component
 * 
 * Main CRM detail page for a contact with all sections:
 * Header, Metrics, Timeline, Purchases, Credits, Custom Fields, Preferences.
 * Includes Chat integration: avatar fetch, attributes, notes, previous conversations.
 * 
 * Requirements: 8.1, 8.2, 8.3 (Contact CRM Evolution)
 * Requirements: CRM-Chat Integration Spec
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  MoreHorizontal,
  Clock,
  Activity,
  RefreshCw
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

import { useChatApi } from '@/hooks/useChatApi'
import { LeadScoreCard } from './LeadScoreCard'
import { ContactTimeline } from './ContactTimeline'
import { PurchaseHistory } from './PurchaseHistory'
import { CreditBalance } from './CreditBalance'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import { CommunicationPreferences } from './CommunicationPreferences'
import { EditContactForm } from './EditContactForm'
import { CRMContactAttributesSection } from './CRMContactAttributesSection'
import { CRMContactNotesSection } from './CRMContactNotesSection'
import { CRMPreviousConversationsSection } from './CRMPreviousConversationsSection'

import * as contactCRMService from '@/services/contactCRMService'
import * as contactsApi from '@/services/contactsApiService'
import * as purchaseService from '@/services/purchaseService'
import * as creditService from '@/services/creditService'
import * as customFieldService from '@/services/customFieldService'

import type { TimelineEventType, CreatePurchaseFormData, AddCreditsFormData, ConsumeCreditsFormData } from '@/types/crm'

const PAGE_SIZE = 10

export function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const chatApi = useChatApi()

  const [timelinePage, setTimelinePage] = useState(1)
  const [timelineTypes, setTimelineTypes] = useState<TimelineEventType[] | undefined>()
  const [purchasePage, setPurchasePage] = useState(1)
  const [creditPage, setCreditPage] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)

  // Fetch contact CRM data
  const { data: contact, isLoading: contactLoading, error: contactError } = useQuery({
    queryKey: ['contact-crm', contactId],
    queryFn: () => contactCRMService.getContactCRM(contactId!),
    enabled: !!contactId
  })

  // Fetch timeline
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['contact-timeline', contactId, timelinePage, timelineTypes],
    queryFn: () => contactCRMService.getTimeline(contactId!, {
      page: timelinePage,
      pageSize: PAGE_SIZE,
      types: timelineTypes
    }),
    enabled: !!contactId
  })

  // Fetch purchases
  const { data: purchaseData, isLoading: purchaseLoading } = useQuery({
    queryKey: ['contact-purchases', contactId, purchasePage],
    queryFn: () => purchaseService.getPurchases(contactId!, {
      page: purchasePage,
      pageSize: PAGE_SIZE
    }),
    enabled: !!contactId
  })

  // Fetch credits
  const { data: creditBalance } = useQuery({
    queryKey: ['contact-credit-balance', contactId],
    queryFn: () => creditService.getBalance(contactId!),
    enabled: !!contactId
  })

  const { data: creditHistory, isLoading: creditLoading } = useQuery({
    queryKey: ['contact-credit-history', contactId, creditPage],
    queryFn: () => creditService.getTransactionHistory(contactId!, {
      page: creditPage,
      pageSize: PAGE_SIZE
    }),
    enabled: !!contactId
  })

  // Fetch custom field definitions
  const { data: customFieldDefs, isLoading: customFieldsLoading } = useQuery({
    queryKey: ['custom-field-definitions'],
    queryFn: () => customFieldService.getFieldDefinitions()
  })

  // Derive contactJid from phone for chat integration
  const contactJid = useMemo(() => {
    if (!contact?.phone) return null
    const cleanPhone = contact.phone.replace(/\D/g, '')
    return `${cleanPhone}@s.whatsapp.net`
  }, [contact?.phone])

  // Update avatar when contact changes
  useEffect(() => {
    if (contact?.avatarUrl) {
      setAvatarUrl(contact.avatarUrl)
    }
  }, [contact?.avatarUrl])

  // Fetch WhatsApp avatar directly using phone number
  const handleFetchAvatar = useCallback(async () => {
    if (!contact?.phone || isLoadingAvatar) return
    
    setIsLoadingAvatar(true)
    try {
      // Clean phone number
      const cleanPhone = contact.phone.replace(/\D/g, '')
      
      // Fetch avatar directly from WUZAPI using phone number
      const result = await chatApi.getContactAvatar(cleanPhone)
      
      // Check if we got a valid URL
      if (result && result.url) {
        setAvatarUrl(result.url)
        // Invalidate to update contact record
        queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
        toast.success('Foto atualizada')
      } else {
        // No avatar available - show info toast
        toast.info('Foto não disponível', {
          description: 'Este contato não possui foto de perfil no WhatsApp ou o WhatsApp está desconectado'
        })
      }
    } catch (error) {
      toast.error('Erro ao buscar foto', {
        description: error instanceof Error ? error.message : 'Tente novamente'
      })
    } finally {
      setIsLoadingAvatar(false)
    }
  }, [contact?.phone, isLoadingAvatar, chatApi, queryClient, contactId])

  // Mutations
  const updateScoreMutation = useMutation({
    mutationFn: (score: number) => contactCRMService.updateLeadScore(contactId!, score),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
      toast.success('Lead score atualizado')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const updatePreferencesMutation = useMutation({
    mutationFn: (optIn: boolean) => contactCRMService.updatePreferences(contactId!, { bulkMessagingOptIn: optIn }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
      toast.success('Preferências atualizadas')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const addPurchaseMutation = useMutation({
    mutationFn: (data: CreatePurchaseFormData) => purchaseService.createPurchase(contactId!, {
      amountCents: data.amountCents,
      currency: data.currency,
      productName: data.productName,
      description: data.description,
      status: data.status,
      purchasedAt: data.purchasedAt
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-purchases', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
      toast.success('Compra adicionada')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const addCreditsMutation = useMutation({
    mutationFn: (data: AddCreditsFormData) => creditService.addCredits(contactId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-credit-balance', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact-credit-history', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
      toast.success('Créditos adicionados')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const consumeCreditsMutation = useMutation({
    mutationFn: (data: ConsumeCreditsFormData) => creditService.consumeCredits(contactId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-credit-balance', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact-credit-history', contactId] })
      queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
      toast.success('Créditos consumidos')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const updateCustomFieldsMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => 
      customFieldService.setContactCustomFields(contactId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
      toast.success('Campos atualizados')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const updateContactMutation = useMutation({
    mutationFn: (data: { name: string; phone: string; avatarUrl?: string }) => 
      contactsApi.updateContact(contactId!, {
        name: data.name,
        phone: data.phone,
        avatarUrl: data.avatarUrl || null
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })
      toast.success('Contato atualizado')
      setIsEditing(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const deleteContactMutation = useMutation({
    mutationFn: () => contactsApi.deleteContacts([contactId!]),
    onSuccess: () => {
      toast.success('Contato excluído')
      navigate('/user/contacts')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Handler to navigate to chat with contact
  const handleOpenChat = async () => {
    if (!contact?.phone || isStartingChat) return
    
    setIsStartingChat(true)
    try {
      // Start or find conversation by phone number
      const conversation = await chatApi.startConversation(contact.phone, { 
        name: contact.name || undefined,
        avatarUrl: contact.avatarUrl || undefined
      })
      
      // Navigate to chat with the conversation ID
      navigate(`/user/chat?conversation=${conversation.id}`)
      
      toast.success('Conversa aberta', {
        description: `Chat com ${contact.name || contact.phone}`
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Tente novamente'
      toast.error('Erro ao abrir conversa', {
        description: errorMessage
      })
    } finally {
      setIsStartingChat(false)
    }
  }

  // Handlers
  const handleTimelineFilterChange = useCallback((types: TimelineEventType[] | undefined) => {
    setTimelineTypes(types)
    setTimelinePage(1)
  }, [])

  const handleTimelineLoadMore = useCallback(() => {
    setTimelinePage((p) => p + 1)
  }, [])

  const handlePurchaseLoadMore = useCallback(() => {
    setPurchasePage((p) => p + 1)
  }, [])

  const handleCreditLoadMore = useCallback(() => {
    setCreditPage((p) => p + 1)
  }, [])

  // Handler to navigate to a specific conversation
  const handleNavigateToConversation = useCallback((conversationId: number) => {
    navigate(`/user/chat?conversation=${conversationId}`)
  }, [navigate])

  // Error state
  if (contactError) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Erro ao carregar contato</p>
            <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (contactLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
      </div>
    )
  }

  if (!contact) return null

  const initials = contact.name
    ? contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : contact.phone.slice(-2)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['contact-crm', contactId] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Contact Header Card */}
      {isEditing ? (
        <EditContactForm
          contact={{
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            avatarUrl: contact.avatarUrl
          }}
          onSave={async (data) => {
            await updateContactMutation.mutateAsync(data)
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16 ring-2 ring-muted">
                  <AvatarImage src={avatarUrl || contact.avatarUrl || undefined} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-background border shadow-sm"
                  onClick={handleFetchAvatar}
                  disabled={isLoadingAvatar}
                  title="Buscar foto do WhatsApp"
                >
                  <RefreshCw className={cn("h-3 w-3", isLoadingAvatar && "animate-spin")} />
                </Button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-semibold">
                    {contact.name || 'Sem nome'}
                  </h1>
                  <Badge variant={contact.isActive ? 'default' : 'secondary'}>
                    {contact.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </p>
                {contact.lastInteractionAt && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Última interação: {new Date(contact.lastInteractionAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleOpenChat} disabled={isStartingChat}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isStartingChat ? 'Abrindo...' : 'Mensagem'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      Editar contato
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenChat}>
                      Ver conversas
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
          <TabsTrigger value="credits">Créditos</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lead Score */}
            <LeadScoreCard
              score={contact.leadScore}
              tier={contact.leadTier}
              onUpdateScore={(score) => updateScoreMutation.mutateAsync(score)}
            />

            {/* Quick Stats */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Métricas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">LTV</p>
                    <p className="text-lg font-semibold">
                      {purchaseService.formatCurrency(contact.lifetimeValueCents)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Compras</p>
                    <p className="text-lg font-semibold">{contact.purchaseCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Créditos</p>
                    <p className="text-lg font-semibold">
                      {creditService.formatCredits(contact.creditBalance)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Interações</p>
                    <p className="text-lg font-semibold">
                      {contact.interactionStats?.total || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Integration Sections */}
          {contactJid && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CRMContactAttributesSection contactJid={contactJid} />
              <CRMContactNotesSection contactJid={contactJid} />
            </div>
          )}

          {/* Previous Conversations */}
          {contactJid && (
            <CRMPreviousConversationsSection 
              contactJid={contactJid} 
              onNavigate={handleNavigateToConversation}
            />
          )}

          {/* Recent Timeline */}
          <ContactTimeline
            events={timelineData?.data || []}
            total={timelineData?.total || 0}
            isLoading={timelineLoading}
            onFilterChange={handleTimelineFilterChange}
            onLoadMore={handleTimelineLoadMore}
            hasMore={(timelineData?.data.length || 0) < (timelineData?.total || 0)}
          />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <ContactTimeline
            events={timelineData?.data || []}
            total={timelineData?.total || 0}
            isLoading={timelineLoading}
            onFilterChange={handleTimelineFilterChange}
            onLoadMore={handleTimelineLoadMore}
            hasMore={(timelineData?.data.length || 0) < (timelineData?.total || 0)}
          />
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases">
          <PurchaseHistory
            purchases={purchaseData?.data || []}
            total={purchaseData?.total || 0}
            lifetimeValueCents={contact.lifetimeValueCents}
            purchaseCount={contact.purchaseCount}
            averageOrderValueCents={
              contact.purchaseCount > 0
                ? Math.round(contact.lifetimeValueCents / contact.purchaseCount)
                : 0
            }
            isLoading={purchaseLoading}
            onAddPurchase={(data) => addPurchaseMutation.mutateAsync(data)}
            onLoadMore={handlePurchaseLoadMore}
            hasMore={(purchaseData?.data.length || 0) < (purchaseData?.total || 0)}
          />
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits">
          <CreditBalance
            balance={creditBalance?.balance || contact.creditBalance}
            transactions={creditHistory?.data || []}
            total={creditHistory?.total || 0}
            isLoading={creditLoading}
            onAddCredits={(data) => addCreditsMutation.mutateAsync(data)}
            onConsumeCredits={(data) => consumeCreditsMutation.mutateAsync(data)}
            onLoadMore={handleCreditLoadMore}
            hasMore={(creditHistory?.data.length || 0) < (creditHistory?.total || 0)}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CommunicationPreferences
              preferences={{
                bulkMessagingOptIn: contact.bulkMessagingOptIn,
                optOutAt: contact.optOutAt,
                optOutMethod: contact.optOutMethod
              }}
              onUpdate={(optIn) => updatePreferencesMutation.mutateAsync(optIn)}
            />

            <CustomFieldsEditor
              definitions={customFieldDefs || []}
              values={contact.customFields || {}}
              isLoading={customFieldsLoading}
              onSave={(values) => updateCustomFieldsMutation.mutateAsync(values)}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contato "{contact?.name || contact?.phone}" 
              será permanentemente removido do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteContactMutation.mutate()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ContactDetailPage
