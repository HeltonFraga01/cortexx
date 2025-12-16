/**
 * Migration: Add message_templates table
 * Created: 2025-01-09
 * Description: Creates table for storing user message templates
 */

module.exports = {
  up: async (db) => {
    // Verificar se a tabela já existe
    const checkTable = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='message_templates'
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('ℹ️ Table message_templates already exists, skipping migration');
      return;
    }
    
    // Criar tabela
    await db.query(`
      CREATE TABLE message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_token TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Criar índice
    await db.query(`
      CREATE INDEX idx_message_templates_user_token 
      ON message_templates(user_token)
    `);
    
    console.log('✅ Migration 005: message_templates table created');
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS message_templates');
    console.log('✅ Migration 005: message_templates table dropped');
  }
};
