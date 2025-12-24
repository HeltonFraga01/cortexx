import { useState, useEffect, useCallback } from 'react';
import { WuzAPIUser, wuzapi } from '@/services/wuzapi';
import { SupabaseUser, CreateSupabaseUserDTO, UpdateSupabaseUserDTO } from '@/services/admin-users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Globe, 
  User, 
  Wifi, 
  WifiOff, 
  Save, 
  X,
  Loader2,
  Phone,
  Key,
  AlertCircle,
  Hash,
  Copy,
  Check,
  RefreshCw,
  ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

// Interface para os dados do formulário de edição
export interface EditUserFormData {
  name: string;
  webhook: string;
  events: string;
}

// Props do componente UserEditForm
interface UserEditFormProps {
  user: WuzAPIUser;
  formData: EditUserFormData;
  onFormChange: (data: EditUserFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading?: boolean;
  hasChanges?: boolean;
  // Ações adicionais
  onGenerateQR?: () => void;
  onDeleteFromDB?: () => void;
  onDeleteFull?: () => void;
  // Supabase User Props
  supabaseUser?: SupabaseUser | null;
  onLinkSupabaseUser?: (email: string) => Promise<void>;
  onCreateSupabaseUser?: (data: CreateSupabaseUserDTO) => Promise<void>;
  onUpdateSupabaseUser?: (data: UpdateSupabaseUserDTO) => Promise<void>;
  onUnlinkSupabaseUser?: () => Promise<void>;
}

// Lista de eventos disponíveis (baseada no CreateUserForm)
const availableEvents = [
  // Mensagens
  { value: "Message", label: "Message", category: "Mensagens" },
  { value: "UndecryptableMessage", label: "Undecryptable Message", category: "Mensagens" },
  { value: "Receipt", label: "Receipt", category: "Mensagens" },
  { value: "ReadReceipt", label: "Read Receipt", category: "Mensagens" },
  { value: "MediaRetry", label: "Media Retry", category: "Mensagens" },
  
  // Grupos
  { value: "GroupInfo", label: "Group Info", category: "Grupos" },
  { value: "JoinedGroup", label: "Joined Group", category: "Grupos" },
  
  // Newsletter
  { value: "NewsletterMuteChange", label: "Newsletter Mute Change", category: "Newsletter" },
  { value: "NewsletterLiveUpdate", label: "Newsletter Live Update", category: "Newsletter" },
  { value: "NewsletterJoin", label: "Newsletter Join", category: "Newsletter" },
  { value: "NewsletterLeave", label: "Newsletter Leave", category: "Newsletter" },
  { value: "FBMessage", label: "FB Message", category: "Newsletter" },
  
  // Presença
  { value: "Presence", label: "Presence", category: "Presença" },
  { value: "ChatPresence", label: "Chat Presence", category: "Presença" },
  
  // Identidade e Mudanças
  { value: "IdentityChange", label: "Identity Change", category: "Sistema" },
  { value: "CATRefreshError", label: "CAT Refresh Error", category: "Sistema" },
  
  // Sincronização
  { value: "OfflineSyncPreview", label: "Offline Sync Preview", category: "Sincronização" },
  { value: "OfflineSyncCompleted", label: "Offline Sync Completed", category: "Sincronização" },
  { value: "HistorySync", label: "History Sync", category: "Sincronização" },
  { value: "AppState", label: "App State", category: "Sincronização" },
  { value: "AppStateSyncComplete", label: "App State Sync Complete", category: "Sincronização" },
  
  // Chamadas
  { value: "CallOffer", label: "Call Offer", category: "Chamadas" },
  { value: "CallAccept", label: "Call Accept", category: "Chamadas" },
  { value: "CallTerminate", label: "Call Terminate", category: "Chamadas" },
  { value: "CallOfferNotice", label: "Call Offer Notice", category: "Chamadas" },
  { value: "CallRelayLatency", label: "Call Relay Latency", category: "Chamadas" },
  
  // Conexão
  { value: "Connected", label: "Connected", category: "Conexão" },
  { value: "Disconnected", label: "Disconnected", category: "Conexão" },
  { value: "ConnectFailure", label: "Connect Failure", category: "Conexão" },
  { value: "LoggedOut", label: "Logged Out", category: "Conexão" },
  { value: "ClientOutdated", label: "Client Outdated", category: "Conexão" },
  { value: "TemporaryBan", label: "Temporary Ban", category: "Conexão" },
  { value: "StreamError", label: "Stream Error", category: "Conexão" },
  { value: "StreamReplaced", label: "Stream Replaced", category: "Conexão" },
  
  // Keep Alive
  { value: "KeepAliveRestored", label: "Keep Alive Restored", category: "Keep Alive" },
  { value: "KeepAliveTimeout", label: "Keep Alive Timeout", category: "Keep Alive" },
  
  // Pairing
  { value: "PairSuccess", label: "Pair Success", category: "Pairing" },
  { value: "PairError", label: "Pair Error", category: "Pairing" },
  { value: "QR", label: "QR", category: "Pairing" },
  { value: "QRScannedWithoutMultidevice", label: "QR Scanned Without Multidevice", category: "Pairing" },
  
  // Outros
  { value: "Picture", label: "Picture", category: "Outros" },
  { value: "BlocklistChange", label: "Blocklist Change", category: "Outros" },
  { value: "Blocklist", label: "Blocklist", category: "Outros" },
  { value: "PrivacySettings", label: "Privacy Settings", category: "Outros" },
  { value: "PushNameSetting", label: "Push Name Setting", category: "Outros" },
  { value: "UserAbout", label: "User About", category: "Outros" },
];

const UserEditForm = ({ 
  user, 
  formData, 
  onFormChange, 
  onSubmit, 
  onCancel, 
  loading = false,
  hasChanges = false,
  onGenerateQR,
  onDeleteFromDB,
  onDeleteFull,
  supabaseUser,
  onLinkSupabaseUser,
  onCreateSupabaseUser,
  onUpdateSupabaseUser,
  onUnlinkSupabaseUser
}: UserEditFormProps) => {
  
  // Estado local para controle de validação
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // Estado para Supabase User Form
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [showLinkUser, setShowLinkUser] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showUpdateUser, setShowUpdateUser] = useState(false);
  
  // Form states for Supabase actions
  const [linkEmail, setLinkEmail] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [updateEmail, setUpdateEmail] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');

  // Inicializar email para novo usuário/vínculo com o email do WuzAPI (se houver, assumindo que nome pode ser email ou user.id)
  useEffect(() => {
    // Tentar inferir email se o nome parecer um email
    if (user.name && user.name.includes('@')) {
      const email = user.name;
      setLinkEmail(email);
      setNewUserEmail(email);
    }
  }, [user.name]);

  // Handlers para Supabase Actions
  const handleLinkSupabaseUser = async () => {
    if (!linkEmail || !onLinkSupabaseUser) return;
    try {
      setSupabaseLoading(true);
      await onLinkSupabaseUser(linkEmail);
      setShowLinkUser(false);
      setLinkEmail('');
      toast.success('Usuário vinculado com sucesso');
    } catch {
      toast.error('Erro ao vincular usuário');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleCreateSupabaseUser = async () => {
    if (!newUserEmail || !newUserPassword || !onCreateSupabaseUser) return;
    try {
      setSupabaseLoading(true);
      await onCreateSupabaseUser({
        email: newUserEmail,
        password: newUserPassword,
        email_confirm: true,
        user_metadata: { role: 'user', name: user.name }
      });
      setShowCreateUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      toast.success('Usuário criado e vinculado com sucesso');
    } catch {
      toast.error('Erro ao criar usuário');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleUpdateSupabaseUser = async () => {
    if ((!updateEmail && !updatePassword) || !onUpdateSupabaseUser) return;
    try {
      setSupabaseLoading(true);
      await onUpdateSupabaseUser({
        email: updateEmail || undefined,
        password: updatePassword || undefined
      });
      setShowUpdateUser(false);
      setUpdateEmail('');
      setUpdatePassword('');
      toast.success('Credenciais atualizadas com sucesso');
    } catch {
      toast.error('Erro ao atualizar credenciais');
    } finally {
      setSupabaseLoading(false);
    }
  };
  
  // Estado para avatar e cópia
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Buscar avatar do usuário
  const fetchAvatar = useCallback(async () => {
    if (!user.jid || !user.loggedIn) return;
    
    setAvatarLoading(true);
    try {
      const phone = user.jid.split(':')[0];
      if (!phone) return;
      
      const avatarData = await wuzapi.getAvatar(user.token, phone, false);
      if (avatarData?.URL) {
        setAvatarUrl(avatarData.URL);
      }
    } catch {
      // Silenciosamente falha
    } finally {
      setAvatarLoading(false);
    }
  }, [user.jid, user.loggedIn, user.token]);

  // Formatar data
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Buscar avatar ao montar
  useEffect(() => {
    fetchAvatar();
  }, [fetchAvatar]);

  // Função para copiar texto
  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field} copiado!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };
  
  // Função para atualizar dados do formulário
  const updateFormData = (field: keyof EditUserFormData, value: string) => {
    const newData = { ...formData, [field]: value };
    onFormChange(newData);
    
    // Marcar campo como tocado
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validação em tempo real para campos tocados
    if (touched[field] || errors[field]) {
      validateField(field, value);
    }
  };

  // Função para validar um campo específico
  const validateField = (field: keyof EditUserFormData, value: string) => {
    const newErrors = { ...errors };
    
    switch (field) {
      case 'name':
        if (!value.trim()) {
          newErrors.name = 'O nome do usuário é obrigatório';
        } else if (value.trim().length < 2) {
          newErrors.name = 'O nome deve ter pelo menos 2 caracteres';
        } else if (value.trim().length > 50) {
          newErrors.name = 'O nome não pode ter mais de 50 caracteres';
        } else if (!/^[a-zA-ZÀ-ÿ0-9\s\-_.]+$/.test(value.trim())) {
          newErrors.name = 'O nome contém caracteres inválidos. Use apenas letras, números, espaços, hífens, pontos e sublinhados';
        } else {
          delete newErrors.name;
        }
        break;
        
      case 'webhook':
        if (value && value.trim()) {
          const trimmedValue = value.trim();
          if (!isValidUrl(trimmedValue)) {
            newErrors.webhook = 'URL do webhook inválida. Deve começar com http:// ou https://';
          } else if (trimmedValue.length > 500) {
            newErrors.webhook = 'A URL do webhook é muito longa (máximo 500 caracteres)';
          } else if (!trimmedValue.startsWith('https://') && !trimmedValue.startsWith('http://')) {
            newErrors.webhook = 'A URL deve começar com http:// ou https://';
          } else {
            // Validação adicional para URLs suspeitas
            const url = new URL(trimmedValue);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
              newErrors.webhook = 'URLs localhost não são recomendadas para webhooks em produção';
            } else {
              delete newErrors.webhook;
            }
          }
        } else {
          delete newErrors.webhook;
        }
        break;
        
      case 'events':
        if (!value || value.trim() === '') {
          newErrors.events = 'Selecione pelo menos um evento para o webhook';
        } else if (value !== 'All') {
          const eventsList = value.split(',').map(e => e.trim()).filter(e => e);
          if (eventsList.length === 0) {
            newErrors.events = 'Selecione pelo menos um evento válido';
          } else if (eventsList.length > 20) {
            newErrors.events = 'Muitos eventos selecionados. Considere usar "Todos os Eventos" ou reduza a seleção';
          } else {
            delete newErrors.events;
          }
        } else {
          delete newErrors.events;
        }
        break;
    }
    
    setErrors(newErrors);
  };

  // Função para validar formulário completo
  const validateForm = (): boolean => {
    // Usar a validação individual para cada campo para manter consistência
    validateField('name', formData.name);
    validateField('webhook', formData.webhook);
    validateField('events', formData.events);
    
    // Marcar todos os campos como tocados
    setTouched({
      name: true,
      webhook: true,
      events: true
    });
    
    // Aguardar um tick para que os erros sejam atualizados
    setTimeout(() => {
      const currentErrors = Object.keys(errors);
      if (currentErrors.length > 0) {
        // Focar no primeiro campo com erro
        const firstErrorField = currentErrors[0];
        const fieldElement = document.getElementById(`edit-${firstErrorField}`);
        if (fieldElement) {
          fieldElement.focus();
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
    
    return Object.keys(errors).length === 0;
  };

  // Função para validar URL
  const isValidUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url.trim());
      
      // Verificar se o protocolo é válido
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // Verificar se tem hostname
      if (!urlObj.hostname) {
        return false;
      }
      
      // Verificar se não é apenas o protocolo
      if (urlObj.href === `${urlObj.protocol}//`) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  };

  // Função para lidar com blur (quando sai do campo)
  const handleBlur = (field: keyof EditUserFormData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  // Função para lidar com submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit();
    }
  };

  // Função para toggle de eventos
  const toggleEvent = (eventValue: string) => {
    if (eventValue === 'All') {
      // Se selecionou "All", limpar outros eventos
      updateFormData('events', formData.events === 'All' ? '' : 'All');
    } else {
      const currentEvents = formData.events === 'All' ? [] : 
        formData.events.split(',').map(e => e.trim()).filter(e => e);
      
      const newEvents = currentEvents.includes(eventValue)
        ? currentEvents.filter(e => e !== eventValue)
        : [...currentEvents, eventValue];
      
      updateFormData('events', newEvents.join(', '));
    }
  };

  // Verificar se um evento está selecionado
  const isEventSelected = (eventValue: string): boolean => {
    if (formData.events === 'All') return eventValue === 'All';
    const currentEvents = formData.events.split(',').map(e => e.trim());
    return currentEvents.includes(eventValue);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Card de Informações Básicas - Modernizado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <User className="h-5 w-5 mr-2 text-primary" />
            Informações Básicas
          </CardTitle>
          <CardDescription>
            Dados principais do usuário e informações do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header com Avatar, Info Principal e Ações */}
          <div className="flex flex-col lg:flex-row gap-6 p-4 bg-muted/30 rounded-lg border">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                {avatarUrl ? (
                  <AvatarImage 
                    src={avatarUrl} 
                    alt={user.name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className={`text-2xl ${user.loggedIn ? 'bg-green-100 text-green-700' : 'bg-muted'}`}>
                  {avatarLoading ? (
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <User className="h-8 w-8" />
                  )}
                </AvatarFallback>
              </Avatar>
              {user.loggedIn && !avatarUrl && !avatarLoading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void fetchAvatar();
                  }}
                  className="text-xs"
                >
                  <ImageIcon className="h-3 w-3 mr-1" />
                  Carregar foto
                </Button>
              )}
            </div>

            {/* Info Principal */}
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">{user.name}</h3>
                {user.loggedIn ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <Wifi className="h-3 w-3 mr-1" />
                    Logado
                  </Badge>
                ) : user.connected ? (
                  <Badge variant="secondary">
                    <Wifi className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline
                  </Badge>
                )}
              </div>
              
              {/* ID do Usuário */}
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <code className="bg-muted px-2 py-1 rounded font-mono text-xs truncate max-w-[200px]">{user.id}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { void handleCopy(user.id, 'ID'); }}
                >
                  {copiedField === 'ID' ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {/* Telefone/JID */}
              {user.jid && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{user.jid.split(':')[0]}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => { void handleCopy(user.jid, 'JID'); }}
                  >
                    {copiedField === 'JID' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {user.loggedIn 
                  ? 'Conectado e autenticado no WhatsApp. Pronto para enviar/receber mensagens.'
                  : user.connected 
                  ? 'Conectado mas não autenticado. É necessário escanear o QR Code.'
                  : 'Não conectado ao WhatsApp. Gere um novo QR Code para conectar.'
                }
              </p>
            </div>

            {/* Ações Rápidas - Lado Direito */}
            {(onGenerateQR || onDeleteFromDB || onDeleteFull) && (
              <div className="flex flex-col gap-2 lg:border-l lg:pl-6 lg:ml-auto">
                <span className="text-xs font-medium text-muted-foreground mb-1">Ações Rápidas</span>
                {onGenerateQR && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onGenerateQR}
                    className="justify-start text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Gerar QR Code
                  </Button>
                )}
                {onDeleteFromDB && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onDeleteFromDB}
                    className="justify-start text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover do DB
                  </Button>
                )}
                {onDeleteFull && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onDeleteFull}
                    className="justify-start text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover Completo
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Campos Editáveis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome (editável) */}
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium text-foreground">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                className={`h-10 ${errors.name ? 'border-destructive focus:border-destructive' : ''}`}
                disabled={loading}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="text-xs text-destructive flex items-center mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Token (readonly com botão de copiar) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center">
                <Key className="h-4 w-4 mr-2" />
                Token
              </Label>
              <div className="flex gap-2">
                <Input
                  value={user.token}
                  readOnly
                  className="h-10 bg-muted text-muted-foreground font-mono text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                  onClick={() => { void handleCopy(user.token, 'Token'); }}
                >
                  {copiedField === 'Token' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Token de autenticação (somente leitura)</p>
            </div>

            {/* JID Completo (readonly) */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                JID WhatsApp Completo
              </Label>
              <div className="flex gap-2">
                <Input
                  value={user.jid || 'Não conectado'}
                  readOnly
                  className="h-10 bg-muted text-muted-foreground font-mono text-sm flex-1"
                />
                {user.jid && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 flex-shrink-0"
                    onClick={() => { void handleCopy(user.jid, 'JID Completo'); }}
                  >
                    {copiedField === 'JID Completo' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Conta Supabase */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-foreground">
              <Globe className="h-5 w-5 mr-2 text-primary" />
              Conta Supabase (Auth/DB)
            </CardTitle>
            {supabaseUser ? (
              <Badge variant="default" className="bg-green-600">Vinculado</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Não vinculado</Badge>
            )}
          </div>
          <CardDescription>
            Gerencie o usuário correspondente no banco de dados e autenticação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {supabaseUser ? (
            <div className="space-y-4">
               {/* Detalhes do Usuário Vinculado */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                <div>
                  <p className="text-xs text-muted-foreground">ID Supabase</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono truncate max-w-[200px]">{supabaseUser.id}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => { void handleCopy(supabaseUser.id, 'Supabase ID'); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-sm">{supabaseUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-sm">{formatDate(supabaseUser.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Último Login</p>
                  <p className="text-sm">{supabaseUser.last_sign_in_at ? formatDate(supabaseUser.last_sign_in_at) : 'Nunca'}</p>
                </div>
              </div>

              {/* Botões de Ação para Usuário Vinculado */}
              <div className="flex flex-wrap gap-2">
                {!showUpdateUser && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setShowUpdateUser(true); }}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Alterar Credenciais
                  </Button>
                )}
                {onUnlinkSupabaseUser && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    void onUnlinkSupabaseUser?.();
                  }}
                  >
                    Desvincular
                  </Button>
                )}
              </div>

              {/* Formulário de Atualização */}
              {showUpdateUser && (
                <div className="p-4 border rounded-lg bg-background space-y-4 mt-2">
                  <h4 className="text-sm font-medium">Atualizar Credenciais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="update-email">Novo Email</Label>
                      <Input 
                        id="update-email" 
                        type="email" 
                        placeholder="Deixe em branco para manter"
                        value={updateEmail}
                        onChange={(e) => setUpdateEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="update-password">Nova Senha</Label>
                      <Input 
                        id="update-password" 
                        type="password" 
                        placeholder="Deixe em branco para manter"
                        value={updatePassword}
                        onChange={(e) => setUpdatePassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        setShowUpdateUser(false);
                        setUpdateEmail('');
                        setUpdatePassword('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => { void handleUpdateSupabaseUser(); }}
                      disabled={supabaseLoading || (!updateEmail && !updatePassword)}
                    >
                      {supabaseLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar Alterações
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg text-center space-y-2">
                <Globe className="h-8 w-8 text-muted-foreground mb-2" />
                <h3 className="font-medium text-lg">Nenhuma conta vinculada</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Vincule este usuário WuzAPI a uma conta Supabase para permitir login na plataforma e gerenciamento de plano.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => { setShowLinkUser(true); }}>
                    Vincular Existente
                  </Button>
                  <Button type="button" onClick={() => { setShowCreateUser(true); }}>
                    Criar Nova Conta
                  </Button>
                </div>
              </div>

              {/* Formulário de Vinculação */}
              {showLinkUser && (
                 <div className="p-4 border rounded-lg bg-background space-y-4">
                   <h4 className="text-sm font-medium">Vincular Conta Existente</h4>
                   <div className="space-y-2">
                     <Label htmlFor="link-email">Email do Usuário Supabase</Label>
                     <Input 
                       id="link-email" 
                       type="email" 
                       placeholder="email@exemplo.com"
                       value={linkEmail}
                       onChange={(e) => setLinkEmail(e.target.value)}
                     />
                     <p className="text-xs text-muted-foreground">O sistema buscará o usuário pelo email.</p>
                   </div>
                   <div className="flex justify-end gap-2">
                     <Button type="button" variant="ghost" onClick={() => setShowLinkUser(false)}>Cancelar</Button>
                     <Button 
                       type="button"                        onClick={() => { void handleLinkSupabaseUser(); }}
                       disabled={supabaseLoading || !linkEmail}
                     >
                       {supabaseLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                       Vincular
                     </Button>
                   </div>
                 </div>
              )}

              {/* Formulário de Criação */}
              {showCreateUser && (
                 <div className="p-4 border rounded-lg bg-background space-y-4">
                   <h4 className="text-sm font-medium">Criar Nova Conta Supabase</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="new-email">Email</Label>
                       <Input 
                         id="new-email" 
                         type="email" 
                         value={newUserEmail}
                         onChange={(e) => setNewUserEmail(e.target.value)}
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="new-password">Senha</Label>
                       <Input 
                         id="new-password" 
                         type="password" 
                         value={newUserPassword}
                         onChange={(e) => setNewUserPassword(e.target.value)}
                       />
                     </div>
                   </div>
                   <div className="flex justify-end gap-2">
                     <Button type="button" variant="ghost" onClick={() => setShowCreateUser(false)}>Cancelar</Button>
                     <Button 
                       type="button"                        onClick={() => { void handleCreateSupabaseUser(); }}
                       disabled={supabaseLoading || !newUserEmail || !newUserPassword}
                     >
                       {supabaseLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                       Criar e Vincular
                     </Button>
                   </div>
                 </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card de Configurações de Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <Globe className="h-5 w-5 mr-2 text-primary" />
            Configurações de Webhook
          </CardTitle>
          <CardDescription>
            Configure a URL do webhook e os eventos que serão enviados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-webhook" className="text-sm font-medium text-foreground">
              URL do Webhook
            </Label>
            <Input
              id="edit-webhook"
              value={formData.webhook}
              onChange={(e) => updateFormData('webhook', e.target.value)}
              onBlur={() => handleBlur('webhook')}
              placeholder="https://example.com/webhook"
              className={`h-10 ${errors.webhook ? 'border-destructive focus:border-destructive' : ''}`}
              disabled={loading}
              aria-invalid={!!errors.webhook}
              aria-describedby={errors.webhook ? 'webhook-error' : undefined}
            />
            {errors.webhook && (
              <p id="webhook-error" className="text-xs text-destructive flex items-center mt-1">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errors.webhook}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              URL onde os eventos serão enviados via POST
            </p>
          </div>

          <Separator />

          {/* Eventos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                Eventos do Webhook
              </Label>
              <div className="flex items-center space-x-2">
                {formData.events === 'All' ? (
                  <Badge variant="default" className="text-xs">
                    Todos os eventos ({availableEvents.length})
                  </Badge>
                ) : formData.events ? (
                  <Badge variant="secondary" className="text-xs">
                    {formData.events.split(',').filter(e => e.trim()).length} eventos selecionados
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive">
                    Nenhum evento selecionado
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Descrição dos eventos */}
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p className="font-medium mb-1">ℹ️ Sobre os eventos:</p>
              <p>
                {formData.events === 'All' 
                  ? 'Todos os eventos disponíveis serão enviados para o webhook. Isso inclui mensagens, chamadas, mudanças de status e muito mais.'
                  : formData.events && formData.events.split(',').filter(e => e.trim()).length > 0
                  ? 'Apenas os eventos selecionados serão enviados para o webhook. Você pode adicionar ou remover eventos a qualquer momento.'
                  : 'Selecione pelo menos um evento para que o webhook funcione corretamente. Recomendamos começar com "Message" para mensagens básicas.'
                }
              </p>
            </div>

            <div className={`border rounded-md p-4 space-y-4 bg-background max-h-80 overflow-y-auto ${
              errors.events ? 'border-destructive' : 'border-border'
            }`}>
              {/* Opção "All Events" */}
              <div className="flex items-center space-x-2 p-2 bg-primary/5 rounded border border-primary/20">
                <input
                  type="checkbox"
                  id="event-all"
                  checked={isEventSelected('All')}
                  onChange={() => toggleEvent('All')}
                  disabled={loading}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label 
                  htmlFor="event-all"
                  className="text-sm font-medium cursor-pointer text-primary flex-1"
                >
                  All Events (Todos os Eventos)
                </Label>
              </div>

              {/* Eventos individuais */}
              {formData.events !== 'All' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {availableEvents.map((event) => (
                    <div key={event.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`event-${event.value}`}
                        checked={isEventSelected(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        disabled={loading}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <Label 
                        htmlFor={`event-${event.value}`}
                        className="text-xs cursor-pointer flex-1"
                        title={`Categoria: ${event.category}`}
                      >
                        {event.label}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {errors.events && (
              <p className="text-xs text-destructive flex items-center mt-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errors.events}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <Card>
        <CardContent className="pt-6">
          {/* Indicadores de estado */}
          {loading && (
            <div className="flex items-center justify-center mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="h-4 w-4 text-blue-600 mr-2 animate-spin" />
              <span className="text-sm text-blue-800">
                Salvando alterações... Por favor, aguarde.
              </span>
            </div>
          )}
          
          {hasChanges && !loading && (
            <div className="flex items-center justify-center mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 mr-2" />
              <div className="flex-1">
                <span className="text-sm text-amber-800 font-medium">
                  Você tem alterações não salvas
                </span>
                <p className="text-xs text-amber-700 mt-1">
                  Lembre-se de salvar suas alterações antes de sair da página.
                </p>
              </div>
            </div>
          )}

          {!hasChanges && !loading && Object.keys(errors).length === 0 && (
            <div className="flex items-center justify-center mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="h-4 w-4 text-green-600 mr-2">✓</div>
              <span className="text-sm text-green-800">
                Todas as alterações foram salvas
              </span>
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="flex items-center justify-center mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <div className="flex-1">
                <span className="text-sm text-red-800 font-medium">
                  Corrija os erros antes de salvar
                </span>
                <p className="text-xs text-red-700 mt-1">
                  {Object.keys(errors).length} campo(s) com erro: {Object.keys(errors).join(', ')}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="min-w-[120px]"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !hasChanges || Object.keys(errors).length > 0}
              className={`min-w-[120px] ${
                hasChanges && !loading && Object.keys(errors).length === 0
                  ? 'bg-primary hover:bg-primary/90' 
                  : ''
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : Object.keys(errors).length > 0 ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Corrigir Erros
                </>
              ) : hasChanges ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sem Alterações
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

export default UserEditForm;