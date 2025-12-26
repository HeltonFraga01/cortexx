/**
 * StripeSettings Component
 * 
 * Admin interface for configuring Stripe API keys.
 * Requirements: 1.1, 1.5, 1.6
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { StripeSettings as StripeSettingsType } from '@/types/stripe'

const settingsSchema = z.object({
  secretKey: z.string().min(1, 'Secret key is required').refine(val => val.startsWith('sk_'), {
    message: 'Secret key must start with sk_',
  }),
  publishableKey: z.string().min(1, 'Publishable key is required').refine(val => val.startsWith('pk_'), {
    message: 'Publishable key must start with pk_',
  }),
  webhookSecret: z.string().optional(),
  connectEnabled: z.boolean().default(false),
})

type SettingsFormData = z.infer<typeof settingsSchema>

export function StripeSettings() {
  const [settings, setSettings] = useState<StripeSettingsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const { toast } = useToast()

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      secretKey: '',
      publishableKey: '',
      webhookSecret: '',
      connectEnabled: false,
    },
  })

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setLoading(true)
      const data = await stripeService.getSettings()
      setSettings(data)
      
      // Pre-fill publishable key if available
      if (data?.publishableKey) {
        form.setValue('publishableKey', data.publishableKey)
      }
      if (data?.connectEnabled !== undefined) {
        form.setValue('connectEnabled', data.connectEnabled)
      }
    } catch (error) {
      // Show error message to user
      const message = error instanceof Error ? error.message : 'Erro ao carregar configurações'
      toast.error(message)
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleTestConnection() {
    const secretKey = form.getValues('secretKey')
    const publishableKey = form.getValues('publishableKey')

    try {
      setTesting(true)
      setTestResult(null)

      // If keys are provided in the form, test with those
      if (secretKey && publishableKey) {
        const result = await stripeService.testConnection(secretKey, publishableKey)
        setTestResult({ success: true, message: `Conexão bem-sucedida! Account ID: ${result.accountId}` })
        return
      }

      // If already configured, test with saved keys
      if (settings?.isConfigured) {
        const result = await stripeService.testSavedConnection()
        setTestResult({ success: true, message: `Conexão bem-sucedida! Account ID: ${result.accountId}` })
        return
      }

      // No keys available
      setTestResult({ success: false, message: 'Preencha as chaves antes de testar' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha na conexão'
      setTestResult({ success: false, message })
    } finally {
      setTesting(false)
    }
  }

  async function onSubmit(data: SettingsFormData) {
    try {
      setSaving(true)
      await stripeService.saveSettings(data)
      toast.success('Configurações do Stripe salvas com sucesso')
      await loadSettings()
      // Clear sensitive fields after save
      form.setValue('secretKey', '')
      form.setValue('webhookSecret', '')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar configurações'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configurações do Stripe</CardTitle>
            <CardDescription>
              Configure as credenciais da API do Stripe para processar pagamentos
            </CardDescription>
          </div>
          <Badge variant={settings?.isConfigured ? 'default' : 'secondary'}>
            {settings?.isConfigured ? 'Configurado' : 'Não configurado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Current Status */}
          {settings?.isConfigured && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Stripe está configurado. Chave secreta: {settings.secretKeyMasked}
              </AlertDescription>
            </Alert>
          )}

          {/* Secret Key */}
          <div className="space-y-2">
            <Label htmlFor="secretKey">Chave Secreta (Secret Key)</Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? 'text' : 'password'}
                placeholder="sk_live_... ou sk_test_..."
                {...form.register('secretKey')}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {form.formState.errors.secretKey && (
              <p className="text-sm text-destructive">{form.formState.errors.secretKey.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Encontre sua chave secreta no Dashboard do Stripe → Developers → API keys
            </p>
          </div>

          {/* Publishable Key */}
          <div className="space-y-2">
            <Label htmlFor="publishableKey">Chave Publicável (Publishable Key)</Label>
            <Input
              id="publishableKey"
              placeholder="pk_live_... ou pk_test_..."
              {...form.register('publishableKey')}
            />
            {form.formState.errors.publishableKey && (
              <p className="text-sm text-destructive">{form.formState.errors.publishableKey.message}</p>
            )}
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret (Opcional)</Label>
            <div className="relative">
              <Input
                id="webhookSecret"
                type={showWebhookSecret ? 'text' : 'password'}
                placeholder="whsec_..."
                {...form.register('webhookSecret')}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure um webhook endpoint no Stripe apontando para: {window.location.origin}/api/webhooks/stripe
            </p>
          </div>

          {/* Stripe Connect */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Stripe Connect</Label>
              <p className="text-sm text-muted-foreground">
                Habilitar marketplace para revendedores
              </p>
            </div>
            <Switch
              checked={form.watch('connectEnabled')}
              onCheckedChange={(checked) => form.setValue('connectEnabled', checked)}
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Testar Conexão
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default StripeSettings
