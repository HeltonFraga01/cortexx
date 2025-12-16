import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WuzAPIService, WuzAPIUser } from '@/services/wuzapi';
import { navigationPaths } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Breadcrumb, BreadcrumbContainer, useBreadcrumb } from '@/components/ui/breadcrumb';
import { ArrowLeft, User, Wifi, WifiOff, AlertCircle, Loader2, RefreshCw, Settings } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import UserEditForm, { EditUserFormData } from '@/components/admin/UserEditForm';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// Interface já importada do UserEditForm

// Interface para o estado da página
interface EditUserPageState {
  user: WuzAPIUser | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  formData: EditUserFormData;
  qrCodeData: { qrcode: string; user: WuzAPIUser } | null;
}

const EditUserPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  
  // Estado da página usando a interface definida
  const [state, setState] = useState<EditUserPageState>({
    user: null,
    loading: true,
    saving: false,
    error: null,
    formData: {
      name: '',
      webhook: '',
      events: ''
    },
    qrCodeData: null
  });

  const wuzapi = new WuzAPIService();

  // Função para atualizar o estado de forma segura
  const updateState = (updates: Partial<EditUserPageState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Função para carregar dados do usuário (usando useCallback para otimização)
  const loadUser = useCallback(async () => {
    if (!userId) {
      updateState({ 
        error: 'ID do usuário não fornecido',
        loading: false 
      });
      return;
    }

    try {
      updateState({ 
        loading: true, 
        error: null 
      });
      
      // Buscar todos os usuários e encontrar o específico
      const users = await wuzapi.getUsers();
      const foundUser = users.find(u => u.id === userId);
      
      if (!foundUser) {
        updateState({ 
          error: 'Usuário não encontrado',
          loading: false 
        });
        toast.error('Usuário não encontrado');
        
        // Redirecionar para a lista após um breve delay
        setTimeout(() => {
          navigate(navigationPaths.admin.users);
        }, 2000);
        return;
      }
      
      // Inicializar dados do formulário com os dados do usuário
      const initialFormData: EditUserFormData = {
        name: foundUser.name,
        webhook: foundUser.webhook || '',
        events: foundUser.events || 'All'
      };
      
      updateState({
        user: foundUser,
        formData: initialFormData,
        loading: false
      });
      
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      
      let errorTitle = 'Erro ao carregar usuário';
      let errorDescription = 'Não foi possível carregar os dados do usuário. Tente novamente.';
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          errorTitle = 'Usuário não encontrado';
          errorDescription = 'O usuário solicitado não foi encontrado no sistema. Ele pode ter sido removido por outro administrador.';
        } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          errorTitle = 'Acesso negado';
          errorDescription = 'Você não tem permissão para visualizar este usuário. Verifique suas credenciais de administrador.';
        } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
          errorTitle = 'Acesso restrito';
          errorDescription = 'O acesso a este usuário é restrito para o seu nível de permissão.';
        } else if (errorMessage.includes('500') || errorMessage.includes('internal server')) {
          errorTitle = 'Erro interno do servidor';
          errorDescription = 'Ocorreu um erro interno no servidor. Nossa equipe foi notificada. Tente novamente em alguns minutos.';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          errorTitle = 'Problema de conexão';
          errorDescription = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.';
        } else if (errorMessage.includes('fetch')) {
          errorTitle = 'Falha na comunicação';
          errorDescription = 'Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.';
        }
      }
      
      updateState({
        error: errorDescription,
        loading: false
      });
      
      toast.error(errorTitle, {
        description: errorDescription,
        action: {
          label: 'Tentar novamente',
          onClick: () => loadUser()
        }
      });
    }
  }, [userId, navigate]);

  // Função para navegar de volta à lista
  const handleBackToList = useCallback(() => {
    navigate(navigationPaths.admin.users);
  }, [navigate]);

  // Função para retry do carregamento
  const handleRetry = useCallback(() => {
    loadUser();
  }, [loadUser]);

  // Função para lidar com mudanças no formulário
  const handleFormChange = useCallback((newFormData: EditUserFormData) => {
    updateState({ formData: newFormData });
  }, []);

  // Função para verificar se houve mudanças
  const hasChanges = useCallback(() => {
    if (!state.user) return false;
    
    const originalData = {
      name: state.user.name,
      webhook: state.user.webhook || '',
      events: state.user.events || 'All'
    };
    
    return (
      state.formData.name !== originalData.name ||
      state.formData.webhook !== originalData.webhook ||
      state.formData.events !== originalData.events
    );
  }, [state.user, state.formData]);

  // Função para salvar alterações
  const handleSave = useCallback(async () => {
    if (!state.user) {
      toast.error('Erro interno', {
        description: 'Dados do usuário não encontrados.'
      });
      return;
    }

    // Verificar se há mudanças
    if (!hasChanges()) {
      toast.info('Nenhuma alteração detectada', {
        description: 'Não há mudanças para salvar.'
      });
      navigate(navigationPaths.admin.users);
      return;
    }

    try {
      updateState({ saving: true });

      // Validar dados antes de salvar
      if (!state.formData.name.trim()) {
        toast.error('Nome é obrigatório', {
          description: 'Por favor, preencha o nome do usuário.'
        });
        return;
      }

      if (state.formData.webhook && !isValidUrl(state.formData.webhook)) {
        toast.error('URL do webhook inválida', {
          description: 'Por favor, verifique a URL do webhook.'
        });
        return;
      }

      // Converter eventos de string para array
      const eventsArray = state.formData.events === 'All' ? ['All'] : 
        state.formData.events.split(',').map(e => e.trim()).filter(e => e);

      if (eventsArray.length === 0) {
        toast.error('Selecione pelo menos um evento', {
          description: 'É necessário selecionar pelo menos um evento para o webhook.'
        });
        return;
      }

      // Buscar dados atualizados do usuário para garantir que temos o token correto
      let currentUser;
      try {
        currentUser = await wuzapi.getUser(state.user.id);
      } catch (error) {
        console.error('Erro ao buscar usuário atualizado:', error);
        // Se não conseguir buscar, usar os dados que temos
        currentUser = state.user;
      }

      // Preparar dados para atualização
      const updateData = {
        webhook: state.formData.webhook.trim(),
        events: eventsArray,
        Active: true
      };



      // Atualizar webhook e eventos via API
      await wuzapi.updateWebhook(currentUser.token, updateData);

      // Feedback de sucesso com detalhes
      const changesDescription = [];
      if (state.formData.name !== state.user.name) {
        changesDescription.push('nome');
      }
      if (state.formData.webhook !== (state.user.webhook || '')) {
        changesDescription.push('webhook');
      }
      if (state.formData.events !== (state.user.events || 'All')) {
        changesDescription.push('eventos');
      }

      toast.success('Configurações atualizadas com sucesso!', {
        description: `Alterações salvas: ${changesDescription.join(', ')}.`
      });

      // Navegar de volta à lista após um breve delay para mostrar o toast
      setTimeout(() => {
        navigate(navigationPaths.admin.users);
      }, 1000);

    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      
      // Tratamento de erros específicos com mensagens em português brasileiro
      let errorTitle = 'Erro ao salvar alterações';
      let errorDescription = 'Ocorreu um erro inesperado. Tente novamente em alguns instantes.';
      let shouldRetry = false;
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Tratar erros específicos da API
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          errorTitle = 'Usuário não encontrado';
          errorDescription = 'O usuário que você está tentando editar não foi encontrado no servidor. Ele pode ter sido removido por outro administrador.';
        } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          errorTitle = 'Acesso negado';
          errorDescription = 'Você não tem permissão para editar este usuário. Verifique suas credenciais de administrador.';
        } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
          errorTitle = 'Operação não permitida';
          errorDescription = 'Esta operação não é permitida para o seu nível de acesso. Entre em contato com o administrador do sistema.';
        } else if (errorMessage.includes('400') || errorMessage.includes('bad request')) {
          errorTitle = 'Dados inválidos';
          errorDescription = 'Os dados enviados são inválidos. Verifique se todos os campos estão preenchidos corretamente e tente novamente.';
        } else if (errorMessage.includes('422') || errorMessage.includes('unprocessable')) {
          errorTitle = 'Dados não processáveis';
          errorDescription = 'Os dados fornecidos não puderam ser processados. Verifique o formato da URL do webhook e os eventos selecionados.';
        } else if (errorMessage.includes('500') || errorMessage.includes('internal server')) {
          errorTitle = 'Erro interno do servidor';
          errorDescription = 'Ocorreu um erro interno no servidor. Nossa equipe foi notificada. Tente novamente em alguns minutos.';
          shouldRetry = true;
        } else if (errorMessage.includes('502') || errorMessage.includes('bad gateway')) {
          errorTitle = 'Servidor temporariamente indisponível';
          errorDescription = 'O servidor está temporariamente indisponível. Tente novamente em alguns instantes.';
          shouldRetry = true;
        } else if (errorMessage.includes('503') || errorMessage.includes('service unavailable')) {
          errorTitle = 'Serviço indisponível';
          errorDescription = 'O serviço está temporariamente indisponível para manutenção. Tente novamente em alguns minutos.';
          shouldRetry = true;
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          errorTitle = 'Problema de conexão';
          errorDescription = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.';
          shouldRetry = true;
        } else if (errorMessage.includes('fetch')) {
          errorTitle = 'Falha na comunicação';
          errorDescription = 'Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.';
          shouldRetry = true;
        } else if (errorMessage.includes('cors')) {
          errorTitle = 'Erro de configuração';
          errorDescription = 'Erro de configuração do servidor. Entre em contato com o suporte técnico.';
        } else if (errorMessage.includes('token')) {
          errorTitle = 'Sessão expirada';
          errorDescription = 'Sua sessão expirou. Faça login novamente para continuar.';
        }
      }
      
      // Mostrar toast de erro com opção de retry para alguns casos
      if (shouldRetry) {
        toast.error(errorTitle, {
          description: errorDescription,
          action: {
            label: 'Tentar novamente',
            onClick: () => handleSave()
          },
          duration: 8000
        });
      } else {
        toast.error(errorTitle, {
          description: errorDescription,
          duration: 6000
        });
      }
    } finally {
      updateState({ saving: false });
    }
  }, [state.user, state.formData, navigate, hasChanges]);

  // Função auxiliar para validar URL
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Função para gerar QR Code
  const handleGenerateQR = useCallback(async () => {
    if (!state.user) {
      toast.error('Erro interno', {
        description: 'Dados do usuário não estão disponíveis para gerar o QR Code.'
      });
      return;
    }

    // Mostrar toast de carregamento
    const loadingToast = toast.loading('Gerando QR Code...', {
      description: 'Conectando à sessão do WhatsApp e gerando o código QR.'
    });

    try {
      // Primeiro, tentar conectar a sessão
      try {
        await wuzapi.connectSession(state.user.token);
        toast.loading('Inicializando sessão...', {
          id: loadingToast,
          description: 'Aguarde enquanto a sessão é inicializada.'
        });
      } catch (error) {
        // Se a sessão já existe ou há outro erro, continuar
        console.log('Sessão já existe ou erro ao conectar:', error);
      }

      // Aguardar um pouco para a sessão inicializar
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Gerar QR Code
      const qrData = await wuzapi.getQRCode(state.user.token);
      
      if (!qrData || !qrData.QRCode) {
        throw new Error('QR Code não foi gerado pelo servidor');
      }

      updateState({ qrCodeData: { qrcode: qrData.QRCode, user: state.user } });
      
      // Sucesso
      toast.success('QR Code gerado com sucesso!', {
        id: loadingToast,
        description: 'Escaneie o código com seu WhatsApp para conectar a instância.'
      });

    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      
      let errorTitle = 'Erro ao gerar QR Code';
      let errorDescription = 'Não foi possível gerar o QR Code. Tente novamente.';
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          errorTitle = 'Token inválido';
          errorDescription = 'O token do usuário é inválido ou expirou. Verifique as configurações do usuário.';
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          errorTitle = 'Usuário não encontrado';
          errorDescription = 'O usuário não foi encontrado no servidor WhatsApp. Verifique se o usuário ainda existe.';
        } else if (errorMessage.includes('timeout')) {
          errorTitle = 'Tempo limite excedido';
          errorDescription = 'A operação demorou mais que o esperado. Verifique sua conexão e tente novamente.';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          errorTitle = 'Problema de conexão';
          errorDescription = 'Não foi possível conectar ao servidor WhatsApp. Verifique sua conexão com a internet.';
        } else if (errorMessage.includes('session')) {
          errorTitle = 'Erro na sessão';
          errorDescription = 'Não foi possível inicializar a sessão do WhatsApp. Tente novamente em alguns instantes.';
        }
      }
      
      toast.error(errorTitle, {
        id: loadingToast,
        description: errorDescription,
        action: {
          label: 'Tentar novamente',
          onClick: () => handleGenerateQR()
        }
      });
    }
  }, [state.user]);

  // Função para deletar usuário
  const handleDeleteUser = useCallback(async (fullDelete = false) => {
    if (!state.user) {
      toast.error('Erro interno', {
        description: 'Dados do usuário não estão disponíveis para remoção.'
      });
      return;
    }

    const operationType = fullDelete ? 'completa' : 'do banco de dados';
    const confirmDelete = await confirm({
      title: fullDelete ? 'Remover usuário completamente?' : 'Remover usuário do banco?',
      description: fullDelete 
        ? 'Esta ação removerá o usuário completamente do sistema, incluindo todas as sessões ativas e dados associados. Esta ação não pode ser desfeita.'
        : 'Esta ação removerá o usuário apenas do banco de dados, mantendo a sessão ativa no WhatsApp. Esta ação não pode ser desfeita.',
      confirmText: fullDelete ? 'Sim, remover completamente' : 'Sim, remover do DB',
      cancelText: 'Cancelar',
      variant: 'destructive'
    });

    if (!confirmDelete) return;

    // Mostrar toast de carregamento
    const loadingToast = toast.loading(`Removendo usuário...`, {
      description: `Executando remoção ${operationType}. Aguarde...`
    });

    try {
      if (fullDelete) {
        await wuzapi.deleteUserFull(state.user.id);
        toast.success('Usuário removido completamente!', {
          id: loadingToast,
          description: 'O usuário foi removido completamente do sistema, incluindo todas as sessões ativas.'
        });
      } else {
        await wuzapi.deleteUser(state.user.id);
        toast.success('Usuário removido do banco de dados!', {
          id: loadingToast,
          description: 'O usuário foi removido do banco de dados. A sessão do WhatsApp permanece ativa.'
        });
      }
      
      // Navegar de volta à lista após deletar
      setTimeout(() => {
        navigate(navigationPaths.admin.users);
      }, 1500);

    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      
      let errorTitle = 'Erro ao remover usuário';
      let errorDescription = `Não foi possível executar a remoção ${operationType}. Tente novamente.`;
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          errorTitle = 'Usuário não encontrado';
          errorDescription = 'O usuário não foi encontrado no servidor. Ele pode já ter sido removido por outro administrador.';
        } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          errorTitle = 'Acesso negado';
          errorDescription = 'Você não tem permissão para remover este usuário. Verifique suas credenciais de administrador.';
        } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
          errorTitle = 'Operação não permitida';
          errorDescription = 'Esta operação não é permitida para o seu nível de acesso. Entre em contato com o administrador do sistema.';
        } else if (errorMessage.includes('409') || errorMessage.includes('conflict')) {
          errorTitle = 'Conflito de operação';
          errorDescription = 'O usuário está sendo usado por outro processo. Tente novamente em alguns instantes.';
        } else if (errorMessage.includes('500') || errorMessage.includes('internal server')) {
          errorTitle = 'Erro interno do servidor';
          errorDescription = 'Ocorreu um erro interno no servidor. Nossa equipe foi notificada. Tente novamente em alguns minutos.';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          errorTitle = 'Problema de conexão';
          errorDescription = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.';
        }
      }
      
      toast.error(errorTitle, {
        id: loadingToast,
        description: errorDescription,
        action: {
          label: 'Tentar novamente',
          onClick: () => handleDeleteUser(fullDelete)
        }
      });
    }
  }, [state.user, confirm, navigate]);

  // Função para cancelar edição
  const handleCancel = useCallback(async () => {
    // Verificar se há mudanças não salvas
    if (hasChanges()) {
      // Mostrar confirmação antes de cancelar
      const confirmCancel = await confirm({
        title: 'Descartar alterações?',
        description: 'Você tem alterações não salvas. Tem certeza que deseja cancelar? Todas as alterações serão perdidas.',
        confirmText: 'Sim, descartar',
        cancelText: 'Continuar editando',
        variant: 'destructive'
      });
      
      if (!confirmCancel) {
        return; // Usuário escolheu não cancelar
      }
    }
    
    // Navegar de volta à lista
    navigate(navigationPaths.admin.users);
  }, [navigate, hasChanges, confirm]);

  // Função para lidar com navegação do browser (botão voltar)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges()) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Tem certeza que deseja sair?';
        return e.returnValue;
      }
    };

    const handlePopState = async (e: PopStateEvent) => {
      if (hasChanges()) {
        // Para navegação do browser, ainda usamos window.confirm por simplicidade
        // pois o diálogo customizado pode não aparecer a tempo
        const confirmLeave = window.confirm(
          'Você tem alterações não salvas. Tem certeza que deseja sair? Todas as alterações serão perdidas.'
        );
        
        if (!confirmLeave) {
          // Impedir a navegação
          window.history.pushState(null, '', window.location.pathname);
          return;
        }
      }
    };

    // Adicionar listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasChanges]);

  // Effect para carregar dados do usuário
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Renderização condicional baseada no estado
  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados do usuário...</p>
        </div>
      </div>
    );
  }

  if (state.error || !state.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Erro ao Carregar Usuário</CardTitle>
            <CardDescription>
              {state.error || 'Usuário não encontrado'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Button 
                onClick={handleRetry}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button 
                onClick={handleBackToList}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar à Lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user } = state;
  const { createBreadcrumb } = useBreadcrumb();

  // Criar breadcrumb items
  const breadcrumbItems = createBreadcrumb([
    { label: 'Admin', href: navigationPaths.admin.dashboard, icon: <Settings className="h-4 w-4" /> },
    { label: 'Usuários', href: navigationPaths.admin.users, icon: <User className="h-4 w-4" /> },
    { label: `Editar: ${user.name}` }
  ]);

  return (
    <ErrorBoundary>
      <div className="space-y-6 w-full max-w-6xl mx-auto">
        {/* Breadcrumb Navigation */}
        <BreadcrumbContainer>
          <Breadcrumb items={breadcrumbItems} />
        </BreadcrumbContainer>

        <div className="px-6">
          {/* Botão Voltar - Simplificado */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={handleBackToList}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar à Lista
            </Button>
          </div>

          {/* Formulário de edição */}
          <UserEditForm
            user={user}
            formData={state.formData}
            onFormChange={handleFormChange}
            onSubmit={handleSave}
            onCancel={handleCancel}
            loading={state.saving}
            hasChanges={hasChanges()}
            onGenerateQR={handleGenerateQR}
            onDeleteFromDB={() => handleDeleteUser(false)}
            onDeleteFull={() => handleDeleteUser(true)}
          />
        </div>
      </div>
      
      {/* QR Code Modal */}
      {state.qrCodeData && (
        <Dialog 
          open={!!state.qrCodeData} 
          onOpenChange={(open) => {
            if (!open) {
              updateState({ qrCodeData: null });
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code - {state.qrCodeData.user.name}</DialogTitle>
              <DialogDescription>
                Escaneie este QR Code com o WhatsApp para conectar a instância
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4">
              {state.qrCodeData.qrcode ? (
                <img 
                  src={state.qrCodeData.qrcode.startsWith('data:') ? state.qrCodeData.qrcode : `data:image/png;base64,${state.qrCodeData.qrcode}`}
                  alt="QR Code"
                  className="max-w-full h-auto"
                />
              ) : (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p>Gerando QR Code...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo de confirmação */}
      <ConfirmDialog />
    </ErrorBoundary>
  );
};

export default EditUserPage;