import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { 
  // Add your icons here
  User,
  Save,
  RefreshCw,
  Settings,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// TODO: Replace with your actual data types
interface UserDataType {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'inactive';
  lastActivity: string;
  // Add your specific fields here
}

interface UserSettings {
  notifications: boolean;
  autoSync: boolean;
  theme: 'light' | 'dark' | 'system';
  // Add your specific settings here
}

// TODO: Replace with your actual API service
interface UserApiService {
  getUserData(): Promise<UserDataType>;
  updateUserData(data: Partial<UserDataType>): Promise<UserDataType>;
  getUserSettings(): Promise<UserSettings>;
  updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings>;
  getUserActivity(): Promise<any[]>;
}

const UserPageTemplate = () => {
  // Auth context
  const { user } = useAuth();

  // State management
  const [userData, setUserData] = useState<UserDataType | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'activity'>('overview');

  // Form states
  const [formData, setFormData] = useState<Partial<UserDataType>>({});
  const [settingsData, setSettingsData] = useState<Partial<UserSettings>>({});

  // TODO: Initialize your API service
  // const apiService = new UserApiService();

  // Data fetching
  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with your actual API calls
      // const [userInfo, settings, userActivity] = await Promise.all([
      //   apiService.getUserData(),
      //   apiService.getUserSettings(),
      //   apiService.getUserActivity()
      // ]);
      
      // Mock data for template - remove this
      const userInfo: UserDataType = {
        id: user?.id || '1',
        name: user?.name || 'Usuário Exemplo',
        status: 'active',
        lastActivity: new Date().toISOString()
      };
      
      const settings: UserSettings = {
        notifications: true,
        autoSync: false,
        theme: 'system'
      };
      
      const userActivity = [
        {
          id: '1',
          action: 'Login realizado',
          timestamp: new Date().toISOString(),
          type: 'auth'
        },
        {
          id: '2',
          action: 'Configurações atualizadas',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          type: 'settings'
        }
      ];

      setUserData(userInfo);
      setUserSettings(settings);
      setActivity(userActivity);
      setFormData(userInfo);
      setSettingsData(settings);
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  };

  // Save operations
  const handleSaveProfile = async () => {
    if (!userData) return;
    
    try {
      setSaving(true);
      
      // TODO: Replace with your actual API call
      // const updatedUser = await apiService.updateUserData(formData);
      // setUserData(updatedUser);
      
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!userSettings) return;
    
    try {
      setSaving(true);
      
      // TODO: Replace with your actual API call
      // const updatedSettings = await apiService.updateUserSettings(settingsData);
      // setUserSettings(updatedSettings);
      
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchUserData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">
          {/* TODO: Replace with your page title */}
          Meu Perfil
        </h1>
        <p className="text-muted-foreground">
          {/* TODO: Replace with your page description */}
          Gerencie suas informações pessoais e configurações
        </p>
      </div>

      {/* User Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Status da Conta</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{userData?.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Última atividade: {userData?.lastActivity ? 
                    new Date(userData.lastActivity).toLocaleString('pt-BR') : 
                    'Nunca'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant={userData?.status === 'active' ? 'default' : 'secondary'}>
                {userData?.status === 'active' ? 'Ativo' : 
                 userData?.status === 'pending' ? 'Pendente' : 'Inativo'}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchUserData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('overview')}
          className="flex-1"
        >
          <Activity className="h-4 w-4 mr-2" />
          Visão Geral
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('settings')}
          className="flex-1"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
        <Button
          variant={activeTab === 'activity' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('activity')}
          className="flex-1"
        >
          <Clock className="h-4 w-4 mr-2" />
          Atividade
        </Button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status da Conta</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Ativa</div>
                <p className="text-xs text-muted-foreground">
                  Conta verificada e funcionando
                </p>
              </CardContent>
            </Card>

            {/* TODO: Add more stat cards as needed */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Atividades Hoje</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activity.length}</div>
                <p className="text-xs text-muted-foreground">
                  Ações realizadas hoje
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Configurações</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userSettings ? Object.values(userSettings).filter(Boolean).length : 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Configurações ativas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Perfil</CardTitle>
              <CardDescription>
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Seu nome completo"
                  />
                </div>
                
                {/* TODO: Add more profile fields as needed */}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="active">Ativo</option>
                    <option value="pending">Pendente</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Personalize sua experiência no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* TODO: Add your specific settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications">Notificações</Label>
                  <p className="text-sm text-muted-foreground">
                    Receber notificações do sistema
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="notifications"
                  checked={settingsData.notifications || false}
                  onChange={(e) => setSettingsData(prev => ({ ...prev, notifications: e.target.checked }))}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoSync">Sincronização Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Sincronizar dados automaticamente
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={settingsData.autoSync || false}
                  onChange={(e) => setSettingsData(prev => ({ ...prev, autoSync: e.target.checked }))}
                  className="rounded"
                />
              </div>

              <div>
                <Label htmlFor="theme">Tema</Label>
                <select
                  id="theme"
                  value={settingsData.theme || 'system'}
                  onChange={(e) => setSettingsData(prev => ({ ...prev, theme: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background mt-1"
                >
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                  <option value="system">Sistema</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Configurações
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Atividades</CardTitle>
            <CardDescription>
              Suas ações recentes no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center space-x-4 p-3 border rounded-lg"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    {item.type === 'auth' ? (
                      <User className="h-4 w-4 text-primary" />
                    ) : item.type === 'settings' ? (
                      <Settings className="h-4 w-4 text-primary" />
                    ) : (
                      <Activity className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  
                  <Badge variant="outline">
                    {item.type}
                  </Badge>
                </div>
              ))}

              {activity.length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma atividade registrada ainda.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserPageTemplate;