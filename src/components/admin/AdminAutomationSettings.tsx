import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bot, Tags, MessageSquare, Activity, Download, Upload, Settings, Webhook, History } from 'lucide-react';
import { toast } from 'sonner';
import { automationService } from '@/services/automation';
import type { GlobalSettings } from '@/types/automation';
import BotTemplateManager from './BotTemplateManager';
import DefaultLabelsManager from './DefaultLabelsManager';
import DefaultCannedResponsesManager from './DefaultCannedResponsesManager';
import DefaultWebhooksManager from './DefaultWebhooksManager';
import AutomationAuditLog from './AutomationAuditLog';

export default function AdminAutomationSettings() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await automationService.getGlobalSettings();
      setSettings(data);
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutomation = async (type: keyof GlobalSettings['automationsEnabled'], enabled: boolean) => {
    if (!settings) return;

    try {
      setSaving(true);
      const updated = await automationService.updateGlobalSettings({
        automationsEnabled: {
          ...settings.automationsEnabled,
          [type]: enabled
        }
      });
      setSettings(updated);
      toast.success(`Automação ${enabled ? 'ativada' : 'desativada'}`);
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const config = await automationService.exportConfiguration();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `automation-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Configuração exportada');
    } catch (error) {
      toast.error('Erro ao exportar configuração');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const config = JSON.parse(text);
      
      const validation = await automationService.validateImport(config);
      if (!validation.valid) {
        toast.error(`Configuração inválida: ${validation.errors.join(', ')}`);
        return;
      }

      await automationService.importConfiguration(config);
      toast.success('Configuração importada com sucesso');
      loadSettings();
    } catch (error) {
      toast.error('Erro ao importar configuração');
    }
    
    event.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automações</h2>
          <p className="text-muted-foreground">
            Configure automações para novos usuários
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Automações Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                <Label>Bot Padrão</Label>
              </div>
              <Switch
                checked={settings?.automationsEnabled.bot ?? false}
                onCheckedChange={(checked) => handleToggleAutomation('bot', checked)}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-green-500" />
                <Label>Labels Padrão</Label>
              </div>
              <Switch
                checked={settings?.automationsEnabled.labels ?? false}
                onCheckedChange={(checked) => handleToggleAutomation('labels', checked)}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                <Label>Respostas Rápidas</Label>
              </div>
              <Switch
                checked={settings?.automationsEnabled.cannedResponses ?? false}
                onCheckedChange={(checked) => handleToggleAutomation('cannedResponses', checked)}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-500" />
                <Label>Webhooks Padrão</Label>
              </div>
              <Switch
                checked={settings?.automationsEnabled.webhooks ?? false}
                onCheckedChange={(checked) => handleToggleAutomation('webhooks', checked)}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="bot-templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bot-templates">
            <Bot className="h-4 w-4 mr-2" />
            Templates de Bot
          </TabsTrigger>
          <TabsTrigger value="labels">
            <Tags className="h-4 w-4 mr-2" />
            Labels Padrão
          </TabsTrigger>
          <TabsTrigger value="canned-responses">
            <MessageSquare className="h-4 w-4 mr-2" />
            Respostas Rápidas
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="h-4 w-4 mr-2" />
            Webhooks Padrão
          </TabsTrigger>
          <TabsTrigger value="audit-log">
            <History className="h-4 w-4 mr-2" />
            Log de Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bot-templates">
          <BotTemplateManager />
        </TabsContent>

        <TabsContent value="labels">
          <DefaultLabelsManager />
        </TabsContent>

        <TabsContent value="canned-responses">
          <DefaultCannedResponsesManager />
        </TabsContent>

        <TabsContent value="webhooks">
          <DefaultWebhooksManager />
        </TabsContent>

        <TabsContent value="audit-log">
          <AutomationAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
