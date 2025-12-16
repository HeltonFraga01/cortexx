/**
 * Interfaces e tipos para configuração de branding
 */

export interface BrandingConfig {
  id: number | null;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  primaryForeground: string | null;
  secondaryForeground: string | null;
  customHomeHtml: string | null;
  supportPhone: string | null;
  ogImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BrandingConfigUpdate {
  appName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  primaryForeground?: string | null;
  secondaryForeground?: string | null;
  customHomeHtml?: string | null;
  supportPhone?: string | null;
  ogImageUrl?: string | null;
}

export interface BrandingContextType {
  config: BrandingConfig;
  isLoading: boolean;
  error: string | null;
  updateConfig: (updates: BrandingConfigUpdate) => Promise<boolean>;
  refreshConfig: () => Promise<void>;
  resetToDefault: () => void;
  applyThemeColors: (primaryColor: string, secondaryColor: string, primaryForeground?: string | null, secondaryForeground?: string | null) => void;
  resetThemeColors: () => void;
  previewThemeColors: (primaryColor: string, secondaryColor: string, primaryForeground?: string | null, secondaryForeground?: string | null) => void;
  cancelPreview: () => void;
  isPreviewActive: boolean;
}

export interface BrandingProviderProps {
  children: React.ReactNode;
}

// Configuração padrão de branding
export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  id: null,
  appName: import.meta.env.VITE_APP_NAME || 'WUZAPI',
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  primaryForeground: null,
  secondaryForeground: null,
  customHomeHtml: null,
  supportPhone: null,
  ogImageUrl: null,
  createdAt: null,
  updatedAt: null,
};

// Constantes para validação
export const BRANDING_VALIDATION = {
  APP_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s\-_\.]+$/,
  },
  COLOR: {
    PATTERN: /^#[0-9A-Fa-f]{6}$/,
  },
  CUSTOM_HTML: {
    MAX_SIZE: 100000, // 100KB
    DANGEROUS_PATTERNS: [
      /on\w+\s*=/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /<script/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /<applet/gi,
      /<meta\s+http-equiv/gi,
      /@import/gi,
      /expression\s*\(/gi,
    ],
  },
} as const;

// Tipos para eventos de branding
export type BrandingEventType = 'config-updated' | 'config-loaded' | 'config-error';

export interface BrandingEvent {
  type: BrandingEventType;
  config?: BrandingConfig;
  error?: string;
  timestamp: Date;
}