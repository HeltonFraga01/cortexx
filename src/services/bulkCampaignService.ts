/**
 * Bulk Campaign Service
 * 
 * Serviço para gerenciar campanhas de disparo em massa
 */

import { BackendApiClient } from './api-client';
import { getErrorMessage, isValidationError, formatErrorList } from '@/utils/errorMessages';

// Interfaces
export interface Contact {
  phone: string;
  name?: string | null;
  variables?: Record<string, string>;
}

export interface CampaignInbox {
  id: string;
  name: string;
  token?: string;
  phoneNumber?: string;
}

export interface CampaignConfig {
  name: string;
  instance: string;
  inboxes?: CampaignInbox[];
  messageType: 'text' | 'media';
  messageContent: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  mediaFileName?: string;
  delayMin: number;
  delayMax: number;
  randomizeOrder: boolean;
  isScheduled: boolean;
  scheduledAt?: string;
  contacts: Contact[];
  messages?: {
    id: string;
    type: 'text' | 'media';
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'document';
    fileName?: string;
  }[];
  sendingWindow?: {
    startTime: string;
    endTime: string;
    days: number[];
  };
}

export interface CampaignStats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  successRate: number;
}

export interface CampaignProgressEnhanced {
  estimatedTimeRemaining: string | null;
  averageSpeed: number;
  elapsedTime: string | null;
  elapsedMs?: number;
  processedCount?: number;
  recentErrors: {
    contactId?: string;
    contactPhone?: string;
    errorType: string;
    errorMessage: string;
    timestamp: string;
  }[];
}

export interface CampaignProgress {
  campaignId: string;
  status: 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  stats: CampaignStats;
  currentIndex?: number;
  currentContact?: Contact | null;
  estimatedTimeRemaining?: number;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  enhanced?: CampaignProgressEnhanced;
}

export interface Campaign {
  id: string;
  name: string;
  instance: string;
  status: string;
  messageType: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  currentIndex: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  isScheduled?: boolean;
  scheduledAt?: string;
  successRate?: number;
  progress?: CampaignStats | null;
}

export interface CampaignError {
  phone: string;
  name?: string;
  status: string;
  errorType?: string;
  errorMessage?: string;
  sentAt?: string;
}

export interface CampaignReport {
  campaignId: string;
  campaignName: string;
  instance: string;
  executedAt: string;
  completedAt: string;
  duration: number;
  stats: CampaignStats;
  errorsByType: Record<string, number>;
  errors: CampaignError[];
  config: {
    messageType: string;
    delayMin: number;
    delayMax: number;
    randomizeOrder: boolean;
  };
}

export interface CampaignComparison {
  campaigns: CampaignReport[];
  averages: {
    successRate: number;
    duration: number;
    totalContacts: number;
  };
  best: CampaignReport | null;
  worst: CampaignReport | null;
  insights: {
    type: 'success' | 'warning' | 'info';
    message: string;
  }[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  instance?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CampaignConfigUpdate {
  delay_min?: number;
  delay_max?: number;
  sending_window?: {
    startTime: string;
    endTime: string;
    days: number[];
  };
  scheduled_at?: string;
}

export interface CampaignConfigUpdateResponse {
  campaignId: string;
  updatedFields: string[];
  message: string;
}

class BulkCampaignService {
  private api: BackendApiClient;
  private baseUrl = 'user/bulk-campaigns';

  constructor() {
    this.api = new BackendApiClient();
  }

  /**
   * Cria uma nova campanha
   */
  async createCampaign(config: CampaignConfig): Promise<{ campaignId: string; status: string }> {
    try {
      const response = await this.api.post<{ campaignId: string; status: string }>(
        this.baseUrl,
        config
      );

      if (!response.success) {
        throw new Error(response.error || 'Falha ao criar campanha');
      }

      if (!response.data) {
        throw new Error('Resposta inválida do servidor');
      }

      return response.data;
    } catch (error: any) {
      // Se for erro de validação, formatar lista de erros
      if (isValidationError(error)) {
        const formattedErrors = formatErrorList(error.response.data.errors);
        throw new Error(formattedErrors);
      }

      // Usar mensagem amigável
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Lista campanhas ativas
   */
  async getActiveCampaigns(instance?: string): Promise<Campaign[]> {
    const params: any = {};
    if (instance) {
      params.instance = instance;
    }

    const response = await this.api.get<{ campaigns: Campaign[] }>(
      `${this.baseUrl}/active`,
      {
        params
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao buscar campanhas ativas');
    }

    return response.data?.campaigns || [];
  }

  /**
   * Obtém progresso de uma campanha
   */
  async getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
    const response = await this.api.get<{ progress: CampaignProgress }>(
      `${this.baseUrl}/${campaignId}/progress`
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao buscar progresso da campanha');
    }

    if (!response.data?.progress) {
      throw new Error('Dados de progresso inválidos');
    }

    return response.data.progress;
  }

  /**
   * Pausa uma campanha
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const response = await this.api.post(
      `${this.baseUrl}/${campaignId}/pause`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao pausar campanha');
    }
  }

  /**
   * Retoma uma campanha pausada
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    const response = await this.api.post(
      `${this.baseUrl}/${campaignId}/resume`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao retomar campanha');
    }
  }

  /**
   * Atualiza configuração de uma campanha em execução ou pausada
   */
  async updateCampaignConfig(
    campaignId: string,
    updates: CampaignConfigUpdate
  ): Promise<CampaignConfigUpdateResponse> {
    try {
      const response = await this.api.patch<CampaignConfigUpdateResponse>(
        `${this.baseUrl}/${campaignId}/config`,
        updates
      );

      if (!response.success) {
        throw new Error(response.error || 'Falha ao atualizar configuração da campanha');
      }

      if (!response.data) {
        throw new Error('Resposta inválida do servidor');
      }

      return response.data;
    } catch (error: any) {
      // Se for erro de validação, formatar lista de erros
      if (isValidationError(error)) {
        const formattedErrors = formatErrorList(error.response.data.errors);
        throw new Error(formattedErrors);
      }

      // Usar mensagem amigável
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Cancela uma campanha
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    const response = await this.api.post(
      `${this.baseUrl}/${campaignId}/cancel`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao cancelar campanha');
    }
  }

  /**
   * Exclui uma campanha
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    try {
      const response = await this.api.delete(
        `${this.baseUrl}/${campaignId}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Falha ao excluir campanha');
      }
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Lista histórico de campanhas com paginação
   */
  async getCampaignHistory(
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<Campaign>> {
    const response = await this.api.get<{
      campaigns: Campaign[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(
      `${this.baseUrl}/history`,
      {
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          instance: params.instance
        }
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao buscar histórico de campanhas');
    }

    return {
      success: true,
      data: response.data?.campaigns || [],
      pagination: response.data?.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1
      }
    };
  }

  /**
   * Obtém relatório de uma campanha
   */
  async getCampaignReport(campaignId: string): Promise<CampaignReport> {
    const response = await this.api.get<{ report: CampaignReport }>(
      `${this.baseUrl}/${campaignId}/report`
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao buscar relatório da campanha');
    }

    if (!response.data?.report) {
      throw new Error('Dados do relatório inválidos');
    }

    return response.data.report;
  }

  /**
   * Exporta relatório em CSV
   */
  async exportReportCSV(campaignId: string): Promise<Blob> {
    const response = await this.api.get<Blob>(
      `${this.baseUrl}/${campaignId}/report/export`,
      {
        responseType: 'blob'
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao exportar relatório');
    }

    if (!response.data) {
      throw new Error('Dados de exportação inválidos');
    }

    return response.data;
  }

  /**
   * Compara múltiplas campanhas
   */
  async compareCampaigns(campaignIds: string[]): Promise<CampaignComparison> {
    const response = await this.api.post<{ comparison: CampaignComparison }>(
      `${this.baseUrl}/compare`,
      { campaignIds }
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao comparar campanhas');
    }

    if (!response.data?.comparison) {
      throw new Error('Dados de comparação inválidos');
    }

    return response.data.comparison;
  }

  /**
   * Formata duração em formato legível
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  /**
   * Calcula taxa de sucesso
   */
  calculateSuccessRate(sent: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((sent / total) * 100 * 100) / 100;
  }

  /**
   * Valida configuração de campanha
   */
  validateCampaignConfig(config: CampaignConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Nome da campanha é obrigatório');
    }

    if (!config.instance) {
      errors.push('Instância é obrigatória');
    }

    if (!config.messageContent || config.messageContent.trim().length === 0) {
      errors.push('Conteúdo da mensagem é obrigatório');
    }

    if (config.messageType === 'media' && !config.mediaUrl) {
      errors.push('URL da mídia é obrigatória para mensagens de mídia');
    }

    if (config.delayMin < 5 || config.delayMin > 300) {
      errors.push('Delay mínimo deve estar entre 5 e 300 segundos');
    }

    if (config.delayMax < 5 || config.delayMax > 300) {
      errors.push('Delay máximo deve estar entre 5 e 300 segundos');
    }

    if (config.delayMin > config.delayMax) {
      errors.push('Delay mínimo não pode ser maior que o máximo');
    }

    if (!config.contacts || config.contacts.length === 0) {
      errors.push('É necessário adicionar pelo menos um contato');
    }

    if (config.isScheduled && !config.scheduledAt) {
      errors.push('Data de agendamento é obrigatória para campanhas agendadas');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtém mensagem de erro amigável
   */
  getErrorMessage(errorType: string): string {
    const messages: Record<string, string> = {
      invalid_number: 'Número de telefone inválido',
      disconnected: 'Número desconectado ou inexistente',
      timeout: 'Tempo de espera esgotado',
      api_error: 'Erro na API do WhatsApp'
    };

    return messages[errorType] || 'Erro desconhecido';
  }

  /**
   * Obtém cor do status
   */
  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      scheduled: 'blue',
      running: 'green',
      paused: 'yellow',
      completed: 'gray',
      cancelled: 'red',
      failed: 'red'
    };

    return colors[status] || 'gray';
  }

  /**
   * Obtém label do status
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      scheduled: 'Agendada',
      running: 'Em execução',
      paused: 'Pausada',
      completed: 'Concluída',
      cancelled: 'Cancelada',
      failed: 'Falhou'
    };

    return labels[status] || status;
  }

  /**
   * Lista campanhas filtradas por status com paginação
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async listByStatus(
    status: CampaignCategory,
    page = 1,
    limit = 20,
    instance?: string
  ): Promise<PaginatedResponse<Campaign>> {
    const statusMap: Record<CampaignCategory, string[]> = {
      scheduled: ['scheduled'],
      running: ['running', 'paused'],
      completed: ['completed', 'cancelled', 'failed']
    };

    const statuses = statusMap[status] || [];

    const response = await this.api.get<{
      campaigns: Campaign[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(
      `${this.baseUrl}/history`,
      {
        params: {
          page,
          limit,
          instance,
          status: statuses.join(',')
        }
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Falha ao buscar campanhas');
    }

    return {
      success: true,
      data: response.data?.campaigns || [],
      pagination: response.data?.pagination || {
        page: 1,
        limit,
        total: 0,
        totalPages: 1
      }
    };
  }

  /**
   * Categoriza uma campanha em uma das três categorias principais
   * Requirements: 2.1
   * @param campaign - Campaign to categorize
   * @returns Category: 'scheduled' | 'running' | 'completed'
   */
  categorizeCampaign(campaign: Campaign): CampaignCategory {
    const status = campaign.status?.toLowerCase();
    
    if (status === 'scheduled') {
      return 'scheduled';
    }
    
    if (status === 'running' || status === 'paused') {
      return 'running';
    }
    
    // completed, cancelled, failed all go to 'completed' category
    return 'completed';
  }

  /**
   * Calcula métricas de progresso de uma campanha
   * Requirements: 2.3, 2.4
   */
  calculateProgressMetrics(campaign: Campaign): {
    sentCount: number;
    pendingCount: number;
    errorCount: number;
    totalContacts: number;
    deliveryRate: number;
    isConsistent: boolean;
  } {
    const totalContacts = campaign.totalContacts || 0;
    const sentCount = campaign.sentCount || 0;
    const errorCount = campaign.failedCount || 0;
    const pendingCount = Math.max(0, totalContacts - sentCount - errorCount);
    
    const deliveryRate = totalContacts > 0
      ? Math.round((sentCount / totalContacts) * 100 * 100) / 100
      : 0;

    // Verify consistency: sent + pending + errors should equal total
    const isConsistent = (sentCount + pendingCount + errorCount) === totalContacts;

    return {
      sentCount,
      pendingCount,
      errorCount,
      totalContacts,
      deliveryRate,
      isConsistent
    };
  }

  /**
   * Agrupa campanhas por categoria
   * Requirements: 2.1
   */
  groupByCategory(campaigns: Campaign[]): Record<CampaignCategory, Campaign[]> {
    const grouped: Record<CampaignCategory, Campaign[]> = {
      scheduled: [],
      running: [],
      completed: []
    };

    campaigns.forEach(campaign => {
      const category = this.categorizeCampaign(campaign);
      grouped[category].push(campaign);
    });

    return grouped;
  }
}

// Campaign category type for UI tabs
export type CampaignCategory = 'scheduled' | 'running' | 'completed';

// Exportar instância singleton
export const bulkCampaignService = new BulkCampaignService();
export default bulkCampaignService;
