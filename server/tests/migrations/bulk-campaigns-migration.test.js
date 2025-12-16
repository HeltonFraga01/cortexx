#!/usr/bin/env node

/**
 * Test script for bulk campaigns migration (007)
 * Tests table creation, indexes, and sample data insertion
 */

const Database = require('./database');
const { logger } = require('./utils/logger');
const path = require('path');
const fs = require('fs');

// Use test database
const TEST_DB_PATH = path.join(__dirname, 'test-bulk-campaigns.db');

async function runTest() {
  let db = null;
  
  try {
    logger.info('🧪 Iniciando teste da migration 007...');
    logger.info('📁 Banco de teste:', TEST_DB_PATH);
    
    // Remove test database if exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
      logger.info('🗑️ Banco de teste anterior removido');
    }
    
    // Initialize database
    db = new Database(TEST_DB_PATH);
    await db.init();
    logger.info('✅ Banco de dados inicializado');
    
    // Run migration 007
    const migration = require('./migrations/007_add_bulk_campaigns');
    await migration.up(db);
    logger.info('✅ Migration 007 executada');
    
    // Test 1: Verify tables exist
    logger.info('\n📋 Teste 1: Verificando existência das tabelas...');
    const tables = ['campaigns', 'campaign_contacts', 'campaign_reports'];
    
    for (const table of tables) {
      const result = await db.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );
      
      if (result.rows.length > 0) {
        logger.info(`✅ Tabela ${table} existe`);
      } else {
        throw new Error(`❌ Tabela ${table} não encontrada`);
      }
    }
    
    // Test 2: Verify indexes exist
    logger.info('\n📋 Teste 2: Verificando índices...');
    const expectedIndexes = [
      'idx_campaigns_instance',
      'idx_campaigns_user_token',
      'idx_campaigns_status',
      'idx_campaigns_scheduled',
      'idx_campaigns_created_at',
      'idx_campaign_contacts_campaign',
      'idx_campaign_contacts_status',
      'idx_campaign_contacts_processing_order',
      'idx_campaign_reports_campaign'
    ];
    
    for (const indexName of expectedIndexes) {
      const result = await db.query(
        `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
        [indexName]
      );
      
      if (result.rows.length > 0) {
        logger.info(`✅ Índice ${indexName} existe`);
      } else {
        throw new Error(`❌ Índice ${indexName} não encontrado`);
      }
    }
    
    // Test 3: Insert sample campaign
    logger.info('\n📋 Teste 3: Inserindo campanha de exemplo...');
    const campaignId = 'test-campaign-' + Date.now();
    
    await db.query(`
      INSERT INTO campaigns (
        id, name, instance, user_token, status, message_type, message_content,
        delay_min, delay_max, randomize_order, is_scheduled, total_contacts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      campaignId,
      'Campanha de Teste',
      'test-instance',
      'test-token-123',
      'scheduled',
      'text',
      'Olá {{nome}}, esta é uma mensagem de teste!',
      10,
      20,
      1,
      1,
      3
    ]);
    
    logger.info('✅ Campanha inserida com sucesso');
    
    // Test 4: Insert sample contacts
    logger.info('\n📋 Teste 4: Inserindo contatos de exemplo...');
    const contacts = [
      { phone: '5511999999999', name: 'João Silva', variables: JSON.stringify({ nome: 'João' }) },
      { phone: '5511888888888', name: 'Maria Santos', variables: JSON.stringify({ nome: 'Maria' }) },
      { phone: '5511777777777', name: 'Pedro Costa', variables: JSON.stringify({ nome: 'Pedro' }) }
    ];
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      await db.query(`
        INSERT INTO campaign_contacts (
          campaign_id, phone, name, variables, status, processing_order
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        campaignId,
        contact.phone,
        contact.name,
        contact.variables,
        'pending',
        i
      ]);
    }
    
    logger.info(`✅ ${contacts.length} contatos inseridos com sucesso`);
    
    // Test 5: Query campaign with contacts
    logger.info('\n📋 Teste 5: Consultando campanha com contatos...');
    const campaignResult = await db.query(
      'SELECT * FROM campaigns WHERE id = ?',
      [campaignId]
    );
    
    if (campaignResult.rows.length === 0) {
      throw new Error('❌ Campanha não encontrada');
    }
    
    const campaign = campaignResult.rows[0];
    logger.info('✅ Campanha encontrada:', {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      total_contacts: campaign.total_contacts
    });
    
    const contactsResult = await db.query(
      'SELECT * FROM campaign_contacts WHERE campaign_id = ? ORDER BY processing_order',
      [campaignId]
    );
    
    logger.info(`✅ ${contactsResult.rows.length} contatos encontrados`);
    
    // Test 6: Test constraints
    logger.info('\n📋 Teste 6: Testando constraints...');
    
    // Test invalid status
    try {
      await db.query(`
        INSERT INTO campaigns (
          id, name, instance, user_token, status, message_type, message_content,
          delay_min, delay_max, total_contacts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'test-invalid-status',
        'Test',
        'test',
        'test',
        'invalid_status',
        'text',
        'test',
        10,
        20,
        1
      ]);
      throw new Error('❌ Constraint de status não funcionou');
    } catch (error) {
      if (error.message.includes('CHECK constraint failed')) {
        logger.info('✅ Constraint de status funcionando corretamente');
      } else {
        throw error;
      }
    }
    
    // Test invalid delay range
    try {
      await db.query(`
        INSERT INTO campaigns (
          id, name, instance, user_token, status, message_type, message_content,
          delay_min, delay_max, total_contacts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'test-invalid-delay',
        'Test',
        'test',
        'test',
        'scheduled',
        'text',
        'test',
        30,
        10,
        1
      ]);
      throw new Error('❌ Constraint de delay não funcionou');
    } catch (error) {
      if (error.message.includes('CHECK constraint failed')) {
        logger.info('✅ Constraint de delay (min <= max) funcionando corretamente');
      } else {
        throw error;
      }
    }
    
    // Test 7: Insert sample report
    logger.info('\n📋 Teste 7: Inserindo relatório de exemplo...');
    await db.query(`
      INSERT INTO campaign_reports (
        campaign_id, total_contacts, sent_count, failed_count, success_rate,
        duration_seconds, errors_by_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      campaignId,
      3,
      2,
      1,
      66.67,
      120,
      JSON.stringify({ timeout: 1 })
    ]);
    
    logger.info('✅ Relatório inserido com sucesso');
    
    // Test 8: Test foreign key cascade
    logger.info('\n📋 Teste 8: Testando cascade delete...');
    await db.query('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    
    const remainingContacts = await db.query(
      'SELECT COUNT(*) as count FROM campaign_contacts WHERE campaign_id = ?',
      [campaignId]
    );
    
    if (remainingContacts.rows[0].count === 0) {
      logger.info('✅ Cascade delete funcionando corretamente');
    } else {
      throw new Error('❌ Cascade delete não funcionou');
    }
    
    // Test 9: Test rollback
    logger.info('\n📋 Teste 9: Testando rollback da migration...');
    await migration.down(db);
    logger.info('✅ Rollback executado');
    
    // Verify tables were dropped
    for (const table of tables) {
      const result = await db.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );
      
      if (result.rows.length === 0) {
        logger.info(`✅ Tabela ${table} removida`);
      } else {
        throw new Error(`❌ Tabela ${table} ainda existe após rollback`);
      }
    }
    
    logger.info('\n✅ Todos os testes passaram com sucesso!');
    logger.info('📊 Resumo:');
    logger.info('  - Tabelas criadas: 3');
    logger.info('  - Índices criados: 9');
    logger.info('  - Constraints testados: 2');
    logger.info('  - Cascade delete: OK');
    logger.info('  - Rollback: OK');
    
  } catch (error) {
    logger.error('❌ Erro durante teste:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (db && db.db) {
      db.db.close();
    }
    
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
      logger.info('🗑️ Banco de teste removido');
    }
  }
}

// Run test
runTest();
