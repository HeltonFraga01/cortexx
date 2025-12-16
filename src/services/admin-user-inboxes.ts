/**
 * Admin User Inboxes Service
 * 
 * API client for fetching user inboxes as admin.
 */

import { api } from '@/lib/api'

export interface UserInbox {
  id: string
  accountId: string
  name: string
  description?: string
  channelType: string
  phoneNumber?: string
  wuzapiToken?: string
  wuzapiUserId?: string
  wuzapiConnected: boolean
  enableAutoAssignment: boolean
  greetingEnabled: boolean
  greetingMessage?: string
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface UserInboxesResponse {
  success: boolean
  data: UserInbox[]
  account?: {
    id: string
    name: string
  }
  message?: string
}

export const adminUserInboxesService = {
  /**
   * Get all inboxes for a specific user
   */
  async getUserInboxes(userId: string): Promise<UserInboxesResponse> {
    const response = await api.get<UserInboxesResponse>(`/api/admin/users/${userId}/inboxes`)
    return response.data
  }
}
