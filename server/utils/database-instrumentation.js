/**
 * Instrumentação para operações de banco de dados
 * Adiciona métricas e logging para queries de banco de dados
 */

const { logger } = require('./logger');
const { metrics } = require('./metrics');

class DatabaseInstrumentation {
  constructor(database) {
    this.database = database;
    this.instrumentMethods();
  }

  instrumentMethods() {
    // Instrumentar método query
    if (this.database.query) {
      const originalQuery = this.database.query.bind(this.database);
      this.database.query = this.instrumentQuery(originalQuery, 'query');
    }

    // Instrumentar método run
    if (this.database.run) {
      const originalRun = this.database.run.bind(this.database);
      this.database.run = this.instrumentQuery(originalRun, 'run');
    }

    // Instrumentar método get
    if (this.database.get) {
      const originalGet = this.database.get.bind(this.database);
      this.database.get = this.instrumentQuery(originalGet, 'get');
    }

    // Instrumentar método all
    if (this.database.all) {
      const originalAll = this.database.all.bind(this.database);
      this.database.all = this.instrumentQuery(originalAll, 'all');
    }

    // Instrumentar métodos específicos do WUZAPI Manager
    this.instrumentSpecificMethods();
  }

  instrumentQuery(originalMethod, operation) {
    return async function(...args) {
      const startTime = Date.now();
      const sql = args[0];
      const params = args[1];
      
      // Log da query (apenas em debug)
      logger.debug(`Database ${operation}`, {
        operation,
        sql: sql?.substring(0, 100) + (sql?.length > 100 ? '...' : ''),
        params: params ? Object.keys(params).length : 0
      });

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Registrar métricas de sucesso
        metrics.recordDatabaseQuery(operation, duration, true);
        
        // Log de performance para queries lentas
        if (duration > 1000) {
          logger.warn(`Slow database query detected`, {
            operation,
            duration: `${duration}ms`,
            sql: sql?.substring(0, 200)
          });
        }
        
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Registrar métricas de erro
        metrics.recordDatabaseQuery(operation, duration, false);
        
        // Log do erro
        logger.error(`Database ${operation} failed`, {
          operation,
          duration: `${duration}ms`,
          error: error.message,
          code: error.code,
          sql: sql?.substring(0, 200)
        });
        
        throw error;
      }
    };
  }

  instrumentSpecificMethods() {
    // Instrumentar métodos específicos do WUZAPI Manager
    const methodsToInstrument = [
      'getAllConnections',
      'getConnectionById',
      'createConnection',
      'updateConnection',
      'deleteConnection',
      'getUserConnections',
      'getUserTableData',
      'createUserTableRecord',
      'updateUserTableRecord',
      'deleteUserTableRecord',
      'getBrandingConfig',
      'updateBrandingConfig',
      'getDatabaseStats'
    ];

    methodsToInstrument.forEach(methodName => {
      if (this.database[methodName]) {
        const originalMethod = this.database[methodName].bind(this.database);
        this.database[methodName] = this.instrumentBusinessMethod(originalMethod, methodName);
      }
    });
  }

  instrumentBusinessMethod(originalMethod, methodName) {
    return async function(...args) {
      const startTime = Date.now();
      
      logger.debug(`Business operation: ${methodName}`, {
        method: methodName,
        argsCount: args.length
      });

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Registrar métricas específicas
        metrics.recordDatabaseQuery(methodName, duration, true);
        
        // Log de performance
        logger.performance(methodName, duration, {
          type: 'database_business_operation',
          success: true
        });
        
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Registrar métricas de erro
        metrics.recordDatabaseQuery(methodName, duration, false);
        
        // Log do erro
        logger.error(`Business operation ${methodName} failed`, {
          method: methodName,
          duration: `${duration}ms`,
          error: error.message,
          code: error.code
        });
        
        throw error;
      }
    };
  }

  // Método para obter estatísticas de performance do banco
  getPerformanceStats() {
    const summary = metrics.getSummary();
    const dbHistograms = {};
    const dbCounters = {};

    // Filtrar métricas relacionadas ao banco
    Object.keys(summary.histograms).forEach(key => {
      if (key.includes('database_query_duration_ms')) {
        dbHistograms[key] = summary.histograms[key];
      }
    });

    Object.keys(summary.counters).forEach(key => {
      if (key.includes('database_queries_total')) {
        dbCounters[key] = summary.counters[key];
      }
    });

    return {
      histograms: dbHistograms,
      counters: dbCounters,
      timestamp: new Date().toISOString()
    };
  }

  // Método para detectar queries problemáticas
  detectSlowQueries(thresholdMs = 1000) {
    const summary = metrics.getSummary();
    const slowQueries = [];

    Object.entries(summary.histograms).forEach(([key, stats]) => {
      if (key.includes('database_query_duration_ms') && stats.p95 > thresholdMs) {
        slowQueries.push({
          operation: key,
          p95: stats.p95,
          avg: stats.avg,
          count: stats.count
        });
      }
    });

    return slowQueries;
  }

  // Método para gerar relatório de saúde do banco
  generateHealthReport() {
    const stats = this.getPerformanceStats();
    const slowQueries = this.detectSlowQueries();
    
    const report = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      performance: {
        total_queries: 0,
        failed_queries: 0,
        avg_response_time: 0,
        slow_queries_count: slowQueries.length
      },
      slow_queries: slowQueries,
      recommendations: []
    };

    // Calcular estatísticas gerais
    let totalQueries = 0;
    let failedQueries = 0;
    let totalDuration = 0;

    Object.values(stats.counters).forEach(counter => {
      if (counter.toString().includes('success="true"')) {
        totalQueries += counter;
      } else if (counter.toString().includes('success="false"')) {
        failedQueries += counter;
      }
    });

    Object.values(stats.histograms).forEach(histogram => {
      if (histogram.sum && histogram.count) {
        totalDuration += histogram.sum;
        totalQueries += histogram.count;
      }
    });

    report.performance.total_queries = totalQueries;
    report.performance.failed_queries = failedQueries;
    report.performance.avg_response_time = totalQueries > 0 ? totalDuration / totalQueries : 0;

    // Determinar status de saúde
    const errorRate = totalQueries > 0 ? (failedQueries / totalQueries) * 100 : 0;
    
    if (errorRate > 5) {
      report.status = 'unhealthy';
      report.recommendations.push('High error rate detected - investigate database connectivity');
    } else if (errorRate > 1) {
      report.status = 'degraded';
      report.recommendations.push('Elevated error rate - monitor database performance');
    }

    if (report.performance.avg_response_time > 500) {
      report.status = report.status === 'healthy' ? 'degraded' : report.status;
      report.recommendations.push('High average response time - consider query optimization');
    }

    if (slowQueries.length > 0) {
      report.recommendations.push(`${slowQueries.length} slow queries detected - review query performance`);
    }

    return report;
  }
}

module.exports = DatabaseInstrumentation;