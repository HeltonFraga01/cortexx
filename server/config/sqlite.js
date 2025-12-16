/**
 * Configurações específicas do SQLite
 * Centraliza todas as configurações relacionadas ao banco SQLite
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

class SQLiteConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Carrega configurações do SQLite a partir de variáveis de ambiente
   */
  loadConfig() {
    // Resolver caminho do banco de dados
    logger.debug('SQLiteConfig loading', { 
      SQLITE_DB_PATH: process.env.SQLITE_DB_PATH,
      __dirname 
    });
    let dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'wuzapi.db');
    
    // Se o caminho for relativo, resolver a partir do diretório server/
    if (!path.isAbsolute(dbPath)) {
      // __dirname é server/config, então subimos 1 nível para chegar em server/
      // e então resolvemos o caminho relativo a partir de lá
      const serverDir = path.join(__dirname, '..');
      dbPath = path.resolve(serverDir, dbPath);
    }
    
    const config = {
      // Caminho do banco de dados
      dbPath: dbPath,
      
      // Configurações de performance
      walMode: process.env.SQLITE_WAL_MODE === 'true' || true,
      timeout: parseInt(process.env.SQLITE_TIMEOUT) || 5000,
      
      // Configurações de cache
      cacheSize: parseInt(process.env.SQLITE_CACHE_SIZE) || 2000, // páginas
      
      // Configurações de sincronização
      synchronous: process.env.SQLITE_SYNCHRONOUS || 'NORMAL',
      
      // Configurações de memória
      tempStore: process.env.SQLITE_TEMP_STORE || 'MEMORY',
      mmapSize: parseInt(process.env.SQLITE_MMAP_SIZE) || 268435456, // 256MB
      
      // Configurações de backup
      autoBackup: process.env.SQLITE_AUTO_BACKUP === 'true' || false,
      backupInterval: parseInt(process.env.SQLITE_BACKUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24h
      
      // Configurações de vacuum
      autoVacuum: process.env.SQLITE_AUTO_VACUUM || 'INCREMENTAL',
      walAutocheckpoint: parseInt(process.env.SQLITE_WAL_AUTOCHECKPOINT) || 1000,
      
      // Configurações de segurança
      foreignKeys: process.env.SQLITE_FOREIGN_KEYS === 'false' ? false : true,
      recursiveTriggers: process.env.SQLITE_RECURSIVE_TRIGGERS === 'false' ? false : true
    };

    // Garantir que o diretório do banco existe
    this.ensureDbDirectory(config.dbPath);
    
    return config;
  }

  /**
   * Garante que o diretório do banco de dados existe
   */
  ensureDbDirectory(dbPath) {
    const dbDir = path.dirname(dbPath);
    
    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info('SQLite directory created', { directory: dbDir });
      }
      
      // Verificar permissões de escrita
      fs.accessSync(dbDir, fs.constants.W_OK);
      
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error(`Sem permissão de escrita no diretório: ${dbDir}`);
      } else if (error.code === 'ENOENT') {
        throw new Error(`Não foi possível criar o diretório: ${dbDir}`);
      } else {
        throw new Error(`Erro ao preparar diretório do banco: ${error.message}`);
      }
    }
  }

  /**
   * Retorna configurações formatadas para o SQLite
   */
  getSQLitePragmas() {
    const pragmas = [];
    
    // Journal mode (WAL para melhor concorrência)
    if (this.config.walMode) {
      pragmas.push('PRAGMA journal_mode = WAL');
    }
    
    // Synchronous mode
    pragmas.push(`PRAGMA synchronous = ${this.config.synchronous}`);
    
    // Cache size
    pragmas.push(`PRAGMA cache_size = ${this.config.cacheSize}`);
    
    // Temp store
    pragmas.push(`PRAGMA temp_store = ${this.config.tempStore}`);
    
    // Memory-mapped I/O
    pragmas.push(`PRAGMA mmap_size = ${this.config.mmapSize}`);
    
    // Foreign keys
    pragmas.push(`PRAGMA foreign_keys = ${this.config.foreignKeys ? 'ON' : 'OFF'}`);
    
    // Recursive triggers
    pragmas.push(`PRAGMA recursive_triggers = ${this.config.recursiveTriggers ? 'ON' : 'OFF'}`);
    
    // Auto vacuum
    pragmas.push(`PRAGMA auto_vacuum = ${this.config.autoVacuum}`);
    
    // WAL autocheckpoint
    if (this.config.walMode) {
      pragmas.push(`PRAGMA wal_autocheckpoint = ${this.config.walAutocheckpoint}`);
    }
    
    return pragmas;
  }

  /**
   * Retorna configurações de conexão
   */
  getConnectionConfig() {
    return {
      filename: this.config.dbPath,
      timeout: this.config.timeout,
      verbose: process.env.NODE_ENV === 'development' ? (msg) => logger.debug('SQLite verbose', { message: msg }) : null
    };
  }

  /**
   * Retorna configurações de backup
   */
  getBackupConfig() {
    return {
      enabled: this.config.autoBackup,
      interval: this.config.backupInterval,
      path: path.dirname(this.config.dbPath),
      maxBackups: parseInt(process.env.SQLITE_MAX_BACKUPS) || 7
    };
  }

  /**
   * Valida configurações
   */
  validate() {
    logger.debug('SQLiteConfig validation started');
    const errors = [];
    
    // Validar caminho do banco
    const dbDir = path.dirname(this.config.dbPath);
    logger.debug('SQLiteConfig validating', { dbDir });
    
    // Verificar se o caminho é absoluto ou relativo válido
    if (!path.isAbsolute(this.config.dbPath) && !this.config.dbPath.startsWith('./')) {
      // Para caminhos relativos, garantir que começam com ./
      if (!this.config.dbPath.includes('/')) {
        // Se é apenas um nome de arquivo, assumir diretório atual
        this.config.dbPath = `./${this.config.dbPath}`;
      }
    }
    
    logger.debug('SQLiteConfig ensuring directory exists');
    try {
      // Tentar garantir que o diretório existe
      this.ensureDbDirectory(this.config.dbPath);
      logger.debug('SQLiteConfig ensureDbDirectory completed');
      
      // Verificar se conseguimos acessar o diretório
      logger.debug('SQLiteConfig checking directory access');
      fs.accessSync(dbDir, fs.constants.R_OK | fs.constants.W_OK);
      logger.debug('SQLiteConfig directory access verified');
      
    } catch (error) {
      logger.debug('SQLiteConfig validation error', { error: error.message, code: error.code });
      if (error.code === 'EACCES') {
        errors.push(`Sem permissão de leitura/escrita no diretório: ${dbDir}`);
      } else if (error.code === 'ENOENT') {
        errors.push(`Diretório não existe e não pode ser criado: ${dbDir}`);
      } else {
        errors.push(`Erro ao acessar diretório do banco: ${error.message}`);
      }
    }
    
    // Validar timeout
    if (this.config.timeout < 1000) {
      errors.push('Timeout deve ser pelo menos 1000ms');
    }
    
    // Validar cache size
    if (this.config.cacheSize < 100) {
      errors.push('Cache size deve ser pelo menos 100 páginas');
    }
    
    // Validar valores de configuração
    if (!['OFF', 'NORMAL', 'FULL', 'EXTRA'].includes(this.config.synchronous)) {
      errors.push(`Valor inválido para synchronous: ${this.config.synchronous}`);
    }
    
    if (!['NONE', 'FULL', 'INCREMENTAL'].includes(this.config.autoVacuum)) {
      errors.push(`Valor inválido para autoVacuum: ${this.config.autoVacuum}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Retorna informações de configuração para logs
   */
  getConfigInfo() {
    return {
      dbPath: this.config.dbPath,
      walMode: this.config.walMode,
      timeout: this.config.timeout,
      cacheSize: this.config.cacheSize,
      synchronous: this.config.synchronous,
      foreignKeys: this.config.foreignKeys,
      autoBackup: this.config.autoBackup
    };
  }

  /**
   * Cria configuração de desenvolvimento
   */
  static createDevConfig() {
    return {
      SQLITE_DB_PATH: './server/wuzapi-dev.db',
      SQLITE_WAL_MODE: 'true',
      SQLITE_TIMEOUT: '3000',
      SQLITE_CACHE_SIZE: '1000',
      SQLITE_SYNCHRONOUS: 'NORMAL',
      SQLITE_AUTO_BACKUP: 'false'
    };
  }

  /**
   * Cria configuração de produção
   */
  static createProdConfig() {
    return {
      SQLITE_DB_PATH: '/app/data/wuzapi.db',
      SQLITE_WAL_MODE: 'true',
      SQLITE_TIMEOUT: '5000',
      SQLITE_CACHE_SIZE: '2000',
      SQLITE_SYNCHRONOUS: 'NORMAL',
      SQLITE_AUTO_BACKUP: 'true',
      SQLITE_BACKUP_INTERVAL: '86400000', // 24h
      SQLITE_MAX_BACKUPS: '7'
    };
  }
}

module.exports = SQLiteConfig;