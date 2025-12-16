const { logger } = require('../utils/logger');

/**
 * Validador para configurações de branding
 * Responsável por validar dados de branding incluindo telefone de suporte
 */
class BrandingValidator {
  
  /**
   * Valida um número de telefone de suporte para WhatsApp
   * @param {string} phone - Número de telefone para validar
   * @returns {Object} Resultado da validação { isValid: boolean, error?: string, sanitized?: string }
   */
  validateSupportPhone(phone) {
    // Permitir null/undefined/empty para desabilitar o botão de suporte
    if (phone === null || phone === undefined || phone === '') {
      logger.info('ℹ️ Telefone de suporte vazio - botão será desabilitado');
      return {
        isValid: true,
        sanitized: null
      };
    }

    // Verificar se é string
    if (typeof phone !== 'string') {
      logger.error('❌ Validação falhou: Telefone de suporte não é uma string', {
        type: typeof phone
      });
      return {
        isValid: false,
        error: 'Telefone de suporte deve ser uma string'
      };
    }

    // Remover caracteres não numéricos para validação
    const digitsOnly = phone.replace(/\D/g, '');

    // Validar: apenas dígitos, 10-15 caracteres (incluindo código do país)
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      logger.error('❌ Validação falhou: Telefone de suporte com tamanho inválido', {
        original: phone,
        digitsOnly: digitsOnly,
        length: digitsOnly.length
      });
      return {
        isValid: false,
        error: 'Número deve conter apenas dígitos (10-15 caracteres com código do país)'
      };
    }

    logger.info('✅ Telefone de suporte validado:', {
      original: phone,
      sanitized: digitsOnly
    });

    return {
      isValid: true,
      sanitized: digitsOnly
    };
  }

  /**
   * Verifica se um telefone tem formato válido (apenas dígitos, 10-15 caracteres)
   * @param {string} phone - Número de telefone para verificar
   * @returns {boolean} True se o formato é válido
   */
  isValidPhoneFormat(phone) {
    if (!phone || typeof phone !== 'string') {
      return false;
    }
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  }

  /**
   * Sanitiza um número de telefone removendo caracteres não numéricos
   * @param {string} phone - Número de telefone para sanitizar
   * @returns {string|null} Número sanitizado ou null se inválido
   */
  sanitizePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return null;
    }
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15 ? digitsOnly : null;
  }
}

module.exports = new BrandingValidator();
