/**
 * Supabase User Service
 * 
 * Service for managing Supabase Auth users with full data (account, subscription, quotas)
 * Requirements: 2.1, 3.1, 4.1, 7.1
 */

import { backendApi } from './api-client'
import type {
  SupabaseUserFull,
  SupabaseAuthUser,
  UserAccount,
  UserInbox,
  UpdateSupabaseUserDTO,
  UpdateAccountDTO,
  CreateInboxDTO,
  PasswordResetResponse,
  ActionResponse,
  UnassignedInbox
} from '@/types/supabase-user'

class SupabaseUserService {
  private static instance: SupabaseUserService

  public static getInstance(): SupabaseUserService {
    if (!SupabaseUserService.instance) {
      SupabaseUserService.instance = new SupabaseUserService()
    }
    return SupabaseUserService.instance
  }

  /**
   * Get full user data including account, subscription, and quotas
   */
  async getFullUser(userId: string): Promise<SupabaseUserFull> {
    const response = await backendApi.get<{ data: SupabaseUserFull }>(
      `/admin/supabase/users/${userId}/full`
    )
    if (!response.success) throw new Error(response.error)
    if (!response.data?.data) throw new Error('Dados não retornados da API')
    return response.data.data
  }

  /**
   * Update Supabase Auth user (email, phone, metadata)
   */
  async updateUser(userId: string, data: UpdateSupabaseUserDTO): Promise<SupabaseAuthUser> {
    const response = await backendApi.put<{ data: SupabaseAuthUser }>(
      `/admin/supabase/users/${userId}`,
      data
    )
    if (!response.success) throw new Error(response.error)
    if (!response.data?.data) throw new Error('Dados não retornados da API')
    return response.data.data
  }

  /**
   * Update user account (name, status, timezone, locale)
   */
  async updateAccount(userId: string, data: UpdateAccountDTO): Promise<UserAccount> {
    const response = await backendApi.put<{ data: UserAccount }>(
      `/admin/supabase/users/${userId}/account`,
      data
    )
    if (!response.success) throw new Error(response.error)
    if (!response.data?.data) throw new Error('Dados não retornados da API')
    return response.data.data
  }

  /**
   * Reset user password (send email or generate temp password)
   */
  async resetPassword(userId: string, sendEmail = true): Promise<PasswordResetResponse> {
    const response = await backendApi.post<PasswordResetResponse>(
      `/admin/supabase/users/${userId}/reset-password`,
      { sendEmail }
    )
    if (!response.success) throw new Error(response.error)
    return {
      success: true,
      message: response.data?.message || 'Operação realizada',
      tempPassword: response.data?.tempPassword
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId: string): Promise<ActionResponse> {
    const response = await backendApi.post<ActionResponse>(
      `/admin/supabase/users/${userId}/suspend`
    )
    if (!response.success) throw new Error(response.error)
    return { success: true, message: response.data?.message }
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(userId: string): Promise<ActionResponse> {
    const response = await backendApi.post<ActionResponse>(
      `/admin/supabase/users/${userId}/reactivate`
    )
    if (!response.success) throw new Error(response.error)
    return { success: true, message: response.data?.message }
  }

  /**
   * Manually confirm user email
   */
  async confirmEmail(userId: string): Promise<ActionResponse> {
    const response = await backendApi.post<ActionResponse>(
      `/admin/supabase/users/${userId}/confirm-email`
    )
    if (!response.success) throw new Error(response.error)
    return { success: true, message: response.data?.message }
  }

  /**
   * Delete user (existing endpoint)
   */
  async deleteUser(userId: string): Promise<void> {
    const response = await backendApi.delete(`/admin/supabase/users/${userId}`)
    if (!response.success) throw new Error(response.error)
  }

  /**
   * Create inbox for user
   */
  async createInbox(userId: string, data: CreateInboxDTO): Promise<UserInbox> {
    const response = await backendApi.post<{ data: UserInbox }>(
      `/admin/supabase/users/${userId}/inboxes`,
      data
    )
    if (!response.success) throw new Error(response.error)
    if (!response.data?.data) throw new Error('Dados não retornados da API')
    return response.data.data
  }

  /**
   * Delete inbox from user
   */
  async deleteInbox(userId: string, inboxId: string): Promise<void> {
    const response = await backendApi.delete(
      `/admin/supabase/users/${userId}/inboxes/${inboxId}`
    )
    if (!response.success) throw new Error(response.error)
  }

  /**
   * Get unassigned inboxes (not linked to any user)
   */
  async getUnassignedInboxes(): Promise<UnassignedInbox[]> {
    const response = await backendApi.get<{ data: UnassignedInbox[] }>(
      '/admin/inboxes/unassigned'
    )
    if (!response.success) throw new Error(response.error)
    return response.data?.data || []
  }

  /**
   * Assign existing inbox to user
   */
  async assignInboxToUser(userId: string, inboxId: string): Promise<void> {
    const response = await backendApi.post(
      `/admin/supabase/users/${userId}/inboxes/assign`,
      { inbox_id: inboxId }
    )
    if (!response.success) throw new Error(response.error)
  }
}

export const supabaseUserService = SupabaseUserService.getInstance()
