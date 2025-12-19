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
import { Plus, Edit, Key, X, Check, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface TenantAgent {
  id: string;
  account_id: string;
  account_name: string;
  email: string;
  name: string;
  role: 'owner' | 'administrator' | 'agent' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

interface TenantAccount {
  id: string;
  name: string;
}

interface TenantAgentsTabProps {
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

export function TenantAgentsTab({ tenantId }: TenantAgentsTabProps) {
  const [agents, setAgents] = useState<TenantAgent[]>([]);
  const [accounts, setAccounts] = useState<TenantAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    accountId: '',
    name: '',
    email: '',
    password: '',
    role: 'agent' as const,
    status: 'active' as const
  });

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/agents?page=${page}&limit=10`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to fetch agents');
      
      const data = await response.json();
      if (data.success) {
        setAgents(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page]);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/accounts?limit=100`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to fetch accounts');
      
      const data = await response.json();
      if (data.success) {
        setAccounts(data.data);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchAgents();
    fetchAccounts();
  }, [fetchAgents, fetchAccounts]);

  const handleCreate = async () => {
    if (!formData.accountId || !formData.name || !formData.email || !formData.password) {
      toast.error('All fields are required');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${tenantId}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Agent created successfully');
        setShowNewForm(false);
        setFormData({ accountId: '', name: '', email: '', password: '', role: 'agent', status: 'active' });
        fetchAgents();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create agent');
    }
  };

  const handleUpdate = async (agentId: string) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/agents/${agentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'CSRF-Token': csrfToken })
          },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            status: formData.status
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Agent updated successfully');
        setEditingId(null);
        fetchAgents();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update agent');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordId) return;

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/agents/${resetPasswordId}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'CSRF-Token': csrfToken })
          },
          credentials: 'include'
        }
      );

      const data = await response.json();
      if (data.success) {
        setTempPassword(data.data.temporaryPassword);
        toast.success('Password reset successfully');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
      setResetPasswordId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const startEdit = (agent: TenantAgent) => {
    setEditingId(agent.id);
    setFormData({
      accountId: agent.account_id,
      name: agent.name,
      email: agent.email,
      password: '',
      role: agent.role,
      status: agent.status
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
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'administrator': return 'secondary';
      case 'agent': return 'outline';
      case 'viewer': return 'outline';
      default: return 'outline';
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} agent{total !== 1 ? 's' : ''} total
        </p>
        <Button onClick={() => setShowNewForm(true)} disabled={showNewForm || accounts.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {accounts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Create an account first before adding agents.
          </CardContent>
        </Card>
      )}

      {showNewForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-lg">New Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={formData.accountId}
                  onValueChange={(v) => setFormData({ ...formData, accountId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v as 'owner' | 'administrator' | 'agent' | 'viewer' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrator">Administrator</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowNewForm(false);
                setFormData({ accountId: '', name: '', email: '', password: '', role: 'agent', status: 'active' });
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleCreate}>
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
            <TableHead>Email</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id}>
              {editingId === agent.id ? (
                <>
                  <TableCell>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="max-w-[150px]"
                    />
                  </TableCell>
                  <TableCell>{agent.email}</TableCell>
                  <TableCell>{agent.account_name}</TableCell>
                  <TableCell>
                    <Select
                      value={formData.role}
                      onValueChange={(v) => setFormData({ ...formData, role: v as 'owner' | 'administrator' | 'agent' | 'viewer' })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="administrator">Administrator</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as 'active' | 'inactive' | 'pending' })}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{formatDate(agent.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" onClick={() => handleUpdate(agent.id)}>
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
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>{agent.email}</TableCell>
                  <TableCell>{agent.account_name}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleVariant(agent.role)}>
                      {agent.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(agent.status)}>
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(agent.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => startEdit(agent)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setResetPasswordId(agent.id)}>
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
          {agents.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No agents found
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

      {/* Reset Password Dialog */}
      <AlertDialog open={!!resetPasswordId && !tempPassword} onOpenChange={() => setResetPasswordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new temporary password for the agent. 
              Make sure to share it securely with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show Temporary Password Dialog */}
      <AlertDialog open={!!tempPassword} onOpenChange={() => { setTempPassword(null); setResetPasswordId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Temporary Password</AlertDialogTitle>
            <AlertDialogDescription>
              Share this password securely with the agent. They should change it after logging in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
            <code className="flex-1 font-mono text-lg">{tempPassword}</code>
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(tempPassword || '')}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setTempPassword(null); setResetPasswordId(null); }}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TenantAgentsTab;
