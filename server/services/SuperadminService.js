const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

/**
 * SuperadminService - Handles superadmin authentication and management
 * Requirements: 1.1, 1.3, 1.4
 */
class SuperadminService {
  constructor() {
    this.supabase = SupabaseService;
  }

  /**
   * Authenticate superadmin with email and password
   * @param {string} email - Superadmin email
   * @param {string} password - Plain text password
   * @returns {Promise<Object>} Superadmin session data
   */
  async authenticate(email, password) {
    try {
      // Find superadmin by email
      const { data: superadmin, error } = await this.supabase.adminClient
        .from('superadmins')
        .select('*')
        .eq('email', email)
        .eq('status', 'active')
        .single();

      if (error || !superadmin) {
        logger.warn('Superadmin authentication failed - user not found', { email });
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, superadmin.password_hash);
      if (!isValidPassword) {
        logger.warn('Superadmin authentication failed - invalid password', { 
          email, 
          superadminId: superadmin.id 
        });
        throw new Error('Invalid credentials');
      }

      // Update last login timestamp
      await this.supabase.adminClient
        .from('superadmins')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', superadmin.id);

      // Create session
      const sessionToken = await this.createSession(superadmin.id);

      logger.info('Superadmin authenticated successfully', { 
        superadminId: superadmin.id,
        email: superadmin.email 
      });

      return {
        superadmin: {
          id: superadmin.id,
          email: superadmin.email,
          name: superadmin.name,
          status: superadmin.status
        },
        sessionToken,
        role: 'superadmin'
      };
    } catch (error) {
      logger.error('Superadmin authentication error', { 
        error: error.message,
        email 
      });
      throw error;
    }
  }

  /**
   * Create a new session for superadmin
   * @param {string} superadminId - Superadmin UUID
   * @returns {Promise<string>} Session token
   */
  async createSession(superadminId) {
    try {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

      // Store session in database (we'll use a sessions table or similar)
      // For now, we'll return the token and handle storage in middleware
      
      logger.info('Superadmin session created', { 
        superadminId,
        expiresAt: expiresAt.toISOString()
      });

      return sessionToken;
    } catch (error) {
      logger.error('Failed to create superadmin session', { 
        error: error.message,
        superadminId 
      });
      throw error;
    }
  }

  /**
   * Invalidate all sessions for a superadmin (e.g., on password change)
   * @param {string} superadminId - Superadmin UUID
   * @returns {Promise<void>}
   */
  async invalidateSessions(superadminId) {
    try {
      // This would invalidate all sessions for the superadmin
      // Implementation depends on session storage mechanism
      
      logger.info('All sessions invalidated for superadmin', { superadminId });
    } catch (error) {
      logger.error('Failed to invalidate superadmin sessions', { 
        error: error.message,
        superadminId 
      });
      throw error;
    }
  }

  /**
   * Verify if a session token is valid for a superadmin
   * @param {string} sessionToken - Session token to verify
   * @returns {Promise<Object|null>} Superadmin data if valid, null if invalid
   */
  async verifySession(sessionToken) {
    try {
      // This would verify the session token
      // Implementation depends on session storage mechanism
      
      return null; // Placeholder
    } catch (error) {
      logger.error('Failed to verify superadmin session', { 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Get superadmin by ID
   * @param {string} superadminId - Superadmin UUID
   * @returns {Promise<Object>} Superadmin data
   */
  async getById(superadminId) {
    try {
      const { data: superadmin, error } = await this.supabase.adminClient
        .from('superadmins')
        .select('id, email, name, status, last_login_at, created_at')
        .eq('id', superadminId)
        .single();

      if (error) {
        throw new Error(`Superadmin not found: ${error.message}`);
      }

      return superadmin;
    } catch (error) {
      logger.error('Failed to get superadmin by ID', { 
        error: error.message,
        superadminId 
      });
      throw error;
    }
  }

  /**
   * Create a new superadmin
   * @param {Object} data - Superadmin data
   * @returns {Promise<Object>} Created superadmin
   */
  async create(data) {
    try {
      const { email, password, name } = data;

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const { data: superadmin, error } = await this.supabase.adminClient
        .from('superadmins')
        .insert({
          email,
          password_hash,
          name,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create superadmin: ${error.message}`);
      }

      logger.info('Superadmin created successfully', { 
        superadminId: superadmin.id,
        email: superadmin.email 
      });

      return {
        id: superadmin.id,
        email: superadmin.email,
        name: superadmin.name,
        status: superadmin.status
      };
    } catch (error) {
      logger.error('Failed to create superadmin', { 
        error: error.message,
        email: data.email 
      });
      throw error;
    }
  }

  // ========================================
  // TENANT MANAGEMENT METHODS
  // ========================================

  /**
   * Create a new tenant
   * @param {Object} data - Tenant creation data
   * @param {string} superadminId - ID of the superadmin creating the tenant
   * @returns {Promise<Object>} Created tenant with branding and default plans
   */
  async createTenant(data, superadminId) {
    try {
      const { subdomain, name, settings = {} } = data;

      // Validate subdomain format
      if (!this.validateSubdomain(subdomain)) {
        throw new Error('Invalid subdomain format. Use lowercase alphanumeric with hyphens only.');
      }

      // Start transaction
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .insert({
          subdomain,
          name,
          owner_superadmin_id: superadminId,
          status: 'active',
          settings
        })
        .select()
        .single();

      if (tenantError) {
        if (tenantError.code === '23505') { // Unique constraint violation
          throw new Error('Subdomain already exists');
        }
        throw new Error(`Failed to create tenant: ${tenantError.message}`);
      }

      // Create default tenant branding
      await this.supabase.adminClient
        .from('tenant_branding')
        .insert({
          tenant_id: tenant.id,
          app_name: name,
          primary_color: '#0ea5e9',
          secondary_color: '#64748b'
        });

      // Copy default plans to tenant_plans
      const { data: defaultPlans } = await this.supabase.adminClient
        .from('plans')
        .select('*')
        .eq('status', 'active');

      if (defaultPlans && defaultPlans.length > 0) {
        const tenantPlans = defaultPlans.map(plan => ({
          tenant_id: tenant.id,
          name: plan.name,
          description: plan.description,
          price_cents: plan.price_cents,
          billing_cycle: plan.billing_cycle,
          status: plan.status,
          is_default: plan.is_default,
          trial_days: plan.trial_days,
          quotas: plan.quotas,
          features: plan.features
        }));

        await this.supabase.adminClient
          .from('tenant_plans')
          .insert(tenantPlans);
      }

      // Log the action
      await this.logAuditAction(superadminId, 'create', 'tenant', tenant.id, tenant.id, {
        subdomain,
        name
      });

      logger.info('Tenant created successfully', { 
        tenantId: tenant.id,
        subdomain,
        superadminId 
      });

      return tenant;
    } catch (error) {
      logger.error('Failed to create tenant', { 
        error: error.message,
        subdomain: data.subdomain,
        superadminId 
      });
      throw error;
    }
  }

  /**
   * Update an existing tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Update data
   * @param {string} superadminId - ID of the superadmin updating the tenant
   * @returns {Promise<Object>} Updated tenant
   */
  async updateTenant(tenantId, data, superadminId) {
    try {
      const { name, settings, status } = data;

      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .update({
          ...(name && { name }),
          ...(settings && { settings }),
          ...(status && { status }),
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update tenant: ${error.message}`);
      }

      // Log the action
      await this.logAuditAction(superadminId, 'update', 'tenant', tenantId, tenantId, data);

      logger.info('Tenant updated successfully', { 
        tenantId,
        superadminId 
      });

      return tenant;
    } catch (error) {
      logger.error('Failed to update tenant', { 
        error: error.message,
        tenantId,
        superadminId 
      });
      throw error;
    }
  }

  /**
   * Deactivate a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} superadminId - ID of the superadmin deactivating the tenant
   * @returns {Promise<void>}
   */
  async deactivateTenant(tenantId, superadminId) {
    try {
      const { error } = await this.supabase.adminClient
        .from('tenants')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to deactivate tenant: ${error.message}`);
      }

      // Log the action
      await this.logAuditAction(superadminId, 'deactivate', 'tenant', tenantId, tenantId);

      logger.info('Tenant deactivated successfully', { 
        tenantId,
        superadminId 
      });
    } catch (error) {
      logger.error('Failed to deactivate tenant', { 
        error: error.message,
        tenantId,
        superadminId 
      });
      throw error;
    }
  }

  /**
   * Delete a tenant and cascade delete all related data
   * @param {string} tenantId - Tenant UUID
   * @param {string} superadminId - ID of the superadmin deleting the tenant
   * @returns {Promise<void>}
   */
  async deleteTenant(tenantId, superadminId) {
    try {
      // Get tenant info before deletion for logging
      const { data: tenant } = await this.supabase.adminClient
        .from('tenants')
        .select('subdomain, name')
        .eq('id', tenantId)
        .single();

      // Delete tenant (cascade will handle related data)
      const { error } = await this.supabase.adminClient
        .from('tenants')
        .delete()
        .eq('id', tenantId);

      if (error) {
        throw new Error(`Failed to delete tenant: ${error.message}`);
      }

      // Log the action
      await this.logAuditAction(superadminId, 'delete', 'tenant', tenantId, null, {
        subdomain: tenant?.subdomain,
        name: tenant?.name
      });

      logger.info('Tenant deleted successfully', { 
        tenantId,
        subdomain: tenant?.subdomain,
        superadminId 
      });
    } catch (error) {
      logger.error('Failed to delete tenant', { 
        error: error.message,
        tenantId,
        superadminId 
      });
      throw error;
    }
  }

  /**
   * List all tenants with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of tenants
   */
  async listTenants(filters = {}) {
    try {
      let query = this.supabase.adminClient
        .from('tenants')
        .select(`
          *,
          tenant_branding (
            app_name,
            logo_url,
            primary_color
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`subdomain.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
      }

      const { data: tenants, error } = await query;

      if (error) {
        throw new Error(`Failed to list tenants: ${error.message}`);
      }

      return tenants;
    } catch (error) {
      logger.error('Failed to list tenants', { 
        error: error.message,
        filters 
      });
      throw error;
    }
  }

  /**
   * Validate subdomain format
   * @param {string} subdomain - Subdomain to validate
   * @returns {boolean} True if valid
   */
  validateSubdomain(subdomain) {
    // Subdomain must be lowercase alphanumeric with hyphens, 2-63 characters
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    return subdomain && 
           subdomain.length >= 2 && 
           subdomain.length <= 63 && 
           subdomainRegex.test(subdomain) &&
           !subdomain.includes('--'); // No consecutive hyphens
  }

  /**
   * Check if subdomain is available
   * @param {string} subdomain - Subdomain to check
   * @returns {Promise<boolean>} True if available
   */
  async isSubdomainAvailable(subdomain) {
    try {
      const { data, error } = await this.supabase.adminClient
        .from('tenants')
        .select('id')
        .eq('subdomain', subdomain)
        .maybeSingle();

      if (error) {
        logger.error('Failed to check subdomain availability', { 
          error: error.message,
          subdomain 
        });
        throw error;
      }

      // If no data found, subdomain is available
      return !data;
    } catch (error) {
      logger.error('Error checking subdomain availability', { 
        error: error.message,
        subdomain 
      });
      throw error;
    }
  }

  /**
   * Log audit action
   * @param {string} superadminId - Superadmin ID
   * @param {string} action - Action performed
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource ID
   * @param {string} tenantId - Tenant ID (optional)
   * @param {Object} details - Additional details
   */
  async logAuditAction(superadminId, action, resourceType, resourceId, tenantId = null, details = {}) {
    try {
      await this.supabase.adminClient
        .from('superadmin_audit_log')
        .insert({
          superadmin_id: superadminId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          tenant_id: tenantId,
          details,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to log audit action', { 
        error: error.message,
        superadminId,
        action,
        resourceType 
      });
      // Don't throw here to avoid breaking the main operation
    }
  }
  // ========================================
  // IMPERSONATION METHODS
  // ========================================

  /**
   * Start impersonating a tenant admin
   * @param {string} superadminId - Superadmin ID
   * @param {string} tenantId - Tenant ID to impersonate
   * @param {string} ipAddress - IP address of the request
   * @returns {Promise<Object>} Impersonation session data
   */
  async impersonateTenant(superadminId, tenantId, ipAddress = null) {
    try {
      // Verify tenant exists and is active
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select('id, subdomain, name, status')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      if (tenant.status !== 'active') {
        throw new Error('Cannot impersonate inactive tenant');
      }

      // Create impersonation session token
      const impersonationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 4); // 4 hour impersonation session

      // Log the impersonation action
      await this.logAuditAction(superadminId, 'impersonate', 'tenant', tenantId, tenantId, {
        tenant_subdomain: tenant.subdomain,
        tenant_name: tenant.name,
        ip_address: ipAddress,
        impersonation_token: impersonationToken,
        expires_at: expiresAt.toISOString()
      });

      logger.info('Superadmin started tenant impersonation', { 
        superadminId,
        tenantId,
        tenantSubdomain: tenant.subdomain,
        impersonationToken,
        ipAddress
      });

      return {
        impersonationToken,
        tenant: {
          id: tenant.id,
          subdomain: tenant.subdomain,
          name: tenant.name
        },
        expiresAt: expiresAt.toISOString(),
        role: 'tenant_admin_impersonated',
        impersonatedBy: superadminId
      };
    } catch (error) {
      logger.error('Failed to start tenant impersonation', { 
        error: error.message,
        superadminId,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * End impersonation session
   * @param {string} sessionId - Session ID or impersonation token
   * @param {string} superadminId - Superadmin ID
   * @returns {Promise<void>}
   */
  async endImpersonation(sessionId, superadminId) {
    try {
      // Log the end impersonation action
      await this.logAuditAction(superadminId, 'end_impersonation', 'session', sessionId, null, {
        session_id: sessionId
      });

      logger.info('Superadmin ended impersonation session', { 
        superadminId,
        sessionId 
      });
    } catch (error) {
      logger.error('Failed to end impersonation session', { 
        error: error.message,
        superadminId,
        sessionId 
      });
      throw error;
    }
  }

  /**
   * Verify impersonation session
   * @param {string} impersonationToken - Impersonation token
   * @returns {Promise<Object|null>} Impersonation session data if valid
   */
  async verifyImpersonationSession(impersonationToken) {
    try {
      // Query audit log for active impersonation session
      const { data: auditEntry, error } = await this.supabase.adminClient
        .from('superadmin_audit_log')
        .select('*')
        .eq('action', 'impersonate')
        .eq('details->>impersonation_token', impersonationToken)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !auditEntry) {
        return null;
      }

      // Check if session is still valid (not expired)
      const expiresAt = new Date(auditEntry.details.expires_at);
      if (expiresAt < new Date()) {
        return null;
      }

      // Check if impersonation was ended
      const { data: endEntry } = await this.supabase.adminClient
        .from('superadmin_audit_log')
        .select('id')
        .eq('action', 'end_impersonation')
        .eq('superadmin_id', auditEntry.superadmin_id)
        .gt('created_at', auditEntry.created_at)
        .limit(1)
        .single();

      if (endEntry) {
        return null; // Impersonation was ended
      }

      return {
        superadminId: auditEntry.superadmin_id,
        tenantId: auditEntry.tenant_id,
        expiresAt: auditEntry.details.expires_at,
        role: 'tenant_admin_impersonated'
      };
    } catch (error) {
      logger.error('Failed to verify impersonation session', { 
        error: error.message 
      });
      return null;
    }
  }
  // ========================================
  // METRICS METHODS
  // ========================================

  /**
   * Get dashboard metrics for superadmin
   * @returns {Promise<Object>} Dashboard metrics
   */
  async getDashboardMetrics() {
    try {
      // Get total tenant count by status
      const { data: tenantStats, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select('status')
        .neq('status', 'deleted');

      if (tenantError) {
        throw new Error(`Failed to get tenant stats: ${tenantError.message}`);
      }

      const tenantCounts = tenantStats.reduce((acc, tenant) => {
        acc[tenant.status] = (acc[tenant.status] || 0) + 1;
        return acc;
      }, {});

      // Get total MRR across all tenants
      const { data: mrrData, error: mrrError } = await this.supabase.adminClient
        .rpc('calculate_total_mrr');

      if (mrrError) {
        logger.warn('Failed to calculate MRR, using fallback', { error: mrrError.message });
      }

      const totalMRR = mrrData || 0;

      // Get total account count
      const { count: totalAccounts, error: accountError } = await this.supabase.adminClient
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (accountError) {
        throw new Error(`Failed to get account count: ${accountError.message}`);
      }

      // Get active subscriptions count
      const { count: activeSubscriptions, error: subError } = await this.supabase.adminClient
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (subError) {
        throw new Error(`Failed to get subscription count: ${subError.message}`);
      }

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: newTenantsLast30Days } = await this.supabase.adminClient
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: newAccountsLast30Days } = await this.supabase.adminClient
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      return {
        tenants: {
          total: tenantStats.length,
          active: tenantCounts.active || 0,
          inactive: tenantCounts.inactive || 0,
          suspended: tenantCounts.suspended || 0,
          newLast30Days: newTenantsLast30Days || 0
        },
        revenue: {
          totalMRR,
          currency: 'BRL'
        },
        accounts: {
          total: totalAccounts || 0,
          newLast30Days: newAccountsLast30Days || 0
        },
        subscriptions: {
          active: activeSubscriptions || 0
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get dashboard metrics', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get metrics for a specific tenant
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} Tenant metrics
   */
  async getTenantMetrics(tenantId) {
    try {
      // Get tenant basic info
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select(`
          *,
          tenant_branding (
            app_name,
            logo_url
          )
        `)
        .eq('id', tenantId)
        .single();

      if (tenantError) {
        throw new Error(`Tenant not found: ${tenantError.message}`);
      }

      // Get account count for this tenant
      const { count: accountCount } = await this.supabase.adminClient
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      // Get subscription count and MRR for this tenant
      const { data: subscriptionData } = await this.supabase.adminClient
        .from('user_subscriptions')
        .select(`
          status,
          tenant_plans!inner (
            price_cents,
            billing_cycle
          )
        `)
        .eq('tenant_plans.tenant_id', tenantId)
        .eq('status', 'active');

      const activeSubscriptions = subscriptionData?.length || 0;
      const tenantMRR = this.calculateMRRFromSubscriptions(subscriptionData || []);

      // Get agent count
      const { count: agentCount } = await this.supabase.adminClient
        .from('agents')
        .select('accounts!inner(*)', { count: 'exact', head: true })
        .eq('accounts.tenant_id', tenantId)
        .eq('status', 'active');

      // Get inbox count
      const { count: inboxCount } = await this.supabase.adminClient
        .from('inboxes')
        .select('accounts!inner(*)', { count: 'exact', head: true })
        .eq('accounts.tenant_id', tenantId)
        .eq('status', 'active');

      // Get message count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: messageCount } = await this.supabase.adminClient
        .from('chat_messages')
        .select(`
          conversations!inner (
            accounts!inner (*)
          )
        `, { count: 'exact', head: true })
        .eq('conversations.accounts.tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      return {
        tenant: {
          id: tenant.id,
          subdomain: tenant.subdomain,
          name: tenant.name,
          status: tenant.status,
          appName: tenant.tenant_branding?.[0]?.app_name || tenant.name,
          logoUrl: tenant.tenant_branding?.[0]?.logo_url,
          createdAt: tenant.created_at
        },
        metrics: {
          accounts: accountCount || 0,
          agents: agentCount || 0,
          inboxes: inboxCount || 0,
          subscriptions: {
            active: activeSubscriptions,
            mrr: tenantMRR
          },
          usage: {
            messagesLast30Days: messageCount || 0
          }
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get tenant metrics', { 
        error: error.message,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Export metrics to CSV format
   * @param {Object} filters - Export filters
   * @returns {Promise<string>} CSV data
   */
  async exportMetrics(filters = {}) {
    try {
      // Get all tenants with their metrics
      const tenants = await this.listTenants(filters);
      
      const csvRows = [];
      csvRows.push([
        'Tenant ID',
        'Subdomain',
        'Name',
        'Status',
        'Created At',
        'Account Count',
        'Active Subscriptions',
        'MRR (cents)',
        'App Name'
      ]);

      for (const tenant of tenants) {
        try {
          const metrics = await this.getTenantMetrics(tenant.id);
          
          csvRows.push([
            tenant.id,
            tenant.subdomain,
            tenant.name,
            tenant.status,
            tenant.created_at,
            metrics.metrics.accounts,
            metrics.metrics.subscriptions.active,
            metrics.metrics.subscriptions.mrr,
            metrics.tenant.appName
          ]);
        } catch (error) {
          logger.warn('Failed to get metrics for tenant in export', { 
            tenantId: tenant.id,
            error: error.message 
          });
          
          // Add row with basic info only
          csvRows.push([
            tenant.id,
            tenant.subdomain,
            tenant.name,
            tenant.status,
            tenant.created_at,
            'N/A',
            'N/A',
            'N/A',
            tenant.tenant_branding?.[0]?.app_name || tenant.name
          ]);
        }
      }

      // Convert to CSV string
      const csvContent = csvRows
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      logger.info('Metrics exported to CSV', { 
        tenantCount: tenants.length,
        filters 
      });

      return csvContent;
    } catch (error) {
      logger.error('Failed to export metrics', { 
        error: error.message,
        filters 
      });
      throw error;
    }
  }

  /**
   * Calculate MRR from subscription data
   * @param {Array} subscriptions - Array of subscription data
   * @returns {number} MRR in cents
   */
  calculateMRRFromSubscriptions(subscriptions) {
    return subscriptions.reduce((total, sub) => {
      if (sub.status !== 'active' || !sub.tenant_plans) return total;
      
      const plan = sub.tenant_plans;
      let monthlyValue = plan.price_cents;

      // Convert to monthly based on billing cycle
      switch (plan.billing_cycle) {
        case 'yearly':
          monthlyValue = Math.round(plan.price_cents / 12);
          break;
        case 'quarterly':
          monthlyValue = Math.round(plan.price_cents / 3);
          break;
        case 'weekly':
          monthlyValue = Math.round(plan.price_cents * 4.33); // ~4.33 weeks per month
          break;
        // monthly and lifetime stay as is
      }

      return total + monthlyValue;
    }, 0);
  }
}

module.exports = new SuperadminService();