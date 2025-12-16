import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAgentAuth } from '@/contexts/AgentAuthContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Users,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
  User,
  Inbox,
  PanelLeftClose,
  PanelLeft,
  Circle,
  Send,
  ChevronDown,
  FileText,
  Mail,
  Database,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateAvailability, getAgentDatabaseConnections, getAgentDatabaseData, type AgentDatabaseConnection } from '@/services/agent-auth';

// Navigation item classes following design system
const NAV_ITEM_BASE = "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0";
const NAV_ITEM_ACTIVE = "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary";
const NAV_ITEM_INACTIVE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const NAV_ITEM_COLLAPSED = "justify-center px-2";

interface AgentLayoutProps {
  children: React.ReactNode;
}

const AgentLayout = ({ children }: AgentLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('agent-sidebar-collapsed');
    return saved === 'true';
  });
  const [availability, setAvailability] = useState('offline');
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [databaseConnections, setDatabaseConnections] = useState<AgentDatabaseConnection[]>([]);
  const [loadingDatabaseId, setLoadingDatabaseId] = useState<string | null>(null);
  
  const { agent, account, logout, hasPermission, checkAuth } = useAgentAuth();
  const brandingConfig = useBrandingConfig();
  const location = useLocation();
  const navigate = useNavigate();

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('agent-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Set initial availability from agent data
  useEffect(() => {
    if (agent?.availability) {
      setAvailability(agent.availability);
    }
  }, [agent?.availability]);

  // Load database connections accessible to the agent
  const loadDatabaseConnections = useCallback(async () => {
    try {
      const connections = await getAgentDatabaseConnections();
      console.log('Agent database connections loaded:', connections);
      setDatabaseConnections(connections);
    } catch (error) {
      console.error('Failed to load database connections:', error);
    }
  }, []);

  useEffect(() => {
    if (agent) {
      loadDatabaseConnections();
    }
  }, [agent, loadDatabaseConnections]);

  // Handle database item click - fetch records and navigate based on count
  const handleDatabaseClick = useCallback(async (connection: AgentDatabaseConnection) => {
    // Prevent multiple clicks while loading
    if (loadingDatabaseId) return;
    
    setLoadingDatabaseId(connection.id);
    
    try {
      const records = await getAgentDatabaseData(connection.id);
      
      if (!records || records.length === 0) {
        toast.error('Nenhum registro encontrado', {
          description: 'Entre em contato com o administrador para criar um registro para sua conta'
        });
        return;
      }
      
      // If only one record, navigate directly to edit page
      if (records.length === 1) {
        const recordId = records[0].Id || records[0].id;
        navigate(`/agent/database/${connection.id}/edit/${recordId}`);
      } else {
        // If multiple records, navigate to the listing page
        navigate(`/agent/database/${connection.id}`);
      }
      
      // Close mobile sidebar after navigation
      setSidebarOpen(false);
    } catch (error) {
      console.error('Failed to fetch database records:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          toast.error('Conexão não encontrada', {
            description: 'Esta conexão pode ter sido removida'
          });
        } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
          toast.error('Acesso negado', {
            description: 'Você não tem permissão para acessar esta conexão'
          });
        } else {
          toast.error('Erro ao carregar dados', {
            description: error.message
          });
        }
      } else {
        toast.error('Erro ao carregar dados', {
          description: 'Tente novamente mais tarde'
        });
      }
    } finally {
      setLoadingDatabaseId(null);
    }
  }, [loadingDatabaseId, navigate]);

  const handleAvailabilityChange = async (value: string) => {
    setIsUpdatingAvailability(true);
    try {
      await updateAvailability(value as 'online' | 'busy' | 'offline');
      setAvailability(value);
      // Refresh agent data in context to sync all components
      await checkAuth();
      toast.success('Disponibilidade atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar disponibilidade');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'busy': return 'text-yellow-500';
      case 'offline': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getAvailabilityLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'busy': return 'Ocupado';
      case 'offline': return 'Offline';
      default: return 'Offline';
    }
  };

  // Build database navigation items dynamically
  const databaseNavItems = databaseConnections.length > 0 ? [{
    name: 'Databases',
    href: '/agent/databases',
    icon: Database,
    permission: null,
    isDatabaseMenu: true,
    subItems: databaseConnections.map(conn => ({
      name: conn.name,
      href: `/agent/database/${conn.id}`,
      icon: Database,
      isDatabaseItem: true,
      connection: conn,
    }))
  }] : [];

  // Navigation items with permission checks
  const navigationItems = [
    { name: 'Dashboard', href: '/agent', icon: BarChart3, permission: null },
    { name: 'Contatos', href: '/agent/contacts', icon: Users, permission: 'contacts:view' },
    { name: 'Chat', href: '/agent/chat', icon: MessageSquare, permission: 'conversations:view' },
    { 
      name: 'Mensagens', 
      href: '/agent/messaging', 
      icon: Send, 
      permission: 'messages:send',
      subItems: [
        { name: 'Enviar', href: '/agent/messaging', icon: Send },
        { name: 'Templates', href: '/agent/messaging/templates', icon: FileText },
        { name: 'Caixa de Saída', href: '/agent/messaging/outbox', icon: Mail },
        { name: 'Relatórios', href: '/agent/messaging/reports', icon: BarChart3 },
      ]
    },
    { name: 'Caixas de Entrada', href: '/agent/inboxes', icon: Inbox, permission: 'inboxes:view' },
    ...databaseNavItems,
  ];

  const navigationAfter = [
    { name: 'Perfil', href: '/agent/profile', icon: User, permission: null },
    { name: 'Configurações', href: '/agent/settings', icon: Settings, permission: null },
  ];

  // Filter navigation items based on permissions
  const filteredNavItems = navigationItems.filter(item => 
    item.permission === null || hasPermission(item.permission)
  );

  const filteredNavAfter = navigationAfter.filter(item => 
    item.permission === null || hasPermission(item.permission)
  );

  const handleLogout = async () => {
    await logout();
    navigate('/agent/login');
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
          {/* Logo area */}
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

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto overscroll-contain">
            <div className="space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || 
                  (item.subItems && item.subItems.some(sub => location.pathname === sub.href));
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isExpanded = expandedMenu === item.name || 
                  (item.subItems && item.subItems.some(sub => location.pathname === sub.href));
                
                if (hasSubItems) {
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => setExpandedMenu(expandedMenu === item.name ? null : item.name)}
                        className={cn(
                          NAV_ITEM_BASE,
                          "space-x-3 w-full justify-between",
                          isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                        )}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-4">
                          {item.subItems.map((subItem) => {
                            const SubIcon = subItem.icon;
                            const isDbItem = 'isDatabaseItem' in subItem && subItem.isDatabaseItem;
                            const isLoading = isDbItem && 'connection' in subItem && loadingDatabaseId === subItem.connection?.id;
                            const isDisabled = loadingDatabaseId !== null;
                            
                            // Database items use click handler instead of Link
                            if (isDbItem && 'connection' in subItem && subItem.connection) {
                              return (
                                <button
                                  key={subItem.href}
                                  onClick={() => handleDatabaseClick(subItem.connection!)}
                                  disabled={isDisabled}
                                  className={cn(
                                    NAV_ITEM_BASE,
                                    "text-sm space-x-2 w-full",
                                    isLoading ? "cursor-wait" : "",
                                    isDisabled && !isLoading ? "opacity-50 cursor-not-allowed" : "",
                                    location.pathname === subItem.href ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                                  )}
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                                  ) : (
                                    SubIcon && <SubIcon className="h-4 w-4 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{subItem.name}</span>
                                </button>
                              );
                            }
                            
                            return (
                              <Link
                                key={subItem.href}
                                to={subItem.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                  NAV_ITEM_BASE,
                                  "text-sm space-x-2",
                                  location.pathname === subItem.href ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                                )}
                              >
                                {SubIcon && <SubIcon className="h-4 w-4 flex-shrink-0" />}
                                <span>{subItem.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                
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
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
              
              {filteredNavAfter.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
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
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t p-4 flex-shrink-0">
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground min-w-0">
                <p className="truncate font-medium">{agent?.name}</p>
                <p className="truncate">{account?.name}</p>
              </div>
              
              {/* Availability selector */}
              <Select 
                value={availability} 
                onValueChange={handleAvailabilityChange}
                disabled={isUpdatingAvailability}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <Circle className={`h-3 w-3 fill-current ${getAvailabilityColor(availability)}`} />
                      {getAvailabilityLabel(availability)}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 fill-current text-green-500" />
                      Online
                    </div>
                  </SelectItem>
                  <SelectItem value="busy">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 fill-current text-yellow-500" />
                      Ocupado
                    </div>
                  </SelectItem>
                  <SelectItem value="offline">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 fill-current text-gray-500" />
                      Offline
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

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
          
          {/* Navigation */}
          <nav className={cn(
            "flex-1 overflow-y-auto overscroll-contain transition-all duration-300",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <div className="space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || 
                  (item.subItems && item.subItems.some(sub => location.pathname === sub.href));
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isExpanded = expandedMenu === item.name || 
                  (item.subItems && item.subItems.some(sub => location.pathname === sub.href));
                
                if (sidebarCollapsed) {
                  return (
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
                  );
                }
                
                if (hasSubItems) {
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => setExpandedMenu(expandedMenu === item.name ? null : item.name)}
                        className={cn(
                          NAV_ITEM_BASE,
                          "space-x-3 w-full justify-between",
                          isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                        )}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-4">
                          {item.subItems.map((subItem) => {
                            const SubIcon = subItem.icon;
                            const isDbItem = 'isDatabaseItem' in subItem && subItem.isDatabaseItem;
                            const isLoading = isDbItem && 'connection' in subItem && loadingDatabaseId === subItem.connection?.id;
                            const isDisabled = loadingDatabaseId !== null;
                            
                            // Database items use click handler instead of Link
                            if (isDbItem && 'connection' in subItem && subItem.connection) {
                              return (
                                <button
                                  key={subItem.href}
                                  onClick={() => handleDatabaseClick(subItem.connection!)}
                                  disabled={isDisabled}
                                  className={cn(
                                    NAV_ITEM_BASE,
                                    "text-sm space-x-2 w-full",
                                    isLoading ? "cursor-wait" : "",
                                    isDisabled && !isLoading ? "opacity-50 cursor-not-allowed" : "",
                                    location.pathname === subItem.href ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                                  )}
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                                  ) : (
                                    SubIcon && <SubIcon className="h-4 w-4 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{subItem.name}</span>
                                </button>
                              );
                            }
                            
                            return (
                              <Link
                                key={subItem.href}
                                to={subItem.href}
                                className={cn(
                                  NAV_ITEM_BASE,
                                  "text-sm space-x-2",
                                  location.pathname === subItem.href ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE
                                )}
                              >
                                {SubIcon && <SubIcon className="h-4 w-4 flex-shrink-0" />}
                                <span>{subItem.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                
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
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
              
              {filteredNavAfter.map((item) => {
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
                <>
                  <div className="text-xs text-muted-foreground min-w-0">
                    <p className="truncate font-medium">{agent?.name}</p>
                    <p className="truncate">{account?.name}</p>
                  </div>
                  
                  {/* Availability selector */}
                  <Select 
                    value={availability} 
                    onValueChange={handleAvailabilityChange}
                    disabled={isUpdatingAvailability}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <Circle className={`h-3 w-3 fill-current ${getAvailabilityColor(availability)}`} />
                          {getAvailabilityLabel(availability)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">
                        <div className="flex items-center gap-2">
                          <Circle className="h-3 w-3 fill-current text-green-500" />
                          Online
                        </div>
                      </SelectItem>
                      <SelectItem value="busy">
                        <div className="flex items-center gap-2">
                          <Circle className="h-3 w-3 fill-current text-yellow-500" />
                          Ocupado
                        </div>
                      </SelectItem>
                      <SelectItem value="offline">
                        <div className="flex items-center gap-2">
                          <Circle className="h-3 w-3 fill-current text-gray-500" />
                          Offline
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              
              {sidebarCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  {/* Availability indicator when collapsed */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2">
                        <Circle className={`h-4 w-4 fill-current ${getAvailabilityColor(availability)}`} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {getAvailabilityLabel(availability)}
                    </TooltipContent>
                  </Tooltip>
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
        {/* Top bar (mobile) */}
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
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;
