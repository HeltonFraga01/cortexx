import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, Power, PowerOff, QrCode, RefreshCw, Smartphone, Wifi, WifiOff, Phone, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useWuzAPIInstances } from '@/contexts/WuzAPIInstancesContext';
import { WuzAPIInstance, WuzAPIInstanceStatus, CreateInstancePayload } from '@/lib/wuzapi-types';

interface WuzAPIInstancesListProps {
  className?: string;
}

// Componente para exibir status da instância
function InstanceStatusBadge({ status }: { status: WuzAPIInstanceStatus }) {
  const statusConfig = {
    connected: { label: 'Conectado', variant: 'default' as const, icon: Wifi },
    disconnected: { label: 'Desconectado', variant: 'secondary' as const, icon: WifiOff },
    connecting: { label: 'Conectando', variant: 'outline' as const, icon: Loader2 },
    qr: { label: 'QR Code', variant: 'outline' as const, icon: QrCode },
    error: { label: 'Erro', variant: 'destructive' as const, icon: WifiOff },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className={`h-3 w-3 ${status === 'connecting' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

// Componente para criar nova instância
function CreateInstanceDialog() {
  const { createInstance } = useWuzAPIInstances();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateInstancePayload>({
    name: '',
    webhook: '',
    webhook_events: {
      message: true,
      connect: true,
      disconnect: true,
      received: true,
      sent: true,
      ack: false,
      typing: false,
      presence: false,
      chatstate: false,
      group: false,
      call: false,
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome da instância é obrigatório');
      return;
    }

    setLoading(true);
    
    try {
      const success = await createInstance(formData);
      if (success) {
        setOpen(false);
        setFormData({
          name: '',
          webhook: '',
          webhook_events: {
            message: true,
            connect: true,
            disconnect: true,
            received: true,
            sent: true,
            ack: false,
            typing: false,
            presence: false,
            chatstate: false,
            group: false,
            call: false,
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Instância
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Instância</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Instância</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: minha-instancia"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook URL (Opcional)</Label>
            <Input
              id="webhook"
              type="url"
              value={formData.webhook}
              onChange={(e) => setFormData(prev => ({ ...prev, webhook: e.target.value }))}
              placeholder="https://seu-webhook.com/endpoint"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Instância
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Componente para exibir QR Code
function QRCodeDialog({ instanceName }: { instanceName: string }) {
  const { getInstanceQRCode } = useWuzAPIInstances();
  const [open, setOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGetQRCode = async () => {
    setLoading(true);
    try {
      const qr = await getInstanceQRCode(instanceName);
      setQrCode(qr);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      handleGetQRCode();
    } else {
      setQrCode(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code - {instanceName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 w-64 border rounded">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : qrCode ? (
            <img 
              src={qrCode} 
              alt="QR Code" 
              className="max-w-full h-auto border rounded"
            />
          ) : (
            <div className="flex items-center justify-center h-64 w-64 border rounded text-muted-foreground">
              QR Code não disponível
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            Escaneie este QR Code com o WhatsApp para conectar a instância
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente principal
export function WuzAPIInstancesList({ className }: WuzAPIInstancesListProps) {
  const {
    instances,
    loading,
    error,
    loadInstances,
    deleteInstance,
    connectInstance,
    disconnectInstance,
    refreshInstance,
  } = useWuzAPIInstances();

  const handleDelete = async (instanceName: string) => {
    await deleteInstance(instanceName);
  };

  const handleConnect = async (instanceName: string) => {
    await connectInstance(instanceName);
  };

  const handleDisconnect = async (instanceName: string) => {
    await disconnectInstance(instanceName);
  };

  const handleRefresh = async (instanceName: string) => {
    await refreshInstance(instanceName);
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Erro ao carregar instâncias: {error}</p>
            <Button onClick={loadInstances} className="mt-2">
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Instâncias WhatsApp</h2>
          <p className="text-muted-foreground">
            Gerencie suas instâncias do WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadInstances} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <CreateInstanceDialog />
        </div>
      </div>

      {loading && instances.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Carregando instâncias...
            </div>
          </CardContent>
        </Card>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma instância encontrada</h3>
              <p className="text-muted-foreground mb-4">
                Crie sua primeira instância para começar a usar o WhatsApp API
              </p>
              <CreateInstanceDialog />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <Card key={instance.name} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    {instance.name}
                  </CardTitle>
                  <InstanceStatusBadge status={instance.status} />
                </div>
                {instance.phoneNumber && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {instance.phoneNumber}
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {instance.status === 'disconnected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(instance.name)}
                    >
                      <Power className="h-4 w-4 mr-1" />
                      Conectar
                    </Button>
                  )}
                  
                  {instance.status === 'connected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(instance.name)}
                    >
                      <PowerOff className="h-4 w-4 mr-1" />
                      Desconectar
                    </Button>
                  )}
                  
                  {(instance.status === 'qr' || instance.status === 'connecting') && (
                    <QRCodeDialog instanceName={instance.name} />
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefresh(instance.name)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover Instância</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover a instância "{instance.name}"? 
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(instance.name)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <div className="mt-3 text-xs text-muted-foreground">
                  Criado: {new Date(instance.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default WuzAPIInstancesList;