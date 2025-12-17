const express = require('express');
const adminValidator = require('../validators/adminValidator');
const brandingValidator = require('../validators/brandingValidator');
const errorHandler = require('../middleware/errorHandler');
const htmlSanitizer = require('../utils/htmlSanitizer');
const { logger } = require('../utils/logger');
const { requireAdmin } = require('../middleware/auth');

// Importar função para invalidar cache de branding
// TEMPORARIAMENTE DESABILITADO devido a dependência circular
let invalidateBrandingCache = () => {
  logger.info('ℹ️ invalidateBrandingCache não disponível (modo de teste ou inicialização)');
};

// try {
//   const serverModule = require('../index');
//   invalidateBrandingCache = serverModule.invalidateBrandingCache;
// } catch (error) {
//   // Durante testes ou inicialização, o módulo pode não estar disponível
//   logger.warn('⚠️ Não foi possível importar invalidateBrandingCache do index.js');
//   invalidateBrandingCache = () => {
//     logger.info('ℹ️ invalidateBrandingCache não disponível (modo de teste ou inicialização)');
//   };
// }

const router = express.Router();

/**
 * Rota para obter configuração de branding (ADMIN)
 * GET /api/branding
 * 
 * Requer autenticação de admin via sessão.
 * 
 * Responses:
 * - 200: Configuração de branding recuperada com sucesso
 * - 401: Não autenticado ou sessão expirada
 * - 403: Não possui permissões administrativas
 * - 500: Erro interno do servidor
 */
router.get('/',
  requireAdmin,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Sessão já foi validada pelo middleware requireAdmin
      // Buscar configuração de branding do banco de dados
      const db = req.app.locals.db;
      const brandingConfig = await db.getBrandingConfig();
      
      const responseTime = Date.now() - startTime;
      
      logger.info('Configuração de branding recuperada com sucesso', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        config_id: brandingConfig.id,
        app_name: brandingConfig.appName,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(200).json({
        success: true,
        code: 200,
        data: brandingConfig,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na rota de obtenção de branding', {
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
        error: 'Erro interno na obtenção da configuração de branding',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para atualizar configuração de branding (ADMIN)
 * PUT /api/branding
 * 
 * Requer autenticação de admin via sessão.
 * 
 * Body:
 * - appName: string (1-50 caracteres, obrigatório)
 * - logoUrl: string (URL válida, opcional)
 * - primaryColor: string (formato #RRGGBB, opcional)
 * - secondaryColor: string (formato #RRGGBB, opcional)
 * - customHomeHtml: string (HTML customizado, opcional)
 * - supportPhone: string (10-15 dígitos com código do país, opcional)
 * 
 * Responses:
 * - 200: Configuração de branding atualizada com sucesso
 * - 400: Dados de entrada inválidos
 * - 401: Não autenticado ou sessão expirada
 * - 403: Não possui permissões administrativas
 * - 500: Erro interno do servidor
 */
router.put('/',
  requireAdmin,
  async (req, res) => {
    const startTime = Date.now();
    
    // Log session state for debugging
    logger.info('📝 Branding PUT request received', {
      url: req.url,
      method: req.method,
      sessionId: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId,
      role: req.session?.role,
      hasUserToken: !!req.session?.userToken,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    try {
      // Session already validated by requireAdmin middleware
      const brandingData = req.body;

      // Validação básica dos dados de entrada
      if (!brandingData || typeof brandingData !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Dados de configuração de branding são obrigatórios',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Log do payload recebido
      logger.info('📥 Payload de branding recebido', {
        url: req.url,
        method: req.method,
        has_custom_html: brandingData.customHomeHtml !== undefined && brandingData.customHomeHtml !== null,
        custom_html_length: brandingData.customHomeHtml ? brandingData.customHomeHtml.length : 0,
        custom_html_preview: brandingData.customHomeHtml ? brandingData.customHomeHtml.substring(0, 100) + '...' : null,
        app_name: brandingData.appName,
        has_primary_color: !!brandingData.primaryColor,
        has_secondary_color: !!brandingData.secondaryColor,
        has_support_phone: brandingData.supportPhone !== undefined,
        support_phone: brandingData.supportPhone,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Validar cores se fornecidas
      if (brandingData.primaryColor !== undefined && brandingData.primaryColor !== null && brandingData.primaryColor !== '') {
        const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorPattern.test(brandingData.primaryColor)) {
          logger.warn('❌ Cor primária com formato inválido', {
            url: req.url,
            method: req.method,
            primary_color: brandingData.primaryColor,
            user_agent: req.get('User-Agent'),
            ip: req.ip
          });
          
          return res.status(400).json({
            success: false,
            error: 'Cor primária deve estar no formato #RRGGBB (ex: #3B82F6)',
            code: 400,
            timestamp: new Date().toISOString()
          });
        }
        logger.info('✅ Cor primária validada', {
          url: req.url,
          primary_color: brandingData.primaryColor
        });
      } else if (brandingData.primaryColor === '') {
        // Cor vazia - definir como null para usar padrão
        logger.info('🗑️ Cor primária vazia - será removida (usar padrão)', {
          url: req.url
        });
        brandingData.primaryColor = null;
      }

      if (brandingData.secondaryColor !== undefined && brandingData.secondaryColor !== null && brandingData.secondaryColor !== '') {
        const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorPattern.test(brandingData.secondaryColor)) {
          logger.warn('❌ Cor secundária com formato inválido', {
            url: req.url,
            method: req.method,
            secondary_color: brandingData.secondaryColor,
            user_agent: req.get('User-Agent'),
            ip: req.ip
          });
          
          return res.status(400).json({
            success: false,
            error: 'Cor secundária deve estar no formato #RRGGBB (ex: #10B981)',
            code: 400,
            timestamp: new Date().toISOString()
          });
        }
        logger.info('✅ Cor secundária validada', {
          url: req.url,
          secondary_color: brandingData.secondaryColor
        });
      } else if (brandingData.secondaryColor === '') {
        // Cor vazia - definir como null para usar padrão
        logger.info('🗑️ Cor secundária vazia - será removida (usar padrão)', {
          url: req.url
        });
        brandingData.secondaryColor = null;
      }

      // Validar e sanitizar HTML customizado se presente
      if (brandingData.customHomeHtml !== undefined && brandingData.customHomeHtml !== null && brandingData.customHomeHtml !== '') {
        logger.info('🔍 Iniciando validação e sanitização do HTML customizado', {
          original_length: brandingData.customHomeHtml.length,
          url: req.url
        });

        const htmlValidation = htmlSanitizer.validateAndSanitize(brandingData.customHomeHtml);
        
        if (!htmlValidation.success) {
          logger.warn('❌ HTML customizado contém conteúdo perigoso ou inválido', {
            url: req.url,
            method: req.method,
            errors: htmlValidation.errors,
            warnings: htmlValidation.warnings,
            html_length: brandingData.customHomeHtml.length,
            user_agent: req.get('User-Agent'),
            ip: req.ip
          });
          
          return res.status(400).json({
            success: false,
            error: 'HTML customizado contém conteúdo inválido ou perigoso',
            details: htmlValidation.errors,
            warnings: htmlValidation.warnings,
            code: 400,
            timestamp: new Date().toISOString()
          });
        }
        
        // Substituir HTML original pelo HTML sanitizado
        const originalLength = brandingData.customHomeHtml.length;
        brandingData.customHomeHtml = htmlValidation.sanitized;
        
        logger.info('✅ HTML customizado sanitizado com sucesso', {
          url: req.url,
          original_length: originalLength,
          sanitized_length: htmlValidation.sanitized.length,
          size_diff: originalLength - htmlValidation.sanitized.length,
          has_warnings: htmlValidation.warnings && htmlValidation.warnings.length > 0
        });
        
        // Log de warnings se houver
        if (htmlValidation.warnings && htmlValidation.warnings.length > 0) {
          logger.info('⚠️ HTML customizado sanitizado com warnings', {
            url: req.url,
            method: req.method,
            warnings: htmlValidation.warnings,
            user_agent: req.get('User-Agent'),
            ip: req.ip
          });
        }
      } else if (brandingData.customHomeHtml === '') {
        // HTML vazio - definir como null para limpar no banco
        logger.info('🗑️ HTML customizado vazio - será removido do banco', {
          url: req.url
        });
        brandingData.customHomeHtml = null;
      } else {
        logger.info('ℹ️ Nenhum HTML customizado fornecido no payload', {
          url: req.url,
          custom_html_value: brandingData.customHomeHtml
        });
      }

      // Validar telefone de suporte se fornecido
      if (brandingData.supportPhone !== undefined) {
        const phoneValidation = brandingValidator.validateSupportPhone(brandingData.supportPhone);
        
        if (!phoneValidation.isValid) {
          logger.warn('❌ Telefone de suporte com formato inválido', {
            url: req.url,
            method: req.method,
            support_phone: brandingData.supportPhone,
            error: phoneValidation.error,
            user_agent: req.get('User-Agent'),
            ip: req.ip
          });
          
          return res.status(400).json({
            success: false,
            error: phoneValidation.error,
            code: 400,
            timestamp: new Date().toISOString()
          });
        }
        
        // Usar o valor sanitizado (apenas dígitos)
        brandingData.supportPhone = phoneValidation.sanitized;
        
        logger.info('✅ Telefone de suporte validado', {
          url: req.url,
          support_phone: brandingData.supportPhone
        });
      }

      // Update branding configuration in database
      const db = req.app.locals.db;
      
      try {
        logger.info('📤 Enviando dados para db.updateBrandingConfig()', {
          url: req.url,
          app_name: brandingData.appName,
          has_logo: !!brandingData.logoUrl,
          has_primary_color: !!brandingData.primaryColor,
          has_secondary_color: !!brandingData.secondaryColor,
          has_custom_html: !!brandingData.customHomeHtml,
          custom_html_length: brandingData.customHomeHtml ? brandingData.customHomeHtml.length : 0,
          support_phone: brandingData.supportPhone
        });

        const updatedConfig = await db.updateBrandingConfig(brandingData);
        
        // Log específico para HTML customizado
        if (updatedConfig.customHomeHtml) {
          logger.info('✅ HTML customizado salvo com sucesso', {
            url: req.url,
            html_length: updatedConfig.customHomeHtml.length,
            html_size_kb: Math.round(updatedConfig.customHomeHtml.length / 1024),
            has_script_tags: /<script/i.test(updatedConfig.customHomeHtml),
            has_style_tags: /<style/i.test(updatedConfig.customHomeHtml)
          });
        }
        
        // Invalidar cache de branding após atualização bem-sucedida
        if (invalidateBrandingCache) {
          invalidateBrandingCache();
          logger.info('🗑️ Cache de branding invalidado após atualização');
        }
        
        const responseTime = Date.now() - startTime;
        
        logger.info('Configuração de branding atualizada com sucesso', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          config_id: updatedConfig.id,
          app_name: updatedConfig.appName,
          has_logo: !!updatedConfig.logoUrl,
          has_primary_color: !!updatedConfig.primaryColor,
          has_secondary_color: !!updatedConfig.secondaryColor,
          has_custom_html: !!updatedConfig.customHomeHtml,
          custom_html_length: updatedConfig.customHomeHtml ? updatedConfig.customHomeHtml.length : 0,
          support_phone: updatedConfig.supportPhone,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          code: 200,
          message: 'Configuração de branding atualizada com sucesso',
          data: updatedConfig,
          timestamp: new Date().toISOString()
        });
      } catch (validationError) {
        // Erro de validação dos dados de branding
        const responseTime = Date.now() - startTime;
        
        logger.warn('Erro de validação na atualização de branding', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          error_message: validationError.message,
          branding_data: {
            appName: brandingData.appName,
            hasLogoUrl: !!brandingData.logoUrl,
            hasPrimaryColor: !!brandingData.primaryColor,
            hasSecondaryColor: !!brandingData.secondaryColor
          },
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        // Retornar mensagem de erro mais descritiva
        const errorMessage = validationError.message || 'Dados de configuração inválidos';
        return res.status(400).json({
          success: false,
          error: errorMessage,
          message: errorMessage,
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na rota de atualização de branding', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        error_message: error.message,
        error_stack: error.stack,
        branding_data: req.body,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na atualização da configuração de branding',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota PÚBLICA para obter HTML da landing page customizada
 * GET /api/branding/landing-page (sem autenticação)
 * 
 * Esta rota é pública e não requer autenticação.
 * Retorna o HTML customizado da landing page se configurado.
 * 
 * Responses:
 * - 200: HTML da landing page recuperado com sucesso
 * - 404: Nenhuma landing page customizada configurada
 * - 500: Erro interno do servidor
 */
router.get('/landing-page',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Buscar configuração de branding do banco de dados
      const db = req.app.locals.db;
      const brandingConfig = await db.getBrandingConfig();
      
      // Verificar se há HTML customizado
      if (!brandingConfig.customHomeHtml) {
        const responseTime = Date.now() - startTime;
        
        logger.info('Nenhuma landing page customizada configurada', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(404).json({
          success: false,
          error: 'Nenhuma landing page customizada configurada',
          code: 404,
          timestamp: new Date().toISOString()
        });
      }
      
      const responseTime = Date.now() - startTime;
      
      logger.info('Landing page customizada recuperada', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        html_length: brandingConfig.customHomeHtml.length,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Configurar cache para melhorar performance
      res.set('Cache-Control', 'public, max-age=300'); // Cache por 5 minutos

      return res.status(200).json({
        success: true,
        code: 200,
        data: {
          html: brandingConfig.customHomeHtml
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na rota pública de landing page', {
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
        error: 'Erro interno na obtenção da landing page',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota PÚBLICA para obter configuração de branding
 * GET /api/branding/public (sem autenticação)
 * 
 * Esta rota é pública e não requer autenticação.
 * Retorna apenas informações de branding (nome, logo, cores) que são
 * necessárias para exibir a landing page e interface pública.
 * 
 * Responses:
 * - 200: Configuração de branding recuperada com sucesso
 * - 500: Erro interno do servidor
 */
router.get('/public',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Buscar configuração de branding do banco de dados
      const db = req.app.locals.db;
      const brandingConfig = await db.getBrandingConfig();
      
      // Retornar apenas dados públicos (sem informações sensíveis)
      const publicBrandingData = {
        appName: brandingConfig.appName,
        logoUrl: brandingConfig.logoUrl,
        primaryColor: brandingConfig.primaryColor,
        secondaryColor: brandingConfig.secondaryColor,
        customHomeHtml: brandingConfig.customHomeHtml,
        supportPhone: brandingConfig.supportPhone,
        ogImageUrl: brandingConfig.ogImageUrl
      };
      
      const responseTime = Date.now() - startTime;
      
      logger.info('Configuração pública de branding recuperada', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        app_name: publicBrandingData.appName,
        has_custom_html: !!publicBrandingData.customHomeHtml,
        has_support_phone: !!publicBrandingData.supportPhone,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Configurar cache para melhorar performance
      res.set('Cache-Control', 'public, max-age=300'); // Cache por 5 minutos

      return res.status(200).json({
        success: true,
        code: 200,
        data: publicBrandingData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na rota pública de branding', {
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
        error: 'Erro interno na obtenção da configuração de branding',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;