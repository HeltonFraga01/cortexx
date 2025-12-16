/**
 * MessagingBreadcrumb Component
 * Navigation breadcrumb for messaging modules
 * 
 * Requirements: 5.5
 */

import { useLocation, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home, Send, FileText, Inbox, BarChart3 } from 'lucide-react';

const ROUTES = [
  { path: '/user/mensagens', label: 'Envio', icon: <Send className="h-4 w-4" /> },
  { path: '/user/mensagens/templates', label: 'Templates', icon: <FileText className="h-4 w-4" /> },
  { path: '/user/mensagens/caixa', label: 'Caixa de Saída', icon: <Inbox className="h-4 w-4" /> },
  { path: '/user/mensagens/relatorios', label: 'Relatórios', icon: <BarChart3 className="h-4 w-4" /> },
];

export function MessagingBreadcrumb() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Find current route
  const currentRoute = ROUTES.find((r) => currentPath === r.path || currentPath.startsWith(r.path + '/'));

  if (!currentRoute) return null;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/user" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        
        {currentPath !== '/user/mensagens' && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/user/mensagens" className="flex items-center gap-1">
                  <Send className="h-4 w-4" />
                  Mensagens
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        
        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-1">
            {currentRoute.icon}
            {currentRoute.label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default MessagingBreadcrumb;
