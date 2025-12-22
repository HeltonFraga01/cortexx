/**
 * API Settings Service
 * Frontend service for managing WUZAPI configuration
 */

import { backendApi } from './api-client';

interface SettingWithSource {
  value: string | number | null;
  source: 'database' | 'environment';
  masked?: boolean;
  hasValue?: boolean;
}

export interface ApiSettings {
  wuzapiBaseUrl: SettingWithSource;
  wuzapiAdminToken: SettingWithSource;
  wuzapiTimeout: SettingWithSource;
}

export interface ApiSettingsUpdate {
  wuzapiBaseUrl?: string;
  wuzapiAdminToken?: string;
  wuzapiTimeout?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  details: string;
  responseTime?: number;
}

const API_BASE = '/admin/api-settings';

/**
 * Get current API settings
 */
export async function getApiSettings(): Promise<ApiSettings> {
  const response = await backendApi.get<{ success: boolean; data: ApiSettings }>(API_BASE);
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao carregar configurações');
  }

  return response.data?.data!;
}

/**
 * Update API settings
 */
export async function updateApiSettings(settings: ApiSettingsUpdate): Promise<ApiSettings> {
  const response = await backendApi.put<{ success: boolean; data: ApiSettings }>(API_BASE, settings);
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao salvar configurações');
  }

  return response.data?.data!;
}

/**
 * Test API connection with current settings
 */
export async function testApiConnection(): Promise<ConnectionTestResult> {
  const response = await backendApi.post<{ success: boolean; data: ConnectionTestResult }>(`${API_BASE}/test`);
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao testar conexão');
  }

  return response.data?.data!;
}

/**
 * Delete a specific setting (revert to env fallback)
 */
export async function deleteApiSetting(key: 'baseUrl' | 'adminToken' | 'timeout'): Promise<ApiSettings> {
  const response = await backendApi.delete<{ success: boolean; data: ApiSettings }>(`${API_BASE}/${key}`);
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao remover configuração');
  }

  return response.data?.data!;
}
