import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBrandingConfig } from '@/hooks/useBranding';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import { Loader2, Mail, Lock, ArrowLeft, KeyRound, Users, User, Shield } from 'lucide-react';
import { tenantService, type TenantInfo } from '@/services/tenant-service';
import { authService } from '@/services/auth-service';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Unified Login Page with Tabs for Agent, User, and Admin
 * Requirements: 1.1, 1.3, 1.5, 2.1, 3.1, 4.1
 * 
 * Architecture:
 * - Single login page at /login with three tabs
 * - Uses Supabase Auth for all authentication
 * - Role-based redirects after successful login
 * - Tenant branding support
 */

type AuthTabId = 'agent' | 'user' | 'admin';

interface AuthTab {
  id: AuthTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  showRegisterLink: boolean;
}

const AUTH_TABS: AuthTab[] = [
  {
    id: 'agent',
    label: 'Agente',
    icon: Users,
    description: 'Acesso para membros da equipe de atendimento',
    showRegisterLink: false,
  },
  {
    id: 'user',
    label: 'Usuário',
    icon: User,
    description: 'Acesso para proprietários de conta',
    showRegisterLink: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Shield,
    description: 'Acesso administrativo ao sistema',
    showRegisterLink: false,
  },
];

// Role to redirect path mapping - Requirements: 8.2, 8.3, 8.4, 8.5
const ROLE_REDIRECTS: Record<string, string> = {
  agent: '/agent/dashboard',
  user: '/user/dashboard',
  admin: '/admin',
  superadmin: '/superadmin/dashboard',
};

/**
 * Get redirect path based on user role
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
 */
function getRedirectPath(role: string | undefined): string {
  if (!role) return ROLE_REDIRECTS.user; // Default to user - Requirement 8.6
  return ROLE_REDIRECTS[role] || ROLE_REDIRECTS.user;
}

/**
 * Extract user role from Supabase user metadata
 * Requirements: 8.1, 8.6
 */
function getUserRole(user: { user_metadata?: { role?: string } }): string {
  return user.user_metadata?.role || 'user';
}

const UnifiedLoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const brandingConfig = useBrandingConfig();
  const { checkAuth, isAuthenticated, user, isLoading: authLoading } = useAuth();
  
  // Get default tab from URL query parameter - Requirement 1.2
  // Also handle legacy route redirects
  const getDefaultTab = (): AuthTabId => {
    // Check URL query param first
    const tabParam = searchParams.get('tab') as AuthTabId;
    if (tabParam && AUTH_TABS.some(t => t.id === tabParam)) {
      return tabParam;
    }
    
    // Check if coming from legacy route (handled by router, but check path for tab selection)
    const path = window.location.pathname;
    if (path.includes('/agent')) {
      return 'agent';
    }
    
    return 'user';
  };
  
  const defaultTab = getDefaultTab();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<AuthTabId>(defaultTab);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  // Tenant state - Requirements: 10.1, 10.2, 10.3
  const [currentTenant, setCurrentTenant] = useState<TenantInfo | null>(null);

  // Fetch tenant info on mount - Requirement 10.4
  useEffect(() => {
    const fetchTenant = async () => {
      // Skip tenant validation on localhost
      if (tenantService.isLocalhost()) {
        return;
      }
      
      const tenant = await tenantService.getTenantInfo();
      setCurrentTenant(tenant);
    };
    fetchTenant();
  }, []);

  // Sync checkingSession with authLoading
  useEffect(() => {
    if (!authLoading) {
      setCheckingSession(false);
    }
  }, [authLoading]);
  
  // Handle legacy route redirects with query parameter preservation - Requirement 1.2
  useEffect(() => {
    const path = window.location.pathname;
    const currentParams = searchParams.toString();
    
    // If on legacy route, update URL to /login while preserving params
    if (path === '/agent/login' || path === '/user-login') {
      const tab = path === '/agent/login' ? 'agent' : 'user';
      const newParams = new URLSearchParams(currentParams);
      newParams.set('tab', tab);
      navigate(`/login?${newParams.toString()}`, { replace: true });
    }
  }, [navigate, searchParams]);

  // Check for existing session from global context - Requirement 7.2
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
       // Use role directly from user object (handles both Supabase and Backend users)
       const role = user.role;
       const from = (location.state as any)?.from?.pathname;
       navigate(from || getRedirectPath(role), { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate, location]);

  // Listen for auth state changes - Requirement 7.5
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const role = getUserRole(session.user);
        navigate(getRedirectPath(role));
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Handle login - Requirements: 2.1, 3.1, 4.1
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      setError('Por favor, preencha email e senha');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let data, signInError;

      if (activeTab === 'admin') {
         const result = await authService.loginAdmin(email.trim(), password.trim());
         data = { user: result.user, session: result.session };
         signInError = result.error;
         
         if (!signInError) {
             // Refresh global auth state from backend session
             await checkAuth();
         }
      } else {
         const result = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
         });
         data = result.data;
         signInError = result.error;
      }

      if (signInError) {
        throw signInError;
      }

      if (!data.user) {
        throw new Error('Falha na autenticação');
      }

      // Validate tenant access - Requirements: 10.2, 10.3
      if (currentTenant && !tenantService.isLocalhost()) {
        const userTenantId = data.user.user_metadata?.tenant_id;
        const validation = tenantService.validateTenantAccess(userTenantId, currentTenant.id);
        
        if (!validation.valid) {
          // Sign out the user since they don't belong to this tenant
          await supabase.auth.signOut();
          setError(validation.error || 'Acesso não autorizado para este domínio');
          return;
        }
      }

      // Check if password change is required - Requirement 9.5
      if (authService.requiresPasswordChange(data.user)) {
        navigate('/force-password-change');
        return;
      }

      // Get user role and redirect - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
      const userRole = getUserRole(data.user);
      const from = (location.state as any)?.from?.pathname;
      navigate(from || getRedirectPath(userRole), { replace: true });

    } catch (err) {
      // Generic error messages to prevent email enumeration - Requirements: 2.3, 3.3, 4.4
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos');
        } else if (err.message.includes('Email not confirmed')) {
          setError('Por favor, confirme seu email antes de fazer login');
        } else if (err.message.includes('Too many requests')) {
          setError('Conta temporariamente bloqueada. Tente novamente mais tarde.');
        } else {
          setError('Email ou senha incorretos');
        }
      } else {
        setError('Falha na autenticação. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password reset - Requirements: 6.1, 6.5
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      setResetMessage({ type: 'error', text: 'Por favor, insira seu email' });
      return;
    }

    setResetLoading(true);
    setResetMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      // Always show success to prevent email enumeration - Requirement 6.5
      setResetMessage({ 
        type: 'success', 
        text: 'Se o email existir, você receberá instruções para redefinir sua senha.' 
      });
      setResetEmail('');
    } catch (err) {
      // Always show success to prevent email enumeration - Requirement 6.5
      setResetMessage({ 
        type: 'success', 
        text: 'Se o email existir, você receberá instruções para redefinir sua senha.' 
      });
      setResetEmail('');
    } finally {
      setResetLoading(false);
    }
  };

  // Clear form when switching tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value as AuthTabId);
    setEmail('');
    setPassword('');
    setError(null);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Password Reset Form - Requirements: 6.1, 6.5
  if (showPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md space-y-4">
          {/* Tenant Branding - Requirement 1.3 */}
          <div className="text-center space-y-4">
            {brandingConfig.logoUrl ? (
              <div className="flex justify-center">
                <img 
                  src={brandingConfig.logoUrl} 
                  alt={`${brandingConfig.appName} Logo`}
                  className="max-h-16 max-w-48 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <h1 className="text-3xl font-bold">{brandingConfig.appName}</h1>
            )}
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Recuperar Senha
              </CardTitle>
              <CardDescription>
                Digite seu email para receber instruções de recuperação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10"
                      disabled={resetLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {resetMessage && (
                  <Alert variant={resetMessage.type === 'error' ? 'destructive' : 'default'}>
                    <AlertDescription>{resetMessage.text}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar Instruções
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setResetMessage(null);
                    setResetEmail('');
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao login
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get current tab config
  const currentTab = AUTH_TABS.find(t => t.id === activeTab) || AUTH_TABS[1];

  // Main Login Form with Tabs - Requirements: 1.1, 1.5
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-4">
        {/* Tenant Branding - Requirement 1.3 */}
        <div className="text-center space-y-4">
          {brandingConfig.logoUrl ? (
            <div className="flex justify-center">
              <img 
                src={brandingConfig.logoUrl} 
                alt={`${brandingConfig.appName} Logo`}
                className="max-h-16 max-w-48 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <h1 className="text-3xl font-bold">{brandingConfig.appName}</h1>
          )}
          <p className="text-muted-foreground">
            Faça login para acessar o sistema
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            {/* Auth Tabs - Requirement 1.1 */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                {AUTH_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className={tab.id === 'admin' ? 'data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 dark:data-[state=active]:bg-amber-900 dark:data-[state=active]:text-amber-100' : ''}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </CardHeader>
          
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground text-center">
                {currentTab.description}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    autoComplete="email"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>

              <div className="text-center space-y-2">
                {/* Forgot Password - Requirements: 2.5, 3.4 */}
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setShowPasswordReset(true)}
                >
                  Esqueci minha senha
                </button>
                
                {/* Register Link - Requirement 3.5 */}
                {currentTab.showRegisterLink && (
                  <p className="text-sm text-muted-foreground">
                    Não tem conta?{' '}
                    <Link to="/register" className="text-primary hover:underline">
                      Cadastre-se
                    </Link>
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;
