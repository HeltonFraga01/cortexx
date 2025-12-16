const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

/**
 * Rate Limiting Middleware
 * 
 * Implementa três níveis de rate limiting:
 * 1. loginLimiter - Mais restritivo para tentativas de login
 * 2. apiLimiter - Moderado para API geral
 * 3. adminLimiter - Restritivo para operações admin
 */

/**
 * Rate limiter para login (mais restritivo)
 * 
 * Limites:
 * - 5 tentativas por 15 minutos
 * - Por IP
 * 
 * Previne:
 * - Brute force attacks
 * - Credential stuffing
 * - Password spraying
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: {
    error: 'Too many login attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  
  // Handler customizado para logging
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - login', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      error: 'Too many login attempts',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    });
  },
  
  // Skip successful requests (apenas conta falhas)
  skipSuccessfulRequests: true
  
  // Nota: Não usar keyGenerator customizado para evitar problemas com IPv6
  // O padrão do express-rate-limit já usa req.ip corretamente
});

/**
 * Rate limiter para API geral (moderado)
 * 
 * Limites:
 * - 100 requisições por minuto
 * - Por IP
 * 
 * Previne:
 * - API abuse
 * - DoS attacks
 * - Scraping
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  // Skip health checks e endpoints públicos
  skip: (req) => {
    const publicPaths = ['/health', '/api/health', '/api/wuzapi/health'];
    return publicPaths.includes(req.path);
  },
  
  // Handler customizado
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - API', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '1 minute'
    });
  }
  
  // Nota: Não usar keyGenerator customizado para evitar problemas com IPv6
});

/**
 * Rate limiter para operações admin (restritivo)
 * 
 * Limites:
 * - 50 requisições por minuto
 * - Por IP
 * 
 * Previne:
 * - Admin API abuse
 * - Automated attacks on admin endpoints
 * - Mass data extraction
 */
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // 50 requisições
  message: {
    error: 'Too many admin requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  // Handler customizado com logging de segurança
  handler: (req, res) => {
    logger.error('Rate limit exceeded - Admin', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.session?.userId,
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      error: 'Too many admin requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '1 minute'
    });
  }
  
  // Nota: Rate limit por IP apenas (não por userId) para evitar problemas com IPv6
  // O limite de 50 req/min por IP é suficiente para prevenir abuse
});

/**
 * Rate limiter para webhooks (muito permissivo)
 * 
 * Limites:
 * - 1000 requisições por minuto
 * - Por IP
 * 
 * Nota: Webhooks podem ter alto volume legítimo
 */
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // 1000 requisições
  message: {
    error: 'Too many webhook requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - Webhook', {
      ip: req.ip,
      path: req.path
    });
    
    res.status(429).json({
      error: 'Too many webhook requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '1 minute'
    });
  }
});

/**
 * Rate limiter para leitura de tabelas
 * Mais permissivo para operações de leitura
 */
const tableReadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 leituras por minuto
  message: {
    error: 'Too many read requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter para escrita em tabelas
 * Mais restritivo para operações de escrita
 */
const tableWriteRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // 50 escritas por minuto
  message: {
    error: 'Too many write requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter para deleção em tabelas
 * Mais restritivo para operações de deleção
 */
const tableDeleteRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 deleções por minuto
  message: {
    error: 'Too many delete requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter para acesso a registros de usuário
 * Moderado para operações de registro único
 */
const userRecordRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requisições por minuto
  message: {
    error: 'Too many record requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginLimiter,
  apiLimiter,
  adminLimiter,
  webhookLimiter,
  tableReadRateLimiter,
  tableWriteRateLimiter,
  tableDeleteRateLimiter,
  userRecordRateLimiter
};
