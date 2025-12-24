import { useNavigate } from 'react-router-dom';
import { useBrandingConfig } from '@/hooks/useBranding';
import { navigationPaths } from '@/lib/utils';
import { Breadcrumb, BreadcrumbContainer, useBreadcrumb } from '@/components/ui/breadcrumb';
import { PageHeader } from '@/components/ui/page-header';
import { ArrowLeft, User, Settings, Plus } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import CreateUserForm from '@/components/shared/forms/CreateUserForm';

const CreateUserPage = () => {
  const navigate = useNavigate();
  const brandingConfig = useBrandingConfig();

  // Função para navegar de volta à lista
  const handleBackToList = () => {
    navigate(navigationPaths.admin.users);
  };

  // Função para lidar com sucesso na criação
  const handleSuccess = () => {
    // Navegar de volta à lista após criar o usuário
    navigate(navigationPaths.admin.users);
  };

  const { createBreadcrumb } = useBreadcrumb();

  // Criar breadcrumb items
  const breadcrumbItems = createBreadcrumb([
    { label: 'Admin', href: navigationPaths.admin.dashboard, icon: <Settings className="h-4 w-4" /> },
    { label: 'Usuários', href: navigationPaths.admin.users, icon: <User className="h-4 w-4" /> },
    { label: 'Criar Usuário' }
  ]);

  return (
    <ErrorBoundary>
      <div className="space-y-6 w-full max-w-6xl mx-auto">
        {/* Breadcrumb Navigation */}
        <BreadcrumbContainer>
          <Breadcrumb items={breadcrumbItems} />
        </BreadcrumbContainer>

        <div className="px-6">
          {/* Page Header */}
          <PageHeader
            title="Nova Caixa de Entrada"
            subtitle={`Adicionar caixa de entrada ao sistema ${brandingConfig.appName}`}
            description="Configure uma nova conexão WhatsApp com configurações avançadas de webhook, eventos e informações básicas."
            backButton={{
              label: 'Voltar à Lista',
              onClick: handleBackToList
            }}
          />

          {/* Formulário de criação */}
          <CreateUserForm onSuccess={handleSuccess} />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CreateUserPage;