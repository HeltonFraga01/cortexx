/**
 * IncomingWebhookConfig Component
 * 
 * Shows the webhook URL that needs to be configured in WUZAPI
 * to receive incoming messages for the chat inbox feature.
 * 
 * Uses tenant's webhook configuration from backend instead of
 * generating URLs client-side.
 * 
 * Updated to accept inboxId as prop for use in inbox edit page.
 * Falls back to InboxContext if no prop provided (legacy support).
 * 
 * Requirements: 12.1, 12.2, 12.3 (Tenant Webhook Configuration)
 * Requirements: 6.1, 6.2, 6.3 (Inbox Settings Migration)
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useInbox } from '@/contexts/InboxContext'
import { 
  getInboxWebhookStatus, 
  configureInboxWebhook, 
  generateInboxWebhookUrl,
  DEFAULT_WEBHOOK_EVENTS
} from '@/services/inbox-webhook'
import { 
  Webhook, 
  Copy,
  CheckCircle2,
  Info,
  ExternalLink,
  RefreshCw,
  Settings2,
  XCircle,
  AlertTriangle
} from 'lucide-react'

interface IncomingWebhookConfigProps {
  /** Inbox ID - if not provided, uses InboxContext */
  inboxId?: string
}

/**
 * Hook wrapper that safely accesses InboxContext
 * Returns null if not within InboxProvider
 */
function useInboxSafe() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useInbox()
  } catch {
    return null
  }
}

export function IncomingWebhookConfig({ inboxId: propInboxId }: IncomingWebhookConfigProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // Only try to use context if no prop provided
  const inboxContext = propInboxId ? null : useInboxSafe()
  const [copied, setCopied] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [showCustomUrl, setShowCustomUrl] = useState(false)

  // Use prop inboxId if provided, otherwise fall back to context
  const inboxId = propInboxId || inboxContext?.currentInbox?.id

  // Fetch webhook URL from backend (uses tenant configuration)
  const { 
    data: webhookUrl, 
    isLoading: isLoadingUrl, 
    isError: isUrlError,
    error: urlError 
  } = useQuery({
    queryKey: ['inbox-webhook-url', inboxId],
    queryFn: () => generateInboxWebhookUrl(inboxId!),
    enabled: !!inboxId,
    staleTime: 60000,
    retry: 1
  })

  // Fetch current webhook status from backend
  const { 
    data: status, 
    isLoading: isLoadingStatus, 
    isError: isStatusError, 
    error: statusError, 
    refetch 
  } = useQuery({
    queryKey: ['inbox-webhook-status', inboxId],
    queryFn: () => getInboxWebhookStatus(inboxId!),
    enabled: !!inboxId,
    staleTime: 30000,
    retry: 1
  })

  // Mutation to configure webhook
  const configureMutation = useMutation({
    mutationFn: (customWebhookUrl?: string) => 
      configureInboxWebhook(inboxId!, { 
        events: DEFAULT_WEBHOOK_EVENTS,
        customWebhookUrl 
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inbox-webhook-status', inboxId] })
      queryClient.invalidateQueries({ queryKey: ['inbox-webhook-url', inboxId] })
      toast.success('Webhook configurado!', {
        description: `URL: ${result.webhookUrl}`
      })
      setShowCustomUrl(false)
      setCustomUrl('')
    },
    onError: (error: Error) => {
      // Check if it's a tenant config error
      if (error.message.includes('WUZAPI não configurado') || error.message.includes('WUZAPI_NOT_CONFIGURED')) {
        toast.error('Configuração necessária', {
          description: 'Configure as configurações de API do tenant primeiro.'
        })
      } else {
        toast.error('Erro ao configurar webhook', {
          description: error.message
        })
      }
    }
  })

  // Check if no inbox is available
  if (!inboxId) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <Webhook className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Webhook de Entrada</CardTitle>
              <CardDescription>
                Receba mensagens do WhatsApp no chat inbox
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Nenhuma caixa de entrada selecionada</AlertTitle>
            <AlertDescription>
              Selecione uma caixa de entrada para configurar o webhook.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const isLoading = isLoadingUrl || isLoadingStatus
  const isConfigured = status?.isConfigured && status?.url
  const currentWebhookMatchesServer = status?.url === webhookUrl
  const isLocalhost = webhookUrl?.includes('localhost') || webhookUrl?.includes('127.0.0.1')
  
  // Check if tenant API is not configured
  const isTenantApiNotConfigured = isUrlError && 
    (urlError instanceof Error && 
      (urlError.message.includes('WEBHOOK_URL_NOT_CONFIGURED') || 
       urlError.message.includes('URL base de webhook')))

  const handleCopyUrl = async () => {
    if (!webhookUrl) return
    
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      toast.success('URL copiada!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = webhookUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      toast.success('URL copiada!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleConfigure = () => {
    const urlToUse = showCustomUrl && customUrl ? customUrl : undefined
    configureMutation.mutate(urlToUse)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Webhook className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Webhook de Entrada</CardTitle>
              <CardDescription>
                Receba mensagens do WhatsApp no chat inbox
              </CardDescription>
            </div>
          </div>
          {!isLoading && !isTenantApiNotConfigured && (
            <Badge variant={isConfigured ? (currentWebhookMatchesServer ? 'default' : 'secondary') : 'destructive'}>
              {isConfigured ? (
                currentWebhookMatchesServer ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Configurado</>
                ) : (
                  <><Info className="h-3 w-3 mr-1" /> URL diferente</>
                )
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Não configurado</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isTenantApiNotConfigured ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configuração de API necessária</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                A URL base de webhook não está configurada para este tenant.
              </p>
              <p className="text-sm">
                Peça ao administrador para configurar as configurações de API em{' '}
                <strong>Configurações → API</strong>.
              </p>
            </AlertDescription>
          </Alert>
        ) : isStatusError ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar status</AlertTitle>
            <AlertDescription>
              {statusError instanceof Error ? statusError.message : 'Não foi possível verificar o status do webhook'}
              <Button variant="link" className="p-0 h-auto ml-2" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Current status from database/WUZAPI */}
            {isConfigured && status?.url && (
              <div className="space-y-2">
                <Label>URL configurada no WUZAPI</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded truncate">
                    {status.wuzapiStatus?.webhook || status.url}
                  </code>
                </div>
                {status.wuzapiStatus?.events && status.wuzapiStatus.events.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Eventos ativos</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {status.wuzapiStatus.events.map((event: string) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Server webhook URL from tenant config */}
            {webhookUrl && (
              <div className="space-y-2">
                <Label>URL do seu servidor</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={webhookUrl} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant={copied ? "default" : "outline"}
                    size="icon"
                    onClick={handleCopyUrl}
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O webhook usa o domínio principal configurado pelo administrador.
                </p>
              </div>
            )}

            {/* Warning for localhost */}
            {isLocalhost && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>URL local detectada</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    O WUZAPI não consegue enviar webhooks para <code>localhost</code>.
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Use um serviço de túnel como <strong>ngrok</strong></li>
                    <li>Ou configure uma URL pública nas configurações de API</li>
                  </ul>
                  <div className="mt-2">
                    <a 
                      href="https://ngrok.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline"
                    >
                      Baixar ngrok <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-sm mt-2">
                    Exemplo: <code className="bg-muted px-1 rounded">ngrok http 3000</code>
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Custom URL input */}
            {showCustomUrl && (
              <div className="space-y-2">
                <Label htmlFor="customUrl">URL pública do webhook</Label>
                <Input
                  id="customUrl"
                  type="url"
                  placeholder="https://seu-servidor.com"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Informe a URL base do seu servidor (ex: URL do ngrok)
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button 
                onClick={handleConfigure}
                disabled={configureMutation.isPending || !webhookUrl}
              >
                {configureMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Settings2 className="h-4 w-4 mr-2" />
                )}
                {isConfigured ? 'Reconfigurar' : 'Configurar Webhook'}
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setShowCustomUrl(!showCustomUrl)}
              >
                {showCustomUrl ? 'Cancelar' : 'URL personalizada'}
              </Button>

              <Button 
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Recommended events */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Eventos necessários:</h4>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_WEBHOOK_EVENTS.map(event => (
                  <Badge key={event} variant="secondary">{event}</Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default IncomingWebhookConfig
