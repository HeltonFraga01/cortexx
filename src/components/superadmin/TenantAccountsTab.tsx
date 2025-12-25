import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, X, Check, Loader2, Users, Key, Eye, EyeOff, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { backendApi } from '@/services/api-client';

interface TenantAccount {
  id: string;
  name: string;
  owner_user_id: string;
  wuzapi_token: string | null;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  agent_count?: number;
  inbox_count?: number;
}

interface OwnerAgent {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

interface TenantAccountsTabProps {
  tenantId: string;
}

export function TenantAccountsTab({ tenantId }: TenantAccountsTabProps) {
  const [accounts, setAccounts] = useState<TenantAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Credentials editing state
  const [editingCredentialsId, setEditingCredentialsId] = useState<string | null>(null);
  const [ownerData, setOwnerData] = useState<OwnerAgent | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [credentialsForm, setCredentialsForm] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ownerEmail: '',
    wuzapiToken: '',
    status: 'active' as const
  });

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await backendApi.get<{
        success: boolean;
        data: TenantAccount[];
        pagination: { totalPages: number; total: number };
        error?: string;
      }>(`/superadmin/tenants/${tenantId}/accounts?page=${page}&limit=10`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch accounts');
      }
      
      const data = response.data;
      if (data?.success) {
        setAccounts(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        throw new Error(data?.error || 'Failed to fetch accounts');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load accounts');
      setAccounts([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenantId, page]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async () => {
    if (!formData.name || !formData.ownerEmail) {
      toast.error('Name and owner email are required');
      return;
    }

    try {
      const response = await backendApi.post<{ success: boolean; error?: string }>(
        `/superadmin/tenants/${tenantId}/accounts`,
        {
          name: formData.name,
          ownerEmail: formData.ownerEmail,
          wuzapiToken: formData.wuzapiToken || null
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to create account');
      }

      const data = response.data;
      if (data?.success) {
        toast.success('Account created successfully');
        setShowNewForm(false);
        setFormData({ name: '', ownerEmail: '', wuzapiToken: '', status: 'active' });
        fetchAccounts();
      } else {
        throw new Error(data?.error || 'Failed to create account');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    }
  };

  const handleUpdate = async (accountId: string) => {
    try {
      const response = await backendApi.put<{ success: boolean; error?: string }>(
        `/superadmin/tenants/${tenantId}/accounts/${accountId}`,
        {
          name: formData.name,
          status: formData.status
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to update account');
      }

      const data = response.data;
      if (data?.success) {
        toast.success('Account updated successfully');
        setEditingId(null);
        fetchAccounts();
      } else {
        throw new Error(data?.error || 'Failed to update account');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update account');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await backendApi.delete<{ success: boolean; error?: string }>(
        `/superadmin/tenants/${tenantId}/accounts/${deleteId}`,
        { data: { confirm: 'DELETE' } }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete account');
      }

      const data = response.data;
      if (data?.success) {
        toast.success('Account deleted successfully');
        setDeleteId(null);
        fetchAccounts();
      } else {
        throw new Error(data?.error || 'Failed to delete account');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  };

  const fetchOwnerAgent = async (accountId: string) => {
    try {
      setLoadingOwner(true);
      const response = await backendApi.get<{
        success: boolean;
        data: OwnerAgent;
        error?: string;
      }>(`/superadmin/tenants/${tenantId}/accounts/${accountId}/owner`);

      if (response.success && response.data?.success) {
        setOwnerData(response.data.data);
        setCredentialsForm({
          email: response.data.data.email || '',
          password: '',
          confirmPassword: ''
        });
      } else {
        setOwnerData(null);
        setCredentialsForm({ email: '', password: '', confirmPassword: '' });
        if (response.status !== 404) {
          toast.error(response.data?.error || response.error || 'Failed to fetch owner data');
        }
      }
    } catch (error) {
      console.error('Error fetching owner:', error);
      setOwnerData(null);
    } finally {
      setLoadingOwner(false);
    }
  };

  const handleEditCredentials = async (accountId: string) => {
    setEditingCredentialsId(accountId);
    await fetchOwnerAgent(accountId);
  };

  const handleSaveCredentials = async () => {
    if (!editingCredentialsId) return;

    // Validate
    if (!credentialsForm.email && !credentialsForm.password) {
      toast.error('Please provide email or password to update');
      return;
    }

    if (credentialsForm.password && credentialsForm.password !== credentialsForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (credentialsForm.password && credentialsForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setSavingCredentials(true);
      
      const body: { email?: string; password?: string } = {};
      if (credentialsForm.email && credentialsForm.email !== ownerData?.email) {
        body.email = credentialsForm.email;
      }
      if (credentialsForm.password) {
        body.password = credentialsForm.password;
      }

      if (Object.keys(body).length === 0) {
        toast.info('No changes to save');
        return;
      }

      const response = await backendApi.put<{ success: boolean; error?: string }>(
        `/superadmin/tenants/${tenantId}/accounts/${editingCredentialsId}/credentials`,
        body
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to update credentials');
      }

      const data = response.data;
      if (data?.success) {
        toast.success('Credentials updated successfully');
        setEditingCredentialsId(null);
        setOwnerData(null);
        setCredentialsForm({ email: '', password: '', confirmPassword: '' });
      } else {
        throw new Error(data?.error || 'Failed to update credentials');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update credentials');
    } finally {
      setSavingCredentials(false);
    }
  };

  const cancelEditCredentials = () => {
    setEditingCredentialsId(null);
    setOwnerData(null);
    setCredentialsForm({ email: '', password: '', confirmPassword: '' });
    setShowPassword(false);
  };

  const startEdit = (account: TenantAccount) => {
    setEditingId(account.id);
    setFormData({
      name: account.name,
      ownerEmail: '',
      wuzapiToken: account.wuzapi_token || '',
      status: account.status
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white border-0';
      case 'inactive': return 'bg-yellow-500 text-white border-0';
      case 'suspended': return 'bg-red-500 text-white border-0';
      default: return '';
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
            <div className="h-5 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            {total} account{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button 
          onClick={() => setShowNewForm(true)} 
          disabled={showNewForm}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Account
        </Button>
      </div>

      {showNewForm && (
        <Card className="border-2 border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Plus className="h-4 w-4 text-orange-500" />
              </div>
              <CardTitle className="text-lg">New Account</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Account Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Owner Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">WUZAPI Token</Label>
              <Input
                value={formData.wuzapiToken}
                onChange={(e) => setFormData({ ...formData, wuzapiToken: e.target.value })}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Optional - can be configured later</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => {
                setShowNewForm(false);
                setFormData({ name: '', ownerEmail: '', wuzapiToken: '', status: 'active' });
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600 text-white">
                <Check className="h-4 w-4 mr-2" />
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editingCredentialsId && (
        <Card className="border-2 border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Key className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Edit Owner Credentials</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update email and password for the account owner
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelEditCredentials}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingOwner ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-muted-foreground">Loading owner data...</span>
              </div>
            ) : ownerData ? (
              <>
                <div className="p-3 rounded-lg bg-muted/50 mb-4">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Current owner:</span>{' '}
                    <span className="font-medium">{ownerData.name}</span>{' '}
                    <span className="text-muted-foreground">({ownerData.email})</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={credentialsForm.email}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, email: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={credentialsForm.password}
                        onChange={(e) => setCredentialsForm({ ...credentialsForm, password: e.target.value })}
                        className="bg-background pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Leave empty to keep current password</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Confirm Password</Label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={credentialsForm.confirmPassword}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, confirmPassword: e.target.value })}
                      className="bg-background"
                      disabled={!credentialsForm.password}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={cancelEditCredentials}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveCredentials} 
                    disabled={savingCredentials}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {savingCredentials ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save Credentials
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="p-4 rounded-full bg-muted/50 inline-block mb-3">
                  <Users className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-sm font-medium">No owner found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This account doesn't have an owner agent yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Agents</TableHead>
            <TableHead>Inboxes</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              {editingId === account.id ? (
                <>
                  <TableCell>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="max-w-[200px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as 'active' | 'inactive' | 'suspended' })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{account.agent_count || 0}</TableCell>
                  <TableCell>{account.inbox_count || 0}</TableCell>
                  <TableCell>{formatDate(account.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" onClick={() => handleUpdate(account.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(account.status)}>
                      {account.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{account.agent_count || 0}</TableCell>
                  <TableCell>{account.inbox_count || 0}</TableCell>
                  <TableCell>{formatDate(account.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEditCredentials(account.id)}
                        title="Edit owner credentials"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(account)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteId(account.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
          {accounts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted/50 mb-3">
                    <Users className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="text-sm font-medium">No accounts found</p>
                  <p className="text-xs mt-1">Create your first account to get started</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this account? This action cannot be undone.
              All agents, inboxes, and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TenantAccountsTab;
