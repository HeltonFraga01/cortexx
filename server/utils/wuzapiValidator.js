/**
 * WUZAPI Validator
 * 
 * Valida conexão e status da instância WUZAPI antes de iniciar campanhas
 */

const axios = require('axios');
const { logger } = require('./logger');
const { validatePhoneWithAPI } = require('../services/PhoneValidationService');

class WuzapiValidator {
  constructor() {
    this.baseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    this.timeout = 10000; // 10 segundos
  }

  /**
   * Valida se a instância está conectada e pronta para enviar mensagens
   * @param {string} token - Token da instância WUZAPI
   * @returns {Promise<{valid: boolean, error?: string, status?: string}>}
   */
  async validateInstance(token) {
    try {
      logger.info('Validando instância WUZAPI', {
        token: token?.substring(0, 8) + '...',
        baseUrl: this.baseUrl
      });

      // Tentar obter status da instância usando endpoint correto /session/status
      const response = await axios.get(
        `${this.baseUrl}/session/status`,
        {
          headers: {
            'token': token,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      // A resposta da WUZAPI tem formato: { code: 200, data: { connected: true, loggedIn: true, ... }, success: true }
      const data = response.data?.data || response.data;
      const isConnected = data?.connected === true || data?.loggedIn === true;
      const status = isConnected ? 'connected' : (data?.status || data?.state || 'disconnected');
      
      logger.info('Status da instância WUZAPI', {
        token: token?.substring(0, 8) + '...',
        status,
        connected: data?.connected,
        loggedIn: data?.loggedIn,
        name: data?.name
      });

      // Verificar se está conectado
      if (isConnected) {
        return {
          valid: true,
          status: 'connected'
        };
      }

      return {
        valid: false,
        error: `Instância não está conectada. Status: ${status}`,
        status
      };

    } catch (error) {
      logger.error('Erro ao validar instância WUZAPI', {
        token: token?.substring(0, 8) + '...',
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        valid: false,
        error: error.response?.data?.message || error.message,
        status: 'ERROR'
      };
    }
  }

  /**
   * Testa envio de mensagem para validar permissões
   * @param {string} token - Token da instância WUZAPI
   * @param {string} testPhone - Número de teste (opcional)
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async testSendPermission(token, testPhone = null) {
    try {
      // Se não tiver número de teste, apenas validar a instância
      if (!testPhone) {
        return await this.validateInstance(token);
      }

      logger.info('Testando permissão de envio', {
        token: token?.substring(0, 8) + '...',
        testPhone
      });

      // Validar número de telefone usando API WUZAPI /user/check
      logger.debug('Validando telefone de teste', {
        token: token?.substring(0, 8) + '...',
        testPhone
      });

      const phoneValidation = await validatePhoneWithAPI(testPhone, token);

      if (!phoneValidation.isValid) {
        logger.warn('Número de teste inválido', {
          token: token?.substring(0, 8) + '...',
          testPhone,
          error: phoneValidation.error
        });

        return {
          valid: false,
          error: `Número de teste inválido: ${phoneValidation.error}`
        };
      }

      // Usar o número validado pela API
      const validatedPhone = phoneValidation.validatedPhone;

      logger.debug('Telefone de teste validado', {
        token: token?.substring(0, 8) + '...',
        original: testPhone,
        validated: validatedPhone,
        jid: phoneValidation.jid
      });

      // Tentar enviar mensagem de teste com número validado
      const response = await axios.post(
        `${this.baseUrl}/chat/send/text`,
        {
          Phone: validatedPhone,
          Body: 'Teste de validação - ignore esta mensagem'
        },
        {
          headers: {
            'token': token,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      logger.info('Teste de envio bem-sucedido', {
        token: token?.substring(0, 8) + '...',
        phone: validatedPhone,
        response: response.data
      });

      return {
        valid: true
      };

    } catch (error) {
      logger.error('Erro ao testar permissão de envio', {
        token: token?.substring(0, 8) + '...',
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        valid: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Valida formato do token
   * @param {string} token - Token para validar
   * @returns {boolean}
   */
  isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Token deve ter pelo menos 20 caracteres
    if (token.length < 20) {
      return false;
    }

    return true;
  }
}

// Exportar instância singleton
const wuzapiValidator = new WuzapiValidator();

module.exports = {
  WuzapiValidator,
  wuzapiValidator
};
