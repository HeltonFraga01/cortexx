/**
 * Manual test script to verify custom HTML persistence
 * 
 * This script tests the complete flow:
 * 1. Save custom HTML to database
 * 2. Retrieve it back
 * 3. Verify it matches what was saved
 */

const Database = require('../database');
const { logger } = require('../utils/logger');
const path = require('path');

async function testCustomHtmlPersistence() {
  logger.info('🧪 Iniciando teste de persistência de HTML customizado');
  
  // Create test database
  const testDbPath = path.join(__dirname, 'test-custom-html.db');
  const db = new Database(testDbPath);
  
  try {
    // Initialize database
    await db.init();
    logger.info('✅ Banco de dados de teste inicializado');
    
    // Test HTML content
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Landing Page</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              background: var(--primary, #000);
              color: var(--secondary, #fff);
            }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: var(--primary, #000); }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Welcome to Custom Landing Page</h1>
            <p>This is a test of the custom HTML persistence feature.</p>
            <button onclick="alert('Hello!')">Click Me</button>
          </div>
        </body>
      </html>
    `;
    
    logger.info('📝 HTML de teste preparado:', {
      length: testHtml.length,
      preview: testHtml.substring(0, 100) + '...'
    });
    
    // Step 1: Save custom HTML
    logger.info('📤 Passo 1: Salvando HTML customizado...');
    const savedConfig = await db.updateBrandingConfig({
      appName: 'Test App',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
      customHomeHtml: testHtml
    });
    
    logger.info('✅ Configuração salva:', {
      id: savedConfig.id,
      appName: savedConfig.appName,
      has_custom_html: !!savedConfig.customHomeHtml,
      custom_html_length: savedConfig.customHomeHtml ? savedConfig.customHomeHtml.length : 0
    });
    
    // Step 2: Retrieve custom HTML
    logger.info('📥 Passo 2: Recuperando HTML customizado...');
    const retrievedConfig = await db.getBrandingConfig();
    
    logger.info('✅ Configuração recuperada:', {
      id: retrievedConfig.id,
      appName: retrievedConfig.appName,
      has_custom_html: !!retrievedConfig.customHomeHtml,
      custom_html_length: retrievedConfig.customHomeHtml ? retrievedConfig.customHomeHtml.length : 0
    });
    
    // Step 3: Verify content matches
    logger.info('🔍 Passo 3: Verificando se o conteúdo corresponde...');
    
    if (!retrievedConfig.customHomeHtml) {
      logger.error('❌ FALHA: HTML customizado não foi recuperado do banco!');
      return false;
    }
    
    if (retrievedConfig.customHomeHtml !== savedConfig.customHomeHtml) {
      logger.error('❌ FALHA: HTML recuperado não corresponde ao HTML salvo!', {
        saved_length: savedConfig.customHomeHtml.length,
        retrieved_length: retrievedConfig.customHomeHtml.length
      });
      return false;
    }
    
    logger.info('✅ SUCESSO: HTML customizado foi persistido corretamente!');
    
    // Step 4: Test update (clear HTML)
    logger.info('🗑️ Passo 4: Testando limpeza de HTML customizado...');
    const clearedConfig = await db.updateBrandingConfig({
      appName: 'Test App',
      customHomeHtml: null
    });
    
    if (clearedConfig.customHomeHtml !== null) {
      logger.error('❌ FALHA: HTML customizado não foi limpo!');
      return false;
    }
    
    logger.info('✅ SUCESSO: HTML customizado foi limpo corretamente!');
    
    // Step 5: Test with empty string
    logger.info('📝 Passo 5: Testando com string vazia...');
    const emptyConfig = await db.updateBrandingConfig({
      appName: 'Test App',
      customHomeHtml: ''
    });
    
    if (emptyConfig.customHomeHtml !== null) {
      logger.error('❌ FALHA: String vazia não foi convertida para null!');
      return false;
    }
    
    logger.info('✅ SUCESSO: String vazia foi tratada corretamente!');
    
    // Step 6: Verify in database directly
    logger.info('🔍 Passo 6: Verificando diretamente no banco de dados...');
    const directQuery = await db.query(
      'SELECT custom_home_html FROM branding_config WHERE id = ?',
      [savedConfig.id]
    );
    
    logger.info('📊 Resultado da query direta:', {
      rows: directQuery.rows.length,
      custom_home_html_exists: directQuery.rows[0] && directQuery.rows[0].custom_home_html !== undefined,
      custom_home_html_value: directQuery.rows[0] ? directQuery.rows[0].custom_home_html : null
    });
    
    logger.info('🎉 TODOS OS TESTES PASSARAM!');
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
    
    // Remove test database
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

// Run test
testCustomHtmlPersistence()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('❌ Erro fatal:', error);
    process.exit(1);
  });
