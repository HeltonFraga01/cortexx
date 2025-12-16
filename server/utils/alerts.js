/**
 * Sistema de alertas para WUZAPI Manager
 * Monitora métricas e envia alertas quando limites são ultrapassados
 */

const { logger } = require('./logger');
const { metrics } = require('./metrics');

class AlertManager {
  constructor() {
    this.rules = new Map();
    this.alertHistory = new Map();
    this.channels = new Map();
    this.isRunning = false;
    this.checkInterval = 30000; // 30 segundos
    
    // Configurar regras padrão
    this.setupDefaultRules();
    
    // Configurar canais de notificação
    this.setupNotificationChannels();
  }

  setupDefaultRules() {
    // Regra para alta taxa de erro HTTP
    this.addRule('high_http_error_rate', {
      description: 'Taxa de erro HTTP alta',
      condition: () => {
        const totalRequests = this.getCounterValue('http_requests_total');
        const totalErrors = this.getCounterValue('http_errors_total');
        
        if (totalRequests === 0) return false;
        
        const errorRate = (totalErrors / totalRequests) * 100;
        return errorRate > 10; // Mais de 10% de erro
      },
      severity: 'warning',
      cooldown: 300000, // 5 minutos
      message: (data) => `Taxa de erro HTTP alta: ${data.errorRate.toFixed(2)}%`
    });

    // Regra para alta latência
    this.addRule('high_response_time', {
      description: 'Tempo de resposta alto',
      condition: () => {
        const histogram = this.getHistogramSummary('http_request_duration_ms');
        return histogram && histogram.p95 > 2000; // P95 > 2 segundos
      },
      severity: 'warning',
      cooldown: 300000,
      message: (data) => `Tempo de resposta alto: P95 = ${data.p95}ms`
    });

    // Regra para uso alto de memória
    this.addRule('high_memory_usage', {
      description: 'Uso alto de memória',
      condition: () => {
        const memUsage = process.memoryUsage();
        const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        return usagePercent > 85; // Mais de 85% da heap
      },
      severity: 'critical',
      cooldown: 180000, // 3 minutos
      message: (data) => `Uso alto de memória: ${data.usagePercent.toFixed(2)}%`
    });

    // Regra para falhas de conexão com banco
    this.addRule('database_connection_failures', {
      description: 'Falhas de conexão com banco de dados',
      condition: () => {
        const totalQueries = this.getCounterValue('database_queries_total', { success: 'true' });
        const failedQueries = this.getCounterValue('database_queries_total', { success: 'false' });
        
        if (totalQueries + failedQueries === 0) return false;
        
        const failureRate = (failedQueries / (totalQueries + failedQueries)) * 100;
        return failureRate > 5; // Mais de 5% de falha
      },
      severity: 'critical',
      cooldown: 120000, // 2 minutos
      message: (data) => `Falhas de conexão com banco: ${data.failureRate.toFixed(2)}%`
    });

    // Regra para falhas na integração WUZAPI
    this.addRule('wuzapi_integration_failures', {
      description: 'Falhas na integração WUZAPI',
      condition: () => {
        const totalRequests = this.getCounterValue('wuzapi_requests_total', { success: 'true' });
        const failedRequests = this.getCounterValue('wuzapi_requests_total', { success: 'false' });
        
        if (totalRequests + failedRequests === 0) return false;
        
        const failureRate = (failedRequests / (totalRequests + failedRequests)) * 100;
        return failureRate > 15; // Mais de 15% de falha
      },
      severity: 'warning',
      cooldown: 300000,
      message: (data) => `Falhas na integração WUZAPI: ${data.failureRate.toFixed(2)}%`
    });

    // Regra para processo sem resposta
    this.addRule('process_unresponsive', {
      description: 'Processo não responsivo',
      condition: () => {
        // Verificar se houve requisições HTTP recentes
        const now = Date.now();
        const lastActivity = this.getLastActivityTime();
        return lastActivity && (now - lastActivity) > 300000; // 5 minutos sem atividade
      },
      severity: 'critical',
      cooldown: 600000, // 10 minutos
      message: () => 'Processo parece não estar respondendo'
    });
  }

  setupNotificationChannels() {
    // Canal de log (sempre ativo)
    this.addChannel('log', {
      send: (alert) => {
        logger.warn('ALERT', {
          type: 'alert',
          rule: alert.rule,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp
        });
      }
    });

    // Canal Slack (se configurado)
    if (process.env.SLACK_WEBHOOK_URL) {
      this.addChannel('slack', {
        send: async (alert) => {
          try {
            const payload = {
              text: `🚨 Alert: ${alert.message}`,
              attachments: [{
                color: alert.severity === 'critical' ? 'danger' : 'warning',
                fields: [
                  { title: 'Rule', value: alert.rule, short: true },
                  { title: 'Severity', value: alert.severity, short: true },
                  { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
                ]
              }]
            };

            const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
              throw new Error(`Slack notification failed: ${response.status}`);
            }
          } catch (error) {
            logger.error('Failed to send Slack alert', { error: error.message });
          }
        }
      });
    }

    // Canal Discord (se configurado)
    if (process.env.DISCORD_WEBHOOK_URL) {
      this.addChannel('discord', {
        send: async (alert) => {
          try {
            const color = alert.severity === 'critical' ? 0xFF0000 : 0xFFA500;
            const payload = {
              embeds: [{
                title: '🚨 WUZAPI Manager Alert',
                description: alert.message,
                color: color,
                fields: [
                  { name: 'Rule', value: alert.rule, inline: true },
                  { name: 'Severity', value: alert.severity, inline: true },
                  { name: 'Time', value: new Date(alert.timestamp).toISOString(), inline: true }
                ],
                timestamp: new Date(alert.timestamp).toISOString()
              }]
            };

            const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
              throw new Error(`Discord notification failed: ${response.status}`);
            }
          } catch (error) {
            logger.error('Failed to send Discord alert', { error: error.message });
          }
        }
      });
    }

    // Canal Email (se configurado)
    if (process.env.SMTP_HOST && process.env.ALERT_EMAIL_TO) {
      this.addChannel('email', {
        send: async (alert) => {
          // Implementar envio de email usando nodemailer ou similar
          logger.info('Email alert would be sent', { alert });
        }
      });
    }
  }

  addRule(name, rule) {
    this.rules.set(name, {
      ...rule,
      name,
      lastTriggered: 0,
      triggerCount: 0
    });
  }

  addChannel(name, channel) {
    this.channels.set(name, channel);
  }

  getCounterValue(name, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const counter = metrics.counters.get(key);
    return counter ? counter.value : 0;
  }

  getHistogramSummary(name, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const histogram = metrics.histograms.get(key);
    
    if (!histogram || histogram.values.length === 0) {
      return null;
    }

    const values = [...histogram.values].sort((a, b) => a - b);
    const count = values.length;
    
    return {
      count,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / count,
      min: values[0],
      max: values[count - 1],
      p50: values[Math.floor(count * 0.5)],
      p90: values[Math.floor(count * 0.9)],
      p95: values[Math.floor(count * 0.95)],
      p99: values[Math.floor(count * 0.99)]
    };
  }

  getMetricKey(name, labels) {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return labelString ? `${name}{${labelString}}` : name;
  }

  getLastActivityTime() {
    // Implementar lógica para obter último tempo de atividade
    // Por enquanto, retornar tempo atual
    return Date.now();
  }

  async checkRules() {
    const now = Date.now();
    
    for (const [name, rule] of this.rules) {
      try {
        // Verificar cooldown
        if (now - rule.lastTriggered < rule.cooldown) {
          continue;
        }

        // Avaliar condição
        const shouldAlert = await rule.condition();
        
        if (shouldAlert) {
          // Coletar dados para a mensagem
          const data = this.collectAlertData(name);
          const message = typeof rule.message === 'function' 
            ? rule.message(data) 
            : rule.message;

          const alert = {
            rule: name,
            description: rule.description,
            severity: rule.severity,
            message,
            timestamp: now,
            data
          };

          // Enviar alerta
          await this.sendAlert(alert);
          
          // Atualizar histórico
          rule.lastTriggered = now;
          rule.triggerCount++;
          
          // Armazenar no histórico
          if (!this.alertHistory.has(name)) {
            this.alertHistory.set(name, []);
          }
          this.alertHistory.get(name).push(alert);
          
          // Manter apenas os últimos 100 alertas por regra
          const history = this.alertHistory.get(name);
          if (history.length > 100) {
            this.alertHistory.set(name, history.slice(-100));
          }
        }
      } catch (error) {
        logger.error(`Error checking alert rule ${name}`, { error: error.message });
      }
    }
  }

  collectAlertData(ruleName) {
    const data = {};
    
    switch (ruleName) {
      case 'high_http_error_rate':
        const totalRequests = this.getCounterValue('http_requests_total');
        const totalErrors = this.getCounterValue('http_errors_total');
        data.totalRequests = totalRequests;
        data.totalErrors = totalErrors;
        data.errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
        break;
        
      case 'high_response_time':
        const histogram = this.getHistogramSummary('http_request_duration_ms');
        if (histogram) {
          data.p50 = histogram.p50;
          data.p90 = histogram.p90;
          data.p95 = histogram.p95;
          data.p99 = histogram.p99;
        }
        break;
        
      case 'high_memory_usage':
        const memUsage = process.memoryUsage();
        data.heapUsed = memUsage.heapUsed;
        data.heapTotal = memUsage.heapTotal;
        data.usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        break;
        
      case 'database_connection_failures':
        const successQueries = this.getCounterValue('database_queries_total', { success: 'true' });
        const failedQueries = this.getCounterValue('database_queries_total', { success: 'false' });
        data.successQueries = successQueries;
        data.failedQueries = failedQueries;
        data.failureRate = (successQueries + failedQueries) > 0 
          ? (failedQueries / (successQueries + failedQueries)) * 100 
          : 0;
        break;
        
      case 'wuzapi_integration_failures':
        const successRequests = this.getCounterValue('wuzapi_requests_total', { success: 'true' });
        const failedRequests = this.getCounterValue('wuzapi_requests_total', { success: 'false' });
        data.successRequests = successRequests;
        data.failedRequests = failedRequests;
        data.failureRate = (successRequests + failedRequests) > 0 
          ? (failedRequests / (successRequests + failedRequests)) * 100 
          : 0;
        break;
    }
    
    return data;
  }

  async sendAlert(alert) {
    logger.info(`Sending alert: ${alert.rule}`, { alert });
    
    // Enviar para todos os canais configurados
    for (const [channelName, channel] of this.channels) {
      try {
        await channel.send(alert);
      } catch (error) {
        logger.error(`Failed to send alert to ${channelName}`, { 
          error: error.message,
          alert: alert.rule 
        });
      }
    }
  }

  start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    logger.info('Alert manager started');
    
    // Verificar regras periodicamente
    this.intervalId = setInterval(() => {
      this.checkRules();
    }, this.checkInterval);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    logger.info('Alert manager stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      rulesCount: this.rules.size,
      channelsCount: this.channels.size,
      rules: Array.from(this.rules.entries()).map(([name, rule]) => ({
        name,
        description: rule.description,
        severity: rule.severity,
        lastTriggered: rule.lastTriggered,
        triggerCount: rule.triggerCount,
        cooldown: rule.cooldown
      })),
      channels: Array.from(this.channels.keys())
    };
  }

  getAlertHistory(ruleName = null, limit = 50) {
    if (ruleName) {
      const history = this.alertHistory.get(ruleName) || [];
      return history.slice(-limit);
    }
    
    const allHistory = [];
    for (const [rule, history] of this.alertHistory) {
      allHistory.push(...history.map(alert => ({ ...alert, rule })));
    }
    
    return allHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Testar um alerta específico
  async testAlert(ruleName) {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`Alert rule '${ruleName}' not found`);
    }
    
    const data = this.collectAlertData(ruleName);
    const message = typeof rule.message === 'function' 
      ? rule.message(data) 
      : rule.message;

    const alert = {
      rule: ruleName,
      description: rule.description,
      severity: rule.severity,
      message: `[TEST] ${message}`,
      timestamp: Date.now(),
      data
    };

    await this.sendAlert(alert);
    return alert;
  }
}

// Instância singleton
const alertManager = new AlertManager();

module.exports = {
  AlertManager,
  alertManager
};