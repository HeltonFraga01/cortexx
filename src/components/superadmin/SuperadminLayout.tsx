import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import SuperadminErrorBoundary from './SuperadminErrorBoundary';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart3,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Navigation item classes following design system
const NAV_ITEM_BASE = "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors";
const NAV_ITEM_ACTIVE = "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";
const NAV_ITEM_INACTIVE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const NAV_ITEM_COLLAPSED = "justify-center";

interface SuperadminLayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/superadmin/dashboard', icon: BarChart3 },
  { name: 'Tenants', href: '/superadmin/tenants', icon: Building2 },
  { name: 'Settings', href: '/superadmin/settings', icon: Settings },
];

/**
 * SuperadminLayout Component
 * Requirements: 1.1, 1.2, 1.5 - Sidebar navigation with user info
 */
const SuperadminLayout = ({ children }: SuperadminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/superadmin/login');
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
          {/* Logo area */}
          <div className="p-6 border-b bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-2 shadow-lg shadow-orange-500/20">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-foreground">Superadmin</span>
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
          
          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || 
                  (item.href !== '/superadmin/dashboard' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
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
          <div className="border-t p-4">
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <p>Superadmin: {user?.name || user?.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex-1"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:bg-card lg:border-r transition-all duration-300",
        sidebarCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-col h-full">
            {/* Logo area */}
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
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-2 flex-shrink-0 shadow-lg shadow-orange-500/20">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  {!sidebarCollapsed && (
                    <span className="text-lg font-bold text-foreground truncate">Superadmin</span>
                  )}
                </div>
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
                    {sidebarCollapsed ? "Expand menu" : "Collapse menu"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Navigation */}
            <nav className={cn(
              "flex-1 overflow-y-auto transition-all duration-300",
              sidebarCollapsed ? "p-2" : "p-4"
            )}>
              <div className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href || 
                    (item.href !== '/superadmin/dashboard' && location.pathname.startsWith(item.href));
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
                    <p>Superadmin: {user?.name || user?.id}</p>
                  </div>
                )}
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
                      <TooltipContent side="right">Logout</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="flex-1"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
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
        {/* Top bar for mobile */}
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
              <Shield className="h-5 w-5 text-orange-500" />
              <h1 className="text-lg font-semibold">Superadmin</h1>
            </div>
            <div className="flex items-center gap-1">
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
            <SuperadminErrorBoundary>
              {children}
            </SuperadminErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SuperadminLayout;
