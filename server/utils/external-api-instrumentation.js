/**
 * Instrumentação para chamadas de APIs externas
 * Adiciona métricas e logging para integrações WUZAPI e NocoDB
 */

const axios = require('axios');
const { logger } = require('./logger');
const { metrics } = require('./metrics');

class ExternalApiInstrumentation {
  constructor() {
    this.setupAxiosInterceptors();
  }

  setupAxiosInterceptors() {
    // Interceptor para requisições
    axios.interceptors.request.use(
      (config) => {
        // Adicionar timestamp para medir duração
        config.metadata = { startTime: Date.now() };
        
        // Log da requisição (sem dados sensíveis)
        logger.debug('External API request', {
          method: config.method?.toUpperCase(),
          url: this.sanitizeUrl(config.url),
          headers: this.sanitizeHeaders(config.headers),
          timeout: config.timeout
        });
        
        return config;
      },
      (error) => {
        logger.error('External API request setup failed', {
          error: error.message
        });
        return Promise.reject(error);
      }
    );

    // Interceptor para respostas
    axios.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        const service = this.identifyService(response.config.url);
        const endpoint = this.extractEndpoint(response.config.url);
        
        // Registrar métricas de sucesso
        if (service === 'wuzapi') {
          metrics.recordWuzapiRequest(endpoint, duration, true, response.status);
        } else if (service === 'nocodb') {
          metrics.recordNocodbRequest(endpoint, duration, true);
        }
        
        // Log de sucesso
        logger.integration(service, endpoint, true, {
          status: response.status,
          duration: `${duration}ms`,
          response_size: this.getResponseSize(response)
        });
        
        // Log de performance para chamadas lentas
        if (duration > 5000) {
          logger.warn('Slow external API call detected', {
            service,
            endpoint,
            duration: `${duration}ms`,
            url: this.sanitizeUrl(response.config.url)
          });
        }
        
        return response;
      },
      (error) => {
        const duration = error.config?.metadata ? 
          Date.now() - error.config.metadata.startTime : 0;
        const service = this.identifyService(error.config?.url);
        const endpoint = this.extractEndpoint(error.config?.url);
        const status = error.response?.status || 0;
        
        // Registrar métricas de erro
        if (service === 'wuzapi') {
          metrics.recordWuzapiRequest(endpoint, duration, false, status);
        } else if (service === 'nocodb') {
          metrics.recordNocodbRequest(endpoint, duration, false);
        }
        
        // Log de erro
        logger.integration(service, endpoint, false, {
          error: error.message,
          status: status,
          duration: `${duration}ms`,
          code: error.code,
          url: this.sanitizeUrl(error.config?.url)
        });
        
        // Log específico para diferentes tipos de erro
        if (error.code === 'ECONNREFUSED') {
          logger.error('External service connection refused', {
            service,
            endpoint,
            message: 'Service may be down or unreachable'
          });
        } else if (error.code === 'ECONNABORTED') {
          logger.error('External service request timeout', {
            service,
            endpoint,
            timeout: error.config?.timeout
          });
        } else if (status === 401) {
          logger.security('External service authentication failed', {
            service,
            endpoint,
            status
          });
        } else if (status === 429) {
          logger.warn('External service rate limit exceeded', {
            service,
            endpoint,
            status
          });
        }
        
        return Promise.reject(error);
      }
    );
  }

  identifyService(url) {
    if (!url) return 'unknown';
    
    if (url.includes('wzapi') || url.includes('wuzapi')) {
      return 'wuzapi';
    } else if (url.includes('nocodb')) {
      return 'nocodb';
    } else {
      return 'external';
    }
  }

  extractEndpoint(url) {
    if (!url) return 'unknown';
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Extrair endpoint principal (primeiros 2 segmentos)
      const segments = pathname.split('/').filter(s => s);
      return segments.slice(0, 2).join('/') || 'root';
    } catch (error) {
      return 'invalid_url';
    }
  }

  sanitizeUrl(url) {
    if (!url) return 'unknown';
    
    try {
      const urlObj = new URL(url);
      // Remover query parameters sensíveis
      urlObj.searchParams.delete('token');
      urlObj.searchParams.delete('password');
      urlObj.searchParams.delete('key');
      return urlObj.toString();
    } catch (error) {
      return url.substring(0, 100) + (url.length > 100 ? '...' : '');
    }
  }

  sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    
    // Remover headers sensíveis
    delete sanitized.authorization;
    delete sanitized.token;
    delete sanitized['x-api-key'];
    delete sanitized['xc-token'];
    
    return {
      'content-type': sanitized['content-type'],
      'user-agent': sanitized['user-agent'],
      'accept': sanitized.accept
    };
  }

  getResponseSize(response) {
    if (response.headers['content-length']) {
      return parseInt(response.headers['content-length']);
    } else if (response.data) {
      return JSON.stringify(response.data).length;
    }
    return 0;
  }

  // Método para criar cliente axios instrumentado
  createInstrumentedClient(baseURL, defaultHeaders = {}) {
    const client = axios.create({
      baseURL,
      timeout: 10000,
      headers: defaultHeaders
    });

    // Adicionar interceptors específicos para este cliente
    client.interceptors.request.use(
      (config) => {
        config.metadata = { 
          startTime: Date.now(),
          clientName: this.identifyService(baseURL)
        };
        return config;
      }
    );

    return client;
  }

  // Método para obter estatísticas de APIs externas
  getExternalApiStats() {
    const summary = metrics.getSummary();
    const apiStats = {
      wuzapi: {
        requests: 0,
        errors: 0,
        avg_duration: 0,
        error_rate: 0
      },
      nocodb: {
        requests: 0,
        errors: 0,
        avg_duration: 0,
        error_rate: 0
      },
      external: {
        requests: 0,
        errors: 0,
        avg_duration: 0,
        error_rate: 0
      }
    };

    // Processar contadores
    Object.entries(summary.counters).forEach(([key, value]) => {
      if (key.includes('wuzapi_requests_total')) {
        if (key.includes('success="true"')) {
          apiStats.wuzapi.requests += value;
        } else if (key.includes('success="false"')) {
          apiStats.wuzapi.errors += value;
        }
      } else if (key.includes('nocodb_requests_total')) {
        if (key.includes('success="true"')) {
          apiStats.nocodb.requests += value;
        } else if (key.includes('success="false"')) {
          apiStats.nocodb.errors += value;
        }
      }
    });

    // Processar histogramas para duração média
    Object.entries(summary.histograms).forEach(([key, histogram]) => {
      if (key.includes('wuzapi_request_duration_ms') && histogram.avg) {
        apiStats.wuzapi.avg_duration = histogram.avg;
      } else if (key.includes('nocodb_request_duration_ms') && histogram.avg) {
        apiStats.nocodb.avg_duration = histogram.avg;
      }
    });

    // Calcular taxas de erro
    Object.keys(apiStats).forEach(service => {
      const stats = apiStats[service];
      const total = stats.requests + stats.errors;
      stats.error_rate = total > 0 ? (stats.errors / total) * 100 : 0;
    });

    return {
      timestamp: new Date().toISOString(),
      services: apiStats
    };
  }

  // Método para detectar problemas com APIs externas
  detectApiIssues() {
    const stats = this.getExternalApiStats();
    const issues = [];

    Object.entries(stats.services).forEach(([service, serviceStats]) => {
      // Alta taxa de erro
      if (serviceStats.error_rate > 10) {
        issues.push({
          service,
          type: 'high_error_rate',
          severity: 'critical',
          value: serviceStats.error_rate,
          message: `${service} has high error rate: ${serviceStats.error_rate.toFixed(2)}%`
        });
      }

      // Alta latência
      if (serviceStats.avg_duration > 5000) {
        issues.push({
          service,
          type: 'high_latency',
          severity: 'warning',
          value: serviceStats.avg_duration,
          message: `${service} has high average latency: ${serviceStats.avg_duration.toFixed(0)}ms`
        });
      }

      // Sem requisições (possível problema de conectividade)
      if (serviceStats.requests === 0 && serviceStats.errors === 0) {
        issues.push({
          service,
          type: 'no_activity',
          severity: 'warning',
          value: 0,
          message: `${service} shows no activity - may indicate connectivity issues`
        });
      }
    });

    return issues;
  }

  // Método para gerar relatório de saúde das APIs externas
  generateHealthReport() {
    const stats = this.getExternalApiStats();
    const issues = this.detectApiIssues();
    
    const report = {
      timestamp: new Date().toISOString(),
      overall_status: issues.length === 0 ? 'healthy' : 
                     issues.some(i => i.severity === 'critical') ? 'unhealthy' : 'degraded',
      services: stats.services,
      issues: issues,
      recommendations: []
    };

    // Gerar recomendações baseadas nos problemas encontrados
    issues.forEach(issue => {
      switch (issue.type) {
        case 'high_error_rate':
          report.recommendations.push(`Investigate ${issue.service} connectivity and authentication`);
          break;
        case 'high_latency':
          report.recommendations.push(`Consider increasing timeout for ${issue.service} or investigate network issues`);
          break;
        case 'no_activity':
          report.recommendations.push(`Verify ${issue.service} configuration and connectivity`);
          break;
      }
    });

    return report;
  }
}

// Instância singleton
const externalApiInstrumentation = new ExternalApiInstrumentation();

module.exports = {
  ExternalApiInstrumentation,
  externalApiInstrumentation
};