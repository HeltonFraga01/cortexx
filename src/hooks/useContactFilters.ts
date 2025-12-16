/**
 * useContactFilters Hook
 * 
 * Hook para gerenciamento de filtros de contatos.
 * Implementa filtros em tempo real com debouncing e memoization.
 */

import { useState, useEffect, useMemo } from 'react';
import { Contact } from '@/services/bulkCampaignService';
import { ContactFilters, contactsService } from '@/services/contactsService';
import { contactsStorageService } from '@/services/contactsStorageService';

const DEFAULT_FILTERS: ContactFilters = {
  search: '',
  tags: [],
  hasName: null,
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
  // Carregar filtros salvos ou usar valores padrão
  const savedPreferences = contactsStorageService.loadPreferences();
  const initialFilters = savedPreferences?.filters || DEFAULT_FILTERS;
  const [filters, setFilters] = useState<ContactFilters>(initialFilters);

  // Aplicar filtros com memoization
  const filteredContacts = useMemo(() => {
    return contactsService.filterContacts(contacts, filters);
  }, [contacts, filters]);

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search.trim().length > 0 ||
      filters.tags.length > 0 ||
      filters.hasName !== null
    );
  }, [filters]);

  // Salvar filtros quando mudarem
  useEffect(() => {
    try {
      const savedPreferences = contactsStorageService.loadPreferences();
      const updatedPreferences = {
        pageSize: savedPreferences?.pageSize || 50,
        currentPage: savedPreferences?.currentPage || 1,
        filters,
        lastUpdated: new Date(),
      };
      contactsStorageService.savePreferences(updatedPreferences);
    } catch (err: any) {
      console.error('Erro ao salvar preferências de filtros:', {
        error: err,
        message: err.message,
        filters,
      });
      // Não mostrar toast para evitar spam
    }
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
