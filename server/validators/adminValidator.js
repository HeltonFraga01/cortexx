const wuzapiClient = require('../utils/wuzapiClient');
const { logger } = require('../utils/logger');

/**
 * Validador de tokens administrativos
 * Responsável por validar tokens de administradores através do endpoint /admin/users da WuzAPI
 */
class AdminValidator {
  
  /**
   * Valida um token administrativo na WuzAPI
   * @param {string} token - Token de autorização administrativo
   * @returns {Promise<AdminValidationResult>} Resultado da validação
   */
  async validateAdminToken(token) {
    const startTime = Date.now();
    
    try {
      // Log da tentativa de validação
      logger.info('Iniciando validação de token administrativo', {
        action: 'validate_admin_token',
        token_prefix: this._maskToken(token)
      });

      // Fazer requisição para WuzAPI
      const response = await wuzapiClient.getAdmin('/admin/users', token);
      const responseTime = Date.now() - startTime;

      // Log detalhado da resposta da WuzAPI
      logger.info('Resposta recebida da WuzAPI para validação de token', {
        action: 'wuzapi_response_log',
        token_prefix: this._maskToken(token),
        status_code: response.status,
        response_data: response.data,
        response_time_ms: responseTime
      });

      if (response.success && response.status === 200) {
        // Token administrativo válido
        const users = this._extractUsersData(response.data);
        
        logger.info('Token administrativo validado com sucesso', {
          action: 'validate_admin_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          users_count: users.length
        });

        return {
          isValid: true,
          users: users,
          rawData: response.data // Dados originais da WuzAPI para proxy
        };
      } else {
        // Token inválido ou sem permissões administrativas
        logger.warn('Falha na validação de token administrativo', {
          action: 'validate_admin_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          error: response.error
        });

        return {
          isValid: false,
          error: this._getErrorMessage(response.status, response.error)
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na validação de token administrativo', {
        action: 'validate_admin_token',
        token_prefix: this._maskToken(token),
        response_time_ms: responseTime,
        error_message: error.message
      });

      return {
        isValid: false,
        error: 'Erro interno na validação do token administrativo'
      };
    }
  }

  /**
   * Extrai e normaliza dados dos usuários da resposta da WuzAPI
   * @param {Object} wuzapiData - Dados retornados pela WuzAPI
   * @returns {Array} Lista de usuários estruturados
   * @private
   */
  _extractUsersData(wuzapiData) {
    // A WuzAPI retorna dados no formato: { code: 200, data: [...], success: true }
    const usersArray = wuzapiData.data || [];
    
    return usersArray.map(user => ({
      id: user.id || '',
      name: user.name || '',
      token: user.token || '',
      connected: user.connected || false,
      loggedIn: user.loggedIn || false,
      jid: user.jid || '',
      webhook: user.webhook || '',
      events: user.events || '',
      expiration: user.expiration || 0,
      qrcode: user.qrcode || '',
      proxy_url: user.proxy_url || '',
      proxy_config: user.proxy_config || {},
      s3_config: user.s3_config || {}
    }));
  }

  /**
   * Gera mensagem de erro apropriada baseada no status da resposta
   * @param {number} statusCode - Código de status HTTP
   * @param {string} originalError - Erro original da WuzAPI
   * @returns {string} Mensagem de erro user-friendly
   * @private
   */
  _getErrorMessage(statusCode, originalError) {
    switch (statusCode) {
      case 401:
        return 'Token administrativo inválido ou expirado';
      case 403:
        return 'Token não possui permissões administrativas';
      case 400:
        return 'Token de autorização administrativo necessário';
      case 504:
        return 'Timeout na validação administrativa - tente novamente';
      case 500:
        return 'Serviço de validação administrativa temporariamente indisponível';
      default:
        return originalError || 'Erro na validação do token administrativo';
    }
  }

  /**
   * Mascara o token para logs (mostra apenas os primeiros 8 caracteres)
   * @param {string} token - Token completo
   * @returns {string} Token mascarado
   * @private
   */
  _maskToken(token) {
    if (!token || typeof token !== 'string') {
      return 'INVALID_TOKEN';
    }
    
    if (token.length <= 8) {
      return token.substring(0, 4) + '...';
    }
    
    return token.substring(0, 8) + '...';
  }

  /**
   * Verifica se um token tem formato válido para administração
   * @param {string} token - Token para validar
   * @returns {boolean} True se o formato é válido
   */
  isValidTokenFormat(token) {
    return token && 
           typeof token === 'string' && 
           token.length >= 16 && // Tokens admin geralmente são mais longos
           token.length <= 256 &&
           !/\s/.test(token); // Não deve conter espaços
  }

  /**
   * Filtra usuários por status de conexão
   * @param {Array} users - Lista de usuários
   * @param {boolean} connectedOnly - Se deve retornar apenas usuários conectados
   * @returns {Array} Lista filtrada de usuários
   */
  filterUsersByConnection(users, connectedOnly = false) {
    if (!connectedOnly) {
      return users;
    }
    
    return users.filter(user => user.connected === true);
  }

  /**
   * Filtra usuários por status de login
   * @param {Array} users - Lista de usuários
   * @param {boolean} loggedInOnly - Se deve retornar apenas usuários logados
   * @returns {Array} Lista filtrada de usuários
   */
  filterUsersByLogin(users, loggedInOnly = false) {
    if (!loggedInOnly) {
      return users;
    }
    
    return users.filter(user => user.loggedIn === true);
  }

  /**
   * Obtém estatísticas dos usuários
   * @param {Array} users - Lista de usuários
   * @returns {Object} Estatísticas dos usuários
   */
  getUserStats(users) {
    const total = users.length;
    const connected = users.filter(u => u.connected).length;
    const loggedIn = users.filter(u => u.loggedIn).length;
    const withWebhook = users.filter(u => u.webhook && u.webhook.trim() !== '').length;
    
    return {
      total,
      connected,
      loggedIn,
      withWebhook,
      connectionRate: total > 0 ? Math.round((connected / total) * 100) : 0,
      loginRate: total > 0 ? Math.round((loggedIn / total) * 100) : 0
    };
  }
}

module.exports = new AdminValidator();