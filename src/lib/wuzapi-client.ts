/**
 * WuzAPI Client
 * Cliente completo para interação com a WuzAPI
 * Suporta autenticação dupla: Admin (Authorization) e User (token)
 */

import {
  WuzAPIAuthConfig,
  WuzAPIResponse,
  WuzAPIError,
  WuzAPIUser,
  WuzAPIUserResponse,
  WuzAPIUsersResponse,
  CreateUserPayload,
  UpdateUserPayload,
  SendTextMessagePayload,
  SendMediaMessagePayload,
  SendLocationMessagePayload,
  SendContactMessagePayload,
  SendReactionPayload,
  WuzAPIMessageResponse,
  WuzAPIMessagesResponse,
  WuzAPIChatResponse,
  WuzAPIChatsResponse,
  WuzAPIContactResponse,
  WuzAPIContactsResponse,
  WuzAPIGroupResponse,
  WuzAPIGroupsResponse,
  CreateGroupPayload,
  UpdateGroupPayload,
  GroupInvitePayload,
  GroupRemovePayload,
  GroupPromotePayload,
  GroupDemotePayload,
  WuzAPIWebhookConfig,
  WuzAPIStatusResponse,
  SetPresencePayload,
  SetStatusPayload,
  WuzAPIMediaResponse,
  UploadMediaPayload,
  WuzAPISettingsResponse,
  WuzAPISettings,
  WuzAPIStatsResponse,
  WuzAPIInstance,
  CreateInstancePayload,
} from './wuzapi-types';
import { mapRawUsersToWuzAPIUsers, type RawWuzAPIUser } from './wuzapi-utils';

export class WuzAPIClient {
  private config: WuzAPIAuthConfig;

  constructor(config: WuzAPIAuthConfig) {
    this.config = config;
  }

  /**
   * Valida se o telefone não está vazio
   */
  private validatePhone(phone: string): { valid: boolean; error?: string } {
    if (!phone || phone.trim() === '') {
      return {
        valid: false,
        error: 'Telefone não pode estar vazio'
      };
    }
    return { valid: true };
  }

  // ============================================================================
  // MÉTODOS AUXILIARES
  // ============================================================================

  /**
   * Realiza requisição HTTP para a WuzAPI
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      useUserToken?: boolean;
      userPhone?: string;
    } = {}
  ): Promise<WuzAPIResponse<T>> {
    const { method = 'GET', body, useUserToken = false, userPhone } = options;

    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Autenticação dupla: Admin ou User
    if (useUserToken) {
      if (!this.config.userToken && !userPhone) {
        throw new Error('Token de usuário ou telefone é necessário para esta operação');
      }
      headers.token = this.config.userToken || userPhone || '';
    } else {
      headers.Authorization = this.config.adminToken;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          message: data.message || 'Erro na requisição',
          code: response.status,
        } as WuzAPIError;
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        message: 'Falha na comunicação com a API',
      } as WuzAPIError;
    }
  }

  /**
   * Atualiza configuração do cliente
   */
  public updateConfig(config: Partial<WuzAPIAuthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Define token de usuário para operações específicas
   */
  public setUserToken(token: string): void {
    this.config.userToken = token;
  }

  // ============================================================================
  // MÉTODOS HTTP BÁSICOS
  // ============================================================================

  /**
   * Método GET genérico
   */
  public async get<T>(endpoint: string, options: { useUserToken?: boolean; userPhone?: string } = {}): Promise<WuzAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...options });
  }

  /**
   * Método POST genérico
   */
  public async post<T>(endpoint: string, body?: unknown, options: { useUserToken?: boolean; userPhone?: string } = {}): Promise<WuzAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, ...options });
  }

  /**
   * Método PUT genérico
   */
  public async put<T>(endpoint: string, body?: unknown, options: { useUserToken?: boolean; userPhone?: string } = {}): Promise<WuzAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, ...options });
  }

  /**
   * Método DELETE genérico
   */
  public async delete<T>(endpoint: string, options: { useUserToken?: boolean; userPhone?: string } = {}): Promise<WuzAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', ...options });
  }

  // ============================================================================
  // GERENCIAMENTO DE INSTÂNCIAS
  // ============================================================================

  /**
   * Lista todas as instâncias
   */
  public async listInstances(): Promise<WuzAPIResponse<WuzAPIInstance[]>> {
    return this.get<WuzAPIInstance[]>('/instances');
  }

  /**
   * Cria uma nova instância
   */
  public async createInstance(payload: CreateInstancePayload): Promise<WuzAPIResponse<WuzAPIInstance>> {
    return this.post<WuzAPIInstance>('/instances', payload);
  }

  /**
   * Obtém informações de uma instância específica
   */
  public async getInstance(instanceName: string): Promise<WuzAPIResponse<WuzAPIInstance>> {
    return this.get<WuzAPIInstance>(`/instances/${instanceName}`);
  }

  /**
   * Remove uma instância
   */
  public async deleteInstance(instanceName: string): Promise<WuzAPIResponse> {
    return this.delete(`/instances/${instanceName}`);
  }

  /**
   * Conecta uma instância
   */
  public async connectInstance(instanceName: string): Promise<WuzAPIResponse> {
    return this.post(`/instances/${instanceName}/connect`);
  }

  /**
   * Desconecta uma instância
   */
  public async disconnectInstance(instanceName: string): Promise<WuzAPIResponse> {
    return this.post(`/instances/${instanceName}/disconnect`);
  }

  /**
   * Obtém o QR Code de uma instância
   */
  public async getInstanceQRCode(instanceName: string): Promise<WuzAPIResponse<{ qr_code: string }>> {
    return this.get<{ qr_code: string }>(`/instances/${instanceName}/qr`);
  }

  // ============================================================================
  // GERENCIAMENTO DE USUÁRIOS (ADMIN)
  // ============================================================================

  /**
   * Lista todos os usuários (Admin)
   */
  public async listUsers(): Promise<WuzAPIUsersResponse> {
    const response = await this.request<RawWuzAPIUser[]>('/admin/users');
    
    if (response.success && response.data) {
      // Mapeia os dados brutos da API para o formato esperado
      const mappedUsers = mapRawUsersToWuzAPIUsers(response.data);
      return {
        success: response.success,
        message: response.message,
        data: mappedUsers,
        error: response.error,
        code: response.code,
      };
    }
    
    return {
      success: false,
      error: response.error || 'Falha ao carregar usuários',
      message: response.message || 'Erro desconhecido',
      code: response.code,
    };
  }

  /**
   * Cria novo usuário (Admin)
   */
  public async createUser(payload: CreateUserPayload): Promise<WuzAPIUserResponse> {
    return this.request<WuzAPIUser>('/admin/users', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Obtém informações de um usuário específico (Admin)
   */
  public async getUser(phone: string): Promise<WuzAPIUserResponse> {
    const validation = this.validatePhone(phone);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Telefone inválido',
        message: validation.error || 'Telefone não pode estar vazio',
      };
    }
    
    return this.request<WuzAPIUser>(`/admin/users/${phone}`);
  }

  /**
   * Atualiza usuário (Admin)
   */
  public async updateUser(phone: string, payload: UpdateUserPayload): Promise<WuzAPIUserResponse> {
    return this.request<WuzAPIUser>(`/admin/users/${phone}`, {
      method: 'PUT',
      body: payload,
    });
  }

  /**
   * Remove usuário (Admin)
   */
  public async deleteUser(phone: string): Promise<WuzAPIResponse> {
    // Para exclusão, permitimos telefone vazio (usuários podem ser criados sem telefone)
    // Mas ainda validamos se o parâmetro não é null/undefined
    if (phone === null || phone === undefined) {
      return {
        success: false,
        error: 'Identificador do usuário inválido',
        message: 'Identificador do usuário não pode ser nulo',
      };
    }
    
    // Se o telefone estiver vazio, usamos um identificador especial
    const userIdentifier = phone.trim() === '' ? 'empty-phone' : phone;
    
    return this.request(`/admin/users/${userIdentifier}`, {
      method: 'DELETE',
    });
  }

  /**
   * Conecta um usuário ao WhatsApp usando seu token
   */
  public async connectUser(userToken: string): Promise<WuzAPIResponse> {
    if (!userToken || userToken.trim() === '') {
      return {
        success: false,
        error: 'Token do usuário é obrigatório',
        message: 'Token do usuário não pode estar vazio',
      };
    }

    // Fazer requisição direta com o token do usuário
    try {
      const response = await fetch(`${this.config.baseUrl}/session/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': userToken, // WuzAPI usa 'token' header para autenticação do usuário
        },
        body: JSON.stringify({
          // Parâmetros opcionais conforme spec.yml
          Subscribe: [], // Array de eventos para subscrever (opcional)
          Immediate: true // Conectar imediatamente (opcional)
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Erro ao conectar usuário',
          message: data.message || `Erro HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message || 'Usuário conectado com sucesso',
      };
    } catch (error) {
      console.error('Erro ao conectar usuário:', error);
      return {
        success: false,
        error: 'Erro de conexão',
        message: 'Não foi possível conectar com a API',
      };
    }
  }

  /**
   * Desconecta usuário do WhatsApp (usando token do usuário)
   */
  public async disconnectUser(phone: string): Promise<WuzAPIResponse> {
    const validation = this.validatePhone(phone);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Telefone inválido',
        message: validation.error || 'Telefone não pode estar vazio',
      };
    }

    // Primeiro, buscar o usuário para obter o token
    const userResponse = await this.getUser(phone);
    if (!userResponse.success || !userResponse.data) {
      return {
        success: false,
        error: 'Usuário não encontrado',
        message: `Não foi possível encontrar o usuário com telefone ${phone}`,
      };
    }

    const userToken = userResponse.data.token;
    
    try {
      const response = await fetch(`${this.config.baseUrl}/session/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': userToken,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Erro ao desconectar usuário',
          message: data.message || `Erro HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Erro ao desconectar usuário:', error);
      return {
        success: false,
        error: 'Erro de conexão',
        message: 'Não foi possível conectar com a API',
      };
    }
  }

  /**
   * Obtém QR Code para conexão do usuário usando seu token
   */
  public async getUserQRCode(userToken: string): Promise<WuzAPIResponse<{ qr_code: string }>> {
    if (!userToken || userToken.trim() === '') {
      return {
        success: false,
        error: 'Token do usuário é obrigatório',
        message: 'Token do usuário não pode estar vazio',
      };
    }

    // Fazer requisição direta com o token do usuário
    try {
      const response = await fetch(`${this.config.baseUrl}/session/qr`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'token': userToken, // WuzAPI usa 'token' header para autenticação do usuário
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Erro ao obter QR Code',
          message: data.message || `Erro HTTP ${response.status}`,
        };
      }

      // A API retorna { "code": 200, "data": { "QRCode": "data:image/png;base64,..." }, "success": true }
      return {
        success: true,
        data: {
          qr_code: data.data?.QRCode || data.data?.qr_code || data.QRCode || '',
        },
      };
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      return {
        success: false,
        error: 'Erro de conexão',
        message: 'Não foi possível conectar com a API',
      };
    }
  }

  /**
   * Obtém status da sessão do usuário (usando token do usuário)
   */
  public async getUserStatus(phone: string): Promise<WuzAPIStatusResponse> {
    const validation = this.validatePhone(phone);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Telefone inválido',
        message: validation.error || 'Telefone não pode estar vazio',
      };
    }

    // Primeiro, buscar o usuário para obter o token
    const userResponse = await this.getUser(phone);
    if (!userResponse.success || !userResponse.data) {
      return {
        success: false,
        error: 'Usuário não encontrado',
        message: `Não foi possível encontrar o usuário com telefone ${phone}`,
      };
    }

    const userToken = userResponse.data.token;
    
    // Usar o endpoint correto /session/status com o token do usuário
    const statusResponse = await this.request<{ Connected: boolean; LoggedIn: boolean }>('/session/status', {
      method: 'GET',
      useUserToken: true,
      userPhone: userToken, // Usar o token real do usuário
    });

    // Mapear a resposta para o formato esperado
    if (statusResponse.success && statusResponse.data) {
      const { Connected, LoggedIn } = statusResponse.data;
      const status = Connected && LoggedIn ? 'connected' : 'disconnected';
      
      return {
        success: true,
        data: {
          phone,
          status,
          profile: {
            name: userResponse.data.name,
          },
        },
      };
    }

    return {
      success: false,
      error: 'Erro ao obter status',
      message: statusResponse.message || 'Não foi possível obter o status do usuário',
    };
  }

  // ============================================================================
  // ENVIO DE MENSAGENS (USER)
  // ============================================================================

  /**
   * Envia mensagem de texto
   */
  public async sendTextMessage(payload: SendTextMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/text', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia imagem
   */
  public async sendImageMessage(payload: SendMediaMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/image', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia vídeo
   */
  public async sendVideoMessage(payload: SendMediaMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/video', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia áudio
   */
  public async sendAudioMessage(payload: SendMediaMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/audio', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia documento
   */
  public async sendDocumentMessage(payload: SendMediaMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/document', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia sticker
   */
  public async sendStickerMessage(payload: SendMediaMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/sticker', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia mídia (método genérico que redireciona para o método específico)
   * @deprecated Use os métodos específicos: sendImageMessage, sendVideoMessage, sendAudioMessage, sendDocumentMessage, sendStickerMessage
   */
  public async sendMediaMessage(payload: SendMediaMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    // Redireciona para o método específico baseado no tipo
    switch (payload.type) {
      case 'image':
        return this.sendImageMessage(payload, userPhone);
      case 'video':
        return this.sendVideoMessage(payload, userPhone);
      case 'audio':
        return this.sendAudioMessage(payload, userPhone);
      case 'document':
        return this.sendDocumentMessage(payload, userPhone);
      default:
        throw new Error(`Tipo de mídia não suportado: ${payload.type}`);
    }
  }

  /**
   * Envia localização
   */
  public async sendLocationMessage(payload: SendLocationMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/location', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia contato
   */
  public async sendContactMessage(payload: SendContactMessagePayload, userPhone?: string): Promise<WuzAPIMessageResponse> {
    return this.request('/chat/send/contact', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Envia reação a mensagem
   */
  public async sendReaction(payload: SendReactionPayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request('/chat/send/reaction', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // GERENCIAMENTO DE CHATS (USER)
  // ============================================================================

  /**
   * Lista chats do usuário
   */
  public async getChats(userPhone?: string): Promise<WuzAPIChatsResponse> {
    return this.request('/chat/list', {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Obtém mensagens de um chat específico
   */
  public async getChatMessages(chatId: string, userPhone?: string): Promise<WuzAPIMessagesResponse> {
    return this.request(`/chat/messages/${chatId}`, {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Marca mensagens como lidas
   */
  public async markAsRead(chatId: string, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/chat/read/${chatId}`, {
      method: 'POST',
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Arquiva chat
   */
  public async archiveChat(chatId: string, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/chat/archive/${chatId}`, {
      method: 'POST',
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Desarquiva chat
   */
  public async unarchiveChat(chatId: string, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/chat/unarchive/${chatId}`, {
      method: 'POST',
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // GERENCIAMENTO DE CONTATOS (USER)
  // ============================================================================

  /**
   * Lista contatos do usuário
   */
  public async getContacts(userPhone?: string): Promise<WuzAPIContactsResponse> {
    return this.request('/contact/list', {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Obtém informações de um contato específico
   */
  public async getContact(contactPhone: string, userPhone?: string): Promise<WuzAPIContactResponse> {
    return this.request(`/contact/get/${contactPhone}`, {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Bloqueia contato
   */
  public async blockContact(contactPhone: string, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/contact/block/${contactPhone}`, {
      method: 'POST',
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Desbloqueia contato
   */
  public async unblockContact(contactPhone: string, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/contact/unblock/${contactPhone}`, {
      method: 'POST',
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // GERENCIAMENTO DE GRUPOS (USER)
  // ============================================================================

  /**
   * Lista grupos do usuário
   */
  public async getGroups(userPhone?: string): Promise<WuzAPIGroupsResponse> {
    return this.request('/group/list', {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Cria novo grupo
   */
  public async createGroup(payload: CreateGroupPayload, userPhone?: string): Promise<WuzAPIGroupResponse> {
    return this.request('/group/create', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Obtém informações de um grupo específico
   */
  public async getGroup(groupId: string, userPhone?: string): Promise<WuzAPIGroupResponse> {
    return this.request(`/group/get/${groupId}`, {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Atualiza informações do grupo
   */
  public async updateGroup(groupId: string, payload: UpdateGroupPayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/group/update/${groupId}`, {
      method: 'PUT',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Adiciona participantes ao grupo
   */
  public async addGroupParticipants(groupId: string, payload: GroupInvitePayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/group/add/${groupId}`, {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Remove participantes do grupo
   */
  public async removeGroupParticipants(groupId: string, payload: GroupRemovePayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/group/remove/${groupId}`, {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Promove participantes a administradores
   */
  public async promoteGroupParticipants(groupId: string, payload: GroupPromotePayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/group/promote/${groupId}`, {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Remove administradores do grupo
   */
  public async demoteGroupParticipants(groupId: string, payload: GroupDemotePayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/group/demote/${groupId}`, {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Sai do grupo
   */
  public async leaveGroup(groupId: string, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request(`/group/leave/${groupId}`, {
      method: 'POST',
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // WEBHOOKS (USER)
  // ============================================================================

  /**
   * Configura webhook para o usuário
   */
  public async setWebhook(config: WuzAPIWebhookConfig, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request('/webhook/set', {
      method: 'POST',
      body: config,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Obtém configuração de webhook do usuário
   */
  public async getWebhook(userPhone?: string): Promise<WuzAPIResponse<WuzAPIWebhookConfig>> {
    return this.request('/webhook/get', {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Remove webhook do usuário
   */
  public async removeWebhook(userPhone?: string): Promise<WuzAPIResponse> {
    return this.request('/webhook/remove', {
      method: 'DELETE',
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // STATUS E PRESENÇA (USER)
  // ============================================================================

  /**
   * Define presença do usuário
   */
  public async setPresence(payload: SetPresencePayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request('/user/presence', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Define status do usuário
   */
  public async setStatus(payload: SetStatusPayload, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request('/status/set/text', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // MÍDIA (USER)
  // ============================================================================

  /**
   * Faz upload de mídia
   */
  public async uploadMedia(payload: UploadMediaPayload, userPhone?: string): Promise<WuzAPIMediaResponse> {
    return this.request('/media/upload', {
      method: 'POST',
      body: payload,
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Obtém URL de mídia
   */
  public async getMediaUrl(mediaId: string, userPhone?: string): Promise<WuzAPIResponse<{ url: string }>> {
    return this.request(`/media/get/${mediaId}`, {
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // CONFIGURAÇÕES (USER)
  // ============================================================================

  /**
   * Obtém configurações do usuário
   */
  public async getSettings(userPhone?: string): Promise<WuzAPISettingsResponse> {
    return this.request('/settings/get', {
      useUserToken: true,
      userPhone,
    });
  }

  /**
   * Atualiza configurações do usuário
   */
  public async updateSettings(settings: Partial<WuzAPISettings>, userPhone?: string): Promise<WuzAPIResponse> {
    return this.request('/settings/update', {
      method: 'PUT',
      body: settings,
      useUserToken: true,
      userPhone,
    });
  }

  // ============================================================================
  // ESTATÍSTICAS E ADMIN (ADMIN)
  // ============================================================================

  /**
   * Obtém estatísticas gerais (Admin)
   */
  public async getStats(): Promise<WuzAPIStatsResponse> {
    return this.request('/admin/stats');
  }

  /**
   * Obtém logs do sistema (Admin)
   */
  public async getLogs(limit = 100): Promise<WuzAPIResponse<string[]>> {
    return this.request(`/admin/logs?limit=${limit}`);
  }

  /**
   * Reinicia sistema (Admin)
   */
  public async restartSystem(): Promise<WuzAPIResponse> {
    return this.request('/admin/restart', {
      method: 'POST',
    });
  }

  // ============================================================================
  // MÉTODOS DE CONVENIÊNCIA
  // ============================================================================

  /**
   * Obtém informações da API
   */
  public async getApiInfo(): Promise<WuzAPIResponse<{ version: string; uptime: number }>> {
    return this.request('/info');
  }

  /**
   * Valida token de admin tentando listar usuários
   */
  public async validateAdminToken(): Promise<WuzAPIResponse<{ valid: boolean }>> {
    try {
      const result = await this.listUsers();
      if (result.success) {
        return {
          success: true,
          data: { valid: true },
          message: 'Token admin válido'
        };
      } else {
        return {
          success: false,
          data: { valid: false },
          message: 'Token admin inválido',
          error: result.error || 'Falha na validação do token'
        };
      }
    } catch (error) {
      return {
        success: false,
        data: { valid: false },
        message: 'Token admin inválido',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}

// ============================================================================
// FACTORY E HELPERS
// ============================================================================

/**
 * Cria instância do cliente WuzAPI
 */
export function createWuzAPIClient(config: WuzAPIAuthConfig): WuzAPIClient {
  return new WuzAPIClient(config);
}

/**
 * Cria cliente WuzAPI apenas para operações de admin
 */
export function createAdminClient(baseUrl: string, adminToken: string): WuzAPIClient {
  return new WuzAPIClient({
    baseUrl,
    adminToken,
  });
}

/**
 * Cria cliente WuzAPI para operações de usuário específico
 */
export function createUserClient(baseUrl: string, adminToken: string, userToken: string): WuzAPIClient {
  return new WuzAPIClient({
    baseUrl,
    adminToken,
    userToken,
  });
}

export default WuzAPIClient;