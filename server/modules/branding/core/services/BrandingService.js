/**
 * BrandingService - Casos de Uso de Branding
 * 
 * Camada de serviço agnóstica ao framework web.
 * Recebe dados tipados e retorna dados tipados ou erros de domínio.
 */

const { logger } = require('../../../../utils/logger');
const BrandingRepository = require('../../infra/repositories/BrandingRepository');
const { BrandingNotFoundError, BrandingValidationError } = require('../errors');

class BrandingService {
  constructor(database) {
    this.repository = new BrandingRepository(database);
  }

  /**
   * Obtém a configuração de branding atual
   * @returns {Promise<BrandingConfig>}
   */
  async getConfig() {
    try {
      const config = await this.repository.findFirst();
      
      if (!config) {
        logger.info('Nenhuma configuração de branding encontrada, retornando padrão');
        return this.getDefaultConfig();
      }

      return config;
    } catch (error) {
      logger.error('Erro ao obter configuração de branding:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza a configuração de branding
   * @param {Partial<BrandingConfig>} data
   * @returns {Promise<BrandingConfig>}
   */
  async updateConfig(data) {
    // Validar dados
    const validation = this.validateConfig(data);
    if (!validation.valid) {
      throw new BrandingValidationError(validation.errors);
    }

    try {
      const existing = await this.repository.findFirst();
      
      if (existing) {
        return await this.repository.update(existing.id, data);
      } else {
        return await this.repository.create(data);
      }
    } catch (error) {
      logger.error('Erro ao atualizar configuração de branding:', error.message);
      throw error;
    }
  }

  /**
   * Valida dados de configuração
   * @param {Partial<BrandingConfig>} data
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateConfig(data) {
    const errors = [];

    if (data.appName && data.appName.length > 50) {
      errors.push('Nome do app deve ter no máximo 50 caracteres');
    }

    if (data.primaryColor && !this.isValidHexColor(data.primaryColor)) {
      errors.push('Cor primária deve ser um código hexadecimal válido');
    }

    if (data.secondaryColor && !this.isValidHexColor(data.secondaryColor)) {
      errors.push('Cor secundária deve ser um código hexadecimal válido');
    }

    if (data.supportPhone && !this.isValidPhone(data.supportPhone)) {
      errors.push('Telefone de suporte deve ser um número válido');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Retorna configuração padrão
   * @returns {BrandingConfig}
   */
  getDefaultConfig() {
    return {
      id: null,
      appName: 'WUZAPI',
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      customHomeHtml: null,
      supportPhone: null
    };
  }

  /**
   * Valida cor hexadecimal
   * @param {string} color
   * @returns {boolean}
   */
  isValidHexColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  /**
   * Valida número de telefone
   * @param {string} phone
   * @returns {boolean}
   */
  isValidPhone(phone) {
    return /^\d{10,15}$/.test(phone.replace(/\D/g, ''));
  }
}

module.exports = BrandingService;
