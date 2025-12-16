/**
 * Custom Themes Service
 * 
 * API client for custom page builder themes.
 */

import { backendApi, type ApiResponse } from './api-client';
import type { ThemeSchema, CustomTheme } from '@/types/page-builder';

interface ListThemesResponse {
  themes: CustomTheme[];
  total: number;
}

interface ListThemesOptions {
  connectionId?: number;
  limit?: number;
  offset?: number;
}

/**
 * Helper to extract nested data from API response
 * Backend returns { success, data: { ... } }
 * api-client wraps it as { success, data: { success, data: { ... } } }
 */
function extractData<T>(response: ApiResponse<any>): ApiResponse<T> {
  if (response.success && response.data?.data) {
    return {
      success: true,
      data: response.data.data,
      status: response.status,
    };
  }
  return {
    success: response.success,
    error: response.error || response.data?.error,
    status: response.status,
  };
}

/**
 * List all custom themes
 */
export async function listCustomThemes(
  options: ListThemesOptions = {}
): Promise<ApiResponse<ListThemesResponse>> {
  const params = new URLSearchParams();
  
  if (options.connectionId) {
    params.append('connection_id', options.connectionId.toString());
  }
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options.offset) {
    params.append('offset', options.offset.toString());
  }

  const queryString = params.toString();
  const url = queryString 
    ? `/admin/custom-themes?${queryString}` 
    : '/admin/custom-themes';

  const response = await backendApi.get<ListThemesResponse>(url);
  return extractData<ListThemesResponse>(response);
}

/**
 * Get a single custom theme by ID (admin route)
 */
export async function getCustomTheme(
  id: number
): Promise<ApiResponse<CustomTheme>> {
  const response = await backendApi.get<CustomTheme>(`/admin/custom-themes/${id}`);
  return extractData<CustomTheme>(response);
}

/**
 * Get a single custom theme by ID (user route - read-only)
 * Use this when fetching themes for display in user context
 */
export async function getUserCustomTheme(
  id: number
): Promise<ApiResponse<CustomTheme>> {
  const response = await backendApi.get<CustomTheme>(`/user/custom-themes/${id}`);
  return extractData<CustomTheme>(response);
}

/**
 * List custom themes (user route - read-only)
 */
export async function listUserCustomThemes(
  options: ListThemesOptions = {}
): Promise<ApiResponse<ListThemesResponse>> {
  const params = new URLSearchParams();
  
  if (options.connectionId) {
    params.append('connection_id', options.connectionId.toString());
  }
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options.offset) {
    params.append('offset', options.offset.toString());
  }

  const queryString = params.toString();
  const url = queryString 
    ? `/user/custom-themes?${queryString}` 
    : '/user/custom-themes';

  const response = await backendApi.get<ListThemesResponse>(url);
  return extractData<ListThemesResponse>(response);
}

/**
 * Create a new custom theme
 */
export async function createCustomTheme(data: {
  name: string;
  description?: string;
  connectionId?: number;
  schema: ThemeSchema;
  previewImage?: string;
}): Promise<ApiResponse<CustomTheme>> {
  const response = await backendApi.post<CustomTheme>('/admin/custom-themes', data);
  return extractData<CustomTheme>(response);
}

/**
 * Update an existing custom theme
 */
export async function updateCustomTheme(
  id: number,
  data: {
    name?: string;
    description?: string;
    connectionId?: number;
    schema?: ThemeSchema;
    previewImage?: string;
  }
): Promise<ApiResponse<CustomTheme>> {
  const response = await backendApi.put<CustomTheme>(`/admin/custom-themes/${id}`, data);
  return extractData<CustomTheme>(response);
}

/**
 * Delete a custom theme
 */
export async function deleteCustomTheme(
  id: number
): Promise<ApiResponse<{ message: string }>> {
  const response = await backendApi.delete<{ message: string }>(`/admin/custom-themes/${id}`);
  return extractData<{ message: string }>(response);
}

/**
 * Custom themes service object for convenience
 */
export const customThemesService = {
  // Admin routes (full CRUD)
  list: listCustomThemes,
  get: getCustomTheme,
  create: createCustomTheme,
  update: updateCustomTheme,
  delete: deleteCustomTheme,
  // User routes (read-only)
  listForUser: listUserCustomThemes,
  getForUser: getUserCustomTheme,
};

export default customThemesService;
