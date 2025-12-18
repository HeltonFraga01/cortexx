import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/useToast';
import { Plus, Edit, Trash2, DollarSign, Users, AlertTriangle, ExternalLink, Check, X } from 'lucide-react';

const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(50, 'Plan name too long'),
  description: z.string().optional(),
  price_cents: z.number().min(0, 'Price must be positive'),
  billing_cycle: z.enum(['monthly', 'yearly']),
  trial_days: z.number().min(0, 'Trial days must be positive').max(365, 'Trial too long'),
  is_default: z.boolean(),
  quotas: z.object({
    max_agents: z.number().min(1, 'Must allow at least 1 agent'),
    max_inboxes: z.number().min(1, 'Must allow at least 1 inbox'),
    max_messages_per_day: z.number().min(1, 'Must allow at least 1 message per day'),
    max_messages_per_month: z.number().min(1, 'Must allow at least 1 message per month'),
    max_bots: z.number().min(0, 'Bots must be 0 or more'),
    max_campaigns: z.number().min(0, 'Campaigns must be 0 or more'),
    max_storage_mb: z.number().min(1, 'Must allow at least 1MB storage')
  }),
  features: z.object({
    webhooks: z.boolean(),
    api_access: z.boolean(),
    custom_branding: z.boolean(),
    analytics: z.boolean(),
    priority_support: z.boolean(),
    white_label: z.boolean()
  })
});

type PlanFormData = z.infer<typeof planSchema>;

interface TenantPlan {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  price_cents: number;
  billing_cycle: 'monthly' | 'yearly';
  status: 'active' | 'inactive';
  is_default: boolean;
  trial_days: number;
  quotas: {
    max_agents: number;
    max_inboxes: number;
    max_messages_per_day: number;
    max_messages_per_month: number;
    max_bots: number;
    max_campaigns: number;
    max_storage_mb: number;
  };
  features: {
    webhooks: boolean;
    api_access: boolean;
    custom_branding: boolean;
    analytics: boolean;
    priority_support: boolean;
    white_label: boolean;
  };
  stripe_product_id?: string;
  stripe_price_id?: string;
  subscriber_count: number;
  created_at: string;
  updated_at: string;
}

interface GlobalLimits {
  max_agents: number;
  max_inboxes: number;
  max_messages_per_day: number;
  max_messages_per_month: number;
  max_bots: number;
  max_campaigns: number;
  max_storage_mb: number;
}

export function TenantPlans() {
  const [plans, setPlans] = useState<TenantPlan[]>([]);
  const [globalLimits, setGlobalLimits] = useState<GlobalLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      description: '',
      price_cents: 0,
      billing_cycle: 'monthly',
      trial_days: 0,
      is_default: false,
      quotas: {
        max_agents: 1,
        max_inboxes: 1,
        max_messages_per_day: 100,
        max_messages_per_month: 3000,
        max_bots: 0,
        max_campaigns: 0,
        max_storage_mb: 100
      },
      features: {
        webhooks: false,
        api_access: false,
        custom_branding: false,
        analytics: false,
        priority_support: false,
        white_label: false
      }
    }
  });

  const loadPlans = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tenant/plans', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load plans');
      }

      const data = await response.json();
      
      if (data.success) {
        setPlans(data.data.plans || []);
        setGlobalLimits(data.data.globalLimits || null);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load plans',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: PlanFormData) => {
    try {
      setIsSaving(true);
      
      const url = editingId ? `/api/tenant/plans/${editingId}` : '/api/tenant/plans';
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to save plan');
      }

      const result = await response.json();
      
      if (result.success) {
        await loadPlans();
        setShowNewForm(false);
        setEditingId(null);
        form.reset();
        toast({
          title: 'Success',
          description: editingId ? 'Plan updated successfully' : 'Plan created successfully'
        });
      } else {
        throw new Error(result.error || 'Failed to save plan');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save plan',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (plan: TenantPlan) => {
    setEditingId(plan.id);
    setShowNewForm(true);
    form.reset({
      name: plan.name,
      description: plan.description || '',
      price_cents: plan.price_cents,
      billing_cycle: plan.billing_cycle,
      trial_days: plan.trial_days,
      is_default: plan.is_default,
      quotas: plan.quotas,
      features: plan.features
    });
  };

  const handleDelete = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan?.subscriber_count > 0) {
      toast({
        title: 'Cannot Delete',
        description: 'This plan has active subscribers. Please migrate them to another plan first.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/tenant/plans/${planId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete plan');
      }

      const result = await response.json();
      
      if (result.success) {
        await loadPlans();
        toast({
          title: 'Success',
          description: 'Plan deleted successfully'
        });
      } else {
        throw new Error(result.error || 'Failed to delete plan');
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete plan',
        variant: 'destructive'
      });
    }
  };

  const handleSyncStripe = async (planId: string) => {
    try {
      setSyncingId(planId);
      
      const response = await fetch(`/api/tenant/plans/${planId}/sync-stripe`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to sync with Stripe');
      }

      const result = await response.json();
      
      if (result.success) {
        await loadPlans();
        toast({
          title: 'Success',
          description: 'Plan synced with Stripe successfully'
        });
      } else {
        throw new Error(result.error || 'Failed to sync with Stripe');
      }
    } catch (error) {
      console.error('Error syncing with Stripe:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sync with Stripe',
        variant: 'destructive'
      });
    } finally {
      setSyncingId(null);
    }
  };

  const formatPrice = (cents: number, cycle: string) => {
    const price = (cents / 100).toFixed(2);
    return `$${price}/${cycle === 'yearly' ? 'year' : 'month'}`;
  };

  const checkQuotaLimit = (quotaKey: keyof GlobalLimits, value: number) => {
    if (!globalLimits) return false;
    return value > globalLimits[quotaKey];
  };

  useEffect(() => {
    loadPlans();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading plans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Plans</h1>
          <p className="text-muted-foreground">
            Manage subscription plans for your tenant
          </p>
        </div>
        <Button onClick={() => setShowNewForm(true)} disabled={showNewForm}>
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      {globalLimits && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Global Platform Limits
            </CardTitle>
            <CardDescription>
              Your plan quotas cannot exceed these platform-wide limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <Label>Max Agents</Label>
                <p className="font-mono">{globalLimits.max_agents}</p>
              </div>
              <div>
                <Label>Max Inboxes</Label>
                <p className="font-mono">{globalLimits.max_inboxes}</p>
              </div>
              <div>
                <Label>Messages/Day</Label>
                <p className="font-mono">{globalLimits.max_messages_per_day}</p>
              </div>
              <div>
                <Label>Messages/Month</Label>
                <p className="font-mono">{globalLimits.max_messages_per_month}</p>
              </div>
              <div>
                <Label>Max Bots</Label>
                <p className="font-mono">{globalLimits.max_bots}</p>
              </div>
              <div>
                <Label>Max Campaigns</Label>
                <p className="font-mono">{globalLimits.max_campaigns}</p>
              </div>
              <div>
                <Label>Storage (MB)</Label>
                <p className="font-mono">{globalLimits.max_storage_mb}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showNewForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Plan' : 'Create New Plan'}</CardTitle>
            <CardDescription>
              Configure quotas, features, and pricing for your plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price_cents"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (cents)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billing_cycle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Cycle</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trial_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trial Days</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Quotas</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(form.watch('quotas')).map(([key, value]) => (
                      <FormField
                        key={key}
                        control={form.control}
                        name={`quotas.${key as keyof PlanFormData['quotas']}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              {globalLimits && checkQuotaLimit(key as keyof GlobalLimits, value) && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                className={globalLimits && checkQuotaLimit(key as keyof GlobalLimits, value) ? 'border-red-500' : ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Features</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(form.watch('features')).map(([key, value]) => (
                      <FormField
                        key={key}
                        control={form.control}
                        name={`features.${key as keyof PlanFormData['features']}`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </FormLabel>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="is_default"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Default Plan</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          New accounts will be assigned to this plan automatically
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowNewForm(false);
                      setEditingId(null);
                      form.reset();
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    <Check className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : editingId ? 'Update Plan' : 'Create Plan'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Existing Plans
          </CardTitle>
          <CardDescription>
            Manage your tenant's subscription plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No plans created yet</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowNewForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Plan
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Subscribers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stripe</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{plan.name}</span>
                          {plan.is_default && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatPrice(plan.price_cents, plan.billing_cycle)}
                      {plan.trial_days > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {plan.trial_days} day trial
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {plan.subscriber_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                        {plan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {plan.stripe_product_id ? (
                        <Badge variant="outline" className="text-green-600">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600">
                          Not Synced
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(plan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSyncStripe(plan.id)}
                          disabled={syncingId === plan.id}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(plan.id)}
                          disabled={plan.subscriber_count > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}