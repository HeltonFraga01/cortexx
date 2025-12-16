const wuzapiClient = require('../utils/wuzapiClient');
const { logger } = require('../utils/logger');

/**
 * Validador de sessões de usuários comuns
 * Responsável por validar tokens de usuários através do endpoint /session/status da WuzAPI
 */
class SessionValidator {
  
  /**
   * Valida um token de usuário na WuzAPI
   * @param {string} token - Token de autorização do usuário
   * @returns {Promise<SessionValidationResult>} Resultado da validação
   */
  async validateUserToken(token) {
    const startTime = Date.now();
    
    try {
      // Log da tentativa de validação
      logger.info('Iniciando validação de token de usuário', {
        action: 'validate_user_token',
        token_prefix: this._maskToken(token)
      });

      // Fazer requisição para WuzAPI
      const response = await wuzapiClient.get('/session/status', {
        headers: { 'token': token }
      });
      const responseTime = Date.now() - startTime;

      if (response.success && response.status === 200) {
        // Token válido
        const userData = this._extractUserData(response.data);
        
        logger.info('Token de usuário validado com sucesso', {
          action: 'validate_user_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          connected: userData.connected,
          logged_in: userData.loggedIn
        });

        return {
          isValid: true,
          userData: userData
        };
      } else {
        // Token inválido ou erro
        logger.warn('Falha na validação de token de usuário', {
          action: 'validate_user_token',
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
      
      logger.error('Erro interno na validação de token de usuário', {
        action: 'validate_user_token',
        token_prefix: this._maskToken(token),
        response_time_ms: responseTime,
        error_message: error.message
      });

      return {
        isValid: false,
        error: 'Erro interno na validação do token'
      };
    }
  }

  /**
   * Extrai dados do usuário da resposta da WuzAPI
   * @param {Object} wuzapiData - Dados retornados pela WuzAPI
   * @returns {Object} Dados estruturados do usuário
   * @private
   */
  _extractUserData(wuzapiData) {
    // A WuzAPI retorna dados no formato: { code: 200, data: { connected: true, loggedIn: true }, success: true }
    const sessionData = wuzapiData.data || {};
    
    return {
      connected: sessionData.connected || sessionData.Connected || false,
      loggedIn: sessionData.loggedIn || sessionData.LoggedIn || false,
      jid: sessionData.jid || sessionData.JID || null
    };
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
        return 'Token inválido ou expirado';
      case 400:
        return 'Token de autorização necessário';
      case 504:
        return 'Timeout na validação - tente novamente';
      case 500:
        return 'Serviço de validação temporariamente indisponível';
      default:
        return originalError || 'Erro na validação do token';
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
   * Verifica se um token tem formato válido (básico)
   * @param {string} token - Token para validar
   * @returns {boolean} True se o formato é válido
   */
  isValidTokenFormat(token) {
    return token && 
           typeof token === 'string' && 
           token.length >= 8 && 
           token.length <= 256 &&
           !/\s/.test(token); // Não deve conter espaços
  }
}

module.exports = new SessionValidator();