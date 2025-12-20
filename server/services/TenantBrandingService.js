/**
 * TenantBrandingService - Handles tenant-specific branding operations
 * 
 * This service ensures proper tenant isolation for branding data,
 * querying the tenant_branding table filtered by tenant_id.
 * 
 * Requirements: tenant-branding-isolation spec
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class TenantBrandingService {
  /**
   * Get default branding values
   * @returns {Object} Default branding configuration
   */
  getDefaultBranding() {
    return {
      id: null,
      tenantId: null,
      appName: 'WUZAPI',
      logoUrl: null,
      primaryColor: '#0ea5e9',
      secondaryColor: '#64748b',
      primaryForeground: '#ffffff',
      secondaryForeground: '#ffffff',
      customHomeHtml: null,
      supportPhone: null,
      ogImageUrl: null,
      createdAt: null,
      updatedAt: null
    };
  }

  /**
   * Get branding configuration for a specific tenant
   * @param {string} tenantId - UUID of the tenant
   * @returns {Promise<Object>} Branding configuration
   */
  async getBrandingByTenantId(tenantId) {
    try {
      if (!tenantId) {
        logger.warn('getBrandingByTenantId called without tenantId');
        return this.getDefaultBranding();
      }

      const { data, error } = await SupabaseService.adminClient
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No branding found for tenant, return defaults
          logger.info('No branding found for tenant, using defaults', { tenantId });
          return {
            ...this.getDefaultBranding(),
            tenantId
          };
        }
        throw new Error(`Failed to get tenant branding: ${error.message}`);
      }

      // Map snake_case to camelCase
      return {
        id: data.id,
        tenantId: data.tenant_id,
        appName: data.app_name || 'WUZAPI',
        logoUrl: data.logo_url || null,
        primaryColor: data.primary_color || '#0ea5e9',
        secondaryColor: data.secondary_color || '#64748b',
        primaryForeground: data.primary_foreground || '#ffffff',
        secondaryForeground: data.secondary_foreground || '#ffffff',
        customHomeHtml: data.custom_home_html || null,
        supportPhone: data.support_phone || null,
        ogImageUrl: data.og_image_url || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      logger.error('Error fetching tenant branding', {
        error: error.message,
        tenantId
      });
      return {
        ...this.getDefaultBranding(),
        tenantId
      };
    }
  }

  /**
   * Update branding configuration for a tenant
   * @param {string} tenantId - UUID of the tenant
   * @param {Object} brandingData - Branding data to update
   * @returns {Promise<Object>} Updated branding configuration
   */
  async updateBrandingByTenantId(tenantId, brandingData) {
    try {
      if (!tenantId) {
        throw new Error('tenantId is required');
      }

      // Validate required fields
      if (!brandingData.appName || brandingData.appName.trim().length === 0) {
        throw new Error('appName é obrigatório');
      }

      if (brandingData.appName.length > 50) {
        throw new Error('appName deve ter no máximo 50 caracteres');
      }

      // Map camelCase to snake_case for Supabase
      const updateData = {
        tenant_id: tenantId,
        app_name: brandingData.appName.trim(),
        logo_url: brandingData.logoUrl || null,
        primary_color: brandingData.primaryColor || null,
        secondary_color: brandingData.secondaryColor || null,
        primary_foreground: brandingData.primaryForeground || null,
        secondary_foreground: brandingData.secondaryForeground || null,
        custom_home_html: brandingData.customHomeHtml || null,
        support_phone: brandingData.supportPhone || null,
        og_image_url: brandingData.ogImageUrl || null,
        updated_at: new Date().toISOString()
      };

      // Upsert branding data
      const { data, error } = await SupabaseService.adminClient
        .from('tenant_branding')
        .upsert(updateData, { onConflict: 'tenant_id' })
        .select()
        .single();

      if (error) {
        logger.error('Error updating tenant branding', {
          error: error.message,
          tenantId
        });
        throw new Error(`Failed to update tenant branding: ${error.message}`);
      }

      logger.info('Tenant branding updated successfully', {
        tenantId,
        appName: updateData.app_name
      });

      // Map snake_case back to camelCase
      return {
        id: data.id,
        tenantId: data.tenant_id,
        appName: data.app_name,
        logoUrl: data.logo_url,
        primaryColor: data.primary_color,
        secondaryColor: data.secondary_color,
        primaryForeground: data.primary_foreground,
        secondaryForeground: data.secondary_foreground,
        customHomeHtml: data.custom_home_html,
        supportPhone: data.support_phone,
        ogImageUrl: data.og_image_url,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      logger.error('Error in updateBrandingByTenantId', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }
}

module.exports = new TenantBrandingService();
