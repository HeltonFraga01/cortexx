import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Star, X, Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface TenantPlan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_cycle: 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'lifetime';
  status: 'active' | 'inactive' | 'archived';
  is_default: boolean;
  trial_days: number;
  quotas: Record<string, number>;
  features: Record<string, boolean>;
  subscriber_count?: number;
}

interface TenantPlansTabProps {
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

export function TenantPlansTab({ tenantId }: TenantPlansTabProps) {
  const [plans, setPlans] = useState<TenantPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_cents: 0,
    billing_cycle: 'monthly' as const,
    status: 'active' as const,
    is_default: false,
    trial_days: 0
  });

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/plans`,
        { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch plans');
      
      const data = await response.json();
      if (data.success) {
        setPlans(data.data);
      }
    } catch (error) {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Plan name is required');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${tenantId}/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          description: formData.description || null
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Plan created successfully');
        setShowNewForm(false);
        resetForm();
        fetchPlans();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create plan');
    }
  };

  const handleUpdate = async (planId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/plans/${planId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(csrfToken && { 'CSRF-Token': csrfToken })
          },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            price_cents: formData.price_cents,
            billing_cycle: formData.billing_cycle,
            status: formData.status,
            trial_days: formData.trial_days
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Plan updated successfully');
        setEditingId(null);
        fetchPlans();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update plan');
    }
  };

  const handleSetDefault = async (planId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/plans/${planId}/set-default`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(csrfToken && { 'CSRF-Token': csrfToken })
          },
          credentials: 'include'
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Default plan updated');
        fetchPlans();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to set default plan');
    }
  };

  const startEdit = (plan: TenantPlan) => {
    setEditingId(plan.id);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_cents: plan.price_cents,
      billing_cycle: plan.billing_cycle,
      status: plan.status,
      is_default: plan.is_default,
      trial_days: plan.trial_days
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price_cents: 0,
      billing_cycle: 'monthly',
      status: 'active',
      is_default: false,
      trial_days: 0
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'inactive': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'archived': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
              <div className="flex-1" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {plans.length} plan{plans.length !== 1 ? 's' : ''} configured
        </p>
        <Button 
          onClick={() => setShowNewForm(true)} 
          disabled={showNewForm}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {showNewForm && (
        <Card className="border-2 border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="text-lg">New Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (cents)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.price_cents}
                  onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  {formatPrice(formData.price_cents)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select
                  value={formData.billing_cycle}
                  onValueChange={(v) => setFormData({ ...formData, billing_cycle: v as 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'lifetime' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as 'active' | 'inactive' | 'archived' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trial Days</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.trial_days}
                  onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label>Set as default plan</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowNewForm(false);
                resetForm();
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
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
            <TableHead>Price</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Subscribers</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              {editingId === plan.id ? (
                <>
                  <TableCell>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="max-w-[150px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={formData.price_cents}
                      onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                      className="max-w-[100px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={formData.billing_cycle}
                      onValueChange={(v) => setFormData({ ...formData, billing_cycle: v as 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'lifetime' })}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="lifetime">Lifetime</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as 'active' | 'inactive' | 'archived' })}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{plan.subscriber_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdate(plan.id)}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
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
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {plan.name}
                      {plan.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatPrice(plan.price_cents)}</TableCell>
                  <TableCell className="capitalize">{plan.billing_cycle}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(plan.status)}>
                      {plan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{plan.subscriber_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => startEdit(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!plan.is_default && (
                        <Button size="sm" variant="outline" onClick={() => handleSetDefault(plan.id)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
          {plans.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="p-3 rounded-xl bg-muted mb-3">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No plans configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a plan to start managing subscriptions
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default TenantPlansTab;
