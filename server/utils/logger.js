/**
 * Sistema de logging estruturado para WUZAPI Manager
 * Suporta diferentes níveis de log e formatação JSON
 * 
 * Includes EPIPE error handling to prevent crashes when stdout/stderr is closed
 * (common in containerized environments or when piping output)
 */

const fs = require('fs');
const path = require('path');

/**
 * Handle EPIPE errors gracefully
 * EPIPE occurs when stdout/stderr is closed (common in containers/pipes)
 * Instead of crashing, we exit gracefully
 */
const handleEPIPE = (err) => {
  if (err && err.code === 'EPIPE') {
    // Stdout/stderr closed, exit gracefully without crash
    // Don't try to log - the stream is closed
    process.exit(0);
  }
};

// Attach EPIPE handlers early, before any logging
// These prevent crashes when stdout/stderr is closed
process.stdout.on('error', handleEPIPE);
process.stderr.on('error', handleEPIPE);

/**
 * Safe write to stream - handles EPIPE gracefully
 * @param {WritableStream} stream - The stream to write to
 * @param {string} data - The data to write
 * @returns {boolean} - Whether the write was successful
 */
const safeWrite = (stream, data) => {
  try {
    if (stream && !stream.destroyed && stream.writable) {
      stream.write(data);
      return true;
    }
    return false;
  } catch (err) {
    if (err.code !== 'EPIPE') {
      // Re-throw non-EPIPE errors
      throw err;
    }
    // EPIPE errors are silently ignored
    return false;
  }
};

/**
 * Safe console output - wraps console methods with EPIPE protection
 */
const safeConsole = {
  log: (...args) => {
    try {
      console.log(...args);
    } catch (err) {
      if (err.code !== 'EPIPE') throw err;
    }
  },
  error: (...args) => {
    try {
      console.error(...args);
    } catch (err) {
      if (err.code !== 'EPIPE') throw err;
    }
  }
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.format = options.format || process.env.LOG_FORMAT || 'json';
    this.logDir = options.logDir || process.env.LOG_DIR || './logs';
    this.serviceName = options.serviceName || 'wuzapi-manager';
    this.version = options.version || process.env.npm_package_version || '1.0.0';
    
    // Níveis de log (ordem crescente de severidade)
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    
    this.currentLevel = this.levels[this.level] || this.levels.info;
    
    // Criar diretório de logs se não existir
    this.ensureLogDirectory();
    
    // Configurar streams de arquivo
    this.setupFileStreams();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  setupFileStreams() {
    const today = new Date().toISOString().split('T')[0];
    
    // Stream para logs gerais
    this.generalLogFile = path.join(this.logDir, `app-${today}.log`);
    this.generalStream = fs.createWriteStream(this.generalLogFile, { flags: 'a' });
    
    // Stream para logs de erro
    this.errorLogFile = path.join(this.logDir, `error-${today}.log`);
    this.errorStream = fs.createWriteStream(this.errorLogFile, { flags: 'a' });
    
    // Stream para logs de acesso
    this.accessLogFile = path.join(this.logDir, `access-${today}.log`);
    this.accessStream = fs.createWriteStream(this.accessLogFile, { flags: 'a' });
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: this.serviceName,
      version: this.version,
      message,
      ...meta
    };

    // Adicionar informações do processo
    logEntry.process = {
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    // Adicionar stack trace para erros
    if (level === 'error' || level === 'fatal') {
      if (meta.error && meta.error.stack) {
        logEntry.stack = meta.error.stack;
      } else if (meta.stack) {
        logEntry.stack = meta.stack;
      }
    }

    if (this.format === 'json') {
      return JSON.stringify(logEntry);
    } else {
      // Formato texto simples
      return `${timestamp} [${level.toUpperCase()}] ${this.serviceName}: ${message}`;
    }
  }

  shouldLog(level) {
    return this.levels[level] >= this.currentLevel;
  }

  writeToFile(level, formattedMessage) {
    // Escrever no arquivo geral
    this.generalStream.write(formattedMessage + '\n');
    
    // Escrever no arquivo de erro se for erro ou fatal
    if (level === 'error' || level === 'fatal') {
      this.errorStream.write(formattedMessage + '\n');
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Output para console usando safeConsole para evitar EPIPE crashes
    if (level === 'error' || level === 'fatal') {
      safeConsole.error(formattedMessage);
    } else {
      safeConsole.log(formattedMessage);
    }
    
    // Escrever em arquivo
    this.writeToFile(level, formattedMessage);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  fatal(message, meta = {}) {
    this.log('fatal', message, meta);
  }

  // Log específico para requisições HTTP
  access(req, res, responseTime) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'access',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: res.get('Content-Length') || 0
    };

    const formattedMessage = this.format === 'json' 
      ? JSON.stringify(logEntry)
      : `${logEntry.timestamp} ${logEntry.method} ${logEntry.url} ${logEntry.statusCode} ${logEntry.responseTime}`;

    // Escrever no arquivo de acesso
    this.accessStream.write(formattedMessage + '\n');
    
    // Log no console se debug estiver ativo
    if (this.shouldLog('debug')) {
      console.log(formattedMessage);
    }
  }

  // Log específico para performance
  performance(operation, duration, meta = {}) {
    this.info(`Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration: `${duration}ms`,
      ...meta
    });
  }

  // Log específico para métricas de negócio
  metric(name, value, unit = 'count', meta = {}) {
    this.info(`Metric: ${name}`, {
      type: 'metric',
      metric: {
        name,
        value,
        unit,
        timestamp: Date.now()
      },
      ...meta
    });
  }

  // Log específico para eventos de segurança
  security(event, meta = {}) {
    this.warn(`Security Event: ${event}`, {
      type: 'security',
      event,
      ...meta
    });
  }

  // Log específico para integrações externas
  integration(service, action, success, meta = {}) {
    const level = success ? 'info' : 'error';
    this.log(level, `Integration: ${service} - ${action}`, {
      type: 'integration',
      service,
      action,
      success,
      ...meta
    });
  }

  /**
   * Sanitiza token para logging (mostra apenas primeiros e últimos caracteres)
   * @param {string} token - Token para sanitizar
   * @returns {string} Token sanitizado
   */
  sanitizeToken(token) {
    if (!token || typeof token !== 'string') {
      return '[no-token]';
    }
    if (token.length <= 8) {
      return '***';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Log específico para tentativas de autenticação
   * @param {Object} params - Parâmetros da tentativa de autenticação
   */
  logAuthenticationAttempt(params = {}) {
    const {
      success,
      role,
      userId,
      token,
      ip,
      userAgent,
      endpoint,
      method = 'POST',
      error,
      duration
    } = params;

    const level = success ? 'info' : 'warn';
    const message = success 
      ? `Authentication successful: ${role}` 
      : `Authentication failed: ${error || 'Invalid credentials'}`;

    this.log(level, message, {
      type: 'authentication',
      authentication: {
        success,
        role,
        userId: userId || null,
        token: this.sanitizeToken(token),
        endpoint: endpoint || '/api/auth/login',
        method,
        duration: duration ? `${duration}ms` : undefined
      },
      request: {
        ip,
        userAgent
      },
      error: error || undefined
    });
  }

  /**
   * Log específico para validação de token com WUZAPI
   * @param {Object} params - Parâmetros da validação
   */
  logTokenValidation(params = {}) {
    const {
      token,
      role,
      success,
      statusCode,
      responseTime,
      error,
      wuzapiResponse
    } = params;

    const level = success ? 'debug' : 'error';
    const message = success
      ? `Token validation successful with WUZAPI: ${role}`
      : `Token validation failed with WUZAPI: ${error}`;

    this.log(level, message, {
      type: 'token_validation',
      validation: {
        token: this.sanitizeToken(token),
        role,
        success,
        statusCode,
        responseTime: responseTime ? `${responseTime}ms` : undefined
      },
      wuzapi: {
        baseUrl: process.env.WUZAPI_BASE_URL,
        response: wuzapiResponse ? {
          status: wuzapiResponse.status,
          data: wuzapiResponse.data
        } : undefined
      },
      error: error || undefined
    });
  }

  /**
   * Log específico para criação/destruição de sessão
   * @param {Object} params - Parâmetros da sessão
   */
  logSessionCreation(params = {}) {
    const {
      action, // 'created', 'destroyed', 'validated', 'expired'
      sessionId,
      userId,
      role,
      ip,
      userAgent,
      expiresAt,
      error
    } = params;

    const level = error ? 'error' : 'info';
    const message = `Session ${action}: ${role || 'unknown'}`;

    this.log(level, message, {
      type: 'session',
      session: {
        action,
        sessionId: sessionId ? this.sanitizeToken(sessionId) : undefined,
        userId,
        role,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
      },
      request: {
        ip,
        userAgent
      },
      error: error || undefined
    });
  }

  // Fechar streams de arquivo
  close() {
    if (this.generalStream) {
      this.generalStream.end();
    }
    if (this.errorStream) {
      this.errorStream.end();
    }
    if (this.accessStream) {
      this.accessStream.end();
    }
  }

  // Rotacionar logs (chamado diariamente)
  rotate() {
    this.close();
    this.setupFileStreams();
    this.info('Log files rotated');
  }
}

// Instância singleton
const logger = new Logger();

// Middleware para Express
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Override do res.end para capturar tempo de resposta
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    logger.access(req, res, responseTime);
    originalEnd.apply(this, args);
  };
  
  next();
};

// Note: uncaughtException and unhandledRejection handlers are centralized in server/index.js
// to avoid duplicate handlers and ensure consistent behavior

// Rotação diária de logs (não criar em ambiente de teste)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      logger.rotate();
    }
  }, 60000); // Verificar a cada minuto
}

module.exports = {
  Logger,
  logger,
  requestLogger
};