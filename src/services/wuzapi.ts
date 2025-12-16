// Tipos para a API WUZAPI
export interface WuzAPIUser {
  id: string;
  name: string;
  token: string;
  webhook: string;
  events: string;
  connected: boolean;
  loggedIn: boolean;
  jid: string;
  qrcode: string;
  expiration: number;
  proxy_config: {
    enabled: boolean;
    proxy_url: string;
  };
  s3_config: {
    enabled: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    access_key: string;
    path_style: boolean;
    public_url: string;
    media_delivery: string;
    retention_days: number;
  };
}

export interface CreateUserRequest {
  name: string;
  token: string;
  webhook?: string;
  events?: string;
  proxyConfig?: {
    enabled: boolean;
    proxyURL: string;
  };
  s3Config?: {
    enabled: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    pathStyle: boolean;
    publicURL: string;
    mediaDelivery: string;
    retentionDays: number;
  };
  history?: number;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: string;
  active_connections: number;
  total_users: number;
  connected_users: number;
  logged_in_users: number;
  memory_stats: {
    alloc_mb: number;
    total_alloc_mb: number;
    sys_mb: number;
    num_gc: number;
  };
  goroutines: number;
  version?: string;
}

export interface SessionStatus {
  connected: boolean;
  loggedIn: boolean;
}

export interface WebhookConfig {
  webhook: string;
  subscribe: string[];
}

export class WuzAPIService {
  private baseUrl: string;
  private adminToken: string;
  private csrfToken: string | null = null;

  constructor() {
    // Sempre usar URL relativa - o backend cuida do proxy
    this.baseUrl = '/api';
    // Admin token loaded from environment when needed
    // Note: Most operations use HTTP-only session cookies
    this.adminToken = import.meta.env.VITE_ADMIN_TOKEN || '';
  }

  /**
   * Obtém o token CSRF do servidor
   */
  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch('/api/auth/csrf-token', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.csrfToken;
        return this.csrfToken;
      }
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
    }

    return '';
  }

  /**
   * Cria headers com CSRF token para requisições que modificam dados
   */
  private async getHeaders(method: string = 'GET'): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    // Adicionar CSRF token para métodos que modificam dados
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      const token = await this.getCsrfToken();
      if (token) {
        headers['CSRF-Token'] = token;
      }
    }

    return headers;
  }

  // Métodos de Admin
  async getHealth(): Promise<HealthStatus> {
    // Para health check, usar a API local diretamente (não a WuzAPI externa)
    const response = await fetch('/health');
    if (!response.ok) {
      throw new Error('Failed to fetch health status');
    }
    return response.json();
  }

  async getUsers(): Promise<WuzAPIUser[]> {
    const response = await fetch(`${this.baseUrl}/admin/users`, {
      credentials: 'include', // Usa sessão HTTP-only
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch users');
    }
    
    const data = await response.json();
    // A resposta pode ter 'data' ou 'filtered_data'
    return data.data || data.filtered_data || [];
  }

  async getUser(id: string): Promise<WuzAPIUser> {
    const response = await fetch(`${this.baseUrl}/admin/users/${id}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    
    const data = await response.json();
    return data.data;
  }

  async createUser(userData: CreateUserRequest): Promise<WuzAPIUser> {
    const headers = await this.getHeaders('POST');
    
    const response = await fetch(`${this.baseUrl}/admin/users`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create user');
    }
    
    const data = await response.json();
    return data.data;
  }

  async deleteUser(id: string): Promise<void> {
    const headers = await this.getHeaders('DELETE');
    
    const response = await fetch(`${this.baseUrl}/admin/users/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to delete user');
    }
  }

  async deleteUserFull(id: string): Promise<void> {
    const headers = await this.getHeaders('DELETE');
    
    const response = await fetch(`${this.baseUrl}/admin/users/${id}/full`, {
      method: 'DELETE',
      credentials: 'include',
      headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to delete user completely');
    }
  }



  // Métodos de Usuário
  async getSessionStatus(userToken: string): Promise<SessionStatus> {
    const response = await fetch(`${this.baseUrl}/session/status`, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch session status');
    }
    
    const data = await response.json();
    const apiData = data.data;
    
    // Converter de maiúsculas para minúsculas para manter consistência
    return {
      connected: apiData.Connected || apiData.connected || false,
      loggedIn: apiData.LoggedIn || apiData.loggedIn || false
    };
  }

  async connectSession(userToken: string, options?: { Subscribe?: string[]; Immediate?: boolean }): Promise<any> {
    const headers = await this.getHeaders('POST');
    
    const response = await fetch(`${this.baseUrl}/session/connect`, {
      method: 'POST',
      headers: {
        ...headers,
        'token': userToken
      },
      body: JSON.stringify(options || {})
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to connect session');
    }
    
    return response.json();
  }

  async disconnectSession(userToken: string): Promise<any> {
    const headers = await this.getHeaders('POST');
    
    const response = await fetch(`${this.baseUrl}/session/disconnect`, {
      method: 'POST',
      headers: {
        ...headers,
        'token': userToken
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to disconnect session');
    }
    
    return response.json();
  }

  async logoutSession(userToken: string): Promise<any> {
    const headers = await this.getHeaders('POST');
    
    const response = await fetch(`${this.baseUrl}/session/logout`, {
      method: 'POST',
      headers: {
        ...headers,
        'token': userToken
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to logout session');
    }
    
    return response.json();
  }

  async getQRCode(userToken: string): Promise<{ QRCode: string }> {
    const response = await fetch(`${this.baseUrl}/session/qr`, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch QR code');
    }
    
    const data = await response.json();
    return data.data;
  }

  async getWebhook(userToken: string): Promise<WebhookConfig> {
    const response = await fetch(`${this.baseUrl}/webhook`, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch webhook');
    }
    
    const data = await response.json();
    return data.data;
  }

  async setWebhook(userToken: string, webhook: string, events: string[]): Promise<any> {
    const headers = await this.getHeaders('POST');
    
    const response = await fetch(`${this.baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        ...headers,
        'token': userToken
      },
      body: JSON.stringify({ webhook, events, subscribe: events, active: true })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to set webhook');
    }
    
    return response.json();
  }

  async updateWebhook(userToken: string, webhookData: { webhook: string; events: string[]; Active: boolean }): Promise<any> {
    try {
      const headers = await this.getHeaders('POST');
      
      const response = await fetch(`${this.baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          ...headers,
          'token': userToken
        },
        body: JSON.stringify(webhookData),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorData = await response.text();
          
          // Tentar parsear como JSON para obter mensagem mais específica
          try {
            const errorJson = JSON.parse(errorData);
            if (errorJson.message) {
              errorMessage = errorJson.message;
            } else if (errorJson.error) {
              errorMessage = errorJson.error;
            } else {
              errorMessage = errorData;
            }
          } catch {
            // Se não for JSON, usar o texto diretamente
            errorMessage = errorData || errorMessage;
          }
          
          // Personalizar mensagens baseadas no status HTTP
          switch (response.status) {
            case 400:
              throw new Error(`Dados inválidos: ${errorMessage}`);
            case 401:
              throw new Error(`Token inválido ou expirado: ${errorMessage}`);
            case 403:
              throw new Error(`Acesso negado: ${errorMessage}`);
            case 404:
              throw new Error(`Usuário não encontrado: ${errorMessage}`);
            case 422:
              throw new Error(`Dados não processáveis: ${errorMessage}`);
            case 500:
              throw new Error(`Erro interno do servidor: ${errorMessage}`);
            case 502:
              throw new Error(`Servidor indisponível: ${errorMessage}`);
            case 503:
              throw new Error(`Serviço temporariamente indisponível: ${errorMessage}`);
            default:
              throw new Error(`Erro HTTP ${response.status}: ${errorMessage}`);
          }
        } catch (parseError) {
          // Se houver erro ao ler a resposta, usar mensagem genérica
          throw new Error(`Erro HTTP ${response.status}: Falha na comunicação com o servidor`);
        }
      }

      const result = await response.json();
      
      // Verificar se a resposta indica sucesso
      if (result.success === false) {
        throw new Error(result.message || 'Operação falhou no servidor');
      }
      
      return result;
      
    } catch (error) {
      // Se for um erro de rede ou fetch
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão: Não foi possível conectar ao servidor');
      }
      
      // Re-lançar outros erros
      throw error;
    }
  }

  async sendTextMessage(userToken: string, phone: string, body: string, options?: any): Promise<any> {
    const headers = await this.getHeaders('POST');
    
    const response = await fetch(`${this.baseUrl}/chat/send/text`, {
      method: 'POST',
      headers: {
        ...headers,
        'token': userToken
      },
      body: JSON.stringify({
        Phone: phone,
        Body: body,
        ...options
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to send message');
    }
    
    return response.json();
  }

  async getAvatar(userToken: string, phone: string, preview: boolean = true): Promise<{ URL: string; ID: string; Type: string; DirectPath?: string }> {
    // Usar rota do backend que faz proxy para WUZAPI
    const headers = await this.getHeaders('POST');
    
    const response = await fetch(`${this.baseUrl}/user/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...headers,
        'token': userToken
      },
      body: JSON.stringify({ Phone: phone, Preview: preview })
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch avatar');
    }
    
    const data = await response.json();
    const avatarData = data.data || data;
    
    // Normalizar campos - API pode retornar em minúsculas ou maiúsculas
    return {
      URL: avatarData.URL || avatarData.url || '',
      ID: avatarData.ID || avatarData.id || '',
      Type: avatarData.Type || avatarData.type || '',
      DirectPath: avatarData.DirectPath || avatarData.direct_path || avatarData.directPath || ''
    };
  }
}