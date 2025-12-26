/**
 * Page Builder Themes Service
 * 
 * API client for page builder themes (Puck editor schemas).
 */

import { backendApi, type ApiResponse } from './api-client';
import type { ThemeSchema } from '@/types/page-builder';

/**
 * Page builder theme from database
 */
export interface PageBuilderTheme {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  connectionId: string | null;
  schema: ThemeSchema;
  previewImage: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListThemesResponse {
  themes: PageBuilderTheme[];
  total: number;
}

interface ListThemesOptions {
  connectionId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Helper to extract nested data from API response
 * Backend returns { success, data: { ... } }
 * api-client wraps it as { success, data: { success, data: { ... } } }
 */
function extractData<T>(response: ApiResponse<unknown>): ApiResponse<T> {
  if (response.success && response.data && typeof response.data === 'object' && 'data' in response.data) {
    return {
      success: true,
      data: (response.data as { data: T }).data,
      status: response.status,
    };
  }
  return {
    success: response.success,
    error: response.error || (response.data as { error?: string })?.error,
    status: response.status,
  };
}

/**
 * List all page builder themes (admin route)
 */
export async function listPageBuilderThemes(
  options: ListThemesOptions = {}
): Promise<ApiResponse<ListThemesResponse>> {
  const params = new URLSearchParams();
  
  if (options.connectionId) {
    params.append('connection_id', options.connectionId);
  }
  if (options.isActive !== undefined) {
    params.append('is_active', options.isActive.toString());
  }
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options.offset) {
    params.append('offset', options.offset.toString());
  }

  const queryString = params.toString();
  const url = queryString 
    ? `/admin/page-builder-themes?${queryString}` 
    : '/admin/page-builder-themes';

  const response = await backendApi.get<ListThemesResponse>(url);
  return extractData<ListThemesResponse>(response);
}

/**
 * Get a single page builder theme by ID (admin route)
 */
export async function getPageBuilderTheme(
  id: string
): Promise<ApiResponse<PageBuilderTheme>> {
  const response = await backendApi.get<PageBuilderTheme>(`/admin/page-builder-themes/${id}`);
  return extractData<PageBuilderTheme>(response);
}

/**
 * Get a single page builder theme by ID (user route - read-only)
 */
export async function getUserPageBuilderTheme(
  id: string
): Promise<ApiResponse<PageBuilderTheme>> {
  const response = await backendApi.get<PageBuilderTheme>(`/user/page-builder-themes/${id}`);
  return extractData<PageBuilderTheme>(response);
}

/**
 * List page builder themes (user route - read-only, active only)
 */
export async function listUserPageBuilderThemes(
  options: ListThemesOptions = {}
): Promise<ApiResponse<ListThemesResponse>> {
  const params = new URLSearchParams();
  
  if (options.connectionId) {
    params.append('connection_id', options.connectionId);
  }
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options.offset) {
    params.append('offset', options.offset.toString());
  }

  const queryString = params.toString();
  const url = queryString 
    ? `/user/page-builder-themes?${queryString}` 
    : '/user/page-builder-themes';

  const response = await backendApi.get<ListThemesResponse>(url);
  return extractData<ListThemesResponse>(response);
}


/**
 * Create a new page builder theme
 */
export async function createPageBuilderTheme(data: {
  name: string;
  description?: string;
  connectionId?: string;
  schema: ThemeSchema;
  previewImage?: string;
  isActive?: boolean;
}): Promise<ApiResponse<PageBuilderTheme>> {
  const response = await backendApi.post<PageBuilderTheme>('/admin/page-builder-themes', data);
  return extractData<PageBuilderTheme>(response);
}

/**
 * Update an existing page builder theme
 */
export async function updatePageBuilderTheme(
  id: string,
  data: {
    name?: string;
    description?: string;
    connectionId?: string;
    schema?: ThemeSchema;
    previewImage?: string;
    isActive?: boolean;
  }
): Promise<ApiResponse<PageBuilderTheme>> {
  const response = await backendApi.put<PageBuilderTheme>(`/admin/page-builder-themes/${id}`, data);
  return extractData<PageBuilderTheme>(response);
}

/**
 * Delete a page builder theme
 */
export async function deletePageBuilderTheme(
  id: string
): Promise<ApiResponse<{ message: string }>> {
  const response = await backendApi.delete<{ message: string }>(`/admin/page-builder-themes/${id}`);
  return extractData<{ message: string }>(response);
}

/**
 * Page builder themes service object for convenience
 */
export const pageBuilderThemesService = {
  // Admin routes (full CRUD)
  list: listPageBuilderThemes,
  get: getPageBuilderTheme,
  create: createPageBuilderTheme,
  update: updatePageBuilderTheme,
  delete: deletePageBuilderTheme,
  // User routes (read-only)
  listForUser: listUserPageBuilderThemes,
  getForUser: getUserPageBuilderTheme,
};

export default pageBuilderThemesService;
