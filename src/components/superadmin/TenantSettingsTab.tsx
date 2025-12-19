import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Users, 
  UserCog, 
  Inbox, 
  DollarSign, 
  Download,
  Loader2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface TenantMetrics {
  tenant: {
    id: string;
    subdomain: string;
    name: string;
    status: string;
  };
  metrics: {
    accounts: number;
    agents: number;
    inboxes: number;
    subscriptions: {
      active: number;
      mrr: number;
    };
    usage: {
      messagesLast30Days: number;
    };
  };
  generatedAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  created_at: string;
  superadmins?: {
    email: string;
    name: string;
  };
}

interface TenantSettingsTabProps {
  tenantId: string;
}

export function TenantSettingsTab({ tenantId }: TenantSettingsTabProps) {
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/metrics`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (error) {
      toast.error('Failed to load metrics');
    }
  }, [tenantId]);

  const fetchAuditLog = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/audit-log?limit=10`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to fetch audit log');
      
      const data = await response.json();
      if (data.success) {
        setAuditLog(data.data);
      }
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchAuditLog()]);
      setLoading(false);
    };
    loadData();
  }, [fetchMetrics, fetchAuditLog]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await fetch(
        `/api/superadmin/tenants/${tenantId}/export`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to export data');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant-${tenantId}-export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 rounded-xl bg-muted/30 animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-8 w-8 bg-muted rounded-lg" />
              </div>
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Accounts</p>
                <p className="text-2xl font-bold text-foreground">
                  {metrics?.metrics.accounts || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold text-foreground">
                  {metrics?.metrics.agents || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/20">
                <UserCog className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Inboxes</p>
                <p className="text-2xl font-bold text-foreground">
                  {metrics?.metrics.inboxes || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500/20">
                <Inbox className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(metrics?.metrics.subscriptions?.mrr || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics?.metrics.subscriptions?.active || 0} active
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/20">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Activity in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Messages Sent</p>
              <p className="text-2xl font-bold">
                {metrics?.metrics.usage?.messagesLast30Days?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-500" />
              Data Export
            </CardTitle>
            <CardDescription>Export tenant data as CSV</CardDescription>
          </div>
          <Button 
            onClick={handleExport} 
            disabled={exporting}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Data
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Includes accounts, agents, and usage data in CSV format
          </p>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Recent Activity
          </CardTitle>
          <CardDescription>Recent audit log entries for this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatAction(entry.action)}
                    </TableCell>
                    <TableCell>
                      {entry.resource_type}
                    </TableCell>
                    <TableCell>
                      {entry.superadmins?.name || entry.superadmins?.email || 'System'}
                    </TableCell>
                    <TableCell>
                      {formatDate(entry.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/50 mb-3">
                <FileText className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">No recent activity</p>
              <p className="text-xs mt-1">Activity will appear here as actions are performed</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TenantSettingsTab;
