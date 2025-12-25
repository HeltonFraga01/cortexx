/**
 * Report Routes
 * Handles campaign report operations with filtering and export
 * 
 * UPDATED: Now uses inboxContextMiddleware to get wuzapiToken from the active inbox
 * Migrated to use SupabaseService directly
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const express = require('express');
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

/**
 * Middleware para verificar token do usuário usando InboxContext
 * 
 * Ordem de prioridade para obter o token WUZAPI:
 * 1. Header 'token' (explícito - para operações específicas de inbox)
 * 2. Contexto da inbox ativa (via JWT do Supabase)
 * 3. Token da sessão (legacy)
 */
const verifyUserTokenWithInbox = async (req, res, next) => {
  // PRIORIDADE 1: Token explícito no header
  const tokenHeader = req.headers.token;
  if (tokenHeader && tokenHeader.trim()) {
    req.userToken = tokenHeader.trim();
    req.tokenSource = 'header';
    return next();
  }
  
  // PRIORIDADE 2: JWT + Contexto da inbox ativa
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
        req.tokenSource = 'context';
        return next();
      }
      
      if (req.user?.id) {
        req.userId = req.user.id;
        return next();
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for reports', { error: error.message });
    }
  }
  
  // PRIORIDADE 3: Token da sessão (legacy)
  if (req.session?.userToken) {
    req.userToken = req.session.userToken;
    req.tokenSource = 'session';
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: { code: 'NO_WUZAPI_TOKEN', message: 'Token WUZAPI não fornecido.' }
  });
};

const verifyUserToken = verifyUserTokenWithInbox;

// Note: Feature check removed - basic reports should be available to all users
// Advanced features like PDF export can be gated separately if needed

/**
 * GET /api/user/reports - List campaign reports with filters
 * Query params: page, limit, startDate, endDate, status, type, instance
 */
router.get('/', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;

    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Parse filter params
    const { startDate, endDate, status, type, instance } = req.query;

    // Build query with filters
    const { data: rows, count: total, error } = await SupabaseService.queryAsAdmin(
      'bulk_campaigns',
      (query) => {
        let q = query
          .select('id, name, instance, status, message_type, total_contacts, sent_count, failed_count, created_at, started_at, completed_at', { count: 'exact' })
          .eq('user_token', userToken);

        if (startDate) {
          q = q.gte('created_at', startDate);
        }

        if (endDate) {
          q = q.lte('created_at', endDate);
        }

        if (status) {
          const statuses = status.split(',').map(s => s.trim());
          q = q.in('status', statuses);
        }

        if (type) {
          q = q.eq('message_type', type);
        }

        if (instance) {
          q = q.eq('instance', instance);
        }

        return q
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
      }
    );

    if (error) {
      throw error;
    }

    // Calculate delivery rate for each campaign
    const reports = (rows || []).map(row => ({
      id: row.id,
      name: row.name,
      instance: row.instance,
      status: row.status,
      totalContacts: row.total_contacts || 0,
      sentCount: row.sent_count || 0,
      failedCount: row.failed_count || 0,
      deliveryRate: row.total_contacts > 0 
        ? Math.round((row.sent_count / row.total_contacts) * 100 * 100) / 100 
        : 0,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }));

    const totalPages = Math.ceil((total || 0) / limit);

    res.json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    logger.error('Erro ao listar relatórios:', {
      error: error.message,
      endpoint: '/api/user/reports'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao listar relatórios',
      message: error.message
    });
  }
});

/**
 * GET /api/user/reports/:campaignId - Get detailed report for a campaign
 */
router.get('/:campaignId', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { campaignId } = req.params;

    // Get campaign data
    const { data: campaignRows, error: campaignError } = await SupabaseService.queryAsAdmin(
      'bulk_campaigns',
      (query) => query
        .select('id, name, instance, status, message_type, total_contacts, sent_count, failed_count, created_at, started_at, completed_at')
        .eq('id', campaignId)
        .eq('user_token', userToken)
    );

    if (campaignError) {
      throw campaignError;
    }

    if (!campaignRows || campaignRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    const campaign = campaignRows[0];

    // Get contact results
    const { data: contactsRows, error: contactsError } = await SupabaseService.queryAsAdmin(
      'campaign_contacts',
      (query) => query
        .select('phone, name, status, error_type, error_message, sent_at')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })
    );

    if (contactsError) {
      throw contactsError;
    }

    // Calculate metrics
    const contacts = (contactsRows || []).map(c => ({
      phone: c.phone,
      name: c.name,
      status: c.status,
      errorType: c.error_type,
      errorMessage: c.error_message,
      sentAt: c.sent_at
    }));

    // Calculate errors by type
    const errorsByType = {};
    contacts.forEach(c => {
      if (c.status === 'failed' && c.errorType) {
        errorsByType[c.errorType] = (errorsByType[c.errorType] || 0) + 1;
      }
    });

    // Calculate average send time
    const sentContacts = contacts.filter(c => c.sentAt);
    let averageSendTime = 0;
    if (sentContacts.length > 1) {
      const times = sentContacts.map(c => new Date(c.sentAt).getTime()).sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push((times[i] - times[i - 1]) / 1000);
      }
      averageSendTime = intervals.length > 0 
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) 
        : 0;
    }

    // Calculate total duration
    let totalDuration = 0;
    if (campaign.started_at && campaign.completed_at) {
      totalDuration = Math.round(
        (new Date(campaign.completed_at).getTime() - new Date(campaign.started_at).getTime()) / 1000
      );
    }

    const deliveryRate = campaign.total_contacts > 0
      ? Math.round((campaign.sent_count / campaign.total_contacts) * 100 * 100) / 100
      : 0;

    const report = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        instance: campaign.instance,
        status: campaign.status,
        totalContacts: campaign.total_contacts || 0,
        sentCount: campaign.sent_count || 0,
        failedCount: campaign.failed_count || 0,
        createdAt: campaign.created_at,
        startedAt: campaign.started_at,
        completedAt: campaign.completed_at
      },
      metrics: {
        deliveryRate,
        errorsByType,
        averageSendTime,
        totalDuration
      },
      contacts
    };

    res.json({
      success: true,
      report
    });
  } catch (error) {
    logger.error('Erro ao buscar relatório:', {
      error: error.message,
      campaignId: req.params.campaignId,
      endpoint: '/api/user/reports/:campaignId'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar relatório',
      message: error.message
    });
  }
});

/**
 * GET /api/user/reports/:campaignId/export - Export report as CSV or PDF
 * Query params: format (csv|pdf)
 */
router.get('/:campaignId/export', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { campaignId } = req.params;
    const format = req.query.format || 'csv';

    // Verify campaign ownership
    const { data: checkRows, error: checkError } = await SupabaseService.queryAsAdmin(
      'bulk_campaigns',
      (query) => query
        .select('id, name')
        .eq('id', campaignId)
        .eq('user_token', userToken)
    );

    if (checkError) {
      throw checkError;
    }

    if (!checkRows || checkRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    const campaignName = checkRows[0].name;

    // Get contact results
    const { data: contactsRows, error: contactsError } = await SupabaseService.queryAsAdmin(
      'campaign_contacts',
      (query) => query
        .select('phone, name, status, error_type, error_message, sent_at')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })
    );

    if (contactsError) {
      throw contactsError;
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Telefone', 'Nome', 'Status', 'Tipo de Erro', 'Mensagem de Erro', 'Enviado em'];
      const rows = (contactsRows || []).map(c => [
        c.phone || '',
        c.name || '',
        c.status || '',
        c.error_type || '',
        c.error_message || '',
        c.sent_at || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-${campaignId}.csv"`);
      res.send('\uFEFF' + csvContent); // BOM for Excel UTF-8 compatibility
    } else if (format === 'pdf') {
      // For PDF, return a simple text representation
      // In production, you'd use a PDF library like pdfkit
      res.status(501).json({
        success: false,
        error: 'Exportação PDF não implementada',
        message: 'Use formato CSV'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Formato inválido',
        message: 'Use csv ou pdf'
      });
    }
  } catch (error) {
    logger.error('Erro ao exportar relatório:', {
      error: error.message,
      campaignId: req.params.campaignId,
      endpoint: '/api/user/reports/:campaignId/export'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao exportar relatório',
      message: error.message
    });
  }
});

module.exports = router;
