const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const wuzapiProxy = require('../services/WuzAPIProxyService');
const { logger } = require('../utils/logger');

/**
 * Rotas de proxy para WuzAPI
 * 
 * Estas rotas atuam como intermediário entre o frontend e a WuzAPI,
 * garantindo que tokens nunca sejam expostos ao cliente.
 * 
 * Rotas:
 * - /api/wuzapi/user/* - Proxy para requisições de usuário (requer autenticação)
 * - /api/wuzapi/admin/* - Proxy para requisições admin (requer role admin)
 */

/**
 * Proxy genérico para requisições de usuário
 * 
 * Rota: /api/wuzapi/user/*
 * Métodos: ALL (GET, POST, PUT, DELETE, etc)
 * Autenticação: Requer sessão de usuário
 * 
 * Exemplos:
 * - GET /api/wuzapi/user/session/status -> GET {WUZAPI_BASE_URL}/session/status
 * - POST /api/wuzapi/user/messages/send -> POST {WUZAPI_BASE_URL}/messages/send
 */
router.all('/user/*', requireAuth, async (req, res) => {
  try {
    // Extrair o path removendo o prefixo /user
    const path = req.path.replace('/user', '');
    
    // Obter token da sessão
    const userToken = req.session.userToken;
    
    if (!userToken) {
      logger.error('User token not found in session', {
        userId: req.session.userId,
        path: req.path
      });
      return res.status(500).json({ 
        error: 'Session token not found',
        code: 'SESSION_ERROR'
      });
    }
    
    logger.info('Proxying user request', {
      userId: req.session.userId,
      method: req.method,
      path: path,
      ip: req.ip
    });
    
    // Fazer proxy da requisição
    const result = await wuzapiProxy.proxyUserRequest(
      req.method,
      path,
      req.body,
      userToken,
      req.query
    );
    
    res.json(result);
    
  } catch (error) {
    const status = error.status || 500;
    const code = error.code || 'WUZAPI_ERROR';
    
    logger.error('User proxy request failed', {
      userId: req.session?.userId,
      method: req.method,
      path: req.path,
      error: error.message,
      status
    });
    
    res.status(status).json({ 
      error: error.message,
      code: code
    });
  }
});

/**
 * Proxy genérico para requisições admin
 * 
 * Rota: /api/wuzapi/admin/*
 * Métodos: ALL (GET, POST, PUT, DELETE, etc)
 * Autenticação: Requer sessão de admin
 * 
 * Exemplos:
 * - GET /api/wuzapi/admin/users -> GET {WUZAPI_BASE_URL}/admin/users
 * - POST /api/wuzapi/admin/users -> POST {WUZAPI_BASE_URL}/admin/users
 */
router.all('/admin/*', requireAdmin, async (req, res) => {
  try {
    // Extrair o path removendo o prefixo /admin
    const path = req.path.replace('/admin', '');
    
    logger.info('Proxying admin request', {
      userId: req.session.userId,
      method: req.method,
      path: path,
      ip: req.ip
    });
    
    // Fazer proxy da requisição usando token admin do servidor
    const result = await wuzapiProxy.proxyAdminRequest(
      req.method,
      path,
      req.body,
      req.query
    );
    
    res.json(result);
    
  } catch (error) {
    const status = error.status || 500;
    const code = error.code || 'WUZAPI_ERROR';
    
    logger.error('Admin proxy request failed', {
      userId: req.session?.userId,
      method: req.method,
      path: req.path,
      error: error.message,
      status
    });
    
    res.status(status).json({ 
      error: error.message,
      code: code
    });
  }
});

/**
 * Health check endpoint
 * 
 * Rota: /api/wuzapi/health
 * Método: GET
 * Autenticação: Não requer
 * 
 * Verifica se a WuzAPI está disponível
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await wuzapiProxy.isHealthy();
    
    if (isHealthy) {
      res.json({ 
        status: 'healthy',
        wuzapi: 'available'
      });
    } else {
      res.status(503).json({ 
        status: 'unhealthy',
        wuzapi: 'unavailable'
      });
    }
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message
    });
    res.status(503).json({ 
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Config endpoint (apenas para debug em desenvolvimento)
 * 
 * Rota: /api/wuzapi/config
 * Método: GET
 * Autenticação: Requer admin
 */
router.get('/config', requireAdmin, (req, res) => {
  const config = wuzapiProxy.getConfig();
  res.json(config);
});

module.exports = router;
