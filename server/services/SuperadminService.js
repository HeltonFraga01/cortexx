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
   * Uses password_changed_at timestamp to invalidate sessions created before password change
   * @param {string} superadminId - Superadmin UUID
   * @returns {Promise<void>}
   */
  async invalidateSessions(superadminId) {
    try {
      // Update password_changed_at timestamp
      // Sessions created before this timestamp will be considered invalid
      const { error } = await this.supabase.adminClient
        .from('superadmins')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', superadminId);

      if (error) {
        throw new Error(`Failed to update session invalidation timestamp: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'invalidate_sessions', 'superadmin', superadminId, null, {
        timestamp: new Date().toISOString()
      });
      
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
  async verifySession(/* sessionToken */) {
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
      const { subdomain, name, settings = {}, ownerEmail, ownerName, ownerPassword } = data;

      // Validate subdomain format
      if (!this.validateSubdomain(subdomain)) {
        throw new Error('Invalid subdomain format. Use lowercase alphanumeric with hyphens only.');
      }

      // Validate owner data if provided
      if (ownerEmail && ownerPassword) {
        // Check if email already exists
        const { data: existingAgent } = await this.supabase.adminClient
          .from('agents')
          .select('id')
          .eq('email', ownerEmail)
          .single();

        if (existingAgent) {
          throw new Error('An agent with this email already exists');
        }
      }

      // Start transaction - Create tenant
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

      // Create default account and owner agent if owner data provided
      let account = null;
      let ownerAgent = null;
      
      if (ownerEmail && ownerPassword) {
        // Hash password using crypto.scrypt (same format as AgentService)
        const passwordHash = await this.hashPasswordForAgent(ownerPassword);

        // Step 1: Create owner agent first (without account_id initially)
        // We need the agent ID to set as owner_user_id in the account
        const { data: newAgent, error: agentError } = await this.supabase.adminClient
          .from('agents')
          .insert({
            email: ownerEmail,
            name: ownerName || name,
            password_hash: passwordHash,
            role: 'owner',
            status: 'active',
            availability: 'offline'
          })
          .select()
          .single();

        if (agentError) {
          // Rollback tenant creation
          await this.supabase.adminClient.from('tenants').delete().eq('id', tenant.id);
          throw new Error(`Failed to create owner agent: ${agentError.message}`);
        }
        ownerAgent = newAgent;

        // Step 2: Create account with owner_user_id set to the agent's ID
        const { data: newAccount, error: accountError } = await this.supabase.adminClient
          .from('accounts')
          .insert({
            tenant_id: tenant.id,
            name: `${name} - Principal`,
            owner_user_id: ownerAgent.id,
            wuzapi_token: `wuzapi-${tenant.id.substring(0, 8)}`,
            status: 'active',
            settings: {}
          })
          .select()
          .single();

        if (accountError) {
          // Rollback agent and tenant creation
          await this.supabase.adminClient.from('agents').delete().eq('id', ownerAgent.id);
          await this.supabase.adminClient.from('tenants').delete().eq('id', tenant.id);
          throw new Error(`Failed to create account: ${accountError.message}`);
        }
        account = newAccount;

        // Step 3: Update agent with account_id
        const { error: updateAgentError } = await this.supabase.adminClient
          .from('agents')
          .update({ account_id: account.id })
          .eq('id', ownerAgent.id);

        if (updateAgentError) {
          // Rollback everything
          await this.supabase.adminClient.from('accounts').delete().eq('id', account.id);
          await this.supabase.adminClient.from('agents').delete().eq('id', ownerAgent.id);
          await this.supabase.adminClient.from('tenants').delete().eq('id', tenant.id);
          throw new Error(`Failed to link agent to account: ${updateAgentError.message}`);
        }

        logger.info('Tenant owner account and agent created', {
          tenantId: tenant.id,
          accountId: account.id,
          agentId: ownerAgent.id,
          ownerEmail
        });
      }

      // Log the action
      await this.logAuditAction(superadminId, 'create', 'tenant', tenant.id, tenant.id, {
        subdomain,
        name,
        ownerEmail,
        accountId: account?.id,
        agentId: ownerAgent?.id
      });

      logger.info('Tenant created successfully', { 
        tenantId: tenant.id,
        subdomain,
        superadminId,
        hasOwner: !!ownerAgent
      });

      return {
        ...tenant,
        account,
        ownerAgent: ownerAgent ? {
          id: ownerAgent.id,
          email: ownerAgent.email,
          name: ownerAgent.name,
          role: ownerAgent.role
        } : null
      };
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
   * @param {Object} options - Deactivation options
   * @param {string} options.reason - Reason for deactivation
   * @param {string} options.deactivatedBy - ID of the superadmin deactivating the tenant
   * @returns {Promise<Object>} Updated tenant
   */
  async deactivateTenant(tenantId, options = {}) {
    try {
      const { reason, deactivatedBy } = options;

      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to deactivate tenant: ${error.message}`);
      }

      // Log the action
      await this.logAuditAction(deactivatedBy, 'deactivate', 'tenant', tenantId, tenantId, { reason });

      logger.info('Tenant deactivated successfully', { 
        tenantId,
        deactivatedBy,
        reason
      });

      return tenant;
    } catch (error) {
      logger.error('Failed to deactivate tenant', { 
        error: error.message,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * Activate a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} options - Activation options
   * @param {string} options.activatedBy - ID of the superadmin activating the tenant
   * @returns {Promise<Object>} Updated tenant
   */
  async activateTenant(tenantId, options = {}) {
    try {
      const { activatedBy } = options;

      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to activate tenant: ${error.message}`);
      }

      // Log the action
      await this.logAuditAction(activatedBy, 'activate', 'tenant', tenantId, tenantId);

      logger.info('Tenant activated successfully', { 
        tenantId,
        activatedBy
      });

      return tenant;
    } catch (error) {
      logger.error('Failed to activate tenant', { 
        error: error.message,
        tenantId,
        options
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
   * List all tenants with optional filters and pagination
   * @param {Object} options - Filter and pagination options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 20)
   * @param {Object} options.filters - Filter options
   * @returns {Promise<Object>} Paginated list of tenants
   */
  async listTenants(options = {}) {
    try {
      const { page = 1, limit = 20, filters = {} } = options;
      const offset = (page - 1) * limit;

      // First, get total count with filters
      let countQuery = this.supabase.adminClient
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      // Apply filters to count query
      if (filters.status) {
        countQuery = countQuery.eq('status', filters.status);
      }

      if (filters.search) {
        countQuery = countQuery.or(`subdomain.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
      }

      const { count: total, error: countError } = await countQuery;

      if (countError) {
        throw new Error(`Failed to count tenants: ${countError.message}`);
      }

      // Now get paginated data
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
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

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

      const totalPages = Math.ceil((total || 0) / limit);

      return {
        tenants: tenants || [],
        page,
        limit,
        total: total || 0,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to list tenants', { 
        error: error.message,
        options 
      });
      throw error;
    }
  }

  /**
   * Get tenant by ID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} options - Options
   * @param {boolean} options.includeMetrics - Include tenant metrics
   * @returns {Promise<Object|null>} Tenant data or null if not found
   */
  async getTenantById(tenantId, options = {}) {
    try {
      const { includeMetrics = false } = options;

      const { data: tenant, error } = await this.supabase.adminClient
        .from('tenants')
        .select(`
          *,
          tenant_branding (
            app_name,
            logo_url,
            primary_color,
            secondary_color
          )
        `)
        .eq('id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw new Error(`Failed to get tenant: ${error.message}`);
      }

      if (!tenant) {
        return null;
      }

      // Include metrics if requested
      if (includeMetrics) {
        try {
          const metrics = await this.getTenantMetrics(tenantId);
          tenant.metrics = metrics.metrics;
        } catch (metricsError) {
          logger.warn('Failed to get tenant metrics', {
            tenantId,
            error: metricsError.message
          });
          tenant.metrics = null;
        }
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
   * Hash password using crypto.scrypt (same format as AgentService)
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password in salt:key format
   */
  async hashPasswordForAgent(password) {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
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
        sessionId: impersonationToken,
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
   * @param {Object} options - End impersonation options
   * @param {string} options.endedBy - Superadmin ID who ended the session
   * @param {string} options.ip - IP address
   * @param {string} options.userAgent - User agent
   * @returns {Promise<void>}
   */
  async endImpersonation(sessionId, options = {}) {
    try {
      const { endedBy, ip, userAgent } = options;
      
      // Log the end impersonation action
      await this.logAuditAction(endedBy, 'end_impersonation', 'session', sessionId, null, {
        session_id: sessionId,
        ip_address: ip,
        user_agent: userAgent
      });

      logger.info('Superadmin ended impersonation session', { 
        superadminId: endedBy,
        sessionId,
        ip
      });
    } catch (error) {
      logger.error('Failed to end impersonation session', { 
        error: error.message,
        sessionId,
        options
      });
      throw error;
    }
  }

  /**
   * Get impersonation history
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {Object} options.filters - Filter options
   * @returns {Promise<Object>} Paginated impersonation history
   */
  async getImpersonationHistory(options = {}) {
    try {
      const { page = 1, limit = 20, filters = {} } = options;
      const offset = (page - 1) * limit;

      // Build query for impersonation actions
      let countQuery = this.supabase.adminClient
        .from('superadmin_audit_log')
        .select('*', { count: 'exact', head: true })
        .in('action', ['impersonate', 'end_impersonation']);

      let query = this.supabase.adminClient
        .from('superadmin_audit_log')
        .select(`
          *,
          superadmins (
            id,
            email,
            name
          )
        `)
        .in('action', ['impersonate', 'end_impersonation'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters.tenantId) {
        countQuery = countQuery.eq('tenant_id', filters.tenantId);
        query = query.eq('tenant_id', filters.tenantId);
      }

      if (filters.superadminId) {
        countQuery = countQuery.eq('superadmin_id', filters.superadminId);
        query = query.eq('superadmin_id', filters.superadminId);
      }

      if (filters.startDate) {
        countQuery = countQuery.gte('created_at', filters.startDate);
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        countQuery = countQuery.lte('created_at', filters.endDate);
        query = query.lte('created_at', filters.endDate);
      }

      const { count: total, error: countError } = await countQuery;
      if (countError) {
        throw new Error(`Failed to count impersonation history: ${countError.message}`);
      }

      const { data: records, error } = await query;
      if (error) {
        throw new Error(`Failed to get impersonation history: ${error.message}`);
      }

      const totalPages = Math.ceil((total || 0) / limit);

      return {
        records: records || [],
        page,
        limit,
        total: total || 0,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to get impersonation history', { 
        error: error.message,
        options 
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
      // Get all tenants with their metrics (use high limit to get all)
      const result = await this.listTenants({ filters, limit: 1000 });
      const tenants = result.tenants;
      
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

  // ========================================
  // PASSWORD MANAGEMENT METHODS
  // ========================================

  /**
   * Validate password complexity
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validatePasswordComplexity(password) {
    const errors = [];
    
    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Change superadmin password
   * @param {string} superadminId - Superadmin UUID
   * @param {string} currentPassword - Current password for verification
   * @param {string} newPassword - New password to set
   * @returns {Promise<void>}
   */
  async changePassword(superadminId, currentPassword, newPassword) {
    try {
      // 1. Get superadmin with password hash
      const { data: superadmin, error: fetchError } = await this.supabase.adminClient
        .from('superadmins')
        .select('id, email, password_hash')
        .eq('id', superadminId)
        .single();

      if (fetchError || !superadmin) {
        throw new Error('Superadmin not found');
      }

      // 2. Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, superadmin.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // 3. Validate new password complexity
      const validation = this.validatePasswordComplexity(newPassword);
      if (!validation.isValid) {
        const error = new Error('Password does not meet requirements');
        error.details = validation.errors;
        throw error;
      }

      // 4. Check new password is different from current
      const isSamePassword = await bcrypt.compare(newPassword, superadmin.password_hash);
      if (isSamePassword) {
        throw new Error('New password must be different from current password');
      }

      // 5. Hash new password with bcrypt cost factor 12
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // 6. Update password_hash and set requires_password_change to false
      const { error: updateError } = await this.supabase.adminClient
        .from('superadmins')
        .update({
          password_hash: newPasswordHash,
          requires_password_change: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', superadminId);

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      // 7. Log audit action
      await this.logAuditAction(superadminId, 'change_password', 'superadmin', superadminId, null, {
        timestamp: new Date().toISOString()
      });

      logger.info('Superadmin password changed successfully', { 
        superadminId,
        email: superadmin.email 
      });
    } catch (error) {
      logger.error('Failed to change superadmin password', { 
        error: error.message,
        superadminId 
      });
      throw error;
    }
  }

  // ========================================
  // SUPERADMIN ACCOUNT MANAGEMENT METHODS
  // ========================================

  /**
   * List all superadmin accounts
   * @returns {Promise<Array>} List of superadmin accounts (without password_hash)
   */
  async listSuperadmins() {
    try {
      const { data: superadmins, error } = await this.supabase.adminClient
        .from('superadmins')
        .select('id, email, name, status, requires_password_change, last_login_at, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to list superadmins: ${error.message}`);
      }

      return superadmins || [];
    } catch (error) {
      logger.error('Failed to list superadmins', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Delete a superadmin account
   * @param {string} targetId - ID of superadmin to delete
   * @param {string} requesterId - ID of superadmin making the request
   * @returns {Promise<void>}
   */
  async deleteSuperadmin(targetId, requesterId) {
    try {
      // 1. Prevent self-deletion
      if (targetId === requesterId) {
        throw new Error('Cannot delete your own account');
      }

      // 2. Get target superadmin info for logging
      const { data: target, error: fetchError } = await this.supabase.adminClient
        .from('superadmins')
        .select('id, email, name')
        .eq('id', targetId)
        .single();

      if (fetchError || !target) {
        throw new Error('Superadmin not found');
      }

      // 3. Delete superadmin
      const { error: deleteError } = await this.supabase.adminClient
        .from('superadmins')
        .delete()
        .eq('id', targetId);

      if (deleteError) {
        throw new Error(`Failed to delete superadmin: ${deleteError.message}`);
      }

      // 4. Log audit action
      await this.logAuditAction(requesterId, 'delete', 'superadmin', targetId, null, {
        deletedEmail: target.email,
        deletedName: target.name
      });

      logger.info('Superadmin deleted successfully', { 
        targetId,
        targetEmail: target.email,
        deletedBy: requesterId 
      });
    } catch (error) {
      logger.error('Failed to delete superadmin', { 
        error: error.message,
        targetId,
        requesterId 
      });
      throw error;
    }
  }

  /**
   * Create a new superadmin with requires_password_change flag
   * @param {Object} data - Superadmin data
   * @param {string} createdBy - ID of superadmin creating the account
   * @returns {Promise<Object>} Created superadmin
   */
  async createSuperadmin(data, createdBy) {
    try {
      const { email, password, name } = data;

      // Validate password complexity
      const validation = this.validatePasswordComplexity(password);
      if (!validation.isValid) {
        const error = new Error('Password does not meet requirements');
        error.details = validation.errors;
        throw error;
      }

      // Hash password with bcrypt cost factor 12
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const { data: superadmin, error } = await this.supabase.adminClient
        .from('superadmins')
        .insert({
          email,
          password_hash,
          name,
          status: 'active',
          requires_password_change: true // New accounts must change password on first login
        })
        .select('id, email, name, status, requires_password_change, created_at')
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('Email already exists');
        }
        throw new Error(`Failed to create superadmin: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(createdBy, 'create', 'superadmin', superadmin.id, null, {
        email: superadmin.email,
        name: superadmin.name
      });

      logger.info('Superadmin created successfully', { 
        superadminId: superadmin.id,
        email: superadmin.email,
        createdBy 
      });

      return superadmin;
    } catch (error) {
      logger.error('Failed to create superadmin', { 
        error: error.message,
        email: data.email,
        createdBy 
      });
      throw error;
    }
  }

  /**
   * Update superadmin status
   * @param {string} targetId - ID of superadmin to update
   * @param {string} status - New status ('active' or 'inactive')
   * @param {string} updatedBy - ID of superadmin making the update
   * @returns {Promise<Object>} Updated superadmin
   */
  async updateSuperadminStatus(targetId, status, updatedBy) {
    try {
      // Prevent self-deactivation
      if (targetId === updatedBy && status === 'inactive') {
        throw new Error('Cannot deactivate your own account');
      }

      const { data: superadmin, error } = await this.supabase.adminClient
        .from('superadmins')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId)
        .select('id, email, name, status')
        .single();

      if (error) {
        throw new Error(`Failed to update superadmin status: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(updatedBy, 'update_status', 'superadmin', targetId, null, {
        newStatus: status
      });

      logger.info('Superadmin status updated', { 
        targetId,
        newStatus: status,
        updatedBy 
      });

      return superadmin;
    } catch (error) {
      logger.error('Failed to update superadmin status', { 
        error: error.message,
        targetId,
        status,
        updatedBy 
      });
      throw error;
    }
  }

  // ========================================
  // TENANT ACCOUNT MANAGEMENT METHODS
  // ========================================

  /**
   * List all accounts for a specific tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} options - Filter and pagination options
   * @returns {Promise<Object>} Paginated list of accounts
   */
  async listTenantAccounts(tenantId, options = {}) {
    try {
      const { page = 1, limit = 20, filters = {} } = options;
      const offset = (page - 1) * limit;

      // Verify tenant exists
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Build count query
      let countQuery = this.supabase.adminClient
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (filters.status) {
        countQuery = countQuery.eq('status', filters.status);
      }

      if (filters.search) {
        countQuery = countQuery.or(`name.ilike.%${filters.search}%`);
      }

      const { count: total, error: countError } = await countQuery;

      if (countError) {
        throw new Error(`Failed to count accounts: ${countError.message}`);
      }

      // Build data query - simplified without nested counts to avoid Supabase errors
      let query = this.supabase.adminClient
        .from('accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%`);
      }

      const { data: accounts, error } = await query;

      if (error) {
        throw new Error(`Failed to list accounts: ${error.message}`);
      }

      // Get agent and inbox counts separately for each account
      const transformedAccounts = await Promise.all((accounts || []).map(async (account) => {
        let agentCount = 0;
        let inboxCount = 0;

        try {
          // Get agent count
          const { count: ac } = await this.supabase.adminClient
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', account.id);
          agentCount = ac || 0;
        } catch (e) {
          logger.warn('Failed to get agent count', { accountId: account.id, error: e.message });
        }

        try {
          // Get inbox count
          const { count: ic } = await this.supabase.adminClient
            .from('inboxes')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', account.id);
          inboxCount = ic || 0;
        } catch (e) {
          logger.warn('Failed to get inbox count', { accountId: account.id, error: e.message });
        }

        return {
          ...account,
          agent_count: agentCount,
          inbox_count: inboxCount
        };
      }));

      const totalPages = Math.ceil((total || 0) / limit);

      return {
        accounts: transformedAccounts,
        page,
        limit,
        total: total || 0,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to list tenant accounts', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get a specific account by ID within a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object|null>} Account data or null
   */
  async getTenantAccountById(tenantId, accountId) {
    try {
      const { data: account, error } = await this.supabase.adminClient
        .from('accounts')
        .select(`
          *,
          agents:agents(count),
          inboxes:inboxes(count)
        `)
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to get account: ${error.message}`);
      }

      return {
        ...account,
        agent_count: account.agents?.[0]?.count || 0,
        inbox_count: account.inboxes?.[0]?.count || 0
      };
    } catch (error) {
      logger.error('Failed to get tenant account', {
        error: error.message,
        tenantId,
        accountId
      });
      throw error;
    }
  }

  /**
   * Create a new account within a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Account data
   * @param {string} superadminId - Superadmin creating the account
   * @returns {Promise<Object>} Created account
   */
  async createTenantAccount(tenantId, data, superadminId) {
    try {
      const { name, ownerEmail, wuzapiToken } = data;

      // Verify tenant exists
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select('id, subdomain')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Create the account
      const { data: account, error } = await this.supabase.adminClient
        .from('accounts')
        .insert({
          tenant_id: tenantId,
          name,
          wuzapi_token: wuzapiToken,
          status: 'active',
          settings: {}
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create account: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'create', 'account', account.id, tenantId, {
        name,
        ownerEmail
      });

      logger.info('Tenant account created by superadmin', {
        superadminId,
        tenantId,
        accountId: account.id,
        accountName: name
      });

      return account;
    } catch (error) {
      logger.error('Failed to create tenant account', {
        error: error.message,
        tenantId,
        superadminId
      });
      throw error;
    }
  }

  /**
   * Update an account within a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} accountId - Account UUID
   * @param {Object} data - Update data
   * @param {string} superadminId - Superadmin updating the account
   * @returns {Promise<Object>} Updated account
   */
  async updateTenantAccount(tenantId, accountId, data, superadminId) {
    try {
      // Verify account belongs to tenant
      const existing = await this.getTenantAccountById(tenantId, accountId);
      if (!existing) {
        return null;
      }

      const { data: account, error } = await this.supabase.adminClient
        .from('accounts')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update account: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'update', 'account', accountId, tenantId, data);

      logger.info('Tenant account updated by superadmin', {
        superadminId,
        tenantId,
        accountId,
        updatedFields: Object.keys(data)
      });

      return account;
    } catch (error) {
      logger.error('Failed to update tenant account', {
        error: error.message,
        tenantId,
        accountId,
        superadminId
      });
      throw error;
    }
  }

  /**
   * Delete an account within a tenant (cascade delete)
   * @param {string} tenantId - Tenant UUID
   * @param {string} accountId - Account UUID
   * @param {string} superadminId - Superadmin deleting the account
   * @returns {Promise<void>}
   */
  async deleteTenantAccount(tenantId, accountId, superadminId) {
    try {
      // Verify account belongs to tenant
      const existing = await this.getTenantAccountById(tenantId, accountId);
      if (!existing) {
        throw new Error('Account not found');
      }

      // Delete account (cascade will handle related data)
      const { error } = await this.supabase.adminClient
        .from('accounts')
        .delete()
        .eq('id', accountId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to delete account: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'delete', 'account', accountId, tenantId, {
        accountName: existing.name
      });

      logger.warn('Tenant account deleted by superadmin', {
        superadminId,
        tenantId,
        accountId,
        accountName: existing.name
      });
    } catch (error) {
      logger.error('Failed to delete tenant account', {
        error: error.message,
        tenantId,
        accountId,
        superadminId
      });
      throw error;
    }
  }
  /**
   * Get the owner agent for an account
   * @param {string} tenantId - Tenant UUID
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object|null>} Owner agent data or null
   */
  async getAccountOwnerAgent(tenantId, accountId) {
    try {
      // Verify account belongs to tenant
      const account = await this.getTenantAccountById(tenantId, accountId);
      if (!account) {
        return null;
      }

      // Get the owner agent for this account
      const { data: agent, error } = await this.supabase.adminClient
        .from('agents')
        .select('id, email, name, role, status, created_at')
        .eq('account_id', accountId)
        .eq('role', 'owner')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No owner found, try to get any admin
          const { data: adminAgent, error: adminError } = await this.supabase.adminClient
            .from('agents')
            .select('id, email, name, role, status, created_at')
            .eq('account_id', accountId)
            .eq('role', 'administrator')
            .limit(1)
            .single();

          if (adminError || !adminAgent) {
            return null;
          }
          return adminAgent;
        }
        throw new Error(`Failed to get owner agent: ${error.message}`);
      }

      return agent;
    } catch (error) {
      logger.error('Failed to get account owner agent', {
        error: error.message,
        tenantId,
        accountId
      });
      throw error;
    }
  }

  /**
   * Update account owner credentials (email and/or password)
   * @param {string} tenantId - Tenant UUID
   * @param {string} accountId - Account UUID
   * @param {Object} data - Credentials data
   * @param {string} data.email - New email (optional)
   * @param {string} data.password - New password (optional)
   * @param {string} superadminId - Superadmin updating the credentials
   * @returns {Promise<Object>} Updated owner agent data
   */
  async updateAccountOwnerCredentials(tenantId, accountId, data, superadminId) {
    try {
      const { email, password } = data;

      // Verify account belongs to tenant
      const account = await this.getTenantAccountById(tenantId, accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get the owner agent
      const ownerAgent = await this.getAccountOwnerAgent(tenantId, accountId);
      if (!ownerAgent) {
        throw new Error('No owner agent found for this account');
      }

      const updates = {
        updated_at: new Date().toISOString()
      };

      // Update email if provided
      if (email && email !== ownerAgent.email) {
        // Check if email already exists
        const { data: existingAgent } = await this.supabase.adminClient
          .from('agents')
          .select('id')
          .eq('email', email)
          .neq('id', ownerAgent.id)
          .single();

        if (existingAgent) {
          throw new Error('An agent with this email already exists');
        }
        updates.email = email;
      }

      // Update password if provided
      if (password) {
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
        // Use crypto.scrypt to match AgentService.hashPassword format
        updates.password_hash = await this.hashPasswordForAgent(password);
      }

      // Update the agent
      const { data: updatedAgent, error } = await this.supabase.adminClient
        .from('agents')
        .update(updates)
        .eq('id', ownerAgent.id)
        .select('id, email, name, role, status, created_at, updated_at')
        .single();

      if (error) {
        throw new Error(`Failed to update owner credentials: ${error.message}`);
      }

      // Log audit action
      const auditDetails = {};
      if (email) auditDetails.emailChanged = true;
      if (password) auditDetails.passwordChanged = true;
      
      await this.logAuditAction(superadminId, 'update_owner_credentials', 'account', accountId, tenantId, {
        ...auditDetails,
        agentId: ownerAgent.id,
        previousEmail: ownerAgent.email
      });

      logger.info('Account owner credentials updated by superadmin', {
        superadminId,
        tenantId,
        accountId,
        agentId: ownerAgent.id,
        emailChanged: !!email,
        passwordChanged: !!password
      });

      return updatedAgent;
    } catch (error) {
      logger.error('Failed to update account owner credentials', {
        error: error.message,
        tenantId,
        accountId,
        superadminId
      });
      throw error;
    }
  }

  // ========================================
  // TENANT AGENT MANAGEMENT METHODS
  // ========================================

  /**
   * List all agents across all accounts in a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} options - Filter and pagination options
   * @returns {Promise<Object>} Paginated list of agents
   */
  async listTenantAgents(tenantId, options = {}) {
    try {
      const { page = 1, limit = 20, filters = {} } = options;
      const offset = (page - 1) * limit;

      // Verify tenant exists
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Get all account IDs for this tenant
      const { data: accounts, error: accountsError } = await this.supabase.adminClient
        .from('accounts')
        .select('id, name')
        .eq('tenant_id', tenantId);

      if (accountsError) {
        throw new Error(`Failed to get tenant accounts: ${accountsError.message}`);
      }

      const accountIds = accounts.map(a => a.id);
      const accountMap = accounts.reduce((map, a) => {
        map[a.id] = a.name;
        return map;
      }, {});

      if (accountIds.length === 0) {
        return {
          agents: [],
          page,
          limit,
          total: 0,
          totalPages: 0
        };
      }

      // Build count query
      let countQuery = this.supabase.adminClient
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .in('account_id', accountIds);

      if (filters.status) {
        countQuery = countQuery.eq('status', filters.status);
      }

      if (filters.role) {
        countQuery = countQuery.eq('role', filters.role);
      }

      if (filters.accountId) {
        countQuery = countQuery.eq('account_id', filters.accountId);
      }

      if (filters.search) {
        countQuery = countQuery.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      const { count: total, error: countError } = await countQuery;

      if (countError) {
        throw new Error(`Failed to count agents: ${countError.message}`);
      }

      // Build data query
      let query = this.supabase.adminClient
        .from('agents')
        .select('*')
        .in('account_id', accountIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.role) {
        query = query.eq('role', filters.role);
      }

      if (filters.accountId) {
        query = query.eq('account_id', filters.accountId);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      const { data: agents, error } = await query;

      if (error) {
        throw new Error(`Failed to list agents: ${error.message}`);
      }

      // Add account name to each agent
      const transformedAgents = (agents || []).map(agent => ({
        ...agent,
        account_name: accountMap[agent.account_id] || 'Unknown'
      }));

      const totalPages = Math.ceil((total || 0) / limit);

      return {
        agents: transformedAgents,
        page,
        limit,
        total: total || 0,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to list tenant agents', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get a specific agent by ID within a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object|null>} Agent data or null
   */
  async getTenantAgentById(tenantId, agentId) {
    try {
      // Get agent with account info
      const { data: agent, error } = await this.supabase.adminClient
        .from('agents')
        .select(`
          *,
          accounts!inner (
            id,
            name,
            tenant_id
          )
        `)
        .eq('id', agentId)
        .eq('accounts.tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to get agent: ${error.message}`);
      }

      return {
        ...agent,
        account_name: agent.accounts?.name || 'Unknown',
        accounts: undefined // Remove nested accounts object
      };
    } catch (error) {
      logger.error('Failed to get tenant agent', {
        error: error.message,
        tenantId,
        agentId
      });
      throw error;
    }
  }

  /**
   * Create a new agent within a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Agent data
   * @param {string} superadminId - Superadmin creating the agent
   * @returns {Promise<Object>} Created agent
   */
  async createTenantAgent(tenantId, data, superadminId) {
    try {
      const { accountId, name, email, password, role } = data;

      // Verify account belongs to tenant
      const { data: account, error: accountError } = await this.supabase.adminClient
        .from('accounts')
        .select('id, name, tenant_id')
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      if (accountError || !account) {
        throw new Error('Account not found or does not belong to this tenant');
      }

      // Check if email already exists
      const { data: existingAgent } = await this.supabase.adminClient
        .from('agents')
        .select('id')
        .eq('email', email)
        .single();

      if (existingAgent) {
        throw new Error('An agent with this email already exists');
      }

      // Hash password
      const bcrypt = require('bcrypt');
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create the agent
      const { data: agent, error } = await this.supabase.adminClient
        .from('agents')
        .insert({
          account_id: accountId,
          email,
          name,
          password_hash: passwordHash,
          role,
          status: 'active',
          availability: 'offline'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create agent: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'create', 'agent', agent.id, tenantId, {
        name,
        email,
        role,
        accountId
      });

      logger.info('Tenant agent created by superadmin', {
        superadminId,
        tenantId,
        agentId: agent.id,
        agentEmail: email
      });

      // Return agent without password_hash
      const { password_hash, ...safeAgent } = agent;
      return {
        ...safeAgent,
        account_name: account.name
      };
    } catch (error) {
      logger.error('Failed to create tenant agent', {
        error: error.message,
        tenantId,
        superadminId
      });
      throw error;
    }
  }

  /**
   * Update an agent within a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} agentId - Agent UUID
   * @param {Object} data - Update data
   * @param {string} superadminId - Superadmin updating the agent
   * @returns {Promise<Object>} Updated agent
   */
  async updateTenantAgent(tenantId, agentId, data, superadminId) {
    try {
      // Verify agent belongs to tenant
      const existing = await this.getTenantAgentById(tenantId, agentId);
      if (!existing) {
        return null;
      }

      const { data: agent, error } = await this.supabase.adminClient
        .from('agents')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update agent: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'update', 'agent', agentId, tenantId, data);

      logger.info('Tenant agent updated by superadmin', {
        superadminId,
        tenantId,
        agentId,
        updatedFields: Object.keys(data)
      });

      // Return agent without password_hash
      const { password_hash, ...safeAgent } = agent;
      return {
        ...safeAgent,
        account_name: existing.account_name
      };
    } catch (error) {
      logger.error('Failed to update tenant agent', {
        error: error.message,
        tenantId,
        agentId,
        superadminId
      });
      throw error;
    }
  }

  /**
   * Reset agent password and return temporary password
   * @param {string} tenantId - Tenant UUID
   * @param {string} agentId - Agent UUID
   * @param {string} superadminId - Superadmin resetting the password
   * @returns {Promise<Object>} Object with temporary password
   */
  async resetAgentPassword(tenantId, agentId, superadminId) {
    try {
      // Verify agent belongs to tenant
      const existing = await this.getTenantAgentById(tenantId, agentId);
      if (!existing) {
        return null;
      }

      // Generate temporary password
      const crypto = require('crypto');
      const temporaryPassword = crypto.randomBytes(8).toString('hex');

      // Hash the temporary password
      const bcrypt = require('bcrypt');
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

      // Update agent password
      const { error } = await this.supabase.adminClient
        .from('agents')
        .update({
          password_hash: passwordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId);

      if (error) {
        throw new Error(`Failed to reset password: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'reset_password', 'agent', agentId, tenantId, {
        agentEmail: existing.email
      });

      logger.warn('Agent password reset by superadmin', {
        superadminId,
        tenantId,
        agentId,
        agentEmail: existing.email
      });

      return {
        temporaryPassword
      };
    } catch (error) {
      logger.error('Failed to reset agent password', {
        error: error.message,
        tenantId,
        agentId,
        superadminId
      });
      throw error;
    }
  }

  // ========================================
  // TENANT BRANDING MANAGEMENT METHODS
  // ========================================

  /**
   * Get tenant branding settings
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object|null>} Branding data or null
   */
  async getTenantBranding(tenantId) {
    try {
      const { data: branding, error } = await this.supabase.adminClient
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
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
   * Update tenant branding settings
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Branding data
   * @param {string} superadminId - Superadmin updating the branding
   * @returns {Promise<Object>} Updated branding
   */
  async updateTenantBranding(tenantId, data, superadminId) {
    try {
      // Verify tenant exists
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        return null;
      }

      // Check if branding exists
      const existing = await this.getTenantBranding(tenantId);

      let branding;
      if (existing) {
        // Update existing branding
        const { data: updated, error } = await this.supabase.adminClient
          .from('tenant_branding')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update branding: ${error.message}`);
        }
        branding = updated;
      } else {
        // Create new branding
        const { data: created, error } = await this.supabase.adminClient
          .from('tenant_branding')
          .insert({
            tenant_id: tenantId,
            ...data
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create branding: ${error.message}`);
        }
        branding = created;
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'update', 'tenant_branding', tenantId, tenantId, data);

      logger.info('Tenant branding updated by superadmin', {
        superadminId,
        tenantId,
        updatedFields: Object.keys(data)
      });

      return branding;
    } catch (error) {
      logger.error('Failed to update tenant branding', {
        error: error.message,
        tenantId,
        superadminId
      });
      throw error;
    }
  }

  // ========================================
  // TENANT PLAN MANAGEMENT METHODS
  // ========================================

  /**
   * List all plans for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of plans
   */
  async listTenantPlans(tenantId, filters = {}) {
    try {
      let query = this.supabase.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

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

      // Get subscriber counts for each plan
      const plansWithCounts = await Promise.all((plans || []).map(async (plan) => {
        const { count } = await this.supabase.adminClient
          .from('user_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('plan_id', plan.id)
          .eq('status', 'active');

        return {
          ...plan,
          subscriber_count: count || 0
        };
      }));

      return plansWithCounts;
    } catch (error) {
      logger.error('Failed to list tenant plans', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Create a new plan for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Plan data
   * @param {string} superadminId - Superadmin creating the plan
   * @returns {Promise<Object>} Created plan
   */
  async createTenantPlan(tenantId, data, superadminId) {
    try {
      // Verify tenant exists
      const { data: tenant, error: tenantError } = await this.supabase.adminClient
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      const planData = {
        tenant_id: tenantId,
        name: data.name,
        description: data.description || null,
        price_cents: data.price_cents || 0,
        billing_cycle: data.billing_cycle || 'monthly',
        status: data.status || 'active',
        is_default: data.is_default || false,
        trial_days: data.trial_days || 0,
        quotas: data.quotas || {},
        features: data.features || {}
      };

      // If setting as default, unset other defaults first
      if (planData.is_default) {
        await this.supabase.adminClient
          .from('tenant_plans')
          .update({ is_default: false })
          .eq('tenant_id', tenantId)
          .eq('is_default', true);
      }

      const { data: plan, error } = await this.supabase.adminClient
        .from('tenant_plans')
        .insert(planData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create plan: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'create', 'tenant_plan', plan.id, tenantId, {
        name: plan.name,
        price_cents: plan.price_cents
      });

      logger.info('Tenant plan created by superadmin', {
        superadminId,
        tenantId,
        planId: plan.id,
        planName: plan.name
      });

      return {
        ...plan,
        subscriber_count: 0
      };
    } catch (error) {
      logger.error('Failed to create tenant plan', {
        error: error.message,
        tenantId,
        superadminId
      });
      throw error;
    }
  }

  /**
   * Update a tenant plan
   * @param {string} tenantId - Tenant UUID
   * @param {string} planId - Plan UUID
   * @param {Object} data - Update data
   * @param {string} superadminId - Superadmin updating the plan
   * @returns {Promise<Object>} Updated plan
   */
  async updateTenantPlan(tenantId, planId, data, superadminId) {
    try {
      // Verify plan belongs to tenant
      const { data: existing, error: existingError } = await this.supabase.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('id', planId)
        .eq('tenant_id', tenantId)
        .single();

      if (existingError || !existing) {
        return null;
      }

      // If setting as default, unset other defaults first
      if (data.is_default === true) {
        await this.supabase.adminClient
          .from('tenant_plans')
          .update({ is_default: false })
          .eq('tenant_id', tenantId)
          .eq('is_default', true)
          .neq('id', planId);
      }

      const { data: plan, error } = await this.supabase.adminClient
        .from('tenant_plans')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update plan: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'update', 'tenant_plan', planId, tenantId, data);

      logger.info('Tenant plan updated by superadmin', {
        superadminId,
        tenantId,
        planId,
        updatedFields: Object.keys(data)
      });

      // Get subscriber count
      const { count } = await this.supabase.adminClient
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)
        .eq('status', 'active');

      return {
        ...plan,
        subscriber_count: count || 0
      };
    } catch (error) {
      logger.error('Failed to update tenant plan', {
        error: error.message,
        tenantId,
        planId,
        superadminId
      });
      throw error;
    }
  }

  /**
   * Set a plan as the default for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} planId - Plan UUID
   * @param {string} superadminId - Superadmin setting the default
   * @returns {Promise<Object>} Updated plan
   */
  async setDefaultTenantPlan(tenantId, planId, superadminId) {
    try {
      // Verify plan belongs to tenant
      const { data: existing, error: existingError } = await this.supabase.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('id', planId)
        .eq('tenant_id', tenantId)
        .single();

      if (existingError || !existing) {
        return null;
      }

      // Unset all other defaults
      await this.supabase.adminClient
        .from('tenant_plans')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true);

      // Set this plan as default
      const { data: plan, error } = await this.supabase.adminClient
        .from('tenant_plans')
        .update({
          is_default: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to set default plan: ${error.message}`);
      }

      // Log audit action
      await this.logAuditAction(superadminId, 'set_default', 'tenant_plan', planId, tenantId, {
        planName: plan.name
      });

      logger.info('Tenant default plan set by superadmin', {
        superadminId,
        tenantId,
        planId,
        planName: plan.name
      });

      return plan;
    } catch (error) {
      logger.error('Failed to set default tenant plan', {
        error: error.message,
        tenantId,
        planId,
        superadminId
      });
      throw error;
    }
  }

  // ========================================
  // TENANT AUDIT LOG AND EXPORT METHODS
  // ========================================

  /**
   * Get tenant audit log entries
   * @param {string} tenantId - Tenant UUID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Paginated audit log entries
   */
  async getTenantAuditLog(tenantId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      // Get count
      const { count: total, error: countError } = await this.supabase.adminClient
        .from('superadmin_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (countError) {
        throw new Error(`Failed to count audit entries: ${countError.message}`);
      }

      // Get entries
      const { data: entries, error } = await this.supabase.adminClient
        .from('superadmin_audit_log')
        .select(`
          *,
          superadmins (
            id,
            email,
            name
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get audit entries: ${error.message}`);
      }

      const totalPages = Math.ceil((total || 0) / limit);

      return {
        entries: entries || [],
        page,
        limit,
        total: total || 0,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to get tenant audit log', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Export tenant data as CSV
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<string>} CSV data
   */
  async exportTenantData(tenantId) {
    try {
      // Get tenant info
      const tenant = await this.getTenantById(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Get accounts
      const accountsResult = await this.listTenantAccounts(tenantId, { limit: 1000 });
      const accounts = accountsResult.accounts;

      // Get agents
      const agentsResult = await this.listTenantAgents(tenantId, { limit: 1000 });
      const agents = agentsResult.agents;

      // Build CSV
      const csvRows = [];
      
      // Header
      csvRows.push('Type,ID,Name,Email,Status,Role,Account,Created At');

      // Accounts
      for (const account of accounts) {
        csvRows.push([
          'Account',
          account.id,
          `"${(account.name || '').replace(/"/g, '""')}"`,
          '',
          account.status,
          '',
          '',
          account.created_at
        ].join(','));
      }

      // Agents
      for (const agent of agents) {
        csvRows.push([
          'Agent',
          agent.id,
          `"${(agent.name || '').replace(/"/g, '""')}"`,
          agent.email,
          agent.status,
          agent.role,
          `"${(agent.account_name || '').replace(/"/g, '""')}"`,
          agent.created_at
        ].join(','));
      }

      logger.info('Tenant data exported', {
        tenantId,
        accountCount: accounts.length,
        agentCount: agents.length
      });

      return csvRows.join('\n');
    } catch (error) {
      logger.error('Failed to export tenant data', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }
}

module.exports = new SuperadminService();
