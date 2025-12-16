import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import { SidebarSupportButton, MobileSupportButton } from '@/components/shared/SupportButton';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  Settings,
  Database,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
  Lock,
  Blocks,
  PanelLeft,
  PanelLeftClose,
  CreditCard,
  FileText,
  ClipboardList,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Navigation item classes following design system (Requirements 1.2, 1.3, 1.4)
const NAV_ITEM_BASE = "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors";
const NAV_ITEM_ACTIVE = "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary";
const NAV_ITEM_INACTIVE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const NAV_ITEM_COLLAPSED = "justify-center";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const brandingConfig = useBrandingConfig();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Overview', href: '/admin', icon: BarChart3 },
    { name: 'Usuários', href: '/admin/users', icon: Users },
    { name: 'Planos', href: '/admin/plans', icon: CreditCard },
    { name: 'Cotas de Bot', href: '/admin/bot-quotas', icon: Bot },
    { name: 'Multi-Usuário', href: '/admin/multi-user', icon: Shield },
    { name: 'Bancos de Dados', href: '/admin/databases', icon: Database },
    { name: 'Page Builder', href: '/admin/page-builder', icon: Blocks },
    { name: 'Permissões de Tabela', href: '/admin/table-permissions', icon: Lock },
    { name: 'Auditoria', href: '/admin/audit', icon: ClipboardList },
    { name: 'Relatórios', href: '/admin/reports', icon: FileText },
    { name: 'Configurações', href: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
        <div className="fixed left-0 top-0 h-full w-64 bg-card border-r">
          {/* Logo area with primary color gradient background (Requirement 1.1) */}
          <div className="p-6 border-b bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {brandingConfig.logoUrl ? (
                  <img 
                    src={brandingConfig.logoUrl} 
                    alt={`${brandingConfig.appName} Logo`}
                    className="h-8 w-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <>
                    <div className="bg-primary rounded-lg p-2">
                      <Shield className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-bold text-foreground">{brandingConfig.appName}</span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Navigation (Requirements 1.2, 1.3, 1.4) */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      NAV_ITEM_BASE,
                      isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:bg-card lg:border-r transition-all duration-300",
        sidebarCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <TooltipProvider delayDuration={0}>
        <div className="flex flex-col h-full">
          {/* Logo area with primary color gradient background (Requirement 1.1) */}
          <div className={cn(
            "border-b flex-shrink-0 bg-gradient-to-br from-primary/10 to-primary/5 transition-all duration-300",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <div className={cn(
              "flex min-w-0 transition-all duration-300",
              sidebarCollapsed ? "flex-col items-center gap-2" : "flex-row items-center justify-between"
            )}>
              <div className={cn(
                "flex items-center min-w-0",
                sidebarCollapsed ? "justify-center" : "space-x-3"
              )}>
                {brandingConfig.logoUrl ? (
                  <img 
                    src={brandingConfig.logoUrl} 
                    alt={`${brandingConfig.appName} Logo`}
                    className={cn(
                      "object-contain flex-shrink-0 transition-all duration-300",
                      sidebarCollapsed ? "h-8 w-8" : "h-8 w-auto"
                    )}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <>
                    <div className="bg-primary rounded-lg p-2 flex-shrink-0">
                      <Shield className="h-5 w-5 text-primary-foreground" />
                    </div>
                    {!sidebarCollapsed && (
                      <span className="text-lg font-bold text-foreground truncate">{brandingConfig.appName}</span>
                    )}
                  </>
                )}
              </div>
              {/* Collapse toggle button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    {sidebarCollapsed ? (
                      <PanelLeft className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          {/* Navigation (Requirements 1.2, 1.3, 1.4) */}
          <nav className={cn(
            "flex-1 overflow-y-auto transition-all duration-300",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return sidebarCollapsed ? (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          NAV_ITEM_BASE,
                          NAV_ITEM_COLLAPSED,
                          isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      NAV_ITEM_BASE,
                      "space-x-3",
                      isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className={cn(
            "border-t transition-all duration-300",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <div className={cn(
              "space-y-3",
              sidebarCollapsed && "flex flex-col items-center"
            )}>
              {!sidebarCollapsed && (
                <div className="text-xs text-muted-foreground">
                  <p>Usuário: {user?.name}</p>
                </div>
              )}
              {!sidebarCollapsed && <SidebarSupportButton />}
              <div className={cn(
                "flex items-center gap-2",
                sidebarCollapsed && "flex-col"
              )}>
                {sidebarCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleLogout}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sair</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex-1"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                )}
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
        </TooltipProvider>
      </div>

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-background border-b lg:hidden">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-2">
              {brandingConfig.logoUrl ? (
                <img 
                  src={brandingConfig.logoUrl} 
                  alt={`${brandingConfig.appName} Logo`}
                  className="h-5 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <h1 className="text-lg font-semibold">{brandingConfig.appName} Admin</h1>
              )}
            </div>
            <div className="flex items-center gap-1">
              <MobileSupportButton />
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6 xl:p-8 w-full">
          <div className="w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;