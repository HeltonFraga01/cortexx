/**
 * User Draft Routes
 * Handles message draft persistence for the messaging system
 * 
 * UPDATED: Uses user_preferences table to store drafts since message_drafts
 * has a different schema (conversation-based drafts for chat)
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

const express = require('express');
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');
const SupabaseService = require('../services/SupabaseService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * Middleware para verificar token do usuário usando InboxContext
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
        return next();
      }
      
      if (req.user?.id) {
        req.userId = req.user.id;
        return next();
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for drafts', { error: error.message });
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
    error: { code: 'NO_TOKEN', message: 'Token não fornecido.' }
  });
};

const verifyUserToken = verifyUserTokenWithInbox;

/**
 * Helper to get draft key for user_preferences
 */
function getDraftKey(draftType) {
  return `draft_${draftType || 'send_flow'}`;
}

/**
 * GET /api/user/drafts - List all drafts for the user
 * Optionally filter by draft_type
 */
router.get('/', verifyUserToken, async (req, res) => {
  const userId = req.userId;
  const { draft_type } = req.query;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }
  
  try {
    // Get drafts from user_preferences
    let query = SupabaseService.adminClient
      .from('user_preferences')
      .select('id, user_id, key, value, created_at, updated_at')
      .eq('user_id', userId)
      .like('key', 'draft_%');
    
    if (draft_type) {
      query = query.eq('key', getDraftKey(draft_type));
    }
    
    const { data: rows, error } = await query;
    
    if (error) {
      throw error;
    }
    
    const drafts = (rows || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      draftType: row.key.replace('draft_', ''),
      data: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      success: true,
      data: drafts,
      count: drafts.length
    });
    
  } catch (error) {
    logger.error('Erro ao listar rascunhos:', {
      error: error.message,
      userId,
      endpoint: '/api/user/drafts'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao listar rascunhos',
      message: error.message
    });
  }
});

/**
 * GET /api/user/drafts/:id - Get a specific draft by ID
 */
router.get('/:id', verifyUserToken, async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }
  
  try {
    const { data: row, error } = await SupabaseService.adminClient
      .from('user_preferences')
      .select('id, user_id, key, value, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error || !row) {
      return res.status(404).json({
        success: false,
        error: 'Rascunho não encontrado'
      });
    }
    
    const draft = {
      id: row.id,
      userId: row.user_id,
      draftType: row.key.replace('draft_', ''),
      data: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    res.json({
      success: true,
      data: draft
    });
    
  } catch (error) {
    logger.error('Erro ao buscar rascunho:', {
      error: error.message,
      userId,
      draftId: id,
      endpoint: '/api/user/drafts/:id'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar rascunho',
      message: error.message
    });
  }
});

/**
 * POST /api/user/drafts - Save a new draft or update existing
 * If draft_type already exists for user, updates it (upsert behavior)
 */
router.post('/', verifyUserToken, async (req, res) => {
  const userId = req.userId;
  const { draftType = 'send_flow', data } = req.body;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }
  
  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'Campo data é obrigatório'
    });
  }
  
  try {
    const now = new Date().toISOString();
    const key = getDraftKey(draftType);
    
    // Check if draft already exists for this user and type
    const { data: existing } = await SupabaseService.adminClient
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();
    
    let draftId;
    
    if (existing) {
      // Update existing draft
      draftId = existing.id;
      const { error: updateError } = await SupabaseService.adminClient
        .from('user_preferences')
        .update({ value: data, updated_at: now })
        .eq('id', draftId);
      
      if (updateError) {
        throw updateError;
      }
      
      logger.info('Rascunho atualizado:', {
        userId,
        draftId,
        draftType
      });
    } else {
      // Create new draft
      const { data: inserted, error: insertError } = await SupabaseService.adminClient
        .from('user_preferences')
        .insert({
          user_id: userId,
          key,
          value: data,
          created_at: now,
          updated_at: now
        })
        .select('id')
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      draftId = inserted.id;
      
      logger.info('Rascunho criado:', {
        userId,
        draftId,
        draftType
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Rascunho salvo com sucesso',
      data: {
        id: draftId,
        userId,
        draftType,
        data,
        updatedAt: now
      }
    });
    
  } catch (error) {
    logger.error('Erro ao salvar rascunho:', {
      error: error.message,
      userId,
      draftType,
      endpoint: '/api/user/drafts'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao salvar rascunho',
      message: error.message
    });
  }
});

/**
 * DELETE /api/user/drafts/:id - Delete a specific draft
 */
router.delete('/:id', verifyUserToken, async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }
  
  try {
    // Verify draft belongs to user before deleting
    const { data: existing } = await SupabaseService.adminClient
      .from('user_preferences')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .like('key', 'draft_%')
      .maybeSingle();
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Rascunho não encontrado'
      });
    }
    
    const { error: deleteError } = await SupabaseService.adminClient
      .from('user_preferences')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (deleteError) {
      throw deleteError;
    }
    
    logger.info('Rascunho excluído:', {
      userId,
      draftId: id
    });
    
    res.json({
      success: true,
      message: 'Rascunho excluído com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao excluir rascunho:', {
      error: error.message,
      userId,
      draftId: id,
      endpoint: '/api/user/drafts/:id'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir rascunho',
      message: error.message
    });
  }
});

/**
 * DELETE /api/user/drafts - Delete all drafts for user (optionally by type)
 */
router.delete('/', verifyUserToken, async (req, res) => {
  const userId = req.userId;
  const { draft_type } = req.query;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }
  
  try {
    let query = SupabaseService.adminClient
      .from('user_preferences')
      .delete()
      .eq('user_id', userId)
      .like('key', 'draft_%');
    
    if (draft_type) {
      query = SupabaseService.adminClient
        .from('user_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('key', getDraftKey(draft_type));
    }
    
    const { error: deleteError } = await query;
    
    if (deleteError) {
      throw deleteError;
    }
    
    logger.info('Rascunhos excluídos:', {
      userId,
      draftType: draft_type || 'all'
    });
    
    res.json({
      success: true,
      message: 'Rascunhos excluídos com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao excluir rascunhos:', {
      error: error.message,
      userId,
      endpoint: '/api/user/drafts'
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir rascunhos',
      message: error.message
    });
  }
});

module.exports = router;
