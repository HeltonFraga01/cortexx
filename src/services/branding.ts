import { backendApi, ApiResponse } from './api-client';
import { BrandingConfig, BrandingConfigUpdate } from '@/types/branding';
import { IS_DEVELOPMENT } from '@/config/environment';

/**
 * Serviço para gerenciar configurações de branding
 */
export class BrandingService {
  private static instance: BrandingService;
  private cache: BrandingConfig | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private refreshPromise: Promise<ApiResponse<BrandingConfig>> | null = null;
  private eventListeners = new Map<string, ((...args: unknown[]) => void)[]>();

  private constructor() {}

  static getInstance(): BrandingService {
    if (!BrandingService.instance) {
      BrandingService.instance = new BrandingService();
    }
    return BrandingService.instance;
  }

  /**
   * Busca a configuração de branding do backend
   */
  async getBrandingConfig(token?: string): Promise<ApiResponse<BrandingConfig>> {
    try {
      // Verificar cache primeiro
      if (this.isCacheValid()) {
        if (IS_DEVELOPMENT) {
          console.log('🎨 Branding: Usando configuração do cache');
        }
        return {
          success: true,
          data: this.cache!,
        };
      }

      if (IS_DEVELOPMENT) {
        console.log('🎨 Branding: Buscando configuração do backend...');
      }

      // Buscar do backend usando rota pública (não requer autenticação)
      const response = await backendApi.get<{ data: BrandingConfig }>('/branding/public');

      if (response.success && response.data?.data) {
        this.updateCache(response.data.data);
        
        if (IS_DEVELOPMENT) {
          console.log('✅ Branding: Configuração carregada com sucesso', response.data.data);
        }

        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao carregar configuração de branding');
      }
    } catch (error) {
      console.error('❌ Branding: Erro ao buscar configuração:', error);
      
      // Retornar configuração padrão em caso de erro
      const defaultConfig: BrandingConfig = {
        id: null,
        appName: 'WUZAPI',
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        customHomeHtml: null,
        createdAt: null,
        updatedAt: null,
      };

      return {
        success: false,
        data: defaultConfig,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Atualiza a configuração de branding no backend
   */
  async updateBrandingConfig(updates: BrandingConfigUpdate, token?: string): Promise<ApiResponse<BrandingConfig>> {
    try {
      if (IS_DEVELOPMENT) {
        console.log('🎨 Branding: Atualizando configuração...', updates);
      }

      // Atualizar usando sessão (requireAdmin middleware aplicado na rota)
      const response = await backendApi.put<{ data: BrandingConfig }>('/branding', updates);

      if (response.success && response.data?.data) {
        this.updateCache(response.data.data);
        
        if (IS_DEVELOPMENT) {
          console.log('✅ Branding: Configuração atualizada com sucesso', response.data.data);
        }

        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao atualizar configuração de branding');
      }
    } catch (error) {
      console.error('❌ Branding: Erro ao atualizar configuração:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Valida os dados de configuração de branding
   */
  validateBrandingConfig(config: BrandingConfigUpdate): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar nome da aplicação
    if (config.appName !== undefined) {
      if (!config.appName || config.appName.trim().length === 0) {
        errors.push('Nome da aplicação é obrigatório');
      } else if (config.appName.length < 1 || config.appName.length > 50) {
        errors.push('Nome da aplicação deve ter entre 1 e 50 caracteres');
      } else if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(config.appName)) {
        errors.push('Nome da aplicação contém caracteres inválidos');
      } else {
        // Sanitizar nome da aplicação
        const sanitized = this.sanitizeAppName(config.appName);
        if (sanitized !== config.appName) {
          warnings.push('Nome da aplicação foi sanitizado para remover espaços extras');
        }
      }
    }

    // Validar URL do logo
    if (config.logoUrl !== undefined && config.logoUrl !== null && config.logoUrl.trim() !== '') {
      try {
        const url = new URL(config.logoUrl);
        
        // Verificar protocolo seguro
        if (!['https:', 'http:'].includes(url.protocol)) {
          errors.push('URL do logo deve usar protocolo HTTP ou HTTPS');
        }
        
        // Verificar extensão de imagem
        const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
        const hasValidExtension = validExtensions.some(ext => 
          url.pathname.toLowerCase().endsWith(ext)
        );
        
        if (!hasValidExtension) {
          warnings.push('URL do logo pode não ser uma imagem válida');
        }
        
      } catch {
        errors.push('URL do logo é inválida');
      }
    }

    // Validar cor primária
    if (config.primaryColor !== undefined && config.primaryColor !== null && config.primaryColor.trim() !== '') {
      const colorValidation = this.validateColor(config.primaryColor, 'primária');
      errors.push(...colorValidation.errors);
      warnings.push(...colorValidation.warnings);
    }

    // Validar cor secundária
    if (config.secondaryColor !== undefined && config.secondaryColor !== null && config.secondaryColor.trim() !== '') {
      const colorValidation = this.validateColor(config.secondaryColor, 'secundária');
      errors.push(...colorValidation.errors);
      warnings.push(...colorValidation.warnings);
    }

    // Validar contraste entre cores
    if (config.primaryColor && config.secondaryColor) {
      const contrastWarning = this.validateColorContrast(config.primaryColor, config.secondaryColor);
      if (contrastWarning) {
        warnings.push(contrastWarning);
      }
    }

    // Validar HTML customizado
    if (config.customHomeHtml !== undefined && config.customHomeHtml !== null && config.customHomeHtml.trim() !== '') {
      const htmlValidation = this.validateCustomHtml(config.customHomeHtml);
      errors.push(...htmlValidation.errors);
      warnings.push(...htmlValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valida HTML customizado (modo permissivo)
   */
  private validateCustomHtml(html: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar tamanho (1MB)
    const maxSize = 1024 * 1024;
    if (html.length > maxSize) {
      errors.push(`HTML customizado excede o tamanho máximo de ${Math.round(maxSize / 1024)}KB (atual: ${Math.round(html.length / 1024)}KB)`);
      return { errors, warnings };
    }

    // Modo permissivo: sem validações restritivas
    // O admin confia no código que está colando
    return { errors, warnings };
  }

  /**
   * Sanitiza o nome da aplicação
   */
  private sanitizeAppName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  /**
   * Valida uma cor específica
   */
  private validateColor(color: string, colorName: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      errors.push(`Cor ${colorName} deve estar no formato #RRGGBB`);
    } else {
      // Verificar se não é uma cor muito escura ou muito clara
      const hex = color.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      if (brightness < 50) {
        warnings.push(`Cor ${colorName} é muito escura e pode afetar a legibilidade`);
      } else if (brightness > 200) {
        warnings.push(`Cor ${colorName} é muito clara e pode afetar a legibilidade`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Valida contraste entre duas cores
   */
  private validateColorContrast(color1: string, color2: string): string | null {
    try {
      const getLuminance = (hex: string) => {
        const rgb = hex.substring(1).match(/.{2}/g)!.map(x => parseInt(x, 16) / 255);
        const [r, g, b] = rgb.map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const lum1 = getLuminance(color1);
      const lum2 = getLuminance(color2);
      const contrast = (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);

      if (contrast < 3) {
        return 'Contraste entre cores primária e secundária pode ser insuficiente para acessibilidade';
      }
    } catch (error) {
      // Ignorar erros de cálculo de contraste
    }

    return null;
  }

  /**
   * Sanitiza configuração de branding para uso seguro
   */
  sanitizeBrandingConfig(config: BrandingConfigUpdate): BrandingConfigUpdate {
    const sanitized: BrandingConfigUpdate = {};

    if (config.appName !== undefined) {
      sanitized.appName = this.sanitizeAppName(config.appName);
    }

    if (config.logoUrl !== undefined) {
      sanitized.logoUrl = config.logoUrl?.trim() || null;
    }

    if (config.primaryColor !== undefined) {
      sanitized.primaryColor = config.primaryColor?.trim().toUpperCase() || null;
    }

    if (config.secondaryColor !== undefined) {
      sanitized.secondaryColor = config.secondaryColor?.trim().toUpperCase() || null;
    }

    if (config.customHomeHtml !== undefined) {
      sanitized.customHomeHtml = config.customHomeHtml?.trim() || null;
    }

    return sanitized;
  }

  /**
   * Recupera configuração com fallback em caso de erro
   */
  async getBrandingConfigWithFallback(): Promise<BrandingConfig> {
    try {
      const response = await this.getBrandingConfig();
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Falha ao carregar configuração');
      }
    } catch (error) {
      console.warn('⚠️ Branding: Usando configuração de fallback devido a erro:', error);
      
      // Tentar cache local primeiro
      const localConfig = this.getLocalConfig();
      if (localConfig) {
        return localConfig;
      }

      // Usar configuração padrão como último recurso
      return {
        id: null,
        appName: 'WUZAPI',
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        customHomeHtml: null,
        createdAt: null,
        updatedAt: null,
      };
    }
  }

  /**
   * Limpa o cache de configuração
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
    
    if (IS_DEVELOPMENT) {
      console.log('🗑️ Branding: Cache limpo');
    }
  }

  /**
   * Força o refresh da configuração (ignora cache)
   * Evita múltiplas requisições simultâneas
   */
  async refreshConfig(): Promise<ApiResponse<BrandingConfig>> {
    // Se já há um refresh em andamento, aguardar ele
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.clearCache();
    
    // Criar promise de refresh
    this.refreshPromise = this.getBrandingConfig();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // Limpar promise após conclusão
      this.refreshPromise = null;
    }
  }

  /**
   * Obtém a configuração do cache local (localStorage)
   */
  getLocalConfig(): BrandingConfig | null {
    try {
      const stored = localStorage.getItem('wuzapi_branding_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Verificar se não está expirado (24 horas)
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas
        
        if (parsed.timestamp && (now - parsed.timestamp) < maxAge) {
          return parsed.config;
        }
      }
    } catch (error) {
      console.warn('⚠️ Branding: Erro ao ler configuração local:', error);
    }
    
    return null;
  }

  /**
   * Salva a configuração no cache local (localStorage)
   */
  saveLocalConfig(config: BrandingConfig): void {
    try {
      const data = {
        config,
        timestamp: Date.now(),
      };
      
      localStorage.setItem('wuzapi_branding_config', JSON.stringify(data));
      
      if (IS_DEVELOPMENT) {
        console.log('💾 Branding: Configuração salva localmente');
      }
    } catch (error) {
      console.warn('⚠️ Branding: Erro ao salvar configuração local:', error);
    }
  }

  /**
   * Remove a configuração do cache local
   */
  clearLocalConfig(): void {
    try {
      localStorage.removeItem('wuzapi_branding_config');
      
      if (IS_DEVELOPMENT) {
        console.log('🗑️ Branding: Configuração local removida');
      }
    } catch (error) {
      console.warn('⚠️ Branding: Erro ao remover configuração local:', error);
    }
  }

  /**
   * Pré-carrega a configuração de branding para melhor performance
   */
  async preloadConfig(): Promise<void> {
    try {
      // Tentar carregar do cache local primeiro
      const localConfig = this.getLocalConfig();
      if (localConfig) {
        this.cache = localConfig;
        this.cacheTimestamp = Date.now();
        
        if (IS_DEVELOPMENT) {
          console.log('🚀 Branding: Configuração pré-carregada do cache local');
        }
      }

      // Buscar configuração atualizada em background
      this.getBrandingConfig().catch(error => {
        console.warn('⚠️ Branding: Erro ao pré-carregar configuração:', error);
      });
    } catch (error) {
      console.warn('⚠️ Branding: Erro durante pré-carregamento:', error);
    }
  }

  /**
   * Obtém estatísticas de performance do cache
   */
  getCacheStats(): {
    hasCachedConfig: boolean;
    cacheAge: number;
    isExpired: boolean;
    localConfigExists: boolean;
  } {
    const now = Date.now();
    const cacheAge = this.cacheTimestamp ? now - this.cacheTimestamp : 0;
    const isExpired = cacheAge > this.CACHE_DURATION;
    const localConfigExists = !!this.getLocalConfig();

    return {
      hasCachedConfig: !!this.cache,
      cacheAge,
      isExpired,
      localConfigExists,
    };
  }

  /**
   * Sistema de eventos para notificar mudanças
   */
  addEventListener(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.warn('Erro ao executar listener de evento de branding:', error);
        }
      });
    }
  }

  // Métodos privados

  private updateCache(config: BrandingConfig): void {
    const previousConfig = this.cache;
    this.cache = config;
    this.cacheTimestamp = Date.now();
    this.saveLocalConfig(config);
    
    // Emitir evento de mudança se a configuração mudou
    if (!previousConfig || JSON.stringify(previousConfig) !== JSON.stringify(config)) {
      this.emitEvent('config-changed', config);
    }
  }

  private isCacheValid(): boolean {
    if (!this.cache || !this.cacheTimestamp) {
      return false;
    }

    const now = Date.now();
    return (now - this.cacheTimestamp) < this.CACHE_DURATION;
  }
}

// Instância singleton do serviço de branding
export const brandingService = BrandingService.getInstance();

export default brandingService;