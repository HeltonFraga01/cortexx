#!/usr/bin/env node

/**
 * Script para verificar e diagnosticar o estado das migrations
 * 
 * Uso: node server/scripts/check-migrations.js
 * 
 * Este script:
 * 1. Lista todas as migrations disponíveis
 * 2. Verifica quais foram executadas
 * 3. Verifica se as tabelas e colunas esperadas existem
 * 4. Sugere correções se necessário
 */

const path = require('path');
const fs = require('fs');
const Database = require('../database');

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../wuzapi.db');

console.log('🔍 Diagnóstico de Migrations');
console.log('============================');
console.log('📁 Banco de dados:', DB_PATH);
console.log('');

async function checkMigrations() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Banco de dados não encontrado:', DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  
  try {
    await db.init();
    console.log('✅ Conectado ao banco de dados');
    console.log('');

    // 1. Verificar tabela de migrations
    console.log('📋 Verificando tabela de controle de migrations...');
    const { rows: migrationTableCheck } = await db.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'
    `);
    
    if (migrationTableCheck.length === 0) {
      console.log('⚠️  Tabela migrations não existe - nenhuma migration foi executada ainda');
      console.log('');
    } else {
      // Listar migrations executadas
      const { rows: executedMigrations } = await db.query(
        'SELECT name, executed_at FROM migrations ORDER BY id'
      );
      
      console.log(`✅ ${executedMigrations.length} migrations registradas como executadas:`);
      executedMigrations.forEach(m => {
        console.log(`   - ${m.name} (${m.executed_at})`);
      });
      console.log('');
    }

    // 2. Verificar tabelas críticas para o chat
    console.log('📋 Verificando tabelas críticas para o sistema de chat...');
    console.log('');

    const criticalTables = [
      { name: 'conversations', description: 'Conversas do chat' },
      { name: 'chat_messages', description: 'Mensagens do chat' },
      { name: 'session_token_mapping', description: 'Mapeamento de sessão para token' },
      { name: 'agent_bots', description: 'Bots de atendimento' },
      { name: 'labels', description: 'Labels para conversas' },
      { name: 'canned_responses', description: 'Respostas rápidas' },
      { name: 'outgoing_webhooks', description: 'Webhooks de saída' },
      { name: 'webhook_deliveries', description: 'Entregas de webhooks' },
      { name: 'message_reactions', description: 'Reações em mensagens' },
      { name: 'contact_attributes', description: 'Atributos de contatos' },
      { name: 'contact_notes', description: 'Notas de contatos' },
      { name: 'macros', description: 'Macros de automação' }
    ];

    for (const table of criticalTables) {
      const { rows } = await db.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `, [table.name]);
      
      if (rows.length > 0) {
        console.log(`   ✅ ${table.name} - ${table.description}`);
      } else {
        console.log(`   ❌ ${table.name} - ${table.description} (NÃO EXISTE)`);
      }
    }
    console.log('');

    // 3. Verificar colunas críticas na tabela conversations
    console.log('📋 Verificando colunas da tabela conversations...');
    const { rows: convColumns } = await db.query("PRAGMA table_info(conversations)");
    
    if (convColumns.length === 0) {
      console.log('   ❌ Tabela conversations não existe!');
    } else {
      const expectedColumns = [
        'id', 'user_id', 'contact_jid', 'contact_name', 'contact_avatar_url',
        'last_message_at', 'last_message_preview', 'unread_count', 'assigned_bot_id',
        'status', 'created_at', 'updated_at', 'name_source', 'name_updated_at'
      ];
      
      const existingColumns = convColumns.map(c => c.name);
      
      for (const col of expectedColumns) {
        if (existingColumns.includes(col)) {
          console.log(`   ✅ ${col}`);
        } else {
          console.log(`   ❌ ${col} (NÃO EXISTE)`);
        }
      }
      
      // Verificar tipo da coluna user_id
      const userIdCol = convColumns.find(c => c.name === 'user_id');
      if (userIdCol) {
        console.log(`   ℹ️  user_id tipo: ${userIdCol.type}`);
        if (userIdCol.type.toUpperCase() === 'INTEGER') {
          console.log('   ⚠️  user_id deveria ser TEXT (migration 030 não foi executada?)');
        }
      }
    }
    console.log('');

    // 4. Verificar colunas críticas na tabela chat_messages
    console.log('📋 Verificando colunas da tabela chat_messages...');
    const { rows: msgColumns } = await db.query("PRAGMA table_info(chat_messages)");
    
    if (msgColumns.length === 0) {
      console.log('   ❌ Tabela chat_messages não existe!');
    } else {
      const expectedMsgColumns = [
        'id', 'conversation_id', 'message_id', 'direction', 'message_type',
        'content', 'media_url', 'media_mime_type', 'media_filename', 'media_metadata',
        'reply_to_message_id', 'status', 'is_private_note', 'sender_type',
        'sender_bot_id', 'timestamp', 'created_at', 'participant_jid', 'participant_name'
      ];
      
      const existingMsgColumns = msgColumns.map(c => c.name);
      
      for (const col of expectedMsgColumns) {
        if (existingMsgColumns.includes(col)) {
          console.log(`   ✅ ${col}`);
        } else {
          console.log(`   ❌ ${col} (NÃO EXISTE)`);
        }
      }
    }
    console.log('');

    // 5. Verificar colunas da tabela agent_bots
    console.log('📋 Verificando colunas da tabela agent_bots...');
    const { rows: botColumns } = await db.query("PRAGMA table_info(agent_bots)");
    
    if (botColumns.length === 0) {
      console.log('   ❌ Tabela agent_bots não existe!');
    } else {
      const expectedBotColumns = [
        'id', 'user_id', 'name', 'description', 'avatar_url', 'outgoing_url',
        'access_token', 'status', 'created_at', 'updated_at', 'priority', 
        'is_default', 'include_history'
      ];
      
      const existingBotColumns = botColumns.map(c => c.name);
      
      for (const col of expectedBotColumns) {
        if (existingBotColumns.includes(col)) {
          console.log(`   ✅ ${col}`);
        } else {
          console.log(`   ❌ ${col} (NÃO EXISTE)`);
        }
      }
      
      // Verificar tipo da coluna user_id
      const userIdCol = botColumns.find(c => c.name === 'user_id');
      if (userIdCol) {
        console.log(`   ℹ️  user_id tipo: ${userIdCol.type}`);
        if (userIdCol.type.toUpperCase() === 'INTEGER') {
          console.log('   ⚠️  user_id deveria ser TEXT (migration 030 não foi executada?)');
        }
      }
    }
    console.log('');

    // 6. Verificar session_token_mapping
    console.log('📋 Verificando tabela session_token_mapping...');
    const { rows: sessionColumns } = await db.query("PRAGMA table_info(session_token_mapping)");
    
    if (sessionColumns.length === 0) {
      console.log('   ❌ Tabela session_token_mapping não existe!');
      console.log('   ⚠️  Esta tabela é CRÍTICA para o funcionamento do webhook de mensagens!');
    } else {
      console.log('   ✅ Tabela existe');
      
      // Verificar se há mapeamentos
      const { rows: mappings } = await db.query('SELECT COUNT(*) as count FROM session_token_mapping');
      console.log(`   ℹ️  ${mappings[0].count} mapeamentos de sessão registrados`);
    }
    console.log('');

    // 7. Sugestões de correção
    console.log('📋 Sugestões de correção:');
    console.log('');
    console.log('   Para executar todas as migrations pendentes, rode:');
    console.log('   node server/migrations/run-migrations.js');
    console.log('');
    console.log('   Se o problema persistir, verifique os logs do servidor');
    console.log('   para erros específicos durante a execução das migrations.');
    console.log('');

    // Fechar conexão
    if (db.db) {
      db.db.close();
    }

  } catch (error) {
    console.error('❌ Erro durante diagnóstico:', error.message);
    console.error('Stack:', error.stack);
    
    if (db.db) {
      db.db.close();
    }
    
    process.exit(1);
  }
}

checkMigrations();
