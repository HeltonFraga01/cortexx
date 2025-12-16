/**
 * Draft Context
 * Provides draft persistence functionality with auto-save
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { draftService, SendFlowState, Draft } from '@/services/draftService';
import { toast } from 'sonner';

// Default auto-save interval in milliseconds (30 seconds)
const DEFAULT_AUTO_SAVE_INTERVAL = 30000;

export interface DraftState {
  sendFlow?: SendFlowState;
  lastUpdated?: Date;
}

export interface DraftContextValue {
  draft: DraftState | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveDraft: (state: SendFlowState) => Promise<void>;
  loadDraft: () => Promise<SendFlowState | null>;
  clearDraft: () => Promise<void>;
  setAutoSaveInterval: (interval: number) => void;
  pauseAutoSave: () => void;
  resumeAutoSave: () => void;
}

const DraftContext = createContext<DraftContextValue | undefined>(undefined);

export const useDraft = () => {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error('useDraft must be used within a DraftProvider');
  }
  return context;
};

interface DraftProviderProps {
  children: React.ReactNode;
  autoSaveInterval?: number;
  enableAutoSave?: boolean;
}

export const DraftProvider: React.FC<DraftProviderProps> = ({
  children,
  autoSaveInterval = DEFAULT_AUTO_SAVE_INTERVAL,
  enableAutoSave = true
}) => {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentInterval, setCurrentInterval] = useState(autoSaveInterval);
  const [isAutoSavePaused, setIsAutoSavePaused] = useState(!enableAutoSave);
  
  // Refs for auto-save functionality
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDraftRef = useRef<SendFlowState | null>(null);

  /**
   * Save draft to backend
   */
  const saveDraft = useCallback(async (state: SendFlowState) => {
    setIsSaving(true);
    try {
      await draftService.saveDraft(state);
      setDraft({
        sendFlow: state,
        lastUpdated: new Date()
      });
      setHasUnsavedChanges(false);
      pendingDraftRef.current = null;
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
      toast.error('Erro ao salvar rascunho', {
        description: 'Suas alterações podem não ter sido salvas.'
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Load draft from backend
   */
  const loadDraft = useCallback(async (): Promise<SendFlowState | null> => {
    setIsLoading(true);
    try {
      const loadedDraft = await draftService.loadDraft();
      if (loadedDraft) {
        setDraft({
          sendFlow: loadedDraft,
          lastUpdated: new Date()
        });
        return loadedDraft;
      }
      return null;
    } catch (error) {
      console.error('Erro ao carregar rascunho:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear draft from backend and local state
   */
  const clearDraft = useCallback(async () => {
    try {
      await draftService.clearAllDrafts('send_flow');
      setDraft(null);
      setHasUnsavedChanges(false);
      pendingDraftRef.current = null;
    } catch (error) {
      console.error('Erro ao limpar rascunho:', error);
      toast.error('Erro ao limpar rascunho');
      throw error;
    }
  }, []);

  /**
   * Set auto-save interval
   */
  const setAutoSaveInterval = useCallback((interval: number) => {
    setCurrentInterval(interval);
  }, []);

  /**
   * Pause auto-save
   */
  const pauseAutoSave = useCallback(() => {
    setIsAutoSavePaused(true);
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  /**
   * Resume auto-save
   */
  const resumeAutoSave = useCallback(() => {
    setIsAutoSavePaused(false);
  }, []);

  /**
   * Auto-save effect
   */
  useEffect(() => {
    if (isAutoSavePaused || !enableAutoSave) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    // Set up new auto-save timer
    autoSaveTimerRef.current = setInterval(async () => {
      if (pendingDraftRef.current && hasUnsavedChanges && !isSaving) {
        try {
          await saveDraft(pendingDraftRef.current);
        } catch (error) {
          // Error already handled in saveDraft
        }
      }
    }, currentInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [currentInterval, isAutoSavePaused, enableAutoSave, hasUnsavedChanges, isSaving, saveDraft]);

  /**
   * Track pending changes for auto-save
   */
  const saveDraftWithTracking = useCallback(async (state: SendFlowState) => {
    pendingDraftRef.current = state;
    setHasUnsavedChanges(true);
    
    // Update local state immediately for responsiveness
    setDraft(prev => ({
      ...prev,
      sendFlow: state
    }));
    
    // Save to backend
    await saveDraft(state);
  }, [saveDraft]);

  /**
   * Save on unmount if there are unsaved changes
   */
  useEffect(() => {
    return () => {
      if (pendingDraftRef.current && hasUnsavedChanges) {
        // Fire and forget - we're unmounting
        draftService.saveDraft(pendingDraftRef.current).catch(console.error);
      }
    };
  }, [hasUnsavedChanges]);

  /**
   * Load draft on mount
   */
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  return (
    <DraftContext.Provider
      value={{
        draft,
        isLoading,
        isSaving,
        hasUnsavedChanges,
        saveDraft: saveDraftWithTracking,
        loadDraft,
        clearDraft,
        setAutoSaveInterval,
        pauseAutoSave,
        resumeAutoSave
      }}
    >
      {children}
    </DraftContext.Provider>
  );
};

export default DraftContext;
