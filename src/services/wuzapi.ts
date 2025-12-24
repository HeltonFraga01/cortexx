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

/**
 * Representa uma caixa de entrada WhatsApp conectada via WUZAPI.
 * 
 * Um Inbox é uma instância de conexão WhatsApp que pode enviar e receber mensagens.
 * Este é o tipo preferido - use em vez de WuzAPIUser.
 */
export interface Inbox {
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

/**
 * Payload para criar uma nova caixa de entrada.
 * Este é o tipo preferido - use em vez de CreateUserRequest.
 */
export interface CreateInboxRequest {
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

import { backendApi } from './api-client';

export class WuzAPIService {
  private baseUrl: string;

  constructor() {
    // Sempre usar URL relativa - o backend cuida do proxy e do prefixo /api
    this.baseUrl = '';
  }

  // Métodos de Admin
  async getHealth(): Promise<HealthStatus> {
    // Para health check, usar a API local diretamente
    const response = await backendApi.get<HealthStatus>('/health');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch health status');
    }
    return response.data;
  }

  // ============================================================================
  // MÉTODOS DE INBOX (CAIXA DE ENTRADA) - NOMENCLATURA PREFERIDA
  // ============================================================================

  /**
   * Lista todas as caixas de entrada (inboxes) do sistema.
   * Este é o método preferido - use em vez de getUsers().
   */
  async listInboxes(): Promise<Inbox[]> {
    const response = await backendApi.get<any>(`${this.baseUrl}/admin/users`);
    
    if (!response.success) {
      throw new Error(response.error || 'Falha ao buscar caixas de entrada');
    }
    
    // A resposta pode ter 'data' ou 'filtered_data'
    return response.data?.data || response.data?.filtered_data || [];
  }

  /**
   * Obtém uma caixa de entrada específica pelo ID.
   * Este é o método preferido - use em vez de getUser().
   */
  async getInbox(id: string): Promise<Inbox> {
    const response = await backendApi.get<any>(`${this.baseUrl}/admin/users/${id}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Falha ao buscar caixa de entrada');
    }
    
    return response.data.data;
  }

  /**
   * Cria uma nova caixa de entrada.
   * Este é o método preferido - use em vez de createUser().
   */
  async createInbox(inboxData: CreateInboxRequest): Promise<Inbox> {
    const response = await backendApi.post<any>(`${this.baseUrl}/admin/users`, inboxData);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Falha ao criar caixa de entrada');
    }
    
    return response.data.data;
  }

  /**
   * Remove uma caixa de entrada.
   * Este é o método preferido - use em vez de deleteUser().
   */
  async deleteInbox(id: string): Promise<void> {
    const response = await backendApi.delete<void>(`${this.baseUrl}/admin/users/${id}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Falha ao remover caixa de entrada');
    }
  }

  /**
   * Remove uma caixa de entrada completamente (incluindo dados).
   * Este é o método preferido - use em vez de deleteUserFull().
   */
  async deleteInboxFull(id: string): Promise<void> {
    const response = await backendApi.delete<void>(`${this.baseUrl}/admin/users/${id}/full`);
    
    if (!response.success) {
      throw new Error(response.error || 'Falha ao remover caixa de entrada completamente');
    }
  }

  // ============================================================================
  // MÉTODOS DEPRECATED (COMPATIBILIDADE RETROATIVA)
  // ============================================================================

  /**
   * @deprecated Use listInboxes() instead. Este método será removido em versão futura.
   */
  async getUsers(): Promise<WuzAPIUser[]> {
    console.warn('[DEPRECATED] getUsers() is deprecated. Use listInboxes() instead.');
    return this.listInboxes();
  }

  /**
   * @deprecated Use getInbox() instead. Este método será removido em versão futura.
   */
  async getUser(id: string): Promise<WuzAPIUser> {
    console.warn('[DEPRECATED] getUser() is deprecated. Use getInbox() instead.');
    return this.getInbox(id);
  }

  /**
   * @deprecated Use createInbox() instead. Este método será removido em versão futura.
   */
  async createUser(userData: CreateUserRequest): Promise<WuzAPIUser> {
    console.warn('[DEPRECATED] createUser() is deprecated. Use createInbox() instead.');
    return this.createInbox(userData);
  }

  /**
   * @deprecated Use deleteInbox() instead. Este método será removido em versão futura.
   */
  async deleteUser(id: string): Promise<void> {
    console.warn('[DEPRECATED] deleteUser() is deprecated. Use deleteInbox() instead.');
    return this.deleteInbox(id);
  }

  /**
   * @deprecated Use deleteInboxFull() instead. Este método será removido em versão futura.
   */
  async deleteUserFull(id: string): Promise<void> {
    console.warn('[DEPRECATED] deleteUserFull() is deprecated. Use deleteInboxFull() instead.');
    return this.deleteInboxFull(id);
  }

  // Métodos de Usuário
  async getSessionStatus(userToken: string): Promise<SessionStatus> {
    // Configurar header temporário
    const response = await backendApi.get<any>(`${this.baseUrl}/session/status`, {
      headers: { 'token': userToken }
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch session status');
    }
    
    const apiData = response.data.data;
    
    // Converter de maiúsculas para minúsculas para manter consistência
    return {
      connected: apiData.Connected || apiData.connected || false,
      loggedIn: apiData.LoggedIn || apiData.loggedIn || false
    };
  }

  async connectSession(userToken: string, options?: { Subscribe?: string[]; Immediate?: boolean }): Promise<any> {
    const response = await backendApi.post<any>(`${this.baseUrl}/session/connect`, options || {}, {
      headers: { 'token': userToken }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to connect session');
    }
    
    return response.data;
  }

  async disconnectSession(userToken: string): Promise<any> {
    const response = await backendApi.post<any>(`${this.baseUrl}/session/disconnect`, {}, {
      headers: { 'token': userToken }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to disconnect session');
    }
    
    return response.data;
  }

  async logoutSession(userToken: string): Promise<any> {
    const response = await backendApi.post<any>(`${this.baseUrl}/session/logout`, {}, {
      headers: { 'token': userToken }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to logout session');
    }
    
    return response.data;
  }

  async getQRCode(userToken: string): Promise<{ QRCode: string }> {
    const response = await backendApi.get<any>(`${this.baseUrl}/session/qr`, {
      headers: { 'token': userToken }
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch QR code');
    }
    
    return response.data.data;
  }

  async getWebhook(userToken: string): Promise<WebhookConfig> {
    const response = await backendApi.get<any>(`${this.baseUrl}/webhook`, {
      headers: { 'token': userToken }
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch webhook');
    }
    
    return response.data.data;
  }

  async setWebhook(userToken: string, webhook: string, events: string[]): Promise<any> {
    const response = await backendApi.post<any>(`${this.baseUrl}/webhook`, 
      { webhook, events, subscribe: events, active: true },
      { headers: { 'token': userToken } }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to set webhook');
    }
    
    return response.data;
  }

  async updateWebhook(userToken: string, webhookData: { webhook: string; events: string[]; Active: boolean }): Promise<any> {
    const response = await backendApi.post<any>(`${this.baseUrl}/webhook`, 
      webhookData,
      { headers: { 'token': userToken } }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update webhook');
    }
    
    return response.data;
  }

  async sendTextMessage(userToken: string, phone: string, body: string, options?: any): Promise<any> {
    const response = await backendApi.post<any>(`${this.baseUrl}/chat/send/text`, 
      {
        Phone: phone,
        Body: body,
        ...options
      },
      { headers: { 'token': userToken } }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to send message');
    }
    
    return response.data;
  }

  async getAvatar(userToken: string, phone: string, preview = true): Promise<{ URL: string; ID: string; Type: string; DirectPath?: string }> {
    // Usar rota do backend que faz proxy para WUZAPI
    const response = await backendApi.post<any>(`${this.baseUrl}/user/avatar`, 
      { Phone: phone, Preview: preview },
      { headers: { 'token': userToken } }
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch avatar');
    }
    
    const avatarData = response.data.data || response.data;
    
    // Normalizar campos - API pode retornar em minúsculas ou maiúsculas
    return {
      URL: avatarData.URL || avatarData.url || '',
      ID: avatarData.ID || avatarData.id || '',
      Type: avatarData.Type || avatarData.type || '',
      DirectPath: avatarData.DirectPath || avatarData.direct_path || avatarData.directPath || ''
    };
  }
}

export const wuzapi = new WuzAPIService();