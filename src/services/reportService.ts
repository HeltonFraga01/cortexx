/**
 * Report Service
 * Handles campaign report operations with filtering and export
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { BackendApiClient } from './api-client';

// Types
export type CampaignStatus = 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface ReportFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  status?: CampaignStatus[];
  campaignType?: string;
  instance?: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  instance: string;
  status: CampaignStatus;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  deliveryRate: number;
  createdAt: string;
  completedAt?: string;
}

export interface ContactResult {
  phone: string;
  name?: string;
  status: 'sent' | 'failed' | 'pending';
  errorType?: string;
  errorMessage?: string;
  sentAt?: string;
}

export interface CampaignMetrics {
  deliveryRate: number;
  errorsByType: Record<string, number>;
  averageSendTime: number;
  totalDuration?: number;
}

export interface CampaignReport {
  campaign: {
    id: string;
    name: string;
    instance: string;
    status: CampaignStatus;
    totalContacts: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
  };
  metrics: CampaignMetrics;
  contacts: ContactResult[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const apiClient = new BackendApiClient();

export const reportService = {
  /**
   * List campaign reports with filters and pagination
   * @param filters - Filter criteria
   * @param page - Page number (1-based)
   * @param limit - Items per page
   */
  async list(
    filters: ReportFilters = {},
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResult<CampaignSummary>> {
    try {
      const params: Record<string, any> = {
        page,
        limit
      };

      // Add filters to params
      if (filters.dateRange?.start) {
        params.startDate = filters.dateRange.start;
      }
      if (filters.dateRange?.end) {
        params.endDate = filters.dateRange.end;
      }
      if (filters.status && filters.status.length > 0) {
        params.status = filters.status.join(',');
      }
      if (filters.campaignType) {
        params.type = filters.campaignType;
      }
      if (filters.instance) {
        params.instance = filters.instance;
      }

      const response = await apiClient.get('/user/reports', { params });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar relatórios');
      }

      return {
        data: response.data.reports || [],
        pagination: response.data.pagination || {
          page,
          limit,
          total: 0,
          totalPages: 1,
          hasMore: false
        }
      };
    } catch (error: any) {
      console.error('Erro ao listar relatórios:', error);
      throw new Error(error.message || 'Erro ao carregar relatórios');
    }
  },

  /**
   * Get detailed report for a specific campaign
   * @param campaignId - Campaign ID
   */
  async getDetail(campaignId: string): Promise<CampaignReport> {
    try {
      const response = await apiClient.get(`/user/reports/${campaignId}`);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar relatório');
      }

      return response.data.report;
    } catch (error: any) {
      console.error('Erro ao buscar relatório:', error);
      throw new Error(error.message || 'Erro ao carregar relatório');
    }
  },

  /**
   * Export report to CSV or PDF
   * @param campaignId - Campaign ID
   * @param format - Export format ('csv' or 'pdf')
   */
  async export(campaignId: string, format: 'csv' | 'pdf' = 'csv'): Promise<Blob> {
    try {
      const response = await apiClient.get(
        `/user/reports/${campaignId}/export`,
        {
          params: { format },
          responseType: 'blob'
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao exportar relatório');
      }

      return response.data as Blob;
    } catch (error: any) {
      console.error('Erro ao exportar relatório:', error);
      throw new Error(error.message || 'Erro ao exportar relatório');
    }
  },

  /**
   * Download exported report as file
   * @param campaignId - Campaign ID
   * @param format - Export format
   * @param filename - Optional custom filename
   */
  async downloadReport(
    campaignId: string,
    format: 'csv' | 'pdf' = 'csv',
    filename?: string
  ): Promise<void> {
    try {
      const blob = await this.export(campaignId, format);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `relatorio-${campaignId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Erro ao baixar relatório:', error);
      throw new Error(error.message || 'Erro ao baixar relatório');
    }
  },

  /**
   * Calculate delivery rate from counts
   * @param sentCount - Number of messages sent
   * @param totalContacts - Total number of contacts
   */
  calculateDeliveryRate(sentCount: number, totalContacts: number): number {
    if (totalContacts === 0) return 0;
    return Math.round((sentCount / totalContacts) * 100 * 100) / 100;
  },

  /**
   * Get status label in Portuguese
   * @param status - Campaign status
   */
  getStatusLabel(status: CampaignStatus): string {
    const labels: Record<CampaignStatus, string> = {
      scheduled: 'Agendada',
      running: 'Em execução',
      paused: 'Pausada',
      completed: 'Concluída',
      cancelled: 'Cancelada',
      failed: 'Falhou'
    };
    return labels[status] || status;
  },

  /**
   * Get status color for UI
   * @param status - Campaign status
   */
  getStatusColor(status: CampaignStatus): string {
    const colors: Record<CampaignStatus, string> = {
      scheduled: 'blue',
      running: 'green',
      paused: 'yellow',
      completed: 'gray',
      cancelled: 'red',
      failed: 'red'
    };
    return colors[status] || 'gray';
  },

  /**
   * Format duration in human-readable format
   * @param seconds - Duration in seconds
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
  },

  /**
   * Get error type label in Portuguese
   * @param errorType - Error type code
   */
  getErrorTypeLabel(errorType: string): string {
    const labels: Record<string, string> = {
      invalid_number: 'Número inválido',
      disconnected: 'Desconectado',
      timeout: 'Tempo esgotado',
      api_error: 'Erro de API',
      rate_limit: 'Limite de taxa',
      blocked: 'Bloqueado',
      unknown: 'Desconhecido'
    };
    return labels[errorType] || errorType;
  }
};

export default reportService;
