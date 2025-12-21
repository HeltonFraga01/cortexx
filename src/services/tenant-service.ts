/**
 * Tenant Service
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * Handles tenant resolution and validation based on subdomain
 */

export interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    appName?: string;
  };
}

/**
 * Extract subdomain from hostname
 * Requirement: 10.1
 */
export function extractSubdomain(hostname: string): string | null {
  if (!hostname) return null;

  // Remove port if present
  const cleanHostname = hostname.split(':')[0];
  
  // Split by dots
  const parts = cleanHostname.split('.');
  
  // If less than 3 parts, no subdomain (e.g., localhost, example.com)
  if (parts.length < 3) {
    return null;
  }
  
  // First part is the subdomain
  const subdomain = parts[0];
  
  // Ignore common non-tenant subdomains
  if (['www', 'api', 'superadmin', 'admin'].includes(subdomain)) {
    return null;
  }
  
  return subdomain;
}

/**
 * Get current subdomain from window.location
 * Requirement: 10.1
 */
export function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  return extractSubdomain(window.location.hostname);
}

/**
 * Fetch tenant info from backend based on current subdomain
 * Requirement: 10.4
 */
export async function getTenantInfo(): Promise<TenantInfo | null> {
  try {
    const response = await fetch('/api/public/tenant-info', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      return null;
    }

    return data.data as TenantInfo;
  } catch (error) {
    console.error('Failed to fetch tenant info:', error);
    return null;
  }
}

/**
 * Validate that user belongs to current tenant
 * Requirements: 10.2, 10.3
 */
export function validateTenantAccess(
  userTenantId: string | undefined,
  currentTenantId: string | undefined
): { valid: boolean; error?: string } {
  // If no tenant context, allow access (might be localhost or main domain)
  if (!currentTenantId) {
    return { valid: true };
  }

  // If user has no tenant_id, deny access
  if (!userTenantId) {
    return { 
      valid: false, 
      error: 'Acesso não autorizado para este domínio' 
    };
  }

  // Check if tenant IDs match
  if (userTenantId !== currentTenantId) {
    return { 
      valid: false, 
      error: 'Acesso não autorizado para este domínio' 
    };
  }

  return { valid: true };
}

/**
 * Check if running on localhost (no tenant validation needed)
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

// Export tenant service object
export const tenantService = {
  extractSubdomain,
  getCurrentSubdomain,
  getTenantInfo,
  validateTenantAccess,
  isLocalhost,
};

export default tenantService;
