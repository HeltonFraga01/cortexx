/**
 * BrandingRepository - Acesso a dados de Branding
 * 
 * Abstrai a persistência no banco de dados (Supabase).
 * Retorna Entidades de Domínio, não linhas cruas do banco.
 * 
 * Migrated to use SupabaseService directly (Task 14.1.7)
 */

const { logger } = require('../../../../utils/logger');
const SupabaseService = require('../../../../services/SupabaseService');
const BrandingMapper = require('../mappers/BrandingMapper');

class BrandingRepository {
  // eslint-disable-next-line no-unused-vars
  constructor(database) {
    // database parameter kept for backward compatibility but not used
    // All operations use SupabaseService directly
  }

  /**
   * Busca a primeira configuração de branding
   * @returns {Promise<BrandingConfig|null>}
   */
  async findFirst() {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('branding_config', (query) =>
        query.select('*').limit(1)
      );
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        return null;
      }

      return BrandingMapper.toDomain(data[0]);
    } catch (error) {
      logger.error('Erro ao buscar branding:', { error: error.message });
      throw error;
    }
  }

  /**
   * Busca configuração por ID
   * @param {string} id
   * @returns {Promise<BrandingConfig|null>}
   */
  async findById(id) {
    try {
      const { data, error } = await SupabaseService.getById('branding_config', id);
      
      if (error) {
        if (error.code === 'PGRST116' || error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }
      
      if (!data) {
        return null;
      }

      return BrandingMapper.toDomain(data);
    } catch (error) {
      logger.error('Erro ao buscar branding por ID:', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Cria nova configuração de branding
   * @param {Partial<BrandingConfig>} data
   * @returns {Promise<BrandingConfig>}
   */
  async create(data) {
    const dbData = BrandingMapper.toPersistence(data);
    
    try {
      const insertData = {
        app_name: dbData.app_name || 'WUZAPI',
        logo_url: dbData.logo_url || null,
        primary_color: dbData.primary_color || null,
        secondary_color: dbData.secondary_color || null,
        custom_home_html: dbData.custom_home_html || null,
        support_phone: dbData.support_phone || null
      };

      const { data: created, error } = await SupabaseService.insert('branding_config', insertData);

      if (error) {
        throw error;
      }

      return BrandingMapper.toDomain(created);
    } catch (error) {
      logger.error('Erro ao criar branding:', { error: error.message });
      throw error;
    }
  }

  /**
   * Atualiza configuração de branding
   * @param {string} id
   * @param {Partial<BrandingConfig>} data
   * @returns {Promise<BrandingConfig>}
   */
  async update(id, data) {
    const dbData = BrandingMapper.toPersistence(data);
    const updates = {};

    // Construir objeto de updates apenas com campos fornecidos
    if (dbData.app_name !== undefined) {
      updates.app_name = dbData.app_name;
    }
    if (dbData.logo_url !== undefined) {
      updates.logo_url = dbData.logo_url;
    }
    if (dbData.primary_color !== undefined) {
      updates.primary_color = dbData.primary_color;
    }
    if (dbData.secondary_color !== undefined) {
      updates.secondary_color = dbData.secondary_color;
    }
    if (dbData.custom_home_html !== undefined) {
      updates.custom_home_html = dbData.custom_home_html;
    }
    if (dbData.support_phone !== undefined) {
      updates.support_phone = dbData.support_phone;
    }

    if (Object.keys(updates).length === 0) {
      return this.findById(id);
    }

    updates.updated_at = new Date().toISOString();

    try {
      const { data: updated, error } = await SupabaseService.update('branding_config', id, updates);

      if (error) {
        throw error;
      }

      return BrandingMapper.toDomain(updated);
    } catch (error) {
      logger.error('Erro ao atualizar branding:', { error: error.message, id });
      throw error;
    }
  }
}

module.exports = BrandingRepository;
