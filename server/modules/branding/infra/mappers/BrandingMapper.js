/**
 * BrandingMapper - Conversão entre formato do banco e domínio
 * 
 * Converte snake_case (banco) para camelCase (domínio) e vice-versa.
 */

class BrandingMapper {
  /**
   * Converte linha do banco para entidade de domínio
   * @param {Object} row - Linha do banco de dados
   * @returns {BrandingConfig}
   */
  static toDomain(row) {
    if (!row) return null;

    return {
      id: row.id,
      appName: row.app_name,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      customHomeHtml: row.custom_home_html,
      supportPhone: row.support_phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Converte entidade de domínio para formato do banco
   * @param {Partial<BrandingConfig>} entity
   * @returns {Object}
   */
  static toPersistence(entity) {
    if (!entity) return null;

    const result = {};

    if (entity.appName !== undefined) result.app_name = entity.appName;
    if (entity.logoUrl !== undefined) result.logo_url = entity.logoUrl;
    if (entity.primaryColor !== undefined) result.primary_color = entity.primaryColor;
    if (entity.secondaryColor !== undefined) result.secondary_color = entity.secondaryColor;
    if (entity.customHomeHtml !== undefined) result.custom_home_html = entity.customHomeHtml;
    if (entity.supportPhone !== undefined) result.support_phone = entity.supportPhone;

    return result;
  }

  /**
   * Converte entidade de domínio para DTO de resposta
   * @param {BrandingConfig} entity
   * @returns {Object}
   */
  static toDTO(entity) {
    if (!entity) return null;

    return {
      id: entity.id,
      appName: entity.appName,
      logoUrl: entity.logoUrl,
      primaryColor: entity.primaryColor,
      secondaryColor: entity.secondaryColor,
      customHomeHtml: entity.customHomeHtml,
      supportPhone: entity.supportPhone
    };
  }
}

module.exports = BrandingMapper;
