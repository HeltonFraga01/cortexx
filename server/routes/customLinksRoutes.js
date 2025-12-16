const express = require('express');
const { logger } = require('../utils/logger');
const errorHandler = require('../middleware/errorHandler');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

/**
 * GET /api/custom-links
 * Busca todos os links customizados ativos (público - sem autenticação)
 * 
 * Esta rota é pública e não requer autenticação.
 * Retorna apenas links ativos para exibição na navegação pública.
 * 
 * Responses:
 * - 200: Links customizados recuperados com sucesso
 * - 500: Erro interno do servidor
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { data: links, error } = await SupabaseService.queryAsAdmin('custom_links', (query) =>
      query.select('*').eq('active', true).order('position', { ascending: true })
    );
    if (error) throw error;
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Links customizados públicos recuperados', {
      url: req.url,
      method: req.method,
      response_time_ms: responseTime,
      links_count: links.length,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // Configurar cache para melhorar performance
    res.set('Cache-Control', 'public, max-age=300'); // Cache por 5 minutos
    
    res.json({
      success: true,
      code: 200,
      data: links,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Erro ao buscar links customizados públicos', {
      url: req.url,
      method: req.method,
      response_time_ms: responseTime,
      error_message: error.message,
      error_stack: error.stack,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar links customizados',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/custom-links/all
 * Busca todos os links customizados incluindo inativos (admin only)
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 */
router.get('/all',
  async (req, res) => {
    try {
      const { data: links, error } = await SupabaseService.queryAsAdmin('custom_links', (query) =>
        query.select('*').order('position', { ascending: true })
      );
      if (error) throw error;
      
      res.json({
        success: true,
        data: links
      });
    } catch (error) {
      logger.error('Erro ao buscar todos os links customizados:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar links customizados'
      });
    }
  }
);

/**
 * POST /api/admin/custom-links
 * Cria um novo link customizado (admin only)
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 */
router.post('/',
  async (req, res) => {
    try {
      const { label, url, icon, position } = req.body;
      
      if (!label || !url) {
        return res.status(400).json({
          success: false,
          error: 'Label e URL são obrigatórios'
        });
      }
      
      const { data: link, error } = await SupabaseService.insert('custom_links', {
        label,
        url,
        icon: icon || 'ExternalLink',
        position: position || 0,
        active: true
      });
      if (error) throw error;
      
      logger.info('Link customizado criado:', { id: link.id, label });
      
      res.status(201).json({
        success: true,
        data: link
      });
    } catch (error) {
      logger.error('Erro ao criar link customizado:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao criar link customizado'
      });
    }
  }
);

/**
 * PUT /api/admin/custom-links/:id
 * Atualiza um link customizado (admin only)
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 */
router.put('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      const { label, url, icon, position, active } = req.body;
      
      if (!label || !url) {
        return res.status(400).json({
          success: false,
          error: 'Label e URL são obrigatórios'
        });
      }
      
      const { data: updated, error } = await SupabaseService.update('custom_links', parseInt(id), {
        label,
        url,
        icon: icon || 'ExternalLink',
        position: position || 0,
        active: active !== undefined ? active : true
      });
      if (error) throw error;
      
      if (updated) {
        logger.info('Link customizado atualizado:', { id, label });
        res.json({
          success: true,
          message: 'Link atualizado com sucesso'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Link não encontrado'
        });
      }
    } catch (error) {
      logger.error('Erro ao atualizar link customizado:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar link customizado'
      });
    }
  }
);

/**
 * DELETE /api/admin/custom-links/:id
 * Deleta um link customizado (admin only)
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 */
router.delete('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const { error } = await SupabaseService.delete('custom_links', parseInt(id));
      const deleted = !error;
      
      if (deleted) {
        logger.info('Link customizado deletado:', { id });
        res.json({
          success: true,
          message: 'Link deletado com sucesso'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Link não encontrado'
        });
      }
    } catch (error) {
      logger.error('Erro ao deletar link customizado:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao deletar link customizado'
      });
    }
  }
);

module.exports = router;
