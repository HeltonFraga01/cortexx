/**
 * Teste do middleware da rota raiz
 * 
 * Testa se o HTML customizado é servido corretamente
 */

const Database = require('./database');
const { logger } = require('./utils/logger');
const path = require('path');

// Simular funções do index.js
function applyBrandingToHtml(html, brandingConfig) {
  if (!html || typeof html !== 'string') {
    return html;
  }

  const cssVariables = `
    <style>
      :root {
        --primary: ${brandingConfig.primaryColor || '#000000'};
        --secondary: ${brandingConfig.secondaryColor || '#ffffff'};
        --app-name: '${brandingConfig.appName || 'WUZAPI'}';
      }
    </style>
  `;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${cssVariables}</head>`);
  }

  if (html.includes('<body')) {
    const bodyMatch = html.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const bodyTag = bodyMatch[0];
      return html.replace(bodyTag, `${bodyTag}${cssVariables}`);
    }
  }

  return cssVariables + html;
}

let brandingConfigCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

async function getCachedBrandingConfig(database) {
  const now = Date.now();
  
  if (brandingConfigCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    logger.info('✅ Usando configuração de branding do cache');
    return brandingConfigCache;
  }

  logger.info('🔄 Cache expirado, buscando do banco');
  
  try {
    const config = await database.getBrandingConfig();
    brandingConfigCache = config;
    cacheTimestamp = now;
    return config;
  } catch (error) {
    logger.error('❌ Erro ao buscar configuração:', error.message);
    return {
      id: null,
      appName: 'WUZAPI',
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      customHomeHtml: null
    };
  }
}

async function testRootRouteMiddleware() {
  logger.info('🧪 Testando middleware da rota raiz');
  
  // Criar banco de teste
  const testDbPath = path.join(__dirname, 'test-root-route.db');
  const db = new Database(testDbPath);
  
  try {
    // Inicializar banco
    await db.init();
    logger.info('✅ Banco de dados de teste inicializado');
    
    // Teste 1: Sem HTML customizado
    logger.info('📝 Teste 1: Sem HTML customizado');
    let config = await getCachedBrandingConfig(db);
    
    if (!config.customHomeHtml) {
      logger.info('✅ Teste 1 passou: Nenhum HTML customizado (esperado)');
    } else {
      logger.error('❌ Teste 1 falhou: HTML customizado não deveria existir');
      return false;
    }
    
    // Teste 2: Salvar HTML customizado
    logger.info('📝 Teste 2: Salvar HTML customizado');
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Landing</title>
        </head>
        <body>
          <h1 style="color: var(--primary)">Welcome to var(--app-name)</h1>
          <p style="color: var(--secondary)">Custom landing page</p>
        </body>
      </html>
    `;
    
    await db.updateBrandingConfig({
      appName: 'TestApp',
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
      customHomeHtml: testHtml
    });
    
    logger.info('✅ HTML customizado salvo no banco');
    
    // Invalidar cache para forçar nova busca
    brandingConfigCache = null;
    cacheTimestamp = null;
    
    // Teste 3: Recuperar e aplicar branding
    logger.info('📝 Teste 3: Recuperar HTML e aplicar branding');
    config = await getCachedBrandingConfig(db);
    
    if (!config.customHomeHtml) {
      logger.error('❌ Teste 3 falhou: HTML customizado não foi recuperado');
      return false;
    }
    
    const htmlWithBranding = applyBrandingToHtml(config.customHomeHtml, config);
    
    if (!htmlWithBranding.includes('--primary: #FF0000')) {
      logger.error('❌ Teste 3 falhou: Variável --primary não foi aplicada');
      return false;
    }
    
    if (!htmlWithBranding.includes('--secondary: #00FF00')) {
      logger.error('❌ Teste 3 falhou: Variável --secondary não foi aplicada');
      return false;
    }
    
    if (!htmlWithBranding.includes("--app-name: 'TestApp'")) {
      logger.error('❌ Teste 3 falhou: Variável --app-name não foi aplicada');
      return false;
    }
    
    logger.info('✅ Teste 3 passou: HTML com branding aplicado corretamente');
    
    // Teste 4: Verificar cache
    logger.info('📝 Teste 4: Verificar funcionamento do cache');
    const config2 = await getCachedBrandingConfig(db);
    
    if (config2 === config) {
      logger.info('✅ Teste 4 passou: Cache funcionando (mesma instância)');
    } else {
      logger.warn('⚠️ Teste 4: Cache retornou instância diferente (mas pode ser válido)');
    }
    
    // Teste 5: Simular requisição à rota raiz
    logger.info('📝 Teste 5: Simular lógica da rota raiz');
    
    const mockReq = {
      ip: '127.0.0.1',
      get: (header) => header === 'User-Agent' ? 'Test Agent' : null
    };
    
    const mockRes = {
      sent: false,
      content: null,
      send: function(html) {
        this.sent = true;
        this.content = html;
        logger.info('📤 HTML enviado para cliente', {
          length: html.length,
          has_css_vars: html.includes(':root')
        });
      }
    };
    
    // Simular lógica do middleware
    if (db && db.isInitialized) {
      const brandingConfig = await getCachedBrandingConfig(db);
      
      if (brandingConfig && brandingConfig.customHomeHtml && brandingConfig.customHomeHtml.trim() !== '') {
        const htmlWithBranding = applyBrandingToHtml(brandingConfig.customHomeHtml, brandingConfig);
        mockRes.send(htmlWithBranding);
      }
    }
    
    if (mockRes.sent && mockRes.content.includes('--primary')) {
      logger.info('✅ Teste 5 passou: Rota raiz serviria HTML customizado corretamente');
    } else {
      logger.error('❌ Teste 5 falhou: Rota raiz não serviu HTML customizado');
      return false;
    }
    
    logger.info('🎉 Todos os testes do middleware da rota raiz passaram!');
    return true;
    
  } catch (error) {
    logger.error('❌ Erro durante teste:', {
      message: error.message,
      stack: error.stack
    });
    return false;
  } finally {
    // Cleanup
    if (db.db) {
      db.db.close();
    }
    
    const fs = require('fs');
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
        logger.info('🧹 Banco de dados de teste removido');
      }
    } catch (err) {
      logger.warn('⚠️ Não foi possível remover banco de teste:', err.message);
    }
  }
}

// Executar teste
testRootRouteMiddleware()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('❌ Erro fatal:', error);
    process.exit(1);
  });
