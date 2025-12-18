import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton';
import { 
  Building2, 
  Plus, 
  Search, 
  Eye, 
  Settings, 
  Trash2, 
  Power, 
  PowerOff,
  Users,
  DollarSign,
  Calendar,
  ExternalLink,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

// Helper to get CSRF token
const getCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    return data.csrfToken || null;
  } catch {
    return null;
  }
};

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended';
  accountCount: number;
  mrr: number;
  lastActivity: string;
  createdAt: string;
  ownerSuperadminId: string;
  settings: Record<string, any>;
  stripeConnectId?: string;
}

interface CreateTenantData {
  name: string;
  subdomain: string;
  ownerEmail: string;
  settings?: Record<string, any>;
}

/**
 * Tenant Management Page
 * Requirements: 2.1, 2.2, 2.3, 2.4 - CRUD interface for tenants with validation
 */
const TenantManagement = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantData>({
    name: '',
    subdomain: '',
    ownerEmail: '',
    settings: {}
  });
  const [subdomainValidation, setSubdomainValidation] = useState<{
    isValid: boolean;
    message: string;
  }>({ isValid: true, message: '' });

  const navigate = useNavigate();

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/superadmin/tenants', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Session expired. Please login again');
          navigate('/superadmin/login');
          return;
        }
        throw new Error(`Failed to load tenants: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTenants(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to load tenants');
      }
      
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const validateSubdomain = async (subdomain: string) => {
    if (!subdomain) {
      setSubdomainValidation({ isValid: false, message: 'Subdomain is required' });
      return;
    }

    // Basic format validation
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (subdomain.length < 3 || subdomain.length > 63) {
      setSubdomainValidation({ isValid: false, message: 'Subdomain must be 3-63 characters long' });
      return;
    }

    if (!subdomainRegex.test(subdomain) || subdomain.includes('--')) {
      setSubdomainValidation({ isValid: false, message: 'Invalid format. Use lowercase letters, numbers, and hyphens only' });
      return;
    }

    // Check availability
    try {
      const response = await fetch(`/api/superadmin/tenants/validate-subdomain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subdomain })
      });

      const data = await response.json();
      
      if (data.success && data.data.valid) {
        setSubdomainValidation({ isValid: true, message: 'Subdomain is available' });
      } else {
        setSubdomainValidation({ isValid: false, message: data.data.error || 'Subdomain is not available' });
      }
    } catch (error) {
      setSubdomainValidation({ isValid: false, message: 'Failed to validate subdomain' });
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.subdomain || !newTenant.ownerEmail || !subdomainValidation.isValid) {
      toast.error('Please fill in all required fields correctly');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newTenant.ownerEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setCreateLoading(true);
      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify(newTenant)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Tenant created successfully');
        setShowCreateDialog(false);
        setNewTenant({ name: '', subdomain: '', ownerEmail: '', settings: {} });
        setSubdomainValidation({ isValid: true, message: '' });
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to create tenant');
      }
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error('Failed to create tenant');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${tenantId}/${action}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Tenant ${action}d successfully`);
        fetchTenants();
      } else {
        throw new Error(data.error || `Failed to ${action} tenant`);
      }
    } catch (error) {
      console.error(`Error ${action}ing tenant:`, error);
      toast.error(`Failed to ${action} tenant`);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify({ confirm: 'DELETE' })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Tenant deleted successfully');
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Failed to delete tenant');
    }
  };

  const handleImpersonateTenant = async (tenantId: string) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/impersonate/${tenantId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Now impersonating ${data.data.tenantName}`);
        // Redirect to tenant admin panel
        window.location.href = `https://${data.data.subdomain}.${window.location.hostname}/admin`;
      } else {
        throw new Error(data.error || 'Failed to start impersonation');
      }
    } catch (error) {
      console.error('Error starting impersonation:', error);
      toast.error('Failed to impersonate tenant');
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Filter tenants based on search and status
  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.subdomain.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tenant Management</h1>
          <p className="text-muted-foreground">Loading tenants...</p>
        </div>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Management</h1>
          <p className="text-muted-foreground">
            Create and manage platform tenants
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Create a new tenant instance with its own subdomain and branding.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input
                  id="tenant-name"
                  placeholder="Acme Corporation"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="subdomain"
                    placeholder="acme"
                    value={newTenant.subdomain}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase();
                      setNewTenant({ ...newTenant, subdomain: value });
                      if (value) {
                        validateSubdomain(value);
                      } else {
                        setSubdomainValidation({ isValid: true, message: '' });
                      }
                    }}
                  />
                  <span className="text-sm text-muted-foreground">.cortex.online</span>
                </div>
                {subdomainValidation.message && (
                  <div className={`flex items-center space-x-1 text-sm ${
                    subdomainValidation.isValid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {subdomainValidation.isValid ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <span>{subdomainValidation.message}</span>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="owner-email">Owner Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="admin@acme.com"
                  value={newTenant.ownerEmail}
                  onChange={(e) => setNewTenant({ ...newTenant, ownerEmail: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  The admin account will be created with this email
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTenant}
                disabled={createLoading || !subdomainValidation.isValid}
              >
                {createLoading ? 'Creating...' : 'Create Tenant'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Tenants ({filteredTenants.length})</span>
          </CardTitle>
          <CardDescription>
            Manage all platform tenants and their settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTenants.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No tenants found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Create your first tenant to get started'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Tenant
                  </Button>
                )}
              </div>
            ) : (
              filteredTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{tenant.name}</span>
                        <Badge
                          variant={
                            tenant.status === 'active' ? 'default' :
                            tenant.status === 'inactive' ? 'secondary' : 'destructive'
                          }
                        >
                          {tenant.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <ExternalLink className="h-3 w-3" />
                          <span>{tenant.subdomain}.cortex.online</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span>{tenant.accountCount} accounts</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(tenant.mrr)} MRR</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Created {formatDate(tenant.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImpersonateTenant(tenant.id)}
                      disabled={tenant.status !== 'active'}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Manage
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleTenantStatus(tenant.id, tenant.status)}
                    >
                      {tenant.status === 'active' ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{tenant.name}"? This action cannot be undone.
                            All accounts, agents, inboxes, and data associated with this tenant will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTenant(tenant.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Tenant
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantManagement;