/**
 * WuzAPI Authentication Context
 * Sistema de autenticação adaptado para WuzAPI com suporte a tokens duplos
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { toast } from "sonner";
import { WuzAPIClient, createWuzAPIClient } from "@/lib/wuzapi-client";
import { WuzAPIAuthConfig } from "@/lib/wuzapi-types";
import { BRANDED_MESSAGES } from "@/lib/branding-messages";

type UserRole = "admin" | "user";

interface User {
  role: UserRole;
  phoneNumber?: string;
  token?: string;
  adminToken?: string;
}

interface WuzAPIAuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  wuzapiClient: WuzAPIClient | null;
  loginAsAdmin: (baseUrl: string, adminToken: string) => Promise<boolean>;
  loginAsUser: (userToken: string, phoneNumber?: string) => Promise<boolean>;
  switchToUser: (userToken: string, phoneNumber?: string) => Promise<boolean>;
  logout: () => void;
  updateWuzAPIConfig: (config: Partial<WuzAPIAuthConfig>) => void;
}

const WuzAPIAuthContext = createContext<WuzAPIAuthContextType | undefined>(undefined);

// Chaves para localStorage
const STORAGE_KEYS = {
  USER: "wuzapi_user",
  CONFIG: "wuzapi_config",
} as const;

// Configuração padrão da WuzAPI
const DEFAULT_CONFIG: WuzAPIAuthConfig = {
  baseUrl: import.meta.env.DEV ? "/api" : "https://wzapi.wasend.com.br/api",
  adminToken: "",
};

export const WuzAPIAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wuzapiClient, setWuzapiClient] = useState<WuzAPIClient | null>(null);

  // ============================================================================
  // HELPERS DE ARMAZENAMENTO
  // ============================================================================

  const saveToStorage = (key: string, data: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Erro ao salvar ${key}:`, error);
    }
  };

  const loadFromStorage = <T,>(key: string): T | null => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error(`Erro ao carregar ${key}:`, error);
      return null;
    }
  };

  const clearStorage = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  // ============================================================================
  // INICIALIZAÇÃO E VERIFICAÇÃO DE SESSÃO
  // ============================================================================

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const storedUser = loadFromStorage<User>(STORAGE_KEYS.USER);
        const storedConfig = loadFromStorage<WuzAPIAuthConfig>(STORAGE_KEYS.CONFIG);

        if (storedUser && storedConfig?.adminToken) {
          // Recriar cliente WuzAPI
          const client = createWuzAPIClient(storedConfig);
          setWuzapiClient(client);

          // Validar tokens armazenados
          const isValidAdmin = await client.validateAdminToken();
          
          if (isValidAdmin.success) {
            setUser(storedUser);
            
            // Se for usuário, validar token de usuário também
            if (storedUser.role === "user" && storedUser.token) {
              const isValidUser = await client.validateUserToken(storedUser.token);
              if (!isValidUser.success) {
                // Token de usuário inválido, voltar para admin
                const adminUser: User = { 
                  role: "admin", 
                  adminToken: storedConfig.adminToken 
                };
                setUser(adminUser);
                saveToStorage(STORAGE_KEYS.USER, adminUser);
                toast.warning("Sessão de usuário expirada", {
                  description: "Voltando para modo administrador",
                });
              }
            }
          } else {
            // Token admin inválido, limpar tudo
            clearStorage();
            setUser(null);
            setWuzapiClient(null);
            toast.error("Sessão expirada", {
              description: "Faça login novamente",
            });
          }
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
        clearStorage();
        setUser(null);
        setWuzapiClient(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  // ============================================================================
  // MÉTODOS DE AUTENTICAÇÃO
  // ============================================================================

  const loginAsAdmin = async (
    baseUrl: string,
    adminToken: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Validações básicas
      if (!baseUrl.startsWith("http") && !baseUrl.startsWith("/")) {
        toast.error("URL inválida", {
          description: "A URL deve começar com http://, https:// ou ser um caminho relativo",
        });
        return false;
      }

      if (!adminToken || adminToken.length < 8) {
        toast.error("Token admin inválido", {
          description: "O token admin é muito curto ou inválido",
        });
        return false;
      }

      // Criar cliente temporário para validação
      const tempConfig: WuzAPIAuthConfig = { baseUrl, adminToken };
      const tempClient = createWuzAPIClient(tempConfig);

      // Validar token admin
      const validationResult = await tempClient.validateAdminToken();
      if (!validationResult.success) {
        toast.error("Falha na autenticação", {
          description: "Verifique suas credenciais e tente novamente.",
        });
        return false;
      }

      // Configuração válida - salvar e configurar
      const config: WuzAPIAuthConfig = { baseUrl, adminToken };
      const client = createWuzAPIClient(config);
      
      setWuzapiClient(client);
      saveToStorage(STORAGE_KEYS.CONFIG, config);

      // Criar usuário admin
      const adminUser: User = { 
        role: "admin", 
        adminToken 
      };
      
      setUser(adminUser);
      saveToStorage(STORAGE_KEYS.USER, adminUser);

      toast.success("Bem-vindo, Administrador!", {
        description: "Login admin realizado com sucesso",
      });

      return true;
    } catch (error) {
      console.error("Erro no login admin:", error);
      toast.error("Erro no login", {
        description: "Não foi possível realizar o login admin. Tente novamente.",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsUser = async (
    userToken: string,
    phoneNumber?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      if (!wuzapiClient) {
        toast.error("Cliente não inicializado", {
          description: "Faça login como admin primeiro",
        });
        return false;
      }

      if (!userToken || userToken.length < 8) {
        toast.error("Token de usuário inválido", {
          description: "O token de usuário é muito curto ou inválido",
        });
        return false;
      }

      // Validar token de usuário
      const validationResult = await wuzapiClient.validateUserToken(userToken);
      if (!validationResult.success) {
        toast.error("Token de usuário inválido", {
          description: "O token de usuário fornecido não foi aceito pelo servidor.",
        });
        return false;
      }

      // Atualizar cliente com token de usuário
      wuzapiClient.setUserToken(userToken);

      // Criar usuário
      const userUser: User = {
        role: "user",
        token: userToken,
        phoneNumber: phoneNumber || validationResult.data?.phone,
        adminToken: user?.adminToken,
      };

      setUser(userUser);
      saveToStorage(STORAGE_KEYS.USER, userUser);

      toast.success("Bem-vindo, Usuário!", {
        description: `Login de usuário realizado com sucesso${phoneNumber ? ` (${phoneNumber})` : ""}`,
      });

      return true;
    } catch (error) {
      console.error("Erro no login de usuário:", error);
      toast.error("Erro no login", {
        description: "Não foi possível realizar o login de usuário. Tente novamente.",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const switchToUser = async (
    userToken: string,
    phoneNumber?: string
  ): Promise<boolean> => {
    if (!user || user.role !== "admin") {
      toast.error("Acesso negado", {
        description: "Apenas administradores podem alternar para usuário",
      });
      return false;
    }

    return loginAsUser(userToken, phoneNumber);
  };

  const logout = () => {
    clearStorage();
    setUser(null);
    setWuzapiClient(null);
    
    toast.success("Logout realizado", {
      description: "Você foi desconectado com sucesso",
    });
  };

  // ============================================================================
  // MÉTODOS DE CONFIGURAÇÃO
  // ============================================================================

  const updateWuzAPIConfig = (newConfig: Partial<WuzAPIAuthConfig>) => {
    if (!wuzapiClient) return;

    const currentConfig = loadFromStorage<WuzAPIAuthConfig>(STORAGE_KEYS.CONFIG);
    if (!currentConfig) return;

    const updatedConfig = { ...currentConfig, ...newConfig };
    
    // Atualizar cliente
    wuzapiClient.updateConfig(updatedConfig);
    
    // Salvar nova configuração
    saveToStorage(STORAGE_KEYS.CONFIG, updatedConfig);

    toast.success("Configuração atualizada", {
      description: BRANDED_MESSAGES.CONFIG_UPDATED(),
    });
  };

  // ============================================================================
  // PROVIDER VALUE
  // ============================================================================

  const value: WuzAPIAuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    wuzapiClient,
    loginAsAdmin,
    loginAsUser,
    switchToUser,
    logout,
    updateWuzAPIConfig,
  };

  return (
    <WuzAPIAuthContext.Provider value={value}>
      {children}
    </WuzAPIAuthContext.Provider>
  );
};

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export const useWuzAPIAuth = () => {
  const context = useContext(WuzAPIAuthContext);
  if (context === undefined) {
    throw new Error("useWuzAPIAuth must be used within a WuzAPIAuthProvider");
  }
  return context;
};

// ============================================================================
// HOOK DE COMPATIBILIDADE (para migração gradual)
// ============================================================================

/**
 * Hook de compatibilidade que mantém a interface do AuthContext original
 * mas usa a WuzAPI internamente
 */
export const useAuth = () => {
  const wuzapiAuth = useWuzAPIAuth();
  
  return {
    user: wuzapiAuth.user,
    isAuthenticated: wuzapiAuth.isAuthenticated,
    isLoading: wuzapiAuth.isLoading,
    loginAsAdmin: wuzapiAuth.loginAsAdmin,
    logout: wuzapiAuth.logout,
    // Métodos adicionais da WuzAPI
    wuzapiClient: wuzapiAuth.wuzapiClient,
    loginAsUser: wuzapiAuth.loginAsUser,
    switchToUser: wuzapiAuth.switchToUser,
    updateWuzAPIConfig: wuzapiAuth.updateWuzAPIConfig,
  };
};

export default WuzAPIAuthProvider;