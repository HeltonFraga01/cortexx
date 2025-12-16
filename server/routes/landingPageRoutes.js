/**
 * Landing Page Routes
 * 
 * Rotas para gerenciar landing page customizada (HTML completo)
 * Diferente do custom_home_html que é sanitizado, a landing page
 * é um arquivo HTML completo que pode conter scripts.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

// Caminho para armazenar a landing page customizada
const LANDING_PAGE_PATH = path.join(__dirname, '../public/landing-custom.html');
const DEFAULT_LANDING_PATH = path.join(__dirname, '../public/landing-default.html');

/**
 * GET /api/admin/landing-page
 * Buscar conteúdo da landing page customizada
 */
router.get('/', async (req, res) => {
  try {
    // Verificar token de admin
    const authHeader = req.headers.authorization;
    const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
    
    if (!authHeader || authHeader !== adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Token de administrador inválido',
        code: 401
      });
    }

    // Tentar ler landing page customizada
    let content = null;
    let isCustom = false;

    try {
      content = await fs.readFile(LANDING_PAGE_PATH, 'utf-8');
      isCustom = true;
    } catch (error) {
      // Se não existir customizada, retornar a padrão
      try {
        content = await fs.readFile(DEFAULT_LANDING_PATH, 'utf-8');
      } catch (defaultError) {
        // Se nem a padrão existir, retornar template básico
        content = getDefaultTemplate();
      }
    }

    res.json({
      success: true,
      data: {
        content,
        isCustom,
        path: isCustom ? LANDING_PAGE_PATH : DEFAULT_LANDING_PATH
      }
    });

  } catch (error) {
    logger.error('❌ Erro ao buscar landing page:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar landing page',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/landing-page
 * Atualizar landing page customizada
 */
router.put('/', async (req, res) => {
  try {
    // Verificar token de admin
    const authHeader = req.headers.authorization;
    const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
    
    if (!authHeader || authHeader !== adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Token de administrador inválido',
        code: 401
      });
    }

    const { content } = req.body;

    // Validações básicas
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Conteúdo HTML é obrigatório',
        code: 400
      });
    }

    // Validar tamanho (500KB max para landing page completa)
    const maxSize = 500000;
    if (content.length > maxSize) {
      return res.status(400).json({
        success: false,
        error: `HTML excede o tamanho máximo de ${maxSize} bytes`,
        code: 400
      });
    }

    // Validar estrutura HTML básica
    const validation = validateLandingPageStructure(content);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'HTML inválido',
        details: validation.errors,
        code: 400
      });
    }

    // Criar backup da versão anterior se existir
    try {
      const existingContent = await fs.readFile(LANDING_PAGE_PATH, 'utf-8');
      const backupPath = `${LANDING_PAGE_PATH}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, existingContent);
      logger.info('✅ Backup criado:', backupPath);
    } catch (error) {
      // Ignorar se não existir arquivo anterior
    }

    // Garantir que o diretório existe
    const dir = path.dirname(LANDING_PAGE_PATH);
    await fs.mkdir(dir, { recursive: true });

    // Salvar nova landing page
    await fs.writeFile(LANDING_PAGE_PATH, content, 'utf-8');

    logger.info('✅ Landing page customizada salva com sucesso', {
      size: content.length,
      path: LANDING_PAGE_PATH
    });

    res.json({
      success: true,
      message: 'Landing page atualizada com sucesso',
      data: {
        size: content.length,
        path: LANDING_PAGE_PATH
      }
    });

  } catch (error) {
    logger.error('❌ Erro ao salvar landing page:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao salvar landing page',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/landing-page
 * Resetar para landing page padrão
 */
router.delete('/', async (req, res) => {
  try {
    // Verificar token de admin
    const authHeader = req.headers.authorization;
    const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
    
    if (!authHeader || authHeader !== adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Token de administrador inválido',
        code: 401
      });
    }

    // Criar backup antes de deletar
    try {
      const existingContent = await fs.readFile(LANDING_PAGE_PATH, 'utf-8');
      const backupPath = `${LANDING_PAGE_PATH}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, existingContent);
      logger.info('✅ Backup criado antes de resetar:', backupPath);
    } catch (error) {
      // Ignorar se não existir arquivo
    }

    // Deletar landing page customizada
    try {
      await fs.unlink(LANDING_PAGE_PATH);
      logger.info('✅ Landing page customizada removida');
    } catch (error) {
      // Ignorar se não existir
    }

    res.json({
      success: true,
      message: 'Landing page resetada para padrão'
    });

  } catch (error) {
    logger.error('❌ Erro ao resetar landing page:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao resetar landing page',
      message: error.message
    });
  }
});

/**
 * Valida estrutura básica de uma landing page HTML
 */
function validateLandingPageStructure(html) {
  const errors = [];

  // Verificar tags essenciais
  if (!/<html/i.test(html)) {
    errors.push('HTML deve conter tag <html>');
  }

  if (!/<head/i.test(html)) {
    errors.push('HTML deve conter tag <head>');
  }

  if (!/<body/i.test(html)) {
    errors.push('HTML deve conter tag <body>');
  }

  // Verificar fechamento de tags
  if (!/<\/html>/i.test(html)) {
    errors.push('HTML deve fechar tag </html>');
  }

  if (!/<\/head>/i.test(html)) {
    errors.push('HTML deve fechar tag </head>');
  }

  if (!/<\/body>/i.test(html)) {
    errors.push('HTML deve fechar tag </body>');
  }

  // Verificar DOCTYPE
  if (!/<!DOCTYPE html>/i.test(html)) {
    errors.push('HTML deve começar com <!DOCTYPE html>');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Retorna template padrão de landing page
 */
function getDefaultTemplate() {
  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    p { font-size: 1.25rem; opacity: 0.9; }
    a {
      display: inline-block;
      margin-top: 2rem;
      padding: 1rem 2rem;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div>
    <h1>Bem-vindo</h1>
    <p>Configure sua landing page personalizada no painel administrativo</p>
    <a href="/login">Acessar Sistema</a>
  </div>
</body>
</html>`;
}

module.exports = router;
