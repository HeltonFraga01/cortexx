const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { logger } = require('./utils/logger');
const SQLiteConfig = require('./config/sqlite');

class Database {
  constructor(dbPath = null) {
    console.log('[Database] DEBUG - Construtor iniciado');

    // Carregar configurações SQLite
    console.log('[Database] DEBUG - Criando SQLiteConfig');
    this.sqliteConfig = new SQLiteConfig();
    console.log('[Database] DEBUG - SQLiteConfig criado');

    // Usar caminho fornecido, da configuração, ou da variável de ambiente
    this.dbPath = dbPath || this.sqliteConfig.config.dbPath;
    console.log('[Database] DEBUG - dbPath definido:', this.dbPath);

    // Log do caminho que será usado
    logger.info('🗄️ Caminho do banco SQLite:', this.dbPath);

    // Validar configurações
    console.log('[Database] DEBUG - Validando configurações');
    const validation = this.sqliteConfig.validate();
    console.log('[Database] DEBUG - Validação completa:', validation);

    if (!validation.valid) {
      logger.error('❌ Configurações SQLite inválidas:', validation.errors);
      throw new Error(`Configurações SQLite inválidas: ${validation.errors.join(', ')}`);
    }

    // Log das configurações carregadas
    logger.info('⚙️ Configurações SQLite carregadas:', this.sqliteConfig.getConfigInfo());

    // Inicializar conexão SQLite
    this.db = null;
    this.isInitialized = false;
    console.log('[Database] DEBUG - Construtor finalizado');
    this.initPromise = null;

    // Cache de validação de usuários (usar Map para melhor performance)
    this.userValidationCache = new Map();

    // Timer para limpeza automática do cache (a cada 10 minutos)
    // Não criar timer em ambiente de teste para evitar que o processo fique pendente
    if (process.env.NODE_ENV !== 'test') {
      this.cacheCleanupTimer = setInterval(() => {
        this.clearUserValidationCache();
      }, 600000); // 10 minutos
    } else {
      this.cacheCleanupTimer = null;
    }

    // Não inicializar automaticamente no construtor para permitir melhor controle de erros
  }

  async init() {
    if (!this.initPromise) {
      this.initPromise = this.initConnection();
    }
    return this.initPromise;
  }

  async initConnection() {
    return new Promise((resolve, reject) => {
      // Verificar se o arquivo do banco já existe
      const fs = require('fs');
      const path = require('path');
      const dbExists = fs.existsSync(this.dbPath);

      logger.info(`🔍 Arquivo do banco ${dbExists ? 'existe' : 'será criado'}: ${this.dbPath}`);

      console.log('[Database] DEBUG - Tentando abrir banco:', this.dbPath);
      console.log('[Database] DEBUG - Arquivo existe?', dbExists);
      console.log('[Database] DEBUG - Diretório:', path.dirname(this.dbPath));

      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          logger.error('❌ Erro ao conectar com SQLite:', {
            message: err.message,
            code: err.code,
            path: this.dbPath
          });

          // Fornecer mensagens de erro mais específicas
          let enhancedError = err;
          if (err.code === 'SQLITE_CANTOPEN') {
            enhancedError = new Error(`Não foi possível abrir o banco de dados: ${this.dbPath}. Verifique se o diretório existe e tem permissões adequadas.`);
            enhancedError.code = err.code;
          } else if (err.code === 'SQLITE_PERM') {
            enhancedError = new Error(`Permissão negada para acessar o banco de dados: ${this.dbPath}. Verifique as permissões do arquivo e diretório.`);
            enhancedError.code = err.code;
          } else if (err.message.includes('ENOENT')) {
            enhancedError = new Error(`Diretório do banco de dados não encontrado: ${path.dirname(this.dbPath)}. Verifique se o caminho está correto.`);
            enhancedError.code = 'ENOENT';
          } else if (err.message.includes('EACCES')) {
            enhancedError = new Error(`Sem permissão para criar/acessar o banco de dados: ${this.dbPath}. Verifique as permissões do diretório.`);
            enhancedError.code = 'EACCES';
          }

          reject(enhancedError);
        } else {
          logger.info(`✅ Conectado ao banco de dados SQLite: ${this.dbPath}`);

          try {
            // Configurar SQLite para melhor performance e segurança
            await this.configureSQLiteSettings();

            // Inicializar tabelas
            await this.initTables();

            this.isInitialized = true;
            logger.info('✅ Banco de dados SQLite totalmente inicializado');
            resolve();

          } catch (error) {
            logger.error('❌ Erro durante inicialização do banco:', error.message);
            reject(error);
          }
        }
      });
    });
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  async query(sql, params = []) {
    await this.ensureInitialized();

    // Verificar se o banco está aberto antes de executar a query
    if (!this.db || !this.db.open) {
      const error = new Error('Database is closed or not initialized');
      logger.error('❌ Tentativa de query em banco fechado:', { sql, error: error.message });
      throw error;
    }

    const start = Date.now();

    return new Promise((resolve, reject) => {
      // Determinar se é uma query SELECT ou PRAGMA (ambas retornam dados)
      const sqlUpper = sql.trim().toUpperCase();
      const isSelect = sqlUpper.startsWith('SELECT') || sqlUpper.startsWith('PRAGMA');

      if (isSelect) {
        this.db.all(sql, params, (err, rows) => {
          const duration = Date.now() - start;

          if (err) {
            logger.error('❌ Erro na query SQLite:', { sql, error: err.message, duration });
            reject(err);
          } else {
            logger.info('✅ Query executada', { sql: sql.substring(0, 100) + '...', duration, rows: rows.length });
            resolve({ rows, rowCount: rows.length });
          }
        });
      } else {
        this.db.run(sql, params, function (err) {
          const duration = Date.now() - start;

          if (err) {
            logger.error('❌ Erro na query SQLite:', { sql, error: err.message, duration });
            reject(err);
          } else {
            logger.info('✅ Query executada', { sql: sql.substring(0, 100) + '...', duration, changes: this.changes });
            resolve({
              rows: this.lastID ? [{ id: this.lastID }] : [],
              rowCount: this.changes,
              lastID: this.lastID
            });
          }
        });
      }
    });
  }

  async initTables() {
    try {
      // 1. Verificar integridade do banco de dados
      await this.checkDatabaseIntegrity();

      // 2. Verificar/criar tabela de metadados do sistema
      await this.createSystemMetadataTable();

      // 3. Verificar versão do schema
      const currentVersion = await this.getSchemaVersion();
      const targetVersion = 2; // Versão atual do schema (incrementada para incluir branding)

      if (currentVersion < targetVersion) {
        logger.info(`🔄 Atualizando schema da versão ${currentVersion} para ${targetVersion}`);
        await this.migrateSchema(currentVersion, targetVersion);
      }

      // 4. Criar/verificar tabela principal
      await this.createDatabaseConnectionsTable();

      // 5. Criar/verificar tabela de branding
      await this.createBrandingConfigTable();

      // 6. Criar/verificar tabela de links customizados
      await this.createCustomLinksTable();

      // 7. Criar/verificar tabela de mensagens
      await this.createSentMessagesTable();

      // 8. Criar/verificar tabela de mensagens agendadas
      await this.createScheduledSingleMessagesTable();

      // 9. Criar índices para performance
      await this.createIndexes();

      // 10. Inserir dados padrão se necessário
      await this.insertDefaultDataIfNeeded();

      // 11. Inserir configuração de branding padrão se necessário
      await this.insertDefaultBrandingIfNeeded();

      // 12. Validar integridade final
      await this.validateSchema();

      logger.info('✅ Inicialização do banco de dados concluída com sucesso');

    } catch (error) {
      logger.error('❌ Erro durante inicialização do banco:', error.message);
      throw error;
    }
  }

  async checkDatabaseIntegrity() {
    return new Promise((resolve, reject) => {
      this.db.get('PRAGMA integrity_check', (err, row) => {
        if (err) {
          logger.error('❌ Erro ao verificar integridade do banco:', err.message);
          reject(err);
        } else if (row && row.integrity_check === 'ok') {
          logger.info('✅ Integridade do banco de dados verificada');
          resolve();
        } else {
          const error = new Error(`Falha na verificação de integridade: ${row?.integrity_check}`);
          logger.error('❌ Banco de dados corrompido:', error.message);
          reject(error);
        }
      });
    });
  }

  async createSystemMetadataTable() {
    const createMetadataTable = `
      CREATE TABLE IF NOT EXISTS system_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createMetadataTable, (err) => {
        if (err) {
          logger.error('❌ Erro ao criar tabela system_metadata:', err.message);
          reject(err);
        } else {
          logger.info('✅ Tabela system_metadata criada/verificada');
          resolve();
        }
      });
    });
  }

  async getSchemaVersion() {
    return new Promise((resolve) => {
      this.db.get(
        'SELECT value FROM system_metadata WHERE key = ?',
        ['schema_version'],
        (err, row) => {
          if (err || !row) {
            // Primeira execução, versão 0
            resolve(0);
          } else {
            resolve(parseInt(row.value) || 0);
          }
        }
      );
    });
  }

  async setSchemaVersion(version) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO system_metadata (key, value, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        ['schema_version', version.toString()],
        (err) => {
          if (err) {
            reject(err);
          } else {
            logger.info(`✅ Schema atualizado para versão ${version}`);
            resolve();
          }
        }
      );
    });
  }

  async migrateSchema(fromVersion, toVersion) {
    logger.info(`🔄 Executando migração de schema: ${fromVersion} → ${toVersion}`);

    // Aqui podemos adicionar migrações específicas no futuro
    // Por enquanto, apenas atualizamos a versão
    await this.setSchemaVersion(toVersion);
  }

  async createDatabaseConnectionsTable() {
    const createConnectionsTable = `
      CREATE TABLE IF NOT EXISTS database_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('POSTGRES', 'MYSQL', 'NOCODB', 'API', 'SQLITE')),
        host TEXT NOT NULL,
        port INTEGER DEFAULT 5432,
        database_name TEXT,
        username TEXT,
        password TEXT,
        table_name TEXT,
        status TEXT DEFAULT 'disconnected' CHECK(status IN ('connected', 'disconnected', 'error', 'testing')),
        assigned_users TEXT DEFAULT '[]',
        nocodb_token TEXT,
        nocodb_project_id TEXT,
        nocodb_table_id TEXT,
        user_link_field TEXT,
        field_mappings TEXT DEFAULT '[]',
        view_configuration TEXT DEFAULT NULL,
        default_view_mode TEXT DEFAULT 'list' CHECK(default_view_mode IN ('list', 'single')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createConnectionsTable, (err) => {
        if (err) {
          logger.error('❌ Erro ao criar tabela database_connections:', err.message);
          reject(err);
        } else {
          logger.info('✅ Tabela database_connections criada/verificada');
          resolve();
        }
      });
    });
  }

  async createBrandingConfigTable() {
    const createBrandingTable = `
      CREATE TABLE IF NOT EXISTS branding_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name VARCHAR(50) NOT NULL DEFAULT 'WUZAPI',
        logo_url TEXT,
        primary_color VARCHAR(7),
        secondary_color VARCHAR(7),
        custom_home_html TEXT,
        support_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createBrandingTable, (err) => {
        if (err) {
          logger.error('❌ Erro ao criar tabela branding_config:', err.message);
          reject(err);
        } else {
          logger.info('✅ Tabela branding_config criada/verificada');

          // Run migrations to add columns if table already exists
          this.runMigration003()
            .then(() => this.runMigration018())
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  async createCustomLinksTable() {
    const createLinksTable = `
      CREATE TABLE IF NOT EXISTS custom_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT DEFAULT 'ExternalLink',
        position INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createLinksTable, (err) => {
        if (err) {
          logger.error('❌ Erro ao criar tabela custom_links:', err.message);
          reject(err);
        } else {
          logger.info('✅ Tabela custom_links criada/verificada');
          resolve();
        }
      });
    });
  }

  async runMigration003() {
    return new Promise((resolve, reject) => {
      // Check if column already exists
      this.db.get(
        "SELECT COUNT(*) as count FROM pragma_table_info('branding_config') WHERE name='custom_home_html'",
        (err, row) => {
          if (err) {
            logger.warn('⚠️ Erro ao verificar coluna custom_home_html:', err.message);
            resolve(); // Continue even if check fails
            return;
          }

          if (row && row.count > 0) {
            logger.info('ℹ️ Coluna custom_home_html já existe');
            resolve();
            return;
          }

          // Add the column if it doesn't exist
          const sql = `ALTER TABLE branding_config ADD COLUMN custom_home_html TEXT DEFAULT NULL`;

          this.db.run(sql, (err) => {
            if (err) {
              logger.warn('⚠️ Erro ao adicionar coluna custom_home_html:', err.message);
              resolve(); // Continue even if migration fails
            } else {
              logger.info('✅ Coluna custom_home_html adicionada via migration');
              resolve();
            }
          });
        }
      );
    });
  }

  async runMigration018() {
    return new Promise((resolve, reject) => {
      // Check if support_phone column already exists
      this.db.get(
        "SELECT COUNT(*) as count FROM pragma_table_info('branding_config') WHERE name='support_phone'",
        (err, row) => {
          if (err) {
            logger.warn('⚠️ Erro ao verificar coluna support_phone:', err.message);
            resolve(); // Continue even if check fails
            return;
          }

          if (row && row.count > 0) {
            logger.info('ℹ️ Coluna support_phone já existe');
            resolve();
            return;
          }

          // Add the column if it doesn't exist
          const sql = `ALTER TABLE branding_config ADD COLUMN support_phone TEXT DEFAULT NULL`;

          this.db.run(sql, (err) => {
            if (err) {
              logger.warn('⚠️ Erro ao adicionar coluna support_phone:', err.message);
              resolve(); // Continue even if migration fails
            } else {
              logger.info('✅ Coluna support_phone adicionada via migration 018');
              resolve();
            }
          });
        }
      );
    });
  }

  async createSentMessagesTable() {
    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS sent_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_token TEXT NOT NULL,
        phone TEXT NOT NULL,
        message TEXT,
        message_type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent',
        wuzapi_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createMessagesTable, (err) => {
        if (err) {
          logger.error('❌ Erro ao criar tabela sent_messages:', err.message);
          reject(err);
        } else {
          logger.info('✅ Tabela sent_messages criada/verificada');

          // Criar índice para melhor performance
          const createIndex = `
            CREATE INDEX IF NOT EXISTS idx_sent_messages_user_token 
            ON sent_messages(user_token, created_at DESC)
          `;

          this.db.run(createIndex, (indexErr) => {
            if (indexErr) {
              logger.warn('⚠️ Erro ao criar índice de mensagens:', indexErr.message);
              resolve(); // Continue mesmo com erro de índice
            } else {
              logger.info('✅ Índice de mensagens criado');
              resolve();
            }
          });
        }
      });
    });
  }

  async createScheduledSingleMessagesTable() {
    const createTable = `
      CREATE TABLE IF NOT EXISTS scheduled_single_messages (
        id TEXT PRIMARY KEY,
        user_token TEXT NOT NULL,
        instance TEXT NOT NULL,
        recipient TEXT NOT NULL,
        recipient_name TEXT,
        message_type TEXT NOT NULL CHECK(message_type IN ('text', 'media')),
        message_content TEXT NOT NULL,
        media_data TEXT,
        scheduled_at DATETIME NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending',
        error_message TEXT,
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createTable, (err) => {
        if (err) {
          logger.error('❌ Erro ao criar tabela scheduled_single_messages:', err.message);
          reject(err);
        } else {
          logger.info('✅ Tabela scheduled_single_messages criada/verificada');

          // Criar índices
          const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_user_token ON scheduled_single_messages(user_token)',
            'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_status ON scheduled_single_messages(status)',
            'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_scheduled_at ON scheduled_single_messages(scheduled_at) WHERE status = \'pending\'',
            'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_instance ON scheduled_single_messages(instance)'
          ];

          let completed = 0;
          indexes.forEach((indexSql, i) => {
            this.db.run(indexSql, (indexErr) => {
              if (indexErr) {
                logger.warn(`⚠️ Erro ao criar índice ${i + 1}:`, indexErr.message);
              } else {
                logger.info(`✅ Índice ${i + 1} de scheduled_single_messages criado`);
              }

              completed++;
              if (completed === indexes.length) {
                resolve();
              }
            });
          });
        }
      });
    });
  }

  async createIndexes() {
    const indexes = [
      // Índices básicos
      {
        name: 'idx_database_connections_type',
        sql: 'CREATE INDEX IF NOT EXISTS idx_database_connections_type ON database_connections(type)'
      },
      {
        name: 'idx_database_connections_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_database_connections_status ON database_connections(status)'
      },
      {
        name: 'idx_database_connections_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_database_connections_created_at ON database_connections(created_at)'
      },
      {
        name: 'idx_database_connections_name',
        sql: 'CREATE INDEX IF NOT EXISTS idx_database_connections_name ON database_connections(name)'
      },
      // Índices compostos para melhor performance
      {
        name: 'idx_type_status_composite',
        sql: 'CREATE INDEX IF NOT EXISTS idx_type_status_composite ON database_connections(type, status)'
      },
      {
        name: 'idx_created_at_desc',
        sql: 'CREATE INDEX IF NOT EXISTS idx_created_at_desc ON database_connections(created_at DESC)'
      },
      {
        name: 'idx_name_lower',
        sql: 'CREATE INDEX IF NOT EXISTS idx_name_lower ON database_connections(LOWER(name))'
      }
    ];

    for (const index of indexes) {
      try {
        await new Promise((resolve, reject) => {
          this.db.run(index.sql, (err) => {
            if (err) {
              logger.warn(`⚠️ Erro ao criar índice ${index.name}:`, err.message);
              resolve(); // Continuar mesmo com erro de índice
            } else {
              logger.info(`✅ Índice ${index.name} criado/verificado`);
              resolve();
            }
          });
        });
      } catch (error) {
        logger.warn(`⚠️ Falha ao criar índice ${index.name}:`, error.message);
      }
    }
  }

  async insertDefaultDataIfNeeded() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM database_connections', (err, row) => {
        if (err) {
          logger.error('❌ Erro ao verificar dados existentes:', err.message);
          reject(err);
        } else if (row.count === 0) {
          const insertDefault = `
            INSERT INTO database_connections (
              name, type, host, port, database_name, username, password, table_name, status, assigned_users
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          this.db.run(insertDefault, [
            'Banco Principal SQLite',
            'SQLITE',
            'localhost',
            0,
            'wuzapi.db',
            '',
            '',
            'database_connections',
            'connected',
            JSON.stringify(['admin'])
          ], (err) => {
            if (err) {
              logger.error('❌ Erro ao inserir dados padrão:', err.message);
            } else {
              logger.info('✅ Dados padrão inseridos no SQLite');
            }
            resolve(); // Resolver mesmo se houver erro nos dados padrão
          });
        } else {
          logger.info(`ℹ️ Banco já possui ${row.count} registro(s), pulando inserção de dados padrão`);
          resolve();
        }
      });
    });
  }

  async insertDefaultBrandingIfNeeded() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM branding_config', (err, row) => {
        if (err) {
          logger.error('❌ Erro ao verificar configuração de branding existente:', err.message);
          reject(err);
        } else if (row.count === 0) {
          const insertDefaultBranding = `
            INSERT INTO branding_config (
              app_name, logo_url, primary_color, secondary_color
            ) VALUES (?, ?, ?, ?)
          `;

          this.db.run(insertDefaultBranding, [
            'WUZAPI',
            null,
            null,
            null
          ], (err) => {
            if (err) {
              logger.error('❌ Erro ao inserir configuração de branding padrão:', err.message);
            } else {
              logger.info('✅ Configuração de branding padrão inserida');
            }
            resolve(); // Resolver mesmo se houver erro
          });
        } else {
          logger.info(`ℹ️ Configuração de branding já existe, pulando inserção padrão`);
          resolve();
        }
      });
    });
  }

  async validateSchema() {
    return new Promise((resolve, reject) => {
      // Verificar se a tabela principal existe e tem as colunas esperadas
      this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='database_connections'",
        (err, row) => {
          if (err) {
            logger.error('❌ Erro ao validar schema:', err.message);
            reject(err);
          } else if (!row) {
            const error = new Error('Tabela database_connections não encontrada após inicialização');
            logger.error('❌ Validação de schema falhou:', error.message);
            reject(error);
          } else {
            logger.info('✅ Schema validado com sucesso');
            resolve();
          }
        }
      );
    });
  }

  async configureSQLiteSettings() {
    // Usar configurações do SQLiteConfig
    const pragmas = this.sqliteConfig.getSQLitePragmas();

    for (const pragma of pragmas) {
      try {
        await new Promise((resolve, reject) => {
          this.db.run(pragma, (err) => {
            if (err) {
              logger.warn(`⚠️ Erro ao executar ${pragma}:`, err.message);
              resolve(); // Continuar mesmo com erro
            } else {
              logger.info(`✅ ${pragma} aplicado com sucesso`);
              resolve();
            }
          });
        });
      } catch (error) {
        logger.warn(`⚠️ Falha ao executar ${pragma}:`, error.message);
      }
    }

    // Verificar configurações aplicadas
    await this.logCurrentSettings();
    
    // NOTA: Índices de performance são criados em createIndexes() após a criação das tabelas
  }

  // NOTA: createPerformanceIndexes foi removido - índices de performance 
  // agora são criados em createIndexes() após a criação das tabelas

  async logCurrentSettings() {
    const settingsToCheck = ['journal_mode', 'synchronous', 'cache_size', 'foreign_keys'];

    for (const setting of settingsToCheck) {
      try {
        await new Promise((resolve) => {
          this.db.get(`PRAGMA ${setting}`, (err, row) => {
            if (!err && row) {
              const value = Object.values(row)[0];
              logger.info(`📊 ${setting}: ${value}`);
            }
            resolve();
          });
        });
      } catch (error) {
        // Ignorar erros de verificação
      }
    }
  }

  // Método para backup do banco de dados
  async createBackup(backupPath = null) {
    if (!backupPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = this.dbPath.replace('.db', `_backup_${timestamp}.db`);
    }

    return new Promise((resolve, reject) => {
      const backup = this.db.backup(backupPath);

      backup.step(-1, (err) => {
        if (err) {
          logger.error('❌ Erro durante backup:', err.message);
          reject(err);
        } else {
          backup.finish((err) => {
            if (err) {
              logger.error('❌ Erro ao finalizar backup:', err.message);
              reject(err);
            } else {
              logger.info(`✅ Backup criado: ${backupPath}`);
              resolve(backupPath);
            }
          });
        }
      });
    });
  }

  // Método para obter estatísticas do banco
  async getDatabaseStats() {
    return new Promise((resolve, reject) => {
      const stats = {};

      // Tamanho do banco
      this.db.get('PRAGMA page_count', (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        stats.pageCount = row.page_count;

        this.db.get('PRAGMA page_size', (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          stats.pageSize = row.page_size;
          stats.databaseSize = stats.pageCount * stats.pageSize;

          // Contagem de registros
          this.db.get('SELECT COUNT(*) as count FROM database_connections', (err, row) => {
            if (err) {
              reject(err);
              return;
            }

            stats.recordCount = row.count;
            stats.avgRecordSize = stats.recordCount > 0 ? Math.round(stats.databaseSize / stats.recordCount) : 0;

            logger.info('📊 Estatísticas do banco:', {
              tamanho: `${Math.round(stats.databaseSize / 1024)} KB`,
              registros: stats.recordCount,
              tamanhoMedioRegistro: `${stats.avgRecordSize} bytes`
            });

            resolve(stats);
          });
        });
      });
    });
  }



  async getAllConnections() {
    const sql = `
      SELECT 
        id, name, type, host, port, database_name as database, username, password, 
        table_name, status, assigned_users, nocodb_token, nocodb_project_id, 
        nocodb_table_id, user_link_field, field_mappings, view_configuration, created_at, updated_at
      FROM database_connections 
      ORDER BY created_at DESC
    `;
    const { rows } = await this.query(sql);
    return rows.map(row => ({
      ...row,
      assignedUsers: this.parseAssignedUsers(row.assigned_users),
      fieldMappings: this.parseFieldMappings(row.field_mappings),
      viewConfiguration: this.parseViewConfiguration(row.view_configuration)
    }));
  }

  async getConnectionById(id) {
    const sql = `
      SELECT 
        id, name, type, host, port, database_name as database, username, password, 
        table_name, status, assigned_users, nocodb_token, nocodb_project_id, 
        nocodb_table_id, user_link_field, field_mappings, view_configuration, created_at, updated_at
      FROM database_connections 
      WHERE id = ?
    `;
    const { rows } = await this.query(sql, [id]);
    if (rows.length > 0) {
      const row = rows[0];
      return {
        ...row,
        assignedUsers: this.parseAssignedUsers(row.assigned_users),
        fieldMappings: this.parseFieldMappings(row.field_mappings),
        viewConfiguration: this.parseViewConfiguration(row.view_configuration)
      };
    }
    return null;
  }

  async createConnection(data) {
    // Validar e normalizar dados JSON
    const validatedData = this.validateConnectionData(data);

    const sql = `
      INSERT INTO database_connections (
        name, type, host, port, database_name, username, password, 
        table_name, status, assigned_users, nocodb_token, 
        nocodb_project_id, nocodb_table_id, user_link_field, field_mappings, view_configuration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      validatedData.name,
      validatedData.type,
      validatedData.host,
      validatedData.port || 5432,
      validatedData.database || '',
      validatedData.username || '',
      validatedData.password || '',
      validatedData.table_name || validatedData.table || '',
      'disconnected', // Status inicial como 'disconnected'
      this.stringifyJSON(validatedData.assignedUsers || []),
      validatedData.nocodb_token || validatedData.nocodbToken || '',
      validatedData.nocodb_project_id || validatedData.nocodbProjectId || '',
      validatedData.nocodb_table_id || validatedData.nocodbTableId || '',
      validatedData.user_link_field || validatedData.userLinkField || '',
      this.stringifyJSON(validatedData.fieldMappings || []),
      this.stringifyJSON(validatedData.viewConfiguration, null)
    ];
    const result = await this.query(sql, values);

    const createdConnection = {
      id: result.lastID,
      ...validatedData,
      status: 'disconnected',
      assignedUsers: validatedData.assignedUsers,
      fieldMappings: validatedData.fieldMappings,
      viewConfiguration: validatedData.viewConfiguration
    };

    // Testar a conexão automaticamente após criação (apenas em produção)
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(async () => {
        try {
          // Verificar se o banco ainda está aberto antes de testar
          if (this.db && this.isInitialized) {
            await this.testConnectionAndUpdateStatus(createdConnection);
          }
        } catch (error) {
          logger.error('❌ Erro ao testar conexão recém-criada:', error.message);
        }
      }, 1000); // Aguardar 1 segundo para testar
    }

    return createdConnection;
  }

  async updateConnection(id, data) {
    // Buscar dados existentes para fazer merge com os novos dados
    const existing = await this.getConnectionById(id);
    if (!existing) {
      throw new Error(`Connection with id ${id} not found`);
    }

    // Fazer merge dos dados existentes com os novos dados
    const mergedData = {
      name: data.name !== undefined ? data.name : existing.name,
      type: data.type !== undefined ? data.type : existing.type,
      host: data.host !== undefined ? data.host : existing.host,
      port: data.port !== undefined ? data.port : existing.port,
      database: data.database !== undefined ? data.database : existing.database,
      username: data.username !== undefined ? data.username : existing.username,
      password: data.password !== undefined ? data.password : existing.password,
      table_name: data.table_name !== undefined ? data.table_name : (data.table !== undefined ? data.table : existing.table_name),
      status: data.status !== undefined ? data.status : existing.status,
      assignedUsers: data.assignedUsers !== undefined ? data.assignedUsers : existing.assignedUsers,
      nocodb_token: data.nocodb_token !== undefined ? data.nocodb_token : (data.nocodbToken !== undefined ? data.nocodbToken : existing.nocodb_token),
      nocodb_project_id: data.nocodb_project_id !== undefined ? data.nocodb_project_id : (data.nocodbProjectId !== undefined ? data.nocodbProjectId : existing.nocodb_project_id),
      nocodb_table_id: data.nocodb_table_id !== undefined ? data.nocodb_table_id : (data.nocodbTableId !== undefined ? data.nocodbTableId : existing.nocodb_table_id),
      user_link_field: data.user_link_field !== undefined ? data.user_link_field : (data.userLinkField !== undefined ? data.userLinkField : existing.user_link_field),
      fieldMappings: data.fieldMappings !== undefined ? data.fieldMappings : existing.fieldMappings,
      viewConfiguration: data.viewConfiguration !== undefined ? data.viewConfiguration : existing.viewConfiguration
    };

    // Validar e normalizar dados JSON
    const validatedData = this.validateConnectionData(mergedData);

    const sql = `
      UPDATE database_connections SET
        name = ?, type = ?, host = ?, port = ?, database_name = ?, username = ?,
        password = ?, table_name = ?, status = ?, assigned_users = ?,
        nocodb_token = ?, nocodb_project_id = ?, nocodb_table_id = ?,
        user_link_field = ?, field_mappings = ?, view_configuration = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const values = [
      validatedData.name,
      validatedData.type,
      validatedData.host,
      validatedData.port || 5432,
      validatedData.database || '',
      validatedData.username || '',
      validatedData.password || '',
      validatedData.table_name || validatedData.table || '',
      validatedData.status || 'disconnected',
      this.stringifyJSON(validatedData.assignedUsers || []),
      validatedData.nocodb_token || validatedData.nocodbToken || '',
      validatedData.nocodb_project_id || validatedData.nocodbProjectId || '',
      validatedData.nocodb_table_id || validatedData.nocodbTableId || '',
      validatedData.user_link_field || validatedData.userLinkField || '',
      this.stringifyJSON(validatedData.fieldMappings || []),
      this.stringifyJSON(validatedData.viewConfiguration, null),
      id
    ];
    const { rowCount } = await this.query(sql, values);
    return { id, changes: rowCount, data: validatedData };
  }

  async deleteConnection(id) {
    const sql = 'DELETE FROM database_connections WHERE id = ?';
    const { rowCount } = await this.query(sql, [id]);
    return { id, changes: rowCount };
  }

  async updateConnectionStatus(id, status) {
    const sql = 'UPDATE database_connections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    const { rowCount } = await this.query(sql, [status, id]);
    return { id, status, changes: rowCount };
  }

  async testConnectionAndUpdateStatus(connection) {
    if (!connection.id) return;

    try {
      logger.info('🔍 Testando conexão:', { id: connection.id, name: connection.name, type: connection.type });

      let isConnected = false;

      if (connection.type === 'NOCODB') {
        isConnected = await this.testNocoDBConnection(connection);
      } else if (connection.type === 'SQLITE') {
        isConnected = await this.testSQLiteConnection(connection);
      } else if (connection.type === 'MYSQL' || connection.type === 'POSTGRESQL') {
        isConnected = await this.testDatabaseConnection(connection);
      } else {
        // Para tipos não implementados, assumir conectado
        isConnected = true;
      }

      const newStatus = isConnected ? 'connected' : 'error';
      await this.updateConnectionStatus(connection.id, newStatus);

      logger.info('✅ Status da conexão atualizado:', {
        id: connection.id,
        name: connection.name,
        status: newStatus
      });

    } catch (error) {
      logger.error('❌ Erro ao testar conexão:', error.message);
      await this.updateConnectionStatus(connection.id, 'error');
    }
  }

  async testNocoDBConnection(connection) {
    try {
      const axios = require('axios');
      const testApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
        },
        timeout: 10000,
      });

      // Testar com a API do NocoDB
      await testApi.get(
        `/api/v1/db/data/noco/${connection.nocodb_project_id || connection.database}/${connection.nocodb_table_id || connection.table_name}`,
        {
          params: { limit: 1 },
        }
      );

      return true;
    } catch (error) {
      logger.warn('⚠️ Falha no teste NocoDB:', error.message);
      return false;
    }
  }

  async testSQLiteConnection(connection) {
    try {
      // Para SQLite, verificar se o arquivo existe e está acessível
      const fs = require('fs');
      const path = require('path');

      // Se não há caminho específico ou é o banco principal, verificar se está inicializado
      if (!connection.database || connection.database === 'main' || connection.database === 'wuzapi.db') {
        // Verificar se o banco principal está inicializado e acessível
        if (this.isInitialized && this.db) {
          try {
            // Fazer uma query simples para verificar se está funcionando
            await this.query('SELECT 1 as test');
            return true;
          } catch (error) {
            logger.warn('⚠️ Banco SQLite não está respondendo:', error.message);
            return false;
          }
        }
        return false;
      }

      // Para outros bancos SQLite, verificar se o arquivo existe
      const dbPath = path.resolve(connection.database);
      const exists = fs.existsSync(dbPath);

      if (exists) {
        logger.info('✅ Arquivo SQLite encontrado:', dbPath);
      } else {
        logger.warn('⚠️ Arquivo SQLite não encontrado:', dbPath);
      }

      return exists;
    } catch (error) {
      logger.warn('⚠️ Falha no teste SQLite:', error.message);
      return false;
    }
  }

  async testDatabaseConnection(connection) {
    try {
      // Para MySQL/PostgreSQL, tentar uma conexão básica
      // Nota: Isso requer implementação específica para cada tipo de banco
      // Por enquanto, retornar true para evitar erros
      logger.info('ℹ️ Teste de conexão MySQL/PostgreSQL não implementado, assumindo conectado');
      return true;
    } catch (error) {
      logger.warn('⚠️ Falha no teste de banco de dados:', error.message);
      return false;
    }
  }

  async getUserConnections(userToken) {
    try {
      if (!userToken) {
        logger.warn('⚠️ getUserConnections chamado sem userToken');
        return [];
      }
      logger.info('🔍 Buscando conexões para usuário:', { token: userToken.substring(0, 8) + '...' });

      // Buscar TODAS as conexões primeiro
      const sql = `
        SELECT 
          id, name, type, host, port, database_name as database, username, password, 
          table_name, status, assigned_users, nocodb_token, nocodb_project_id, 
          nocodb_table_id, user_link_field, field_mappings, view_configuration, created_at, updated_at
        FROM database_connections 
        ORDER BY created_at DESC
      `;

      const { rows } = await this.query(sql, []);

      // Filtrar conexões no código JavaScript para melhor controle
      // Buscar pelo token diretamente na lista de assigned_users
      const filteredConnections = rows.map(row => {
        const assignedUsers = this.parseAssignedUsers(row.assigned_users);

        // Verificar se o userToken está na lista de assigned_users
        if (assignedUsers.includes(userToken) || assignedUsers.includes(userToken.toString())) {
          return {
            ...row,
            assignedUsers: assignedUsers,
            fieldMappings: this.parseFieldMappings(row.field_mappings),
            viewConfiguration: this.parseViewConfiguration(row.view_configuration)
          };
        }
        return null;
      }).filter(Boolean); // Remover nulls

      logger.info('✅ Conexões encontradas para usuário:', {
        token: userToken.substring(0, 8) + '...',
        count: filteredConnections.length,
        connections: filteredConnections.map(c => ({ id: c.id, name: c.name }))
      });

      return filteredConnections;

    } catch (error) {
      logger.error('❌ Erro ao buscar conexões do usuário:', error.message);
      return [];
    }
  }

  async close() {
    return new Promise((resolve) => {
      // Marcar como não inicializado para evitar novas queries
      this.isInitialized = false;

      // Limpar timer de limpeza do cache
      if (this.cacheCleanupTimer) {
        clearInterval(this.cacheCleanupTimer);
        this.cacheCleanupTimer = null;
      }

      // Limpar cache de validação
      if (this.userValidationCache) {
        this.userValidationCache.clear();
        this.userValidationCache = null;
      }

      if (this.db && this.db.open) {
        this.db.close((err) => {
          if (err) {
            logger.error('❌ Erro ao fechar conexão SQLite:', err.message);
          } else {
            logger.info('✅ Conexão com o SQLite fechada');
          }
          this.db = null;
          resolve();
        });
      } else {
        this.db = null;
        resolve();
      }
    });
  }

  // Método auxiliar para parsing seguro de JSON
  parseJSON(jsonString, defaultValue = []) {
    if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
      return defaultValue;
    }

    // Se já é um objeto/array, retornar diretamente
    if (typeof jsonString === 'object') {
      return jsonString;
    }

    try {
      const parsed = JSON.parse(jsonString);
      return parsed !== null ? parsed : defaultValue;
    } catch (err) {
      logger.warn('⚠️ Erro ao fazer parse do JSON:', {
        jsonString: jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : ''),
        error: err.message
      });
      return defaultValue;
    }
  }

  // Método auxiliar para serialização segura de JSON
  stringifyJSON(data, defaultValue = '[]') {
    if (data === null || data === undefined) {
      return defaultValue;
    }

    // Se já é uma string, verificar se é JSON válido
    if (typeof data === 'string') {
      try {
        JSON.parse(data);
        return data; // Já é JSON válido
      } catch (err) {
        // Se não é JSON válido, tratar como string simples
        return JSON.stringify(data);
      }
    }

    try {
      return JSON.stringify(data);
    } catch (err) {
      logger.warn('⚠️ Erro ao serializar JSON:', {
        data: typeof data === 'object' ? Object.keys(data) : data,
        error: err.message
      });
      return defaultValue;
    }
  }

  // Método específico para parsing de assigned_users
  parseAssignedUsers(jsonString) {
    const users = this.parseJSON(jsonString, []);

    // Garantir que é sempre um array
    if (!Array.isArray(users)) {
      logger.warn('⚠️ assigned_users não é um array, convertendo:', users);
      return Array.isArray(users) ? users : [users].filter(Boolean);
    }

    // Filtrar e normalizar valores
    return users.filter(user =>
      user !== null &&
      user !== undefined &&
      user !== ''
    ).map(user => {
      // Converter para string se necessário
      if (typeof user === 'number') {
        return user.toString();
      }
      if (typeof user === 'string') {
        return user.trim();
      }
      // Para outros tipos, converter para string
      return String(user);
    }).filter(user => user.length > 0);
  }

  // Método específico para parsing de field_mappings
  parseFieldMappings(jsonString) {
    const mappings = this.parseJSON(jsonString, []);

    // Garantir que é sempre um array
    if (!Array.isArray(mappings)) {
      logger.warn('⚠️ field_mappings não é um array, convertendo:', mappings);
      return [];
    }

    // Validar estrutura dos mappings
    return mappings.filter(mapping =>
      mapping &&
      typeof mapping === 'object' &&
      mapping.columnName &&
      mapping.label
    ).map(mapping => ({
      columnName: mapping.columnName || mapping.field || '',
      label: mapping.label || mapping.mapping || mapping.columnName || '',
      visible: mapping.visible !== undefined ? Boolean(mapping.visible) : true,
      editable: mapping.editable !== undefined ? Boolean(mapping.editable) : true,
      showInCard: mapping.showInCard !== undefined ? Boolean(mapping.showInCard) : false,
      helperText: mapping.helperText || '',
      ...mapping // Preservar outros campos
    }));
  }

  // Método específico para parsing de view_configuration
  parseViewConfiguration(jsonString) {
    const config = this.parseJSON(jsonString, null);

    // Se for null ou undefined, retornar null
    if (!config) {
      return null;
    }

    // Garantir que é um objeto
    if (typeof config !== 'object' || Array.isArray(config)) {
      logger.warn('⚠️ view_configuration não é um objeto válido:', config);
      return null;
    }

    // Validar e normalizar estrutura
    const normalized = {};

    // Validar configuração de calendário
    if (config.calendar) {
      normalized.calendar = {
        enabled: Boolean(config.calendar.enabled),
        dateField: config.calendar.dateField || null
      };
    }

    // Validar configuração de kanban
    if (config.kanban) {
      normalized.kanban = {
        enabled: Boolean(config.kanban.enabled),
        statusField: config.kanban.statusField || null
      };
    }

    // Validar configuração de tema de edição personalizado
    if (config.editTheme) {
      normalized.editTheme = {
        enabled: Boolean(config.editTheme.enabled),
        themeId: config.editTheme.themeId || null,
        options: config.editTheme.options || null
      };
    }

    // Retornar null se não houver configurações válidas
    if (Object.keys(normalized).length === 0) {
      return null;
    }

    return normalized;
  }

  // Método para validar estrutura de dados antes de salvar
  validateConnectionData(data) {
    const validated = { ...data };

    // Validar e normalizar assigned_users
    if (validated.assignedUsers !== undefined) {
      validated.assignedUsers = this.parseAssignedUsers(
        this.stringifyJSON(validated.assignedUsers)
      );
    }

    // Validar e normalizar field_mappings
    if (validated.fieldMappings !== undefined || validated.field_mappings !== undefined) {
      const mappings = validated.fieldMappings || validated.field_mappings;
      validated.fieldMappings = this.parseFieldMappings(
        this.stringifyJSON(mappings)
      );
      // Remover field_mappings se existir (usar apenas fieldMappings)
      delete validated.field_mappings;
    }

    // Validar e normalizar view_configuration
    if (validated.viewConfiguration !== undefined || validated.view_configuration !== undefined) {
      const viewConfig = validated.viewConfiguration || validated.view_configuration;
      validated.viewConfiguration = this.parseViewConfiguration(
        this.stringifyJSON(viewConfig)
      );
      // Remover view_configuration se existir (usar apenas viewConfiguration)
      delete validated.view_configuration;
    }

    return validated;
  }

  // Método para migrar dados JSON existentes (útil para migração de PostgreSQL)
  async migrateExistingJSONData() {
    logger.info('🔄 Iniciando migração de dados JSON existentes...');

    try {
      // Buscar todas as conexões
      const { rows } = await this.query('SELECT * FROM database_connections');

      let migratedCount = 0;

      for (const row of rows) {
        let needsUpdate = false;
        const updates = {};

        // Verificar e corrigir assigned_users
        try {
          const parsedUsers = this.parseAssignedUsers(row.assigned_users);
          const stringifiedUsers = this.stringifyJSON(parsedUsers);
          if (stringifiedUsers !== row.assigned_users) {
            updates.assigned_users = stringifiedUsers;
            needsUpdate = true;
          }
        } catch (err) {
          logger.warn(`⚠️ Erro ao migrar assigned_users para ID ${row.id}:`, err.message);
          updates.assigned_users = '[]';
          needsUpdate = true;
        }

        // Verificar e corrigir field_mappings
        try {
          const parsedMappings = this.parseFieldMappings(row.field_mappings);
          const stringifiedMappings = this.stringifyJSON(parsedMappings);
          if (stringifiedMappings !== row.field_mappings) {
            updates.field_mappings = stringifiedMappings;
            needsUpdate = true;
          }
        } catch (err) {
          logger.warn(`⚠️ Erro ao migrar field_mappings para ID ${row.id}:`, err.message);
          updates.field_mappings = '[]';
          needsUpdate = true;
        }

        // Aplicar atualizações se necessário
        if (needsUpdate) {
          const updateSql = `
            UPDATE database_connections 
            SET assigned_users = ?, field_mappings = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `;
          await this.query(updateSql, [
            updates.assigned_users || row.assigned_users,
            updates.field_mappings || row.field_mappings,
            row.id
          ]);
          migratedCount++;
          logger.info(`✅ Migrado registro ID ${row.id}`);
        }
      }

      logger.info(`🎉 Migração concluída: ${migratedCount} registros atualizados de ${rows.length} total`);
      return { total: rows.length, migrated: migratedCount };

    } catch (error) {
      logger.error('❌ Erro durante migração de dados JSON:', error.message);
      throw error;
    }
  }

  // Métodos otimizados para operações em lote
  async bulkCreateConnections(connections, batchSize = 100) {
    logger.info(`🔄 Iniciando criação em lote de ${connections.length} conexões...`);

    const results = [];
    let processedCount = 0;

    try {
      // Processar em lotes para otimizar performance
      for (let i = 0; i < connections.length; i += batchSize) {
        const batch = connections.slice(i, i + batchSize);

        // Usar transação para o lote
        await this.query('BEGIN TRANSACTION');

        try {
          for (const connectionData of batch) {
            const result = await this.createConnection(connectionData);
            results.push(result);
            processedCount++;
          }

          await this.query('COMMIT');
          logger.info(`✅ Lote processado: ${processedCount}/${connections.length} conexões`);

        } catch (error) {
          await this.query('ROLLBACK');
          logger.error(`❌ Erro no lote ${i}-${i + batchSize}:`, error.message);
          throw error;
        }

        // Limpeza de memória entre lotes
        if (global.gc && i % (batchSize * 5) === 0) {
          global.gc();
        }
      }

      logger.info(`🎉 Criação em lote concluída: ${results.length} conexões criadas`);
      return results;

    } catch (error) {
      logger.error('❌ Erro durante criação em lote:', error.message);
      throw error;
    }
  }

  async bulkDeleteConnections(connectionIds, batchSize = 100) {
    logger.info(`🔄 Iniciando exclusão em lote de ${connectionIds.length} conexões...`);

    let deletedCount = 0;

    try {
      // Processar em lotes para otimizar performance
      for (let i = 0; i < connectionIds.length; i += batchSize) {
        const batch = connectionIds.slice(i, i + batchSize);

        // Usar transação para o lote
        await this.query('BEGIN TRANSACTION');

        try {
          // Usar IN clause para deletar múltiplos registros de uma vez
          const placeholders = batch.map(() => '?').join(',');
          const deleteSql = `DELETE FROM database_connections WHERE id IN (${placeholders})`;

          const { rowCount } = await this.query(deleteSql, batch);
          deletedCount += rowCount;

          await this.query('COMMIT');
          logger.info(`✅ Lote processado: ${deletedCount}/${connectionIds.length} conexões excluídas`);

        } catch (error) {
          await this.query('ROLLBACK');
          logger.error(`❌ Erro no lote ${i}-${i + batchSize}:`, error.message);
          throw error;
        }

        // Limpeza de memória entre lotes
        if (global.gc && i % (batchSize * 5) === 0) {
          global.gc();
        }
      }

      logger.info(`🎉 Exclusão em lote concluída: ${deletedCount} conexões excluídas`);
      return { deletedCount };

    } catch (error) {
      logger.error('❌ Erro durante exclusão em lote:', error.message);
      throw error;
    }
  }

  // Método para otimizar WAL checkpoint manualmente
  async optimizeDatabase() {
    logger.info('🔧 Iniciando otimização do banco de dados...');

    try {
      // Executar WAL checkpoint
      await this.query('PRAGMA wal_checkpoint(TRUNCATE)');
      logger.info('✅ WAL checkpoint executado');

      // Executar VACUUM incremental se necessário
      const { rows: pragmaResult } = await this.query('PRAGMA auto_vacuum');
      if (pragmaResult[0].auto_vacuum === 2) { // INCREMENTAL
        await this.query('PRAGMA incremental_vacuum');
        logger.info('✅ VACUUM incremental executado');
      }

      // Analisar estatísticas das tabelas
      await this.query('ANALYZE');
      logger.info('✅ Análise de estatísticas executada');

      // Forçar limpeza de memória se disponível
      if (global.gc) {
        global.gc();
        logger.info('✅ Garbage collection executado');
      }

      logger.info('🎉 Otimização do banco concluída');

    } catch (error) {
      logger.error('❌ Erro durante otimização:', error.message);
      throw error;
    }
  }

  // Método para buscar dados de tabela para usuários específicos
  async getUserTableData(userToken, connectionId) {
    const startTime = Date.now();

    try {
      logger.info('🔍 Iniciando busca de dados da tabela para usuário:', {
        connectionId,
        token: userToken.substring(0, 8) + '...'
      });

      // Cache de validação de usuário (simples em memória)
      const cacheKey = `user_${userToken.substring(0, 16)}`;
      if (!this.userValidationCache) {
        this.userValidationCache = new Map();
      }

      let userId;
      const cachedUser = this.userValidationCache.get(cacheKey);
      if (cachedUser && (Date.now() - cachedUser.timestamp) < 300000) { // 5 minutos
        userId = cachedUser.userId;
        logger.info('✅ Usuário encontrado no cache:', { userId: userId.substring(0, 8) + '...' });
      } else {
        // 1. Validar usuário e obter ID do usuário via WuzAPI
        userId = await this.validateUserAndGetId(userToken);

        // Armazenar no cache
        this.userValidationCache.set(cacheKey, {
          userId,
          timestamp: Date.now()
        });

        // Limpar cache antigo (manter apenas 100 entradas)
        if (this.userValidationCache.size > 100) {
          const oldestKey = this.userValidationCache.keys().next().value;
          this.userValidationCache.delete(oldestKey);
        }
      }

      // 2. Buscar configuração da conexão
      const connection = await this.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // 3. Validar se o usuário tem acesso à conexão
      if (!this.validateUserConnectionAccess(userId, connection)) {
        throw new Error('Access denied to this connection');
      }

      // 4. Buscar dados baseado no tipo de conexão
      let tableData;
      switch (connection.type) {
        case 'SQLITE':
          tableData = await this.getSQLiteTableData(connection, userToken);
          break;
        case 'NOCODB':
          tableData = await this.getNocoDBTableData(connection, userToken);
          break;
        case 'MYSQL':
        case 'POSTGRESQL':
          tableData = await this.getExternalDBTableData(connection, userToken);
          break;
        default:
          throw new Error(`Tipo de conexão não suportado: ${connection.type}`);
      }

      // 5. Formatar e retornar dados
      const formattedData = this.formatTableData(tableData, connection);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Métricas de performance
      const metrics = {
        connectionId,
        userId: userId.substring(0, 8) + '...',
        connectionType: connection.type,
        recordCount: formattedData.length,
        duration: `${duration}ms`,
        cacheHit: cachedUser ? true : false
      };

      logger.info('✅ Dados da tabela recuperados com sucesso:', metrics);

      // Alertar sobre performance lenta
      if (duration > 5000) {
        logger.warn('⚠️ Consulta lenta detectada:', {
          ...metrics,
          threshold: '5000ms',
          recommendation: 'Considere otimizar a consulta ou adicionar índices'
        });
      }

      return formattedData;

    } catch (error) {
      logger.error('❌ Erro ao buscar dados da tabela:', {
        connectionId,
        token: userToken.substring(0, 8) + '...',
        error: error.message
      });
      throw error;
    }
  }

  // Método para validar usuário via WuzAPI e obter ID
  async validateUserAndGetId(userToken) {
    try {
      const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
      const axios = require('axios');

      // Verificar cache primeiro (TTL de 5 minutos)
      const cacheKey = `user_${userToken}`;
      const now = Date.now();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

      // Garantir que o cache está inicializado como Map
      if (!this.userValidationCache) {
        this.userValidationCache = new Map();
      }

      const cached = this.userValidationCache.get(cacheKey);
      if (cached) {
        const age = now - cached.timestamp;

        if (age < CACHE_TTL) {
          logger.debug('✅ Usuário validado via cache:', {
            userId: cached.userId,
            age: Math.round(age / 1000) + 's'
          });
          return cached.userId;
        } else {
          // Cache expirado, remover
          this.userValidationCache.delete(cacheKey);
          logger.debug('🔄 Cache expirado, re-validando usuário');
        }
      }

      // Validar via WuzAPI
      try {
        const response = await axios.get(`${wuzapiBaseUrl}/session/status`, {
          headers: {
            'token': userToken,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        const userData = response.data?.data || {};
        const userId = userData.id;

        if (!userId) {
          throw new Error('Invalid token: no user ID returned from WuzAPI');
        }

        // Armazenar no cache usando Map
        this.userValidationCache.set(cacheKey, {
          userId: userId,
          timestamp: now
        });

        logger.info('✅ Usuário validado via WuzAPI:', {
          userId,
          token: userToken.substring(0, 8) + '...'
        });

        return userId;

      } catch (wuzapiError) {
        // Verificar se é erro de conexão/timeout (WuzAPI indisponível)
        if (wuzapiError.code === 'ECONNREFUSED' ||
          wuzapiError.code === 'ENOTFOUND' ||
          wuzapiError.code === 'ETIMEDOUT' ||
          wuzapiError.code === 'ECONNABORTED') {

          logger.error('❌ WuzAPI indisponível:', {
            error: wuzapiError.message,
            code: wuzapiError.code
          });

          // Retornar erro 503 (Service Unavailable)
          const error = new Error('Authentication service temporarily unavailable');
          error.status = 503;
          error.code = 'SERVICE_UNAVAILABLE';
          throw error;
        }

        // Erro de autenticação (401/403)
        if (wuzapiError.response?.status === 401 || wuzapiError.response?.status === 403) {
          logger.warn('⚠️ Token inválido ou expirado:', {
            status: wuzapiError.response.status,
            token: userToken.substring(0, 8) + '...'
          });
          throw new Error('Invalid or expired token');
        }

        // Outros erros
        logger.error('❌ Erro na validação via WuzAPI:', {
          error: wuzapiError.message,
          status: wuzapiError.response?.status
        });
        throw new Error(`Authentication failed: ${wuzapiError.message}`);
      }

    } catch (error) {
      // Re-throw erros já tratados
      if (error.status === 503 || error.message === 'Invalid or expired token') {
        throw error;
      }

      // Outros erros
      const authError = new Error(`Authentication failed: ${error.message}`);
      authError.status = 500;
      throw authError;
    }
  }

  // Método para validar acesso do usuário à conexão
  validateUserConnectionAccess(userId, connection) {
    const assignedUsers = connection.assignedUsers || [];

    // Verificar se o userId está na lista de usuários atribuídos
    const hasAccess = assignedUsers.includes(userId) ||
      assignedUsers.includes(userId.toString()) ||
      assignedUsers.includes('admin'); // Admin tem acesso a tudo

    logger.info('🔐 Validação de acesso à conexão:', {
      userId,
      connectionId: connection.id,
      assignedUsers,
      hasAccess
    });

    return hasAccess;
  }

  // Método para buscar dados do SQLite
  async getSQLiteTableData(connection, userToken) {
    try {
      // Validar parâmetros de entrada
      if (!connection || !userToken) {
        throw new Error('Parâmetros de conexão ou token inválidos');
      }

      // Para SQLite, usar a conexão atual ou a tabela especificada
      const tableName = connection.table_name || 'database_connections';

      // Determinar o campo de filtro do usuário baseado na configuração da conexão
      const userLinkField = connection.user_link_field || 'ChatWootToken';

      // Validar nome da tabela para prevenir SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(`Nome de tabela inválido: ${tableName}`);
      }

      // Validar nome do campo para prevenir SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(userLinkField)) {
        throw new Error(`Nome de campo inválido: ${userLinkField}`);
      }

      // Limitar resultados para performance
      const limit = parseInt(process.env.DEFAULT_RECORDS_LIMIT) || 100;
      const maxLimit = parseInt(process.env.MAX_RECORDS_PER_REQUEST) || 1000;
      const finalLimit = Math.min(limit, maxLimit);

      logger.info('🔍 Executando consulta SQLite:', {
        tableName,
        userLinkField,
        userToken: userToken.substring(0, 8) + '...',
        limit: finalLimit
      });

      // Verificar se a tabela existe
      const tableExistsQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `;
      const { rows: tableCheck } = await this.query(tableExistsQuery, [tableName]);

      if (tableCheck.length === 0) {
        throw new Error(`Tabela '${tableName}' não encontrada no banco de dados`);
      }

      // Verificar se o campo existe na tabela
      const columnCheckQuery = `PRAGMA table_info(${tableName})`;
      const { rows: columns } = await this.query(columnCheckQuery, []);
      const columnExists = columns.some(col => col.name === userLinkField);

      if (!columnExists) {
        throw new Error(`Campo '${userLinkField}' não encontrado na tabela '${tableName}'`);
      }

      // Filtrar dados pelo token do usuário logado
      const sql = `SELECT * FROM ${tableName} WHERE ${userLinkField} = ? LIMIT ?`;

      const { rows } = await this.query(sql, [userToken, finalLimit]);

      logger.info('✅ Dados SQLite recuperados para usuário:', {
        tableName,
        userToken: userToken.substring(0, 8) + '...',
        userLinkField,
        recordCount: rows.length,
        limit: finalLimit
      });

      return rows;

    } catch (error) {
      // Tratamento específico de erros SQLite
      if (error.code === 'SQLITE_ERROR') {
        logger.error('❌ Erro de sintaxe SQL:', error.message);
        throw new Error(`Erro na consulta SQL: ${error.message}`);
      } else if (error.code === 'SQLITE_BUSY') {
        logger.error('❌ Banco de dados ocupado:', error.message);
        throw new Error('Banco de dados temporariamente indisponível, tente novamente');
      } else if (error.code === 'SQLITE_CORRUPT') {
        logger.error('❌ Banco de dados corrompido:', error.message);
        throw new Error('Erro interno do banco de dados');
      } else {
        logger.error('❌ Erro ao buscar dados SQLite:', {
          message: error.message,
          code: error.code,
          tableName: connection.table_name,
          userLinkField: connection.user_link_field
        });
        throw new Error(`Falha ao recuperar dados: ${error.message}`);
      }
    }
  }

  // Método para buscar dados do NocoDB
  async getNocoDBTableData(connection, userToken) {
    try {
      // Validar parâmetros de entrada
      if (!connection || !userToken) {
        throw new Error('Parâmetros de conexão ou token inválidos');
      }

      // Validar configurações obrigatórias do NocoDB
      if (!connection.host) {
        throw new Error('URL base do NocoDB não configurada');
      }

      if (!connection.nocodb_token && !connection.password) {
        throw new Error('Token de autenticação do NocoDB não configurado');
      }

      const axios = require('axios');

      const projectId = connection.nocodb_project_id || connection.database;
      const tableId = connection.nocodb_table_id || connection.table_name;
      const userLinkField = connection.user_link_field || 'ChatWootToken';

      // Validar IDs obrigatórios
      if (!projectId) {
        throw new Error('ID do projeto NocoDB não configurado');
      }

      if (!tableId) {
        throw new Error('ID da tabela NocoDB não configurado');
      }

      // Configurar limites
      const limit = parseInt(process.env.DEFAULT_RECORDS_LIMIT) || 100;
      const maxLimit = parseInt(process.env.MAX_RECORDS_PER_REQUEST) || 1000;
      const finalLimit = Math.min(limit, maxLimit);

      logger.info('🔍 Executando consulta NocoDB:', {
        host: connection.host,
        projectId,
        tableId,
        userLinkField,
        userToken: userToken.substring(0, 8) + '...',
        limit: finalLimit
      });

      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.NOCODB_TIMEOUT) || 15000,
      });

      // Testar conectividade primeiro
      try {
        await nocoApi.get('/api/v1/db/meta/projects');
      } catch (testError) {
        if (testError.response?.status === 401) {
          throw new Error('Token de autenticação NocoDB inválido ou expirado');
        } else if (testError.code === 'ECONNREFUSED') {
          throw new Error('Não foi possível conectar ao servidor NocoDB');
        } else if (testError.code === 'ETIMEDOUT') {
          throw new Error('Timeout na conexão com NocoDB');
        }
        throw new Error(`Falha na conectividade NocoDB: ${testError.message}`);
      }

      // Filtrar dados pelo token do usuário logado usando query parameters do NocoDB
      const response = await nocoApi.get(
        `/api/v1/db/data/noco/${projectId}/${tableId}`,
        {
          params: {
            limit: finalLimit,
            where: `(${userLinkField},eq,${userToken})`
          },
        }
      );

      const data = response.data?.list || response.data || [];

      // Validar estrutura da resposta
      if (!Array.isArray(data)) {
        logger.warn('⚠️ Resposta NocoDB não é um array:', typeof data);
        throw new Error('Formato de resposta inválido do NocoDB');
      }

      logger.info('✅ Dados NocoDB recuperados para usuário:', {
        projectId,
        tableId,
        userToken: userToken.substring(0, 8) + '...',
        userLinkField,
        recordCount: data.length,
        limit: finalLimit
      });

      return data;

    } catch (error) {
      // Tratamento específico de erros NocoDB
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;

        if (status === 401) {
          logger.error('❌ Erro de autenticação NocoDB:', error.message);
          throw new Error('Token de autenticação NocoDB inválido');
        } else if (status === 403) {
          logger.error('❌ Erro de permissão NocoDB:', error.message);
          throw new Error('Sem permissão para acessar os dados no NocoDB');
        } else if (status === 404) {
          logger.error('❌ Recurso não encontrado no NocoDB:', error.message);
          throw new Error('Projeto ou tabela não encontrados no NocoDB');
        } else if (status >= 500) {
          logger.error('❌ Erro interno do servidor NocoDB:', error.message);
          throw new Error('Erro interno do servidor NocoDB');
        } else {
          logger.error('❌ Erro HTTP NocoDB:', { status, statusText, message: error.message });
          throw new Error(`Erro na API NocoDB (${status}): ${statusText}`);
        }
      } else if (error.code === 'ECONNREFUSED') {
        logger.error('❌ Conexão recusada pelo NocoDB:', error.message);
        throw new Error('Servidor NocoDB indisponível');
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('❌ Timeout na conexão NocoDB:', error.message);
        throw new Error('Timeout na conexão com NocoDB');
      } else {
        logger.error('❌ Erro ao buscar dados NocoDB:', {
          message: error.message,
          code: error.code,
          projectId: connection.nocodb_project_id,
          tableId: connection.nocodb_table_id
        });
        throw new Error(`Falha na API NocoDB: ${error.message}`);
      }
    }
  }

  // Método para buscar dados de bancos externos (MySQL/PostgreSQL)
  async getExternalDBTableData(connection, userToken) {
    try {
      // Validar parâmetros de entrada
      if (!connection || !userToken) {
        throw new Error('Parâmetros de conexão ou token inválidos');
      }

      // Validar configurações obrigatórias
      if (!connection.host) {
        throw new Error(`Host do ${connection.type} não configurado`);
      }

      if (!connection.username) {
        throw new Error(`Usuário do ${connection.type} não configurado`);
      }

      if (!connection.password) {
        throw new Error(`Senha do ${connection.type} não configurada`);
      }

      if (!connection.database) {
        throw new Error(`Nome do banco ${connection.type} não configurado`);
      }

      const tableName = connection.table_name;
      const userLinkField = connection.user_link_field || 'user_token';

      if (!tableName) {
        throw new Error(`Nome da tabela ${connection.type} não configurado`);
      }

      // Configurar limites
      const limit = parseInt(process.env.DEFAULT_RECORDS_LIMIT) || 100;
      const maxLimit = parseInt(process.env.MAX_RECORDS_PER_REQUEST) || 1000;
      const finalLimit = Math.min(limit, maxLimit);

      logger.info('🔍 Preparando consulta para banco externo:', {
        type: connection.type,
        host: connection.host,
        database: connection.database,
        tableName,
        userLinkField,
        userToken: userToken.substring(0, 8) + '...',
        limit: finalLimit
      });

      // TODO: Implementar conexões reais para MySQL/PostgreSQL
      // Por enquanto, simular dados mais realistas baseados na configuração
      logger.warn(`⚠️ Conexão ${connection.type} ainda não implementada, simulando dados baseados na configuração`);

      // Simular estrutura de dados baseada na configuração real
      const simulatedData = [
        {
          id: 1,
          [userLinkField]: userToken,
          database_type: connection.type,
          host: connection.host,
          database: connection.database,
          table: tableName,
          message: `Dados simulados de ${connection.type}`,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          [userLinkField]: userToken,
          database_type: connection.type,
          host: connection.host,
          database: connection.database,
          table: tableName,
          message: `Implementação ${connection.type} em desenvolvimento`,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      logger.info('✅ Dados simulados gerados para banco externo:', {
        type: connection.type,
        userToken: userToken.substring(0, 8) + '...',
        recordCount: simulatedData.length,
        tableName,
        userLinkField
      });

      return simulatedData;

      /* TODO: Implementação real para MySQL/PostgreSQL
      
      // Para MySQL
      if (connection.type === 'MYSQL') {
        const mysql = require('mysql2/promise');
        
        const pool = mysql.createPool({
          host: connection.host,
          port: connection.port || 3306,
          user: connection.username,
          password: connection.password,
          database: connection.database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          timeout: 60000
        });

        const sql = `SELECT * FROM ?? WHERE ?? = ? LIMIT ?`;
        const [rows] = await pool.execute(sql, [tableName, userLinkField, userToken, finalLimit]);
        
        await pool.end();
        return rows;
      }

      // Para PostgreSQL
      if (connection.type === 'POSTGRESQL') {
        const { Pool } = require('pg');
        
        const pool = new Pool({
          host: connection.host,
          port: connection.port || 5432,
          user: connection.username,
          password: connection.password,
          database: connection.database,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        const sql = `SELECT * FROM $1 WHERE $2 = $3 LIMIT $4`;
        const result = await pool.query(sql, [tableName, userLinkField, userToken, finalLimit]);
        
        await pool.end();
        return result.rows;
      }
      */

    } catch (error) {
      // Tratamento específico de erros de banco externo
      if (error.code === 'ECONNREFUSED') {
        logger.error('❌ Conexão recusada pelo banco externo:', error.message);
        throw new Error(`Servidor ${connection.type} indisponível`);
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('❌ Timeout na conexão com banco externo:', error.message);
        throw new Error(`Timeout na conexão com ${connection.type}`);
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === '28P01') {
        logger.error('❌ Erro de autenticação no banco externo:', error.message);
        throw new Error(`Credenciais inválidas para ${connection.type}`);
      } else if (error.code === 'ER_BAD_DB_ERROR' || error.code === '3D000') {
        logger.error('❌ Banco de dados não encontrado:', error.message);
        throw new Error(`Banco de dados '${connection.database}' não encontrado`);
      } else {
        logger.error('❌ Erro ao buscar dados de banco externo:', {
          message: error.message,
          code: error.code,
          type: connection.type,
          host: connection.host,
          database: connection.database
        });
        throw new Error(`Falha na conexão ${connection.type}: ${error.message}`);
      }
    }
  }

  // ==================== MÉTODOS PARA BUSCAR REGISTRO ÚNICO DO USUÁRIO ====================

  // Método para buscar registro único do usuário no NocoDB
  async fetchNocoDBUserRecord(connection, userLinkField, userToken) {
    try {
      // Validar parâmetros de entrada
      if (!connection || !userLinkField || !userToken) {
        throw new Error('Parâmetros inválidos para busca de registro NocoDB');
      }

      // Validar configurações obrigatórias do NocoDB
      if (!connection.host) {
        throw new Error('URL base do NocoDB não configurada');
      }

      if (!connection.nocodb_token && !connection.password) {
        throw new Error('Token de autenticação do NocoDB não configurado');
      }

      const axios = require('axios');

      const projectId = connection.nocodb_project_id || connection.database;
      const tableId = connection.nocodb_table_id || connection.table_name;

      // Validar IDs obrigatórios
      if (!projectId) {
        throw new Error('ID do projeto NocoDB não configurado');
      }

      if (!tableId) {
        throw new Error('ID da tabela NocoDB não configurado');
      }

      logger.info('🔍 Buscando registro único no NocoDB:', {
        host: connection.host,
        projectId,
        tableId,
        userLinkField,
        userToken: userToken.substring(0, 8) + '...'
      });

      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.NOCODB_TIMEOUT) || 15000,
      });

      // Buscar registro único filtrado pelo token do usuário
      const response = await nocoApi.get(
        `/api/v1/db/data/noco/${projectId}/${tableId}`,
        {
          params: {
            limit: 1,
            where: `(${userLinkField},eq,${userToken})`
          },
        }
      );

      const data = response.data?.list || response.data || [];

      // Validar estrutura da resposta
      if (!Array.isArray(data)) {
        logger.warn('⚠️ Resposta NocoDB não é um array:', typeof data);
        throw new Error('Formato de resposta inválido do NocoDB');
      }

      const record = data.length > 0 ? data[0] : null;

      if (record) {
        logger.info('✅ Registro único encontrado no NocoDB:', {
          projectId,
          tableId,
          userToken: userToken.substring(0, 8) + '...',
          userLinkField,
          recordId: record.id || record.Id
        });
      } else {
        logger.info('ℹ️ Nenhum registro encontrado no NocoDB para o usuário:', {
          projectId,
          tableId,
          userToken: userToken.substring(0, 8) + '...',
          userLinkField
        });
      }

      return record;

    } catch (error) {
      // Tratamento específico de erros NocoDB
      if (error.response) {
        const status = error.response.status;

        if (status === 401) {
          logger.error('❌ Erro de autenticação NocoDB:', error.message);
          throw new Error('Token de autenticação NocoDB inválido');
        } else if (status === 403) {
          logger.error('❌ Erro de permissão NocoDB:', error.message);
          throw new Error('Sem permissão para acessar os dados no NocoDB');
        } else if (status === 404) {
          logger.error('❌ Recurso não encontrado no NocoDB:', error.message);
          throw new Error('Projeto ou tabela não encontrada no NocoDB');
        }
      }

      logger.error('❌ Erro ao buscar registro único no NocoDB:', {
        message: error.message,
        host: connection.host,
        projectId: connection.nocodb_project_id,
        tableId: connection.nocodb_table_id
      });
      throw error;
    }
  }

  // Método para buscar registro único do usuário no SQLite
  async fetchSQLiteUserRecord(connection, userLinkField, userToken) {
    try {
      // Validar parâmetros de entrada
      if (!connection || !userLinkField || !userToken) {
        throw new Error('Parâmetros inválidos para busca de registro SQLite');
      }

      const tableName = connection.table_name || 'database_connections';

      // Validar nome da tabela para prevenir SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(`Nome de tabela inválido: ${tableName}`);
      }

      // Validar nome do campo para prevenir SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(userLinkField)) {
        throw new Error(`Nome de campo inválido: ${userLinkField}`);
      }

      logger.info('🔍 Buscando registro único no SQLite:', {
        tableName,
        userLinkField,
        userToken: userToken.substring(0, 8) + '...'
      });

      // Verificar se a tabela existe
      const tableExistsQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `;
      const { rows: tableCheck } = await this.query(tableExistsQuery, [tableName]);

      if (tableCheck.length === 0) {
        throw new Error(`Tabela '${tableName}' não encontrada no banco de dados`);
      }

      // Verificar se o campo existe na tabela
      const columnCheckQuery = `PRAGMA table_info(${tableName})`;
      const { rows: columns } = await this.query(columnCheckQuery, []);
      const columnExists = columns.some(col => col.name === userLinkField);

      if (!columnExists) {
        throw new Error(`Campo '${userLinkField}' não encontrado na tabela '${tableName}'`);
      }

      // Buscar registro único pelo token do usuário
      const sql = `SELECT * FROM ${tableName} WHERE ${userLinkField} = ? LIMIT 1`;

      const { rows } = await this.query(sql, [userToken]);

      const record = rows.length > 0 ? rows[0] : null;

      if (record) {
        logger.info('✅ Registro único encontrado no SQLite:', {
          tableName,
          userToken: userToken.substring(0, 8) + '...',
          userLinkField,
          recordId: record.id
        });
      } else {
        logger.info('ℹ️ Nenhum registro encontrado no SQLite para o usuário:', {
          tableName,
          userToken: userToken.substring(0, 8) + '...',
          userLinkField
        });
      }

      return record;

    } catch (error) {
      // Tratamento específico de erros SQLite
      if (error.code === 'SQLITE_ERROR') {
        logger.error('❌ Erro de sintaxe SQL:', error.message);
        throw new Error(`Erro na consulta SQL: ${error.message}`);
      } else if (error.code === 'SQLITE_BUSY') {
        logger.error('❌ Banco de dados ocupado:', error.message);
        throw new Error('Banco de dados temporariamente indisponível, tente novamente');
      } else if (error.code === 'SQLITE_CORRUPT') {
        logger.error('❌ Banco de dados corrompido:', error.message);
        throw new Error('Erro interno do banco de dados');
      } else {
        logger.error('❌ Erro ao buscar registro único no SQLite:', {
          message: error.message,
          code: error.code,
          tableName: connection.table_name,
          userLinkField
        });
        throw error;
      }
    }
  }

  // Método para buscar registro único do usuário em bancos SQL (MySQL/PostgreSQL)
  async fetchSQLUserRecord(connection, userLinkField, userToken) {
    try {
      // Validar parâmetros de entrada
      if (!connection || !userLinkField || !userToken) {
        throw new Error('Parâmetros inválidos para busca de registro SQL');
      }

      // Validar configurações obrigatórias
      if (!connection.host) {
        throw new Error(`Host do ${connection.type} não configurado`);
      }

      if (!connection.username) {
        throw new Error(`Usuário do ${connection.type} não configurado`);
      }

      if (!connection.password) {
        throw new Error(`Senha do ${connection.type} não configurada`);
      }

      if (!connection.database) {
        throw new Error(`Nome do banco ${connection.type} não configurado`);
      }

      const tableName = connection.table_name;

      if (!tableName) {
        throw new Error(`Nome da tabela ${connection.type} não configurado`);
      }

      logger.info('🔍 Buscando registro único em banco SQL:', {
        type: connection.type,
        host: connection.host,
        database: connection.database,
        tableName,
        userLinkField,
        userToken: userToken.substring(0, 8) + '...'
      });

      // TODO: Implementar conexões reais para MySQL/PostgreSQL
      // Por enquanto, simular um registro único
      logger.warn(`⚠️ Conexão ${connection.type} ainda não implementada, simulando registro único`);

      // Simular registro único baseado na configuração real
      const simulatedRecord = {
        id: 1,
        [userLinkField]: userToken,
        database_type: connection.type,
        host: connection.host,
        database: connection.database,
        table: tableName,
        message: `Registro único simulado de ${connection.type}`,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      logger.info('✅ Registro único simulado gerado para banco SQL:', {
        type: connection.type,
        userToken: userToken.substring(0, 8) + '...',
        tableName,
        userLinkField
      });

      return simulatedRecord;

      /* TODO: Implementação real para MySQL/PostgreSQL
      
      // Para MySQL
      if (connection.type === 'MYSQL') {
        const mysql = require('mysql2/promise');
        
        const pool = mysql.createPool({
          host: connection.host,
          port: connection.port || 3306,
          user: connection.username,
          password: connection.password,
          database: connection.database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          timeout: 60000
        });

        const sql = `SELECT * FROM ?? WHERE ?? = ? LIMIT 1`;
        const [rows] = await pool.execute(sql, [tableName, userLinkField, userToken]);
        
        await pool.end();
        return rows.length > 0 ? rows[0] : null;
      }

      // Para PostgreSQL
      if (connection.type === 'POSTGRESQL' || connection.type === 'POSTGRES') {
        const { Pool } = require('pg');
        
        const pool = new Pool({
          host: connection.host,
          port: connection.port || 5432,
          user: connection.username,
          password: connection.password,
          database: connection.database,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        const sql = `SELECT * FROM $1 WHERE $2 = $3 LIMIT 1`;
        const result = await pool.query(sql, [tableName, userLinkField, userToken]);
        
        await pool.end();
        return result.rows.length > 0 ? result.rows[0] : null;
      }
      */

    } catch (error) {
      // Tratamento específico de erros de banco externo
      if (error.code === 'ECONNREFUSED') {
        logger.error('❌ Conexão recusada pelo banco externo:', error.message);
        throw new Error(`Servidor ${connection.type} indisponível`);
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('❌ Timeout na conexão com banco externo:', error.message);
        throw new Error(`Timeout na conexão com ${connection.type}`);
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === '28P01') {
        logger.error('❌ Erro de autenticação no banco externo:', error.message);
        throw new Error(`Credenciais inválidas para ${connection.type}`);
      } else if (error.code === 'ER_BAD_DB_ERROR' || error.code === '3D000') {
        logger.error('❌ Banco de dados não encontrado:', error.message);
        throw new Error(`Banco de dados '${connection.database}' não encontrado`);
      } else {
        logger.error('❌ Erro ao buscar registro único em banco SQL:', {
          message: error.message,
          code: error.code,
          type: connection.type,
          host: connection.host,
          database: connection.database
        });
        throw error;
      }
    }
  }

  // ==================== FIM DOS MÉTODOS PARA BUSCAR REGISTRO ÚNICO ====================

  // Método para formatar dados de tabela
  formatTableData(rawData, connection) {
    try {
      if (!Array.isArray(rawData)) {
        logger.warn('⚠️ Dados não são um array, convertendo:', typeof rawData);
        rawData = [rawData];
      }

      // Aplicar formatação consistente
      const formattedData = rawData.map(row => {
        if (typeof row !== 'object' || row === null) {
          return { value: row };
        }

        // Converter valores null/undefined para strings vazias se necessário
        const formattedRow = {};
        for (const [key, value] of Object.entries(row)) {
          formattedRow[key] = value === null || value === undefined ? '' : value;
        }

        return formattedRow;
      });

      logger.info('✅ Dados formatados:', {
        originalCount: rawData.length,
        formattedCount: formattedData.length,
        connectionType: connection.type
      });

      return formattedData;

    } catch (error) {
      logger.error('❌ Erro ao formatar dados:', error.message);
      return rawData; // Retornar dados originais em caso de erro
    }
  }

  // Método para limpar cache de validação de usuários
  clearUserValidationCache() {
    if (this.userValidationCache) {
      const now = Date.now();
      const expiredKeys = [];

      for (const [key, value] of this.userValidationCache.entries()) {
        if (now - value.timestamp > 300000) { // 5 minutos
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach(key => this.userValidationCache.delete(key));

      if (expiredKeys.length > 0) {
        logger.info('🧹 Cache de validação limpo:', {
          removedEntries: expiredKeys.length,
          remainingEntries: this.userValidationCache.size
        });
      }
    }
  }

  // ==================== MÉTODOS PARA CONFIGURAÇÃO DE BRANDING ====================

  async getBrandingConfig() {
    try {
      const sql = `
        SELECT id, app_name, logo_url, primary_color, secondary_color, custom_home_html, support_phone, og_image_url, created_at, updated_at
        FROM branding_config 
        ORDER BY id DESC 
        LIMIT 1
      `;
      const { rows } = await this.query(sql);

      if (rows.length > 0) {
        const config = rows[0];
        logger.info('✅ Configuração de branding recuperada do banco:', {
          id: config.id,
          appName: config.app_name,
          has_custom_html: !!config.custom_home_html,
          custom_html_length: config.custom_home_html ? config.custom_home_html.length : 0,
          custom_html_preview: config.custom_home_html ? config.custom_home_html.substring(0, 100) + '...' : null,
          supportPhone: config.support_phone,
          ogImageUrl: config.og_image_url
        });
        return {
          id: config.id,
          appName: config.app_name,
          logoUrl: config.logo_url,
          primaryColor: config.primary_color,
          secondaryColor: config.secondary_color,
          customHomeHtml: config.custom_home_html,
          supportPhone: config.support_phone,
          ogImageUrl: config.og_image_url,
          createdAt: config.created_at,
          updatedAt: config.updated_at
        };
      } else {
        // Retornar configuração padrão se não existir
        logger.info('ℹ️ Nenhuma configuração de branding encontrada, retornando padrão');
        return {
          id: null,
          appName: 'WUZAPI',
          logoUrl: null,
          primaryColor: null,
          secondaryColor: null,
          customHomeHtml: null,
          supportPhone: null,
          ogImageUrl: null,
          createdAt: null,
          updatedAt: null
        };
      }
    } catch (error) {
      logger.error('❌ Erro ao buscar configuração de branding:', {
        error_message: error.message,
        error_stack: error.stack
      });
      throw error;
    }
  }

  async updateBrandingConfig(configData) {
    try {
      logger.info('📥 updateBrandingConfig() chamado com dados:', {
        has_app_name: !!configData.appName,
        has_logo_url: !!configData.logoUrl,
        has_primary_color: !!configData.primaryColor,
        has_secondary_color: !!configData.secondaryColor,
        has_custom_html: !!configData.customHomeHtml,
        custom_html_length: configData.customHomeHtml ? configData.customHomeHtml.length : 0,
        custom_html_preview: configData.customHomeHtml ? configData.customHomeHtml.substring(0, 100) + '...' : null,
        has_support_phone: configData.supportPhone !== undefined,
        support_phone: configData.supportPhone
      });

      // Buscar configuração existente para fazer merge
      const existingConfig = await this.getBrandingConfig();
      
      // Fazer merge dos dados existentes com os novos dados (apenas sobrescrever se o valor foi explicitamente fornecido)
      const mergedData = {
        appName: configData.appName !== undefined ? configData.appName : existingConfig.appName,
        logoUrl: configData.logoUrl !== undefined ? configData.logoUrl : existingConfig.logoUrl,
        primaryColor: configData.primaryColor !== undefined ? configData.primaryColor : existingConfig.primaryColor,
        secondaryColor: configData.secondaryColor !== undefined ? configData.secondaryColor : existingConfig.secondaryColor,
        customHomeHtml: configData.customHomeHtml !== undefined ? configData.customHomeHtml : existingConfig.customHomeHtml,
        supportPhone: configData.supportPhone !== undefined ? configData.supportPhone : existingConfig.supportPhone,
        ogImageUrl: configData.ogImageUrl !== undefined ? configData.ogImageUrl : existingConfig.ogImageUrl
      };

      // Validar dados de entrada
      const validatedData = this.validateBrandingData(mergedData);

      logger.info('✅ Dados validados com sucesso:', {
        app_name: validatedData.appName,
        has_logo_url: !!validatedData.logoUrl,
        has_primary_color: !!validatedData.primaryColor,
        has_secondary_color: !!validatedData.secondaryColor,
        has_custom_html: !!validatedData.customHomeHtml,
        custom_html_length: validatedData.customHomeHtml ? validatedData.customHomeHtml.length : 0,
        support_phone: validatedData.supportPhone
      });

      if (existingConfig.id) {
        // Atualizar configuração existente
        const sql = `
          UPDATE branding_config SET
            app_name = ?, logo_url = ?, primary_color = ?, secondary_color = ?, custom_home_html = ?, support_phone = ?, og_image_url = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        const values = [
          validatedData.appName,
          validatedData.logoUrl,
          validatedData.primaryColor,
          validatedData.secondaryColor,
          validatedData.customHomeHtml,
          validatedData.supportPhone,
          validatedData.ogImageUrl,
          existingConfig.id
        ];

        logger.info('🔄 Executando UPDATE na tabela branding_config:', {
          id: existingConfig.id,
          app_name: validatedData.appName,
          logo_url: validatedData.logoUrl,
          logo_url_is_null: validatedData.logoUrl === null,
          primary_color: validatedData.primaryColor,
          primary_color_is_null: validatedData.primaryColor === null,
          secondary_color: validatedData.secondaryColor,
          secondary_color_is_null: validatedData.secondaryColor === null,
          custom_home_html_length: validatedData.customHomeHtml ? validatedData.customHomeHtml.length : 0,
          custom_home_html_is_null: validatedData.customHomeHtml === null,
          support_phone: validatedData.supportPhone,
          support_phone_is_null: validatedData.supportPhone === null
        });

        logger.info('📝 Valores SQL para UPDATE:', {
          values: [
            validatedData.appName,
            validatedData.logoUrl === null ? 'NULL' : validatedData.logoUrl,
            validatedData.primaryColor === null ? 'NULL' : validatedData.primaryColor,
            validatedData.secondaryColor === null ? 'NULL' : validatedData.secondaryColor,
            validatedData.customHomeHtml === null ? 'NULL' : `HTML (${validatedData.customHomeHtml.length} chars)`,
            validatedData.supportPhone === null ? 'NULL' : validatedData.supportPhone,
            existingConfig.id
          ]
        });

        const { rowCount } = await this.query(sql, values);

        if (rowCount > 0) {
          logger.info('✅ Configuração de branding atualizada no banco:', {
            id: existingConfig.id,
            appName: validatedData.appName,
            rows_affected: rowCount,
            custom_html_saved: !!validatedData.customHomeHtml
          });

          // Retornar configuração atualizada
          const updatedConfig = await this.getBrandingConfig();

          logger.info('📤 Configuração atualizada recuperada do banco:', {
            id: updatedConfig.id,
            has_custom_html: !!updatedConfig.customHomeHtml,
            custom_html_length: updatedConfig.customHomeHtml ? updatedConfig.customHomeHtml.length : 0
          });

          return updatedConfig;
        } else {
          throw new Error('Falha ao atualizar configuração de branding');
        }
      } else {
        // Criar nova configuração
        const sql = `
          INSERT INTO branding_config (app_name, logo_url, primary_color, secondary_color, custom_home_html, support_phone, og_image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
          validatedData.appName,
          validatedData.logoUrl,
          validatedData.primaryColor,
          validatedData.secondaryColor,
          validatedData.customHomeHtml,
          validatedData.supportPhone,
          validatedData.ogImageUrl
        ];

        logger.info('➕ Executando INSERT na tabela branding_config:', {
          app_name: validatedData.appName,
          logo_url: validatedData.logoUrl,
          logo_url_is_null: validatedData.logoUrl === null,
          primary_color: validatedData.primaryColor,
          primary_color_is_null: validatedData.primaryColor === null,
          secondary_color: validatedData.secondaryColor,
          secondary_color_is_null: validatedData.secondaryColor === null,
          custom_home_html_length: validatedData.customHomeHtml ? validatedData.customHomeHtml.length : 0,
          custom_home_html_is_null: validatedData.customHomeHtml === null,
          support_phone: validatedData.supportPhone,
          support_phone_is_null: validatedData.supportPhone === null
        });

        logger.info('📝 Valores SQL para INSERT:', {
          values: [
            validatedData.appName,
            validatedData.logoUrl === null ? 'NULL' : validatedData.logoUrl,
            validatedData.primaryColor === null ? 'NULL' : validatedData.primaryColor,
            validatedData.secondaryColor === null ? 'NULL' : validatedData.secondaryColor,
            validatedData.customHomeHtml === null ? 'NULL' : `HTML (${validatedData.customHomeHtml.length} chars)`,
            validatedData.supportPhone === null ? 'NULL' : validatedData.supportPhone
          ]
        });

        const result = await this.query(sql, values);

        logger.info('✅ Nova configuração de branding criada no banco:', {
          id: result.lastID,
          appName: validatedData.appName,
          custom_html_saved: !!validatedData.customHomeHtml
        });

        // Retornar configuração criada
        const newConfig = await this.getBrandingConfig();

        logger.info('📤 Nova configuração recuperada do banco:', {
          id: newConfig.id,
          has_custom_html: !!newConfig.customHomeHtml,
          custom_html_length: newConfig.customHomeHtml ? newConfig.customHomeHtml.length : 0
        });

        return newConfig;
      }
    } catch (error) {
      logger.error('❌ Erro ao atualizar configuração de branding:', {
        error_message: error.message,
        error_stack: error.stack
      });
      throw error;
    }
  }

  validateBrandingData(data) {
    const validated = {};

    // Validar app_name
    if (data.appName !== undefined) {
      if (typeof data.appName !== 'string') {
        throw new Error('Nome da aplicação deve ser uma string');
      }
      if (data.appName.length < 1 || data.appName.length > 50) {
        throw new Error('Nome da aplicação deve ter entre 1 e 50 caracteres');
      }
      // Permitir apenas caracteres alfanuméricos, espaços e alguns símbolos
      if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(data.appName)) {
        throw new Error('Nome da aplicação contém caracteres inválidos');
      }
      validated.appName = data.appName.trim();
    } else {
      validated.appName = 'WUZAPI'; // Valor padrão
    }

    // Validar logo_url
    if (data.logoUrl !== undefined && data.logoUrl !== null && data.logoUrl !== '') {
      if (typeof data.logoUrl !== 'string') {
        throw new Error('URL do logo deve ser uma string');
      }
      // Validação básica de URL
      try {
        new URL(data.logoUrl);
        validated.logoUrl = data.logoUrl.trim();
        logger.info('✅ URL do logo validada:', {
          original: data.logoUrl,
          validated: validated.logoUrl
        });
      } catch (error) {
        throw new Error('URL do logo é inválida');
      }
    } else {
      validated.logoUrl = null;
      logger.info('ℹ️ URL do logo não fornecida ou vazia - será definida como NULL', {
        value: data.logoUrl,
        type: typeof data.logoUrl
      });
    }

    // Validar primary_color
    if (data.primaryColor !== undefined && data.primaryColor !== null && data.primaryColor !== '') {
      if (typeof data.primaryColor !== 'string') {
        throw new Error('Cor primária deve ser uma string');
      }
      // Validar formato hex color
      if (!/^#[0-9A-Fa-f]{6}$/.test(data.primaryColor)) {
        throw new Error('Cor primária deve estar no formato #RRGGBB');
      }
      validated.primaryColor = data.primaryColor.toUpperCase();
      logger.info('✅ Cor primária validada:', {
        original: data.primaryColor,
        validated: validated.primaryColor
      });
    } else {
      validated.primaryColor = null;
      logger.info('ℹ️ Cor primária não fornecida ou vazia - será definida como NULL', {
        value: data.primaryColor,
        type: typeof data.primaryColor
      });
    }

    // Validar secondary_color
    if (data.secondaryColor !== undefined && data.secondaryColor !== null && data.secondaryColor !== '') {
      if (typeof data.secondaryColor !== 'string') {
        throw new Error('Cor secundária deve ser uma string');
      }
      // Validar formato hex color
      if (!/^#[0-9A-Fa-f]{6}$/.test(data.secondaryColor)) {
        throw new Error('Cor secundária deve estar no formato #RRGGBB');
      }
      validated.secondaryColor = data.secondaryColor.toUpperCase();
      logger.info('✅ Cor secundária validada:', {
        original: data.secondaryColor,
        validated: validated.secondaryColor
      });
    } else {
      validated.secondaryColor = null;
      logger.info('ℹ️ Cor secundária não fornecida ou vazia - será definida como NULL', {
        value: data.secondaryColor,
        type: typeof data.secondaryColor
      });
    }

    // Validar custom_home_html
    if (data.customHomeHtml !== undefined && data.customHomeHtml !== null && data.customHomeHtml !== '') {
      if (typeof data.customHomeHtml !== 'string') {
        logger.error('❌ Validação falhou: HTML customizado não é uma string', {
          type: typeof data.customHomeHtml
        });
        throw new Error('HTML customizado deve ser uma string');
      }
      // Validar tamanho máximo (100KB = 100000 bytes)
      if (data.customHomeHtml.length > 100000) {
        logger.error('❌ Validação falhou: HTML customizado excede tamanho máximo', {
          length: data.customHomeHtml.length,
          max_length: 100000
        });
        throw new Error('HTML customizado excede o tamanho máximo de 100KB');
      }
      logger.info('✅ HTML customizado validado:', {
        length: data.customHomeHtml.length,
        preview: data.customHomeHtml.substring(0, 100) + '...'
      });
      validated.customHomeHtml = data.customHomeHtml;
    } else {
      logger.info('ℹ️ HTML customizado não fornecido ou vazio - será definido como null', {
        value: data.customHomeHtml
      });
      validated.customHomeHtml = null;
    }

    // Validar support_phone
    if (data.supportPhone !== undefined && data.supportPhone !== null && data.supportPhone !== '') {
      if (typeof data.supportPhone !== 'string') {
        logger.error('❌ Validação falhou: Telefone de suporte não é uma string', {
          type: typeof data.supportPhone
        });
        throw new Error('Telefone de suporte deve ser uma string');
      }
      // Remover caracteres não numéricos para validação
      const digitsOnly = data.supportPhone.replace(/\D/g, '');
      // Validar: apenas dígitos, 10-15 caracteres (incluindo código do país)
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        logger.error('❌ Validação falhou: Telefone de suporte com tamanho inválido', {
          original: data.supportPhone,
          digitsOnly: digitsOnly,
          length: digitsOnly.length
        });
        throw new Error('Número deve conter apenas dígitos (10-15 caracteres com código do país)');
      }
      logger.info('✅ Telefone de suporte validado:', {
        original: data.supportPhone,
        validated: digitsOnly
      });
      // Armazenar apenas os dígitos
      validated.supportPhone = digitsOnly;
    } else {
      logger.info('ℹ️ Telefone de suporte não fornecido ou vazio - será definido como null', {
        value: data.supportPhone
      });
      validated.supportPhone = null;
    }

    // Validar og_image_url (imagem para compartilhamento em redes sociais)
    if (data.ogImageUrl !== undefined && data.ogImageUrl !== null && data.ogImageUrl !== '') {
      if (typeof data.ogImageUrl !== 'string') {
        throw new Error('URL da imagem OG deve ser uma string');
      }
      // Validação básica de URL
      try {
        new URL(data.ogImageUrl);
        validated.ogImageUrl = data.ogImageUrl.trim();
        logger.info('✅ URL da imagem OG validada:', {
          original: data.ogImageUrl,
          validated: validated.ogImageUrl
        });
      } catch (error) {
        throw new Error('URL da imagem OG é inválida');
      }
    } else {
      validated.ogImageUrl = null;
      logger.info('ℹ️ URL da imagem OG não fornecida ou vazia - será definida como NULL', {
        value: data.ogImageUrl,
        type: typeof data.ogImageUrl
      });
    }

    return validated;
  }

  // Método para obter estatísticas de performance
  getPerformanceStats() {
    const stats = {
      cacheSize: this.userValidationCache ? this.userValidationCache.size : 0,
      cacheEnabled: !!this.userValidationCache,
      timestamp: new Date().toISOString()
    };

    logger.info('📊 Estatísticas de performance:', stats);
    return stats;
  }

  // ==================== MÉTODOS CRUD PARA REGISTROS DE TABELA DE USUÁRIO ====================

  // Método para criar um novo registro na tabela do usuário
  async createUserTableRecord(userToken, connectionId, recordData) {
    try {
      logger.info('🔄 Criando novo registro na tabela do usuário:', {
        connectionId,
        token: userToken.substring(0, 8) + '...'
      });

      // 1. Validar usuário e obter ID
      const userId = await this.validateUserAndGetId(userToken);

      // 2. Buscar configuração da conexão
      const connection = await this.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // 3. Validar se o usuário tem acesso à conexão
      if (!this.validateUserConnectionAccess(userId, connection)) {
        throw new Error('Access denied to this connection');
      }

      // 4. Criar registro baseado no tipo de conexão
      let result;
      switch (connection.type) {
        case 'NOCODB':
          result = await this.createNocoDBRecord(connection, recordData, userToken);
          break;
        case 'SQLITE':
          result = await this.createSQLiteRecord(connection, recordData, userToken);
          break;
        case 'MYSQL':
        case 'POSTGRESQL':
          result = await this.createExternalDBRecord(connection, recordData, userToken);
          break;
        default:
          throw new Error(`Tipo de conexão não suportado: ${connection.type}`);
      }

      logger.info('✅ Registro criado com sucesso:', {
        connectionId,
        recordId: result.id,
        connectionType: connection.type
      });

      return result;

    } catch (error) {
      logger.error('❌ Erro ao criar registro:', {
        connectionId,
        token: userToken.substring(0, 8) + '...',
        error: error.message
      });

      throw error;
    }
  }

  // Método para buscar um registro específico por ID
  async getUserTableRecordById(userToken, connectionId, recordId) {
    try {
      logger.info('🔍 Buscando registro específico por ID:', {
        connectionId,
        recordId,
        token: userToken.substring(0, 8) + '...'
      });

      // 1. Validar usuário e obter ID
      const userId = await this.validateUserAndGetId(userToken);

      // 2. Buscar configuração da conexão
      const connection = await this.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // 3. Validar se o usuário tem acesso à conexão
      if (!this.validateUserConnectionAccess(userId, connection)) {
        throw new Error('Access denied to this connection');
      }

      // 4. Buscar registro baseado no tipo de conexão
      let record;
      switch (connection.type) {
        case 'NOCODB':
          record = await this.getNocoDBRecordById(connection, recordId);
          break;
        case 'SQLITE':
          record = await this.getSQLiteRecordById(connection, recordId);
          break;
        case 'MYSQL':
        case 'POSTGRESQL':
          record = await this.getExternalDBRecordById(connection, recordId);
          break;
        default:
          throw new Error(`Tipo de conexão não suportado: ${connection.type}`);
      }

      if (!record) {
        logger.warn('⚠️ Registro não encontrado:', { connectionId, recordId });
        return null;
      }

      logger.info('✅ Registro encontrado:', {
        connectionId,
        recordId,
        connectionType: connection.type
      });

      return record;

    } catch (error) {
      logger.error('❌ Erro ao buscar registro específico:', {
        connectionId,
        recordId,
        token: userToken.substring(0, 8) + '...',
        error: error.message
      });

      throw error;
    }
  }

  // Método para atualizar um registro na tabela do usuário
  async updateUserTableRecord(userToken, connectionId, recordId, recordData) {
    try {
      logger.info('🔄 Atualizando registro na tabela do usuário:', {
        connectionId,
        recordId,
        token: userToken.substring(0, 8) + '...'
      });

      // 1. Validar usuário e obter ID
      const userId = await this.validateUserAndGetId(userToken);

      // 2. Buscar configuração da conexão
      const connection = await this.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // 3. Validar se o usuário tem acesso à conexão
      if (!this.validateUserConnectionAccess(userId, connection)) {
        throw new Error('Access denied to this connection');
      }

      // 4. Atualizar registro baseado no tipo de conexão
      let result;
      switch (connection.type) {
        case 'NOCODB':
          result = await this.updateNocoDBRecord(connection, recordId, recordData, userToken);
          break;
        case 'SQLITE':
          result = await this.updateSQLiteRecord(connection, recordId, recordData, userToken);
          break;
        case 'MYSQL':
        case 'POSTGRESQL':
          result = await this.updateExternalDBRecord(connection, recordId, recordData, userToken);
          break;
        default:
          throw new Error(`Tipo de conexão não suportado: ${connection.type}`);
      }

      logger.info('✅ Registro atualizado com sucesso:', {
        connectionId,
        recordId,
        connectionType: connection.type
      });

      return result;

    } catch (error) {
      logger.error('❌ Erro ao atualizar registro:', {
        connectionId,
        recordId,
        token: userToken.substring(0, 8) + '...',
        error: error.message
      });

      throw error;
    }
  }

  // Método para deletar um registro na tabela do usuário
  async deleteUserTableRecord(userToken, connectionId, recordId) {
    try {
      logger.info('🔄 Deletando registro na tabela do usuário:', {
        connectionId,
        recordId,
        token: userToken.substring(0, 8) + '...'
      });

      // 1. Validar usuário e obter ID
      const userId = await this.validateUserAndGetId(userToken);

      // 2. Buscar configuração da conexão
      const connection = await this.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // 3. Validar se o usuário tem acesso à conexão
      if (!this.validateUserConnectionAccess(userId, connection)) {
        throw new Error('Access denied to this connection');
      }

      // 4. Deletar registro baseado no tipo de conexão
      let result;
      switch (connection.type) {
        case 'NOCODB':
          result = await this.deleteNocoDBRecord(connection, recordId, userToken);
          break;
        case 'SQLITE':
          result = await this.deleteSQLiteRecord(connection, recordId, userToken);
          break;
        case 'MYSQL':
        case 'POSTGRESQL':
          result = await this.deleteExternalDBRecord(connection, recordId, userToken);
          break;
        default:
          throw new Error(`Tipo de conexão não suportado: ${connection.type}`);
      }

      logger.info('✅ Registro deletado com sucesso:', {
        connectionId,
        recordId,
        connectionType: connection.type
      });

      return result;

    } catch (error) {
      logger.error('❌ Erro ao deletar registro:', {
        connectionId,
        recordId,
        token: userToken.substring(0, 8) + '...',
        error: error.message
      });

      throw error;
    }
  }

  // ==================== MÉTODOS AUXILIARES PARA CRUD POR TIPO DE CONEXÃO ====================

  // Métodos para NocoDB
  async createNocoDBRecord(connection, recordData, userToken) {
    const axios = require('axios');

    try {
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const response = await nocoApi.post(
        `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
        recordData
      );

      return response.data;
    } catch (error) {
      logger.error('❌ Erro ao criar registro NocoDB:', error.message);
      throw new Error(`Falha na API NocoDB: ${error.message}`);
    }
  }

  async getNocoDBRecordById(connection, recordId) {
    const axios = require('axios');

    try {
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const url = `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}/${recordId}`;

      logger.info('🔍 Buscando registro NocoDB por ID:', {
        url,
        recordId,
        projectId: connection.nocodb_project_id,
        tableId: connection.nocodb_table_id
      });

      const response = await nocoApi.get(url);

      logger.info('✅ Registro NocoDB encontrado:', {
        recordId,
        status: response.status
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn('⚠️ Registro NocoDB não encontrado:', { recordId });
        return null;
      }
      logger.error('❌ Erro ao buscar registro NocoDB:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        recordId
      });
      throw new Error(`Falha na API NocoDB: ${error.message}`);
    }
  }

  async updateNocoDBRecord(connection, recordId, recordData, userToken) {
    const axios = require('axios');

    try {
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const url = `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}/${recordId}`;

      logger.info('🔄 Atualizando registro NocoDB:', {
        url,
        recordId,
        recordData,
        projectId: connection.nocodb_project_id,
        tableId: connection.nocodb_table_id
      });

      const response = await nocoApi.patch(url, recordData);

      logger.info('✅ Registro NocoDB atualizado com sucesso:', {
        recordId,
        status: response.status
      });

      return response.data;
    } catch (error) {
      logger.error('❌ Erro ao atualizar registro NocoDB:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        recordId,
        recordData
      });
      throw new Error(`Falha na API NocoDB: ${error.message}`);
    }
  }

  async deleteNocoDBRecord(connection, recordId, userToken) {
    const axios = require('axios');

    try {
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const response = await nocoApi.delete(
        `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}/${recordId}`
      );

      return response.data;
    } catch (error) {
      logger.error('❌ Erro ao deletar registro NocoDB:', error.message);
      throw new Error(`Falha na API NocoDB: ${error.message}`);
    }
  }

  // Métodos para SQLite (placeholder - implementação futura)
  async getSQLiteRecordById(connection, recordId) {
    try {
      const tableName = connection.table_name;

      // Validar nome da tabela para prevenir SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(`Nome de tabela inválido: ${tableName}`);
      }

      logger.info('🔍 Buscando registro SQLite por ID:', {
        tableName,
        recordId
      });

      const sql = `SELECT * FROM ${tableName} WHERE id = ? OR Id = ?`;
      const { rows } = await this.query(sql, [recordId, recordId]);

      if (rows.length === 0) {
        logger.warn('⚠️ Registro SQLite não encontrado:', { tableName, recordId });
        return null;
      }

      logger.info('✅ Registro SQLite encontrado:', {
        tableName,
        recordId
      });

      return rows[0];
    } catch (error) {
      logger.error('❌ Erro ao buscar registro SQLite:', {
        message: error.message,
        recordId
      });
      throw error;
    }
  }

  async createSQLiteRecord(connection, recordData, userToken) {
    throw new Error('Criação de registros SQLite ainda não implementada');
  }

  async updateSQLiteRecord(connection, recordId, recordData, userToken) {
    throw new Error('Atualização de registros SQLite ainda não implementada');
  }

  async deleteSQLiteRecord(connection, recordId, userToken) {
    throw new Error('Deleção de registros SQLite ainda não implementada');
  }

  // Métodos para bancos externos (placeholder - implementação futura)
  async getExternalDBRecordById(connection, recordId) {
    throw new Error(`Busca de registros ${connection.type} ainda não implementada`);
  }

  async createExternalDBRecord(connection, recordData, userToken) {
    throw new Error(`Criação de registros ${connection.type} ainda não implementada`);
  }

  async updateExternalDBRecord(connection, recordId, recordData, userToken) {
    throw new Error(`Atualização de registros ${connection.type} ainda não implementada`);
  }

  async deleteExternalDBRecord(connection, recordId, userToken) {
    throw new Error(`Deleção de registros ${connection.type} ainda não implementada`);
  }

  // Método auxiliar para tratamento de erros SQLite
  handleSQLiteError(error, operation) {
    const errorMap = {
      'SQLITE_BUSY': 'Banco de dados ocupado, tentando novamente...',
      'SQLITE_CORRUPT': 'Arquivo do banco de dados corrompido',
      'SQLITE_CANTOPEN': 'Não foi possível abrir o arquivo do banco de dados',
      'SQLITE_PERM': 'Permissão negada para acessar o arquivo do banco de dados',
      'SQLITE_READONLY': 'Banco de dados é somente leitura',
      'SQLITE_IOERR': 'Erro de I/O no banco de dados'
    };

    const friendlyMessage = errorMap[error.code] || error.message;
    logger.error(`❌ Erro SQLite em ${operation}:`, {
      code: error.code,
      message: friendlyMessage,
      originalMessage: error.message
    });

    return new Error(`Erro no banco de dados: ${friendlyMessage}`);
  }

  // ==================== MÉTODOS DE RASTREAMENTO DE MENSAGENS ====================

  /**
   * Registra uma mensagem enviada
   */
  async logSentMessage(userToken, phone, message, messageType = 'text', wuzapiResponse = null) {
    await this.ensureInitialized();

    const sql = `
      INSERT INTO sent_messages (user_token, phone, message, message_type, status, wuzapi_response)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const status = wuzapiResponse?.success ? 'sent' : 'failed';
    const responseJson = wuzapiResponse ? JSON.stringify(wuzapiResponse) : null;

    try {
      await this.query(sql, [userToken, phone, message, messageType, status, responseJson]);
      logger.info('✅ Mensagem registrada:', { phone, messageType, status });
    } catch (error) {
      logger.error('❌ Erro ao registrar mensagem:', error.message);
      // Não lançar erro para não interromper o fluxo de envio
    }
  }

  /**
   * Busca contagem de mensagens enviadas por um usuário
   */
  async getMessageCount(userToken, timeframe = 'today') {
    await this.ensureInitialized();

    let dateFilter = '';

    switch (timeframe) {
      case 'today':
        dateFilter = "AND DATE(created_at) = DATE('now')";
        break;
      case 'week':
        dateFilter = "AND created_at >= DATE('now', '-7 days')";
        break;
      case 'month':
        dateFilter = "AND created_at >= DATE('now', '-30 days')";
        break;
      case 'all':
      default:
        dateFilter = '';
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM sent_messages
      WHERE user_token = ? ${dateFilter}
    `;

    try {
      const result = await this.query(sql, [userToken]);
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('❌ Erro ao buscar contagem de mensagens:', error.message);
      return 0;
    }
  }

  /**
   * Busca histórico de mensagens enviadas
   */
  async getMessageHistory(userToken, limit = 50, offset = 0) {
    await this.ensureInitialized();

    const sql = `
      SELECT id, phone, message, message_type, status, created_at
      FROM sent_messages
      WHERE user_token = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    try {
      const result = await this.query(sql, [userToken, limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('❌ Erro ao buscar histórico de mensagens:', error.message);
      return [];
    }
  }

  /**
   * Deleta mensagens do histórico
   */
  async deleteMessages(userToken, messageIds = null) {
    await this.ensureInitialized();

    let sql, params;

    if (messageIds && messageIds.length > 0) {
      // Deletar mensagens específicas
      const placeholders = messageIds.map(() => '?').join(',');
      sql = `DELETE FROM sent_messages WHERE user_token = ? AND id IN (${placeholders})`;
      params = [userToken, ...messageIds];
    } else {
      // Deletar todas as mensagens do usuário
      sql = `DELETE FROM sent_messages WHERE user_token = ?`;
      params = [userToken];
    }

    try {
      const result = await this.query(sql, params);
      logger.info('✅ Mensagens deletadas:', { count: result.changes });
      return result.changes;
    } catch (error) {
      logger.error('❌ Erro ao deletar mensagens:', error.message);
      throw error;
    }
  }

  /**
   * Busca total de mensagens para paginação
   */
  async getMessageCount(userToken) {
    await this.ensureInitialized();

    const sql = `SELECT COUNT(*) as count FROM sent_messages WHERE user_token = ?`;

    try {
      const result = await this.query(sql, [userToken]);
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('❌ Erro ao contar mensagens:', error.message);
      return 0;
    }
  }

  /**
   * Cria um template de mensagem
   */
  async createTemplate(userToken, name, content, hasVariations = false) {
    await this.ensureInitialized();

    const sql = `
      INSERT INTO message_templates (user_token, name, content, has_variations)
      VALUES (?, ?, ?, ?)
    `;

    try {
      const result = await this.query(sql, [userToken, name, content, hasVariations ? 1 : 0]);
      logger.info('✅ Template criado:', { id: result.lastID, name, hasVariations });
      return result.lastID;
    } catch (error) {
      logger.error('❌ Erro ao criar template:', error.message);
      throw error;
    }
  }

  /**
   * Busca templates do usuário
   */
  async getTemplates(userToken) {
    await this.ensureInitialized();

    const sql = `
      SELECT id, name, content, has_variations, created_at, updated_at
      FROM message_templates
      WHERE user_token = ?
      ORDER BY name ASC
    `;

    try {
      const result = await this.query(sql, [userToken]);
      return result.rows.map(row => ({
        ...row,
        hasVariations: row.has_variations === 1
      }));
    } catch (error) {
      logger.error('❌ Erro ao buscar templates:', error.message);
      return [];
    }
  }

  /**
   * Atualiza um template
   */
  async updateTemplate(userToken, templateId, name, content, hasVariations = false) {
    await this.ensureInitialized();

    const sql = `
      UPDATE message_templates
      SET name = ?, content = ?, has_variations = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_token = ?
    `;

    try {
      const result = await this.query(sql, [name, content, hasVariations ? 1 : 0, templateId, userToken]);
      logger.info('✅ Template atualizado:', { id: templateId, name, hasVariations });
      return result.changes > 0;
    } catch (error) {
      logger.error('❌ Erro ao atualizar template:', error.message);
      throw error;
    }
  }

  /**
   * Deleta um template
   */
  async deleteTemplate(userToken, templateId) {
    await this.ensureInitialized();

    const sql = `DELETE FROM message_templates WHERE id = ? AND user_token = ?`;

    try {
      const result = await this.query(sql, [templateId, userToken]);
      logger.info('✅ Template deletado:', { id: templateId });
      return result.changes > 0;
    } catch (error) {
      logger.error('❌ Erro ao deletar template:', error.message);
      throw error;
    }
  }

  // ==================== MÉTODOS CRUD PARA CUSTOM LINKS ====================

  /**
   * Busca todos os links customizados ativos
   */
  async getCustomLinks() {
    await this.ensureInitialized();

    const sql = `
      SELECT id, label, url, icon, position, active
      FROM custom_links
      WHERE active = 1
      ORDER BY position ASC, id ASC
    `;

    try {
      const result = await this.query(sql);
      logger.info('✅ Links customizados recuperados:', { count: result.rows.length });
      return result.rows;
    } catch (error) {
      logger.error('❌ Erro ao buscar links customizados:', error.message);
      return [];
    }
  }

  /**
   * Busca todos os links customizados (incluindo inativos)
   */
  async getAllCustomLinks() {
    await this.ensureInitialized();

    const sql = `
      SELECT id, label, url, icon, position, active, created_at, updated_at
      FROM custom_links
      ORDER BY position ASC, id ASC
    `;

    try {
      const result = await this.query(sql);
      logger.info('✅ Todos os links customizados recuperados:', { count: result.rows.length });
      return result.rows;
    } catch (error) {
      logger.error('❌ Erro ao buscar todos os links customizados:', error.message);
      return [];
    }
  }

  /**
   * Cria um novo link customizado
   */
  async createCustomLink(label, url, icon = 'ExternalLink', position = 0) {
    await this.ensureInitialized();

    const sql = `
      INSERT INTO custom_links (label, url, icon, position, active)
      VALUES (?, ?, ?, ?, 1)
    `;

    try {
      const result = await this.query(sql, [label, url, icon, position]);
      logger.info('✅ Link customizado criado:', { id: result.lastID, label, url });
      return { id: result.lastID, label, url, icon, position, active: 1 };
    } catch (error) {
      logger.error('❌ Erro ao criar link customizado:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza um link customizado
   */
  async updateCustomLink(id, label, url, icon, position, active) {
    await this.ensureInitialized();

    const sql = `
      UPDATE custom_links
      SET label = ?, url = ?, icon = ?, position = ?, active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const result = await this.query(sql, [label, url, icon, position, active ? 1 : 0, id]);
      logger.info('✅ Link customizado atualizado:', { id, label, rowCount: result.rowCount });
      return result.rowCount > 0;
    } catch (error) {
      logger.error('❌ Erro ao atualizar link customizado:', error.message);
      throw error;
    }
  }

  /**
   * Deleta um link customizado
   */
  async deleteCustomLink(id) {
    await this.ensureInitialized();

    const sql = `DELETE FROM custom_links WHERE id = ?`;

    try {
      const result = await this.query(sql, [id]);
      logger.info('✅ Link customizado deletado:', { id });
      return result.changes > 0;
    } catch (error) {
      logger.error('❌ Erro ao deletar link customizado:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // TABLE PERMISSIONS MANAGEMENT
  // ============================================================================

  /**
   * Cria uma nova permissão de tabela para um usuário
   * @param {string} userId - ID do usuário
   * @param {string} tableName - Nome da tabela
   * @param {Object} permissions - Objeto com can_read, can_write, can_delete
   * @returns {Promise<Object>} Permissão criada com ID
   */
  async createTablePermission(userId, tableName, permissions = {}) {
    await this.ensureInitialized();

    const { can_read = 0, can_write = 0, can_delete = 0 } = permissions;

    const sql = `
      INSERT INTO table_permissions (user_id, table_name, can_read, can_write, can_delete)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const result = await this.query(sql, [
        userId,
        tableName,
        can_read ? 1 : 0,
        can_write ? 1 : 0,
        can_delete ? 1 : 0
      ]);

      logger.info('✅ Permissão de tabela criada:', {
        id: result.lastID,
        userId,
        tableName,
        permissions: { can_read, can_write, can_delete }
      });

      return {
        id: result.lastID,
        user_id: userId,
        table_name: tableName,
        can_read: can_read ? 1 : 0,
        can_write: can_write ? 1 : 0,
        can_delete: can_delete ? 1 : 0
      };
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        logger.warn('⚠️ Permissão já existe para este usuário e tabela:', { userId, tableName });
        throw new Error(`Permission already exists for user ${userId} on table ${tableName}`);
      }
      logger.error('❌ Erro ao criar permissão de tabela:', error.message);
      throw error;
    }
  }

  /**
   * Busca uma permissão específica de tabela para um usuário
   * @param {string} userId - ID do usuário
   * @param {string} tableName - Nome da tabela
   * @returns {Promise<Object|null>} Permissão encontrada ou null
   */
  async getTablePermission(userId, tableName) {
    await this.ensureInitialized();

    const sql = `
      SELECT * FROM table_permissions
      WHERE user_id = ? AND table_name = ?
    `;

    try {
      const result = await this.query(sql, [userId, tableName]);

      if (result.rows.length === 0) {
        logger.info('ℹ️ Nenhuma permissão encontrada:', { userId, tableName });
        return null;
      }

      logger.info('✅ Permissão de tabela encontrada:', { userId, tableName });
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Erro ao buscar permissão de tabela:', error.message);
      throw error;
    }
  }

  /**
   * Busca todas as permissões de tabela de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Array>} Lista de permissões
   */
  async getUserTablePermissions(userId) {
    await this.ensureInitialized();

    const sql = `
      SELECT * FROM table_permissions
      WHERE user_id = ?
      ORDER BY table_name ASC
    `;

    try {
      const result = await this.query(sql, [userId]);
      logger.info('✅ Permissões de usuário encontradas:', {
        userId,
        count: result.rows.length
      });
      return result.rows;
    } catch (error) {
      logger.error('❌ Erro ao buscar permissões do usuário:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza uma permissão de tabela existente
   * @param {number} permissionId - ID da permissão
   * @param {Object} permissions - Objeto com can_read, can_write, can_delete
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  async updateTablePermission(permissionId, permissions) {
    await this.ensureInitialized();

    const { can_read, can_write, can_delete } = permissions;

    const sql = `
      UPDATE table_permissions
      SET can_read = ?, can_write = ?, can_delete = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const result = await this.query(sql, [
        can_read ? 1 : 0,
        can_write ? 1 : 0,
        can_delete ? 1 : 0,
        permissionId
      ]);

      if (result.rowCount === 0) {
        logger.warn('⚠️ Permissão não encontrada para atualização:', { permissionId });
        return false;
      }

      logger.info('✅ Permissão de tabela atualizada:', {
        permissionId,
        permissions
      });
      return true;
    } catch (error) {
      logger.error('❌ Erro ao atualizar permissão de tabela:', error.message);
      throw error;
    }
  }

  /**
   * Deleta uma permissão de tabela
   * @param {number} permissionId - ID da permissão
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  async deleteTablePermission(permissionId) {
    await this.ensureInitialized();

    const sql = `DELETE FROM table_permissions WHERE id = ?`;

    try {
      const result = await this.query(sql, [permissionId]);

      if (result.rowCount === 0) {
        logger.warn('⚠️ Permissão não encontrada para deleção:', { permissionId });
        return false;
      }

      logger.info('✅ Permissão de tabela deletada:', { permissionId });
      return true;
    } catch (error) {
      logger.error('❌ Erro ao deletar permissão de tabela:', error.message);
      throw error;
    }
  }

  /**
   * Busca todas as permissões de tabela (admin)
   * @returns {Promise<Array>} Lista de todas as permissões
   */
  async getAllTablePermissions() {
    await this.ensureInitialized();

    const sql = `
      SELECT * FROM table_permissions
      ORDER BY user_id ASC, table_name ASC
    `;

    try {
      const result = await this.query(sql);
      logger.info('✅ Todas as permissões encontradas:', {
        count: result.rows.length
      });
      return result.rows;
    } catch (error) {
      logger.error('❌ Erro ao buscar todas as permissões:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // GENERIC TABLE OPERATIONS
  // ============================================================================

  /**
   * Lista todas as tabelas disponíveis (excluindo tabelas do sistema)
   * @returns {Promise<Array>} Lista de tabelas com informações básicas
   */
  async getAvailableTables() {
    await this.ensureInitialized();

    const sql = `
      SELECT 
        name as table_name,
        (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as index_count
      FROM sqlite_master m
      WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT IN ('system_metadata', 'table_permissions')
      ORDER BY name ASC
    `;

    try {
      const result = await this.query(sql);

      // Para cada tabela, buscar contagem de registros
      const tablesWithCounts = await Promise.all(
        result.rows.map(async (table) => {
          try {
            const countResult = await this.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
            const schemaResult = await this.query(`SELECT COUNT(*) as count FROM pragma_table_info('${table.table_name}')`);

            return {
              table_name: table.table_name,
              row_count: countResult.rows[0].count,
              column_count: schemaResult.rows[0].count,
              index_count: table.index_count
            };
          } catch (error) {
            logger.warn(`⚠️ Erro ao obter informações da tabela ${table.table_name}:`, error.message);
            return {
              table_name: table.table_name,
              row_count: 0,
              column_count: 0,
              index_count: table.index_count
            };
          }
        })
      );

      logger.info('✅ Tabelas disponíveis encontradas:', {
        count: tablesWithCounts.length
      });

      return tablesWithCounts;
    } catch (error) {
      logger.error('❌ Erro ao buscar tabelas disponíveis:', error.message);
      throw error;
    }
  }

  /**
   * Obtém o schema de uma tabela específica
   * @param {string} tableName - Nome da tabela
   * @returns {Promise<Object>} Schema da tabela com colunas e tipos
   */
  async getTableSchema(tableName) {
    await this.ensureInitialized();

    // Validar nome da tabela para prevenir SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name format');
    }

    const sql = `SELECT * FROM pragma_table_info('${tableName}')`;

    try {
      const result = await this.query(sql);

      if (result.rows.length === 0) {
        throw new Error(`Table ${tableName} not found`);
      }

      const columns = result.rows.map(col => ({
        name: col.name,
        type: col.type,
        not_null: col.notnull === 1,
        default_value: col.dflt_value,
        primary_key: col.pk === 1
      }));

      logger.info('✅ Schema da tabela obtido:', {
        tableName,
        columnCount: columns.length
      });

      return {
        table_name: tableName,
        columns
      };
    } catch (error) {
      logger.error('❌ Erro ao obter schema da tabela:', error.message);
      throw error;
    }
  }

  /**
   * Consulta registros de uma tabela com paginação, filtros e ordenação
   * @param {string} tableName - Nome da tabela
   * @param {Object} options - Opções de consulta
   * @returns {Promise<Object>} Resultado com dados e metadados
   */
  async queryTable(tableName, options = {}) {
    await this.ensureInitialized();

    // Validar nome da tabela
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name format');
    }

    const {
      page = 1,
      limit = 50,
      sortBy = null,
      sortOrder = 'ASC',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;

    try {
      // Construir WHERE clause baseado nos filtros
      let whereClause = '';
      const params = [];

      if (Object.keys(filters).length > 0) {
        const conditions = [];
        for (const [column, value] of Object.entries(filters)) {
          // Validar nome da coluna
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
            continue;
          }

          if (value !== null && value !== undefined && value !== '') {
            conditions.push(`${column} LIKE ?`);
            params.push(`%${value}%`);
          }
        }

        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' AND ');
        }
      }

      // Construir ORDER BY clause
      let orderClause = '';
      if (sortBy && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sortBy)) {
        const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        orderClause = `ORDER BY ${sortBy} ${order}`;
      }

      // Buscar total de registros
      const countSql = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
      const countResult = await this.query(countSql, params);
      const total = countResult.rows[0].total;

      // Buscar registros paginados
      const dataSql = `
        SELECT * FROM ${tableName}
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `;

      const dataResult = await this.query(dataSql, [...params, limit, offset]);

      logger.info('✅ Consulta de tabela executada:', {
        tableName,
        page,
        limit,
        total,
        returned: dataResult.rows.length
      });

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('❌ Erro ao consultar tabela:', error.message);
      throw error;
    }
  }

  /**
   * Insere um novo registro em uma tabela
   * @param {string} tableName - Nome da tabela
   * @param {Object} data - Dados a serem inseridos
   * @returns {Promise<Object>} Registro inserido com ID
   */
  async insertRecord(tableName, data) {
    await this.ensureInitialized();

    // Validar nome da tabela
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name format');
    }

    if (!data || Object.keys(data).length === 0) {
      throw new Error('No data provided for insert');
    }

    try {
      // Validar nomes das colunas
      const columns = Object.keys(data);
      for (const col of columns) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
          throw new Error(`Invalid column name: ${col}`);
        }
      }

      const placeholders = columns.map(() => '?').join(', ');
      const columnNames = columns.join(', ');
      const values = columns.map(col => data[col]);

      const sql = `
        INSERT INTO ${tableName} (${columnNames})
        VALUES (${placeholders})
      `;

      const result = await this.query(sql, values);

      logger.info('✅ Registro inserido:', {
        tableName,
        id: result.lastID
      });

      return {
        id: result.lastID,
        ...data
      };
    } catch (error) {
      logger.error('❌ Erro ao inserir registro:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza um registro existente em uma tabela
   * @param {string} tableName - Nome da tabela
   * @param {number} id - ID do registro
   * @param {Object} data - Dados a serem atualizados
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  async updateRecord(tableName, id, data) {
    await this.ensureInitialized();

    // Validar nome da tabela
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name format');
    }

    if (!data || Object.keys(data).length === 0) {
      throw new Error('No data provided for update');
    }

    try {
      // Validar nomes das colunas
      const columns = Object.keys(data);
      for (const col of columns) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
          throw new Error(`Invalid column name: ${col}`);
        }
      }

      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = [...columns.map(col => data[col]), id];

      const sql = `
        UPDATE ${tableName}
        SET ${setClause}
        WHERE id = ?
      `;

      const result = await this.query(sql, values);

      if (result.rowCount === 0) {
        logger.warn('⚠️ Registro não encontrado para atualização:', { tableName, id });
        return false;
      }

      logger.info('✅ Registro atualizado:', {
        tableName,
        id
      });

      return true;
    } catch (error) {
      logger.error('❌ Erro ao atualizar registro:', error.message);
      throw error;
    }
  }

  /**
   * Deleta um registro de uma tabela
   * @param {string} tableName - Nome da tabela
   * @param {number} id - ID do registro
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  async deleteRecord(tableName, id) {
    await this.ensureInitialized();

    // Validar nome da tabela
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name format');
    }

    try {
      const sql = `DELETE FROM ${tableName} WHERE id = ?`;
      const result = await this.query(sql, [id]);

      if (result.rowCount === 0) {
        logger.warn('⚠️ Registro não encontrado para deleção:', { tableName, id });
        return false;
      }

      logger.info('✅ Registro deletado:', {
        tableName,
        id
      });

      return true;
    } catch (error) {
      logger.error('❌ Erro ao deletar registro:', error.message);
      throw error;
    }
  }

  /**
   * Cria uma mensagem única agendada
   */
  async createScheduledSingleMessage(userToken, instance, recipient, recipientName, messageType, messageContent, mediaData, scheduledAt) {
    await this.ensureInitialized();

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Normalizar data para ISO UTC para comparação consistente
    const normalizedScheduledAt = new Date(scheduledAt).toISOString();

    const sql = `
      INSERT INTO scheduled_single_messages (
        id, user_token, instance, recipient, recipient_name, 
        message_type, message_content, media_data, scheduled_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    try {
      await this.query(sql, [
        messageId,
        userToken,
        instance,
        recipient,
        recipientName || null,
        messageType,
        messageContent,
        mediaData ? JSON.stringify(mediaData) : null,
        normalizedScheduledAt
      ]);

      logger.info('✅ Mensagem única agendada criada:', { messageId, recipient, scheduledAt: normalizedScheduledAt });
      return messageId;
    } catch (error) {
      logger.error('❌ Erro ao criar mensagem agendada:', error.message);
      throw error;
    }
  }

  /**
   * Busca mensagens únicas agendadas do usuário
   */
  async getScheduledSingleMessages(userToken, instance = null) {
    await this.ensureInitialized();

    let sql = `
      SELECT * FROM scheduled_single_messages 
      WHERE user_token = ? 
      AND status = 'pending'
    `;

    const params = [userToken];

    if (instance) {
      sql += ' AND instance = ?';
      params.push(instance);
    }

    sql += ' ORDER BY scheduled_at ASC';

    try {
      const result = await this.query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('❌ Erro ao buscar mensagens agendadas:', error.message);
      return [];
    }
  }

  /**
   * Cancela uma mensagem única agendada
   */
  async cancelScheduledSingleMessage(messageId, userToken) {
    await this.ensureInitialized();

    const sql = `
      UPDATE scheduled_single_messages 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_token = ? AND status = 'pending'
    `;

    try {
      const result = await this.query(sql, [messageId, userToken]);

      if (result.rowCount === 0) {
        throw new Error('Mensagem não encontrada ou já foi processada');
      }

      logger.info('✅ Mensagem agendada cancelada:', { messageId });
      return true;
    } catch (error) {
      logger.error('❌ Erro ao cancelar mensagem agendada:', error.message);
      throw error;
    }
  }
}

module.exports = Database;