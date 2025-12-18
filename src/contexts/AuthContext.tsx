import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  role: 'admin' | 'user' | 'superadmin';
  token: string;
  name: string;
  jid?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, role: 'admin' | 'user') => Promise<boolean>;
  loginSuperadmin: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Verifica o status de autenticação com o servidor
   * Usa cookies de sessão HTTP-only (sem tokens no frontend)
   */
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include' // IMPORTANTE: Envia cookies de sessão
      });
      
      const data = await response.json();
      
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Faz login de superadmin com email e senha
   * O servidor valida as credenciais e cria uma sessão HTTP-only
   * Retorna true se o login foi bem-sucedido, false caso contrário
   */
  const loginSuperadmin = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // IMPORTANTE: Recebe cookies de sessão
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      
      if (!data.success) {
        return false;
      }
      
      // Map superadmin response to user format
      const superadminData = data.data?.superadmin || data.user;
      if (!superadminData) {
        return false;
      }
      
      setUser({
        id: superadminData.id,
        role: 'superadmin',
        token: data.data?.sessionToken || '',
        name: superadminData.name || superadminData.email,
        jid: undefined
      });

      // Renovar token CSRF após login bem-sucedido
      try {
        const { backendApi } = await import('@/services/api-client');
        await backendApi.refreshCsrfToken();
      } catch (csrfError) {
        console.error('Erro ao renovar CSRF (não crítico):', csrfError);
        // Não falhar o login por causa do CSRF
      }
      
      return true;
    } catch (error) {
      console.error('Superadmin login error:', error);
      return false;
    }
  };

  /**
   * Faz login com token e role
   * O servidor valida o token e cria uma sessão HTTP-only
   * Retorna true se o login foi bem-sucedido, false caso contrário
   */
  const login = async (token: string, role: 'admin' | 'user'): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, role }),
        credentials: 'include' // IMPORTANTE: Recebe cookies de sessão
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      
      if (!data.success || !data.user) {
        return false;
      }
      
      setUser(data.user);

      // Renovar token CSRF após login bem-sucedido
      try {
        const { backendApi } = await import('@/services/api-client');
        await backendApi.refreshCsrfToken();
      } catch (csrfError) {
        console.error('Erro ao renovar CSRF (não crítico):', csrfError);
        // Não falhar o login por causa do CSRF
      }
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  /**
   * Faz logout e destrói a sessão no servidor
   */
  const logout = async () => {
    try {
      // Importar backendApi dinamicamente para evitar dependência circular
      const { backendApi } = await import('@/services/api-client');
      
      // Usar backendApi que já inclui o CSRF token
      await backendApi.post('/auth/logout', {});
      
      setUser(null);
      
      // Limpar qualquer cache local
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.error('Logout error:', error);
      // Mesmo com erro, limpar o estado local
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  // Verificar autenticação ao montar o componente
  useEffect(() => {
    checkAuth();
  }, []);

  // Escutar eventos de sessão expirada
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('Session expired event received, clearing user state');
      setUser(null);
      // Redirecionar para login será feito pelo ProtectedRoute
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginSuperadmin,
      logout,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};