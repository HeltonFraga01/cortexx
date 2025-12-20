/**
 * TenantCreditPackageService - Service for managing tenant-specific credit packages
 * 
 * This service ensures all credit package operations are scoped to a specific tenant,
 * preventing cross-tenant access to credit package data.
 * 
 * Requirements: REQ-13 (Multi-Tenant Isolation Audit)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class TenantCreditPackageService {
  /**
   * Create a new credit package for a specific tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Package data
   * @returns {Promise<Object>} Created package
   */
  async createPackage(tenantId, data) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      if (!data.name || !data.creditAmount || data.creditAmount <= 0) {
        throw new Error('Invalid package data: name and creditAmount are required');
      }

      if (data.priceCents < 0) {
        throw new Error('Price cannot be negative');
      }

      const packageData = {
        tenant_id: tenantId,
        name: data.name,
        description: data.description || null,
        credit_amount: data.creditAmount,
        price_cents: data.priceCents || 0,
        status: data.status || 'active'
      };

      const { data: pkg, error } = await SupabaseService.adminClient
        .from('tenant_credit_packages')
        .insert(packageData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A credit package with this name already exists for this tenant');
        }
        throw error;
      }

      logger.info('Tenant credit package created', {
        tenantId,
        packageId: pkg.id,
        name: data.name
      });

      return this.formatPackage(pkg);
    } catch (error) {
      logger.error('Failed to create tenant credit package', {
        error: error.message,
        tenantId,
        data: { name: data.name }
      });
      throw error;
    }
  }

  /**
   * Get package by ID with tenant validation
   * @param {string} packageId - Package UUID
   * @param {string} tenantId - Tenant UUID for validation
   * @returns {Promise<Object|null>} Package or null if not found
   */
  async getPackageById(packageId, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required for package access');
      }

      const { data: pkg, error } = await SupabaseService.adminClient
        .from('tenant_credit_packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!pkg) {
        return null;
      }

      // CRITICAL: Validate tenant ownership
      if (pkg.tenant_id !== tenantId) {
        logger.warn('Cross-tenant credit package access attempt blocked', {
          tenantId,
          packageTenantId: pkg.tenant_id,
          packageId
        });
        return null; // Return null instead of throwing to avoid information leakage
      }

      return this.formatPackage(pkg);
    } catch (error) {
      logger.error('Failed to get tenant credit package', {
        error: error.message,
        packageId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * List all credit packages for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Object[]>} List of packages
   */
  async listPackages(tenantId, filters = {}) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      let query = SupabaseService.adminClient
        .from('tenant_credit_packages')
        .select('*')
        .eq('tenant_id', tenantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.activeOnly) {
        query = query.eq('status', 'active');
      }

      query = query.order('credit_amount', { ascending: true });

      const { data: packages, error } = await query;

      if (error) {
        throw error;
      }

      return (packages || []).map(pkg => this.formatPackage(pkg));
    } catch (error) {
      logger.error('Failed to list tenant credit packages', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Update package with tenant validation
   * @param {string} packageId - Package UUID
   * @param {string} tenantId - Tenant UUID for validation
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated package
   */
  async updatePackage(packageId, tenantId, data) {
    try {
      // Validate tenant access first
      const existingPackage = await this.getPackageById(packageId, tenantId);
      if (!existingPackage) {
        throw new Error('Credit package not found');
      }

      const updates = {};

      if (data.name !== undefined) {
        updates.name = data.name;
      }

      if (data.description !== undefined) {
        updates.description = data.description;
      }

      if (data.creditAmount !== undefined) {
        if (data.creditAmount <= 0) {
          throw new Error('Credit amount must be greater than 0');
        }
        updates.credit_amount = data.creditAmount;
      }

      if (data.priceCents !== undefined) {
        if (data.priceCents < 0) {
          throw new Error('Price cannot be negative');
        }
        updates.price_cents = data.priceCents;
      }

      if (data.status !== undefined) {
        if (!['active', 'inactive', 'archived'].includes(data.status)) {
          throw new Error('Invalid status');
        }
        updates.status = data.status;
      }

      if (data.stripeProductId !== undefined) {
        updates.stripe_product_id = data.stripeProductId;
      }

      if (data.stripePriceId !== undefined) {
        updates.stripe_price_id = data.stripePriceId;
      }

      if (Object.keys(updates).length === 0) {
        return existingPackage;
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedPackage, error } = await SupabaseService.adminClient
        .from('tenant_credit_packages')
        .update(updates)
        .eq('id', packageId)
        .eq('tenant_id', tenantId) // Double-check tenant ownership
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A credit package with this name already exists for this tenant');
        }
        throw error;
      }

      logger.info('Tenant credit package updated', { packageId, tenantId });

      return this.formatPackage(updatedPackage);
    } catch (error) {
      logger.error('Failed to update tenant credit package', {
        error: error.message,
        packageId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Delete (soft delete) package with tenant validation
   * @param {string} packageId - Package UUID
   * @param {string} tenantId - Tenant UUID for validation
   * @returns {Promise<void>}
   */
  async deletePackage(packageId, tenantId) {
    try {
      // Validate tenant access first
      const existingPackage = await this.getPackageById(packageId, tenantId);
      if (!existingPackage) {
        throw new Error('Credit package not found');
      }

      // Soft delete by setting status to inactive
      const { error } = await SupabaseService.adminClient
        .from('tenant_credit_packages')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', packageId)
        .eq('tenant_id', tenantId); // Double-check tenant ownership

      if (error) {
        throw error;
      }

      logger.info('Tenant credit package deleted', { packageId, tenantId });
    } catch (error) {
      logger.error('Failed to delete tenant credit package', {
        error: error.message,
        packageId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Hard delete package (use with caution)
   * @param {string} packageId - Package UUID
   * @param {string} tenantId - Tenant UUID for validation
   * @returns {Promise<void>}
   */
  async hardDeletePackage(packageId, tenantId) {
    try {
      // Validate tenant access first
      const existingPackage = await this.getPackageById(packageId, tenantId);
      if (!existingPackage) {
        throw new Error('Credit package not found');
      }

      const { error } = await SupabaseService.adminClient
        .from('tenant_credit_packages')
        .delete()
        .eq('id', packageId)
        .eq('tenant_id', tenantId); // Double-check tenant ownership

      if (error) {
        throw error;
      }

      logger.info('Tenant credit package hard deleted', { packageId, tenantId });
    } catch (error) {
      logger.error('Failed to hard delete tenant credit package', {
        error: error.message,
        packageId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Format package from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted package
   */
  formatPackage(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      creditAmount: row.credit_amount,
      priceCents: row.price_cents,
      status: row.status,
      stripeProductId: row.stripe_product_id,
      stripePriceId: row.stripe_price_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
module.exports = new TenantCreditPackageService();
