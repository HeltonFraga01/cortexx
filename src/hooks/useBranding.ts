import { useContext } from 'react';
import { BrandingContext } from '@/contexts/BrandingContext';
import { BrandingContextType, BrandingConfig } from '@/types/branding';

/**
 * Hook personalizado para acessar o contexto de branding
 * 
 * @returns {BrandingContextType} Contexto de branding com configuração e métodos
 * @throws {Error} Se usado fora do BrandingProvider
 */
export const useBranding = (): BrandingContextType => {
  const context = useContext(BrandingContext);
  
  if (!context) {
    throw new Error('useBranding deve ser usado dentro de um BrandingProvider');
  }
  
  return context;
};

/**
 * Hook para acessar apenas a configuração de branding (sem métodos)
 * Útil para componentes que só precisam ler a configuração
 * 
 * @returns {BrandingConfig} Configuração atual de branding
 */
export const useBrandingConfig = () => {
  const { config } = useBranding();
  return config;
};

/**
 * Hook para verificar se o branding está carregando
 * 
 * @returns {boolean} True se estiver carregando
 */
export const useBrandingLoading = () => {
  const { isLoading } = useBranding();
  return isLoading;
};

/**
 * Hook para acessar erros de branding
 * 
 * @returns {string | null} Mensagem de erro ou null
 */
export const useBrandingError = () => {
  const { error } = useBranding();
  return error;
};

/**
 * Hook para métodos de atualização de branding
 * Útil para componentes administrativos
 * 
 * @returns {object} Métodos para atualizar configuração
 */
export const useBrandingActions = () => {
  const { 
    updateConfig, 
    refreshConfig, 
    resetToDefault,
    applyThemeColors,
    resetThemeColors,
    previewThemeColors,
    cancelPreview,
    isPreviewActive
  } = useBranding();
  
  return {
    updateConfig,
    refreshConfig,
    resetToDefault,
    applyThemeColors,
    resetThemeColors,
    previewThemeColors,
    cancelPreview,
    isPreviewActive
  };
};

export default useBranding;