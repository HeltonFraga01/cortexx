/**
 * CreateInboxForm - Componente para criar caixas de entrada WhatsApp
 * 
 * Uma "caixa de entrada" (inbox) é uma instância de conexão WhatsApp via WUZAPI.
 * Este componente substitui o antigo CreateUserForm com nomenclatura correta.
 */

import { useState, FormEvent } from "react";
import { useBrandingConfig } from '@/hooks/useBranding';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Inbox, Phone, Globe, Settings, Shield, Database, Key, RotateCw, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-custom/Select";
import Switch from "@/components/ui-custom/Switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { WuzAPIService } from "@/services/wuzapi";

interface CreateInboxFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateInboxForm = ({ onSuccess, onCancel }: CreateInboxFormProps) => {
  const brandingConfig = useBrandingConfig();
  const wuzapi = new WuzAPIService();
  
  // Estados básicos do formulário
  const [inboxName, setInboxName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [messageHistory, setMessageHistory] = useState("0");
  
  // Estados de configurações avançadas
  const [enableProxy, setEnableProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [enableS3Storage, setEnableS3Storage] = useState(false);
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3BucketName, setS3BucketName] = useState("");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3PublicUrl, setS3PublicUrl] = useState("");
  const [mediaDelivery, setMediaDelivery] = useState("Base64");
  const [retentionDays, setRetentionDays] = useState("30");
  const [forcePathStyle, setForcePathStyle] = useState(false);
  const [enableHmacKey, setEnableHmacKey] = useState(false);
  const [hmacKey, setHmacKey] = useState("");
  
  // Estados de loading
  const [isLoading, setIsLoading] = useState(false);

  // Eventos disponíveis para webhook
  const availableEvents = [
    { value: "Message", label: "Message" },
    { value: "UndecryptableMessage", label: "Undecryptable Message" },
    { value: "Receipt", label: "Receipt" },
    { value: "MediaRetry", label: "Media Retry" },
    { value: "GroupInfo", label: "Group Info" },
    { value: "JoinedGroup", label: "Joined Group" },
    { value: "NewsletterMuteChange", label: "Newsletter Mute Change" },
    { value: "NewsletterLiveUpdate", label: "Newsletter Live Update" },
    { value: "NewsletterJoin", label: "Newsletter Join" },
    { value: "NewsletterLeave", label: "Newsletter Leave" },
    { value: "FBMessage", label: "FB Message" },
    { value: "Presence", label: "Presence" },
    { value: "ChatPresence", label: "Chat Presence" },
    { value: "IdentityChange", label: "Identity Change" },
    { value: "CATRefreshError", label: "CAT Refresh Error" },
    { value: "OfflineSyncPreview", label: "Offline Sync Preview" },
    { value: "OfflineSyncCompleted", label: "Offline Sync Completed" },
    { value: "HistorySync", label: "History Sync" },
    { value: "AppState", label: "App State" },
    { value: "AppStateSyncComplete", label: "App State Sync Complete" },
    { value: "CallOffer", label: "Call Offer" },
    { value: "CallAccept", label: "Call Accept" },
    { value: "CallTerminate", label: "Call Terminate" },
    { value: "CallOfferNotice", label: "Call Offer Notice" },
    { value: "CallRelayLatency", label: "Call Relay Latency" },
    { value: "Connected", label: "Connected" },
    { value: "Disconnected", label: "Disconnected" },
    { value: "ConnectFailure", label: "Connect Failure" },
    { value: "LoggedOut", label: "Logged Out" },
    { value: "ClientOutdated", label: "Client Outdated" },
    { value: "TemporaryBan", label: "Temporary Ban" },
    { value: "StreamError", label: "Stream Error" },
    { value: "StreamReplaced", label: "Stream Replaced" },
    { value: "KeepAliveRestored", label: "Keep Alive Restored" },
    { value: "KeepAliveTimeout", label: "Keep Alive Timeout" },
    { value: "PairSuccess", label: "Pair Success" },
    { value: "PairError", label: "Pair Error" },
    { value: "QR", label: "QR" },
    { value: "QRScannedWithoutMultidevice", label: "QR Scanned Without Multidevice" },
    { value: "Picture", label: "Picture" },
    { value: "BlocklistChange", label: "Blocklist Change" },
    { value: "Blocklist", label: "Blocklist" },
    { value: "PrivacySettings", label: "Privacy Settings" },
    { value: "PushNameSetting", label: "Push Name Setting" },
    { value: "UserAbout", label: "User About" },
    { value: "All", label: "Todos os Eventos" },
  ];

  const resetForm = () => {
    setInboxName("");
    setPhoneNumber("");
    setWebhookUrl("");
    setSelectedEvents([]);
    setMessageHistory("0");
    setEnableProxy(false);
    setProxyUrl("");
    setEnableS3Storage(false);
    setS3Endpoint("");
    setS3AccessKey("");
    setS3SecretKey("");
    setS3BucketName("");
    setS3Region("us-east-1");
    setS3PublicUrl("");
    setMediaDelivery("Base64");
    setRetentionDays("30");
    setForcePathStyle(false);
    setEnableHmacKey(false);
    setHmacKey("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!inboxName.trim()) {
        toast.error("Nome obrigatório", {
          description: "Digite um nome para a caixa de entrada",
        });
        return;
      }

      if (!phoneNumber.trim()) {
        toast.error("Telefone obrigatório", {
          description: "Digite um número de telefone válido",
        });
        return;
      }

      // Gerar token único para a caixa de entrada
      const randomCode = `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
      const inboxToken = `${phoneNumber}${randomCode}`;

      // Preparar dados da caixa de entrada
      const inboxData = {
        name: inboxName,
        token: inboxToken,
        webhook: webhookUrl || "",
        events: selectedEvents.length > 0 ? selectedEvents.join(",") : "Message",
        history: parseInt(messageHistory) || 0,
        proxyConfig: enableProxy ? {
          enabled: true,
          proxyURL: proxyUrl
        } : undefined,
        s3Config: enableS3Storage ? {
          enabled: true,
          endpoint: s3Endpoint,
          region: s3Region,
          bucket: s3BucketName,
          accessKey: s3AccessKey,
          secretKey: s3SecretKey,
          pathStyle: forcePathStyle,
          publicURL: s3PublicUrl,
          mediaDelivery: mediaDelivery.toLowerCase(),
          retentionDays: parseInt(retentionDays) || 30
        } : undefined
      };

      // Criar caixa de entrada via WuzAPI
      await wuzapi.createInbox(inboxData);

      toast.success("Caixa de entrada criada!", {
        description: `${inboxData.name} foi criada com sucesso.`,
      });

      resetForm();
      onSuccess?.();

    } catch (error) {
      console.error("Erro ao criar caixa de entrada:", error);
      toast.error("Erro ao criar caixa de entrada", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEvent = (eventValue: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventValue) 
        ? prev.filter(e => e !== eventValue)
        : [...prev, eventValue]
    );
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setHmacKey(result);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle className="flex items-center text-foreground">
            <Inbox className="h-5 w-5 mr-2 text-primary" />
            Nova Caixa de Entrada
          </CardTitle>
          <CardDescription>
            Configure uma nova conexão WhatsApp para {brandingConfig.appName}
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Settings className="h-5 w-5 mr-2 text-primary" />
              Configuração Básica
            </CardTitle>
            <CardDescription>
              Configurações essenciais para a caixa de entrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="inboxName" className="text-sm font-medium text-foreground">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inboxName"
                value={inboxName}
                onChange={(e) => setInboxName(e.target.value)}
                required
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Nome identificador para esta caixa de entrada
              </p>
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-sm font-medium text-foreground flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                Número de Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                placeholder="5521999999999"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Número do WhatsApp que será conectado (apenas números, com código do país)
              </p>
            </div>

            {/* Webhook URL */}
            <div className="space-y-2">
              <Label htmlFor="webhookUrl" className="text-sm font-medium text-foreground flex items-center">
                <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                Webhook URL
              </Label>
              <Input
                id="webhookUrl"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="h-10"
              />
            </div>

            {/* Events */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Eventos <span className="text-destructive">*</span>
              </Label>
              <div className="border border-border rounded-md p-4 space-y-4 bg-background">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="select-all-events"
                      checked={selectedEvents.includes("All")}
                      onChange={() => {
                        if (selectedEvents.includes("All")) {
                          setSelectedEvents([]);
                        } else {
                          setSelectedEvents(["All"]);
                        }
                      }}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <Label htmlFor="select-all-events" className="text-sm font-medium cursor-pointer text-primary">
                      Todos os Eventos
                    </Label>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedEvents.length} selecionado{selectedEvents.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {availableEvents.filter(event => event.value !== "All").map((event) => (
                    <div key={event.value} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        id={`event-${event.value}`}
                        checked={selectedEvents.includes(event.value) || selectedEvents.includes("All")}
                        onChange={() => {
                          if (selectedEvents.includes("All")) {
                            setSelectedEvents([event.value]);
                          } else {
                            toggleEvent(event.value);
                          }
                        }}
                        disabled={selectedEvents.includes("All")}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
                      />
                      <Label 
                        htmlFor={`event-${event.value}`}
                        className={`text-xs cursor-pointer ${selectedEvents.includes("All") ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {event.label}
                      </Label>
                    </div>
                  ))}
                </div>

                {selectedEvents.length === 0 && (
                  <div className="text-sm text-muted-foreground italic bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                    ⚠️ Selecione pelo menos um tipo de evento para notificações webhook
                  </div>
                )}
              </div>
            </div>

            {/* Message History */}
            <div className="space-y-2">
              <Label htmlFor="messageHistory" className="text-sm font-medium text-foreground">
                Histórico de Mensagens
              </Label>
              <Input
                id="messageHistory"
                type="number"
                value={messageHistory}
                onChange={(e) => setMessageHistory(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Número de mensagens para armazenar no histórico. 0 para desabilitar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Proxy Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Shield className="h-5 w-5 mr-2 text-primary" />
              Configuração de Proxy (Opcional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableProxy" className="text-sm font-medium text-foreground">
                  Habilitar Proxy
                </Label>
                <p className="text-xs text-muted-foreground">
                  Usar proxy para esta caixa de entrada
                </p>
              </div>
              <Switch
                id="enableProxy"
                checked={enableProxy}
                onCheckedChange={setEnableProxy}
                color="primary"
                size="md"
                glow
              />
            </div>
            
            {enableProxy && (
              <div className="space-y-2 pt-4 border-t border-border">
                <Label htmlFor="proxyUrl" className="text-sm font-medium text-foreground">
                  URL do Proxy
                </Label>
                <Input
                  id="proxyUrl"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="http://proxy.example.com:8080"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Inclua protocolo (http://, https://, ou socks5://) e porta.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* S3 Storage Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Database className="h-5 w-5 mr-2 text-primary" />
              Armazenamento S3 (Opcional)
            </CardTitle>
            <CardDescription>
              Configure armazenamento S3 para arquivos de mídia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableS3Storage" className="text-sm font-medium text-foreground">
                  Habilitar S3
                </Label>
                <p className="text-xs text-muted-foreground">
                  Usar armazenamento S3 para arquivos de mídia
                </p>
              </div>
              <Switch
                id="enableS3Storage"
                checked={enableS3Storage}
                onCheckedChange={setEnableS3Storage}
                color="info"
                size="md"
                glow
              />
            </div>

            {enableS3Storage && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label htmlFor="s3Endpoint" className="text-sm font-medium text-foreground">
                    Endpoint S3
                  </Label>
                  <Input
                    id="s3Endpoint"
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    placeholder="https://s3.amazonaws.com"
                    className="h-10"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="s3AccessKey" className="text-sm font-medium text-foreground">
                      Access Key ID
                    </Label>
                    <Input
                      id="s3AccessKey"
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3SecretKey" className="text-sm font-medium text-foreground">
                      Secret Access Key
                    </Label>
                    <Input
                      id="s3SecretKey"
                      type="password"
                      value={s3SecretKey}
                      onChange={(e) => setS3SecretKey(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="s3BucketName" className="text-sm font-medium text-foreground">
                      Nome do Bucket
                    </Label>
                    <Input
                      id="s3BucketName"
                      value={s3BucketName}
                      onChange={(e) => setS3BucketName(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3Region" className="text-sm font-medium text-foreground">
                      Região
                    </Label>
                    <Input
                      id="s3Region"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="us-east-1"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="s3PublicUrl" className="text-sm font-medium text-foreground">
                    URL Pública (Opcional)
                  </Label>
                  <Input
                    id="s3PublicUrl"
                    value={s3PublicUrl}
                    onChange={(e) => setS3PublicUrl(e.target.value)}
                    placeholder="https://cdn.example.com"
                    className="h-10"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mediaDelivery" className="text-sm font-medium text-foreground">
                      Entrega de Mídia
                    </Label>
                    <Select value={mediaDelivery} onValueChange={setMediaDelivery}>
                      <SelectTrigger className="h-10" color="info" size="md" glow>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Base64">Base64 (Padrão)</SelectItem>
                        <SelectItem value="URL">URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retentionDays" className="text-sm font-medium text-foreground">
                      Dias de Retenção
                    </Label>
                    <Input
                      id="retentionDays"
                      type="number"
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="forcePathStyle" className="text-sm font-medium text-foreground">
                      Force Path Style
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Habilitar para MinIO e alguns provedores S3
                    </p>
                  </div>
                  <Switch
                    id="forcePathStyle"
                    checked={forcePathStyle}
                    onCheckedChange={setForcePathStyle}
                    color="warning"
                    size="sm"
                    glow
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HMAC Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Key className="h-5 w-5 mr-2 text-primary" />
              Configuração HMAC (Opcional)
            </CardTitle>
            <CardDescription>
              Configure chave HMAC para segurança do webhook
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableHmacKey" className="text-sm font-medium text-foreground">
                  Habilitar Chave HMAC
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adicionar assinatura HMAC aos webhooks
                </p>
              </div>
              <Switch
                id="enableHmacKey"
                checked={enableHmacKey}
                onCheckedChange={setEnableHmacKey}
                color="error"
                size="md"
                glow
              />
            </div>

            {enableHmacKey && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    Aviso de Segurança
                  </h4>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• A chave HMAC será ocultada após salvar</li>
                    <li>• Você não poderá visualizá-la novamente</li>
                    <li>• Salve uma cópia em local seguro</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hmacKey" className="text-sm font-medium text-foreground">
                    Chave HMAC
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="hmacKey"
                      value={hmacKey}
                      onChange={(e) => setHmacKey(e.target.value)}
                      className="h-10"
                      minLength={32}
                    />
                    <Button type="button" variant="outline" onClick={generateRandomKey} className="h-10 px-4">
                      <RotateCw className="h-4 w-4 mr-2" />
                      Gerar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(hmacKey);
                          toast.success("Chave copiada!");
                        } catch {
                          // Silently fail
                        }
                      }}
                      disabled={!hmacKey}
                      className="h-10 px-4"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo 32 caracteres. Mantenha esta chave em segredo!
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  onCancel?.();
                }}
                className="h-10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !inboxName || !phoneNumber}
                className="h-10 bg-primary hover:bg-primary/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Inbox className="h-4 w-4 mr-2" />
                    Criar Caixa de Entrada
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default CreateInboxForm;

/**
 * @deprecated Use CreateInboxForm instead. Este componente será removido em versão futura.
 */
export const CreateUserForm = CreateInboxForm;