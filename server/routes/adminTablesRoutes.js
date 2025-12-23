const express = require('express');
const errorHandler = require('../middleware/errorHandler');
const { adminLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

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
      // Get list of tables from Supabase using information_schema
      const { data: tables, error } = await SupabaseService.adminClient
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');
      
      if (error) throw error;
      
      const tableList = (tables || []).map(t => ({ name: t.table_name }));
      
      logger.info('✅ Tabelas disponíveis listadas:', {
        count: tableList.length
      });
      
      res.json({
        success: true,
        data: tableList,
        count: tableList.length,
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
      
      // Get table columns from information_schema
      const { data: columns, error } = await SupabaseService.adminClient
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);
      
      if (error) throw error;
      
      if (!columns || columns.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Tabela '${tableName}' não encontrada`,
          code: 'TABLE_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      const schema = {
        tableName,
        columns: columns.map(c => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
          default: c.column_default
        }))
      };
      
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
      
      // Get first 10 records from table
      const { data, error, count } = await SupabaseService.adminClient
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(10);
      
      if (error) throw error;
      
      logger.info('✅ Prévia da tabela obtida:', {
        tableName,
        recordCount: (data || []).length
      });
      
      res.json({
        success: true,
        data: data || [],
        count: (data || []).length,
        total: count || 0,
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
