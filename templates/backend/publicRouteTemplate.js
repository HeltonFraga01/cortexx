/**
 * Template para Rotas Públicas
 * 
 * Este template fornece a estrutura padrão para implementar rotas públicas
 * no WUZAPI Manager (health checks, status, informações públicas).
 * 
 * Uso:
 * 1. Copie este arquivo para server/routes/[domain]Routes.js
 * 2. Substitua todos os placeholders
 * 3. Implemente a lógica específica
 * 4. Adicione a rota no servidor principal
 */

const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * [OPERATION_DESCRIPTION] - Rota pública
 * [HTTP_METHOD] /[ENDPOINT]
 * 
 * Não requer autenticação
 * 
 * [PARAMETERS_SECTION]
 * Query parameters opcionais:
 * - param1: type - description
 * - param2: type - description
 * [/PARAMETERS_SECTION]
 * 
 * Responses:
 * - 200: [SUCCESS_DESCRIPTION]
 * - 500: Erro interno do servidor
 * - 503: Serviço indisponível (para health checks)
 */
router.[HTTP_METHOD_LOWERCASE]('/[ENDPOINT]', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // [EXTRACT_PARAMETERS]
    const { param1, param2 } = req.query;
    // [/EXTRACT_PARAMETERS]
    
    logger.info('Iniciando [OPERATION_NAME]', {
      url: req.url,
      method: req.method,
      // [LOG_SPECIFIC_DATA]
      param1: param1,
      param2: param2,
      // [/LOG_SPECIFIC_DATA]
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    // [BUSINESS_LOGIC]
    // Implementar lógica específica aqui
    
    // Exemplo para health check:
    const healthData = await performHealthChecks();
    
    // Exemplo para informações do sistema:
    const systemInfo = {
      service: '[SERVICE_NAME]',
      version: process.env.npm_package_version || '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Exemplo para status de serviços:
    const servicesStatus = await checkServicesStatus();
    
    const result = {
      ...systemInfo,
      ...healthData,
      services: servicesStatus
    };
    // [/BUSINESS_LOGIC]
    
    const responseTime = Date.now() - startTime;
    
    logger.info('[OPERATION_NAME] realizada com sucesso', {
      url: req.url,
      method: req.method,
      response_time_ms: responseTime,
      // [LOG_SUCCESS_DATA]
      status: result.status,
      services_count: Object.keys(result.services || {}).length,
      // [/LOG_SUCCESS_DATA]
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    // [DETERMINE_STATUS_CODE]
    // Para health checks, determinar status baseado na saúde dos serviços
    const isHealthy = result.status === 'healthy' && 
                     Object.values(result.services || {}).every(service => 
                       service.status === 'healthy' || service.status === 'connected'
                     );
    
    const statusCode = isHealthy ? 200 : 503;
    // [/DETERMINE_STATUS_CODE]

    return res.status(statusCode).json({
      success: true,
      code: statusCode,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Erro em [OPERATION_NAME]', {
      url: req.url,
      method: req.method,
      response_time_ms: responseTime,
      error_message: error.message,
      error_stack: error.stack,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Erro interno em [OPERATION_NAME]',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Função auxiliar para verificar saúde dos serviços
 * @returns {Promise<Object>} Status de saúde dos componentes
 */
async function performHealthChecks() {
  const health = {
    status: 'healthy',
    checks: {}
  };
  
  try {
    // [HEALTH_CHECKS]
    // Verificar banco de dados (Supabase)
    const SupabaseService = require('../services/SupabaseService');
    const { data: dbHealthy, error: dbError } = await SupabaseService.healthCheck();
    
    health.checks.database = {
      status: dbHealthy ? 'connected' : 'disconnected',
      type: 'supabase',
      error: dbError?.message || null
    };
    
    // Verificar WUZAPI
    const wuzapiClient = require('../utils/wuzapiClient');
    const wuzapiHealthy = await wuzapiClient.isHealthy();
    const wuzapiConfig = wuzapiClient.getConfig();
    
    health.checks.wuzapi = {
      status: wuzapiHealthy ? 'connected' : 'disconnected',
      base_url: wuzapiConfig.baseURL,
      timeout: wuzapiConfig.timeout
    };
    
    // Verificar sistema de arquivos (logs directory)
    const fs = require('fs');
    const logsPath = process.env.LOG_PATH || './logs';
    
    try {
      fs.accessSync(logsPath, fs.constants.R_OK | fs.constants.W_OK);
      health.checks.filesystem = {
        status: 'accessible',
        logs_path: logsPath
      };
    } catch (fsError) {
      health.checks.filesystem = {
        status: 'error',
        error: fsError.message
      };
      health.status = 'degraded';
    }
    // [/HEALTH_CHECKS]
    
    // Determinar status geral
    const hasErrors = Object.values(health.checks).some(check => 
      check.status === 'error' || check.status === 'disconnected'
    );
    
    if (hasErrors) {
      health.status = 'degraded';
    }
    
  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
  }
  
  return health;
}

/**
 * Função auxiliar para verificar status de serviços específicos
 * @returns {Promise<Object>} Status dos serviços
 */
async function checkServicesStatus() {
  const services = {};
  
  try {
    // [SERVICE_CHECKS]
    // Verificar serviços específicos do domínio
    
    // Exemplo: verificar API externa
    const axios = require('axios');
    try {
      const response = await axios.get('[EXTERNAL_API_HEALTH_URL]', { timeout: 5000 });
      services.external_api = {
        status: response.status === 200 ? 'healthy' : 'degraded',
        response_time: response.headers['x-response-time'] || 'unknown'
      };
    } catch (error) {
      services.external_api = {
        status: 'unhealthy',
        error: error.message
      };
    }
    
    // Exemplo: verificar recursos do sistema
    const memoryUsage = process.memoryUsage();
    services.system = {
      status: 'healthy',
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      uptime: Math.round(process.uptime()) + 's'
    };
    // [/SERVICE_CHECKS]
    
  } catch (error) {
    logger.error('Erro ao verificar status dos serviços', {
      error_message: error.message
    });
  }
  
  return services;
}

// [ADDITIONAL_ROUTES]
// Adicione outras rotas públicas aqui seguindo o mesmo padrão

/**
 * Rota de informações básicas do sistema
 * GET /info
 */
router.get('/info', (req, res) => {
  try {
    const info = {
      service: '[SERVICE_NAME]',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch,
      timestamp: new Date().toISOString()
    };
    
    logger.info('Informações do sistema solicitadas', {
      url: req.url,
      method: req.method,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(200).json({
      success: true,
      code: 200,
      data: info,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Erro ao obter informações do sistema', {
      url: req.url,
      method: req.method,
      error_message: error.message,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Erro ao obter informações do sistema',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rota de status simplificado
 * GET /status
 */
router.get('/status', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
  
  return res.status(200).json(status);
});
// [/ADDITIONAL_ROUTES]

module.exports = router;

/**
 * INSTRUÇÕES DE USO:
 * 
 * 1. PLACEHOLDERS OBRIGATÓRIOS:
 *    - [OPERATION_DESCRIPTION]: Descrição da operação (ex: "Verificar saúde do sistema")
 *    - [HTTP_METHOD]: Método HTTP (geralmente GET para rotas públicas)
 *    - [HTTP_METHOD_LOWERCASE]: Método em minúsculo (get)
 *    - [ENDPOINT]: Endpoint da rota (ex: "health", "status", "info")
 *    - [OPERATION_NAME]: Nome da operação para logs (ex: "verificação de saúde")
 *    - [SERVICE_NAME]: Nome do serviço (ex: "wuzapi-manager")
 *    - [SUCCESS_DESCRIPTION]: Descrição do sucesso
 * 
 * 2. SEÇÕES CONDICIONAIS:
 *    - [PARAMETERS_SECTION]: Incluir apenas se houver parâmetros
 *    - [EXTRACT_PARAMETERS]: Código para extrair parâmetros
 *    - [BUSINESS_LOGIC]: Lógica principal da operação
 *    - [LOG_SPECIFIC_DATA]: Dados específicos para log
 *    - [DETERMINE_STATUS_CODE]: Lógica para determinar status code
 *    - [HEALTH_CHECKS]: Verificações específicas de saúde
 *    - [SERVICE_CHECKS]: Verificações de serviços específicos
 * 
 * 3. EXEMPLOS DE SUBSTITUIÇÃO:
 *    - Para health check: [ENDPOINT] = "health", [OPERATION_NAME] = "verificação de saúde"
 *    - Para status: [ENDPOINT] = "status", [OPERATION_NAME] = "verificação de status"
 *    - Para info: [ENDPOINT] = "info", [OPERATION_NAME] = "informações do sistema"
 * 
 * 4. INTEGRAÇÃO NO SERVIDOR:
 *    - Para rota raiz: app.use('/', require('./routes/publicRoutes'));
 *    - Para subpath: app.use('/api/public', require('./routes/publicRoutes'));
 */