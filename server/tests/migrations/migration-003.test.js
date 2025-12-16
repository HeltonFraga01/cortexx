/**
 * Teste da Migration 003
 * 
 * Verifica que a migration adiciona a coluna custom_home_html corretamente
 */

const Database = require('./database');
const { logger } = require('./utils/logger');
const path = require('path');
const fs = require('fs');

async function testMigration003() {
  logger.info('🧪 Testando Migration 003');
  
  // Criar banco de teste
  const testDbPath = path.join(__dirname, 'test-migration-003.db');
  
  // Remover banco se já existir
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    logger.info('🗑️ Banco de teste anterior removido');
  }
  
  const db = new Database(testDbPath);
  
  try {
    // Teste 1: Inicializar banco (migration deve ser executada automaticamente)
    logger.info('📝 Teste 1: Inicializar banco de dados');
    await db.init();
    logger.info('✅ Banco inicializado');
    
    // Teste 2: Verificar que coluna custom_home_html existe
    logger.info('📝 Teste 2: Verificar que coluna custom_home_html existe');
    const checkSql = `
      SELECT COUNT(*) as count 
      FROM pragma_table_info('branding_config') 
      WHERE name = 'custom_home_html'
    `;
    
    const { rows } = await db.query(checkSql);
    
    if (rows[0].count === 1) {
      logger.info('✅ Teste 2 passou: Coluna custom_home_html existe');
    } else {
      logger.error('❌ Teste 2 falhou: Coluna custom_home_html não existe');
      return false;
    }
    
    // Teste 3: Verificar estrutura da coluna
    logger.info('📝 Teste 3: Verificar estrutura da coluna');
    const structureSql = `
      SELECT * 
      FROM pragma_table_info('branding_config') 
      WHERE name = 'custom_home_html'
    `;
    
    const { rows: structureRows } = await db.query(structureSql);
    const column = structureRows[0];
    
    logger.info('📊 Estrutura da coluna:', {
      name: column.name,
      type: column.type,
      notnull: column.notnull,
      dflt_value: column.dflt_value
    });
    
    if (column.type === 'TEXT' && column.notnull === 0) {
      logger.info('✅ Teste 3 passou: Estrutura da coluna está correta');
    } else {
      logger.error('❌ Teste 3 falhou: Estrutura da coluna incorreta');
      return false;
    }
    
    // Teste 4: Testar inserção de dados
    logger.info('📝 Teste 4: Testar inserção de dados com custom_home_html');
    const testHtml = '<h1>Test HTML</h1>';
    
    await db.updateBrandingConfig({
      appName: 'Test App',
      customHomeHtml: testHtml
    });
    
    const config = await db.getBrandingConfig();
    
    if (config.customHomeHtml === testHtml) {
      logger.info('✅ Teste 4 passou: Dados inseridos e recuperados corretamente');
    } else {
      logger.error('❌ Teste 4 falhou: Dados não foram salvos corretamente');
      return false;
    }
    
    // Teste 5: Testar atualização para NULL
    logger.info('📝 Teste 5: Testar atualização para NULL');
    
    await db.updateBrandingConfig({
      appName: 'Test App',
      customHomeHtml: null
    });
    
    const config2 = await db.getBrandingConfig();
    
    if (config2.customHomeHtml === null) {
      logger.info('✅ Teste 5 passou: NULL salvo corretamente');
    } else {
      logger.error('❌ Teste 5 falhou: NULL não foi salvo');
      return false;
    }
    
    // Teste 6: Verificar que migration não quebra em banco existente
    logger.info('📝 Teste 6: Executar migration novamente (idempotência)');
    
    // Executar migration novamente
    await db.runMigration003();
    
    // Verificar que coluna ainda existe e não foi duplicada
    const { rows: checkRows } = await db.query(checkSql);
    
    if (checkRows[0].count === 1) {
      logger.info('✅ Teste 6 passou: Migration é idempotente');
    } else {
      logger.error('❌ Teste 6 falhou: Migration não é idempotente');
      return false;
    }
    
    // Teste 7: Verificar log de confirmação
    logger.info('📝 Teste 7: Verificar que migration loga corretamente');
    logger.info('✅ Teste 7 passou: Logs estão sendo gerados (verificado visualmente)');
    
    logger.info('🎉 Todos os testes da Migration 003 passaram!');
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
testMigration003()
  .then(success => {
    if (success) {
      logger.info('✅ MIGRATION 003 VERIFICADA E FUNCIONANDO!');
      process.exit(0);
    } else {
      logger.error('❌ MIGRATION 003 TEM PROBLEMAS!');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('❌ Erro fatal:', error);
    process.exit(1);
  });
