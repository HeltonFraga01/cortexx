import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Navigation utilities for programmatic routing
export const navigationPaths = {
  admin: {
    dashboard: '/admin',
    users: '/admin/users',
    newUser: '/admin/users/new',
    editUser: (userId: string) => `/admin/users/edit/${userId}`,
    databases: '/admin/databases',
    newDatabase: '/admin/databases/new',
    editDatabase: (id: string) => `/admin/databases/edit/${id}`,
    settings: '/admin/settings',
  },
  user: {
    dashboard: '/user',
    messages: '/user/messages',
    settings: '/user/settings',
    database: '/user/database',
    editRecord: (connectionId: string, recordId: string) => `/user/database/edit/${connectionId}/${recordId}`,
  },
  auth: {
    login: '/login',
    home: '/',
  }
} as const;

export type NavigationPaths = typeof navigationPaths;

/**
 * Truncate text to max length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 100)
 * @returns Truncated text
 */
export function truncateDescription(text: string | null | undefined, maxLength = 100): string | null {
  if (!text) return null
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}
