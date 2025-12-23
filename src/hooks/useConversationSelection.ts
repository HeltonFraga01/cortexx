/**
 * useConversationSelection Hook
 * 
 * Hook para gerenciamento de seleção em massa de conversas.
 * Suporta seleção individual, em massa e saída via tecla Escape.
 * 
 * Requirements: 2.1, 2.4, 3.1, 3.2, 3.3, 3.4
 */

import { useState, useCallback, useEffect } from 'react'

interface UseConversationSelectionReturn {
  // State
  isSelectionMode: boolean
  selectedIds: Set<number>
  
  // Actions
  enterSelectionMode: () => void
  exitSelectionMode: () => void
  toggleSelection: (id: number) => void
  selectAll: (ids: number[]) => void
  deselectAll: () => void
  
  // Computed
  selectedCount: number
  isAllSelected: (totalCount: number) => boolean
  isIndeterminate: (totalCount: number) => boolean
  isSelected: (id: number) => boolean
}

export function useConversationSelection(): UseConversationSelectionReturn {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Enter selection mode
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true)
  }, [])

  // Exit selection mode and clear selections
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  // Toggle selection of a single conversation
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Select all provided IDs
  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  // Clear all selections
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Check if a specific ID is selected
  const isSelected = useCallback((id: number) => {
    return selectedIds.has(id)
  }, [selectedIds])

  // Computed: number of selected items
  const selectedCount = selectedIds.size

  // Computed: check if all items are selected
  const isAllSelected = useCallback((totalCount: number) => {
    return totalCount > 0 && selectedIds.size === totalCount
  }, [selectedIds.size])

  // Computed: check if selection is indeterminate (some but not all)
  const isIndeterminate = useCallback((totalCount: number) => {
    return selectedIds.size > 0 && selectedIds.size < totalCount
  }, [selectedIds.size])

  // Exit selection mode on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        exitSelectionMode()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelectionMode, exitSelectionMode])

  return {
    isSelectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    deselectAll,
    selectedCount,
    isAllSelected,
    isIndeterminate,
    isSelected
  }
}

export default useConversationSelection
