import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CardHeaderWithIcon, EmptyState, LoadingSkeleton } from '@/components/ui-custom';
import { MessageVariationEditor } from './MessageVariationEditor';
import { VariationPreviewPanel } from './VariationPreviewPanel';

import { useAuth } from '@/contexts/AuthContext';
import { 
  Send, 
  MessageSquare, 
  Phone, 
  Clock, 
  Check, 
  CheckCheck, 
  Eye, 
  Image as ImageIcon,
  Trash2,
  Edit,
  Plus,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  validatePhoneFormat, 
  normalizePhoneNumber, 
  formatPhoneDisplay,
  suggestPhoneFormat 
} from '@/lib/phone-utils';
import { backendApi } from '@/services/api-client';

interface Message {
  id: string;
  phone: string;
  message: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  type: string;
}

interface Template {
  id: number;
  name: string;
  content: string;
  hasVariations?: boolean;
  created_at: string;
  updated_at: string;
}

const UserMessages = () => {
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuggestion, setPhoneSuggestion] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const messagesPerPage = 20;
  
  // Template form states
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  
  const { user } = useAuth();

  // Validação de telefone em tempo real
  const validatePhone = useCallback((value: string) => {
    if (!value.trim()) {
      setPhoneError(null);
      setPhoneSuggestion(null);
      return;
    }

    const validation = validatePhoneFormat(value);
    
    if (!validation.isValid) {
      setPhoneError(validation.error || 'Número inválido');
      setPhoneSuggestion(null);
    } else {
      setPhoneError(null);
      // Sugerir formato correto se diferente
      const suggestion = suggestPhoneFormat(value);
      setPhoneSuggestion(suggestion);
    }
  }, []);

  // Handler para mudança de telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
    validatePhone(value);
  };

  // Aplicar sugestão de formato
  const applySuggestion = () => {
    if (phoneSuggestion) {
      const normalized = normalizePhoneNumber(phone);
      setPhone(normalized);
      setPhoneSuggestion(null);
      setPhoneError(null);
    }
  };

  const fetchMessages = async (page = 1) => {
    if (!user?.token) return;
    
    try {
      setLoading(true);
      const offset = (page - 1) * messagesPerPage;
      const response = await fetch(`/api/user/messages?limit=${messagesPerPage}&offset=${offset}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setMessages(data.data.messages || []);
          setTotalMessages(data.data.total || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!user?.token) return;
    
    try {
      setLoadingTemplates(true);
      const response = await fetch('/api/user/templates', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTemplates(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchMessages(currentPage);
  }, [user?.token, currentPage]);

  useEffect(() => {
    fetchTemplates();
  }, [user?.token]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione apenas arquivos de imagem');
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setCaption('');
  };

  const handleSendMessage = async () => {
    if (!user?.token || !phone) {
      toast.error('Preencha o número do telefone');
      return;
    }

    if (!message && !imageFile) {
      toast.error('Digite uma mensagem ou selecione uma imagem');
      return;
    }

    // Validar formato do número antes de enviar
    const validation = validatePhoneFormat(phone);
    if (!validation.isValid) {
      toast.error(validation.error || 'Número de telefone inválido');
      return;
    }

    // Normalizar o número para o formato correto (55DDNNNNNNNNN)
    const normalizedPhone = validation.normalized || normalizePhoneNumber(phone);

    setSending(true);
    try {
      if (imageFile) {
        // Enviar imagem usando backendApi (gerencia CSRF automaticamente)
        const response = await backendApi.post('/chat/send/image', {
          Phone: normalizedPhone,
          Image: imagePreview,
          Caption: caption || message
        });

        if (response.success) {
          toast.success('Imagem enviada com sucesso!');
          clearImage();
          setMessage('');
          setCaption('');
          setPhone('');
          setPhoneError(null);
          setPhoneSuggestion(null);
        } else {
          toast.error(response.error || 'Erro ao enviar imagem');
        }
      } else {
        // Enviar texto usando backendApi (gerencia CSRF automaticamente)
        const response = await backendApi.post('/chat/send/text', {
          Phone: normalizedPhone,
          Body: message
        });

        if (response.success) {
          toast.success('Mensagem enviada com sucesso!');
          setMessage('');
          setPhone('');
          setPhoneError(null);
          setPhoneSuggestion(null);
        } else {
          toast.error(response.error || 'Erro ao enviar mensagem');
        }
      }
      
      // Atualizar histórico
      fetchMessages(currentPage);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessages = async () => {
    if (!user?.token) return;
    
    if (selectedMessages.length === 0) {
      toast.error('Selecione mensagens para deletar');
      return;
    }

    try {
      const response = await fetch('/api/user/messages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          messageIds: selectedMessages.map(id => parseInt(id))
        })
      });

      if (response.ok) {
        toast.success('Mensagens deletadas com sucesso!');
        setSelectedMessages([]);
        fetchMessages(currentPage);
      } else {
        toast.error('Erro ao deletar mensagens');
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('Erro ao deletar mensagens');
    }
  };

  const handleDeleteAllMessages = async () => {
    if (!user?.token) return;
    
    if (!confirm('Tem certeza que deseja deletar TODAS as mensagens do histórico?')) {
      return;
    }

    try {
      const response = await fetch('/api/user/messages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({})
      });

      if (response.ok) {
        toast.success('Histórico limpo com sucesso!');
        setSelectedMessages([]);
        fetchMessages(1);
        setCurrentPage(1);
      } else {
        toast.error('Erro ao limpar histórico');
      }
    } catch (error) {
      console.error('Error deleting all messages:', error);
      toast.error('Erro ao limpar histórico');
    }
  };

  const handleSaveTemplate = async () => {
    if (!user?.token || !templateName || !templateContent) {
      toast.error('Preencha nome e conteúdo do template');
      return;
    }

    try {
      const url = editingTemplate 
        ? `/api/user/templates/${editingTemplate.id}`
        : '/api/user/templates';
      
      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: templateName,
          content: templateContent
        })
      });

      if (response.ok) {
        toast.success(editingTemplate ? 'Template atualizado!' : 'Template criado!');
        await fetchTemplates();
        cancelTemplateForm();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao salvar template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    }
  };

  const cancelTemplateForm = () => {
    setShowTemplateForm(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateContent('');
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!user?.token) return;
    
    if (!confirm('Tem certeza que deseja deletar este template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Template deletado!');
        await fetchTemplates();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao deletar template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Erro ao deletar template');
    }
  };

  const openEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateContent(template.content);
    setShowTemplateForm(true);
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateContent('');
    setShowTemplateForm(true);
  };

  const useTemplate = (content: string) => {
    setMessage(content);
    toast.success('Template aplicado!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'read':
        return <Eye className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'text-gray-500';
      case 'delivered':
        return 'text-blue-500';
      case 'read':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const totalPages = Math.ceil(totalMessages / messagesPerPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mensagens</h1>
        <p className="text-muted-foreground">
          Envie mensagens e imagens via WhatsApp
        </p>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send">Enviar</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* Tab: Enviar Mensagem */}
        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeaderWithIcon
              icon={MessageSquare}
              iconColor="text-green-500"
              title="Enviar Mensagem"
            >
              <p className="text-sm text-muted-foreground">Envie mensagens de texto ou imagens para qualquer número</p>
            </CardHeaderWithIcon>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Número do Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="5521999999999"
                    className={`pl-8 ${phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {phoneError}
                  </p>
                )}
                {phoneSuggestion && !phoneError && (
                  <p className="text-xs text-blue-500 flex items-center gap-1">
                    Formato sugerido: {phoneSuggestion}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-500 underline"
                      onClick={applySuggestion}
                    >
                      Aplicar
                    </Button>
                  </p>
                )}
                {!phoneError && !phoneSuggestion && (
                  <p className="text-xs text-muted-foreground">
                    Digite o número com código do país, sem o sinal de +
                  </p>
                )}
              </div>

              {imagePreview ? (
                <div className="space-y-2">
                  <Label>Imagem Selecionada</Label>
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-64 rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={clearImage}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caption">Legenda (opcional)</Label>
                    <Textarea
                      id="caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Digite uma legenda para a imagem..."
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <MessageVariationEditor
                    value={message}
                    onChange={setMessage}
                    label="Mensagem"
                    placeholder="Digite sua mensagem... Use | para criar variações: Olá|Oi|E aí"
                    showCombinations={true}
                    userToken={user?.token}
                  />

                  <VariationPreviewPanel
                    template={message}
                    variables={{}}
                    count={3}
                    userToken={user?.token}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="image">Ou envie uma imagem</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="flex-1"
                      />
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: JPG, PNG, GIF (máx. 5MB)
                    </p>
                  </div>
                </>
              )}

              <Button 
                onClick={handleSendMessage} 
                disabled={sending || !phone || (!message && !imageFile) || !!phoneError}
                className="w-full"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : imageFile ? (
                  <ImageIcon className="h-4 w-4 mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {imageFile ? 'Enviar Imagem' : 'Enviar Mensagem'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Templates */}
        <TabsContent value="templates" className="space-y-4">
          {/* Formulário de Template */}
          {showTemplateForm && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{editingTemplate ? 'Editar Template' : 'Novo Template'}</span>
                  <Button variant="ghost" size="sm" onClick={cancelTemplateForm}>
                    ✕
                  </Button>
                </CardTitle>
                <CardDescription>
                  {editingTemplate 
                    ? 'Atualize o nome e conteúdo do template' 
                    : 'Crie um novo template para reutilizar mensagens'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Nome do Template</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: Saudação, Confirmação, etc."
                  />
                </div>
                <MessageVariationEditor
                  value={templateContent}
                  onChange={setTemplateContent}
                  label="Conteúdo"
                  placeholder="Digite o conteúdo do template... Use | para criar variações"
                  showCombinations={true}
                  userToken={user?.token}
                />
                
                <VariationPreviewPanel
                  template={templateContent}
                  variables={{}}
                  count={3}
                  userToken={user?.token}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={cancelTemplateForm}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTemplate}>
                    {editingTemplate ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Templates */}
          <Card>
            <CardHeaderWithIcon
              icon={FileText}
              iconColor="text-purple-500"
              title="Templates de Mensagem"
              action={!showTemplateForm ? {
                label: "Novo Template",
                onClick: openNewTemplate
              } : undefined}
            >
              <p className="text-sm text-muted-foreground">Crie e gerencie templates reutilizáveis</p>
            </CardHeaderWithIcon>
            <CardContent>
              {loadingTemplates ? (
                <LoadingSkeleton variant="card" count={2} />
              ) : templates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {templates.map((template) => {
                    return (
                      <div 
                        key={template.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{template.name}</h4>
                            {template.hasVariations && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Variações
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {template.content}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => useTemplate(template.content)}
                        >
                          Usar Template
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Nenhum template criado ainda"
                  description="Crie seu primeiro template para agilizar o envio de mensagens"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeaderWithIcon
              icon={Clock}
              iconColor="text-orange-500"
              title="Histórico de Mensagens"
            >
              <p className="text-sm text-muted-foreground">{totalMessages} mensagem(ns) enviada(s)</p>
            </CardHeaderWithIcon>
            <CardHeader className="pt-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-col gap-2 sm:flex-row">
                  {selectedMessages.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteMessages}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Deletar Selecionadas ({selectedMessages.length})</span>
                      <span className="sm:hidden">Deletar ({selectedMessages.length})</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteAllMessages}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar Tudo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingSkeleton variant="list" count={5} />
              ) : messages.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedMessages.includes(msg.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMessages([...selectedMessages, msg.id]);
                              } else {
                                setSelectedMessages(selectedMessages.filter(id => id !== msg.id));
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-sm">{msg.phone}</span>
                                <Badge variant="outline" className={getStatusColor(msg.status)}>
                                  <span className="flex items-center space-x-1">
                                    {getStatusIcon(msg.status)}
                                    <span className="capitalize text-xs">{msg.status}</span>
                                  </span>
                                </Badge>
                                {msg.type === 'image' && (
                                  <Badge variant="secondary">
                                    <ImageIcon className="h-3 w-3 mr-1" />
                                    Imagem
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(msg.timestamp).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-sm bg-muted/50 p-2 rounded">{msg.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="Nenhuma mensagem enviada ainda"
                  description="Envie sua primeira mensagem usando a aba 'Enviar'"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserMessages;
