// Configuração de ambiente para diferentes modos de execução
interface EnvironmentConfig {
  API_BASE_URL: string;
  NODE_ENV: string;
  IS_PRODUCTION: boolean;
  IS_DEVELOPMENT: boolean;
}

// Configurações por ambiente
const environments = {
  development: {
    // Em desenvolvimento, usar /api para que o Vite faça o proxy
    API_BASE_URL: '/api',
    NODE_ENV: 'development',
    IS_PRODUCTION: false,
    IS_DEVELOPMENT: true,
  },
  production: {
    // Em produção, usar /api como base para as rotas da API local
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
    NODE_ENV: 'production',
    IS_PRODUCTION: true,
    IS_DEVELOPMENT: false,
  },
  preview: {
    // Para preview local, usar localhost direto
    API_BASE_URL: 'http://localhost:3001/api',
    NODE_ENV: 'production',
    IS_PRODUCTION: false,
    IS_DEVELOPMENT: false,
  },
  test: {
    API_BASE_URL: 'http://localhost:3001/api',
    NODE_ENV: 'test',
    IS_PRODUCTION: false,
    IS_DEVELOPMENT: false,
  }
} as const;

// Detectar ambiente atual
const getCurrentEnvironment = (): keyof typeof environments => {
  const mode = import.meta.env.MODE;
  
  // Detectar se estamos no preview (localhost:4173)
  if (typeof window !== 'undefined' && window.location.port === '4173') {
    return 'preview';
  }
  
  if (mode === 'production') return 'production';
  if (mode === 'test') return 'test';
  return 'development';
};

// Exportar configuração do ambiente atual
const currentEnv = getCurrentEnvironment();
export const config: EnvironmentConfig = environments[currentEnv];

// Exportar configurações individuais para compatibilidade
export const API_BASE_URL = config.API_BASE_URL;
export const NODE_ENV = config.NODE_ENV;
export const IS_PRODUCTION = config.IS_PRODUCTION;
export const IS_DEVELOPMENT = config.IS_DEVELOPMENT;

// Helper para debug
export const logEnvironmentInfo = () => {
  if (IS_DEVELOPMENT) {
    console.log('🔧 Environment Configuration:', {
      mode: import.meta.env.MODE,
      environment: currentEnv,
      config: config,
      viteEnvVars: {
        VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      }
    });
  }
};

// Validar configuração
export const validateEnvironment = () => {
  // Em produção, API_BASE_URL pode ser vazia (usa mesma origem)
  const requiredVars = IS_PRODUCTION ? [] : ['API_BASE_URL'];
  const missing = requiredVars.filter(key => !config[key as keyof EnvironmentConfig]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing);
    if (IS_PRODUCTION) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
  
  if (IS_DEVELOPMENT) {
    console.log('✅ Environment validation passed');
  }
};

export default config;