/**
 * Template para Rotas de Usuário
 * 
 * Este template fornece a estrutura padrão para implementar rotas de usuário
 * no WUZAPI Manager. Substitua os placeholders [PLACEHOLDER] pelos valores específicos.
 * 
 * Uso:
 * 1. Copie este arquivo para server/routes/[domain]Routes.js
 * 2. Substitua todos os placeholders
 * 3. Implemente a lógica específica
 * 4. Adicione a rota no servidor principal
 */

const express = require('express');
const sessionValidator = require('../validators/sessionValidator');
const errorHandler = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * [OPERATION_DESCRIPTION] - Rota de usuário
 * [HTTP_METHOD] /api/[DOMAIN]/[ENDPOINT]
 * 
 * Headers necessários:
 * - token: {user_token}
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
 * - 404: [RESOURCE] não encontrado
 * - 409: [RESOURCE] já existe (para criação)
 * - 500: Erro interno do servidor
 * - 502: Erro na comunicação com serviço externo
 * - 504: Timeout na comunicação externa
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
      const { param1, param2, limit = 50, offset = 0 } = req.query;
      
      // Para POST/PUT: extrair body parameters
      const requestData = req.body;
      // [/EXTRACT_PARAMETERS]
      
      // [VALIDATE_INPUT]
      // Validação básica dos dados de entrada
      if (!requestData || typeof requestData !== 'object') {
        return res.status(400).json({
          success: false,
          error: '[VALIDATION_ERROR_MESSAGE]',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validações específicas
      if (!requestData.requiredField) {
        return res.status(400).json({
          success: false,
          error: '[REQUIRED_FIELD] é obrigatório',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validação de parâmetros de paginação (se aplicável)
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limite deve ser um número entre 1 e 100',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      if (isNaN(offsetNum) || offsetNum < 0) {
        return res.status(400).json({
          success: false,
          error: 'Offset deve ser um número não negativo',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      // [/VALIDATE_INPUT]

      // Validar formato do token
      if (!sessionValidator.isValidTokenFormat(token)) {
        logger.warn('Token com formato inválido em [OPERATION_NAME]', {
          url: req.url,
          method: req.method,
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
      // Validar token na WuzAPI (se necessário para a operação)
      const validationResult = await sessionValidator.validateUserToken(token);
      const responseTime = Date.now() - startTime;

      if (!validationResult.isValid) {
        return errorHandler.handleValidationError(validationResult, req, res);
      }
      // [/TOKEN_VALIDATION]

      logger.info('Iniciando [OPERATION_NAME]', {
        url: req.url,
        method: req.method,
        // [LOG_SPECIFIC_DATA]
        param1: param1,
        has_request_data: !!requestData,
        limit: limitNum,
        offset: offsetNum,
        // [/LOG_SPECIFIC_DATA]
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // [BUSINESS_LOGIC]
      // Implementar lógica específica aqui
      
      // Exemplo para operação com banco de dados:
      const db = req.app.locals.db;
      const result = await db.[DATABASE_METHOD](token, {
        limit: limitNum,
        offset: offsetNum,
        ...requestData
      });
      
      // Exemplo para operação com WUZAPI:
      const wuzapiClient = require('../utils/wuzapiClient');
      const result = await wuzapiClient.[WUZAPI_METHOD](requestData, {
        headers: { 'token': token }
      });
      
      // Exemplo para operação simples:
      const result = {
        message: '[SUCCESS_MESSAGE]',
        data: processedData,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: processedData.length
        }
      };
      // [/BUSINESS_LOGIC]
      
      const finalResponseTime = Date.now() - startTime;
      
      logger.info('[OPERATION_NAME] realizada com sucesso', {
        url: req.url,
        method: req.method,
        response_time_ms: finalResponseTime,
        // [LOG_SUCCESS_DATA]
        result_count: Array.isArray(result.data) ? result.data.length : 1,
        operation_type: '[OPERATION_TYPE]',
        // [/LOG_SUCCESS_DATA]
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status([SUCCESS_STATUS_CODE]).json({
        success: true,
        code: [SUCCESS_STATUS_CODE],
        data: result,
        message: '[SUCCESS_MESSAGE]',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // [ERROR_HANDLING]
      // Tratamento específico de erros conhecidos
      if (error.code === 'ECONNABORTED') {
        logger.warn('[OPERATION_NAME] - timeout', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(504).json({
          success: false,
          error: 'Timeout na operação - tente novamente',
          code: 504,
          timestamp: new Date().toISOString()
        });
      }
      
      if (error.code === 'ECONNREFUSED') {
        logger.error('[OPERATION_NAME] - serviço indisponível', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(502).json({
          success: false,
          error: 'Serviço temporariamente indisponível',
          code: 502,
          timestamp: new Date().toISOString()
        });
      }
      // [/ERROR_HANDLING]
      
      logger.error('Erro interno em [OPERATION_NAME]', {
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
  }
);

// [ADDITIONAL_ROUTES]
// Adicione outras rotas de usuário aqui seguindo o mesmo padrão
// [/ADDITIONAL_ROUTES]

module.exports = router;

/**
 * INSTRUÇÕES DE USO:
 * 
 * 1. PLACEHOLDERS OBRIGATÓRIOS:
 *    - [OPERATION_DESCRIPTION]: Descrição da operação (ex: "Listar mensagens do usuário")
 *    - [HTTP_METHOD]: Método HTTP (GET, POST, PUT, DELETE)
 *    - [HTTP_METHOD_LOWERCASE]: Método em minúsculo (get, post, put, delete)
 *    - [DOMAIN]: Domínio da rota (ex: "messages", "webhook", "settings")
 *    - [ENDPOINT]: Endpoint específico (ex: "list", "send", "config")
 *    - [OPERATION_NAME]: Nome da operação para logs (ex: "listagem de mensagens")
 *    - [SUCCESS_STATUS_CODE]: Código de sucesso (200, 201)
 *    - [SUCCESS_MESSAGE]: Mensagem de sucesso
 * 
 * 2. SEÇÕES CONDICIONAIS:
 *    - [PARAMETERS_SECTION]: Incluir apenas se houver parâmetros
 *    - [EXTRACT_PARAMETERS]: Código para extrair parâmetros
 *    - [VALIDATE_INPUT]: Validações específicas
 *    - [TOKEN_VALIDATION]: Validação de token (remover se não necessário)
 *    - [BUSINESS_LOGIC]: Lógica principal da operação
 *    - [ERROR_HANDLING]: Tratamento de erros específicos
 *    - [LOG_SPECIFIC_DATA]: Dados específicos para log
 * 
 * 3. EXEMPLOS DE SUBSTITUIÇÃO:
 *    - Para listar mensagens: [DOMAIN] = "messages", [ENDPOINT] = "list"
 *    - Para enviar mensagem: [HTTP_METHOD] = "POST", [ENDPOINT] = "send"
 *    - Para configurar webhook: [DOMAIN] = "webhook", [ENDPOINT] = "config"
 * 
 * 4. INTEGRAÇÃO NO SERVIDOR:
 *    - Adicionar em server/index.js: app.use('/api/[domain]', require('./routes/[domain]Routes'));
 */