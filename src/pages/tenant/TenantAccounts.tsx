import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import { 
  Users, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  MessageSquare, 
  Bot, 
  Inbox, 
  Calendar,
  DollarSign,
  AlertCircle,
  Eye,
  Ban
} from 'lucide-react';

interface Account {
  id: string;
  name: string;
  wuzapi_token: string;
  status: 'active' | 'inactive' | 'suspended';
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
  subscription?: {
    id: string;
    plan_name: string;
    status: 'active' | 'inactive' | 'past_due' | 'canceled';
    current_period_end: string;
  };
  stats: {
    agent_count: number;
    inbox_count: number;
    message_count_today: number;
    message_count_month: number;
    bot_count: number;
    campaign_count: number;
  };
  quota_usage: {
    messages_today: number;
    messages_month: number;
    storage_mb: number;
  };
}

interface AccountFilters {
  search: string;
  status: string;
  subscription_status: string;
  plan_name: string;
}

export function TenantAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AccountFilters>({
    search: '',
    status: 'all',
    subscription_status: 'all',
    plan_name: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadAccounts = async (page = 1) => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== 'all')
        )
      });

      const response = await fetch(`/api/tenant/accounts?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load accounts');
      }

      const data = await response.json();
      
      if (data.success) {
        setAccounts(data.data.accounts || []);
        setTotalPages(data.data.totalPages || 1);
        setTotalCount(data.data.totalCount || 0);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load accounts',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateAccount = async (accountId: string) => {
    try {
      setDeactivatingId(accountId);
      
      const response = await fetch(`/api/tenant/accounts/${accountId}/deactivate`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate account');
      }

      const result = await response.json();
      
      if (result.success) {
        await loadAccounts(currentPage);
        toast({
          title: 'Success',
          description: 'Account deactivated successfully'
        });
      } else {
        throw new Error(result.error || 'Failed to deactivate account');
      }
    } catch (error) {
      console.error('Error deactivating account:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to deactivate account',
        variant: 'destructive'
      });
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleFilterChange = (key: keyof AccountFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
      past_due: 'destructive',
      canceled: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getSubscriptionStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <UserCheck className="h-4 w-4 text-green-500" />;
      case 'past_due':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'canceled':
      case 'inactive':
        return <UserX className="h-4 w-4 text-red-500" />;
      default:
        return <UserX className="h-4 w-4 text-gray-400" />;
    }
  };

  useEffect(() => {
    loadAccounts(currentPage);
  }, [filters]);

  if (isLoading && accounts.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading accounts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Accounts</h1>
          <p className="text-muted-foreground">
            Manage accounts and their subscriptions within your tenant
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Total: {totalCount} accounts
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account Status</label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Subscription Status</label>
              <Select 
                value={filters.subscription_status} 
                onValueChange={(value) => handleFilterChange('subscription_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subscriptions</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Plan</label>
              <Select 
                value={filters.plan_name} 
                onValueChange={(value) => handleFilterChange('plan_name', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {/* Plan options would be populated from API */}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Accounts
          </CardTitle>
          <CardDescription>
            View and manage accounts within your tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No accounts found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <>
                      <TableRow key={account.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{account.name}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {account.wuzapi_token.substring(0, 8)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSubscriptionStatusIcon(account.subscription?.status)}
                            <div>
                              {account.subscription ? (
                                <>
                                  <div className="font-medium">{account.subscription.plan_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {getStatusBadge(account.subscription.status)}
                                  </div>
                                </>
                              ) : (
                                <span className="text-muted-foreground">No subscription</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {account.stats.message_count_today} today
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {account.stats.agent_count} agents
                            </div>
                            <div className="flex items-center gap-1">
                              <Inbox className="h-3 w-3" />
                              {account.stats.inbox_count} inboxes
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(account.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {formatDate(account.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedAccount(
                                expandedAccount === account.id ? null : account.id
                              )}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeactivateAccount(account.id)}
                              disabled={deactivatingId === account.id || account.status !== 'active'}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedAccount === account.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/50 p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Subscription Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  {account.subscription ? (
                                    <>
                                      <div>
                                        <span className="font-medium">Plan:</span> {account.subscription.plan_name}
                                      </div>
                                      <div>
                                        <span className="font-medium">Status:</span> {getStatusBadge(account.subscription.status)}
                                      </div>
                                      <div>
                                        <span className="font-medium">Expires:</span> {formatDate(account.subscription.current_period_end)}
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-muted-foreground">No active subscription</p>
                                  )}
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Usage Statistics</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span>Messages Today:</span>
                                    <span className="font-mono">{account.stats.message_count_today}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Messages This Month:</span>
                                    <span className="font-mono">{account.stats.message_count_month}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Bots:</span>
                                    <span className="font-mono">{account.stats.bot_count}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Campaigns:</span>
                                    <span className="font-mono">{account.stats.campaign_count}</span>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Quota Usage</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span>Messages Today:</span>
                                    <span className="font-mono">{account.quota_usage.messages_today}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Messages This Month:</span>
                                    <span className="font-mono">{account.quota_usage.messages_month}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Storage Used:</span>
                                    <span className="font-mono">{account.quota_usage.storage_mb} MB</span>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadAccounts(currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadAccounts(currentPage + 1)}
                      disabled={currentPage === totalPages || isLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}