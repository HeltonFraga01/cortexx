/**
 * Admin Plans Service
 * 
 * API client for plan management operations.
 * Features use snake_case format matching backend.
 */

import { api } from '@/lib/api'
import type { 
  Plan, 
  CreatePlanRequest, 
  UpdatePlanRequest,
  ApiResponse 
} from '@/types/admin-management'

const BASE_URL = '/api/admin/plans'

export const adminPlansService = {
  /**
   * List all plans
   */
  async listPlans(status?: string): Promise<Plan[]> {
    const params = status ? `?status=${status}` : ''
    const response = await api.get<ApiResponse<Plan[]>>(`${BASE_URL}${params}`)
    return response.data?.data || []
  },

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<Plan | null> {
    const response = await api.get<ApiResponse<Plan>>(`${BASE_URL}/${planId}`)
    return response.data?.data || null
  },

  /**
   * Create a new plan
   */
  async createPlan(data: CreatePlanRequest): Promise<Plan> {
    const response = await api.post<ApiResponse<Plan>>(BASE_URL, data)
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to create plan')
    }
    return response.data.data!
  },

  /**
   * Update a plan
   */
  async updatePlan(planId: string, data: UpdatePlanRequest): Promise<Plan> {
    const response = await api.put<ApiResponse<Plan>>(`${BASE_URL}/${planId}`, data)
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to update plan')
    }
    return response.data.data!
  },

  /**
   * Delete a plan
   */
  async deletePlan(planId: string, migrateToPlanId?: string): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`${BASE_URL}/${planId}`, {
      data: migrateToPlanId ? { migrateToPlanId } : undefined
    })
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to delete plan')
    }
  }
}
