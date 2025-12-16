/**
 * Campaign Rate Limiter Middleware
 * 
 * Rate limiting específico para rotas de criação de campanhas.
 * Limita a 10 requisições por minuto por usuário para prevenir:
 * - Criação massiva de campanhas
 * - Ataques de negação de serviço
 * - Sobrecarga do sistema
 * 
 * @module server/middleware/campaignRateLimiter
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');

// Disable IPv6 validation warning since we prioritize userId over IP
// and only use IP as fallback. The keyGeneratorIpFallback validation
// is not needed because we use userId as primary key.
const rateLimitOptions = {
  validate: {
    xForwardedForHeader: false,
    trustProxy: false,
    // Disable keyGenerator IP fallback validation since we use userId as primary
    default: true
  }
};

// Helper to safely get IP for rate limiting
function getSafeIp(req) {
  // Return a hash-like string to avoid IPv6 issues
  const ip = req.ip || 'unknown';
  // Simple sanitization - just use the IP as-is since express handles it
  return ip.replace(/[^a-zA-Z0-9.:]/g, '');
}

/**
 * Rate limiter para criação de campanhas
 * 
 * Limites:
 * - 10 requisições por minuto
 * - Por usuário (userId da sessão) ou IP como fallback
 * 
 * Previne:
 * - Criação massiva de campanhas
 * - Ataques de negação de serviço
 * - Sobrecarga do sistema de envio
 */
const campaignCreationLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 requisições por minuto
  message: {
    error: 'Muitas requisições de criação de campanha',
    code: 'CAMPAIGN_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute',
    limit: 10,
    windowMs: 60000
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  // Usar userId da sessão como chave, fallback para IP
  // Nota: Priorizamos userId sobre IP para rate limit por usuário
  keyGenerator: (req) => {
    // Priorizar userId da sessão para rate limit por usuário
    if (req.session?.userId) {
      return `campaign:user:${req.session.userId}`;
    }
    // Fallback para IP (sanitizado)
    return `campaign:ip:${getSafeIp(req)}`;
  },
  
  // Handler customizado com logging detalhado
  handler: (req, res) => {
    const userId = req.session?.userId;
    const key = userId ? `user:${userId}` : `ip:${req.ip}`;
    
    logger.warn('Campaign rate limit exceeded', {
      key,
      userId,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent')
    });
    
    securityLogger.logRateLimitExceeded({
      userId,
      ip: req.ip,
      path: req.path,
      limiterType: 'campaign_creation',
      limit: 10,
      windowMs: 60000
    });
    
    res.status(429).json({
      error: 'Muitas requisições de criação de campanha',
      code: 'CAMPAIGN_RATE_LIMIT_EXCEEDED',
      message: 'Você atingiu o limite de 10 campanhas por minuto. Aguarde antes de criar novas campanhas.',
      retryAfter: '1 minute',
      limit: 10
    });
  },
  
  // Não pular requisições bem-sucedidas - contar todas
  skipSuccessfulRequests: false,
  
  // Não pular requisições com falha - contar todas
  skipFailedRequests: false
});

/**
 * Rate limiter para operações de campanha (pause, resume, cancel)
 * 
 * Limites:
 * - 30 requisições por minuto
 * - Por usuário ou IP
 * 
 * Mais permissivo que criação, mas ainda protege contra abuse
 */
const campaignOperationLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requisições por minuto
  message: {
    error: 'Muitas operações de campanha',
    code: 'CAMPAIGN_OPERATION_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    if (req.session?.userId) {
      return `campaign-op:user:${req.session.userId}`;
    }
    return `campaign-op:ip:${getSafeIp(req)}`;
  },
  
  handler: (req, res) => {
    logger.warn('Campaign operation rate limit exceeded', {
      userId: req.session?.userId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Muitas operações de campanha',
      code: 'CAMPAIGN_OPERATION_RATE_LIMIT_EXCEEDED',
      message: 'Você atingiu o limite de operações por minuto. Aguarde antes de continuar.',
      retryAfter: '1 minute'
    });
  }
});

/**
 * Rate limiter para consultas de progresso
 * 
 * Limites:
 * - 60 requisições por minuto (1 por segundo)
 * - Por usuário ou IP
 * 
 * Permissivo para permitir polling frequente de progresso
 */
const campaignProgressLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // 60 requisições por minuto
  message: {
    error: 'Muitas consultas de progresso',
    code: 'CAMPAIGN_PROGRESS_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    if (req.session?.userId) {
      return `campaign-progress:user:${req.session.userId}`;
    }
    return `campaign-progress:ip:${getSafeIp(req)}`;
  },
  
  handler: (req, res) => {
    logger.warn('Campaign progress rate limit exceeded', {
      userId: req.session?.userId,
      ip: req.ip,
      path: req.path
    });
    
    res.status(429).json({
      error: 'Muitas consultas de progresso',
      code: 'CAMPAIGN_PROGRESS_RATE_LIMIT_EXCEEDED',
      message: 'Reduza a frequência de consultas de progresso.',
      retryAfter: '1 minute'
    });
  }
});

module.exports = {
  campaignCreationLimiter,
  campaignOperationLimiter,
  campaignProgressLimiter
};
