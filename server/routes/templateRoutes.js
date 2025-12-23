/**
 * Template Routes
 * Handles campaign template operations with pagination support
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 * Migrated to use SupabaseService directly
 */

const express = require('express');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');
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
    
    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Get total count
    const { count: total, error: countError } = await SupabaseService.count(
      'campaign_templates',
      { user_token: userToken }
    );

    if (countError) {
      throw countError;
    }

    // Get paginated templates
    const { data: rows, error: queryError } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query
        .select('id, name, description, config, created_at, updated_at')
        .eq('user_token', userToken)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    );

    if (queryError) {
      throw queryError;
    }

    // Parse config JSON
    const templates = (rows || []).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      config: typeof t.config === 'string' ? JSON.parse(t.config || '{}') : (t.config || {}),
      createdAt: t.created_at,
      updatedAt: t.updated_at
    }));

    const totalPages = Math.ceil((total || 0) / limit);

    res.json({
      success: true,
      templates,
      pagination: {
        page,
        limit,
        total: total || 0,
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

    const { data: rows, error } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query
        .select('id, name, description, config, created_at, updated_at')
        .eq('id', id)
        .eq('user_token', userToken)
    );

    if (error) {
      throw error;
    }

    if (!rows || rows.length === 0) {
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
      config: typeof t.config === 'string' ? JSON.parse(t.config || '{}') : (t.config || {}),
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

    const id = `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const { data, error } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query.insert({
        id,
        name,
        description: description || null,
        user_token: userToken,
        config: config || {},
        created_at: now,
        updated_at: now
      }).select()
    );

    if (error) {
      throw error;
    }

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

    // Verify ownership
    const { data: existing, error: checkError } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query
        .select('id, config')
        .eq('id', id)
        .eq('user_token', userToken)
    );

    if (checkError) {
      throw checkError;
    }

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (config !== undefined) updateData.config = config;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }

    const now = new Date().toISOString();
    updateData.updated_at = now;

    const { error: updateError } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query
        .update(updateData)
        .eq('id', id)
    );

    if (updateError) {
      throw updateError;
    }

    // Fetch updated template
    const { data: updated, error: fetchError } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query
        .select('id, name, description, config, created_at, updated_at')
        .eq('id', id)
        .single()
    );

    if (fetchError) {
      throw fetchError;
    }

    logger.info('Template atualizado:', {
      templateId: id
    });

    res.json({
      success: true,
      template: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        config: typeof updated.config === 'string' ? JSON.parse(updated.config || '{}') : (updated.config || {}),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
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

    // Verify ownership
    const { data: existing, error: checkError } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query
        .select('id')
        .eq('id', id)
        .eq('user_token', userToken)
    );

    if (checkError) {
      throw checkError;
    }

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    const { error: deleteError } = await SupabaseService.queryAsAdmin(
      'campaign_templates',
      (query) => query.delete().eq('id', id)
    );

    if (deleteError) {
      throw deleteError;
    }

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
