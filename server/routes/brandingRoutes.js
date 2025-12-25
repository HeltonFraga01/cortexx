const express = require('express');
const brandingValidator = require('../validators/brandingValidator');
const htmlSanitizer = require('../utils/htmlSanitizer');
const { logger } = require('../utils/logger');
const { requireAdmin } = require('../middleware/auth');
const TenantBrandingService = require('../services/TenantBrandingService');
const CacheService = require('../services/CacheService');

const router = express.Router();

/**
 * Rota para obter configuração de branding (ADMIN)
 * GET /api/branding
 * 
 * Requer autenticação de admin via sessão e contexto de tenant.
 * 
 * Responses:
 * - 200: Configuração de branding recuperada com sucesso
 * - 400: Contexto de tenant ausente
 * - 401: Não autenticado ou sessão expirada
 * - 403: Não possui permissões administrativas
 * - 500: Erro interno do servidor
 */
router.get('/',
  requireAdmin,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Extract tenant context
      const tenantId = req.context?.tenantId;
      
      if (!tenantId) {
        logger.warn('Missing tenant context in branding GET request', {
          url: req.url,
          method: req.method,
          context: req.context,
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Contexto de tenant é obrigatório',
          code: 'MISSING_TENANT_CONTEXT',
          timestamp: new Date().toISOString()
        });
      }

      // Get branding from tenant-specific table
      const brandingConfig = await TenantBrandingService.getBrandingByTenantId(tenantId);
      
      const responseTime = Date.now() - startTime;
      
      logger.info('Configuração de branding recuperada com sucesso', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        tenant_id: tenantId,
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
        tenant_id: req.context?.tenantId,
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
 * Requer autenticação de admin via sessão e contexto de tenant.
 * Valida que o tenant da sessão corresponde ao tenant do contexto.
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
 * - 400: Dados de entrada inválidos ou contexto de tenant ausente
 * - 401: Não autenticado ou sessão expirada
 * - 403: Não possui permissões administrativas ou acesso cross-tenant
 * - 500: Erro interno do servidor
 */
router.put('/',
  requireAdmin,
  async (req, res) => {
    const startTime = Date.now();
    
    logger.info('📝 Branding PUT request received', {
      url: req.url,
      method: req.method,
      sessionId: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId,
      role: req.session?.role,
      tenantId: req.context?.tenantId,
      sessionTenantId: req.session?.tenantId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    try {
      // Extract tenant context
      const tenantId = req.context?.tenantId;
      
      if (!tenantId) {
        logger.warn('Missing tenant context in branding PUT request', {
          url: req.url,
          method: req.method,
          context: req.context,
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Contexto de tenant é obrigatório',
          code: 'MISSING_TENANT_CONTEXT',
          timestamp: new Date().toISOString()
        });
      }

      // Cross-tenant access validation
      if (req.session?.tenantId && req.session.tenantId !== tenantId) {
        logger.warn('🚨 Cross-tenant branding access attempt detected', {
          url: req.url,
          method: req.method,
          sessionTenantId: req.session.tenantId,
          contextTenantId: tenantId,
          userId: req.session?.userId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(403).json({
          success: false,
          error: 'Acesso cross-tenant negado',
          code: 'CROSS_TENANT_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        });
      }

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
        tenant_id: tenantId,
        has_custom_html: brandingData.customHomeHtml !== undefined && brandingData.customHomeHtml !== null,
        custom_html_length: brandingData.customHomeHtml ? brandingData.customHomeHtml.length : 0,
        app_name: brandingData.appName,
        has_primary_color: !!brandingData.primaryColor,
        has_secondary_color: !!brandingData.secondaryColor,
        has_support_phone: brandingData.supportPhone !== undefined,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Validar cores se fornecidas
      if (brandingData.primaryColor !== undefined && brandingData.primaryColor !== null && brandingData.primaryColor !== '') {
        const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorPattern.test(brandingData.primaryColor)) {
          logger.warn('❌ Cor primária com formato inválido', {
            url: req.url,
            tenant_id: tenantId,
            primary_color: brandingData.primaryColor,
            ip: req.ip
          });
          
          return res.status(400).json({
            success: false,
            error: 'Cor primária deve estar no formato #RRGGBB (ex: #3B82F6)',
            code: 400,
            timestamp: new Date().toISOString()
          });
        }
      } else if (brandingData.primaryColor === '') {
        brandingData.primaryColor = null;
      }

      if (brandingData.secondaryColor !== undefined && brandingData.secondaryColor !== null && brandingData.secondaryColor !== '') {
        const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorPattern.test(brandingData.secondaryColor)) {
          logger.warn('❌ Cor secundária com formato inválido', {
            url: req.url,
            tenant_id: tenantId,
            secondary_color: brandingData.secondaryColor,
            ip: req.ip
          });
          
          return res.status(400).json({
            success: false,
            error: 'Cor secundária deve estar no formato #RRGGBB (ex: #10B981)',
            code: 400,
            timestamp: new Date().toISOString()
          });
        }
      } else if (brandingData.secondaryColor === '') {
        brandingData.secondaryColor = null;
      }

      // Validar e sanitizar HTML customizado se presente
      if (brandingData.customHomeHtml !== undefined && brandingData.customHomeHtml !== null && brandingData.customHomeHtml !== '') {
        logger.info('🔍 Iniciando validação e sanitização do HTML customizado', {
          original_length: brandingData.customHomeHtml.length,
          tenant_id: tenantId
        });

        const htmlValidation = htmlSanitizer.validateAndSanitize(brandingData.customHomeHtml);
        
        if (!htmlValidation.success) {
          logger.warn('❌ HTML customizado contém conteúdo perigoso ou inválido', {
            url: req.url,
            tenant_id: tenantId,
            errors: htmlValidation.errors,
            warnings: htmlValidation.warnings,
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
        
        brandingData.customHomeHtml = htmlValidation.sanitized;
      } else if (brandingData.customHomeHtml === '') {
        brandingData.customHomeHtml = null;
      }

      // Validar telefone de suporte se fornecido
      if (brandingData.supportPhone !== undefined) {
        const phoneValidation = brandingValidator.validateSupportPhone(brandingData.supportPhone);
        
        if (!phoneValidation.isValid) {
          logger.warn('❌ Telefone de suporte com formato inválido', {
            url: req.url,
            tenant_id: tenantId,
            support_phone: brandingData.supportPhone,
            error: phoneValidation.error,
            ip: req.ip
          });
          
          return res.status(400).json({
            success: false,
            error: phoneValidation.error,
            code: 400,
            timestamp: new Date().toISOString()
          });
        }
        
        brandingData.supportPhone = phoneValidation.sanitized;
      }

      // Update branding using TenantBrandingService
      try {
        logger.info('📤 Enviando dados para TenantBrandingService.updateBrandingByTenantId()', {
          url: req.url,
          tenant_id: tenantId,
          app_name: brandingData.appName,
          has_logo: !!brandingData.logoUrl,
          has_primary_color: !!brandingData.primaryColor,
          has_secondary_color: !!brandingData.secondaryColor,
          has_custom_html: !!brandingData.customHomeHtml
        });

        const updatedConfig = await TenantBrandingService.updateBrandingByTenantId(tenantId, brandingData);
        
        // Invalidar cache de branding após atualização bem-sucedida
        await CacheService.invalidateBrandingCache(tenantId);
        logger.info('🗑️ Cache de branding invalidado após atualização', { tenantId });
        
        const responseTime = Date.now() - startTime;
        
        logger.info('Configuração de branding atualizada com sucesso', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          tenant_id: tenantId,
          config_id: updatedConfig.id,
          app_name: updatedConfig.appName,
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
        const responseTime = Date.now() - startTime;
        
        logger.warn('Erro de validação na atualização de branding', {
          url: req.url,
          tenant_id: tenantId,
          response_time_ms: responseTime,
          error_message: validationError.message,
          ip: req.ip
        });

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
        tenant_id: req.context?.tenantId,
        error_message: error.message,
        error_stack: error.stack,
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
 * Usa o contexto de tenant do subdomínio para retornar o HTML correto.
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
      // Get tenant from context (set by subdomain router)
      const tenantId = req.context?.tenantId;
      
      // Get branding - if no tenant, use defaults
      const brandingConfig = tenantId 
        ? await TenantBrandingService.getBrandingByTenantId(tenantId)
        : TenantBrandingService.getDefaultBranding();
      
      // Verificar se há HTML customizado
      if (!brandingConfig.customHomeHtml) {
        const responseTime = Date.now() - startTime;
        
        logger.info('Nenhuma landing page customizada configurada', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          tenant_id: tenantId,
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
        tenant_id: tenantId,
        html_length: brandingConfig.customHomeHtml.length,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Configurar cache para melhorar performance
      res.set('Cache-Control', 'public, max-age=300');

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
        tenant_id: req.context?.tenantId,
        error_message: error.message,
        error_stack: error.stack,
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
 * Usa o contexto de tenant do subdomínio para retornar o branding correto.
 * 
 * Responses:
 * - 200: Configuração de branding recuperada com sucesso
 * - 500: Erro interno do servidor
 */
router.get('/public',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Get tenant from context (set by subdomain router)
      const tenantId = req.context?.tenantId;
      
      // Try to get from cache first (if tenant exists)
      if (tenantId) {
        const cacheKey = CacheService.CACHE_KEYS.BRANDING(tenantId);
        const { data: brandingConfig, fromCache } = await CacheService.getOrSet(
          cacheKey,
          CacheService.TTL.BRANDING,
          async () => TenantBrandingService.getBrandingByTenantId(tenantId)
        );
        
        // Set cache header
        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        
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
          tenant_id: tenantId,
          app_name: publicBrandingData.appName,
          has_custom_html: !!publicBrandingData.customHomeHtml,
          from_cache: fromCache,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        // Configurar cache para melhorar performance
        res.set('Cache-Control', 'public, max-age=300');

        return res.status(200).json({
          success: true,
          code: 200,
          data: publicBrandingData,
          timestamp: new Date().toISOString()
        });
      }
      
      // No tenant - use defaults (no cache)
      const brandingConfig = TenantBrandingService.getDefaultBranding();
      
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
      
      logger.info('Configuração pública de branding (default) recuperada', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        tenant_id: null,
        app_name: publicBrandingData.appName,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Configurar cache para melhorar performance
      res.set('Cache-Control', 'public, max-age=300');

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
        tenant_id: req.context?.tenantId,
        error_message: error.message,
        error_stack: error.stack,
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
