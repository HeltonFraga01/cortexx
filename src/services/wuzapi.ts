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

  async getUsers(): Promise<WuzAPIUser[]> {
    const response = await backendApi.get<any>(`${this.baseUrl}/admin/users`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch users');
    }
    
    // A resposta pode ter 'data' ou 'filtered_data'
    return response.data?.data || response.data?.filtered_data || [];
  }

  async getUser(id: string): Promise<WuzAPIUser> {
    const response = await backendApi.get<any>(`${this.baseUrl}/admin/users/${id}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch user');
    }
    
    return response.data.data;
  }

  async createUser(userData: CreateUserRequest): Promise<WuzAPIUser> {
    const response = await backendApi.post<any>(`${this.baseUrl}/admin/users`, userData);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create user');
    }
    
    return response.data.data;
  }

  async deleteUser(id: string): Promise<void> {
    const response = await backendApi.delete<void>(`${this.baseUrl}/admin/users/${id}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete user');
    }
  }

  async deleteUserFull(id: string): Promise<void> {
    const response = await backendApi.delete<void>(`${this.baseUrl}/admin/users/${id}/full`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete user completely');
    }
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