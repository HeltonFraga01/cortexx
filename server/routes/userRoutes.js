const express = require('express');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const verifyUserToken = require('../middleware/verifyUserToken');

const router = express.Router();

// GET /api/user/messages - Buscar histórico de mensagens do usuário
router.get('/messages', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { limit = 50, offset = 0 } = req.query;
  
  try {
    const db = req.app.locals.db;
    
    // Buscar mensagens reais do banco de dados
    const messages = await db.getMessageHistory(userToken, parseInt(limit), parseInt(offset));
    
    // Buscar total de mensagens para paginação
    const totalCount = await db.getMessageCount(userToken, 'all');
    
    // Formatar mensagens para o formato esperado pelo frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id.toString(),
      phone: msg.phone,
      message: msg.message,
      timestamp: msg.created_at,
      status: msg.status,
      type: msg.message_type
    }));
    
    res.json({
      success: true,
      data: {
        messages: formattedMessages,
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar mensagens:', error.message);
    
    res.json({
      success: true,
      data: {
        messages: [],
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  }
});

// GET /api/user/dashboard-stats - Buscar estatísticas do dashboard do usuário
router.get('/dashboard-stats', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  
  try {
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    const db = req.app.locals.db;
    
    // Buscar status da sessão
    const sessionResponse = await axios.get(`${wuzapiBaseUrl}/session/status`, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    const sessionData = sessionResponse.data?.data || {};
    
    const connected = sessionData.connected || false;
    const loggedIn = sessionData.loggedIn || false;
    
    // Buscar contagem real de mensagens enviadas hoje
    const messagesCount = await db.getMessageCount(userToken, 'today');
    
    // Estatísticas baseadas no status da sessão e dados reais
    const stats = {
      messagesCount: messagesCount,
      connectionsCount: connected ? 1 : 0,
      sessionStatus: {
        connected: connected,
        loggedIn: loggedIn,
        jid: sessionData.jid || null
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Erro ao buscar estatísticas do dashboard:', error.message);
    
    res.json({
      success: true,
      data: {
        messagesCount: 0,
        connectionsCount: 0,
        sessionStatus: {
          connected: false,
          loggedIn: false,
          jid: null
        }
      }
    });
  }
});

// GET /api/user/database-connections - Buscar conexões atribuídas ao usuário
router.get('/database-connections', verifyUserToken, async (req, res) => {
  // Usar userId (hash) para buscar conexões, pois é assim que são atribuídas pelo admin
  const userId = req.userId;
  
  try {
    const db = req.app.locals.db;
    const connections = await db.getUserConnections(userId);
    
    res.json({
      success: true,
      data: connections,
      count: connections.length
    });
  } catch (err) {
    logger.error('Erro ao buscar conexões do usuário:', err.message);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: err.message 
    });
  }
});

// GET /api/user/database-connections/:id - Buscar conexão específica por ID (com validação de acesso)
router.get('/database-connections/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    logger.info('Solicitação de conexão específica:', { 
      connectionId: id, 
      userId: userId?.substring(0, 8) + '...' 
    });
    
    const db = req.app.locals.db;
    
    // Buscar a conexão
    const connection = await db.getConnectionById(parseInt(id));
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Conexão não encontrada',
        code: 'CONNECTION_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validar se o usuário tem acesso à conexão
    const hasAccess = db.validateUserConnectionAccess(userId, connection);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta conexão',
        code: 'ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: connection,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Erro ao buscar conexão específica:', { 
      connectionId: req.params.id,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/user/database-connections/:id/record - Buscar registro único do usuário
router.get('/database-connections/:id/record', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;
    
    logger.info('📊 Solicitação de registro único do usuário:', { 
      connectionId: id, 
      userToken: userToken.substring(0, 8) + '...' 
    });
    
    const db = req.app.locals.db;
    
    // Buscar configuração da conexão
    const connection = await db.getConnectionById(parseInt(id));
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
        code: 'CONNECTION_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validar usuário e obter ID
    let userId;
    try {
      userId = await db.validateUserAndGetId(userToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'UNAUTHORIZED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Verificar se o usuário tem acesso a esta conexão
    if (!db.validateUserConnectionAccess(userId, connection)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this connection',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString()
      });
    }
    
    // Buscar o registro do usuário usando o campo de vínculo
    const userLinkField = connection.user_link_field || connection.userLinkField;
    
    if (!userLinkField) {
      return res.status(400).json({
        success: false,
        error: 'User link field not configured for this connection',
        code: 'INVALID_CONFIGURATION',
        timestamp: new Date().toISOString()
      });
    }
    
    // Buscar registro baseado no tipo de banco
    let record = null;
    
    try {
      if (connection.type === 'NOCODB') {
        record = await db.fetchNocoDBUserRecord(connection, userLinkField, userToken);
      } else if (connection.type === 'SQLITE') {
        record = await db.fetchSQLiteUserRecord(connection, userLinkField, userToken);
      } else if (connection.type === 'MYSQL' || connection.type === 'POSTGRESQL' || connection.type === 'POSTGRES') {
        record = await db.fetchSQLUserRecord(connection, userLinkField, userToken);
      } else {
        return res.status(400).json({
          success: false,
          error: `Database type not supported: ${connection.type}`,
          code: 'UNSUPPORTED_TYPE',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('❌ Erro ao buscar registro do usuário:', { 
        connectionId: id, 
        error: error.message,
        stack: error.stack 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user record',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'No record found for this user',
        code: 'RECORD_NOT_FOUND',
        suggestion: 'Contact administrator to create a record for your account',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: record,
      metadata: {
        connectionId: parseInt(id),
        connectionName: connection.name,
        tableName: connection.table_name || connection.nocodb_table_id,
        userLinkField: userLinkField
      }
    });
    
  } catch (error) {
    logger.error('❌ Erro ao buscar registro do usuário:', { 
      connectionId: req.params.id, 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/user/database-connections/:id/data - Buscar dados da tabela para o usuário
router.get('/database-connections/:id/data', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;
    
    logger.info('Solicitação de dados da tabela:', { 
      connectionId: id, 
      userToken: userToken.substring(0, 8) + '...' 
    });
    
    const db = req.app.locals.db;
    const data = await db.getUserTableData(userToken, parseInt(id));
    
    res.json({
      success: true,
      data: data,
      metadata: {
        totalRecords: data.length,
        connectionId: parseInt(id),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar dados da tabela:', { 
      connectionId: req.params.id, 
      error: error.message
    });
    
    let statusCode = 500;
    let errorType = 'Internal Server Error';
    
    if (error.message.includes('Connection not found')) {
      statusCode = 404;
      errorType = 'Not Found';
    } else if (error.message.includes('Access denied')) {
      statusCode = 403;
      errorType = 'Forbidden';
    } else if (error.message.includes('Invalid or expired token')) {
      statusCode = 401;
      errorType = 'Unauthorized';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/user/database-connections/:id/data - Criar registro na tabela do usuário
router.post('/database-connections/:id/data', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;
    const recordData = req.body;
    
    const db = req.app.locals.db;
    const result = await db.createUserTableRecord(userToken, id, recordData);
    
    res.status(201).json({
      success: true,
      message: 'Registro criado com sucesso',
      data: result
    });
  } catch (err) {
    logger.error('Erro ao criar registro:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message,
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/user/database-connections/:id/data/:recordId - Buscar registro específico por ID
router.get('/database-connections/:id/data/:recordId', verifyUserToken, async (req, res) => {
  try {
    const { id, recordId } = req.params;
    const userToken = req.userToken;
    
    logger.info('Solicitação de registro específico:', { 
      connectionId: id, 
      recordId,
      userToken: userToken.substring(0, 8) + '...' 
    });
    
    const db = req.app.locals.db;
    const record = await db.getUserTableRecordById(userToken, parseInt(id), recordId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado',
        code: 'RECORD_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: record,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Erro ao buscar registro específico:', { 
      connectionId: req.params.id,
      recordId: req.params.recordId,
      error: error.message
    });
    
    let statusCode = 500;
    let errorType = 'Internal Server Error';
    
    if (error.message.includes('Connection not found')) {
      statusCode = 404;
      errorType = 'Not Found';
    } else if (error.message.includes('Access denied')) {
      statusCode = 403;
      errorType = 'Forbidden';
    } else if (error.message.includes('Invalid or expired token')) {
      statusCode = 401;
      errorType = 'Unauthorized';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/user/database-connections/:id/data/:recordId - Atualizar registro na tabela do usuário
router.put('/database-connections/:id/data/:recordId', verifyUserToken, async (req, res) => {
  try {
    const { id, recordId } = req.params;
    const userToken = req.userToken;
    const recordData = req.body;
    
    const db = req.app.locals.db;
    const result = await db.updateUserTableRecord(userToken, id, recordId, recordData);
    
    res.json({
      success: true,
      message: 'Registro atualizado com sucesso',
      data: result
    });
  } catch (err) {
    logger.error('Erro ao atualizar registro:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message,
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/user/database-connections/:id/data/:recordId - Deletar registro na tabela do usuário
router.delete('/database-connections/:id/data/:recordId', verifyUserToken, async (req, res) => {
  try {
    const { id, recordId } = req.params;
    const userToken = req.userToken;
    
    const db = req.app.locals.db;
    const result = await db.deleteUserTableRecord(userToken, id, recordId);
    
    res.json({
      success: true,
      message: 'Registro deletado com sucesso',
      data: result
    });
  } catch (err) {
    logger.error('Erro ao deletar registro:', err.message);
    res.status(500).json({ 
      success: false,
      error: err.message,
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/user/scheduled-messages - Buscar mensagens únicas agendadas
router.get('/scheduled-messages', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { instance } = req.query;
  
  try {
    const db = req.app.locals.db;
    const messages = await db.getScheduledSingleMessages(userToken, instance);
    
    res.json({
      success: true,
      messages,
      count: messages.length
    });
  } catch (error) {
    logger.error('Erro ao buscar mensagens agendadas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar mensagens agendadas',
      message: error.message
    });
  }
});

// DELETE /api/user/scheduled-messages/:id - Cancelar mensagem agendada
router.delete('/scheduled-messages/:id', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { id } = req.params;
  
  try {
    const db = req.app.locals.db;
    await db.cancelScheduledSingleMessage(id, userToken);
    
    res.json({
      success: true,
      message: 'Mensagem agendada cancelada com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao cancelar mensagem agendada:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao cancelar mensagem agendada',
      message: error.message
    });
  }
});

// DELETE /api/user/messages - Deletar mensagens do histórico
router.delete('/messages', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { messageIds } = req.body;
  
  try {
    const db = req.app.locals.db;
    const deletedCount = await db.deleteMessages(userToken, messageIds);
    
    res.json({
      success: true,
      message: `${deletedCount} mensagem(ns) deletada(s) com sucesso`,
      data: { deletedCount }
    });
  } catch (error) {
    logger.error('Erro ao deletar mensagens:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar mensagens',
      message: error.message
    });
  }
});

// GET /api/user/templates - Buscar templates do usuário
router.get('/templates', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  
  try {
    const db = req.app.locals.db;
    const templates = await db.getTemplates(userToken);
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Erro ao buscar templates:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar templates',
      message: error.message
    });
  }
});

// POST /api/user/templates - Criar novo template
router.post('/templates', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { name, content } = req.body;
  
  if (!name || !content) {
    return res.status(400).json({
      success: false,
      error: 'Nome e conteúdo são obrigatórios'
    });
  }
  
  try {
    // Validar variações se houver
    const variationParser = require('../services/VariationParser');
    const validation = variationParser.validate(content);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Template com variações inválidas',
        message: 'Corrija os erros de sintaxe nas variações',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    const db = req.app.locals.db;
    const hasVariations = content.includes('|') && validation.blockCount > 0;
    const templateId = await db.createTemplate(userToken, name, content, hasVariations);
    
    res.status(201).json({
      success: true,
      message: 'Template criado com sucesso',
      data: { 
        id: templateId, 
        name, 
        content,
        hasVariations,
        variationInfo: hasVariations ? {
          blockCount: validation.blockCount,
          totalCombinations: validation.totalCombinations
        } : null
      }
    });
  } catch (error) {
    logger.error('Erro ao criar template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar template',
      message: error.message
    });
  }
});

// PUT /api/user/templates/:id - Atualizar template
router.put('/templates/:id', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { id } = req.params;
  const { name, content } = req.body;
  
  if (!name || !content) {
    return res.status(400).json({
      success: false,
      error: 'Nome e conteúdo são obrigatórios'
    });
  }
  
  try {
    // Validar variações se houver
    const variationParser = require('../services/VariationParser');
    const validation = variationParser.validate(content);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Template com variações inválidas',
        message: 'Corrija os erros de sintaxe nas variações',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    const db = req.app.locals.db;
    const hasVariations = content.includes('|') && validation.blockCount > 0;
    const updated = await db.updateTemplate(userToken, parseInt(id), name, content, hasVariations);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Template atualizado com sucesso',
      data: { 
        id: parseInt(id), 
        name, 
        content,
        hasVariations,
        variationInfo: hasVariations ? {
          blockCount: validation.blockCount,
          totalCombinations: validation.totalCombinations
        } : null
      }
    });
  } catch (error) {
    logger.error('Erro ao atualizar template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar template',
      message: error.message
    });
  }
});

// DELETE /api/user/templates/:id - Deletar template
router.delete('/templates/:id', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { id } = req.params;
  
  try {
    const db = req.app.locals.db;
    const deleted = await db.deleteTemplate(userToken, parseInt(id));
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Template deletado com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao deletar template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar template',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINTS DE VARIAÇÕES DE MENSAGEM
// ============================================================================

const variationParser = require('../services/VariationParser');
const templateProcessor = require('../services/TemplateProcessor');
const variationTracker = require('../services/VariationTracker');

/**
 * POST /api/user/messages/validate-variations
 * Valida um template com variações
 */
router.post('/messages/validate-variations', verifyUserToken, async (req, res) => {
  try {
    const { template } = req.body;

    // Validar entrada
    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Template inválido',
        message: 'Campo template é obrigatório e deve ser uma string'
      });
    }

    // Validar template
    const result = variationParser.parse(template);

    // Formatar resposta
    const response = {
      success: true,
      data: {
        isValid: result.isValid,
        blocks: result.blocks.map(block => ({
          index: block.index,
          variations: block.variations,
          variationCount: block.variationCount
        })),
        totalCombinations: result.totalCombinations,
        errors: result.errors,
        warnings: result.warnings,
        metadata: {
          blockCount: result.blocks.length,
          hasStaticText: result.metadata.hasStaticText
        }
      }
    };

    logger.info('Template validado', {
      userToken: req.userToken,
      isValid: result.isValid,
      blocks: result.blocks.length,
      combinations: result.totalCombinations
    });

    res.json(response);

  } catch (error) {
    logger.error('Erro ao validar variações:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao validar template',
      message: error.message
    });
  }
});

/**
 * POST /api/user/messages/preview-variations
 * Gera preview de mensagem com variações
 */
router.post('/messages/preview-variations', verifyUserToken, async (req, res) => {
  try {
    const { template, variables = {}, count = 3 } = req.body;

    // Validar entrada
    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Template inválido',
        message: 'Campo template é obrigatório e deve ser uma string'
      });
    }

    if (count < 1 || count > 10) {
      return res.status(400).json({
        success: false,
        error: 'Count inválido',
        message: 'Count deve estar entre 1 e 10'
      });
    }

    // Gerar previews
    const previews = templateProcessor.generatePreview(template, variables, count);

    // Verificar se houve erro
    if (previews.length > 0 && !previews[0].success) {
      return res.status(400).json({
        success: false,
        error: 'Erro ao gerar preview',
        errors: previews[0].errors,
        warnings: previews[0].warnings
      });
    }

    // Formatar resposta
    const response = {
      success: true,
      data: {
        previews: previews.map(p => ({
          index: p.previewIndex,
          message: p.finalMessage,
          selections: p.selections,
          hasVariations: p.metadata.hasVariations,
          hasVariables: p.metadata.hasVariables
        })),
        count: previews.length
      }
    };

    logger.info('Previews gerados', {
      userToken: req.userToken,
      count: previews.length
    });

    res.json(response);

  } catch (error) {
    logger.error('Erro ao gerar preview:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar preview',
      message: error.message
    });
  }
});

/**
 * GET /api/user/campaigns/:campaignId/variation-stats
 * Obtém estatísticas de variações de uma campanha
 */
router.get('/campaigns/:campaignId/variation-stats', verifyUserToken, async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'campaignId é obrigatório'
      });
    }

    // Obter estatísticas
    const stats = await variationTracker.getStats(campaignId);

    // Formatar resposta
    const response = {
      success: true,
      data: stats
    };

    logger.info('Estatísticas de variações obtidas', {
      userToken: req.userToken,
      campaignId,
      totalMessages: stats.totalMessages
    });

    res.json(response);

  } catch (error) {
    logger.error('Erro ao obter estatísticas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estatísticas',
      message: error.message
    });
  }
});

/**
 * GET /api/user/campaigns/:campaignId/variation-stats/export
 * Exporta estatísticas de variações em JSON ou CSV
 */
router.get('/campaigns/:campaignId/variation-stats/export', verifyUserToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { format = 'json' } = req.query;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'campaignId é obrigatório'
      });
    }

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Formato inválido',
        message: 'Formato deve ser json ou csv'
      });
    }

    // Exportar dados
    const exportedData = await variationTracker.exportData(campaignId, format);

    // Configurar headers de download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `variation-stats-${campaignId}-${timestamp}.${format}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportedData);
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportedData);
    }

    logger.info('Estatísticas exportadas', {
      userToken: req.userToken,
      campaignId,
      format
    });

  } catch (error) {
    logger.error('Erro ao exportar estatísticas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao exportar estatísticas',
      message: error.message
    });
  }
});

// GET /api/user/messages/stats - Obter estatisticas de mensagens unicas
router.get('/messages/stats', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { period = 'all' } = req.query; // all, today, week, month
  
  try {
    const db = req.app.locals.db;
    
    // Definir filtro de data
    let dateFilter = '';
    switch (period) {
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
    
    // Buscar estatisticas gerais
    const statsSql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN message_type = 'text' THEN 1 ELSE 0 END) as text_messages,
        SUM(CASE WHEN message_type = 'media' THEN 1 ELSE 0 END) as media_messages
      FROM sent_messages
      WHERE user_token = ? ${dateFilter}
    `;
    
    const statsResult = await db.query(statsSql, [userToken]);
    const stats = statsResult.rows[0];
    
    // Buscar mensagens por dia (ultimos 7 dias)
    const dailySql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM sent_messages
      WHERE user_token = ?
      AND created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    
    const dailyResult = await db.query(dailySql, [userToken]);
    const dailyStats = dailyResult.rows;
    
    // Buscar mensagens agendadas pendentes
    const scheduledSql = `
      SELECT COUNT(*) as count
      FROM scheduled_single_messages
      WHERE user_token = ?
      AND status = 'pending'
    `;
    
    const scheduledResult = await db.query(scheduledSql, [userToken]);
    const scheduledCount = scheduledResult.rows[0]?.count || 0;
    
    res.json({
      success: true,
      data: {
        summary: {
          total: stats.total || 0,
          sent: stats.sent || 0,
          failed: stats.failed || 0,
          successRate: stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(2) : 0,
          textMessages: stats.text_messages || 0,
          mediaMessages: stats.media_messages || 0,
          scheduled: scheduledCount
        },
        daily: dailyStats,
        period
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar estatisticas de mensagens:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatisticas',
      message: error.message
    });
  }
});

// POST /api/user/avatar - Buscar foto de perfil do WhatsApp
router.post('/avatar', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { Phone, Preview = true } = req.body;
  
  if (!Phone) {
    return res.status(400).json({
      success: false,
      error: 'Número de telefone é obrigatório',
      code: 'MISSING_PHONE'
    });
  }
  
  try {
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    // A API WUZAPI aceita POST para /user/avatar (testado com n8n)
    const response = await axios({
      method: 'POST',
      url: `${wuzapiBaseUrl}/user/avatar`,
      headers: {
        'token': userToken,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      data: { Phone, Preview },
      timeout: 10000
    });
    
    logger.info('Avatar response:', {
      phone: Phone,
      success: response.data?.success,
      hasUrl: !!response.data?.data?.url
    });
    
    const avatarData = response.data?.data || response.data;
    
    res.json({
      success: true,
      data: avatarData
    });
    
  } catch (error) {
    logger.error('Erro ao buscar avatar:', {
      phone: Phone,
      error: error.message,
      status: error.response?.status
    });
    
    // Retornar erro sem expor detalhes sensíveis
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: 'Erro ao buscar foto de perfil',
      message: status === 404 ? 'Foto de perfil não encontrada' : error.message,
      code: status === 404 ? 'AVATAR_NOT_FOUND' : 'AVATAR_ERROR'
    });
  }
});

module.exports = router;
