import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  UserCog, 
  Palette, 
  CreditCard, 
  Settings,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { TenantAccountsTab } from './TenantAccountsTab';
import { TenantAgentsTab } from './TenantAgentsTab';
import { TenantBrandingTab } from './TenantBrandingTab';
import { TenantPlansTab } from './TenantPlansTab';
import { TenantSettingsTab } from './TenantSettingsTab';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface TenantManagePanelProps {
  tenant: Tenant;
  onClose?: () => void;
}

type TabType = 'accounts' | 'agents' | 'branding' | 'plans' | 'settings';

export function TenantManagePanel({ tenant, onClose }: TenantManagePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('accounts');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 text-white border-0';
      case 'inactive':
        return 'bg-yellow-500 text-white border-0';
      case 'suspended':
        return 'bg-red-500 text-white border-0';
      default:
        return '';
    }
  };

  return (
    <Card className="w-full border-0 shadow-lg">
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">{tenant.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {tenant.subdomain}.cortexx.online
              </p>
            </div>
          </div>
          <Badge className={getStatusColor(tenant.status)}>
            {tenant.status}
          </Badge>
        </div>
        
        {tenant.status !== 'active' && (
          <Alert variant="destructive" className="mt-4 border-red-500/30 bg-red-500/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This tenant is currently {tenant.status}. Some features may be limited.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger 
              value="accounts" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger 
              value="agents" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <UserCog className="h-4 w-4" />
              <span className="hidden sm:inline">Agents</span>
            </TabsTrigger>
            <TabsTrigger 
              value="branding" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger 
              value="plans" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Plans</span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="accounts" className="mt-6">
            <TenantAccountsTab tenantId={tenant.id} />
          </TabsContent>
          
          <TabsContent value="agents" className="mt-6">
            <TenantAgentsTab tenantId={tenant.id} />
          </TabsContent>
          
          <TabsContent value="branding" className="mt-6">
            <TenantBrandingTab tenantId={tenant.id} />
          </TabsContent>
          
          <TabsContent value="plans" className="mt-6">
            <TenantPlansTab tenantId={tenant.id} />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <TenantSettingsTab tenantId={tenant.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default TenantManagePanel;
