const express = require('express');
const errorHandler = require('../middleware/errorHandler');
const { adminLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');

const router = express.Router();

// Aplicar rate limiter a todas as rotas admin
router.use(adminLimiter);

/**
 * Admin Tables Routes
 * 
 * Rotas para gerenciamento e visualização de tabelas do banco (apenas admin)
 * Todas as rotas requerem token administrativo válido
 */

/**
 * GET /api/admin/tables
 * Lista todas as tabelas disponíveis no banco de dados
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Response:
 * - Lista de tabelas com informações (nome, contagem de registros, colunas, índices)
 */
router.get('/',
  async (req, res) => {
    try {
      const db = req.app.locals.db;
      
      // Buscar todas as tabelas disponíveis
      const tables = await db.getAvailableTables();
      
      logger.info('✅ Tabelas disponíveis listadas:', {
        count: tables.length
      });
      
      res.json({
        success: true,
        data: tables,
        count: tables.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao listar tabelas:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao listar tabelas',
        code: 'LIST_TABLES_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/admin/tables/:tableName
 * Obtém o schema de uma tabela específica
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Params:
 * - tableName: string - Nome da tabela
 * 
 * Response:
 * - Schema da tabela com informações de colunas (nome, tipo, nullable, default, primary key)
 */
router.get('/:tableName',
  async (req, res) => {
    try {
      const { tableName } = req.params;
      const db = req.app.locals.db;
      
      // Validar formato do nome da tabela
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        logger.warn('⚠️ Nome de tabela inválido:', { tableName });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Nome de tabela inválido',
          code: 'INVALID_TABLE_NAME',
          timestamp: new Date().toISOString()
        });
      }
      
      // Buscar schema da tabela
      const schema = await db.getTableSchema(tableName);
      
      logger.info('✅ Schema da tabela obtido:', {
        tableName,
        columnCount: schema.columns.length
      });
      
      res.json({
        success: true,
        data: schema,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        logger.warn('⚠️ Tabela não encontrada:', {
          tableName: req.params.tableName
        });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Tabela '${req.params.tableName}' não encontrada`,
          code: 'TABLE_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.error('❌ Erro ao obter schema da tabela:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao obter schema da tabela',
        code: 'GET_TABLE_SCHEMA_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/admin/tables/:tableName/preview
 * Obtém uma prévia dos dados de uma tabela (primeiros 10 registros)
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Params:
 * - tableName: string - Nome da tabela
 * 
 * Response:
 * - Primeiros 10 registros da tabela
 */
router.get('/:tableName/preview',
  async (req, res) => {
    try {
      const { tableName } = req.params;
      const db = req.app.locals.db;
      
      // Validar formato do nome da tabela
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        logger.warn('⚠️ Nome de tabela inválido:', { tableName });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Nome de tabela inválido',
          code: 'INVALID_TABLE_NAME',
          timestamp: new Date().toISOString()
        });
      }
      
      // Buscar primeiros 10 registros
      const result = await db.queryTable(tableName, {
        page: 1,
        limit: 10
      });
      
      logger.info('✅ Prévia da tabela obtida:', {
        tableName,
        recordCount: result.data.length
      });
      
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        total: result.pagination.total,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao obter prévia da tabela:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao obter prévia da tabela',
        code: 'GET_TABLE_PREVIEW_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
