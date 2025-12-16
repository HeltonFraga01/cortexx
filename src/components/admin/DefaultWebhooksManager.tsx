import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Info, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { automationService } from '@/services/automation';

const AVAILABLE_EVENTS = [
  { id: 'all', label: 'Todos os Eventos', description: 'Receber todos os eventos disponíveis (recomendado para integrações)' },
  { id: 'message.received', label: 'Mensagem Recebida', description: 'Quando uma mensagem é recebida' },
  { id: 'message.sent', label: 'Mensagem Enviada', description: 'Quando uma mensagem é enviada' },
  { id: 'message.read', label: 'Mensagem Lida', description: 'Quando uma mensagem é lida' },
  { id: 'message.delivered', label: 'Mensagem Entregue', description: 'Quando uma mensagem é entregue' },
  { id: 'conversation.created', label: 'Conversa Criada', description: 'Quando uma nova conversa é iniciada' },
  { id: 'conversation.updated', label: 'Conversa Atualizada', description: 'Quando uma conversa é atualizada' },
  { id: 'bot.handoff', label: 'Transferência de Bot', description: 'Quando o bot transfere para atendente' }
];

export default function DefaultWebhooksManager() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalUrl, setOriginalUrl] = useState('');
  const [originalEvents, setOriginalEvents] = useState<string[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const urlChanged = webhookUrl !== originalUrl;
    const eventsChanged = JSON.stringify([...selectedEvents].sort()) !== JSON.stringify([...originalEvents].sort());
    setHasChanges(urlChanged || eventsChanged);
  }, [webhookUrl, selectedEvents, originalUrl, originalEvents]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await automationService.getGlobalSettings();
      const url = settings.defaultWebhookUrl || '';
      const events = settings.defaultWebhookEvents || [];
      setWebhookUrl(url);
      setOriginalUrl(url);
      setSelectedEvents(events);
      setOriginalEvents(events);
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEvent = (eventId: string) => {
    setSelectedEvents(prev => {
      // Se selecionou "all", desmarca os outros
      if (eventId === 'all') {
        return prev.includes('all') ? [] : ['all'];
      }
      
      // Se selecionou outro evento, remove "all" se estiver selecionado
      let newEvents = prev.filter(e => e !== 'all');
      
      if (newEvents.includes(eventId)) {
        newEvents = newEvents.filter(e => e !== eventId);
      } else {
        newEvents = [...newEvents, eventId];
      }
      
      return newEvents;
    });
  };

  const handleSelectAll = () => {
    setSelectedEvents(['all']);
  };

  const handleDeselectAll = () => {
    setSelectedEvents([]);
  };

  const handleSave = async () => {
    // Validar URL se preenchida
    if (webhookUrl.trim()) {
      try {
        new URL(webhookUrl);
      } catch {
        toast.error('URL do webhook inválida');
        return;
      }
    }

    try {
      setSaving(true);
      await automationService.updateGlobalSettings({
        defaultWebhookUrl: webhookUrl.trim() || null,
        defaultWebhookEvents: selectedEvents
      });
      setOriginalUrl(webhookUrl);
      setOriginalEvents(selectedEvents);
      setHasChanges(false);
      toast.success('Configurações de webhook padrão salvas');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  const isAllSelected = selectedEvents.includes('all');
  const individualEventsCount = AVAILABLE_EVENTS.filter(e => e.id !== 'all').length;
  const selectedCount = isAllSelected ? individualEventsCount : selectedEvents.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks Padrão</CardTitle>
        <CardDescription>
          Configure a URL e os eventos que serão automaticamente aplicados para novos usuários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Quando a automação de webhooks estiver ativa, novos usuários terão o webhook configurado automaticamente ao conectar o WhatsApp.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="webhook-url" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            URL do Webhook Padrão
          </Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://exemplo.com/api/webhook/events"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Esta URL receberá os eventos de webhook de todos os novos usuários
          </p>
        </div>

        <div className="space-y-3">
          <Label>Eventos</Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Todos (all)
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Limpar Seleção
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {AVAILABLE_EVENTS.map((event) => (
            <div
              key={event.id}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedEvents.includes(event.id) || (isAllSelected && event.id !== 'all')
                  ? 'border-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              } ${event.id === 'all' ? 'md:col-span-2 bg-muted/30' : ''}`}
              onClick={() => handleToggleEvent(event.id)}
            >
              <Checkbox
                id={event.id}
                checked={selectedEvents.includes(event.id) || (isAllSelected && event.id !== 'all')}
                disabled={isAllSelected && event.id !== 'all'}
                onCheckedChange={() => handleToggleEvent(event.id)}
              />
              <div className="flex-1">
                <Label htmlFor={event.id} className="cursor-pointer font-medium">
                  {event.label}
                  {event.id === 'all' && (
                    <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                      Recomendado
                    </span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {isAllSelected ? 'Todos os eventos' : `${selectedCount} de ${individualEventsCount} eventos`} selecionados
          </p>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
