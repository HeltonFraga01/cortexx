/**
 * IncomingWebhookConfig Component
 * 
 * Shows the webhook URL that needs to be configured in WUZAPI
 * to receive incoming messages for the chat inbox feature.
 * 
 * Also allows automatic configuration via WUZAPI API when a public URL is available.
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
import { getWebhookStatus, configureWebhook } from '@/services/chat'
import { 
  Webhook, 
  Copy,
  CheckCircle2,
  Info,
  ExternalLink,
  RefreshCw,
  Settings2,
  XCircle
} from 'lucide-react'

export function IncomingWebhookConfig() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [showCustomUrl, setShowCustomUrl] = useState(false)

  // Fetch current webhook status from WUZAPI
  const { data: status, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['webhook-status'],
    queryFn: getWebhookStatus,
    staleTime: 30000,
    retry: 1
  })

  // Mutation to configure webhook via WUZAPI API
  const configureMutation = useMutation({
    mutationFn: (webhookUrl?: string) => configureWebhook(webhookUrl),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-status'] })
      toast.success('Webhook configurado!', {
        description: `URL: ${result.webhookUrl}`
      })
      setShowCustomUrl(false)
      setCustomUrl('')
    },
    onError: (error: Error) => {
      toast.error('Erro ao configurar webhook', {
        description: error.message
      })
    }
  })

  // Generate the webhook URL based on current server
  // MULTI-TENANT: The webhook URL should be the main domain (without tenant subdomain)
  // because WUZAPI identifies the user by token, not by subdomain
  const getWebhookUrl = () => {
    const currentOrigin = window.location.origin
    const hostname = window.location.hostname
    const protocol = window.location.protocol
    const port = window.location.port
    
    // Check if we're in development (localhost)
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')
    
    if (isLocalhost) {
      // In development, use the configured API URL or construct from current port
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      if (baseUrl) {
        return `${baseUrl}/api/webhook/events`
      }
      // Fallback: use current origin (for *.localhost development)
      return `${currentOrigin}/api/webhook/events`
    }
    
    // PRODUCTION: Extract main domain (remove tenant subdomain)
    // Example: cortexx.cortexx.online -> cortexx.online
    // Example: tenant.example.com -> example.com
    const parts = hostname.split('.')
    
    // If we have a subdomain (3+ parts), remove it to get main domain
    // tenant.cortexx.online -> cortexx.online
    // www.example.com -> example.com
    let mainDomain = hostname
    if (parts.length >= 3) {
      // Remove first part (subdomain)
      mainDomain = parts.slice(1).join('.')
    }
    
    // Construct the webhook URL with main domain
    const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : ''
    return `${protocol}//${mainDomain}${portSuffix}/api/webhook/events`
  }

  const webhookUrl = getWebhookUrl()
  const isLocalhost = webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')
  const isConfigured = status?.isConfigured && status?.webhook
  const currentWebhookMatchesServer = status?.webhook === webhookUrl

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      toast.success('URL copiada!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback para navegadores que não suportam clipboard API
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
    // MULTI-TENANT: Always use the main domain (without tenant subdomain)
    // because WUZAPI identifies the user by token, not by subdomain
    let urlToUse: string | undefined
    
    if (showCustomUrl && customUrl) {
      // Custom URL provided by user - use as base (without /api/webhook/events)
      urlToUse = customUrl.replace(/\/api\/webhook\/events\/?$/, '')
    } else {
      const hostname = window.location.hostname
      const protocol = window.location.protocol
      const port = window.location.port
      
      // Check if localhost/development
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')
      
      if (isLocalhost) {
        // In development, let backend use WEBHOOK_BASE_URL env var
        // urlToUse remains undefined
      } else {
        // PRODUCTION: Extract main domain (remove tenant subdomain)
        const parts = hostname.split('.')
        
        // If we have a subdomain (3+ parts), remove it to get main domain
        let mainDomain = hostname
        if (parts.length >= 3) {
          mainDomain = parts.slice(1).join('.')
        }
        
        // Construct base URL with main domain (without /api/webhook/events)
        const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : ''
        urlToUse = `${protocol}//${mainDomain}${portSuffix}`
      }
    }
    
    // Debug log
    console.log('[IncomingWebhookConfig] Configuring webhook:', {
      windowOrigin: window.location.origin,
      hostname: window.location.hostname,
      webhookUrl,
      isLocalhost: window.location.hostname.includes('localhost'),
      showCustomUrl,
      customUrl,
      urlToUse,
      currentWuzapiUrl: status?.webhook
    })
    
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar status</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Não foi possível verificar o status do webhook'}
              <Button variant="link" className="p-0 h-auto ml-2" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Current status from WUZAPI */}
            {isConfigured && status?.webhook && (
              <div className="space-y-2">
                <Label>URL configurada no WUZAPI</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded truncate">
                    {status.webhook}
                  </code>
                </div>
                {status.events && status.events.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Eventos ativos</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {status.events.map((event: string) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Server webhook URL */}
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
                O webhook usa o domínio principal. O WUZAPI identifica seu usuário pelo token.
              </p>
            </div>

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
                    <li>Ou faça deploy em um servidor público</li>
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
                    Exemplo: <code className="bg-muted px-1 rounded">ngrok http 3001</code>
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
                disabled={configureMutation.isPending}
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
                <Badge variant="secondary">Message</Badge>
                <Badge variant="secondary">ReadReceipt</Badge>
                <Badge variant="secondary">ChatPresence</Badge>
                <Badge variant="secondary">MessageStatus</Badge>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default IncomingWebhookConfig
