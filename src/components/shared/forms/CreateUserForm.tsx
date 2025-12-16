/**
 * CreateUserForm - Componente avançado para criar usuários WuzAPI
 * Baseado no modelo de "Add New Instance" com configurações completas
 */

import { useState, FormEvent } from "react";
import { useBrandingConfig } from '@/hooks/useBranding';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, User, Phone, Globe, Settings, Shield, Database, Key, Plus, RotateCw, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-custom/Select";
import Switch from "@/components/ui-custom/Switch";
import { Textarea } from "@/components/ui-custom/Textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { WuzAPIService } from "@/services/wuzapi";

interface CreateUserFormProps {
  onSuccess?: () => void;
}

const CreateUserForm = ({ onSuccess }: CreateUserFormProps) => {
  const brandingConfig = useBrandingConfig();
  const wuzapi = new WuzAPIService();
  
  // Estados básicos do formulário
  const [instanceName, setInstanceName] = useState("");
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

  // Eventos disponíveis para webhook (baseado nas imagens e spec.yml)
  const availableEvents = [
    // Mensagens
    { value: "Message", label: "Message" },
    { value: "UndecryptableMessage", label: "Undecryptable Message" },
    { value: "Receipt", label: "Receipt" },
    { value: "MediaRetry", label: "Media Retry" },
    
    // Grupos
    { value: "GroupInfo", label: "Group Info" },
    { value: "JoinedGroup", label: "Joined Group" },
    
    // Newsletter
    { value: "NewsletterMuteChange", label: "Newsletter Mute Change" },
    { value: "NewsletterLiveUpdate", label: "Newsletter Live Update" },
    { value: "NewsletterJoin", label: "Newsletter Join" },
    { value: "NewsletterLeave", label: "Newsletter Leave" },
    { value: "FBMessage", label: "FB Message" },
    
    // Presença
    { value: "Presence", label: "Presence" },
    { value: "ChatPresence", label: "Chat Presence" },
    
    // Identidade e Mudanças
    { value: "IdentityChange", label: "Identity Change" },
    { value: "CATRefreshError", label: "CAT Refresh Error" },
    
    // Sincronização
    { value: "OfflineSyncPreview", label: "Offline Sync Preview" },
    { value: "OfflineSyncCompleted", label: "Offline Sync Completed" },
    { value: "HistorySync", label: "History Sync" },
    { value: "AppState", label: "App State" },
    { value: "AppStateSyncComplete", label: "App State Sync Complete" },
    
    // Chamadas
    { value: "CallOffer", label: "Call Offer" },
    { value: "CallAccept", label: "Call Accept" },
    { value: "CallTerminate", label: "Call Terminate" },
    { value: "CallOfferNotice", label: "Call Offer Notice" },
    { value: "CallRelayLatency", label: "Call Relay Latency" },
    
    // Conexão
    { value: "Connected", label: "Connected" },
    { value: "Disconnected", label: "Disconnected" },
    { value: "ConnectFailure", label: "Connect Failure" },
    { value: "LoggedOut", label: "Logged Out" },
    { value: "ClientOutdated", label: "Client Outdated" },
    { value: "TemporaryBan", label: "Temporary Ban" },
    { value: "StreamError", label: "Stream Error" },
    { value: "StreamReplaced", label: "Stream Replaced" },
    
    // Keep Alive
    { value: "KeepAliveRestored", label: "Keep Alive Restored" },
    { value: "KeepAliveTimeout", label: "Keep Alive Timeout" },
    
    // Pairing
    { value: "PairSuccess", label: "Pair Success" },
    { value: "PairError", label: "Pair Error" },
    { value: "QR", label: "QR" },
    { value: "QRScannedWithoutMultidevice", label: "QR Scanned Without Multidevice" },
    
    // Outros
    { value: "Picture", label: "Picture" },
    { value: "BlocklistChange", label: "Blocklist Change" },
    { value: "Blocklist", label: "Blocklist" },
    { value: "PrivacySettings", label: "Privacy Settings" },
    { value: "PushNameSetting", label: "Push Name Setting" },
    { value: "UserAbout", label: "User About" },
    
    // Opção especial
    { value: "All", label: "All Events" },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validação removida - configurações agora vêm do .env

    setIsLoading(true);

    try {
      // Validações básicas
      if (!instanceName.trim()) {
        toast.error("Nome obrigatório", {
          description: "Digite um nome para a instância",
        });
        return;
      }

      if (!phoneNumber.trim()) {
        toast.error("Telefone obrigatório", {
          description: "Digite um número de telefone válido",
        });
        return;
      }

      // Gerar token único para o usuário
      const randomCode = `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
      const userToken = `${phoneNumber}${randomCode}`;

      // Preparar dados do usuário
      const userData = {
        name: instanceName,
        token: userToken,
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

      // Criar usuário via WuzAPI
      const result = await wuzapi.createUser(userData);

      // Se chegou até aqui, foi sucesso (createUser lança exceção em caso de erro)
      toast.success("Usuário criado com sucesso!", {
        description: `Usuário ${userData.name} foi criado com token: ${userToken.substring(0, 8)}...`,
      });

      // Limpar formulário
      setInstanceName("");
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
      
      // Callback de sucesso - só chama se chegou até aqui
      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast.error("Erro inesperado", {
        description: "Ocorreu um erro ao criar o usuário. Tente novamente.",
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
          <CardDescription>
            Configure uma nova instância {brandingConfig.appName} com configurações avançadas
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
              Configurações essenciais para sua instância
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="instanceName" className="text-sm font-medium text-foreground">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="instanceName"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                required
                placeholder="Nome da instância"
                className="h-10"
              />
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
                Identificador único do número de telefone para esta instância (apenas números, com código do país)
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
                {/* Botão para selecionar/desselecionar todos */}
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
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-2 focus:ring-offset-2"
                    />
                    <Label 
                      htmlFor="select-all-events"
                      className="text-sm font-medium cursor-pointer text-primary"
                    >
                      All Events (Todos os Eventos)
                    </Label>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedEvents.length} selecionado{selectedEvents.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Grid de eventos organizados */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {availableEvents.filter(event => event.value !== "All").map((event) => (
                    <div key={event.value} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        id={`event-${event.value}`}
                        checked={selectedEvents.includes(event.value) || selectedEvents.includes("All")}
                        onChange={() => {
                          if (selectedEvents.includes("All")) {
                            // Se "All" está selecionado, desmarcar "All" e selecionar apenas este evento
                            setSelectedEvents([event.value]);
                          } else {
                            toggleEvent(event.value);
                          }
                        }}
                        disabled={selectedEvents.includes("All")}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                      />
                      <Label 
                        htmlFor={`event-${event.value}`}
                        className={`text-xs cursor-pointer ${
                          selectedEvents.includes("All") ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {event.label}
                      </Label>
                    </div>
                  ))}
                </div>

                {/* Resumo dos eventos selecionados */}
                {selectedEvents.length > 0 && !selectedEvents.includes("All") && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-sm text-muted-foreground">
                      <strong>Eventos Selecionados ({selectedEvents.length}):</strong>
                      <div className="mt-1 text-xs bg-muted p-2 rounded max-h-20 overflow-y-auto">
                        {selectedEvents.join(", ")}
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvents.includes("All") && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-sm text-primary font-medium">
                      ✅ Todos os eventos estão selecionados
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      O webhook receberá notificações para todos os tipos de eventos disponíveis
                    </div>
                  </div>
                )}

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
                placeholder="0"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Número de mensagens para armazenar no histórico por chat para esta instância. Defina como 0 para desabilitar o histórico de mensagens.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Proxy Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Shield className="h-5 w-5 mr-2 text-primary" />
              Proxy Configuration (Optional)
            </CardTitle>
            <CardDescription>
              Configure proxy settings for this instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableProxy" className="text-sm font-medium text-foreground">
                  Enable Proxy
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable proxy for this instance
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
                  Proxy URL
                </Label>
                <Input
                  id="proxyUrl"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="http://proxy.example.com:8080 or socks5://user:pass@proxy.example.com:1080"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Include protocol (http://, https://, or socks5://) and port. Authentication can be included in URL format.
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
              S3 Storage Configuration (Optional)
            </CardTitle>
            <CardDescription>
              Configure S3-compatible storage for media files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableS3Storage" className="text-sm font-medium text-foreground">
                  Enable S3 Storage
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable S3-compatible storage for media files
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
                    S3 Endpoint URL
                  </Label>
                  <Input
                    id="s3Endpoint"
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    placeholder="https://s3.amazonaws.com or custom endpoint"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    For AWS S3, leave empty or use default. For MinIO/others, use your custom endpoint.
                  </p>
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
                      placeholder="Your S3 access key ID"
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
                      placeholder="Your S3 secret access key"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="s3BucketName" className="text-sm font-medium text-foreground">
                      Bucket Name
                    </Label>
                    <Input
                      id="s3BucketName"
                      value={s3BucketName}
                      onChange={(e) => setS3BucketName(e.target.value)}
                      placeholder="Your S3 bucket name"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3Region" className="text-sm font-medium text-foreground">
                      Region
                    </Label>
                    <Input
                      id="s3Region"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="us-east-1"
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for AWS S3. Optional for MinIO and other providers.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="s3PublicUrl" className="text-sm font-medium text-foreground">
                    Public URL (Optional)
                  </Label>
                  <Input
                    id="s3PublicUrl"
                    value={s3PublicUrl}
                    onChange={(e) => setS3PublicUrl(e.target.value)}
                    placeholder="https://cdn.example.com"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Public URL for accessing files if different from endpoint.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mediaDelivery" className="text-sm font-medium text-foreground">
                      Media Delivery
                    </Label>
                    <Select value={mediaDelivery} onValueChange={setMediaDelivery}>
                      <SelectTrigger 
                        className="h-10"
                        color="info"
                        size="md"
                        glow
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Base64">Base64 (Default)</SelectItem>
                        <SelectItem value="URL">URL</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      How media should be delivered in webhook events.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retentionDays" className="text-sm font-medium text-foreground">
                      Retention Days
                    </Label>
                    <Input
                      id="retentionDays"
                      type="number"
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(e.target.value)}
                      placeholder="30"
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of days to retain files in S3 before deletion.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="forcePathStyle" className="text-sm font-medium text-foreground">
                      Force Path Style
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable for MinIO and some S3-compatible providers.
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
              HMAC Configuration (Optional)
            </CardTitle>
            <CardDescription>
              Configure HMAC key for webhook security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableHmacKey" className="text-sm font-medium text-foreground">
                  Enable HMAC Key
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable HMAC key for webhook security
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
                    Important Security Notice
                  </h4>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• The HMAC key will be hidden after saving for security reasons.</li>
                    <li>• You won't be able to view it again</li>
                    <li>• Save a copy in a secure location before proceeding</li>
                    <li>• If lost, you'll need to generate a new key</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hmacKey" className="text-sm font-medium text-foreground">
                    HMAC Key
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="hmacKey"
                      value={hmacKey}
                      onChange={(e) => setHmacKey(e.target.value)}
                      placeholder="Enter HMAC key (minimum 32 characters)"
                      className="h-10"
                      minLength={32}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateRandomKey}
                      className="h-10 px-4"
                    >
                      <RotateCw className="h-4 w-4 mr-2" />
                      Generate Random Key
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(hmacKey)
                        } catch {
                          // Silently fail
                        }
                      }}
                      disabled={!hmacKey}
                      className="h-10 px-4"
                    >
                      <Eye className="h-4 w-4" />
                      Show Key
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 32 characters for security. Keep this key secret!
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
                  setInstanceName("");
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
                }}
                className="h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !instanceName || !phoneNumber}
                className="h-10 bg-primary hover:bg-primary/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    Submit
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

export default CreateUserForm;