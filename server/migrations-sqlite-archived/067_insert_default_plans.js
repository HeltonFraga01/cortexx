/**
 * Migration: Insert default plans data
 * Version: 067
 * Date: 2025-12-09
 * 
 * This migration inserts default subscription plans: Free, Basic, Pro, Enterprise.
 * Each plan has different quotas and features.
 * 
 * Requirements: 1.1
 */

const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 067: Inserir planos padrão');
    
    // Check if plans already exist
    const existingPlans = await db.query('SELECT COUNT(*) as count FROM plans');
    
    if (existingPlans.rows[0].count > 0) {
      logger.info('ℹ️ Planos já existem, pulando inserção');
      return;
    }
    
    // Default features for each plan (only user features, no admin features)
    // User features: bulk_campaigns, nocodb_integration, bot_automation, advanced_reports,
    //                api_access, webhooks, scheduled_messages, media_storage
    // Removed: page_builder, custom_branding (admin-only), chatwoot_integration, typebot_integration (not implemented)
    
    const freeFeatures = JSON.stringify({
      bulk_campaigns: false,
      nocodb_integration: false,
      bot_automation: false,
      advanced_reports: false,
      api_access: true,
      webhooks: true,
      scheduled_messages: false,
      media_storage: true
    });
    
    const basicFeatures = JSON.stringify({
      bulk_campaigns: true,
      nocodb_integration: true,
      bot_automation: false,
      advanced_reports: false,
      api_access: true,
      webhooks: true,
      scheduled_messages: true,
      media_storage: true
    });
    
    const proFeatures = JSON.stringify({
      bulk_campaigns: true,
      nocodb_integration: true,
      bot_automation: true,
      advanced_reports: false,
      api_access: true,
      webhooks: true,
      scheduled_messages: true,
      media_storage: true
    });
    
    const enterpriseFeatures = JSON.stringify({
      bulk_campaigns: true,
      nocodb_integration: true,
      bot_automation: true,
      advanced_reports: true,
      api_access: true,
      webhooks: true,
      scheduled_messages: true,
      media_storage: true
    });
    
    // Insert default plans
    const plans = [
      {
        id: uuidv4(),
        name: 'Free',
        description: 'Plano gratuito com recursos básicos',
        price_cents: 0,
        billing_cycle: 'monthly',
        status: 'active',
        is_default: 1,
        trial_days: 0,
        max_agents: 1,
        max_connections: 1,
        max_messages_per_day: 50,
        max_messages_per_month: 500,
        max_inboxes: 1,
        max_teams: 0,
        max_webhooks: 2,
        max_campaigns: 0,
        max_storage_mb: 50,
        features: freeFeatures
      },
      {
        id: uuidv4(),
        name: 'Basic',
        description: 'Plano básico para pequenos negócios',
        price_cents: 4990,
        billing_cycle: 'monthly',
        status: 'active',
        is_default: 0,
        trial_days: 14,
        max_agents: 3,
        max_connections: 2,
        max_messages_per_day: 500,
        max_messages_per_month: 10000,
        max_inboxes: 2,
        max_teams: 1,
        max_webhooks: 5,
        max_campaigns: 5,
        max_storage_mb: 500,
        features: basicFeatures
      },
      {
        id: uuidv4(),
        name: 'Pro',
        description: 'Plano profissional com recursos avançados',
        price_cents: 9990,
        billing_cycle: 'monthly',
        status: 'active',
        is_default: 0,
        trial_days: 14,
        max_agents: 10,
        max_connections: 5,
        max_messages_per_day: 2000,
        max_messages_per_month: 50000,
        max_inboxes: 5,
        max_teams: 3,
        max_webhooks: 20,
        max_campaigns: 20,
        max_storage_mb: 2000,
        features: proFeatures
      },
      {
        id: uuidv4(),
        name: 'Enterprise',
        description: 'Plano empresarial com recursos ilimitados',
        price_cents: 29990,
        billing_cycle: 'monthly',
        status: 'active',
        is_default: 0,
        trial_days: 30,
        max_agents: 100,
        max_connections: 20,
        max_messages_per_day: 10000,
        max_messages_per_month: 200000,
        max_inboxes: 20,
        max_teams: 10,
        max_webhooks: 100,
        max_campaigns: 100,
        max_storage_mb: 10000,
        features: enterpriseFeatures
      }
    ];
    
    for (const plan of plans) {
      await db.query(`
        INSERT INTO plans (
          id, name, description, price_cents, billing_cycle, status, is_default, trial_days,
          max_agents, max_connections, max_messages_per_day, max_messages_per_month,
          max_inboxes, max_teams, max_webhooks, max_campaigns, max_storage_mb, features
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        plan.id, plan.name, plan.description, plan.price_cents, plan.billing_cycle,
        plan.status, plan.is_default, plan.trial_days, plan.max_agents, plan.max_connections,
        plan.max_messages_per_day, plan.max_messages_per_month, plan.max_inboxes,
        plan.max_teams, plan.max_webhooks, plan.max_campaigns, plan.max_storage_mb, plan.features
      ]);
      logger.info(`✅ Plano ${plan.name} inserido`);
    }
    
    // Update system_settings with default plan ID
    const defaultPlan = plans.find(p => p.is_default === 1);
    if (defaultPlan) {
      await db.query(
        'UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [defaultPlan.id, 'default_plan_id']
      );
      logger.info('✅ Plano padrão configurado em system_settings');
    }
    
    logger.info('✅ Migration 067 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 067:', error.message);
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
    logger.info('🔄 Revertendo migration 067: Remover planos padrão');
    
    await db.query("DELETE FROM plans WHERE name IN ('Free', 'Basic', 'Pro', 'Enterprise')");
    logger.info('✅ Planos padrão removidos');
    
    await db.query("UPDATE system_settings SET value = '' WHERE key = 'default_plan_id'");
    logger.info('✅ Configuração de plano padrão limpa');
    
    logger.info('✅ Migration 067 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 067:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 67,
  description: 'Insert default plans data'
};
