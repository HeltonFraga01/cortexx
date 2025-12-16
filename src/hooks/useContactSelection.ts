/**
 * useContactSelection Hook
 * 
 * Hook para gerenciamento de seleção de contatos.
 * Suporta seleção individual, em massa e persistência em sessionStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import { Contact } from '@/services/bulkCampaignService';

const STORAGE_KEY = 'wuzapi_selected_contacts';

interface UseContactSelectionReturn {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  selectFiltered: (contacts: Contact[]) => void;
  getSelectedContacts: (allContacts: Contact[]) => Contact[];
}

export function useContactSelection(): UseContactSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Carregar seleção do sessionStorage ao montar
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSelectedIds(new Set(parsed));
      }
    } catch (error: any) {
      console.error('Erro ao carregar seleção:', {
        error,
        message: error.message,
      });
      // Limpar dados corrompidos
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (cleanupError) {
        console.error('Erro ao limpar seleção corrompida:', cleanupError);
      }
    }
  }, []);

  // Salvar seleção no sessionStorage quando mudar
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedIds)));
    } catch (error: any) {
      console.error('Erro ao salvar seleção:', {
        error,
        message: error.message,
        selectedCount: selectedIds.size,
      });
      // Não mostrar toast para evitar spam durante operações em massa
    }
  }, [selectedIds]);

  // Verificar se um ID está selecionado
  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Alternar seleção de um contato
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Selecionar todos os IDs fornecidos
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  // Limpar seleção
  const clearSelection = useCallback(() => {
    try {
      setSelectedIds(new Set());
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error: any) {
      console.error('Erro ao limpar seleção:', {
        error,
        message: error.message,
      });
    }
  }, []);

  // Selecionar todos os contatos filtrados
  const selectFiltered = useCallback((contacts: Contact[]) => {
    const ids = contacts.map(c => c.phone);
    setSelectedIds(new Set(ids));
  }, []);

  // Obter contatos selecionados
  const getSelectedContacts = useCallback((allContacts: Contact[]) => {
    return allContacts.filter(c => selectedIds.has(c.phone));
  }, [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectFiltered,
    getSelectedContacts,
  };
}
