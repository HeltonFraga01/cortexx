/**
 * useChatKeyboardShortcuts Hook
 * 
 * Handles keyboard shortcuts for the chat interface
 * 
 * Requirements: 14.1, 14.2, 14.3
 */

import { useEffect, useCallback } from 'react'

interface KeyboardShortcutsOptions {
  onSearch?: () => void
  onEscape?: () => void
  onSend?: () => void
  enabled?: boolean
}

export function useChatKeyboardShortcuts({
  onSearch,
  onEscape,
  onSend,
  enabled = true
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Ctrl+K or Cmd+K for search
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault()
      onSearch?.()
      return
    }

    // Escape to close modals/panels
    if (event.key === 'Escape') {
      onEscape?.()
      return
    }

    // Ctrl+Enter or Cmd+Enter to send
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      onSend?.()
      return
    }
  }, [enabled, onSearch, onEscape, onSend])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Hook for global search shortcut
 */
export function useSearchShortcut(onSearch: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        onSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSearch, enabled])
}

/**
 * Hook for escape key
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEscape, enabled])
}

export default useChatKeyboardShortcuts
