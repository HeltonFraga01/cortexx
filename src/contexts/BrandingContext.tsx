import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { BrandingConfig, BrandingConfigUpdate, BrandingContextType, DEFAULT_BRANDING_CONFIG } from '@/types/branding';
import { brandingService } from '@/services/branding';
import { IS_DEVELOPMENT } from '@/config/environment';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import {
  applyThemeColors as applyThemeColorsService,
  resetThemeColors as resetThemeColorsService,
  updateThemeOnModeChange,
} from '@/services/themeColorManager';

export const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

interface BrandingProviderProps {
  children: React.ReactNode;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_BRANDING_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewColors, setPreviewColors] = useState<{ primary: string; secondary: string } | null>(null);

  // Carrega a configuração inicial
  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Tentar carregar do cache local primeiro
      const localConfig = brandingService.getLocalConfig();
      if (localConfig) {
        setConfig(localConfig);
        if (IS_DEVELOPMENT) {
          console.log('🎨 Branding: Configuração carregada do cache local');
        }
      }

      // Buscar configuração atualizada do backend (rota pública, não precisa de token)
      const response = await brandingService.getBrandingConfig();

      if (response.success && response.data) {
        setConfig(response.data);
        setError(null);
      } else {
        // Em caso de erro, manter configuração local ou padrão
        if (!localConfig) {
          setConfig(DEFAULT_BRANDING_CONFIG);
        }
        setError(response.error || 'Erro ao carregar configuração de branding');

        if (IS_DEVELOPMENT) {
          console.warn('⚠️ Branding: Usando configuração padrão devido a erro:', response.error);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setConfig(DEFAULT_BRANDING_CONFIG);

      console.error('❌ Branding: Erro ao carregar configuração:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Atualiza a configuração
  const updateConfig = useCallback(async (updates: BrandingConfigUpdate): Promise<boolean> => {
    try {
      setError(null);

      // Validar dados antes de enviar
      const validation = brandingService.validateBrandingConfig(updates);
      if (!validation.isValid) {
        const errorMessage = `Dados inválidos: ${validation.errors.join(', ')}`;
        setError(errorMessage);
        toast.error('Erro de Validação', {
          description: errorMessage,
        });
        return false;
      }

      // Não precisa passar token, a rota usa sessão
      const response = await brandingService.updateBrandingConfig(updates);

      if (response.success && response.data) {
        setConfig(response.data);
        setError(null);

        // Limpar estado de preview após save bem-sucedido
        setPreviewColors(null);

        // Re-aplicar cores salvas imediatamente
        if (response.data.primaryColor && response.data.secondaryColor) {
          applyThemeColorsService(
            response.data.primaryColor,
            response.data.secondaryColor,
            response.data.primaryForeground,
            response.data.secondaryForeground
          );

          if (IS_DEVELOPMENT) {
            console.log('🎨 Branding: Cores re-aplicadas após save', {
              primary: response.data.primaryColor,
              secondary: response.data.secondaryColor,
              primaryForeground: response.data.primaryForeground,
              secondaryForeground: response.data.secondaryForeground
            });
          }
        } else if (!response.data.primaryColor && !response.data.secondaryColor) {
          // Se ambas as cores foram removidas, resetar para padrão
          resetThemeColorsService();

          if (IS_DEVELOPMENT) {
            console.log('🔄 Branding: Cores resetadas para padrão após save');
          }
        }

        toast.success('Configuração Atualizada', {
          description: 'As configurações de branding foram salvas com sucesso.',
        });

        if (IS_DEVELOPMENT) {
          console.log('✅ Branding: Configuração atualizada com sucesso');
        }

        return true;
      } else {
        const errorMessage = response.error || 'Erro ao atualizar configuração';
        setError(errorMessage);

        toast.error('Erro ao Salvar', {
          description: errorMessage,
        });

        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);

      toast.error('Erro Inesperado', {
        description: errorMessage,
      });

      console.error('❌ Branding: Erro ao atualizar configuração:', err);
      return false;
    }
  }, []);

  // Recarrega a configuração do backend
  const refreshConfig = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  // Reseta para configuração padrão
  const resetToDefault = useCallback(() => {
    setConfig(DEFAULT_BRANDING_CONFIG);
    setError(null);
    brandingService.clearLocalConfig();
    resetThemeColorsService();

    toast.info('Configuração Resetada', {
      description: 'As configurações foram resetadas para os valores padrão.',
    });

    if (IS_DEVELOPMENT) {
      console.log('🔄 Branding: Configuração resetada para padrão');
    }
  }, []);

  // Aplica cores de tema no DOM
  const applyThemeColors = useCallback((
    primaryColor: string,
    secondaryColor: string,
    primaryForeground?: string | null,
    secondaryForeground?: string | null
  ) => {
    try {
      applyThemeColorsService(primaryColor, secondaryColor, primaryForeground, secondaryForeground);

      if (IS_DEVELOPMENT) {
        console.log('🎨 Branding: Cores de tema aplicadas', {
          primaryColor,
          secondaryColor,
          primaryForeground,
          secondaryForeground
        });
      }
    } catch (err) {
      console.error('❌ Branding: Erro ao aplicar cores de tema:', err);
      toast.error('Erro ao Aplicar Cores', {
        description: 'Não foi possível aplicar as cores do tema.',
      });
    }
  }, []);

  // Remove cores de tema customizadas
  const resetThemeColors = useCallback(() => {
    try {
      resetThemeColorsService();

      if (IS_DEVELOPMENT) {
        console.log('🔄 Branding: Cores de tema resetadas');
      }
    } catch (err) {
      console.error('❌ Branding: Erro ao resetar cores de tema:', err);
    }
  }, []);

  // Preview temporário de cores (não persiste)
  const previewThemeColors = useCallback((
    primaryColor: string,
    secondaryColor: string,
    primaryForeground?: string | null,
    secondaryForeground?: string | null
  ) => {
    try {
      setPreviewColors({ primary: primaryColor, secondary: secondaryColor });
      applyThemeColorsService(primaryColor, secondaryColor, primaryForeground, secondaryForeground);

      if (IS_DEVELOPMENT) {
        console.log('👁️ Branding: Preview de cores aplicado', {
          primaryColor,
          secondaryColor,
          primaryForeground,
          secondaryForeground
        });
      }
    } catch (err) {
      console.error('❌ Branding: Erro ao aplicar preview de cores:', err);
      toast.error('Erro no Preview', {
        description: 'Não foi possível visualizar as cores.',
      });
    }
  }, []);

  // Cancela preview e restaura cores salvas
  const cancelPreview = useCallback(() => {
    setPreviewColors(null);

    // Restaurar cores salvas ou resetar
    if (config.primaryColor && config.secondaryColor) {
      applyThemeColorsService(
        config.primaryColor,
        config.secondaryColor,
        config.primaryForeground,
        config.secondaryForeground
      );
    } else {
      resetThemeColorsService();
    }

    if (IS_DEVELOPMENT) {
      console.log('❌ Branding: Preview cancelado');
    }
  }, [config.primaryColor, config.secondaryColor, config.primaryForeground, config.secondaryForeground]);

  // Carrega configuração na inicialização
  useEffect(() => {
    // Carregar branding sempre, independente de autenticação
    // A rota pública /api/branding/public não requer autenticação
    const timer = setTimeout(() => {
      // Pré-carregar configuração para melhor performance
      brandingService.preloadConfig().then(() => {
        loadConfig();
      }).catch((error) => {
        // Se pré-carregamento falhar, carregar normalmente
        if (IS_DEVELOPMENT) {
          console.warn('⚠️ Branding: Pré-carregamento falhou, tentando carregamento normal', error);
        }
        loadConfig();
      });
    }, 100); // Aguardar 100ms para garantir que o serviço está pronto

    return () => clearTimeout(timer);
  }, [loadConfig]);

  // Aplicar cores de tema quando configuração muda
  useEffect(() => {
    // Não aplicar se estiver em modo preview
    if (previewColors) {
      return;
    }

    // Aplicar cores se pelo menos uma estiver definida
    // Usar cores padrão como fallback
    const defaultPrimary = '#3B82F6'; // Azul padrão para dark mode
    const defaultSecondary = '#10B981'; // Verde padrão para light mode

    const primaryColor = config.primaryColor || defaultPrimary;
    const secondaryColor = config.secondaryColor || defaultSecondary;

    // Aplicar cores se pelo menos uma foi customizada
    if (config.primaryColor || config.secondaryColor) {
      applyThemeColorsService(
        primaryColor,
        secondaryColor,
        config.primaryForeground,
        config.secondaryForeground
      );

      if (IS_DEVELOPMENT) {
        console.log('🎨 Branding: Cores aplicadas automaticamente na mudança de config', {
          primary: primaryColor,
          secondary: secondaryColor,
          primaryForeground: config.primaryForeground,
          secondaryForeground: config.secondaryForeground,
          usingDefaultPrimary: !config.primaryColor,
          usingDefaultSecondary: !config.secondaryColor
        });
      }
    } else {
      // Se não houver cores configuradas, resetar para padrão
      resetThemeColorsService();
    }
  }, [config.primaryColor, config.secondaryColor, config.primaryForeground, config.secondaryForeground, previewColors]);

  // Listener para mudanças de tema (dark/light toggle)
  useEffect(() => {
    const handleThemeChange = () => {
      updateThemeOnModeChange();

      if (IS_DEVELOPMENT) {
        console.log('🌓 Branding: Tema alterado (dark/light), cores reaplicadas');
      }
    };

    // Observar mudanças na classe 'dark' do elemento root
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Atualizar título da página
  useEffect(() => {
    const currentTitle = document.title;
    const baseTitles = ['Login', 'Admin Dashboard', 'User Dashboard', 'Editar Usuário', 'Page Not Found'];

    // Encontrar o título base atual
    let baseTitle = '';
    for (const title of baseTitles) {
      if (currentTitle.includes(title)) {
        baseTitle = title;
        break;
      }
    }

    // Atualizar com o nome da aplicação
    if (baseTitle) {
      document.title = `${baseTitle} | ${config.appName}`;
    } else if (!currentTitle.includes(config.appName)) {
      document.title = config.appName;
    }
  }, [config.appName]);

  // Memoizar o valor do contexto para evitar re-renders desnecessários
  const contextValue: BrandingContextType = useMemo(() => ({
    config,
    isLoading,
    error,
    updateConfig,
    refreshConfig,
    resetToDefault,
    applyThemeColors,
    resetThemeColors,
    previewThemeColors,
    cancelPreview,
    isPreviewActive: previewColors !== null,
  }), [
    config,
    isLoading,
    error,
    updateConfig,
    refreshConfig,
    resetToDefault,
    applyThemeColors,
    resetThemeColors,
    previewThemeColors,
    cancelPreview,
    previewColors,
  ]);

  return (
    <BrandingContext.Provider value={contextValue}>
      {children}
    </BrandingContext.Provider>
  );
};