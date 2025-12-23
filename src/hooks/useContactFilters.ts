/**
 * useContactFilters Hook
 * 
 * Hook para gerenciamento de filtros de contatos.
 * Implementa filtros em tempo real com debouncing e memoization.
 */

import { useState, useEffect, useMemo } from 'react';
import { Contact } from '@/services/bulkCampaignService';
import { ContactFilters, contactsService } from '@/services/contactsService';

const DEFAULT_FILTERS: ContactFilters = {
  search: '',
  tags: [],
  hasName: null,
  sourceInboxId: null,
};

interface UseContactFiltersReturn {
  filters: ContactFilters;
  filteredContacts: Contact[];
  updateFilters: (newFilters: Partial<ContactFilters>) => void;
  clearFilters: () => void;
  resultCount: number;
  hasActiveFilters: boolean;
}

export function useContactFilters(contacts: Contact[]): UseContactFiltersReturn {
  const [filters, setFilters] = useState<ContactFilters>(DEFAULT_FILTERS);

  // Aplicar filtros com memoization
  const filteredContacts = useMemo(() => {
    return contactsService.filterContacts(contacts, filters);
  }, [contacts, filters]);

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search.trim().length > 0 ||
      filters.tags.length > 0 ||
      filters.hasName !== null ||
      filters.sourceInboxId !== null
    );
  }, [filters]);

  // Atualizar filtros
  const updateFilters = (newFilters: Partial<ContactFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Limpar todos os filtros
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return {
    filters,
    filteredContacts,
    updateFilters,
    clearFilters,
    resultCount: filteredContacts.length,
    hasActiveFilters,
  };
}
