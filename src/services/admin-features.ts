/**
 * Admin Features Service
 * 
 * API client for user feature flag management.
 */

import { api } from '@/lib/api'
import type { 
  UserFeature, 
  FeatureName,
  FeatureDefinition,
  SetFeatureOverrideRequest,
  ApiResponse 
} from '@/types/admin-management'

const BASE_URL = '/api/admin/users'
const FEATURES_URL = '/api/admin/features'

export const adminFeaturesService = {
  /**
   * List all available features
   */
  async listAvailableFeatures(): Promise<FeatureDefinition[]> {
    const response = await api.get<ApiResponse<FeatureDefinition[]>>(FEATURES_URL)
    return response.data?.data || []
  },

  /**
   * Get all features for a user
   */
  async getUserFeatures(userId: string): Promise<UserFeature[]> {
    const response = await api.get<ApiResponse<UserFeature[]>>(`${BASE_URL}/${userId}/features`)
    return response.data?.data || []
  },

  /**
   * Check if a specific feature is enabled
   */
  async isFeatureEnabled(userId: string, featureName: FeatureName): Promise<boolean> {
    const response = await api.get<ApiResponse<{ enabled: boolean }>>(
      `${BASE_URL}/${userId}/features/${featureName}`
    )
    return response.data?.data?.enabled || false
  },

  /**
   * Set a feature override
   */
  async setFeatureOverride(
    userId: string, 
    featureName: FeatureName, 
    data: SetFeatureOverrideRequest
  ): Promise<void> {
    const response = await api.put<ApiResponse<void>>(
      `${BASE_URL}/${userId}/features/${featureName}`, 
      data
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to set feature override')
    }
  },

  /**
   * Remove a feature override
   */
  async removeFeatureOverride(userId: string, featureName: FeatureName): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(
      `${BASE_URL}/${userId}/features/${featureName}/override`
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to remove feature override')
    }
  }
}
