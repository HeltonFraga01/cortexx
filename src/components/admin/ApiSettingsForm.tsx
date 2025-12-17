import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CardHeaderWithIcon } from '@/components/ui-custom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Save, TestTube, CheckCircle, XCircle, AlertCircle, Settings, 
  Eye, EyeOff, Database, Server, RotateCcw, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getApiSettings, 
  updateApiSettings, 
  testApiConnection,
  deleteApiSetting,
  type ApiSettings 
} from '@/services/api-settings';

interface ApiSettingsFormProps {
  onSave?: () => void;
}

export default function ApiSettingsForm({ onSave }: ApiSettingsFormProps) {
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testDetails, setTestDetails] = useState('');
  
  // Form state
  const [baseUrl, setBaseUrl] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [timeout, setTimeout] = useState(30000);
  const [showToken, setShowToken] = useState(false);
  const [tokenChanged, setTokenChanged] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getApiSettings();
      setSettings(data);
      
      // Populate form
      setBaseUrl(data.wuzapiBaseUrl.value as string || '');
      setTimeout(data.wuzapiTimeout.value as number || 30000);
      setAdminToken('');
      setTokenChanged(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updates: Record<string, string | number> = {};
      
      if (baseUrl && baseUrl !== settings?.wuzapiBaseUrl.value) {
        updates.wuzapiBaseUrl = baseUrl;
      }
      
      if (tokenChanged && adminToken) {
        updates.wuzapiAdminToken = adminToken;
      }
      
      if (timeout !== settings?.wuzapiTimeout.value) {
        updates.wuzapiTimeout = timeout;
      }

      if (Object.keys(updates).length === 0) {
        toast.info('Nenhuma alteração para salvar');
        return;
      }

      await updateApiSettings(updates);
      toast.success('Configurações salvas com sucesso');
      
      // Reload to get updated sources
      await loadSettings();
      onSave?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setTestDetails('');

      const result = await testApiConnection();
      
      setTestResult(result.success ? 'success' : 'error');
      setTestDetails(result.details);
      
      if (result.success) {
        toast.success(result.details);
      } else {
        toast.error(result.details);
      }
    } catch (error) {
      setTestResult('error');
      const message = error instanceof Error ? error.message : 'Erro ao testar conexão';
      setTestDetails(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const handleResetSetting = async (key: 'baseUrl' | 'adminToken' | 'timeout') => {
    try {
      await deleteApiSetting(key);
      toast.success('Configuração revertida para valor padrão');
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao reverter');
    }
  };

  const SourceBadge = ({ source }: { source: 'database' | 'environment' }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={source === 'database' ? 'default' : 'secondary'}
            className="ml-2 text-xs cursor-help"
          >
            {source === 'database' ? (
              <><Database className="h-3 w-3 mr-1" /> Banco</>
            ) : (
              <><Server className="h-3 w-3 mr-1" /> Env</>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            {source === 'database' 
              ? 'Valor salvo no banco de dados (tem precedência)'
              : 'Usando valor da variável de ambiente (.env)'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando configurações...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeaderWithIcon
        icon={Settings}
        iconColor="text-blue-500"
        title="Configurações da API"
      >
        <p className="text-sm text-muted-foreground">
          Configure a conexão com a API WUZAPI
        </p>
      </CardHeaderWithIcon>
      <CardContent className="space-y-6">
        {/* Base URL */}
        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="baseUrl">URL Base da API</Label>
            {settings && <SourceBadge source={settings.wuzapiBaseUrl.source} />}
            {settings?.wuzapiBaseUrl.source === 'database' && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2"
                onClick={() => handleResetSetting('baseUrl')}
                title="Reverter para valor do .env"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
          />
          <p className="text-xs text-muted-foreground">
            URL base para todas as requisições à API WUZAPI
          </p>
        </div>

        {/* Admin Token */}
        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="adminToken">Token de Administrador</Label>
            {settings && <SourceBadge source={settings.wuzapiAdminToken.source} />}
            {settings?.wuzapiAdminToken.source === 'database' && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2"
                onClick={() => handleResetSetting('adminToken')}
                title="Reverter para valor do .env"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="relative">
            <Input
              id="adminToken"
              type={showToken ? 'text' : 'password'}
              value={tokenChanged ? adminToken : (settings?.wuzapiAdminToken.hasValue ? '••••••••••••••••' : '')}
              onChange={(e) => {
                setAdminToken(e.target.value);
                setTokenChanged(true);
              }}
              onFocus={() => {
                if (!tokenChanged) {
                  setAdminToken('');
                  setTokenChanged(true);
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
            Token para autenticação em endpoints administrativos (criptografado no banco)
          </p>
        </div>

        {/* Timeout */}
        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            {settings && <SourceBadge source={settings.wuzapiTimeout.source} />}
            {settings?.wuzapiTimeout.source === 'database' && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2"
                onClick={() => handleResetSetting('timeout')}
                title="Reverter para valor do .env"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
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
            Tempo máximo de espera para requisições (1000-120000ms)
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
            Salvar Configurações
          </Button>
          
          <Button onClick={handleTest} disabled={testing} variant="outline">
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>

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
                {testResult === 'success' ? 'Conexão OK' : 'Falha'}
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
  );
}
