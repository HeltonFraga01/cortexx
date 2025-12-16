/**
 * usePersistedFilters Hook
 * Saves and restores filters to/from localStorage
 * 
 * Requirements: 7.4
 */

import { useState, useEffect, useCallback } from 'react';

interface UsePersistedFiltersOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
}

export function usePersistedFilters<T>({
  key,
  defaultValue,
  debounceMs = 500,
}: UsePersistedFiltersOptions<T>) {
  // Initialize state from localStorage or default
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      console.error('Error loading persisted filters:', error);
    }
    return defaultValue;
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // Mark as loaded after initial render
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Debounced save to localStorage
  useEffect(() => {
    if (!isLoaded) return;

    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(filters));
      } catch (error) {
        console.error('Error saving persisted filters:', error);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [filters, key, debounceMs, isLoaded]);

  // Update filters
  const setFilters = useCallback((newFilters: T | ((prev: T) => T)) => {
    setFiltersState(newFilters);
  }, []);

  // Update partial filters
  const updateFilters = useCallback((partial: Partial<T>) => {
    setFiltersState((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  // Clear filters (reset to default)
  const clearFilters = useCallback(() => {
    setFiltersState(defaultValue);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing persisted filters:', error);
    }
  }, [key, defaultValue]);

  // Check if filters differ from default
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(defaultValue);

  return {
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    isLoaded,
  };
}

export default usePersistedFilters;
