import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { wuzapi, WuzAPIUser } from '@/services/wuzapi';
import { adminUsersService, SupabaseUser, CreateSupabaseUserDTO, UpdateSupabaseUserDTO } from '@/services/admin-users';
import { navigationPaths } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Breadcrumb, BreadcrumbContainer, useBreadcrumb } from '@/components/ui/breadcrumb';
import { ArrowLeft, User, AlertCircle, Loader2, RefreshCw, Settings } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import UserEditForm, { EditUserFormData } from '@/components/admin/UserEditForm';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const EditUserPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  
  const { createBreadcrumb } = useBreadcrumb();

  // Individual states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<WuzAPIUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<EditUserFormData>({
    name: '',
    webhook: '',
    events: ''
  });
  const [qrCodeData, setQrCodeData] = useState<{ qrcode: string; user: WuzAPIUser } | null>(null);

  const breadcrumbItems = user ? createBreadcrumb([
    { label: 'Admin', href: navigationPaths.admin.dashboard, icon: <Settings className="h-4 w-4" /> },
    { label: 'Usuários', href: navigationPaths.admin.users, icon: <User className="h-4 w-4" /> },
    { label: `Editar: ${user.name}` }
  ]) : [];

  // Função para carregar dados do usuário
  const loadUser = useCallback(async () => {
    if (!userId) {
      setError('ID do usuário não fornecido');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Buscar todos os usuários e encontrar o específico
      const users = await wuzapi.getUsers();
      const foundUser = users.find(u => u.id === userId);
      
      if (!foundUser) {
        setError('Usuário não encontrado');
        setLoading(false);
        toast.error('Usuário não encontrado');
        
        // Redirecionar para a lista após um breve delay
        setTimeout(() => {
          navigate(navigationPaths.admin.users);
        }, 2000);
        return;
      }
      
      setUser(foundUser);
      
      // Tentar buscar usuário Supabase correspondente pelo wuzapi_id nos metadados
      try {
        // Primeiro tenta encontrar pelo ID do WuzAPI (armazenado nos metadados)
        // Isso requer que a rota do backend suporte busca por metadados ou que a gente filtre
        // O backend foi atualizado para filtrar por user_metadata.wuzapi_id
        const usersById = await adminUsersService.listUsers(1, 100, foundUser.id);
        const matchById = usersById.find(su => su.user_metadata?.wuzapi_id === foundUser.id);
        
        if (matchById) {
          setSupabaseUser(matchById);
        } else if (foundUser.name && foundUser.name.includes('@')) {
          // Fallback: Tentar buscar usuário Supabase correspondente pelo email
          // Buscar usuários que correspondam ao email
          const supabaseUsers = await adminUsersService.listUsers(1, 10, foundUser.name);
          // Tentar match exato
          const match = supabaseUsers.find(su => su.email === foundUser.name);
          if (match) {
            // Se encontrou por email mas não tinha o ID vinculado, sugere vincular (opcional)
            // Ou vincula automaticamente se quisermos ser agressivos
            setSupabaseUser(match);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar usuário Supabase:', err);
        // Não bloquear o carregamento da página por erro aqui
      }

      // Inicializar dados do formulário com os dados do usuário
      const initialFormData: EditUserFormData = {
        name: foundUser.name,
        webhook: foundUser.webhook || '',
        events: foundUser.events || 'All'
      };
      
      setFormData(initialFormData);
      setLoading(false);
      
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      // ... erro handling code ...
      setLoading(false);
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
    setFormData(newFormData);
  }, []);

  // Função para verificar se houve mudanças
  const hasChanges = useCallback(() => {
    if (!user) return false;
    
    const originalData = {
      name: user.name,
      webhook: user.webhook || '',
      events: user.events || 'All'
    };
    
    return (
      formData.name !== originalData.name ||
      formData.webhook !== originalData.webhook ||
      formData.events !== originalData.events
    );
  }, [user, formData]);

  // Função auxiliar para validar URL
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Função para salvar alterações
  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!hasChanges()) {
       toast.info('Nenhuma alteração detectada');
       navigate(navigationPaths.admin.users);
       return;
    }
    
    try {
        setSaving(true);
        if (!formData.name.trim()) { toast.error('Nome é obrigatório'); return; }
        if (formData.webhook && !isValidUrl(formData.webhook)) { toast.error('Webhook inválido'); return; }
        
        const eventsArray = formData.events === 'All' ? ['All'] : formData.events.split(',').map(e => e.trim()).filter(e => e);
        if (eventsArray.length === 0) { toast.error('Selecione pelo menos um evento'); return; }

        // Buscar dados atualizados do usuário
        const currentUser = await wuzapi.getUser(user.id);

        await wuzapi.updateWebhook(currentUser.token, {
          webhook: formData.webhook,
          events: eventsArray,
          Active: true
        });
        
        toast.success('Usuário atualizado com sucesso!');
        setTimeout(() => navigate(navigationPaths.admin.users), 1000);
    } catch (error) {
        console.error(error);
        toast.error('Erro ao salvar alterações');
    } finally {
        setSaving(false);
    }
  }, [user, formData, navigate, hasChanges]);

  // Função para gerar QR Code
  const handleGenerateQR = useCallback(async () => {
      if (!user) return;
      const loadingToast = toast.loading('Gerando QR Code...');
      try {
          try { await wuzapi.connectSession(user.token); } catch (e) { console.log('Sessão existente ou erro:', e); }
          await new Promise(r => setTimeout(r, 1000));
          const qr = await wuzapi.getQRCode(user.token);
          setQrCodeData({ qrcode: qr.QRCode, user: user });
          toast.success('QR Code gerado!', { id: loadingToast });
      } catch (error) {
          console.error(error);
          toast.error('Erro ao gerar QR Code', { id: loadingToast });
      }
  }, [user]);

  // Função para deletar usuário
  const handleDeleteUser = useCallback(async (fullDelete = false) => {
      if (!user) return;
      const confirmDelete = await confirm({
          title: fullDelete ? 'Remover completamente?' : 'Remover do banco?',
          description: 'Esta ação não pode ser desfeita.',
          variant: 'destructive',
          confirmText: 'Sim, remover'
      });
      if (!confirmDelete) return;
      
      const loadingToast = toast.loading('Removendo usuário...');
      try {
          if (fullDelete) await wuzapi.deleteUserFull(user.id);
          else await wuzapi.deleteUser(user.id);
          toast.success('Usuário removido!', { id: loadingToast });
          setTimeout(() => navigate(navigationPaths.admin.users), 1500);
      } catch (error) {
          console.error(error);
          toast.error('Erro ao remover usuário', { id: loadingToast });
      }
  }, [user, confirm, navigate]);

  // Handlers para Supabase User
  const handleLinkSupabaseUser = async (email: string) => {
    try {
      const users = await adminUsersService.listUsers(1, 50, email);
      const match = users.find(u => u.email === email);
      
      if (match) {
        // PERSI TIR O VÍNCULO: Atualizar metadados do usuário Supabase
        await adminUsersService.updateUser(match.id, {
          user_metadata: {
            ...match.user_metadata,
            wuzapi_id: user?.id
          }
        });
        
        setSupabaseUser(match);
        toast.success('Usuário Supabase vinculado com sucesso!');
      } else {
        toast.error('Usuário não encontrado com este email no Supabase.');
      }
    } catch (error) {
      console.error('Erro ao vincular usuário Supabase:', error);
      toast.error('Erro ao vincular usuário Supabase', {
        description: (error as Error).message || 'Verifique o console para mais detalhes.'
      });
      throw error;
    }
  };

  const handleCreateSupabaseUser = async (data: CreateSupabaseUserDTO) => {
    try {
      const newUser = await adminUsersService.createUser({
        ...data,
        user_metadata: {
           ...data.user_metadata, 
           wuzapi_id: user?.id 
        }
      });
      setSupabaseUser(newUser);
      toast.success('Usuário Supabase criado e vinculado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar usuário Supabase:', error);
      toast.error('Erro ao criar usuário Supabase', {
        description: (error as Error).message || 'Verifique o console para mais detalhes.'
      });
      throw error;
    }
  };

  const handleUpdateSupabaseUser = async (data: UpdateSupabaseUserDTO) => {
    // ... (same as before) ...
    if (!supabaseUser) return;
    try {
      const updatedUser = await adminUsersService.updateUser(supabaseUser.id, data);
      setSupabaseUser(updatedUser);
      toast.success('Usuário Supabase atualizado com sucesso!');
    } catch (error) {
      // ... error handling
    }
  };

  const handleUnlinkSupabaseUser = async () => {
    if (!supabaseUser) return;
    
    try {
      // Remover o ID do WuzAPI dos metadados
      const metadata = { ...supabaseUser.user_metadata };
      delete metadata.wuzapi_id;
      
      await adminUsersService.updateUser(supabaseUser.id, {
        user_metadata: metadata
      });
      
      setSupabaseUser(null);
      toast.info('Usuário Supabase desvinculado.');
    } catch (error) {
      console.error('Erro ao desvincular usuário:', error);
      toast.error('Erro ao desvincular usuário');
    }
  };

  // ... (rest of the file)

  // Função para cancelar edição
  const handleCancel = useCallback(async () => {
    if (hasChanges()) {
      const confirmCancel = await confirm({
        title: 'Descartar alterações?',
        description: 'Você tem alterações não salvas. Tem certeza que deseja cancelar? Todas as alterações serão perdidas.',
        confirmText: 'Sim, descartar',
        cancelText: 'Continuar editando',
        variant: 'destructive'
      });
      
      if (!confirmCancel) return;
    }
    
    navigate(navigationPaths.admin.users);
  }, [navigate, hasChanges, confirm]);

  // Função para lidar com navegação do browser
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges()) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Tem certeza que deseja sair?';
        return e.returnValue;
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (hasChanges()) {
        const confirmLeave = window.confirm(
          'Você tem alterações não salvas. Tem certeza que deseja sair? Todas as alterações serão perdidas.'
        );
        
        if (!confirmLeave) {
          window.history.pushState(null, '', window.location.pathname);
          return;
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasChanges]);

  // Effect para carregar dados do usuário
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados do usuário...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Erro ao Carregar Usuário</CardTitle>
            <CardDescription>
              {error || 'Usuário não encontrado'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Button onClick={handleRetry} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button onClick={handleBackToList} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar à Lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // useBreadcrumb moved to top level


  return (
    <ErrorBoundary>
      <div className="space-y-6 w-full max-w-6xl mx-auto">
        <BreadcrumbContainer>
          <Breadcrumb items={breadcrumbItems} />
        </BreadcrumbContainer>

        <div className="px-6">
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

          <UserEditForm
            user={user}
            formData={formData}
            onFormChange={handleFormChange}
            onSubmit={handleSave}
            onCancel={handleCancel}
            loading={saving}
            hasChanges={hasChanges()}
            onGenerateQR={handleGenerateQR}
            onDeleteFromDB={() => handleDeleteUser(false)}
            onDeleteFull={() => handleDeleteUser(true)}
            supabaseUser={supabaseUser}
            onLinkSupabaseUser={handleLinkSupabaseUser}
            onCreateSupabaseUser={handleCreateSupabaseUser}
            onUpdateSupabaseUser={handleUpdateSupabaseUser}
            onUnlinkSupabaseUser={handleUnlinkSupabaseUser}
          />
        </div>
      </div>
      
      {qrCodeData && (
        <Dialog 
          open={!!qrCodeData} 
          onOpenChange={(open) => {
            if (!open) {
              setQrCodeData(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code - {qrCodeData.user.name}</DialogTitle>
              <DialogDescription>
                Escaneie este QR Code com o WhatsApp para conectar a instância
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4">
              {qrCodeData.qrcode ? (
                <img 
                  src={qrCodeData.qrcode.startsWith('data:') ? qrCodeData.qrcode : `data:image/png;base64,${qrCodeData.qrcode}`}
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

      <ConfirmDialog />
    </ErrorBoundary>
  );
};

export default EditUserPage;