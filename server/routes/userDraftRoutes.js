/**
 * User Draft Routes
 * Handles message draft persistence for the messaging system
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

const express = require('express');
const { logger } = require('../utils/logger');
const verifyUserToken = require('../middleware/verifyUserToken');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * GET /api/user/drafts - List all drafts for the user
 * Optionally filter by draft_type
 */
router.get('/', verifyUserToken, async (req, res) => {
  const userId = req.userId;
  const { draft_type } = req.query;
  
  try {
    const db = req.app.locals.db;
    
    let sql = `
      SELECT id, user_id, draft_type, data, created_at, updated_at
      FROM message_drafts
      WHERE user_id = ?
    `;
    const params = [userId];
    
    if (draft_type) {
      sql += ' AND draft_type = ?';
      params.push(draft_type);
    }
    
    sql += ' ORDER BY updated_at DESC';
    
    const result = await db.query(sql, params);
    const drafts = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      draftType: row.draft_type,
      data: JSON.parse(row.data),
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
  
  try {
    const db = req.app.locals.db;
    
    const sql = `
      SELECT id, user_id, draft_type, data, created_at, updated_at
      FROM message_drafts
      WHERE id = ? AND user_id = ?
    `;
    
    const result = await db.query(sql, [id, userId]);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rascunho não encontrado'
      });
    }
    
    const row = result.rows[0];
    const draft = {
      id: row.id,
      userId: row.user_id,
      draftType: row.draft_type,
      data: JSON.parse(row.data),
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
  
  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'Campo data é obrigatório'
    });
  }
  
  try {
    const db = req.app.locals.db;
    const now = new Date().toISOString();
    
    // Check if draft already exists for this user and type
    const existingSql = `
      SELECT id FROM message_drafts
      WHERE user_id = ? AND draft_type = ?
    `;
    const existingResult = await db.query(existingSql, [userId, draftType]);
    
    let draftId;
    
    if (existingResult.rows && existingResult.rows.length > 0) {
      // Update existing draft
      draftId = existingResult.rows[0].id;
      const updateSql = `
        UPDATE message_drafts
        SET data = ?, updated_at = ?
        WHERE id = ?
      `;
      await db.query(updateSql, [JSON.stringify(data), now, draftId]);
      
      logger.info('Rascunho atualizado:', {
        userId,
        draftId,
        draftType
      });
    } else {
      // Create new draft
      draftId = uuidv4();
      const insertSql = `
        INSERT INTO message_drafts (id, user_id, draft_type, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await db.query(insertSql, [draftId, userId, draftType, JSON.stringify(data), now, now]);
      
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
  
  try {
    const db = req.app.locals.db;
    
    // Verify draft belongs to user before deleting
    const checkSql = `
      SELECT id FROM message_drafts
      WHERE id = ? AND user_id = ?
    `;
    const checkResult = await db.query(checkSql, [id, userId]);
    
    if (!checkResult.rows || checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rascunho não encontrado'
      });
    }
    
    const deleteSql = `
      DELETE FROM message_drafts
      WHERE id = ? AND user_id = ?
    `;
    await db.query(deleteSql, [id, userId]);
    
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
  
  try {
    const db = req.app.locals.db;
    
    let sql = 'DELETE FROM message_drafts WHERE user_id = ?';
    const params = [userId];
    
    if (draft_type) {
      sql += ' AND draft_type = ?';
      params.push(draft_type);
    }
    
    await db.query(sql, params);
    
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
