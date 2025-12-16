/**
 * PlanForm Component
 * 
 * Form to create/edit subscription plans with quotas and features.
 * Requirements: 1.1, 1.2, 1.3
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { adminPlansService } from '@/services/admin-plans'
import type { Plan, CreatePlanRequest, BillingCycle, PlanStatus } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

// Only user features in snake_case (matching backend format)
// Admin features (page_builder, custom_branding) and non-existent integrations excluded
const planSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  priceCents: z.number().min(0, 'Preço deve ser positivo'),
  billingCycle: z.enum(['monthly', 'yearly', 'lifetime']),
  status: z.enum(['active', 'inactive', 'deprecated']),
  isDefault: z.boolean(),
  trialDays: z.number().min(0).max(365),
  quotas: z.object({
    maxAgents: z.number().min(1),
    maxConnections: z.number().min(1),
    maxMessagesPerDay: z.number().min(0),
    maxMessagesPerMonth: z.number().min(0),
    maxInboxes: z.number().min(1),
    maxTeams: z.number().min(1),
    maxWebhooks: z.number().min(0),
    maxCampaigns: z.number().min(0),
    maxStorageMb: z.number().min(0),
    maxBots: z.number().min(0),
    // Bot usage quotas
    maxBotCallsPerDay: z.number().min(0),
    maxBotCallsPerMonth: z.number().min(0),
    maxBotMessagesPerDay: z.number().min(0),
    maxBotMessagesPerMonth: z.number().min(0),
    maxBotTokensPerDay: z.number().min(0),
    maxBotTokensPerMonth: z.number().min(0),
  }),
  features: z.object({
    bulk_campaigns: z.boolean(),
    nocodb_integration: z.boolean(),
    bot_automation: z.boolean(),
    advanced_reports: z.boolean(),
    api_access: z.boolean(),
    webhooks: z.boolean(),
    scheduled_messages: z.boolean(),
    media_storage: z.boolean(),
  }),
})

type PlanFormData = z.infer<typeof planSchema>

interface PlanFormProps {
  plan?: Plan | null
  onSuccess?: () => void
  onCancel?: () => void
}

const defaultValues: PlanFormData = {
  name: '',
  description: '',
  priceCents: 0,
  billingCycle: 'monthly',
  status: 'active',
  isDefault: false,
  trialDays: 0,
  quotas: {
    maxAgents: 1,
    maxConnections: 1,
    maxMessagesPerDay: 100,
    maxMessagesPerMonth: 3000,
    maxInboxes: 1,
    maxTeams: 1,
    maxWebhooks: 5,
    maxCampaigns: 1,
    maxStorageMb: 100,
    maxBots: 3,
    // Bot usage quotas defaults (Requirements: 8.2-8.7)
    maxBotCallsPerDay: 100,
    maxBotCallsPerMonth: 3000,
    maxBotMessagesPerDay: 50,
    maxBotMessagesPerMonth: 1500,
    maxBotTokensPerDay: 10000,
    maxBotTokensPerMonth: 300000,
  },
  features: {
    bulk_campaigns: false,
    nocodb_integration: false,
    bot_automation: false,
    advanced_reports: false,
    api_access: false,
    webhooks: true,
    scheduled_messages: false,
    media_storage: true,
  },
}

// Feature labels in snake_case (matching backend format)
const featureLabels: Record<keyof PlanFormData['features'], string> = {
  bulk_campaigns: 'Campanhas em Massa',
  nocodb_integration: 'Integração NocoDB',
  bot_automation: 'Automação de Bots',
  advanced_reports: 'Relatórios Avançados',
  api_access: 'Acesso à API',
  webhooks: 'Webhooks',
  scheduled_messages: 'Mensagens Agendadas',
  media_storage: 'Armazenamento de Mídia',
}

export function PlanForm({ plan, onSuccess, onCancel }: PlanFormProps) {
  const isEditing = !!plan

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: plan ? {
      name: plan.name,
      description: plan.description || '',
      priceCents: plan.priceCents,
      billingCycle: plan.billingCycle,
      status: plan.status,
      isDefault: plan.isDefault,
      trialDays: plan.trialDays,
      quotas: plan.quotas,
      features: plan.features,
    } : defaultValues,
  })

  const onSubmit = async (data: PlanFormData) => {
    try {
      if (isEditing && plan) {
        await adminPlansService.updatePlan(plan.id, data)
        toast.success('Plano atualizado com sucesso')
      } else {
        await adminPlansService.createPlan(data as CreatePlanRequest)
        toast.success('Plano criado com sucesso')
      }
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar plano')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="quotas">Limites</TabsTrigger>
            <TabsTrigger value="features">Funcionalidades</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Configure as informações gerais do plano</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Plano Pro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descrição do plano..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priceCents"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value / 100}
                            onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || '0') * 100))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingCycle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciclo de Cobrança</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                            <SelectItem value="lifetime">Vitalício</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                            <SelectItem value="deprecated">Descontinuado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trialDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dias de Trial</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value || '0'))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Plano Padrão</FormLabel>
                        <FormDescription>
                          Novos usuários serão atribuídos a este plano automaticamente
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotas" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Limites de Recursos</CardTitle>
                <CardDescription>Configure os limites de uso para este plano</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {Object.entries({
                  maxAgents: 'Máx. Agentes',
                  maxConnections: 'Máx. Conexões',
                  maxMessagesPerDay: 'Mensagens/Dia',
                  maxMessagesPerMonth: 'Mensagens/Mês',
                  maxInboxes: 'Máx. Inboxes',
                  maxTeams: 'Máx. Times',
                  maxWebhooks: 'Máx. Webhooks',
                  maxCampaigns: 'Máx. Campanhas',
                  maxStorageMb: 'Armazenamento (MB)',
                  maxBots: 'Máx. Bots',
                }).map(([key, label]) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`quotas.${key as keyof PlanFormData['quotas']}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value || '0'))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Limites de Uso de Bot</CardTitle>
                <CardDescription>Configure os limites de uso para bots de automação</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {Object.entries({
                  maxBotCallsPerDay: 'Chamadas Bot/Dia',
                  maxBotCallsPerMonth: 'Chamadas Bot/Mês',
                  maxBotMessagesPerDay: 'Msgs Bot/Dia',
                  maxBotMessagesPerMonth: 'Msgs Bot/Mês',
                  maxBotTokensPerDay: 'Tokens IA/Dia',
                  maxBotTokensPerMonth: 'Tokens IA/Mês',
                }).map(([key, label]) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`quotas.${key as keyof PlanFormData['quotas']}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value || '0'))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Funcionalidades</CardTitle>
                <CardDescription>Selecione as funcionalidades disponíveis neste plano</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(featureLabels).map(([key, label]) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`features.${key as keyof PlanFormData['features']}`}
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel className="font-normal">{label}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Plano'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
