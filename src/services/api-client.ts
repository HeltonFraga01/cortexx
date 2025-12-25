import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_BASE_URL, IS_DEVELOPMENT } from '@/config/environment';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Interface para respostas padronizadas da API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

// Storage key for impersonation state (shared with ImpersonationContext)
const IMPERSONATION_STORAGE_KEY = 'wuzapi_impersonation';

/**
 * Get impersonation context from localStorage
 * Used to send X-Impersonation-Context header for superadmin requests
 */
const getImpersonationContext = (): { tenantId: string; sessionId: string } | null => {
  try {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.isImpersonating && parsed.tenantId && parsed.sessionId) {
        return {
          tenantId: parsed.tenantId,
          sessionId: parsed.sessionId,
        };
      }
    }
  } catch (error) {
    // Ignore parse errors
  }
  return null;
};

// Classe para gerenciar cliente da API do backend
export class BackendApiClient {
  private client: AxiosInstance;
  // CSRF token compartilhado entre todas as instâncias
  private static csrfToken: string | null = null;
  private static csrfTokenPromise: Promise<void> | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 segundos
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // IMPORTANTE: Envia cookies de sessão
    });

    this.setupInterceptors();
    // CSRF token será inicializado sob demanda na primeira requisição POST/PUT/DELETE/PATCH
  }

  /**
   * Inicializar token CSRF
   * Busca o token do servidor e armazena em memória compartilhada
   */
  private async initializeCsrfToken() {
    // Evitar múltiplas requisições simultâneas
    if (BackendApiClient.csrfTokenPromise) {
      return BackendApiClient.csrfTokenPromise;
    }

    BackendApiClient.csrfTokenPromise = (async () => {
      try {
        const response = await this.client.get('/auth/csrf-token');
        if (response.data?.csrfToken) {
          BackendApiClient.csrfToken = response.data.csrfToken;
          if (IS_DEVELOPMENT) {
            console.log('🔒 CSRF Token initialized');
          }
        }
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error('Failed to initialize CSRF token:', error);
        }
        // Não propagar erro - token será obtido na próxima tentativa
      } finally {
        BackendApiClient.csrfTokenPromise = null;
      }
    })();

    return BackendApiClient.csrfTokenPromise;
  }

  /**
   * Renovar token CSRF
   * Deve ser chamado após login ou quando o token expirar
   */
  async refreshCsrfToken() {
    BackendApiClient.csrfToken = null;
    await this.initializeCsrfToken();
  }

  /**
   * Limpar token CSRF (chamar no logout)
   */
  static clearCsrfToken() {
    BackendApiClient.csrfToken = null;
    BackendApiClient.csrfTokenPromise = null;
  }

  private setupInterceptors() {
    // Request interceptor - adicionar logs em desenvolvimento, CSRF token e Supabase Auth token
    this.client.interceptors.request.use(
      async (config) => {
        const method = config.method?.toUpperCase();
        
        // Adicionar token de autenticação do Supabase
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
          }
          // Note: No warning when session is null - this is expected for public endpoints
        } catch (error) {
          // Only log actual errors, not missing sessions
          if (IS_DEVELOPMENT && error instanceof Error && !error.message.includes('session')) {
            console.warn('Failed to get Supabase session:', error);
          }
        }
        
        // Add impersonation context header for superadmin requests
        const impersonationContext = getImpersonationContext();
        if (impersonationContext) {
          config.headers['X-Impersonation-Context'] = JSON.stringify(impersonationContext);
          if (IS_DEVELOPMENT) {
            console.log('🎭 Adding impersonation context header', {
              tenantId: impersonationContext.tenantId,
            });
          }
        }
        
        // Apenas inicializar CSRF token para requisições que modificam dados
        if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
          // Garantir que o token CSRF está inicializado
          if (!BackendApiClient.csrfToken && !BackendApiClient.csrfTokenPromise) {
            await this.initializeCsrfToken();
          } else if (BackendApiClient.csrfTokenPromise) {
            await BackendApiClient.csrfTokenPromise;
          }

          // Adicionar token CSRF
          if (BackendApiClient.csrfToken) {
            config.headers['CSRF-Token'] = BackendApiClient.csrfToken;
          }
        }

        if (IS_DEVELOPMENT) {
          console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            data: config.data,
            params: config.params,
            hasCsrfToken: !!BackendApiClient.csrfToken,
            hasAuthToken: !!config.headers.Authorization,
          });
        }
        return config;
      },
      (error) => {
        if (IS_DEVELOPMENT) {
          console.error('❌ API Request Error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor - tratar erros globalmente
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (IS_DEVELOPMENT) {
          console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      async (error) => {
        if (IS_DEVELOPMENT) {
          console.error('❌ API Response Error:', error);
        }

        // Tratar erros de rede
        if (!error.response) {
          const message = 'Erro de conexão com o servidor. Verifique sua conexão de internet.';
          toast.error('Erro de Conexão', {
            description: message,
          });
          return Promise.reject(new Error(message));
        }

        // Tratar erros HTTP
        const { status, data } = error.response;
        const url = error.config?.url || '';
        let message = 'Erro desconhecido';
        let shouldShowToast = true;

        // Não mostrar toast para 404 em rotas de polling/monitoramento
        if (status === 404 && (
          url.includes('/active') || 
          url.includes('/progress') ||
          url.includes('/bulk-campaigns')
        )) {
          shouldShowToast = false;
        }

        // Retry automático para erro de CSRF
        if (status === 403 && data?.code === 'CSRF_VALIDATION_FAILED') {
          if (IS_DEVELOPMENT) {
            console.log('🔄 CSRF token expired, refreshing and retrying request...');
          }
          
          // Renovar token CSRF
          await this.refreshCsrfToken();
          
          // Tentar novamente a requisição original
          if (error.config && !error.config.__isRetry) {
            error.config.__isRetry = true; // Evitar loop infinito
            
            if (IS_DEVELOPMENT) {
              console.log('🔁 Retrying request with new CSRF token...');
            }
            
            return this.client.request(error.config);
          }
        }

        switch (status) {
          case 400:
            message = data?.error || 'Dados inválidos enviados para o servidor';
            break;
          case 401:
            // Check if this is a WUZAPI-related endpoint (session/connect, session/disconnect, etc.)
            const isWuzapiEndpoint = url.includes('/session/') || 
                                     url.includes('/webhook') || 
                                     url.includes('/chat/') ||
                                     url.includes('/user/avatar');
            
            if (isWuzapiEndpoint) {
              // WUZAPI 401 means invalid WUZAPI token, not session expiration
              message = data?.error || 'Token WUZAPI inválido ou não autorizado';
              shouldShowToast = false; // Let the component handle the toast with more context
            } else {
              // Regular auth 401 - session expired
              shouldShowToast = true;
              if (data?.code === 'TOKEN_MISSING') {
                message = 'Sessão expirada. Por favor, faça login novamente.';
              } else if (data?.code === 'AUTH_REQUIRED') {
                message = 'Sessão expirada ou inválida. Por favor, faça login novamente.';
              } else {
                message = data?.error || 'Sessão expirada. Por favor, faça login novamente.';
              }
              
              // Disparar evento para que o AuthContext possa reagir
              window.dispatchEvent(new CustomEvent('auth:session-expired', { 
                detail: { code: data?.code, message } 
              }));
            }
            break;
          case 403:
            // Se for erro de CSRF, tentar renovar token
            if (data?.code === 'CSRF_VALIDATION_FAILED') {
              message = 'Token de segurança expirado. Renovando automaticamente...';
              // Renovar token CSRF e não mostrar toast
              this.refreshCsrfToken();
              shouldShowToast = false;
              
              if (IS_DEVELOPMENT) {
                console.log('🔄 CSRF token expired, refreshing...');
              }
            } else if (data?.code === 'FORBIDDEN') {
              message = data?.error || 'Acesso negado. Você não tem permissão de administrador.';
            } else {
              message = data?.error || 'Acesso negado. Você não tem permissão para esta operação.';
            }
            break;
          case 404:
            message = data?.error || 'Recurso não encontrado no servidor.';
            break;
          case 500:
            message = data?.error || 'Erro interno do servidor. Tente novamente mais tarde.';
            break;
          case 502:
            message = 'Erro de comunicação com a API externa. Verifique a configuração.';
            break;
          case 503:
            message = 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
            break;
          case 504:
            message = 'Timeout: O servidor demorou muito para responder.';
            break;
          default:
            message = data?.error || `Erro HTTP ${status}`;
        }
        
        // Log detalhado em desenvolvimento
        if (IS_DEVELOPMENT) {
          console.error('📋 Error Details:', {
            status,
            code: data?.code,
            message,
            url,
            data
          });
        }

        if (shouldShowToast) {
          toast.error(`Erro ${status}`, {
            description: message,
          });
        }

        return Promise.reject(new Error(message));
      }
    );
  }

  // Métodos HTTP genéricos
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(url, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        status: axios.isAxiosError(error) ? error.response?.status : 500,
      };
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(url, data, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        status: axios.isAxiosError(error) ? error.response?.status : 500,
      };
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(url, data, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        status: axios.isAxiosError(error) ? error.response?.status : 500,
      };
    }
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch(url, data, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        status: axios.isAxiosError(error) ? error.response?.status : 500,
      };
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(url, config);
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        status: axios.isAxiosError(error) ? error.response?.status : 500,
      };
    }
  }

  // Método para atualizar a base URL (útil para configurações dinâmicas)
  updateBaseURL(newBaseURL: string) {
    this.client.defaults.baseURL = newBaseURL;
    if (IS_DEVELOPMENT) {
      console.log(`🔄 API Base URL updated to: ${newBaseURL}`);
    }
  }

  // Método para configurar header de autenticação temporário
  // Usado para requisições específicas que precisam de token no header
  setAuthHeader(token: string) {
    this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    if (IS_DEVELOPMENT) {
      console.log('🔑 Auth header set', { tokenPreview: token.substring(0, 8) + '...' });
    }
  }

  // Método para remover headers de autenticação
  removeAuthHeader() {
    delete this.client.defaults.headers.common.Authorization;
    if (IS_DEVELOPMENT) {
      console.log('🔓 Auth header removed');
    }
  }
}

// Instância singleton do cliente da API
export const backendApi = new BackendApiClient();

// Helper para verificar se a API está disponível
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await backendApi.get('/health');
    return response.success;
  } catch (error) {
    console.error('API Health Check failed:', error);
    return false;
  }
};

export default backendApi;