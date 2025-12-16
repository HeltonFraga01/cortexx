/**
 * Migration: Create teams and team_members tables for multi-user system
 * Version: 055
 * Date: 2025-12-09
 * 
 * This migration creates the teams and team_members tables for organizing agents.
 * Teams allow grouping agents for workload distribution.
 * 
 * Requirements: 5.1, 5.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 055: Criar tabelas teams e team_members');
    
    // Check if teams table already exists
    const teamsCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='teams'"
    );
    
    if (teamsCheck.rows.length === 0) {
      // Create teams table
      const createTeamsSql = `
        CREATE TABLE teams (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          allow_auto_assign INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
          UNIQUE(account_id, name)
        )
      `;
      
      await db.query(createTeamsSql);
      logger.info('✅ Tabela teams criada');
      
      // Create indexes for teams
      await db.query('CREATE INDEX idx_teams_account_id ON teams(account_id)');
      logger.info('✅ Índice idx_teams_account_id criado');
      
      await db.query('CREATE UNIQUE INDEX idx_teams_account_name ON teams(account_id, name)');
      logger.info('✅ Índice idx_teams_account_name criado');
    } else {
      logger.info('ℹ️ Tabela teams já existe');
    }
    
    // Check if team_members table already exists
    const membersCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='team_members'"
    );
    
    if (membersCheck.rows.length === 0) {
      // Create team_members table
      const createMembersSql = `
        CREATE TABLE team_members (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
          UNIQUE(team_id, agent_id)
        )
      `;
      
      await db.query(createMembersSql);
      logger.info('✅ Tabela team_members criada');
      
      // Create indexes for team_members
      await db.query('CREATE INDEX idx_team_members_team_id ON team_members(team_id)');
      logger.info('✅ Índice idx_team_members_team_id criado');
      
      await db.query('CREATE INDEX idx_team_members_agent_id ON team_members(agent_id)');
      logger.info('✅ Índice idx_team_members_agent_id criado');
      
      await db.query('CREATE UNIQUE INDEX idx_team_members_unique ON team_members(team_id, agent_id)');
      logger.info('✅ Índice idx_team_members_unique criado');
    } else {
      logger.info('ℹ️ Tabela team_members já existe');
    }
    
    logger.info('✅ Migration 055 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 055:', error.message);
    throw error;
  }
}

/**
 * Rollback the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function down(db) {
  try {
    logger.info('🔄 Revertendo migration 055: Remover tabelas teams e team_members');
    
    await db.query('DROP TABLE IF EXISTS team_members');
    logger.info('✅ Tabela team_members removida');
    
    await db.query('DROP TABLE IF EXISTS teams');
    logger.info('✅ Tabela teams removida');
    
    logger.info('✅ Migration 055 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 055:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 55,
  description: 'Create teams and team_members tables for multi-user system'
};
