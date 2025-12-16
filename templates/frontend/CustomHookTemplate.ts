import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

// TODO: Replace with your actual data types
interface HookDataType {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  // Add your specific fields here
}

interface HookOptions {
  autoFetch?: boolean;
  refreshInterval?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: HookDataType[]) => void;
}

interface HookState {
  data: HookDataType[];
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

interface HookActions {
  fetch: () => Promise<void>;
  create: (item: Partial<HookDataType>) => Promise<void>;
  update: (id: string, item: Partial<HookDataType>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

// TODO: Replace with your actual API service
interface ApiService {
  getItems(): Promise<HookDataType[]>;
  createItem(data: Partial<HookDataType>): Promise<HookDataType>;
  updateItem(id: string, data: Partial<HookDataType>): Promise<HookDataType>;
  deleteItem(id: string): Promise<void>;
}

/**
 * Custom hook template for data management
 * 
 * @param options - Configuration options for the hook
 * @returns Object with state and actions for data management
 * 
 * @example
 * ```typescript
 * const { data, loading, error, fetch, create, update, remove } = useCustomHook({
 *   autoFetch: true,
 *   refreshInterval: 30000,
 *   onError: (error) => console.error('Hook error:', error),
 *   onSuccess: (data) => console.log('Data loaded:', data)
 * });
 * ```
 */
const useCustomHookTemplate = (options: HookOptions = {}): HookState & HookActions => {
  const {
    autoFetch = true,
    refreshInterval,
    onError,
    onSuccess
  } = options;

  // State management
  const [state, setState] = useState<HookState>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null
  });

  // TODO: Initialize your API service
  // const apiService = useMemo(() => new ApiService(), []);

  // Helper function to update state
  const updateState = useCallback((updates: Partial<HookState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Fetch data function
  const fetch = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });
      
      // TODO: Replace with your actual API call
      // const data = await apiService.getItems();
      
      // Mock data for template - remove this
      const data: HookDataType[] = [
        {
          id: '1',
          name: 'Sample Item 1',
          status: 'active'
        },
        {
          id: '2',
          name: 'Sample Item 2',
          status: 'inactive'
        }
      ];

      updateState({
        data,
        loading: false,
        lastFetch: new Date()
      });

      onSuccess?.(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      updateState({
        loading: false,
        error: errorMessage
      });

      onError?.(error instanceof Error ? error : new Error(errorMessage));
      toast.error(`Erro ao carregar dados: ${errorMessage}`);
    }
  }, [onError, onSuccess, updateState]);

  // Create item function
  const create = useCallback(async (item: Partial<HookDataType>) => {
    try {
      updateState({ loading: true, error: null });

      // TODO: Replace with your actual API call
      // const newItem = await apiService.createItem(item);
      
      // Mock implementation - remove this
      const newItem: HookDataType = {
        id: Date.now().toString(),
        name: item.name || 'New Item',
        status: item.status || 'active'
      };

      updateState({
        data: [...state.data, newItem],
        loading: false
      });

      toast.success('Item criado com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      updateState({
        loading: false,
        error: errorMessage
      });

      onError?.(error instanceof Error ? error : new Error(errorMessage));
      toast.error(`Erro ao criar item: ${errorMessage}`);
    }
  }, [state.data, onError, updateState]);

  // Update item function
  const update = useCallback(async (id: string, item: Partial<HookDataType>) => {
    try {
      updateState({ loading: true, error: null });

      // TODO: Replace with your actual API call
      // const updatedItem = await apiService.updateItem(id, item);

      // Mock implementation - remove this
      const updatedItem: HookDataType = {
        ...state.data.find(i => i.id === id)!,
        ...item
      };

      updateState({
        data: state.data.map(i => i.id === id ? updatedItem : i),
        loading: false
      });

      toast.success('Item atualizado com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      updateState({
        loading: false,
        error: errorMessage
      });

      onError?.(error instanceof Error ? error : new Error(errorMessage));
      toast.error(`Erro ao atualizar item: ${errorMessage}`);
    }
  }, [state.data, onError, updateState]);

  // Remove item function
  const remove = useCallback(async (id: string) => {
    try {
      updateState({ loading: true, error: null });

      // TODO: Replace with your actual API call
      // await apiService.deleteItem(id);

      updateState({
        data: state.data.filter(i => i.id !== id),
        loading: false
      });

      toast.success('Item removido com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      updateState({
        loading: false,
        error: errorMessage
      });

      onError?.(error instanceof Error ? error : new Error(errorMessage));
      toast.error(`Erro ao remover item: ${errorMessage}`);
    }
  }, [state.data, onError, updateState]);

  // Refresh function (alias for fetch)
  const refresh = useCallback(() => fetch(), [fetch]);

  // Clear function
  const clear = useCallback(() => {
    updateState({
      data: [],
      loading: false,
      error: null,
      lastFetch: null
    });
  }, [updateState]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [autoFetch, fetch]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(fetch, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetch]);

  // Memoized computed values
  const computedValues = useMemo(() => ({
    activeItems: state.data.filter(item => item.status === 'active'),
    inactiveItems: state.data.filter(item => item.status === 'inactive'),
    totalCount: state.data.length,
    hasData: state.data.length > 0,
    isEmpty: state.data.length === 0,
    isStale: state.lastFetch ? Date.now() - state.lastFetch.getTime() > 300000 : true // 5 minutes
  }), [state.data, state.lastFetch]);

  return {
    // State
    ...state,
    
    // Actions
    fetch,
    create,
    update,
    remove,
    refresh,
    clear,
    
    // Computed values
    ...computedValues
  };
};

export default useCustomHookTemplate;

// Additional utility hooks that can be used with the main hook

/**
 * Hook for filtering and searching data
 */
export const useDataFilter = <T extends { name: string; status?: string }>(
  data: T[],
  initialFilters: { search?: string; status?: string } = {}
) => {
  const [filters, setFilters] = useState(initialFilters);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = !filters.search || 
        item.name.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesStatus = !filters.status || 
        item.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  }, [data, filters]);

  const updateFilter = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    filters,
    filteredData,
    updateFilter,
    clearFilters,
    hasFilters: Object.values(filters).some(Boolean)
  };
};

/**
 * Hook for pagination
 */
export const usePagination = <T>(
  data: T[],
  itemsPerPage: number = 10
) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    totalPages,
    currentData,
    goToPage,
    nextPage,
    prevPage,
    resetPagination,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    startIndex: startIndex + 1,
    endIndex: Math.min(endIndex, data.length),
    totalItems: data.length
  };
};

/**
 * Hook for selection management
 */
export const useSelection = <T extends { id: string }>(data: T[]) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedItems = useMemo(() => {
    return data.filter(item => selectedIds.includes(item.id));
  }, [data, selectedIds]);

  const isSelected = useCallback((id: string) => {
    return selectedIds.includes(id);
  }, [selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(data.map(item => item.id));
  }, [data]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  return {
    selectedIds,
    selectedItems,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectMultiple,
    hasSelection: selectedIds.length > 0,
    selectedCount: selectedIds.length,
    isAllSelected: selectedIds.length === data.length && data.length > 0
  };
};

// Usage examples (remove in actual implementation):
/*
// Basic usage
const MyComponent = () => {
  const { 
    data, 
    loading, 
    error, 
    fetch, 
    create, 
    update, 
    remove 
  } = useCustomHookTemplate({
    autoFetch: true,
    refreshInterval: 30000
  });

  // With filtering
  const { 
    filteredData, 
    updateFilter, 
    clearFilters 
  } = useDataFilter(data, { search: '', status: '' });

  // With pagination
  const { 
    currentData, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage 
  } = usePagination(filteredData, 10);

  // With selection
  const { 
    selectedIds, 
    toggleSelection, 
    selectAll, 
    clearSelection 
  } = useSelection(currentData);

  return (
    <div>
      // Your component JSX here
    </div>
  );
};
*/