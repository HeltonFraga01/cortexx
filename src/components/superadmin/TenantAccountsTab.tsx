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
import { Plus, Edit, Trash2, X, Check, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

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

interface TenantAccountsTabProps {
  tenantId: string;
}

// Helper to get CSRF token
const getCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/csrf-token', { credentials: 'include' });
    const data = await response.json();
    return data.csrfToken || null;
  } catch {
    return null;
  }
};

export function TenantAccountsTab({ tenantId }: TenantAccountsTabProps) {
  const [accounts, setAccounts] = useState<TenantAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

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
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/accounts?page=${page}&limit=10`,
        { credentials: 'include' }
      );
      
      // Handle authentication errors
      if (response.status === 401) {
        toast.error('Session expired. Please login again.');
        return;
      }
      
      if (response.status === 403) {
        toast.error('Access denied. Superadmin privileges required.');
        return;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to fetch accounts');
      }
      
      if (data.success) {
        setAccounts(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        throw new Error(data.error || 'Failed to fetch accounts');
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
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${tenantId}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          ownerEmail: formData.ownerEmail,
          wuzapiToken: formData.wuzapiToken || null
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Account created successfully');
        setShowNewForm(false);
        setFormData({ name: '', ownerEmail: '', wuzapiToken: '', status: 'active' });
        fetchAccounts();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    }
  };

  const handleUpdate = async (accountId: string) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/accounts/${accountId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'CSRF-Token': csrfToken })
          },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.name,
            status: formData.status
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Account updated successfully');
        setEditingId(null);
        fetchAccounts();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update account');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/accounts/${deleteId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'CSRF-Token': csrfToken })
          },
          credentials: 'include',
          body: JSON.stringify({ confirm: 'DELETE' })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Account deleted successfully');
        setDeleteId(null);
        fetchAccounts();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    }
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'suspended': return 'destructive';
      default: return 'outline';
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
                    <Badge variant={getStatusVariant(account.status)}>
                      {account.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{account.agent_count || 0}</TableCell>
                  <TableCell>{account.inbox_count || 0}</TableCell>
                  <TableCell>{formatDate(account.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
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
