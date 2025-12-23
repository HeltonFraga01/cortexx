/**
 * TenantApiSettings Component
 * 
 * Form for managing tenant-specific WUZAPI configuration.
 * Each tenant can configure their own WUZAPI URL and admin token.
 * 
 * Requirements: 11.1, 11.3 (Tenant Webhook Configuration)
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { CardHeaderWithIcon } from '@/components/ui-custom'
import { Badge } from '@/components/ui/badge'
import { 
  Save, TestTube, CheckCircle, XCircle, AlertCircle, Settings, 
  Eye, EyeOff, Database, Server, Trash2, Loader2, Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { 
  getTenantApiSettings, 
  updateTenantApiSettings, 
  testTenantApiConnection,
  clearTenantApiSettings,
  type TenantApiSettings as TenantApiSettingsType
} from '@/services/tenant-api-settings'

interface TenantApiSettingsProps {
  onSave?: () => void
}

export default function TenantApiSettings({ onSave }: TenantApiSettingsProps) {
  const [settings, setSettings] = useState<TenantApiSettingsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testDetails, setTestDetails] = useState('')
  
  // Form state
  const [baseUrl, setBaseUrl] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [timeout, setTimeout] = useState(30000)
  const [webhookBaseUrl, setWebhookBaseUrl] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [tokenChanged, setTokenChanged] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await getTenantApiSettings()
      setSettings(data)
      
      setBaseUrl(data.baseUrl || '')
      setTimeout(data.timeout || 30000)
      setWebhookBaseUrl(data.webhookBaseUrl || '')
      setAdminToken('')
      setTokenChanged(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const updates: Record<string, string | number | undefined> = {}
      
      if (baseUrl !== settings?.baseUrl) {
        updates.baseUrl = baseUrl || undefined
      }
      
      if (tokenChanged && adminToken) {
        updates.adminToken = adminToken
      }
      
      if (timeout !== settings?.timeout) {
        updates.timeout = timeout
      }

      if (webhookBaseUrl !== settings?.webhookBaseUrl) {
        updates.webhookBaseUrl = webhookBaseUrl || undefined
      }

      if (Object.keys(updates).length === 0) {
        toast.info('Nenhuma alteração para salvar')
        return
      }

      await updateTenantApiSettings(updates)
      toast.success('Configurações salvas com sucesso')
      
      await loadSettings()
      onSave?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      setTestDetails('')

      // If token changed, test with new credentials
      const credentials = tokenChanged && adminToken && baseUrl
        ? { baseUrl, adminToken }
        : undefined

      const result = await testTenantApiConnection(credentials)
      
      setTestResult(result.success ? 'success' : 'error')
      
      if (result.success) {
        const details = `Conexão OK${result.responseTime ? ` (${result.responseTime}ms)` : ''}${result.usersCount !== undefined ? ` - ${result.usersCount} usuários` : ''}`
        setTestDetails(details)
        toast.success(details)
      } else {
        setTestDetails(result.error || 'Falha na conexão')
        toast.error(result.error || 'Falha na conexão')
      }
    } catch (error) {
      setTestResult('error')
      const message = error instanceof Error ? error.message : 'Erro ao testar conexão'
      setTestDetails(message)
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const handleClear = async () => {
    try {
      setClearing(true)
      await clearTenantApiSettings()
      toast.success('Configurações removidas. Usando valores padrão do ambiente.')
      await loadSettings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover configurações')
    } finally {
      setClearing(false)
    }
  }

  const SourceBadge = ({ source }: { source: 'database' | 'environment' }) => (
    <Badge 
      variant={source === 'database' ? 'default' : 'secondary'}
      className="ml-2 text-xs"
    >
      {source === 'database' ? (
        <><Database className="h-3 w-3 mr-1" /> Configurado</>
      ) : (
        <><Server className="h-3 w-3 mr-1" /> Padrão</>
      )}
    </Badge>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando configurações...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeaderWithIcon
        icon={Settings}
        iconColor="text-blue-500"
        title="Configurações da API WUZAPI"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Configure a conexão com sua instância WUZAPI
          </p>
          {settings && <SourceBadge source={settings.source} />}
        </div>
      </CardHeaderWithIcon>
      <CardContent className="space-y-6">
        {!settings?.isConfigured && settings?.source === 'environment' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Usando configurações padrão do ambiente. Configure abaixo para usar credenciais específicas do seu tenant.
            </AlertDescription>
          </Alert>
        )}

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="baseUrl">URL Base da API</Label>
          <Input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.wuzapi.com"
          />
          <p className="text-xs text-muted-foreground">
            URL base da sua instância WUZAPI
          </p>
        </div>

        {/* Admin Token */}
        <div className="space-y-2">
          <Label htmlFor="adminToken">Token de Administrador</Label>
          <div className="relative">
            <Input
              id="adminToken"
              type={showToken ? 'text' : 'password'}
              value={tokenChanged ? adminToken : (settings?.hasAdminToken ? '••••••••••••••••' : '')}
              onChange={(e) => {
                setAdminToken(e.target.value)
                setTokenChanged(true)
              }}
              onFocus={() => {
                if (!tokenChanged && settings?.hasAdminToken) {
                  setAdminToken('')
                  setTokenChanged(true)
                }
              }}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Token para autenticação em endpoints administrativos (armazenado criptografado)
          </p>
        </div>

        {/* Webhook Base URL */}
        <div className="space-y-2">
          <Label htmlFor="webhookBaseUrl">URL Base para Webhooks</Label>
          <Input
            id="webhookBaseUrl"
            type="url"
            value={webhookBaseUrl}
            onChange={(e) => setWebhookBaseUrl(e.target.value)}
            placeholder="https://seu-dominio.com"
          />
          <p className="text-xs text-muted-foreground">
            URL base onde os webhooks serão recebidos (domínio principal, sem subdomínio)
          </p>
        </div>

        {/* Timeout */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="timeout">Timeout</Label>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            id="timeout"
            type="number"
            min={1000}
            max={120000}
            step={1000}
            value={timeout}
            onChange={(e) => setTimeout(parseInt(e.target.value, 10) || 30000)}
          />
          <p className="text-xs text-muted-foreground">
            Tempo máximo de espera para requisições em milissegundos (1000-120000)
          </p>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
          
          <Button onClick={handleTest} disabled={testing} variant="outline">
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>

          {settings?.source === 'database' && (
            <Button 
              onClick={handleClear} 
              disabled={clearing} 
              variant="outline"
              className="text-destructive hover:text-destructive"
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Limpar Configurações
            </Button>
          )}

          {testResult && (
            <div className="flex items-center ml-2">
              {testResult === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={`ml-1 text-sm ${
                testResult === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult === 'success' ? 'OK' : 'Falha'}
              </span>
            </div>
          )}
        </div>

        {testDetails && (
          <Alert variant={testResult === 'success' ? 'default' : 'destructive'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{testDetails}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
