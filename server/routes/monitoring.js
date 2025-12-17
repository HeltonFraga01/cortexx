/**
 * Rotas para monitoramento e métricas
 * Expõe endpoints para Prometheus, health checks e alertas
 */

const express = require('express');
const { logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');
const { alertManager } = require('../utils/alerts');

const router = express.Router();

// Middleware para autenticação de monitoramento (opcional)
const monitoringAuth = (req, res, next) => {
  const token = req.headers.authorization || req.query.token;
  const expectedToken = process.env.MONITORING_TOKEN;
  
  // Se não há token configurado, permitir acesso
  if (!expectedToken) {
    return next();
  }
  
  // Verificar token
  if (!token || token.replace('Bearer ', '') !== expectedToken) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid monitoring token'
    });
  }
  
  next();
};

// Health check básico
router.get('/health', (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verificações básicas de saúde
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        memory: checkMemoryHealth(),
        database: checkDatabaseHealth(),
        external_services: checkExternalServicesHealth()
      }
    };
    
    // Determinar status geral
    const hasUnhealthyChecks = Object.values(health.checks).some(check => !check.healthy);
    if (hasUnhealthyChecks) {
      health.status = 'degraded';
    }
    
    const responseTime = Date.now() - startTime;
    health.response_time_ms = responseTime;
    
    // Log health check
    logger.debug('Health check performed', {
      status: health.status,
      response_time: responseTime,
      checks: health.checks
    });
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      response_time_ms: Date.now() - startTime
    });
  }
});

// Health check detalhado
router.get('/health/detailed', monitoringAuth, (req, res) => {
  try {
    const detailed = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch,
        node_version: process.version
      },
      system: {
        load_average: require('os').loadavg(),
        free_memory: require('os').freemem(),
        total_memory: require('os').totalmem(),
        hostname: require('os').hostname()
      },
      checks: {
        memory: checkMemoryHealth(),
        database: checkDatabaseHealth(),
        external_services: checkExternalServicesHealth(),
        disk_space: checkDiskSpaceHealth(),
        network: checkNetworkHealth()
      },
      metrics_summary: metrics.getSummary()
    };
    
    // Determinar status geral
    const hasUnhealthyChecks = Object.values(detailed.checks).some(check => !check.healthy);
    if (hasUnhealthyChecks) {
      detailed.status = 'degraded';
    }
    
    const statusCode = detailed.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(detailed);
    
  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Métricas no formato Prometheus
router.get('/metrics', (req, res) => {
  try {
    const prometheusMetrics = metrics.generatePrometheusMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
    
  } catch (error) {
    logger.error('Failed to generate Prometheus metrics', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate metrics'
    });
  }
});

// Resumo das métricas em JSON
router.get('/metrics/summary', monitoringAuth, (req, res) => {
  try {
    const summary = metrics.getSummary();
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    logger.error('Failed to get metrics summary', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics summary'
    });
  }
});

// Status dos alertas
router.get('/alerts/status', monitoringAuth, (req, res) => {
  try {
    const status = alertManager.getStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    logger.error('Failed to get alert status', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get alert status'
    });
  }
});

// Histórico de alertas
router.get('/alerts/history', monitoringAuth, (req, res) => {
  try {
    const { rule, limit = 50 } = req.query;
    const history = alertManager.getAlertHistory(rule, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        alerts: history,
        total: history.length,
        rule: rule || 'all'
      }
    });
    
  } catch (error) {
    logger.error('Failed to get alert history', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get alert history'
    });
  }
});

// Testar alerta específico
router.post('/alerts/test/:ruleName', monitoringAuth, async (req, res) => {
  try {
    const { ruleName } = req.params;
    const alert = await alertManager.testAlert(ruleName);
    
    res.json({
      success: true,
      message: `Test alert sent for rule: ${ruleName}`,
      data: alert
    });
    
  } catch (error) {
    logger.error('Failed to test alert', { error: error.message, rule: req.params.ruleName });
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Logs recentes
router.get('/logs', monitoringAuth, (req, res) => {
  try {
    const { level = 'info', limit = 100 } = req.query;
    
    // Esta é uma implementação básica
    // Em produção, você pode querer usar uma solução mais robusta
    res.json({
      success: true,
      message: 'Log endpoint - implementar leitura de arquivos de log',
      data: {
        level,
        limit,
        note: 'Use ferramentas como ELK Stack ou Grafana Loki para logs em produção'
      }
    });
    
  } catch (error) {
    logger.error('Failed to get logs', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get logs'
    });
  }
});

// Informações do sistema
router.get('/system', monitoringAuth, (req, res) => {
  try {
    const os = require('os');
    
    const systemInfo = {
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      load_average: os.loadavg(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage_percent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        speed: os.cpus()[0]?.speed || 0
      },
      network: os.networkInterfaces(),
      process: {
        pid: process.pid,
        ppid: process.ppid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        versions: process.versions
      }
    };
    
    res.json({
      success: true,
      data: systemInfo
    });
    
  } catch (error) {
    logger.error('Failed to get system info', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get system info'
    });
  }
});

// Funções auxiliares para health checks
function checkMemoryHealth() {
  const memUsage = process.memoryUsage();
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  return {
    healthy: usagePercent < 90,
    usage_percent: usagePercent,
    heap_used: memUsage.heapUsed,
    heap_total: memUsage.heapTotal,
    message: usagePercent < 90 ? 'Memory usage normal' : 'High memory usage detected'
  };
}

function checkDatabaseHealth() {
  try {
    // Database is now Supabase (external PostgreSQL)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        healthy: false,
        message: 'Supabase credentials not configured',
        type: 'supabase'
      };
    }
    
    return {
      healthy: true,
      message: 'Supabase configured',
      type: 'supabase',
      url: supabaseUrl.replace(/\/\/.*@/, '//***@') // Mask credentials in URL if any
    };
    
  } catch (error) {
    return {
      healthy: false,
      message: `Database check failed: ${error.message}`
    };
  }
}

function checkExternalServicesHealth() {
  // Verificação básica - em produção, fazer requests reais
  const wuzapiUrl = process.env.WUZAPI_BASE_URL;
  
  return {
    healthy: true, // Assumir saudável por enquanto
    message: 'External services check not implemented',
    services: {
      wuzapi: {
        url: wuzapiUrl,
        status: 'unknown'
      }
    }
  };
}

function checkDiskSpaceHealth() {
  try {
    const fs = require('fs');
    const stats = fs.statSync('./');
    
    return {
      healthy: true,
      message: 'Disk space check basic',
      note: 'Implement proper disk space checking for production'
    };
    
  } catch (error) {
    return {
      healthy: false,
      message: `Disk space check failed: ${error.message}`
    };
  }
}

function checkNetworkHealth() {
  return {
    healthy: true,
    message: 'Network check basic',
    note: 'Implement proper network connectivity checking for production'
  };
}

module.exports = router;