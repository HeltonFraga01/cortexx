/**
 * Template Routes
 * Handles campaign template operations with pagination support
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();

// Middleware para verificar token do usuário
const verifyUserToken = async (req, res, next) => {
  let userToken = null;

  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers.token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = authHeader.substring(7);
  } else if (tokenHeader) {
    userToken = tokenHeader;
  } else if (req.session?.userToken) {
    userToken = req.session.userToken;
  }

  if (!userToken) {
    return res.status(401).json({
      success: false,
      error: 'Token não fornecido',
      message: 'Autenticação necessária'
    });
  }

  req.userToken = userToken;
  next();
};

/**
 * GET /api/user/templates - List templates with pagination
 * Query params: page (default: 1), limit (default: 10)
 */
router.get('/', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const db = req.app.locals.db;
    
    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total 
      FROM campaign_templates 
      WHERE user_token = ?
    `;
    const countResult = await db.query(countSql, [userToken]);
    const total = countResult.rows[0]?.total || 0;

    // Get paginated templates
    const sql = `
      SELECT id, name, description, config, created_at, updated_at
      FROM campaign_templates 
      WHERE user_token = ? 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const { rows } = await db.query(sql, [userToken, limit, offset]);

    // Parse config JSON
    const templates = rows.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      config: JSON.parse(t.config || '{}'),
      createdAt: t.created_at,
      updatedAt: t.updated_at
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      templates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    logger.error('Erro ao listar templates:', {
      error: error.message,
      endpoint: '/api/user/templates'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao listar templates',
      message: error.message
    });
  }
});

/**
 * GET /api/user/templates/:id - Get a single template by ID
 */
router.get('/:id', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { id } = req.params;
    const db = req.app.locals.db;

    const sql = `
      SELECT id, name, description, config, created_at, updated_at
      FROM campaign_templates 
      WHERE id = ? AND user_token = ?
    `;
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    const t = rows[0];
    const template = {
      id: t.id,
      name: t.name,
      description: t.description,
      config: JSON.parse(t.config || '{}'),
      createdAt: t.created_at,
      updatedAt: t.updated_at
    };

    res.json({
      success: true,
      template
    });
  } catch (error) {
    logger.error('Erro ao buscar template:', {
      error: error.message,
      templateId: req.params.id,
      endpoint: '/api/user/templates/:id'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar template',
      message: error.message
    });
  }
});

/**
 * POST /api/user/templates - Create a new template
 */
router.post('/', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { name, description, config } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        message: 'Nome é obrigatório'
      });
    }

    const db = req.app.locals.db;
    const id = `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO campaign_templates (id, name, description, user_token, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      id,
      name,
      description || null,
      userToken,
      JSON.stringify(config || {}),
      now,
      now
    ]);

    logger.info('Template criado:', {
      templateId: id,
      name
    });

    res.status(201).json({
      success: true,
      template: {
        id,
        name,
        description,
        config: config || {},
        createdAt: now,
        updatedAt: now
      }
    });
  } catch (error) {
    logger.error('Erro ao criar template:', {
      error: error.message,
      endpoint: '/api/user/templates'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao criar template',
      message: error.message
    });
  }
});

/**
 * PUT /api/user/templates/:id - Update an existing template
 */
router.put('/:id', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { id } = req.params;
    const { name, description, config } = req.body;
    const db = req.app.locals.db;

    // Verify ownership
    const checkSql = 'SELECT id, config FROM campaign_templates WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(checkSql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (config !== undefined) {
      updates.push('config = ?');
      params.push(JSON.stringify(config));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const updateSql = `UPDATE campaign_templates SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(updateSql, params);

    // Fetch updated template
    const fetchSql = `
      SELECT id, name, description, config, created_at, updated_at
      FROM campaign_templates 
      WHERE id = ?
    `;
    const result = await db.query(fetchSql, [id]);
    const t = result.rows[0];

    logger.info('Template atualizado:', {
      templateId: id
    });

    res.json({
      success: true,
      template: {
        id: t.id,
        name: t.name,
        description: t.description,
        config: JSON.parse(t.config || '{}'),
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }
    });
  } catch (error) {
    logger.error('Erro ao atualizar template:', {
      error: error.message,
      templateId: req.params.id,
      endpoint: '/api/user/templates/:id'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar template',
      message: error.message
    });
  }
});

/**
 * DELETE /api/user/templates/:id - Delete a template
 */
router.delete('/:id', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { id } = req.params;
    const db = req.app.locals.db;

    // Verify ownership
    const checkSql = 'SELECT id FROM campaign_templates WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(checkSql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    await db.query('DELETE FROM campaign_templates WHERE id = ?', [id]);

    logger.info('Template excluído:', {
      templateId: id
    });

    res.json({
      success: true,
      message: 'Template excluído com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao excluir template:', {
      error: error.message,
      templateId: req.params.id,
      endpoint: '/api/user/templates/:id'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir template',
      message: error.message
    });
  }
});

module.exports = router;
