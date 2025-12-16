/**
 * BrandingRepository - Acesso a dados de Branding
 * 
 * Abstrai a persistência SQLite.
 * Retorna Entidades de Domínio, não linhas cruas do banco.
 */

const { logger } = require('../../../../utils/logger');
const BrandingMapper = require('../mappers/BrandingMapper');

class BrandingRepository {
  constructor(database) {
    this.db = database;
  }

  /**
   * Busca a primeira configuração de branding
   * @returns {Promise<BrandingConfig|null>}
   */
  async findFirst() {
    try {
      const { rows } = await this.db.query('SELECT * FROM branding_config LIMIT 1');
      
      if (rows.length === 0) {
        return null;
      }

      return BrandingMapper.toDomain(rows[0]);
    } catch (error) {
      logger.error('Erro ao buscar branding:', error.message);
      throw error;
    }
  }

  /**
   * Busca configuração por ID
   * @param {number} id
   * @returns {Promise<BrandingConfig|null>}
   */
  async findById(id) {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM branding_config WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }

      return BrandingMapper.toDomain(rows[0]);
    } catch (error) {
      logger.error('Erro ao buscar branding por ID:', error.message);
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
      const { lastID } = await this.db.query(`
        INSERT INTO branding_config (
          app_name, logo_url, primary_color, secondary_color, 
          custom_home_html, support_phone
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        dbData.app_name || 'WUZAPI',
        dbData.logo_url,
        dbData.primary_color,
        dbData.secondary_color,
        dbData.custom_home_html,
        dbData.support_phone
      ]);

      return this.findById(lastID);
    } catch (error) {
      logger.error('Erro ao criar branding:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza configuração de branding
   * @param {number} id
   * @param {Partial<BrandingConfig>} data
   * @returns {Promise<BrandingConfig>}
   */
  async update(id, data) {
    const dbData = BrandingMapper.toPersistence(data);
    const updates = [];
    const values = [];

    // Construir query dinâmica apenas com campos fornecidos
    if (dbData.app_name !== undefined) {
      updates.push('app_name = ?');
      values.push(dbData.app_name);
    }
    if (dbData.logo_url !== undefined) {
      updates.push('logo_url = ?');
      values.push(dbData.logo_url);
    }
    if (dbData.primary_color !== undefined) {
      updates.push('primary_color = ?');
      values.push(dbData.primary_color);
    }
    if (dbData.secondary_color !== undefined) {
      updates.push('secondary_color = ?');
      values.push(dbData.secondary_color);
    }
    if (dbData.custom_home_html !== undefined) {
      updates.push('custom_home_html = ?');
      values.push(dbData.custom_home_html);
    }
    if (dbData.support_phone !== undefined) {
      updates.push('support_phone = ?');
      values.push(dbData.support_phone);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    try {
      await this.db.query(
        `UPDATE branding_config SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      return this.findById(id);
    } catch (error) {
      logger.error('Erro ao atualizar branding:', error.message);
      throw error;
    }
  }
}

module.exports = BrandingRepository;
