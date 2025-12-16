/**
 * BrandingController - Manipulação de Request/Response
 * 
 * Responsabilidade única: traduzir HTTP para domínio e vice-versa.
 * NÃO deve conter lógica de negócio.
 */

const { logger } = require('../../../../utils/logger');
const BrandingService = require('../../core/services/BrandingService');
const BrandingMapper = require('../../infra/mappers/BrandingMapper');
const { BrandingValidationError } = require('../../core/errors');

class BrandingController {
  /**
   * GET /api/branding
   * Obtém configuração de branding
   */
  static async getConfig(req, res) {
    try {
      const db = req.app.locals.db;
      const service = new BrandingService(db);
      
      const config = await service.getConfig();
      const dto = BrandingMapper.toDTO(config);

      res.json({
        success: true,
        data: dto
      });
    } catch (error) {
      logger.error('Erro ao obter branding:', {
        error: error.message,
        endpoint: '/api/branding'
      });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter configuração de branding'
      });
    }
  }

  /**
   * PUT /api/branding
   * Atualiza configuração de branding
   */
  static async updateConfig(req, res) {
    try {
      const db = req.app.locals.db;
      const service = new BrandingService(db);
      
      const data = {
        appName: req.body.appName,
        logoUrl: req.body.logoUrl,
        primaryColor: req.body.primaryColor,
        secondaryColor: req.body.secondaryColor,
        customHomeHtml: req.body.customHomeHtml,
        supportPhone: req.body.supportPhone
      };

      const config = await service.updateConfig(data);
      const dto = BrandingMapper.toDTO(config);

      logger.info('Branding atualizado com sucesso', {
        userId: req.user?.id,
        endpoint: '/api/branding'
      });

      res.json({
        success: true,
        data: dto,
        message: 'Configuração de branding atualizada com sucesso'
      });
    } catch (error) {
      if (error instanceof BrandingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          errors: error.errors
        });
      }

      logger.error('Erro ao atualizar branding:', {
        error: error.message,
        userId: req.user?.id,
        endpoint: '/api/branding'
      });

      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar configuração de branding'
      });
    }
  }
}

module.exports = BrandingController;
