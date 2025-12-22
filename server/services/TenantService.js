const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

/**
 * TenantService - Handles tenant operations and management
 * Requirements: 8.1
 */
class TenantService {
  constructor() {
    this.supabase = SupabaseService;
  }

  /**
   * Get tenant by ID
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} Tenant data
   */
  async getById(tenantId) {
    try {
      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .select(`
          *,
          tenant_branding (
            app_name,
            logo_url,
            primary_color,
            secondary_color,
            primary_foreground,
            secondary_foreground,
            custom_home_html,
            support_phone,
            og_image_url
          )
        `)
        .eq('id', tenantId)
        .single();

      if (error) {
        throw new Error(`Tenant not found: ${error.message}`);
      }

      return tenant;
    } catch (error) {
      logger.error('Failed to get tenant by ID', { 
        error: error.message,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Get tenant by subdomain
   * @param {string} subdomain - Tenant subdomain
   * @returns {Promise<Object>} Tenant data
   */
  async getBySubdomain(subdomain) {
    try {
      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .select(`
          *,
          tenant_branding (
            app_name,
            logo_url,
            primary_color,
            secondary_color,
            primary_foreground,
            secondary_foreground,
            custom_home_html,
            support_phone,
            og_image_url
          )
        `)
        .eq('subdomain', subdomain.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Tenant not found
        }
        throw new Error(`Failed to get tenant: ${error.message}`);
      }

      return tenant;
    } catch (error) {
      logger.error('Failed to get tenant by subdomain', { 
        error: error.message,
        subdomain 
      });
      throw error;
    }
  }

  /**
   * Validate subdomain format and availability
   * @param {string} subdomain - Subdomain to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateSubdomain(subdomain) {
    try {
      // Format validation
      const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
      const isValidFormat = subdomain && 
                           subdomain.length >= 2 && 
                           subdomain.length <= 63 && 
                           subdomainRegex.test(subdomain) &&
                           !subdomain.includes('--'); // No consecutive hyphens

      if (!isValidFormat) {
        return {
          valid: false,
          error: 'Invalid subdomain format. Use lowercase alphanumeric with hyphens only, 2-63 characters.'
        };
      }

      // Reserved subdomains
      const reservedSubdomains = [
        'www', 'api', 'admin', 'superadmin', 'app', 'mail', 'email', 
        'support', 'help', 'blog', 'docs', 'status', 'cdn', 'assets',
        'static', 'media', 'files', 'download', 'upload', 'ftp', 'ssh',
        'test', 'staging', 'dev', 'development', 'prod', 'production'
      ];

      if (reservedSubdomains.includes(subdomain.toLowerCase())) {
        return {
          valid: false,
          error: 'This subdomain is reserved and cannot be used.'
        };
      }

      // Check availability
      const existingTenant = await this.getBySubdomain(subdomain);
      if (existingTenant) {
        return {
          valid: false,
          error: 'This subdomain is already taken.'
        };
      }

      return {
        valid: true,
        subdomain: subdomain.toLowerCase()
      };
    } catch (error) {
      logger.error('Failed to validate subdomain', { 
        error: error.message,
        subdomain 
      });
      return {
        valid: false,
        error: 'Failed to validate subdomain availability.'
      };
    }
  }

  /**
   * Get tenant branding
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} Tenant branding data
   */
  async getBranding(tenantId) {
    try {
      const { data: branding, error } = await this.supabase.adminClient
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No branding found, return defaults
          return {
            tenant_id: tenantId,
            app_name: 'WUZAPI',
            logo_url: null,
            primary_color: '#0ea5e9',
            secondary_color: '#64748b',
            primary_foreground: '#ffffff',
            secondary_foreground: '#ffffff',
            custom_home_html: null,
            support_phone: null,
            og_image_url: null
          };
        }
        throw new Error(`Failed to get branding: ${error.message}`);
      }

      return branding;
    } catch (error) {
      logger.error('Failed to get tenant branding', { 
        error: error.message,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Update tenant branding
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Branding data to update
   * @returns {Promise<Object>} Updated branding data
   */
  async updateBranding(tenantId, data) {
    try {
      const {
        app_name,
        logo_url,
        primary_color,
        secondary_color,
        primary_foreground,
        secondary_foreground,
        custom_home_html,
        support_phone,
        og_image_url
      } = data;

      // Upsert branding data - specify onConflict column
      const { data: branding, error } = await this.supabase.adminClient
        .from('tenant_branding')
        .upsert({
          tenant_id: tenantId,
          ...(app_name !== undefined && { app_name }),
          ...(logo_url !== undefined && { logo_url }),
          ...(primary_color !== undefined && { primary_color }),
          ...(secondary_color !== undefined && { secondary_color }),
          ...(primary_foreground !== undefined && { primary_foreground }),
          ...(secondary_foreground !== undefined && { secondary_foreground }),
          ...(custom_home_html !== undefined && { custom_home_html }),
          ...(support_phone !== undefined && { support_phone }),
          ...(og_image_url !== undefined && { og_image_url }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update branding: ${error.message}`);
      }

      logger.info('Tenant branding updated successfully', { 
        tenantId,
        updatedFields: Object.keys(data)
      });

      return branding;
    } catch (error) {
      logger.error('Failed to update tenant branding', { 
        error: error.message,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Get tenant status and basic info for middleware
   * @param {string} subdomain - Tenant subdomain
   * @returns {Promise<Object|null>} Tenant status info
   */
  async getTenantStatus(subdomain) {
    try {
      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .select('id, subdomain, name, status')
        .eq('subdomain', subdomain.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Tenant not found
        }
        throw new Error(`Failed to get tenant status: ${error.message}`);
      }

      return tenant;
    } catch (error) {
      logger.error('Failed to get tenant status', { 
        error: error.message,
        subdomain 
      });
      return null;
    }
  }

  /**
   * Check if tenant is active and accessible
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<boolean>} True if tenant is accessible
   */
  async isTenantAccessible(tenantId) {
    try {
      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .select('status')
        .eq('id', tenantId)
        .single();

      if (error) {
        return false;
      }

      return tenant.status === 'active';
    } catch (error) {
      logger.error('Failed to check tenant accessibility', { 
        error: error.message,
        tenantId 
      });
      return false;
    }
  }

  // ========================================
  // TENANT PLAN METHODS
  // ========================================

  /**
   * Create a new tenant plan
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Plan data
   * @returns {Promise<Object>} Created plan
   */
  async createPlan(tenantId, data) {
    try {
      const {
        name,
        description,
        price_cents = 0,
        billing_cycle = 'monthly',
        status = 'active',
        is_default = false,
        trial_days = 0,
        quotas = {},
        features = {},
        stripe_product_id,
        stripe_price_id
      } = data;

      // Validate quotas against global limits
      const validationResult = await this.validateQuotasAgainstGlobal(quotas);
      if (!validationResult.valid) {
        throw new Error(`Quota validation failed: ${validationResult.error}`);
      }

      const { data: plan, error } = await this.supabase.adminClient
        .from('tenant_plans')
        .insert({
          tenant_id: tenantId,
          name,
          description,
          price_cents,
          billing_cycle,
          status,
          is_default,
          trial_days,
          quotas: validationResult.quotas,
          features,
          stripe_product_id,
          stripe_price_id
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('A plan with this name already exists for this tenant');
        }
        throw new Error(`Failed to create plan: ${error.message}`);
      }

      logger.info('Tenant plan created successfully', { 
        tenantId,
        planId: plan.id,
        planName: name
      });

      return plan;
    } catch (error) {
      logger.error('Failed to create tenant plan', { 
        error: error.message,
        tenantId,
        planName: data.name
      });
      throw error;
    }
  }

  /**
   * Update an existing tenant plan
   * @param {string} planId - Plan UUID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated plan
   */
  async updatePlan(planId, data) {
    try {
      const {
        name,
        description,
        price_cents,
        billing_cycle,
        status,
        is_default,
        trial_days,
        quotas,
        features,
        stripe_product_id,
        stripe_price_id
      } = data;

      // If quotas are being updated, validate against global limits
      if (quotas) {
        const validationResult = await this.validateQuotasAgainstGlobal(quotas);
        if (!validationResult.valid) {
          throw new Error(`Quota validation failed: ${validationResult.error}`);
        }
        data.quotas = validationResult.quotas;
      }

      const { data: plan, error } = await this.supabase.adminClient
        .from('tenant_plans')
        .update({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(price_cents !== undefined && { price_cents }),
          ...(billing_cycle !== undefined && { billing_cycle }),
          ...(status !== undefined && { status }),
          ...(is_default !== undefined && { is_default }),
          ...(trial_days !== undefined && { trial_days }),
          ...(quotas !== undefined && { quotas: data.quotas }),
          ...(features !== undefined && { features }),
          ...(stripe_product_id !== undefined && { stripe_product_id }),
          ...(stripe_price_id !== undefined && { stripe_price_id }),
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update plan: ${error.message}`);
      }

      logger.info('Tenant plan updated successfully', { 
        planId,
        updatedFields: Object.keys(data)
      });

      return plan;
    } catch (error) {
      logger.error('Failed to update tenant plan', { 
        error: error.message,
        planId
      });
      throw error;
    }
  }

  /**
   * Delete a tenant plan
   * @param {string} planId - Plan UUID
   * @param {string} migrateToPlanId - Optional plan ID to migrate existing subscriptions
   * @returns {Promise<void>}
   */
  async deletePlan(planId, migrateToPlanId = null) {
    try {
      // Check if plan has active subscriptions
      const { count: activeSubscriptions } = await this.supabase.adminClient
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)
        .eq('status', 'active');

      if (activeSubscriptions > 0) {
        if (!migrateToPlanId) {
          throw new Error('Cannot delete plan with active subscriptions. Provide a migration plan or cancel subscriptions first.');
        }

        // Migrate subscriptions to the new plan
        const { error: migrationError } = await this.supabase.adminClient
          .from('user_subscriptions')
          .update({ 
            plan_id: migrateToPlanId,
            updated_at: new Date().toISOString()
          })
          .eq('plan_id', planId)
          .eq('status', 'active');

        if (migrationError) {
          throw new Error(`Failed to migrate subscriptions: ${migrationError.message}`);
        }

        logger.info('Migrated subscriptions before plan deletion', { 
          planId,
          migrateToPlanId,
          subscriptionCount: activeSubscriptions
        });
      }

      // Delete the plan
      const { error } = await this.supabase.adminClient
        .from('tenant_plans')
        .delete()
        .eq('id', planId);

      if (error) {
        throw new Error(`Failed to delete plan: ${error.message}`);
      }

      logger.info('Tenant plan deleted successfully', { 
        planId,
        migratedSubscriptions: activeSubscriptions
      });
    } catch (error) {
      logger.error('Failed to delete tenant plan', { 
        error: error.message,
        planId
      });
      throw error;
    }
  }

  /**
   * List plans for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of plans
   */
  async listPlans(tenantId, filters = {}) {
    try {
      let query = this.supabase.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.billing_cycle) {
        query = query.eq('billing_cycle', filters.billing_cycle);
      }

      const { data: plans, error } = await query;

      if (error) {
        throw new Error(`Failed to list plans: ${error.message}`);
      }

      return plans;
    } catch (error) {
      logger.error('Failed to list tenant plans', { 
        error: error.message,
        tenantId,
        filters
      });
      throw error;
    }
  }

  /**
   * Validate quotas against global platform limits
   * @param {Object} quotas - Quotas to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateQuotasAgainstGlobal(quotas) {
    try {
      // Get global limits from system settings
      const { data: globalLimits } = await this.supabase.adminClient
        .from('global_settings')
        .select('value')
        .eq('key', 'global_quota_limits')
        .single();

      const limits = globalLimits?.value || {
        max_agents: 1000,
        max_inboxes: 100,
        max_messages_per_day: 10000,
        max_messages_per_month: 300000,
        max_bots: 50,
        max_teams: 100,
        max_webhooks: 50,
        max_campaigns: 100,
        max_storage_mb: 10000,
        max_connections: 100
      };

      const validatedQuotas = { ...quotas };
      const errors = [];

      // Validate each quota against global limits
      for (const [key, value] of Object.entries(quotas)) {
        if (limits[key] !== undefined && value > limits[key]) {
          errors.push(`${key}: ${value} exceeds global limit of ${limits[key]}`);
          validatedQuotas[key] = limits[key]; // Cap at global limit
        }
      }

      if (errors.length > 0) {
        logger.warn('Quotas exceeded global limits, capped automatically', { 
          errors,
          originalQuotas: quotas,
          cappedQuotas: validatedQuotas
        });
      }

      return {
        valid: true,
        quotas: validatedQuotas,
        warnings: errors.length > 0 ? errors : null
      };
    } catch (error) {
      logger.error('Failed to validate quotas against global limits', { 
        error: error.message,
        quotas
      });
      return {
        valid: false,
        error: 'Failed to validate quotas against global limits'
      };
    }
  }

  // ========================================
  // ACCOUNT LISTING METHODS
  // ========================================

  /**
   * List accounts for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of accounts
   */
  async listAccounts(tenantId, filters = {}) {
    try {
      let query = this.supabase.adminClient
        .from('accounts')
        .select(`
          *,
          user_subscriptions (
            status,
            tenant_plans (
              name,
              price_cents
            )
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data: accounts, error } = await query;

      if (error) {
        throw new Error(`Failed to list accounts: ${error.message}`);
      }

      return accounts;
    } catch (error) {
      logger.error('Failed to list tenant accounts', { 
        error: error.message,
        tenantId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get account statistics for a tenant
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} Account statistics
   */
  async getAccountStats(tenantId) {
    try {
      // Get total account count
      const { count: totalAccounts } = await this.supabase.adminClient
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // Get active account count
      const { count: activeAccounts } = await this.supabase.adminClient
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      // Get accounts with active subscriptions
      const { count: subscribedAccounts } = await this.supabase.adminClient
        .from('user_subscriptions')
        .select(`
          accounts!inner (tenant_id)
        `, { count: 'exact', head: true })
        .eq('accounts.tenant_id', tenantId)
        .eq('status', 'active');

      // Get total agent count
      const { count: totalAgents } = await this.supabase.adminClient
        .from('agents')
        .select(`
          accounts!inner (tenant_id)
        `, { count: 'exact', head: true })
        .eq('accounts.tenant_id', tenantId)
        .eq('status', 'active');

      // Get total inbox count
      const { count: totalInboxes } = await this.supabase.adminClient
        .from('inboxes')
        .select(`
          accounts!inner (tenant_id)
        `, { count: 'exact', head: true })
        .eq('accounts.tenant_id', tenantId)
        .eq('status', 'active');

      return {
        accounts: {
          total: totalAccounts || 0,
          active: activeAccounts || 0,
          subscribed: subscribedAccounts || 0
        },
        agents: totalAgents || 0,
        inboxes: totalInboxes || 0,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get account stats', { 
        error: error.message,
        tenantId
      });
      throw error;
    }
  }
}

module.exports = new TenantService();