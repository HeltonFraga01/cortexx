/**
 * Test Routes
 * 
 * Rotas para testar funcionalidades do sistema
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { wuzapiValidator } = require('../utils/wuzapiValidator');

/**
 * POST /api/test/wuzapi-connection
 * Testa conexão com instância WUZAPI
 * Rota de teste sem autenticação (apenas em desenvolvimento)
 */
router.post('/wuzapi-connection', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token é obrigatório'
      });
    }

    logger.info('Testando conexão WUZAPI', {
      token: token.substring(0, 10) + '...'
    });

    // Validar formato
    const isValidFormat = wuzapiValidator.isValidTokenFormat(token);
    
    if (!isValidFormat) {
      return res.json({
        success: false,
        valid: false,
        error: 'Formato de token inválido (deve ter pelo menos 20 caracteres)',
        checks: {
          format: false,
          connection: false
        }
      });
    }

    // Validar conexão
    const validation = await wuzapiValidator.validateInstance(token);

    res.json({
      success: true,
      valid: validation.valid,
      status: validation.status,
      error: validation.error,
      checks: {
        format: true,
        connection: validation.valid
      }
    });

  } catch (error) {
    logger.error('Erro ao testar conexão WUZAPI:', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao testar conexão',
      message: error.message
    });
  }
});

module.exports = router;
