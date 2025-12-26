/**
 * Alert System Module
 * 
 * Task 7: Enhanced alerting with webhook support
 * Monitors metrics and sends alerts when thresholds are exceeded
 */

const { logger } = require('../utils/logger');
const { prometheusMetrics } = require('./metrics');

/**
 * Alert severity levels
 */
const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

/**
 * Alert Manager for monitoring and notifications
 */
class AlertManager {
  constructor() {
    this.rules = new Map();
    this.alertHistory = [];
    this.channels = new Map();
    this.isRunning = false;
    this.checkInterval = 30000; // 30 seconds
    this.cooldowns = new Map(); // Track cooldowns per rule
    
    this.setupDefaultRules();
    this.setupNotificationChannels();
  }

  /**
   * Task 7.2-7.6: Setup default alert rules
   */
  setupDefaultRules() {
    // Task 7.2: Error rate > 1%
    this.addRule('high_error_rate', {
      description: 'Taxa de erros 5xx acima de 1%',
      severity: AlertSeverity.CRITICAL,
      cooldown: 300000, // Task 7.8: 5 minutes cooldown
      condition: () => {
        const summary = prometheusMetrics.getSummary();
        const requests = summary.counters['http_requests_total'] || {};
        
        let total = 0;
        let errors = 0;
        
        for (const [key, value] of Object.entries(requests)) {
          total += value;
          if (key.includes('status_code="5')) {
            errors += value;
          }
        }
        
        if (total < 100) return false; // Need minimum sample size
        const errorRate = (errors / total) * 100;
        return errorRate > 1;
      },
      getData: () => {
        const summary = prometheusMetrics.getSummary();
        const requests = summary.counters['http_requests_total'] || {};
        
        let total = 0;
        let errors = 0;
        
        for (const [key, value] of Object.entries(requests)) {
          total += value;
          if (key.includes('status_code="5')) {
            errors += value;
          }
        }
        
        return {
          total,
          errors,
          errorRate: total > 0 ? ((errors / total) * 100).toFixed(2) + '%' : '0%',
        };
      },
    });

    // Task 7.3: Latency P95 > 2s
    this.addRule('high_latency', {
      description: 'Latência P95 acima de 2 segundos',
      severity: AlertSeverity.WARNING,
      cooldown: 300000,
      condition: () => {
        const summary = prometheusMetrics.getSummary();
        const histograms = summary.histograms['http_request_duration_seconds'] || {};
        
        for (const data of Object.values(histograms)) {
          if (data.p95 > 2) return true;
        }
        return false;
      },
      getData: () => {
        const summary = prometheusMetrics.getSummary();
        const histograms = summary.histograms['http_request_duration_seconds'] || {};
        
        let maxP95 = 0;
        for (const data of Object.values(histograms)) {
          if (data.p95 > maxP95) maxP95 = data.p95;
        }
        
        return { p95: maxP95.toFixed(3) + 's' };
      },
    });

    // Task 7.4: Redis unavailable
    this.addRule('redis_unavailable', {
      description: 'Redis cache indisponível',
      severity: AlertSeverity.CRITICAL,
      cooldown: 300000,
      condition: async () => {
        try {
          const redisClient = require('../utils/redisClient');
          const health = await redisClient.healthCheck();
          return !health.connected;
        } catch {
          return true;
        }
      },
      getData: () => ({ status: 'disconnected' }),
    });

    // Task 7.5: Supabase unavailable
    this.addRule('supabase_unavailable', {
      description: 'Supabase indisponível',
      severity: AlertSeverity.CRITICAL,
      cooldown: 300000,
      condition: async () => {
        try {
          const SupabaseService = require('../services/SupabaseService');
          const { error } = await SupabaseService.healthCheck();
          return !!error;
        } catch {
          return true;
        }
      },
      getData: () => ({ status: 'error' }),
    });

    // Task 7.6: Memory usage > 80%
    this.addRule('high_memory_usage', {
      description: 'Uso de memória acima de 80%',
      severity: AlertSeverity.WARNING,
      cooldown: 180000, // 3 minutes
      condition: () => {
        const memUsage = process.memoryUsage();
        const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        return usagePercent > 80;
      },
      getData: () => {
        const memUsage = process.memoryUsage();
        return {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
          usagePercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
        };
      },
    });
  }

  /**
   * Task 7.7: Setup notification channels
   */
  setupNotificationChannels() {
    // Log channel (always active)
    this.addChannel('log', {
      send: async (alert) => {
        const logLevel = alert.severity === AlertSeverity.CRITICAL ? 'error' : 'warn';
        logger[logLevel]('ALERT', {
          type: 'alert',
          rule: alert.rule,
          severity: alert.severity,
          message: alert.message,
          data: alert.data,
          timestamp: alert.timestamp,
        });
      },
    });

    // Discord webhook (if configured)
    const discordWebhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      this.addChannel('discord', {
        send: async (alert) => {
          try {
            const color = alert.severity === AlertSeverity.CRITICAL ? 0xFF0000 : 
                         alert.severity === AlertSeverity.WARNING ? 0xFFA500 : 0x00FF00;
            
            const payload = {
              embeds: [{
                title: `🚨 WUZAPI Manager Alert`,
                description: alert.message,
                color,
                fields: [
                  { name: 'Rule', value: alert.rule, inline: true },
                  { name: 'Severity', value: alert.severity, inline: true },
                  { name: 'Time', value: new Date(alert.timestamp).toISOString(), inline: true },
                  ...(alert.data ? [{ name: 'Data', value: JSON.stringify(alert.data, null, 2).slice(0, 1000) }] : []),
                ],
                timestamp: new Date(alert.timestamp).toISOString(),
              }],
            };

            const response = await fetch(discordWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error(`Discord webhook failed: ${response.status}`);
            }
          } catch (error) {
            logger.error('Failed to send Discord alert', { error: error.message });
          }
        },
      });
    }

    // Slack webhook (if configured)
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      this.addChannel('slack', {
        send: async (alert) => {
          try {
            const color = alert.severity === AlertSeverity.CRITICAL ? 'danger' : 
                         alert.severity === AlertSeverity.WARNING ? 'warning' : 'good';
            
            const payload = {
              text: `🚨 Alert: ${alert.message}`,
              attachments: [{
                color,
                fields: [
                  { title: 'Rule', value: alert.rule, short: true },
                  { title: 'Severity', value: alert.severity, short: true },
                  { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true },
                ],
              }],
            };

            const response = await fetch(slackWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error(`Slack webhook failed: ${response.status}`);
            }
          } catch (error) {
            logger.error('Failed to send Slack alert', { error: error.message });
          }
        },
      });
    }
  }

  /**
   * Add an alert rule
   */
  addRule(name, rule) {
    this.rules.set(name, {
      ...rule,
      name,
      triggerCount: 0,
    });
  }

  /**
   * Add a notification channel
   */
  addChannel(name, channel) {
    this.channels.set(name, channel);
  }

  /**
   * Check if rule is in cooldown
   */
  isInCooldown(ruleName) {
    const lastTriggered = this.cooldowns.get(ruleName);
    if (!lastTriggered) return false;
    
    const rule = this.rules.get(ruleName);
    if (!rule) return false;
    
    return Date.now() - lastTriggered < rule.cooldown;
  }

  /**
   * Check all rules and send alerts
   */
  async checkRules() {
    for (const [name, rule] of this.rules) {
      try {
        // Task 7.8: Check cooldown
        if (this.isInCooldown(name)) {
          continue;
        }

        // Evaluate condition
        const shouldAlert = await rule.condition();
        
        if (shouldAlert) {
          const data = rule.getData ? rule.getData() : {};
          const alert = {
            rule: name,
            description: rule.description,
            severity: rule.severity,
            message: rule.description,
            data,
            timestamp: Date.now(),
          };

          // Send alert to all channels
          await this.sendAlert(alert);
          
          // Update cooldown
          this.cooldowns.set(name, Date.now());
          rule.triggerCount++;
          
          // Store in history
          this.alertHistory.push(alert);
          if (this.alertHistory.length > 1000) {
            this.alertHistory = this.alertHistory.slice(-1000);
          }
        }
      } catch (error) {
        logger.error(`Error checking alert rule ${name}`, { error: error.message });
      }
    }
  }

  /**
   * Send alert to all channels
   */
  async sendAlert(alert) {
    for (const [channelName, channel] of this.channels) {
      try {
        await channel.send(alert);
      } catch (error) {
        logger.error(`Failed to send alert to ${channelName}`, { error: error.message });
      }
    }
  }

  /**
   * Start the alert manager
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('Alert manager started', { checkInterval: this.checkInterval });
    
    this.intervalId = setInterval(() => {
      this.checkRules();
    }, this.checkInterval);
  }

  /**
   * Stop the alert manager
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    logger.info('Alert manager stopped');
  }

  /**
   * Get alert manager status
   */
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
        triggerCount: rule.triggerCount,
        cooldown: rule.cooldown,
        inCooldown: this.isInCooldown(name),
      })),
      channels: Array.from(this.channels.keys()),
      recentAlerts: this.alertHistory.slice(-10),
    };
  }

  /**
   * Task 7.9: Test a specific alert
   */
  async testAlert(ruleName) {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`Alert rule '${ruleName}' not found`);
    }
    
    const data = rule.getData ? rule.getData() : {};
    const alert = {
      rule: ruleName,
      description: `[TEST] ${rule.description}`,
      severity: rule.severity,
      message: `[TEST] ${rule.description}`,
      data,
      timestamp: Date.now(),
    };

    await this.sendAlert(alert);
    return alert;
  }
}

// Singleton instance
const alertManager = new AlertManager();

module.exports = {
  AlertManager,
  alertManager,
  AlertSeverity,
};
