/**
 * Migration: Normalize existing phone numbers
 * Version: 015
 * Date: 2025-11-25
 * 
 * This migration normalizes all existing phone numbers in the database
 * to the standard format (55DDNNNNNNNNN) using the phoneUtils normalization.
 * 
 * Tables affected:
 * - contacts (phone column)
 * - campaign_contacts (phone column)
 */

const { logger } = require('../utils/logger');
const { normalizePhoneNumber, sanitizePhoneNumber } = require('../utils/phoneUtils');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 015: Normalizar números de telefone');
    
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // 1. Normalize contacts table
    logger.info('📞 Normalizando números na tabela contacts...');
    
    try {
      // Get all contacts with phone numbers
      const result = await db.query('SELECT id, phone FROM contacts WHERE phone IS NOT NULL AND phone != ""');
      const contacts = result.rows || [];
      
      logger.info(`📊 Encontrados ${contacts.length} contatos para processar`);
      
      for (const contact of contacts) {
        try {
          const originalPhone = contact.phone;
          const sanitized = sanitizePhoneNumber(originalPhone);
          
          // Skip if already empty after sanitization
          if (!sanitized) {
            logger.warn(`⚠️ Contato ${contact.id}: número vazio após sanitização`, { originalPhone });
            totalSkipped++;
            continue;
          }
          
          const normalized = normalizePhoneNumber(originalPhone);
          
          // Only update if the phone changed
          if (normalized !== originalPhone) {
            await db.query(
              'UPDATE contacts SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [normalized, contact.id]
            );
            
            logger.debug(`✅ Contato ${contact.id}: ${originalPhone} → ${normalized}`);
            totalUpdated++;
          } else {
            totalSkipped++;
          }
        } catch (error) {
          logger.error(`❌ Erro ao normalizar contato ${contact.id}`, {
            phone: contact.phone,
            error: error.message
          });
          totalErrors++;
        }
      }
      
      logger.info(`✅ Tabela contacts processada: ${totalUpdated} atualizados, ${totalSkipped} mantidos, ${totalErrors} erros`);
      
    } catch (error) {
      logger.error('❌ Erro ao processar tabela contacts:', error.message);
      throw error;
    }
    
    // 2. Normalize campaign_contacts table
    logger.info('📞 Normalizando números na tabela campaign_contacts...');
    
    let campaignUpdated = 0;
    let campaignSkipped = 0;
    let campaignErrors = 0;
    
    try {
      // Get all campaign contacts with phone numbers
      const result = await db.query(
        'SELECT id, phone FROM campaign_contacts WHERE phone IS NOT NULL AND phone != ""'
      );
      const campaignContacts = result.rows || [];
      
      logger.info(`📊 Encontrados ${campaignContacts.length} contatos de campanha para processar`);
      
      for (const contact of campaignContacts) {
        try {
          const originalPhone = contact.phone;
          const sanitized = sanitizePhoneNumber(originalPhone);
          
          // Skip if already empty after sanitization
          if (!sanitized) {
            logger.warn(`⚠️ Contato de campanha ${contact.id}: número vazio após sanitização`, { originalPhone });
            campaignSkipped++;
            continue;
          }
          
          const normalized = normalizePhoneNumber(originalPhone);
          
          // Only update if the phone changed
          if (normalized !== originalPhone) {
            await db.query(
              'UPDATE campaign_contacts SET phone = ? WHERE id = ?',
              [normalized, contact.id]
            );
            
            logger.debug(`✅ Contato de campanha ${contact.id}: ${originalPhone} → ${normalized}`);
            campaignUpdated++;
          } else {
            campaignSkipped++;
          }
        } catch (error) {
          logger.error(`❌ Erro ao normalizar contato de campanha ${contact.id}`, {
            phone: contact.phone,
            error: error.message
          });
          campaignErrors++;
        }
      }
      
      logger.info(`✅ Tabela campaign_contacts processada: ${campaignUpdated} atualizados, ${campaignSkipped} mantidos, ${campaignErrors} erros`);
      
    } catch (error) {
      logger.error('❌ Erro ao processar tabela campaign_contacts:', error.message);
      throw error;
    }
    
    // 3. Summary
    const grandTotalUpdated = totalUpdated + campaignUpdated;
    const grandTotalSkipped = totalSkipped + campaignSkipped;
    const grandTotalErrors = totalErrors + campaignErrors;
    
    logger.info('📊 Resumo da normalização:');
    logger.info(`   ✅ Total atualizado: ${grandTotalUpdated}`);
    logger.info(`   ⏭️  Total mantido: ${grandTotalSkipped}`);
    logger.info(`   ❌ Total com erro: ${grandTotalErrors}`);
    
    // 4. Verify data integrity
    logger.info('🔍 Verificando integridade dos dados...');
    
    try {
      // Check for any remaining non-normalized numbers (basic check)
      const contactsResult = await db.query(
        `SELECT COUNT(*) as count FROM contacts 
         WHERE phone LIKE '%@%' OR phone LIKE '%(%' OR phone LIKE '%-%'`
      );
      
      const campaignContactsResult = await db.query(
        `SELECT COUNT(*) as count FROM campaign_contacts 
         WHERE phone LIKE '%@%' OR phone LIKE '%(%' OR phone LIKE '%-%'`
      );
      
      const remainingIssues = (contactsResult.rows[0]?.count || 0) + (campaignContactsResult.rows[0]?.count || 0);
      
      if (remainingIssues > 0) {
        logger.warn(`⚠️ Ainda existem ${remainingIssues} números com caracteres especiais`);
      } else {
        logger.info('✅ Todos os números foram normalizados corretamente');
      }
      
    } catch (error) {
      logger.warn('⚠️ Não foi possível verificar integridade completa:', error.message);
    }
    
    logger.info('✅ Migration 015 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 015:', error.message);
    throw error;
  }
}

/**
 * Rollback the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function down(db) {
  // This migration only normalizes data, it doesn't change schema
  // Rollback is not applicable as we don't have the original values
  logger.info('⚠️ Migration 015 não pode ser revertida (apenas normalização de dados)');
  logger.info('   Os valores originais não foram preservados');
}

module.exports = {
  up,
  down,
  version: 15,
  description: 'Normalize existing phone numbers to standard format'
};
