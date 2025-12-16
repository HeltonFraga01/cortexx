/**
 * Template para Rotas de Integração Externa
 * 
 * Este template fornece a estrutura padrão para implementar rotas que fazem
 * integração com serviços externos (WUZAPI, NocoDB, APIs terceiras).
 * 
 * Uso:
 * 1. Copie este arquivo para server/routes/[integration]Routes.js
 * 2. Substitua todos os placeholders
 * 3. Implemente a lógica de integração específica
 * 4. Adicione a rota no servidor principal
 */

const express = require('express');
const sessionValidator = require('../validators/sessionValidator');
const errorHandler = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * [OPERATION_DESCRIPTION] - Integração com [EXTERNAL_SERVICE]
 * [HTTP_METHOD] /api/[INTEGRATION]/[ENDPOINT]
 * 
 * Headers necessários:
 * - token: {user_token} (ou Authorization: {admin_token} para rotas admin)
 * 
 * [PARAMETERS_SECTION]
 * Query parameters opcionais:
 * - param1: type - description
 * - param2: type - description
 * 
 * Body (para POST/PUT):
 * - field1: type (obrigatório) - description
 * - field2: type (opcional) - description
 * [/PARAMETERS_SECTION]
 * 
 * Responses:
 * - 200: [SUCCESS_DESCRIPTION]
 * - 201: [CREATED_DESCRIPTION] (apenas para POST)
 * - 400: Dados inválidos ou token mal formatado
 * - 401: Token inválido ou expirado
 * - 403: Token não possui permissões necessárias
 * - 404: [RESOURCE] não encontrado no serviço externo
 * - 409: [RESOURCE] já existe no serviço externo
 * - 429: Rate limit atingido no serviço externo
 * - 500: Erro interno do servidor
 * - 502: Erro na comunicação com [EXTERNAL_SERVICE]
 * - 504: Timeout na comunicação com [EXTERNAL_SERVICE]
 */
router.[HTTP_METHOD_LOWERCASE]('/[ENDPOINT]',
  // Middleware de validação de formato de token
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.token;
      
      // [EXTRACT_PARAMETERS]
      // Para GET: extrair query parameters
      const { param1, param2 } = req.query;
      
      // Para POST/PUT: extrair body parameters
      const requestData = req.body;
      // [/EXTRACT_PARAMETERS]
      
      // [VALIDATE_INPUT]
      // Validação básica dos dados de entrada
      if (!requestData || typeof requestData !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Dados de entrada são obrigatórios',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validações específicas para a integração
      if (!requestData.requiredField) {
        return res.status(400).json({
          success: false,
          error: '[REQUIRED_FIELD] é obrigatório para [EXTERNAL_SERVICE]',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validações específicas do serviço externo
      if (requestData.specificField && !isValidFormat(requestData.specificField)) {
        return res.status(400).json({
          success: false,
          error: '[SPECIFIC_FIELD] deve estar no formato correto',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      // [/VALIDATE_INPUT]

      // Validar formato do token
      if (!sessionValidator.isValidTokenFormat(token)) {
        logger.warn('Token com formato inválido em integração [EXTERNAL_SERVICE]', {
          url: req.url,
          method: req.method,
          integration: '[EXTERNAL_SERVICE]',
          operation: '[OPERATION_NAME]',
          token_length: token ? token.length : 0,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Formato de token inválido',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // [TOKEN_VALIDATION]
      // Validar token (se necessário para a operação)
      const validationResult = await sessionValidator.validateUserToken(token);
      if (!validationResult.isValid) {
        return errorHandler.handleValidationError(validationResult, req, res);
      }
      // [/TOKEN_VALIDATION]

      logger.info('Iniciando integração [EXTERNAL_SERVICE] - [OPERATION_NAME]', {
        url: req.url,
        method: req.method,
        integration: '[EXTERNAL_SERVICE]',
        operation: '[OPERATION_NAME]',
        // [LOG_SPECIFIC_DATA]
        param1: param1,
        has_request_data: !!requestData,
        request_size: JSON.stringify(requestData).length,
        // [/LOG_SPECIFIC_DATA]
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // [INTEGRATION_LOGIC]
      // Implementar lógica de integração específica
      
      // Exemplo para WUZAPI:
      const wuzapiClient = require('../utils/wuzapiClient');
      const integrationResult = await wuzapiClient.[WUZAPI_METHOD](requestData, {
        headers: { 'token': token }
      });
      
      // Exemplo para operação com banco de dados (Supabase):
      const SupabaseService = require('../services/SupabaseService');
      const { data: connectionData } = await SupabaseService.getById('[TABLE_NAME]', [CONNECTION_ID]);
      const integrationResult = await SupabaseService.queryAsAdmin('[TABLE_NAME]', (query) =>
        query.select('*').eq('[FIELD]', requestData.[FIELD])
      );
      
      // Exemplo para API externa genérica:
      const axios = require('axios');
      const response = await axios.[HTTP_METHOD_LOWERCASE]('[EXTERNAL_API_URL]', requestData, {
        headers: {
          'Authorization': `Bearer ${[EXTERNAL_TOKEN]}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 segundos
      });
      
      const integrationResult = {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data
      };
      // [/INTEGRATION_LOGIC]
      
      const responseTime = Date.now() - startTime;

      if (integrationResult.success) {
        // Integração bem-sucedida
        logger.info('Integração [EXTERNAL_SERVICE] - [OPERATION_NAME] realizada com sucesso', {
          url: req.url,
          method: req.method,
          integration: '[EXTERNAL_SERVICE]',
          operation: '[OPERATION_NAME]',
          response_time_ms: responseTime,
          // [LOG_SUCCESS_DATA]
          external_status: integrationResult.status,
          result_size: JSON.stringify(integrationResult.data).length,
          // [/LOG_SUCCESS_DATA]
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status([SUCCESS_STATUS_CODE]).json({
          success: true,
          code: [SUCCESS_STATUS_CODE],
          data: integrationResult.data,
          message: '[SUCCESS_MESSAGE]',
          integration: '[EXTERNAL_SERVICE]',
          timestamp: new Date().toISOString()
        });
      } else {
        // Tratar diferentes tipos de erro da integração externa
        const { statusCode, errorMessage } = handleIntegrationError(integrationResult);
        
        logger.error('Erro na integração [EXTERNAL_SERVICE] - [OPERATION_NAME]', {
          url: req.url,
          method: req.method,
          integration: '[EXTERNAL_SERVICE]',
          operation: '[OPERATION_NAME]',
          response_time_ms: responseTime,
          external_status: integrationResult.status,
          external_error: integrationResult.error,
          external_code: integrationResult.code,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(statusCode).json({
          success: false,
          error: errorMessage,
          code: statusCode,
          details: integrationResult.error,
          integration: '[EXTERNAL_SERVICE]',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // [ERROR_HANDLING]
      // Tratamento específico de erros de integração
      if (error.code === 'ECONNABORTED') {
        logger.error('Timeout na integração [EXTERNAL_SERVICE] - [OPERATION_NAME]', {
          url: req.url,
          method: req.method,
          integration: '[EXTERNAL_SERVICE]',
          operation: '[OPERATION_NAME]',
          response_time_ms: responseTime,
          timeout_duration: error.timeout || 'unknown',
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(504).json({
          success: false,
          error: 'Timeout na comunicação com [EXTERNAL_SERVICE]',
          code: 504,
          integration: '[EXTERNAL_SERVICE]',
          timestamp: new Date().toISOString()
        });
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.error('Falha de conexão com [EXTERNAL_SERVICE] - [OPERATION_NAME]', {
          url: req.url,
          method: req.method,
          integration: '[EXTERNAL_SERVICE]',
          operation: '[OPERATION_NAME]',
          response_time_ms: responseTime,
          connection_error: error.code,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(502).json({
          success: false,
          error: 'Não foi possível conectar com [EXTERNAL_SERVICE]',
          code: 502,
          integration: '[EXTERNAL_SERVICE]',
          timestamp: new Date().toISOString()
        });
      }
      
      if (error.response) {
        // Erro com resposta da API externa
        const status = error.response.status;
        const data = error.response.data;
        
        logger.error('Erro HTTP na integração [EXTERNAL_SERVICE] - [OPERATION_NAME]', {
          url: req.url,
          method: req.method,
          integration: '[EXTERNAL_SERVICE]',
          operation: '[OPERATION_NAME]',
          response_time_ms: responseTime,
          http_status: status,
          external_error: data?.error || data?.message,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        const { statusCode, errorMessage } = mapExternalHttpError(status, data);
        
        return res.status(statusCode).json({
          success: false,
          error: errorMessage,
          code: statusCode,
          details: data?.error || data?.message,
          integration: '[EXTERNAL_SERVICE]',
          timestamp: new Date().toISOString()
        });
      }
      // [/ERROR_HANDLING]
      
      logger.error('Erro interno na integração [EXTERNAL_SERVICE] - [OPERATION_NAME]', {
        url: req.url,
        method: req.method,
        integration: '[EXTERNAL_SERVICE]',
        operation: '[OPERATION_NAME]',
        response_time_ms: responseTime,
        error_message: error.message,
        error_stack: error.stack,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na integração com [EXTERNAL_SERVICE]',
        code: 500,
        integration: '[EXTERNAL_SERVICE]',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Função auxiliar para tratar erros de integração
 * @param {Object} integrationResult - Resultado da integração
 * @returns {Object} Status code e mensagem de erro
 */
function handleIntegrationError(integrationResult) {
  const status = integrationResult.status;
  
  switch (status) {
    case 400:
      return {
        statusCode: 400,
        errorMessage: 'Dados inválidos fornecidos para [EXTERNAL_SERVICE]'
      };
    case 401:
      return {
        statusCode: 401,
        errorMessage: 'Token inválido para [EXTERNAL_SERVICE]'
      };
    case 403:
      return {
        statusCode: 403,
        errorMessage: 'Acesso negado pelo [EXTERNAL_SERVICE]'
      };
    case 404:
      return {
        statusCode: 404,
        errorMessage: 'Recurso não encontrado no [EXTERNAL_SERVICE]'
      };
    case 409:
      return {
        statusCode: 409,
        errorMessage: 'Recurso já existe no [EXTERNAL_SERVICE]'
      };
    case 429:
      return {
        statusCode: 429,
        errorMessage: 'Rate limit atingido no [EXTERNAL_SERVICE]'
      };
    case 500:
      return {
        statusCode: 502,
        errorMessage: 'Erro interno no [EXTERNAL_SERVICE]'
      };
    default:
      return {
        statusCode: 502,
        errorMessage: 'Erro na comunicação com [EXTERNAL_SERVICE]'
      };
  }
}

/**
 * Função auxiliar para mapear erros HTTP externos
 * @param {number} status - Status HTTP da resposta externa
 * @param {Object} data - Dados da resposta de erro
 * @returns {Object} Status code e mensagem de erro mapeados
 */
function mapExternalHttpError(status, data) {
  // Implementar mapeamento específico para cada serviço externo
  return handleIntegrationError({ status, error: data?.error || data?.message });
}

/**
 * Função auxiliar para validar formato específico (exemplo)
 * @param {string} value - Valor para validar
 * @returns {boolean} True se válido
 */
function isValidFormat(value) {
  // Implementar validação específica
  // Exemplo: validar URL, email, telefone, etc.
  return true;
}

// [ADDITIONAL_ROUTES]
// Adicione outras rotas de integração aqui seguindo o mesmo padrão
// [/ADDITIONAL_ROUTES]

module.exports = router;

/**
 * INSTRUÇÕES DE USO:
 * 
 * 1. PLACEHOLDERS OBRIGATÓRIOS:
 *    - [OPERATION_DESCRIPTION]: Descrição da operação (ex: "Enviar mensagem via WhatsApp")
 *    - [EXTERNAL_SERVICE]: Nome do serviço externo (ex: "WUZAPI", "NocoDB", "Airtable")
 *    - [HTTP_METHOD]: Método HTTP (GET, POST, PUT, DELETE)
 *    - [HTTP_METHOD_LOWERCASE]: Método em minúsculo (get, post, put, delete)
 *    - [INTEGRATION]: Nome da integração para rota (ex: "wuzapi", "nocodb")
 *    - [ENDPOINT]: Endpoint específico (ex: "send-message", "get-data")
 *    - [OPERATION_NAME]: Nome da operação para logs (ex: "envio de mensagem")
 *    - [SUCCESS_STATUS_CODE]: Código de sucesso (200, 201)
 *    - [SUCCESS_MESSAGE]: Mensagem de sucesso
 * 
 * 2. SEÇÕES CONDICIONAIS:
 *    - [PARAMETERS_SECTION]: Incluir apenas se houver parâmetros
 *    - [EXTRACT_PARAMETERS]: Código para extrair parâmetros
 *    - [VALIDATE_INPUT]: Validações específicas da integração
 *    - [TOKEN_VALIDATION]: Validação de token (remover se não necessário)
 *    - [INTEGRATION_LOGIC]: Lógica principal da integração
 *    - [ERROR_HANDLING]: Tratamento de erros específicos
 *    - [LOG_SPECIFIC_DATA]: Dados específicos para log
 * 
 * 3. EXEMPLOS DE SUBSTITUIÇÃO:
 *    - Para WUZAPI: [EXTERNAL_SERVICE] = "WUZAPI", [INTEGRATION] = "wuzapi"
 *    - Para NocoDB: [EXTERNAL_SERVICE] = "NocoDB", [INTEGRATION] = "nocodb"
 *    - Para envio de mensagem: [ENDPOINT] = "send-message", [HTTP_METHOD] = "POST"
 * 
 * 4. INTEGRAÇÃO NO SERVIDOR:
 *    - Adicionar em server/index.js: app.use('/api/[integration]', require('./routes/[integration]Routes'));
 */