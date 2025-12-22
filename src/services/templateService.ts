/**
 * Template Service
 * Handles campaign template operations with pagination support
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { BackendApiClient } from './api-client';
import { CampaignConfig } from './bulkCampaignService';

export interface CampaignTemplate {
  id: string;
  name: string;
  description?: string;
  config: Partial<CampaignConfig>;
  createdAt: string;
  updatedAt?: string;
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

export interface CreateTemplateDTO {
  name: string;
  description?: string;
  config: Partial<CampaignConfig>;
}

export interface UpdateTemplateDTO {
  name?: string;
  description?: string;
  config?: Partial<CampaignConfig>;
}

const apiClient = new BackendApiClient();

export const templateService = {
  /**
   * List templates with pagination
   * @param page - Page number (1-based)
   * @param limit - Items per page (default: 10)
   * @param userToken - User authentication token
   */
  async list(
    page = 1,
    limit = 10,
    userToken?: string
  ): Promise<PaginatedResult<CampaignTemplate>> {
    try {
      const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
      const response = await apiClient.get('/user/templates', {
        params: { page, limit },
        headers
      });
      
      return {
        data: response.data.templates || [],
        pagination: response.data.pagination || {
          page,
          limit,
          total: response.data.templates?.length || 0,
          totalPages: 1,
          hasMore: false
        }
      };
    } catch (error: any) {
      console.error('Erro ao listar templates:', error);
      throw new Error(error.response?.data?.message || 'Erro ao carregar templates');
    }
  },

  /**
   * Get a single template by ID
   * @param id - Template ID
   * @param userToken - User authentication token
   */
  async get(id: string, userToken?: string): Promise<CampaignTemplate> {
    try {
      const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
      const response = await apiClient.get(`/user/templates/${id}`, { headers });
      return response.data.template;
    } catch (error: any) {
      console.error('Erro ao buscar template:', error);
      throw new Error(error.response?.data?.message || 'Erro ao carregar template');
    }
  },

  /**
   * Create a new template
   * @param data - Template data
   * @param userToken - User authentication token
   */
  async create(data: CreateTemplateDTO, userToken?: string): Promise<CampaignTemplate> {
    try {
      const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
      const response = await apiClient.post('/user/templates', data, { headers });
      return response.data.template;
    } catch (error: any) {
      console.error('Erro ao criar template:', error);
      throw new Error(error.response?.data?.message || 'Erro ao salvar template');
    }
  },

  /**
   * Update an existing template
   * @param id - Template ID
   * @param data - Updated template data
   * @param userToken - User authentication token
   */
  async update(id: string, data: UpdateTemplateDTO, userToken?: string): Promise<CampaignTemplate> {
    try {
      const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
      const response = await apiClient.put(`/user/templates/${id}`, data, { headers });
      return response.data.template;
    } catch (error: any) {
      console.error('Erro ao atualizar template:', error);
      throw new Error(error.response?.data?.message || 'Erro ao atualizar template');
    }
  },

  /**
   * Delete a template
   * @param id - Template ID
   * @param userToken - User authentication token
   */
  async delete(id: string, userToken?: string): Promise<void> {
    try {
      const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
      await apiClient.delete(`/user/templates/${id}`, { headers });
    } catch (error: any) {
      console.error('Erro ao excluir template:', error);
      throw new Error(error.response?.data?.message || 'Erro ao excluir template');
    }
  },

  // Legacy methods for backward compatibility
  /**
   * @deprecated Use list() instead
   */
  async getTemplates(userToken: string): Promise<CampaignTemplate[]> {
    const result = await this.list(1, 100, userToken);
    return result.data;
  },

  /**
   * @deprecated Use create() instead
   */
  async createTemplate(
    name: string,
    description: string,
    config: Partial<CampaignConfig>,
    userToken: string
  ): Promise<CampaignTemplate> {
    return this.create({ name, description, config }, userToken);
  },

  /**
   * @deprecated Use delete() instead
   */
  async deleteTemplate(id: string, userToken: string): Promise<void> {
    return this.delete(id, userToken);
  }
};

export default templateService;
