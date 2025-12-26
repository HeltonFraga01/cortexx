const express = require('express');
const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const { validateViewConfiguration, validateFieldMappings } = require('../validators/viewConfigurationValidator');
const { validateConnectionData } = require('../validators/databaseConnectionValidator');
const { validateSupabaseConnection, validateSupabaseCredentials } = require('../validators/supabaseValidator');
const { sanitizeConnection, sanitizeConnections } = require('../utils/credentialSanitizer');
const { requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { featureMiddleware } = require('../middleware/featureEnforcement');
const DatabaseConnectionService = require('../services/DatabaseConnectionService');
const SupabaseConnectionService = require('../services/SupabaseConnectionService');
const { withCircuitBreaker } = require('../utils/circuitBreaker');

const router = express.Router();

/**
 * Database Connections Routes
 * Handles CRUD operations for database connections
 *
 * Security:
 * - All routes require admin authentication (session-based)
 * - Rate limited to 50 requests per minute per IP
 * - Credentials are masked in all responses
 */

// Apply security middleware to all routes
router.use(adminLimiter);
router.use(requireAdmin);
router.use(featureMiddleware.nocodbIntegration);

// GET /api/database-connections - Listar todas as conexões
router.get('/', async (req, res) => {
  try {
    const connections = await DatabaseConnectionService.getAllConnections();

    // Mask sensitive credentials before returning
    const sanitizedConnections = sanitizeConnections(connections);

    res.json({
      success: true,
      data: sanitizedConnections,
      count: connections.length,
    });
  } catch (err) {
    logger.error('Erro ao buscar conexões:', err.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message,
    });
  }
});

// GET /api/database-connections/:id - Buscar conexão por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await DatabaseConnectionService.getConnectionById(id);

    if (!connection) {
      return res.status(404).json({
        error: 'Conexão não encontrada',
        code: 'CONNECTION_NOT_FOUND',
        message: `Conexão com ID ${id} não existe`,
      });
    }

    // Mask sensitive credentials before returning
    const sanitizedConnection = sanitizeConnection(connection);

    res.json({
      success: true,
      data: sanitizedConnection,
    });
  } catch (err) {
    logger.error('Erro ao buscar conexão:', err.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message,
    });
  }
});

// POST /api/database-connections - Criar nova conexão
router.post('/', async (req, res) => {
  const connectionData = req.body;

  // Validação de entrada usando o validador
  const validation = validateConnectionData(connectionData);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      message: validation.errors.join('; '),
      errors: validation.errors,
    });
  }

  // Validação específica por tipo
  if (connectionData.type === 'NOCODB') {
    const token =
      connectionData.nocodbToken ||
      connectionData.nocodb_token ||
      connectionData.password;
    const projectId =
      connectionData.nocodbProjectId ||
      connectionData.nocodb_project_id ||
      connectionData.database;
    const tableId =
      connectionData.nocodbTableId ||
      connectionData.nocodb_table_id ||
      connectionData.table_name;

    if (!token || !projectId || !tableId) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        message: 'Para NocoDB, token, project ID e table ID são obrigatórios',
      });
    }
  } else if (connectionData.type === 'SUPABASE') {
    // Validação específica para Supabase
    const supabaseValidation = validateSupabaseConnection(connectionData);
    if (!supabaseValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        message: supabaseValidation.errors.join('; '),
        errors: supabaseValidation.errors,
      });
    }
  } else {
    if (
      !connectionData.database ||
      !connectionData.username ||
      !connectionData.password
    ) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        message:
          'Para bancos relacionais, database, username e password são obrigatórios',
      });
    }
  }

  // Validar view configuration se fornecida
  if (connectionData.viewConfiguration || connectionData.view_configuration) {
    const viewConfig =
      connectionData.viewConfiguration || connectionData.view_configuration;
    const viewValidation = validateViewConfiguration(viewConfig);

    if (!viewValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Configuração de visualização inválida',
        code: 'VALIDATION_ERROR',
        message: viewValidation.errors.join('; '),
        errors: viewValidation.errors,
      });
    }
  }

  // Validar field mappings se fornecidos
  if (connectionData.fieldMappings || connectionData.field_mappings) {
    const fieldMappings =
      connectionData.fieldMappings || connectionData.field_mappings;
    const mappingValidation = validateFieldMappings(fieldMappings);

    if (!mappingValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Mapeamento de campos inválido',
        code: 'VALIDATION_ERROR',
        message: mappingValidation.errors.join('; '),
        errors: mappingValidation.errors,
      });
    }
  }

  try {
    const result = await DatabaseConnectionService.createConnection(connectionData);

    // Mask credentials in response
    const sanitizedResult = sanitizeConnection(result.data || result);

    res.status(201).json({
      success: true,
      message: 'Conexão criada com sucesso',
      data: sanitizedResult,
    });
  } catch (err) {
    logger.error('Erro ao criar conexão:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: err.message,
    });
  }
});

// PUT /api/database-connections/:id - Atualizar conexão
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const connectionData = req.body;

  // Validação de entrada usando o validador
  const validation = validateConnectionData(connectionData);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      message: validation.errors.join('; '),
      errors: validation.errors,
    });
  }

  // Validar view configuration se fornecida
  if (connectionData.viewConfiguration || connectionData.view_configuration) {
    const viewConfig =
      connectionData.viewConfiguration || connectionData.view_configuration;
    const viewValidation = validateViewConfiguration(viewConfig);

    if (!viewValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Configuração de visualização inválida',
        code: 'VALIDATION_ERROR',
        message: viewValidation.errors.join('; '),
        errors: viewValidation.errors,
      });
    }
  }

  // Validar field mappings se fornecidos
  if (connectionData.fieldMappings || connectionData.field_mappings) {
    const fieldMappings =
      connectionData.fieldMappings || connectionData.field_mappings;
    const mappingValidation = validateFieldMappings(fieldMappings);

    if (!mappingValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Mapeamento de campos inválido',
        code: 'VALIDATION_ERROR',
        message: mappingValidation.errors.join('; '),
        errors: mappingValidation.errors,
      });
    }
  }

  try {
    // Fetch existing connection to preserve credentials if not provided
    const existingConnection = await DatabaseConnectionService.getConnectionById(id);
    if (!existingConnection) {
      return res.status(404).json({
        success: false,
        error: 'Conexão não encontrada',
        code: 'CONNECTION_NOT_FOUND',
        message: `Conexão com ID ${id} não existe`,
      });
    }

    // Preserve existing password if not provided in update
    if (!connectionData.password && existingConnection.password) {
      // Log credential access for security audit (never log actual values)
      securityLogger.logSensitiveDataAccess({
        userId: req.session?.userId,
        ip: req.ip,
        resource: `database_connection:${id}:password`,
        action: 'preserve_on_update',
      });
      connectionData.password = existingConnection.password;
    }

    // Preserve existing nocodb_token if not provided in update
    if (!connectionData.nocodb_token && existingConnection.nocodb_token) {
      // Log credential access for security audit (never log actual values)
      securityLogger.logSensitiveDataAccess({
        userId: req.session?.userId,
        ip: req.ip,
        resource: `database_connection:${id}:nocodb_token`,
        action: 'preserve_on_update',
      });
      connectionData.nocodb_token = existingConnection.nocodb_token;
    }

    const result = await DatabaseConnectionService.updateConnection(id, connectionData);

    // Mask credentials in response
    const sanitizedResult = sanitizeConnection(result.data || result);

    res.json({
      success: true,
      message: 'Conexão atualizada com sucesso',
      data: sanitizedResult,
    });
  } catch (err) {
    logger.error('Erro ao atualizar conexão:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: err.message,
    });
  }
});

// POST /api/database-connections/:id/test - Testar conexão
router.post('/:id/test', async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await DatabaseConnectionService.getConnectionById(id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Conexão não encontrada',
        code: 'CONNECTION_NOT_FOUND',
        message: `Conexão com ID ${id} não existe`,
      });
    }

    // Log credential access for connection testing (never log actual values)
    if (connection.password || connection.nocodb_token) {
      securityLogger.logSensitiveDataAccess({
        userId: req.session?.userId,
        ip: req.ip,
        resource: `database_connection:${id}:credentials`,
        action: 'test_connection',
      });
    }

    // Para tipos de banco não implementados, retornar mensagem apropriada
    res.json({
      success: true,
      message: 'Teste de conexão não implementado para este tipo de banco',
      data: {
        status: 'unknown',
        type: connection.type
      }
    });
  } catch (err) {
    logger.error('Erro ao testar conexão:', err.message);
    
    // Atualizar status para error
    try {
      await DatabaseConnectionService.updateConnectionStatus(id, 'error');
    } catch (updateErr) {
      logger.error('Erro ao atualizar status:', updateErr.message);
    }
    
    return res.status(500).json({ 
      error: 'Erro ao testar conexão',
      message: err.message 
    });
  }
});

// PATCH /api/database-connections/:id/status - Atualizar apenas o status
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['connected', 'disconnected', 'error', 'testing'].includes(status)) {
    return res.status(400).json({
      error: 'Status inválido',
      message: 'Status deve ser: connected, disconnected, error ou testing'
    });
  }
  
  try {
    const result = await DatabaseConnectionService.updateConnectionStatus(id, status);
    
    if (result.changes === 0) {
      return res.status(404).json({ 
        error: 'Conexão não encontrada',
        message: `Conexão com ID ${id} não existe`
      });
    }
    
    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: result
    });
  } catch (err) {
    logger.error('Erro ao atualizar status:', err.message);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: err.message 
    });
  }
});

// DELETE /api/database-connections/:id - Deletar conexão
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await DatabaseConnectionService.deleteConnection(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ 
        error: 'Conexão não encontrada',
        message: `Conexão com ID ${id} não existe`
      });
    }
    
    res.json({
      success: true,
      message: 'Conexão deletada com sucesso',
      data: result
    });
  } catch (err) {
    logger.error('Erro ao deletar conexão:', err.message);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: err.message 
    });
  }
});

// ============================================
// SUPABASE-SPECIFIC ENDPOINTS
// ============================================

// POST /api/database-connections/:id/test-supabase - Testar conexão Supabase
router.post('/:id/test-supabase', async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await DatabaseConnectionService.getConnectionById(id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Conexão não encontrada',
        code: 'CONNECTION_NOT_FOUND',
        message: `Conexão com ID ${id} não existe`,
      });
    }

    if (connection.type !== 'SUPABASE') {
      return res.status(400).json({
        success: false,
        error: 'Tipo inválido',
        code: 'INVALID_TYPE',
        message: 'Esta rota é apenas para conexões do tipo SUPABASE',
      });
    }

    // Log credential access for security audit
    securityLogger.logSensitiveDataAccess({
      userId: req.session?.userId,
      ip: req.ip,
      resource: `database_connection:${id}:supabase_key`,
      action: 'test_supabase_connection',
    });

    // Use circuit breaker for connection test
    const circuitKey = `supabase:${id}`;
    const result = await withCircuitBreaker(circuitKey, async () => {
      return await SupabaseConnectionService.testConnection(connection);
    });

    // Update connection status based on test result
    const newStatus = result.success ? 'connected' : 'error';
    await DatabaseConnectionService.updateConnectionStatus(id, newStatus);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        status: result.status,
        details: result.details,
      },
    });
  } catch (err) {
    logger.error('Erro ao testar conexão Supabase', {
      connectionId: id,
      error: err.message,
      userId: req.session?.userId,
    });

    // Update status to error
    try {
      await DatabaseConnectionService.updateConnectionStatus(id, 'error');
    } catch (updateErr) {
      logger.error('Erro ao atualizar status', { error: updateErr.message });
    }

    // Handle circuit breaker errors
    if (err.code === 'CIRCUIT_OPEN') {
      return res.status(503).json({
        success: false,
        error: 'Serviço temporariamente indisponível',
        code: 'CIRCUIT_OPEN',
        message: err.userMessage || 'Muitas falhas recentes. Aguarde antes de tentar novamente.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao testar conexão',
      message: err.userMessage || err.message,
    });
  }
});

// POST /api/database-connections/test-supabase-credentials - Testar credenciais antes de salvar
router.post('/test-supabase-credentials', async (req, res) => {
  const { supabase_url, supabase_key, supabase_key_type } = req.body;

  // Validate input - use credentials-only validation (no name required)
  const validation = validateSupabaseCredentials({
    supabase_url,
    supabase_key,
    supabase_key_type,
  });

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      message: validation.errors.join('; '),
      errors: validation.errors,
    });
  }

  try {
    // Log credential access
    securityLogger.logSensitiveDataAccess({
      userId: req.session?.userId,
      ip: req.ip,
      resource: 'supabase_credentials:test',
      action: 'test_credentials_before_save',
    });

    const result = await SupabaseConnectionService.testConnection({
      supabase_url,
      supabase_key,
      supabase_key_type,
    });

    res.json({
      success: result.success,
      message: result.message,
      data: {
        status: result.status,
        details: result.details,
      },
    });
  } catch (err) {
    logger.error('Erro ao testar credenciais Supabase', {
      error: err.message,
      userId: req.session?.userId,
    });

    return res.status(500).json({
      success: false,
      error: 'Erro ao testar credenciais',
      message: err.userMessage || err.message,
    });
  }
});

// GET /api/database-connections/:id/supabase/tables - Listar tabelas do Supabase
router.get('/:id/supabase/tables', async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await DatabaseConnectionService.getConnectionById(id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Conexão não encontrada',
        code: 'CONNECTION_NOT_FOUND',
      });
    }

    if (connection.type !== 'SUPABASE') {
      return res.status(400).json({
        success: false,
        error: 'Tipo inválido',
        code: 'INVALID_TYPE',
        message: 'Esta rota é apenas para conexões do tipo SUPABASE',
      });
    }

    // Log credential access
    securityLogger.logSensitiveDataAccess({
      userId: req.session?.userId,
      ip: req.ip,
      resource: `database_connection:${id}:supabase_key`,
      action: 'list_supabase_tables',
    });

    const circuitKey = `supabase:${id}`;
    const tables = await withCircuitBreaker(circuitKey, async () => {
      return await SupabaseConnectionService.listTables(connection);
    });

    res.json({
      success: true,
      data: tables,
      count: tables.length,
    });
  } catch (err) {
    logger.error('Erro ao listar tabelas Supabase', {
      connectionId: id,
      error: err.message,
      userId: req.session?.userId,
    });

    if (err.code === 'CIRCUIT_OPEN') {
      return res.status(503).json({
        success: false,
        error: 'Serviço temporariamente indisponível',
        code: 'CIRCUIT_OPEN',
        message: err.userMessage,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao listar tabelas',
      message: err.userMessage || err.message,
    });
  }
});

// GET /api/database-connections/:id/supabase/columns/:table - Obter colunas de uma tabela
router.get('/:id/supabase/columns/:table', async (req, res) => {
  const { id, table } = req.params;

  try {
    const connection = await DatabaseConnectionService.getConnectionById(id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Conexão não encontrada',
        code: 'CONNECTION_NOT_FOUND',
      });
    }

    if (connection.type !== 'SUPABASE') {
      return res.status(400).json({
        success: false,
        error: 'Tipo inválido',
        code: 'INVALID_TYPE',
        message: 'Esta rota é apenas para conexões do tipo SUPABASE',
      });
    }

    // Log credential access
    securityLogger.logSensitiveDataAccess({
      userId: req.session?.userId,
      ip: req.ip,
      resource: `database_connection:${id}:supabase_key`,
      action: 'get_supabase_columns',
    });

    const circuitKey = `supabase:${id}`;
    const columns = await withCircuitBreaker(circuitKey, async () => {
      return await SupabaseConnectionService.getTableColumns(connection, table);
    });

    res.json({
      success: true,
      data: columns,
      count: columns.length,
    });
  } catch (err) {
    logger.error('Erro ao obter colunas Supabase', {
      connectionId: id,
      table,
      error: err.message,
      userId: req.session?.userId,
    });

    if (err.code === 'CIRCUIT_OPEN') {
      return res.status(503).json({
        success: false,
        error: 'Serviço temporariamente indisponível',
        code: 'CIRCUIT_OPEN',
        message: err.userMessage,
      });
    }

    if (err.code === 'SUPABASE_TABLE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: 'Tabela não encontrada',
        code: err.code,
        message: err.userMessage,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao obter colunas',
      message: err.userMessage || err.message,
    });
  }
});

// POST /api/database-connections/supabase/tables - Listar tabelas com credenciais temporárias
router.post('/supabase/tables', async (req, res) => {
  const { supabase_url, supabase_key, supabase_key_type } = req.body;

  // Validate input - use credentials-only validation (no name required for temp credentials)
  const validation = validateSupabaseCredentials({
    supabase_url,
    supabase_key,
    supabase_key_type,
  });

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      message: validation.errors.join('; '),
    });
  }

  try {
    // Log credential access
    securityLogger.logSensitiveDataAccess({
      userId: req.session?.userId,
      ip: req.ip,
      resource: 'supabase_credentials:temp',
      action: 'list_tables_temp_credentials',
    });

    const tables = await SupabaseConnectionService.listTables({
      supabase_url,
      supabase_key,
      supabase_key_type,
    });

    res.json({
      success: true,
      data: tables,
      count: tables.length,
    });
  } catch (err) {
    logger.error('Erro ao listar tabelas Supabase (temp)', {
      error: err.message,
      userId: req.session?.userId,
    });

    return res.status(500).json({
      success: false,
      error: 'Erro ao listar tabelas',
      message: err.userMessage || err.message,
    });
  }
});

// POST /api/database-connections/supabase/columns - Obter colunas com credenciais temporárias
router.post('/supabase/columns', async (req, res) => {
  const { supabase_url, supabase_key, supabase_key_type, table_name } = req.body;

  if (!table_name) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      message: 'Nome da tabela é obrigatório',
    });
  }

  // Validate input - use credentials-only validation (no name required for temp credentials)
  const validation = validateSupabaseCredentials({
    supabase_url,
    supabase_key,
    supabase_key_type,
  });

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      message: validation.errors.join('; '),
    });
  }

  try {
    // Log credential access
    securityLogger.logSensitiveDataAccess({
      userId: req.session?.userId,
      ip: req.ip,
      resource: 'supabase_credentials:temp',
      action: 'get_columns_temp_credentials',
    });

    const columns = await SupabaseConnectionService.getTableColumns(
      { supabase_url, supabase_key, supabase_key_type },
      table_name
    );

    res.json({
      success: true,
      data: columns,
      count: columns.length,
    });
  } catch (err) {
    logger.error('Erro ao obter colunas Supabase (temp)', {
      table: table_name,
      error: err.message,
      userId: req.session?.userId,
    });

    if (err.code === 'SUPABASE_TABLE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: 'Tabela não encontrada',
        code: err.code,
        message: err.userMessage,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao obter colunas',
      message: err.userMessage || err.message,
    });
  }
});

module.exports = router;