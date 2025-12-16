#!/usr/bin/env node

/**
 * Script de Teste do Sistema de Migrations
 * 
 * Este script testa se o sistema de migrations está funcionando corretamente
 */

const Database = require('./database');
const { logger } = require('./utils/logger');
const path = require('path');
const fs = require('fs');

// Usar banco de teste
const TEST_DB_PATH = path.join(__dirname, 'test-migrations.db');

async function runDatabaseMigrations(database) {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('⚠️ Diretório de migrations não encontrado, pulando migrations');
      return;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.match(/^\d{3}_.*\.js$/))
      .sort();
    
    if (migrationFiles.length === 0) {
      logger.info('ℹ️ Nenhuma migration encontrada');
      return;
    }
    
    logger.info(`📋 Encontradas ${migrationFiles.length} migrations`);
    
    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migration = require(migrationPath);
      
      if (typeof migration.up === 'function') {
        try {
          logger.info(`🔄 Executando migration: ${file}`);
          await migration.up(database);
          logger.info(`✅ Migration ${file} executada com sucesso`);
        } catch (error) {
          if (error.message && error.message.includes('duplicate column')) {
            logger.info(`ℹ️ Migration ${file} já foi aplicada anteriormente`);
          } else {
            logger.error(`❌ Erro ao executar migration ${file}:`, error.message);
            throw error;
          }
        }
      } else {
        logger.warn(`⚠️ Migration ${file} não possui função 'up', pulando`);
      }
    }
    
    logger.info('✅ Todas as migrations foram processadas');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migrations:', error.message);
    throw error;
  }
}

async function testMigrations() {
  console.log('🧪 Iniciando teste do sistema de migrations...\n');
  
  let db;
  
  try {
    // Remover banco de teste se existir
    if (fs.existsSync(TEST_DB_PATH)) {
      console.log('🗑️ Removendo banco de teste anterior...');
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Criar novo banco de teste
    console.log('📦 Criando banco de teste...');
    db = new Database(TEST_DB_PATH);
    await db.init();
    console.log('✅ Banco de teste criado\n');
    
    // Teste 1: Executar migrations pela primeira vez
    console.log('📝 Teste 1: Executar migrations pela primeira vez');
    console.log('─'.repeat(60));
    await runDatabaseMigrations(db);
    console.log('✅ Teste 1 passou!\n');
    
    // Teste 2: Executar migrations novamente (deve pular)
    console.log('📝 Teste 2: Executar migrations novamente (idempotência)');
    console.log('─'.repeat(60));
    await runDatabaseMigrations(db);
    console.log('✅ Teste 2 passou!\n');
    
    // Teste 3: Verificar schema do banco
    console.log('📝 Teste 3: Verificar schema do banco');
    console.log('─'.repeat(60));
    
    // Verificar coluna view_configuration
    const checkViewConfig = await db.query(`
      SELECT COUNT(*) as count 
      FROM pragma_table_info('database_connections') 
      WHERE name = 'view_configuration'
    `);
    
    if (checkViewConfig.rows[0].count > 0) {
      console.log('✅ Coluna view_configuration encontrada');
    } else {
      throw new Error('❌ Coluna view_configuration não encontrada');
    }
    
    // Verificar coluna custom_home_html
    const checkCustomHtml = await db.query(`
      SELECT COUNT(*) as count 
      FROM pragma_table_info('branding_config') 
      WHERE name = 'custom_home_html'
    `);
    
    if (checkCustomHtml.rows[0].count > 0) {
      console.log('✅ Coluna custom_home_html encontrada');
    } else {
      throw new Error('❌ Coluna custom_home_html não encontrada');
    }
    
    console.log('✅ Teste 3 passou!\n');
    
    // Teste 4: Verificar estrutura completa
    console.log('📝 Teste 4: Verificar estrutura completa');
    console.log('─'.repeat(60));
    
    const tableInfo = await db.query(`PRAGMA table_info(database_connections)`);
    console.log('📊 Estrutura da tabela database_connections:');
    tableInfo.rows.forEach(col => {
      console.log(`   - ${col.name} (${col.type})`);
    });
    
    console.log('✅ Teste 4 passou!\n');
    
    // Sucesso!
    console.log('═'.repeat(60));
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('✅ Sistema de migrations está funcionando corretamente');
    console.log('✅ Migrations são idempotentes');
    console.log('✅ Schema do banco está correto');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('═'.repeat(60));
    console.error('❌ TESTE FALHOU!');
    console.error('═'.repeat(60));
    console.error('');
    console.error('Erro:', error.message);
    console.error('');
    
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
    
  } finally {
    // Limpar
    if (db) {
      await db.close();
    }
    
    // Remover banco de teste
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
      console.log('🗑️ Banco de teste removido');
    }
    
    // Remover arquivos temporários do SQLite
    [TEST_DB_PATH + '-shm', TEST_DB_PATH + '-wal'].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  }
}

// Executar testes
testMigrations().catch(error => {
  console.error('❌ Erro fatal:', error.message);
  process.exit(1);
});
