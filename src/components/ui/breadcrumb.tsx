import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface para um item do breadcrumb
export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
  icon?: React.ReactNode;
}

// Props do componente Breadcrumb
interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
  showHome?: boolean;
}

// Componente principal Breadcrumb
export const Breadcrumb = ({ 
  items, 
  className,
  separator = <ChevronRight className="h-4 w-4 text-muted-foreground" />,
  showHome = true
}: BreadcrumbProps) => {
  // Adicionar item Home se solicitado e não estiver presente
  const breadcrumbItems = showHome && items[0]?.label !== 'Home' 
    ? [{ label: 'Home', href: '/', icon: <Home className="h-4 w-4" /> }, ...items]
    : items;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("flex items-center space-x-1 text-sm", className)}
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const isCurrent = item.current || isLast;

          return (
            <li key={index} className="flex items-center">
              {/* Separador (não mostrar no primeiro item) */}
              {index > 0 && (
                <span className="mx-2" aria-hidden="true">
                  {separator}
                </span>
              )}
              
              {/* Item do breadcrumb */}
              <div className="flex items-center">
                {isCurrent ? (
                  // Item atual (não clicável)
                  <span 
                    className="flex items-center space-x-1 text-foreground font-medium"
                    aria-current="page"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                ) : (
                  // Item clicável
                  <Link
                    to={item.href || '#'}
                    className="flex items-center space-x-1 text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Componente de container para breadcrumb com estilo padrão
export const BreadcrumbContainer = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) => {
  return (
    <div className={cn(
      "flex items-center space-x-4 py-3 px-1 border-b border-border/40 bg-background/50",
      className
    )}>
      {children}
    </div>
  );
};

// Hook para criar breadcrumbs facilmente
export const useBreadcrumb = () => {
  const createBreadcrumb = (items: Omit<BreadcrumbItem, 'current'>[]): BreadcrumbItem[] => {
    return items.map((item, index) => ({
      ...item,
      current: index === items.length - 1
    }));
  };

  return { createBreadcrumb };
};

export default Breadcrumb;