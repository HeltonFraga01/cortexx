/**
 * Migration: Create campaign_templates table
 * Description: Creates table to store reusable campaign templates
 */

module.exports = {
    up: async (db) => {
        console.log('Running migration: 013_create_campaign_templates');

        // Create campaign_templates table
        await db.query(`
      CREATE TABLE IF NOT EXISTS campaign_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        user_token TEXT NOT NULL,
        config TEXT NOT NULL, -- JSON string containing campaign configuration
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create index on user_token for faster lookups
        await db.query(`
      CREATE INDEX IF NOT EXISTS idx_campaign_templates_user_token 
      ON campaign_templates(user_token)
    `);
    },

    down: async (db) => {
        console.log('Reverting migration: 013_create_campaign_templates');
        await db.query('DROP TABLE IF EXISTS campaign_templates');
    }
};
