import { useState, lazy, Suspense, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import { SidebarSupportButton, MobileSupportButton } from '@/components/shared/SupportButton';
import { UnifiedInboxSelector } from '@/components/shared/UnifiedInboxSelector';
import { ConnectionStatus } from '@/components/shared/ConnectionStatus';
import { useSupabaseInboxOptional } from '@/contexts/SupabaseInboxContext';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MessageSquare,
  Users,
  Settings,
  Database,
  BarChart3,
  LogOut,
  Menu,
  X,
  User,
  ExternalLink,
  FileText,
  Inbox,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Send,
  PanelLeftClose,
  PanelLeft,
  UsersRound,
  UserCog,
  Shield,
  ClipboardList,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Navigation item classes following design system (Requirements 1.2, 1.3, 1.4)
const NAV_ITEM_BASE = "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0";
const NAV_ITEM_ACTIVE = "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary";
const NAV_ITEM_INACTIVE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const NAV_ITEM_COLLAPSED = "justify-center px-2";

// Lazy load DynamicDatabaseItems for better performance
const DynamicDatabaseItems = lazy(() => 
  import('@/components/user/DynamicDatabaseItems').then(module => ({
    default: module.DynamicDatabaseItems
  }))
);

interface UserLayoutProps {
  children: React.ReactNode;
}

interface CustomLink {
  id: number;
  label: string;
  url: string;
  icon: string;
  position: number;
}

const UserLayout = ({ children }: UserLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Persist collapsed state in localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [mensagensExpanded, setMensagensExpanded] = useState(false);
  const [equipeExpanded, setEquipeExpanded] = useState(false);
  const { user, logout } = useAuth();
  const brandingConfig = useBrandingConfig();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Inbox context (optional - may not be available)
  const inboxContext = useSupabaseInboxOptional();

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Auto-expand Mensagens menu when on a mensagens route
  useEffect(() => {
    if (location.pathname.startsWith('/user/mensagens')) {
      setMensagensExpanded(true);
    }
  }, [location.pathname]);

  // Auto-expand Equipe menu when on a multi-user route
  useEffect(() => {
    const equipeRoutes = ['/user/agents', '/user/teams', '/user/inboxes', '/user/roles', '/user/audit'];
    if (equipeRoutes.some(route => location.pathname.startsWith(route))) {
      setEquipeExpanded(true);
    }
  }, [location.pathname]);

  // Itens antes dos bancos dinâmicos
  const navigationBefore = [
    { name: 'Dashboard', href: '/user', icon: BarChart3 },
    { name: 'Contatos', href: '/user/contacts', icon: Users },
    { name: 'Chat', href: '/user/chat', icon: MessageSquare },
  ];

  // Sub-itens do menu Mensagens
  const mensagensSubItems = [
    { name: 'Enviar', href: '/user/mensagens', icon: Send },
    { name: 'Templates', href: '/user/mensagens/templates', icon: FileText },
    { name: 'Caixa de Saída', href: '/user/mensagens/caixa', icon: Inbox },
    { name: 'Relatórios', href: '/user/mensagens/relatorios', icon: BarChart3 },
  ];

  // Sub-itens do menu Equipe (Multi-User)
  const equipeSubItems = [
    { name: 'Agentes', href: '/user/agents', icon: UserCog },
    { name: 'Equipes', href: '/user/teams', icon: UsersRound },
    { name: 'Caixas de Entrada', href: '/user/inboxes', icon: Inbox },
    { name: 'Papéis', href: '/user/roles', icon: Shield },
    { name: 'Auditoria', href: '/user/audit', icon: ClipboardList },
  ];

  // Itens depois dos bancos dinâmicos e links customizados
  const navigationAfter = [
    { name: 'Revendedor', href: '/user/reseller', icon: Building2 },
    { name: 'Minha Conta', href: '/user/account', icon: User },
    { name: 'Configurações', href: '/user/settings', icon: Settings },
  ];

  useEffect(() => {
    const fetchCustomLinks = async () => {
      try {
        const response = await fetch('/api/custom-links');
        if (response.ok) {
          const data = await response.json();
          setCustomLinks(data.data || []);
        }
      } catch (error) {
        console.error('Erro ao buscar links customizados:', error);
      }
    };

    fetchCustomLinks();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      ExternalLink,
      Database,
      MessageSquare,
      Users,
      Settings,
      BarChart3,
    };
    return icons[iconName] || ExternalLink;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
        <div className="fixed left-0 top-0 h-full w-72 sm:w-80 bg-card border-r flex flex-col">
          {/* Logo area with primary color gradient background (Requirement 1.1) */}
          <div className="p-6 border-b flex-shrink-0 bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                {brandingConfig.logoUrl ? (
                  <img 
                    src={brandingConfig.logoUrl} 
                    alt={`${brandingConfig.appName} Logo`}
                    className="h-8 w-auto object-contain flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <>
                    <div className="bg-primary rounded-lg p-2 flex-shrink-0">
                      <User className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-bold text-foreground truncate">{brandingConfig.appName}</span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Navigation (Requirements 1.2, 1.3, 1.4) */}
          <nav className="flex-1 p-4 overflow-y-auto overscroll-contain">
            <div className="space-y-1">
              {navigationBefore.map((item) => {
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
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}



              {/* Mensagens menu with sub-items */}
              <div>
                <button
                  onClick={() => setMensagensExpanded(!mensagensExpanded)}
                  className={cn(
                    NAV_ITEM_BASE,
                    "w-full justify-between",
                    location.pathname.startsWith('/user/mensagens') ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <Send className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">Mensagens</span>
                  </div>
                  {mensagensExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>
                {mensagensExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {mensagensSubItems.map((item) => {
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
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Equipe (Multi-User) menu with sub-items */}
              <div>
                <button
                  onClick={() => setEquipeExpanded(!equipeExpanded)}
                  className={cn(
                    NAV_ITEM_BASE,
                    "w-full justify-between",
                    ['/user/agents', '/user/teams', '/user/inboxes', '/user/roles', '/user/audit'].some(r => location.pathname.startsWith(r)) ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <UsersRound className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">Equipe</span>
                  </div>
                  {equipeExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>
                {equipeExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {equipeSubItems.map((item) => {
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
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Dynamic database connections */}
              {user?.token && (
                <Suspense fallback={
                  <div className="animate-pulse">
                    <div className="h-10 bg-muted rounded-lg"></div>
                  </div>
                }>
                  <DynamicDatabaseItems 
                    userToken={user.token}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                </Suspense>
              )}
              
              {/* Custom Links */}
              {customLinks.map((link) => {
                const Icon = getIconComponent(link.icon);
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    className={cn(NAV_ITEM_BASE, NAV_ITEM_INACTIVE)}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </a>
                );
              })}
              
              {navigationAfter.map((item) => {
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
                    <span className="truncate">{item.name}</span>
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
                    <div className={cn(
                      "bg-primary rounded-lg flex-shrink-0 transition-all duration-300",
                      sidebarCollapsed ? "p-2" : "p-2"
                    )}>
                      <User className={cn(
                        "text-primary-foreground transition-all duration-300",
                        sidebarCollapsed ? "h-5 w-5" : "h-5 w-5"
                      )} />
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
            "flex-1 overflow-y-auto overscroll-contain transition-all duration-300",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <div className="space-y-1">
              {navigationBefore.map((item) => {
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
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}



              {/* Mensagens menu with sub-items (Desktop) */}
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/user/mensagens"
                      className={cn(
                        NAV_ITEM_BASE,
                        NAV_ITEM_COLLAPSED,
                        location.pathname.startsWith('/user/mensagens') ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                      )}
                    >
                      <Send className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Mensagens
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div>
                  <button
                    onClick={() => setMensagensExpanded(!mensagensExpanded)}
                    className={cn(
                      NAV_ITEM_BASE,
                      "w-full justify-between space-x-3",
                      location.pathname.startsWith('/user/mensagens') ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Send className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">Mensagens</span>
                    </div>
                    {mensagensExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                  {mensagensExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {mensagensSubItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                              NAV_ITEM_BASE,
                              "space-x-3",
                              isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                            )}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate text-sm">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Equipe (Multi-User) menu with sub-items (Desktop) */}
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/user/agents"
                      className={cn(
                        NAV_ITEM_BASE,
                        NAV_ITEM_COLLAPSED,
                        ['/user/agents', '/user/teams', '/user/inboxes', '/user/roles', '/user/audit'].some(r => location.pathname.startsWith(r)) ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                      )}
                    >
                      <UsersRound className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Equipe
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div>
                  <button
                    onClick={() => setEquipeExpanded(!equipeExpanded)}
                    className={cn(
                      NAV_ITEM_BASE,
                      "w-full justify-between space-x-3",
                      ['/user/agents', '/user/teams', '/user/inboxes', '/user/roles', '/user/audit'].some(r => location.pathname.startsWith(r)) ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <UsersRound className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">Equipe</span>
                    </div>
                    {equipeExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                  {equipeExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {equipeSubItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                              NAV_ITEM_BASE,
                              "space-x-3",
                              isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                            )}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate text-sm">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Dynamic database connections - hide when collapsed */}
              {user?.token && !sidebarCollapsed && (
                <Suspense fallback={
                  <div className="animate-pulse">
                    <div className="h-10 bg-muted rounded-lg"></div>
                  </div>
                }>
                  <DynamicDatabaseItems userToken={user.token} />
                </Suspense>
              )}
              
              {/* Custom Links */}
              {customLinks.map((link) => {
                const Icon = getIconComponent(link.icon);
                return sidebarCollapsed ? (
                  <Tooltip key={link.id}>
                    <TooltipTrigger asChild>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(NAV_ITEM_BASE, NAV_ITEM_COLLAPSED, NAV_ITEM_INACTIVE)}
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {link.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(NAV_ITEM_BASE, "space-x-3", NAV_ITEM_INACTIVE)}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </a>
                );
              })}
              
              {navigationAfter.map((item) => {
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
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className={cn(
            "border-t flex-shrink-0 transition-all duration-300",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <div className={cn(
              "space-y-3",
              sidebarCollapsed && "flex flex-col items-center"
            )}>
              {!sidebarCollapsed && (
                <div className="text-xs text-muted-foreground min-w-0">
                  <p className="truncate">Usuário: {user?.name}</p>
                  <p className="truncate">Token: {user?.token.substring(0, 8)}...</p>
                </div>
              )}
              {!sidebarCollapsed && <SidebarSupportButton />}
              {sidebarCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLogout}
                        className="h-9 w-9"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Sair
                    </TooltipContent>
                  </Tooltip>
                  <ThemeToggle />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex-1 min-w-0"
                  >
                    <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Sair</span>
                  </Button>
                  <ThemeToggle />
                </div>
              )}
              

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
                <h1 className="text-lg font-semibold">{brandingConfig.appName}</h1>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Inbox selector and connection status */}
              {inboxContext && inboxContext.context && (
                <>
                  <ConnectionStatus showLabel={false} showReconnect={false} size="sm" />
                  <UnifiedInboxSelector size="sm" variant="ghost" />
                </>
              )}
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

        {/* Desktop top bar with inbox context */}
        <div className="hidden lg:block sticky top-0 z-40 bg-background border-b">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              {/* Inbox selector */}
              {inboxContext && inboxContext.context && (
                <UnifiedInboxSelector variant="outline" size="default" />
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Connection status */}
              {inboxContext && inboxContext.context && (
                <ConnectionStatus showLabel={true} showReconnect={true} size="default" />
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default UserLayout;