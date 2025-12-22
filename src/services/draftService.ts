/**
 * Draft Service
 * Handles message draft persistence operations
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { BackendApiClient } from './api-client';

// Types for draft data
export interface MessageItem {
  id: string;
  content: string;
  delay?: number;
}

export interface SendingWindow {
  startTime: string;
  endTime: string;
  days: number[];
}

export interface HumanizationConfig {
  delayMin: number;
  delayMax: number;
  randomizeOrder: boolean;
}

export interface SelectedInbox {
  id: string;
  name: string;
  phoneNumber?: string;
  wuzapiToken?: string;
  connected: boolean;
}

export interface SendFlowState {
  sendType: 'manual' | 'group' | 'tag' | 'csv' | 'database';
  recipients: Contact[];
  campaignName?: string;
  messages?: MessageItem[];
  // Legacy field for backwards compatibility
  message?: string;
  template?: Template;
  selectedInboxes?: SelectedInbox[];
  humanization?: HumanizationConfig;
  schedule?: ScheduleConfig;
}

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  variables?: Record<string, string>;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  variables?: string[];
}

export interface ScheduleConfig {
  scheduledAt: string;
  timezone?: string;
  sendingWindow?: SendingWindow;
}

export interface Draft {
  id: string;
  userId: string;
  draftType: string;
  data: SendFlowState;
  createdAt: string;
  updatedAt: string;
}

export interface DraftListResponse {
  success: boolean;
  data: Draft[];
  count: number;
}

export interface DraftResponse {
  success: boolean;
  data: Draft;
  message?: string;
}

const apiClient = new BackendApiClient();

export const draftService = {
  /**
   * Save a draft (creates new or updates existing)
   * @param data - The send flow state to save
   * @param draftType - Type of draft (default: 'send_flow')
   */
  async saveDraft(data: SendFlowState, draftType = 'send_flow'): Promise<Draft> {
    try {
      const response = await apiClient.post<DraftResponse>('/user/drafts', {
        draftType,
        data
      });
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao salvar rascunho');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Erro ao salvar rascunho:', error);
      throw new Error(error.message || 'Erro ao salvar rascunho');
    }
  },

  /**
   * Load a draft by type (returns the most recent one)
   * @param draftType - Type of draft to load (default: 'send_flow')
   */
  async loadDraft(draftType = 'send_flow'): Promise<SendFlowState | null> {
    try {
      const response = await apiClient.get<DraftListResponse>('/user/drafts', {
        params: { draft_type: draftType }
      });
      
      if (!response.success || !response.data) {
        return null;
      }
      
      const drafts = response.data.data;
      if (!drafts || drafts.length === 0) {
        return null;
      }
      
      // Return the most recent draft's data
      return drafts[0].data;
    } catch (error: any) {
      console.error('Erro ao carregar rascunho:', error);
      return null;
    }
  },

  /**
   * Load a specific draft by ID
   * @param id - Draft ID
   */
  async loadDraftById(id: string): Promise<Draft | null> {
    try {
      const response = await apiClient.get<DraftResponse>(`/user/drafts/${id}`);
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Erro ao carregar rascunho:', error);
      return null;
    }
  },

  /**
   * List all drafts for the user
   * @param draftType - Optional filter by draft type
   */
  async listDrafts(draftType?: string): Promise<Draft[]> {
    try {
      const params = draftType ? { draft_type: draftType } : {};
      const response = await apiClient.get<DraftListResponse>('/user/drafts', { params });
      
      if (!response.success || !response.data) {
        return [];
      }
      
      return response.data.data || [];
    } catch (error: any) {
      console.error('Erro ao listar rascunhos:', error);
      return [];
    }
  },

  /**
   * Clear/delete a specific draft by ID
   * @param id - Draft ID to delete
   */
  async clearDraft(id: string): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/user/drafts/${id}`);
      return response.success;
    } catch (error: any) {
      console.error('Erro ao excluir rascunho:', error);
      return false;
    }
  },

  /**
   * Clear all drafts of a specific type
   * @param draftType - Type of drafts to clear (default: 'send_flow')
   */
  async clearAllDrafts(draftType?: string): Promise<boolean> {
    try {
      const params = draftType ? { draft_type: draftType } : {};
      const response = await apiClient.delete('/user/drafts', { params });
      return response.success;
    } catch (error: any) {
      console.error('Erro ao excluir rascunhos:', error);
      return false;
    }
  },

  /**
   * Check if a draft exists for the given type
   * @param draftType - Type of draft to check (default: 'send_flow')
   */
  async hasDraft(draftType = 'send_flow'): Promise<boolean> {
    try {
      const drafts = await this.listDrafts(draftType);
      return drafts.length > 0;
    } catch (error: any) {
      console.error('Erro ao verificar rascunho:', error);
      return false;
    }
  }
};

export default draftService;
