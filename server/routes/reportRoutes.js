/**
 * Report Routes
 * Handles campaign report operations with filtering and export
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const express = require('express');
const { logger } = require('../utils/logger');
const verifyUserToken = require('../middleware/verifyUserToken');
const { featureMiddleware } = require('../middleware/featureEnforcement');

const router = express.Router();

// Apply advanced_reports feature check to all routes
router.use(verifyUserToken);
router.use(featureMiddleware.advancedReports);

/**
 * GET /api/user/reports - List campaign reports with filters
 * Query params: page, limit, startDate, endDate, status, type, instance
 */
router.get('/', async (req, res) => {
  try {
    const userToken = req.userToken;
    const db = req.app.locals.db;

    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Parse filter params
    const { startDate, endDate, status, type, instance } = req.query;

    // Build WHERE clause
    let whereClause = 'WHERE user_token = ?';
    const params = [userToken];

    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(endDate);
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      whereClause += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    if (type) {
      whereClause += ' AND message_type = ?';
      params.push(type);
    }

    if (instance) {
      whereClause += ' AND instance = ?';
      params.push(instance);
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM campaigns ${whereClause}`;
    const countResult = await db.query(countSql, params);
    const total = countResult.rows[0]?.total || 0;

    // Get paginated reports
    const sql = `
      SELECT 
        id, name, instance, status, message_type,
        total_contacts, sent_count, failed_count,
        created_at, started_at, completed_at
      FROM campaigns 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const { rows } = await db.query(sql, [...params, limit, offset]);

    // Calculate delivery rate for each campaign
    const reports = rows.map(row => ({
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

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
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
router.get('/:campaignId', async (req, res) => {
  try {
    const userToken = req.userToken;
    const { campaignId } = req.params;
    const db = req.app.locals.db;

    // Get campaign data
    const campaignSql = `
      SELECT 
        id, name, instance, status, message_type,
        total_contacts, sent_count, failed_count,
        created_at, started_at, completed_at
      FROM campaigns 
      WHERE id = ? AND user_token = ?
    `;
    const campaignResult = await db.query(campaignSql, [campaignId, userToken]);

    if (!campaignResult.rows || campaignResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    const campaign = campaignResult.rows[0];

    // Get contact results
    const contactsSql = `
      SELECT 
        phone, name, status, error_type, error_message, sent_at
      FROM campaign_contacts 
      WHERE campaign_id = ?
      ORDER BY sent_at DESC
    `;
    const contactsResult = await db.query(contactsSql, [campaignId]);

    // Calculate metrics
    const contacts = contactsResult.rows.map(c => ({
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
router.get('/:campaignId/export', async (req, res) => {
  try {
    const userToken = req.userToken;
    const { campaignId } = req.params;
    const format = req.query.format || 'csv';
    const db = req.app.locals.db;

    // Verify campaign ownership
    const checkSql = 'SELECT id, name FROM campaigns WHERE id = ? AND user_token = ?';
    const checkResult = await db.query(checkSql, [campaignId, userToken]);

    if (!checkResult.rows || checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    const campaignName = checkResult.rows[0].name;

    // Get contact results
    const contactsSql = `
      SELECT 
        phone, name, status, error_type, error_message, sent_at
      FROM campaign_contacts 
      WHERE campaign_id = ?
      ORDER BY sent_at DESC
    `;
    const contactsResult = await db.query(contactsSql, [campaignId]);

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Telefone', 'Nome', 'Status', 'Tipo de Erro', 'Mensagem de Erro', 'Enviado em'];
      const rows = contactsResult.rows.map(c => [
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
