/**
 * useAdminPlans Hook
 * 
 * React Query hook for fetching admin plans with caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminPlansService } from '@/services/admin-plans'
import type { Plan, PlanStatus, CreatePlanRequest, UpdatePlanRequest } from '@/types/admin-management'

// Query key for plans
export const PLANS_QUERY_KEY = ['admin', 'plans'] as const

/**
 * Hook to fetch all plans
 */
export function useAdminPlans(status?: PlanStatus) {
  return useQuery({
    queryKey: status ? [...PLANS_QUERY_KEY, status] : PLANS_QUERY_KEY,
    queryFn: () => adminPlansService.listPlans(status),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch a single plan by ID
 */
export function useAdminPlan(planId: string | undefined) {
  return useQuery({
    queryKey: [...PLANS_QUERY_KEY, planId],
    queryFn: () => adminPlansService.getPlan(planId!),
    enabled: !!planId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to create a new plan
 */
export function useCreatePlan() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreatePlanRequest) => adminPlansService.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY })
    },
  })
}

/**
 * Hook to update a plan
 */
export function useUpdatePlan() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanRequest }) => 
      adminPlansService.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY })
    },
  })
}

/**
 * Hook to delete a plan
 */
export function useDeletePlan() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (planId: string) => adminPlansService.deletePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY })
    },
  })
}
