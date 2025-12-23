/**
 * Template Routes
 * Handles campaign template operations with pagination support
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 * Migrated to use SupabaseService directly
 * 
 * UPDATED: Now uses account_id from InboxContext instead of user_token
 */

const express = require('express');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');
const router = express.Router();

/**
 * Middleware para verificar token do usuário e obter account_id
 */
const verifyUserWithAccount = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Try JWT authentication first
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
      
      if (req.context?.accountId) {
        req.accountId = req.context.accountId;
        req.userId = req.user?.id;
        return next();
      }
      
      // If no accountId in context, try to get it from user
      if (req.user?.id) {
        const { data: account } = await SupabaseService.adminClient
          .from('accounts')
          .select('id')
          .eq('owner_user_id', req.user.id)
          .single();
        
        if (account) {
          req.accountId = account.id;
          req.userId = req.user.id;
          return next();
        }
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for templates', { error: error.message });
    }
  }
  
  // Fallback to legacy token header
  const tokenHeader = req.headers.token;
  if (tokenHeader) {
    try {
      // Get account from session_token_mapping
      const { data: mapping } = await SupabaseService.adminClient
        .from('session_token_mapping')
        .select('account_id')
        .eq('wuzapi_token', tokenHeader)
        .single();
      
      if (mapping?.account_id) {
        req.accountId = mapping.account_id;
        req.userToken = tokenHeader;
        return next();
      }
    } catch (error) {
      logger.debug('Token mapping lookup failed', { error: error.message });
    }
  }
  
  // Fallback to session
  if (req.session?.userToken) {
    try {
      const { data: mapping } = await SupabaseService.adminClient
        .from('session_token_mapping')
        .select('account_id')
        .eq('wuzapi_token', req.session.userToken)
        .single();
      
      if (mapping?.account_id) {
        req.accountId = mapping.account_id;
        req.userToken = req.session.userToken;
        return next();
      }
    } catch (error) {
      logger.debug('Session token mapping lookup failed', { error: error.message });
    }
  }
  
  return res.status(401).json({
    success: false,
    error: 'Token não fornecido ou inválido',
    message: 'Autenticação necessária'
  });
};

/**
 * GET /api/user/templates - List templates with pagination
 * Query params: page (default: 1), limit (default: 10)
 */
router.get('/', verifyUserWithAccount, async (req, res) => {
  try {
    const accountId = req.accountId;
    
    if (!accountId) {
      return res.status(401).json({
        success: false,
        error: 'Conta não encontrada'
      });
    }
    
    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Get total count
    const { count: total, error: countError } = await SupabaseService.adminClient
      .from('campaign_templates')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if (countError) {
      throw countError;
    }

    // Get paginated templates
    const { data: rows, error: queryError } = await SupabaseService.adminClient
      .from('campaign_templates')
      .select('id, name, content, variables, created_at, updated_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      throw queryError;
    }

    // Map to expected format (frontend uses messageContent)
    const templates = (rows || []).map(t => ({
      id: t.id,
      name: t.name,
      description: null,
      config: {
        messageContent: t.content,
        variables: t.variables || []
      },
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
router.get('/:id', verifyUserWithAccount, async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    const { data: t, error } = await SupabaseService.adminClient
      .from('campaign_templates')
      .select('id, name, content, variables, created_at, updated_at')
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (error || !t) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    const template = {
      id: t.id,
      name: t.name,
      description: null,
      config: {
        messageContent: t.content,
        variables: t.variables || []
      },
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
router.post('/', verifyUserWithAccount, async (req, res) => {
  try {
    const accountId = req.accountId;
    const { name, description, config } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        message: 'Nome é obrigatório'
      });
    }

    const now = new Date().toISOString();
    
    // Extract content and variables from config
    // Support both 'content' and 'messageContent' for frontend compatibility
    const content = config?.content || config?.messageContent || '';
    const variables = config?.variables || [];

    const { data, error } = await SupabaseService.adminClient
      .from('campaign_templates')
      .insert({
        account_id: accountId,
        name,
        content,
        variables,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Template criado:', {
      templateId: data.id,
      name,
      accountId
    });

    res.status(201).json({
      success: true,
      template: {
        id: data.id,
        name,
        description: null,
        config: { messageContent: content, variables },
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
router.put('/:id', verifyUserWithAccount, async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;
    const { name, description, config } = req.body;

    // Verify ownership
    const { data: existing, error: checkError } = await SupabaseService.adminClient
      .from('campaign_templates')
      .select('id, content, variables')
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    // Build update data
    // Support both 'content' and 'messageContent' for frontend compatibility
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (config?.content !== undefined || config?.messageContent !== undefined) {
      updateData.content = config?.content || config?.messageContent;
    }
    if (config?.variables !== undefined) updateData.variables = config.variables;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }

    const now = new Date().toISOString();
    updateData.updated_at = now;

    const { error: updateError } = await SupabaseService.adminClient
      .from('campaign_templates')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Fetch updated template
    const { data: updated, error: fetchError } = await SupabaseService.adminClient
      .from('campaign_templates')
      .select('id, name, content, variables, created_at, updated_at')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    logger.info('Template atualizado:', {
      templateId: id,
      accountId
    });

    res.json({
      success: true,
      template: {
        id: updated.id,
        name: updated.name,
        description: null,
        config: {
          messageContent: updated.content,
          variables: updated.variables || []
        },
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
router.delete('/:id', verifyUserWithAccount, async (req, res) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    // Verify ownership
    const { data: existing, error: checkError } = await SupabaseService.adminClient
      .from('campaign_templates')
      .select('id')
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    const { error: deleteError } = await SupabaseService.adminClient
      .from('campaign_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    logger.info('Template excluído:', {
      templateId: id,
      accountId
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
