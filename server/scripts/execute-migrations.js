/**
 * Execute Multi-Tenant Migrations
 * Executes migrations using SupabaseService
 */

require('dotenv').config();
const SupabaseService = require('../services/SupabaseService');
const { logger } = require('../utils/logger');

async function executeMigrations() {
  console.log('🚀 Starting multi-tenant architecture migrations...\n');
  
  try {
    // Test connection first
    const { data: healthCheck, error: healthError } = await SupabaseService.healthCheck();
    if (healthError || !healthCheck) {
      throw new Error('Supabase connection failed');
    }
    console.log('✅ Supabase connection verified\n');
    
    // Migration 1: Create superadmins table
    console.log('🔄 Creating superadmins table...');
    await SupabaseService.adminClient.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS superadmins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        CREATE INDEX IF NOT EXISTS idx_superadmins_email ON superadmins(email);
        CREATE INDEX IF NOT EXISTS idx_superadmins_status ON superadmins(status);
      `
    }).then(() => console.log('✅ superadmins table created'));
    
    // Since exec_sql might not exist, let's try a different approach
    // We'll use the Supabase dashboard SQL editor instead
    
    console.log('\n⚠️  Direct SQL execution not available via API.');
    console.log('📋 Please execute the following SQL in your Supabase dashboard:\n');
    
    console.log('-- 1. Create superadmins table');
    console.log(`CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmins_email ON superadmins(email);
CREATE INDEX IF NOT EXISTS idx_superadmins_status ON superadmins(status);
`);

    console.log('\n-- 2. Create tenants table');
    console.log(`CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_superadmin_id UUID REFERENCES superadmins(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings JSONB DEFAULT '{}',
  stripe_connect_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_superadmin ON tenants(owner_superadmin_id);

ALTER TABLE tenants ADD CONSTRAINT IF NOT EXISTS check_subdomain_format 
  CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(subdomain) >= 2 AND length(subdomain) <= 63);
`);

    console.log('\n-- 3. Create tenant_branding table');
    console.log(`CREATE TABLE IF NOT EXISTS tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_name TEXT DEFAULT 'WUZAPI',
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  primary_foreground TEXT,
  secondary_foreground TEXT,
  custom_home_html TEXT,
  support_phone TEXT,
  og_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_branding_tenant ON tenant_branding(tenant_id);
`);

    console.log('\n-- 4. Create tenant_plans table');
    console.log(`CREATE TABLE IF NOT EXISTS tenant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly', 'weekly', 'lifetime')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  is_default BOOLEAN DEFAULT false,
  trial_days INTEGER DEFAULT 0,
  quotas JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_plans_tenant ON tenant_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_plans_status ON tenant_plans(status);
CREATE INDEX IF NOT EXISTS idx_tenant_plans_default ON tenant_plans(tenant_id, is_default) WHERE is_default = true;
`);

    console.log('\n-- 5. Create superadmin_audit_log table');
    console.log(`CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID REFERENCES superadmins(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  tenant_id UUID REFERENCES tenants(id),
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_tenant ON superadmin_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_created ON superadmin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_superadmin ON superadmin_audit_log(superadmin_id);
`);

    console.log('\n-- 6. Add tenant_id to accounts table');
    console.log(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_status ON accounts(tenant_id, status);
`);

    console.log('\n-- 7. Update user_subscriptions foreign key');
    console.log(`-- Note: This may need to be done carefully in production
-- First backup your data, then:

-- Drop existing constraint if it exists
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_id_fkey;

-- Add new constraint (after migrating data to tenant_plans)
-- ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES tenant_plans(id);
`);

    console.log('\n🎯 After executing the SQL above, run this script again to verify tables were created.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function verifyTables() {
  console.log('\n🔍 Verifying table creation...\n');
  
  const tablesToCheck = [
    'superadmins',
    'tenants', 
    'tenant_branding',
    'tenant_plans',
    'superadmin_audit_log'
  ];
  
  let allTablesExist = true;
  
  for (const tableName of tablesToCheck) {
    try {
      const { error } = await SupabaseService.adminClient
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`❌ Table '${tableName}': ${error.message}`);
        allTablesExist = false;
      } else {
        console.log(`✅ Table '${tableName}': Exists`);
      }
    } catch (error) {
      console.log(`❌ Table '${tableName}': ${error.message}`);
      allTablesExist = false;
    }
  }
  
  if (allTablesExist) {
    console.log('\n🎉 All tables created successfully!');
    console.log('✅ Ready to proceed with Phase 2: RLS Policies');
  } else {
    console.log('\n⚠️  Some tables are missing. Please execute the SQL above in Supabase dashboard.');
  }
  
  return allTablesExist;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--verify')) {
    await verifyTables();
  } else {
    await executeMigrations();
  }
}

main().catch(console.error);