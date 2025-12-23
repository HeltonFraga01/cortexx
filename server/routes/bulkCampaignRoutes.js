const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const ReportGenerator = require('../services/ReportGenerator');
const AuditLogger = require('../services/AuditLogger');
const { normalizePhoneNumber } = require('../utils/phoneUtils');
const {
  validateCampaignCreation,
  validateCampaignId,
  validatePaginationParams,
  sanitizeCampaignName,
  sanitizeMessageContent
} = require('../validators/bulkCampaignValidator');
const { validateToken, extractToken } = require('../middleware/tokenValidator');
const {
  campaignCreationLimiter,
  campaignOperationLimiter,
  campaignProgressLimiter
} = require('../middleware/campaignRateLimiter');
const { featureMiddleware } = require('../middleware/featureEnforcement');
const { quotaMiddleware } = require('../middleware/quotaEnforcement');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');

const router = express.Router();

/**
 * Helper to get AuditLogger instance
 * @param {Object} req - Express request
 * @returns {AuditLogger|null}
 */
function getAuditLogger(req) {
  const db = req.app.locals.db;
  if (!db) return null;
  return new AuditLogger(db);
}

/**
 * Bulk Campaign Routes
 * Handles bulk message campaign operations
 * 
 * UPDATED: Now uses inboxContextMiddleware to get wuzapiToken from the active inbox
 * instead of the accounts table. This ensures the correct token is used when
 * users have multiple inboxes.
 * 
 * Requirements: 8.3 (Update Envio de Mensagens to use InboxContext)
 */

/**
 * Middleware para verificar token do usuário usando InboxContext
 * Usa o token da inbox ativa em vez do token da account
 */
const verifyUserTokenWithInbox = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      await new Promise((resolve, reject) => {
        validateSupabaseToken(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        inboxContextMiddleware({ required: false, useCache: true })(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      if (req.context?.wuzapiToken) {
        req.userToken = req.context.wuzapiToken;
        req.userId = req.user?.id;
        req.inboxId = req.context.inboxId;
        
        logger.debug('WUZAPI token obtained from inbox context for bulk campaign', {
          userId: req.userId?.substring(0, 8) + '...',
          inboxId: req.inboxId?.substring(0, 8) + '...',
          hasToken: true
        });
        
        return next();
      }
      
      if (req.user?.id) {
        logger.warn('No inbox context available for bulk campaign user', {
          userId: req.user.id.substring(0, 8) + '...',
          path: req.path
        });
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for bulk campaign, trying other methods', { 
        error: error.message,
        path: req.path
      });
    }
  }
  
  const tokenHeader = req.headers.token;
  if (tokenHeader) {
    req.userToken = tokenHeader;
    return next();
  }
  
  if (req.session?.userToken) {
    req.userToken = req.session.userToken;
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: {
      code: 'NO_TOKEN',
      message: 'Token não fornecido. Use Authorization Bearer, header token ou sessão ativa.'
    }
  });
};

const verifyUserToken = verifyUserTokenWithInbox;

// POST /api/user/bulk-campaigns - Criar nova campanha
// Rate limited: 10 requests per minute per user
// Feature: bulk_campaigns required
router.post('/', campaignCreationLimiter, verifyUserToken, featureMiddleware.bulkCampaigns, quotaMiddleware.campaigns, async (req, res) => {
  try {
    const userToken = req.userToken;
    const {
      name,
      instance,
      inboxes,
      messageType,
      messageContent,
      mediaUrl,
      mediaType,
      mediaFileName,
      delayMin,
      delayMax,
      randomizeOrder,
      isScheduled,
      scheduledAt,
      contacts,
      messages,
      sendingWindow
    } = req.body;

    // Validar dados da campanha
    const validation = validateCampaignCreation(req.body);

    if (!validation.valid) {
      logger.warn('Validação de campanha falhou', {
        errors: validation.errors,
        userToken: userToken.substring(0, 8) + '...',
        receivedData: {
          hasName: !!req.body.name,
          nameLength: req.body.name?.length,
          hasInstance: !!req.body.instance,
          hasMessageType: !!req.body.messageType,
          hasMessageContent: !!req.body.messageContent,
          messageContentLength: req.body.messageContent?.length,
          contactsCount: req.body.contacts?.length,
          hasContacts: Array.isArray(req.body.contacts),
          delayMin: req.body.delayMin,
          delayMax: req.body.delayMax
        }
      });

      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'Por favor, corrija os erros abaixo',
        errors: validation.errors
      });
    }

    // Sanitizar dados
    const sanitizedName = sanitizeCampaignName(name);
    const sanitizedContent = sanitizeMessageContent(messageContent);

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    // Gerar ID único para campanha (UUID)
    const campaignId = uuidv4();

    // Criar campanha no banco
    const insertCampaignSql = `
      INSERT INTO bulk_campaigns (
        id, name, instance, user_token, status, message_type, message_content,
        media_url, media_type, media_file_name, delay_min, delay_max,
        randomize_order, is_scheduled, scheduled_at, total_contacts,
        messages, sending_window, inboxes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Campanhas não agendadas devem ter scheduled_at = now para serem processadas imediatamente
    const effectiveScheduledAt = isScheduled ? scheduledAt : new Date().toISOString();
    const status = 'scheduled';

    // Serialize inboxes array if provided
    const inboxesJson = inboxes && Array.isArray(inboxes) ? JSON.stringify(inboxes) : null;

    await db.query(insertCampaignSql, [
      campaignId,
      sanitizedName,
      instance,
      userToken,
      status,
      messageType,
      sanitizedContent,
      mediaUrl || null,
      mediaType || null,
      mediaFileName || null,
      delayMin,
      delayMax,
      randomizeOrder ? 1 : 0,
      isScheduled ? 1 : 0,
      effectiveScheduledAt,
      contacts.length,
      messages ? JSON.stringify(messages) : null,
      sendingWindow ? JSON.stringify(sendingWindow) : null,
      inboxesJson
    ]);

    // Inserir contatos
    const insertContactSql = `
      INSERT INTO campaign_contacts (
        campaign_id, phone, name, variables, status, processing_order
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      // Normalizar o número antes de salvar
      const normalizedPhone = normalizePhoneNumber(contact.phone);

      await db.query(insertContactSql, [
        campaignId,
        normalizedPhone,
        contact.name || null,
        JSON.stringify(contact.variables || {}),
        'pending',
        i
      ]);
    }

    logger.info('Campanha criada', {
      campaignId,
      name,
      instance,
      inboxCount: inboxes?.length || 1,
      totalContacts: contacts.length,
      isScheduled
    });

    // Audit log for campaign creation
    const auditLogger = getAuditLogger(req);
    if (auditLogger) {
      auditLogger.log({
        campaignId,
        userId: req.session?.userId || userToken,
        action: 'create',
        details: {
          name: sanitizedName,
          totalContacts: contacts.length,
          isScheduled,
          messageType
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => logger.warn('Failed to log audit entry', { error: err.message }));
    }

    // Se não for agendada, iniciar imediatamente
    if (!isScheduled && scheduler) {
      scheduler.startCampaignNow(campaignId).catch(error => {
        logger.error('Erro ao iniciar campanha:', {
          campaignId,
          error: error.message
        });
      });
    }

    res.status(201).json({
      success: true,
      campaignId,
      status: isScheduled ? 'scheduled' : 'starting',
      message: isScheduled
        ? 'Campanha agendada com sucesso'
        : 'Campanha iniciada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao criar campanha:', error.message);
    res.status(500).json({
      error: 'Erro ao criar campanha',
      message: error.message
    });
  }
});

// GET /api/user/bulk-campaigns/active - Listar campanhas ativas
router.get('/active', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { instance } = req.query;

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    let sql = `
      SELECT * FROM bulk_campaigns 
      WHERE user_token = ? 
      AND status IN ('scheduled', 'running', 'paused')
    `;

    const params = [userToken];

    if (instance) {
      sql += ' AND instance = ?';
      params.push(instance);
    }

    sql += ' ORDER BY created_at DESC';

    const { rows } = await db.query(sql, params);

    // Enriquecer com progresso em tempo real
    const campaigns = rows.map(campaign => {
      const queue = scheduler?.getActiveQueue(campaign.id);
      const progress = queue ? queue.getProgress() : null;

      // Parse sending_window se existir
      let sendingWindow = null;
      if (campaign.sending_window) {
        try {
          sendingWindow = JSON.parse(campaign.sending_window);
        } catch {
          sendingWindow = null;
        }
      }

      return {
        id: campaign.id,
        name: campaign.name,
        instance: campaign.instance,
        status: campaign.status,
        messageType: campaign.message_type,
        totalContacts: campaign.total_contacts,
        sentCount: campaign.sent_count,
        failedCount: campaign.failed_count,
        currentIndex: campaign.current_index,
        createdAt: campaign.created_at,
        startedAt: campaign.started_at,
        isScheduled: campaign.is_scheduled === 1,
        scheduledAt: campaign.scheduled_at,
        delayMin: campaign.delay_min,
        delayMax: campaign.delay_max,
        sendingWindow: sendingWindow,
        progress: progress ? progress.stats : null
      };
    });

    res.json({
      success: true,
      campaigns
    });

  } catch (error) {
    logger.error('Erro ao listar campanhas ativas:', error.message);
    res.status(500).json({
      error: 'Erro ao listar campanhas',
      message: error.message
    });
  }
});

// GET /api/user/bulk-campaigns/:id/progress - Obter progresso de campanha
router.get('/:id/progress', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    // Validar ID da campanha
    const idValidation = validateCampaignId(id);
    if (!idValidation.valid) {
      return res.status(400).json({
        error: 'ID inválido',
        message: idValidation.error
      });
    }

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada'
      });
    }

    const campaign = rows[0];

    // Tentar obter progresso em tempo real (usar enhanced se disponível)
    const queue = scheduler?.getActiveQueue(id);
    const liveProgress = queue ? queue.getEnhancedProgress() : null;

    // Se não há progresso em tempo real, buscar contato atual do banco
    let currentContact = null;
    if (!liveProgress && (campaign.status === 'running' || campaign.status === 'paused')) {
      // Buscar o contato que está sendo processado (baseado no current_index)
      const contactSql = `
        SELECT phone, name, variables, processing_order
        FROM campaign_contacts 
        WHERE campaign_id = ? AND status = 'pending'
        ORDER BY processing_order ASC
        LIMIT 1
      `;
      const { rows: contactRows } = await db.query(contactSql, [id]);
      if (contactRows.length > 0) {
        currentContact = {
          phone: contactRows[0].phone,
          name: contactRows[0].name,
          variables: contactRows[0].variables ? JSON.parse(contactRows[0].variables) : {},
          position: contactRows[0].processing_order + 1
        };
      }
    }
    
    // Buscar erros recentes para exibição
    let recentErrors = [];
    const errorsSql = `
      SELECT phone, name, error_type, error_message, sent_at
      FROM campaign_contacts 
      WHERE campaign_id = ? AND status = 'failed'
      ORDER BY id DESC
      LIMIT 5
    `;
    const { rows: errorRows } = await db.query(errorsSql, [id]);
    if (errorRows.length > 0) {
      recentErrors = errorRows.map(row => ({
        contactPhone: row.phone,
        contactName: row.name,
        errorType: row.error_type || 'UNKNOWN',
        errorMessage: row.error_message || 'Erro desconhecido',
        timestamp: row.sent_at
      }));
    }

    // Construir resposta com dados do banco se não houver progresso em tempo real
    const fallbackProgress = {
      campaignId: id,
      status: campaign.status,
      stats: {
        total: campaign.total_contacts,
        sent: campaign.sent_count,
        pending: campaign.total_contacts - campaign.current_index,
        failed: campaign.failed_count,
        successRate: campaign.total_contacts > 0
          ? (campaign.sent_count / campaign.total_contacts) * 100
          : 0
      },
      currentIndex: campaign.current_index,
      currentContact: currentContact,
      startedAt: campaign.started_at,
      completedAt: campaign.completed_at,
      // Enhanced fields with data from DB
      enhanced: {
        estimatedTimeRemaining: null,
        averageSpeed: 0,
        elapsedTime: null,
        recentErrors: recentErrors
      }
    };

    res.json({
      success: true,
      progress: liveProgress || fallbackProgress
    });

  } catch (error) {
    logger.error('Erro ao obter progresso:', error.message);
    res.status(500).json({
      error: 'Erro ao obter progresso',
      message: error.message
    });
  }
});

// POST /api/user/bulk-campaigns/:id/pause - Pausar campanha
router.post('/:id/pause', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada'
      });
    }

    if (!scheduler) {
      return res.status(503).json({
        error: 'Scheduler não disponível'
      });
    }

    await scheduler.pauseCampaign(id);

    logger.info('Campanha pausada via API', { campaignId: id });

    // Audit log for pause
    const auditLogger = getAuditLogger(req);
    if (auditLogger) {
      auditLogger.log({
        campaignId: id,
        userId: req.session?.userId || userToken,
        action: 'pause',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => logger.warn('Failed to log audit entry', { error: err.message }));
    }

    res.json({
      success: true,
      status: 'paused',
      message: 'Campanha pausada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao pausar campanha:', error.message);
    res.status(500).json({
      error: 'Erro ao pausar campanha',
      message: error.message
    });
  }
});

// PATCH /api/user/bulk-campaigns/:id/config - Atualizar configuração de campanha
router.patch('/:id/config', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;
    const updates = req.body;

    // Validar ID da campanha
    const idValidation = validateCampaignId(id);
    if (!idValidation.valid) {
      return res.status(400).json({
        error: 'ID inválido',
        message: idValidation.error
      });
    }

    // Validar que há campos para atualizar
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'Nenhum campo fornecido para atualização'
      });
    }

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada',
        message: 'A campanha solicitada não existe ou não pertence a este usuário'
      });
    }

    if (!scheduler) {
      return res.status(503).json({
        error: 'Serviço indisponível',
        message: 'O serviço de agendamento não está disponível no momento'
      });
    }

    // Atualizar configuração via scheduler
    const result = await scheduler.updateCampaignConfig(id, updates);

    logger.info('Configuração de campanha atualizada via API', {
      campaignId: id,
      updatedFields: result.updatedFields,
      userToken: userToken.substring(0, 8) + '...'
    });

    res.json({
      success: true,
      data: {
        campaignId: result.campaignId,
        updatedFields: result.updatedFields,
        message: 'Configurações atualizadas com sucesso'
      }
    });

  } catch (error) {
    logger.error('Erro ao atualizar configuração de campanha:', {
      campaignId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    // Mensagens de erro específicas
    const errorMessage = error.message?.toLowerCase() || '';

    if (errorMessage.includes('não encontrada')) {
      return res.status(404).json({
        error: 'Campanha não encontrada',
        message: error.message
      });
    }

    if (errorMessage.includes('não é possível editar') || errorMessage.includes('status')) {
      return res.status(400).json({
        error: 'Operação inválida',
        message: error.message
      });
    }

    if (errorMessage.includes('não editáveis')) {
      return res.status(400).json({
        error: 'Campos inválidos',
        message: error.message
      });
    }

    if (errorMessage.includes('validação') || errorMessage.includes('inválid')) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: error.message
      });
    }

    // Erro genérico
    res.status(500).json({
      error: 'Erro ao atualizar configuração',
      message: error.message
    });
  }
});

// POST /api/user/bulk-campaigns/:id/resume - Retomar campanha
router.post('/:id/resume', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada',
        message: 'A campanha solicitada não existe ou não pertence a este usuário'
      });
    }

    const campaign = rows[0];

    // Validar status antes de tentar retomar
    if (campaign.status !== 'paused') {
      return res.status(400).json({
        error: 'Operação inválida',
        message: `Não é possível retomar uma campanha com status '${campaign.status}'. Apenas campanhas pausadas podem ser retomadas.`
      });
    }

    if (!scheduler) {
      return res.status(503).json({
        error: 'Serviço indisponível',
        message: 'O serviço de agendamento não está disponível no momento'
      });
    }

    // Tentar retomar
    await scheduler.resumeCampaign(id);

    logger.info('Campanha retomada via API', {
      campaignId: id,
      userToken: userToken.substring(0, 8) + '...'
    });

    // Audit log for resume
    const auditLogger = getAuditLogger(req);
    if (auditLogger) {
      auditLogger.log({
        campaignId: id,
        userId: req.session?.userId || userToken,
        action: 'resume',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => logger.warn('Failed to log audit entry', { error: err.message }));
    }

    res.json({
      success: true,
      status: 'running',
      message: 'Campanha retomada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao retomar campanha:', {
      campaignId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    // Mensagens de erro específicas baseadas no tipo de erro
    const errorMessage = error.message?.toLowerCase() || '';

    if (errorMessage.includes('não encontrada')) {
      return res.status(404).json({
        error: 'Campanha não encontrada',
        message: error.message
      });
    }

    if (errorMessage.includes('não está pausada')) {
      return res.status(400).json({
        error: 'Operação inválida',
        message: error.message
      });
    }

    if (errorMessage.includes('não está conectada') || errorMessage.includes('whatsapp')) {
      return res.status(503).json({
        error: 'Conexão indisponível',
        message: 'A instância do WhatsApp não está conectada. Conecte-se e tente novamente.'
      });
    }

    if (errorMessage.includes('contatos pendentes')) {
      return res.status(400).json({
        error: 'Sem contatos pendentes',
        message: 'Não há mais contatos pendentes para processar nesta campanha'
      });
    }

    // Erro genérico
    res.status(500).json({
      error: 'Erro ao retomar campanha',
      message: error.message
    });
  }
});

// POST /api/user/bulk-campaigns/:id/cancel - Cancelar campanha
router.post('/:id/cancel', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada'
      });
    }

    const campaign = rows[0];

    // Se a campanha já está cancelada ou concluída, retornar sucesso
    if (campaign.status === 'cancelled' || campaign.status === 'completed') {
      logger.info('Campanha já estava cancelada/concluída', {
        campaignId: id,
        status: campaign.status
      });

      return res.json({
        success: true,
        status: campaign.status,
        message: campaign.status === 'cancelled'
          ? 'Campanha já estava cancelada'
          : 'Campanha já foi concluída'
      });
    }

    if (!scheduler) {
      return res.status(503).json({
        error: 'Scheduler não disponível'
      });
    }

    // Tentar cancelar no scheduler (pode não estar em execução)
    try {
      await scheduler.cancelCampaign(id);
      logger.info('Campanha cancelada via scheduler', { campaignId: id });
    } catch (schedulerError) {
      // Se não está em execução no scheduler, apenas logar
      logger.warn('Campanha não estava em execução no scheduler', {
        campaignId: id,
        error: schedulerError.message
      });
    }

    // SEMPRE atualizar status no banco (independente do scheduler)
    const updateSql = 'UPDATE bulk_campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await db.query(updateSql, ['cancelled', id]);

    logger.info('Campanha cancelada via API', { campaignId: id });

    // Audit log for cancel
    const auditLogger = getAuditLogger(req);
    if (auditLogger) {
      auditLogger.log({
        campaignId: id,
        userId: req.session?.userId || userToken,
        action: 'cancel',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => logger.warn('Failed to log audit entry', { error: err.message }));
    }

    res.json({
      success: true,
      status: 'cancelled',
      message: 'Campanha cancelada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao cancelar campanha:', error.message);
    res.status(500).json({
      error: 'Erro ao cancelar campanha',
      message: error.message
    });
  }
});

// GET /api/user/bulk-campaigns/history - Listar histórico de campanhas
router.get('/history', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { instance } = req.query;

    // Validar parâmetros de paginação
    const paginationValidation = validatePaginationParams(req.query);
    if (!paginationValidation.valid) {
      return res.status(400).json({
        error: 'Parâmetros inválidos',
        message: 'Parâmetros de paginação inválidos',
        errors: paginationValidation.errors
      });
    }

    const { page, limit } = paginationValidation.sanitized;
    const offset = (page - 1) * limit;

    // Build filters for SupabaseService
    const filters = { user_token: userToken };
    if (instance) {
      filters.instance = instance;
    }

    // Get campaigns using SupabaseService
    const supabaseService = require('../services/SupabaseService');
    
    const { data: campaigns, error } = await supabaseService.queryAsAdmin('bulk_campaigns', (query) => {
      let q = query.select('*').eq('user_token', userToken);
      if (instance) {
        q = q.eq('instance', instance);
      }
      return q.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
    });

    if (error) {
      throw new Error(`Failed to fetch campaigns: ${error.message}`);
    }

    // Get total count
    const { data: countData, error: countError } = await supabaseService.queryAsAdmin('bulk_campaigns', (query) => {
      let q = query.select('*', { count: 'exact', head: true }).eq('user_token', userToken);
      if (instance) {
        q = q.eq('instance', instance);
      }
      return q;
    });

    // Handle empty results gracefully
    const total = countError ? 0 : (countData?.length || 0);
    const rows = campaigns || [];

    const formattedCampaigns = rows.map(campaign => {
      // Parse sending_window se existir
      let sendingWindow = null;
      if (campaign.sending_window) {
        try {
          sendingWindow = typeof campaign.sending_window === 'string' 
            ? JSON.parse(campaign.sending_window) 
            : campaign.sending_window;
        } catch {
          sendingWindow = null;
        }
      }

      return {
        id: campaign.id,
        name: campaign.name,
        instance: campaign.instance,
        status: campaign.status,
        messageType: campaign.message_type,
        totalContacts: campaign.total_contacts || 0,
        sentCount: campaign.sent_count || 0,
        failedCount: campaign.failed_count || 0,
        successRate: (campaign.total_contacts || 0) > 0
          ? (((campaign.sent_count || 0) / campaign.total_contacts) * 100).toFixed(2)
          : 0,
        createdAt: campaign.created_at,
        startedAt: campaign.started_at,
        completedAt: campaign.completed_at,
        isScheduled: campaign.is_scheduled === true || campaign.is_scheduled === 1,
        scheduledAt: campaign.scheduled_at,
        delayMin: campaign.delay_min,
        delayMax: campaign.delay_max,
        sendingWindow: sendingWindow
      };
    });

    res.json({
      success: true,
      campaigns: formattedCampaigns,
      total: rows.length,
      items: formattedCampaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: rows.length,
        totalPages: Math.ceil(rows.length / parseInt(limit)) || 1
      }
    });

  } catch (error) {
    logger.error('Erro ao listar histórico:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar histórico',
      message: error.message,
      total: 0,
      items: []
    });
  }
});

// GET /api/user/bulk-campaigns/:id/report - Obter relatório de campanha
router.get('/:id/report', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    const db = req.app.locals.db;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada'
      });
    }

    const reportGenerator = new ReportGenerator(db);
    const report = await reportGenerator.generateReport(id);

    res.json({
      success: true,
      report
    });

  } catch (error) {
    logger.error('Erro ao gerar relatório:', error.message);
    res.status(500).json({
      error: 'Erro ao gerar relatório',
      message: error.message
    });
  }
});

// GET /api/user/bulk-campaigns/:id/report/export - Exportar relatório em CSV
router.get('/:id/report/export', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    const db = req.app.locals.db;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada'
      });
    }

    const campaign = rows[0];
    const reportGenerator = new ReportGenerator(db);
    const csvContent = await reportGenerator.exportToCSV(id);

    // Configurar headers para download
    const fileName = `relatorio-${campaign.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);

  } catch (error) {
    logger.error('Erro ao exportar relatório:', error.message);
    res.status(500).json({
      error: 'Erro ao exportar relatório',
      message: error.message
    });
  }
});

// POST /api/user/bulk-campaigns/compare - Comparar campanhas
router.post('/compare', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { campaignIds } = req.body;

    if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length < 2) {
      return res.status(400).json({
        error: 'IDs inválidos',
        message: 'É necessário fornecer pelo menos 2 IDs de campanhas'
      });
    }

    const db = req.app.locals.db;

    // Verificar se todas as campanhas pertencem ao usuário
    const placeholders = campaignIds.map(() => '?').join(',');
    const sql = `SELECT id FROM bulk_campaigns WHERE id IN (${placeholders}) AND user_token = ?`;
    const { rows } = await db.query(sql, [...campaignIds, userToken]);

    if (rows.length !== campaignIds.length) {
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Uma ou mais campanhas não pertencem a este usuário'
      });
    }

    const reportGenerator = new ReportGenerator(db);
    const comparison = await reportGenerator.compareCampaigns(campaignIds);

    res.json({
      success: true,
      comparison
    });

  } catch (error) {
    logger.error('Erro ao comparar campanhas:', error.message);
    res.status(500).json({
      error: 'Erro ao comparar campanhas',
      message: error.message
    });
  }
});

// DELETE /api/user/bulk-campaigns/:id - Excluir campanha
router.delete('/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    // Validar ID da campanha
    const idValidation = validateCampaignId(id);
    if (!idValidation.valid) {
      return res.status(400).json({
        error: 'ID inválido',
        message: idValidation.error
      });
    }

    const db = req.app.locals.db;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM bulk_campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada'
      });
    }

    const campaign = rows[0];

    // Não permitir exclusão de campanhas em execução
    if (campaign.status === 'running') {
      return res.status(400).json({
        error: 'Operação não permitida',
        message: 'Não é possível excluir uma campanha em execução. Cancele-a primeiro.'
      });
    }

    // Excluir contatos da campanha
    await db.query('DELETE FROM campaign_contacts WHERE campaign_id = ?', [id]);

    // Excluir campanha
    await db.query('DELETE FROM bulk_campaigns WHERE id = ?', [id]);

    logger.info('Campanha excluída', {
      campaignId: id,
      name: campaign.name,
      userToken: userToken.substring(0, 8) + '...'
    });

    // Audit log for delete (logged before deletion to preserve campaign_id reference)
    const auditLogger = getAuditLogger(req);
    if (auditLogger) {
      auditLogger.log({
        campaignId: id,
        userId: req.session?.userId || userToken,
        action: 'delete',
        details: { name: campaign.name },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => logger.warn('Failed to log audit entry', { error: err.message }));
    }

    res.json({
      success: true,
      message: 'Campanha excluída com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao excluir campanha:', error.message);
    res.status(500).json({
      error: 'Erro ao excluir campanha',
      message: error.message
    });
  }
});

module.exports = router;
