/**
 * Utilitários para mensagens com branding dinâmico
 */

import { DEFAULT_BRANDING_CONFIG } from '@/types/branding';

/**
 * Obtém o nome da aplicação do localStorage ou retorna o padrão
 */
export const getAppName = (): string => {
  try {
    const stored = localStorage.getItem('wuzapi_branding_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.config?.appName) {
        return parsed.config.appName;
      }
    }
  } catch (error) {
    console.warn('Erro ao ler configuração de branding do localStorage:', error);
  }
  
  return DEFAULT_BRANDING_CONFIG.appName;
};

/**
 * Cria mensagens com branding dinâmico
 */
export const createBrandedMessage = (template: string): string => {
  const appName = getAppName();
  return template.replace(/\{appName\}/g, appName);
};

/**
 * Mensagens padrão com branding
 */
export const BRANDED_MESSAGES = {
  CLIENT_NOT_AVAILABLE: () => `Cliente ${getAppName()} não disponível`,
  USER_NOT_FOUND: () => `Usuário ${getAppName()} não encontrado`,
  NO_USERS_FOUND: () => `Você não tem nenhum usuário ${getAppName()}. Crie seu primeiro usuário para começar.`,
  CONFIG_UPDATED: () => `As configurações do ${getAppName()} foram atualizadas`,
  CONNECTION_ERROR: () => `Erro de conexão com ${getAppName()}`,
  AUTHENTICATION_FAILED: () => `Falha na autenticação do ${getAppName()}`,
  SESSION_EXPIRED: () => `Sessão do ${getAppName()} expirada`,
  INVALID_TOKEN: () => `Token do ${getAppName()} inválido`,
} as const;