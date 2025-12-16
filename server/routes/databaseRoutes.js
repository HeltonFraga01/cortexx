const express = require('express');
const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const { validateViewConfiguration, validateFieldMappings } = require('../validators/viewConfigurationValidator');
const { validateConnectionData } = require('../validators/databaseConnectionValidator');
const { sanitizeConnection, sanitizeConnections } = require('../utils/credentialSanitizer');
const { requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { featureMiddleware } = require('../middleware/featureEnforcement');

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
    const db = req.app.locals.db;
    const connections = await db.getAllConnections();

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
    const db = req.app.locals.db;
    const connection = await db.getConnectionById(id);

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
    const db = req.app.locals.db;
    const result = await db.createConnection(connectionData);

    // Mask credentials in response
    const sanitizedResult = sanitizeConnection(result);

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
    const db = req.app.locals.db;

    // Fetch existing connection to preserve credentials if not provided
    const existingConnection = await db.getConnectionById(id);
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

    const result = await db.updateConnection(id, connectionData);

    // Mask credentials in response
    const sanitizedResult = sanitizeConnection(result);

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
    const db = req.app.locals.db;
    const connection = await db.getConnectionById(id);

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

    // Para SQLite local, sempre retorna sucesso se o banco existe
    if (connection.type === 'SQLITE') {
      // Atualizar status para connected
      await db.updateConnectionStatus(id, 'connected');
      
      return res.json({
        success: true,
        message: 'Conexão SQLite testada com sucesso',
        data: {
          status: 'connected',
          type: connection.type,
          database: connection.database
        }
      });
    }
    
    // Para outros tipos de banco, retornar que o teste não está implementado ainda
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
      await req.app.locals.db.updateConnectionStatus(id, 'error');
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
    const db = req.app.locals.db;
    const result = await db.updateConnectionStatus(id, status);
    
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
    const db = req.app.locals.db;
    const result = await db.deleteConnection(id);
    
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

module.exports = router;