import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface para ações do header
interface PageHeaderAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  icon?: React.ReactNode;
  disabled?: boolean;
}

// Interface para badges/status
interface PageHeaderBadge {
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  icon?: React.ReactNode;
}

// Props do componente PageHeader
interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  backButton?: {
    label?: string;
    onClick: () => void;
  };
  actions?: PageHeaderAction[];
  badges?: PageHeaderBadge[];
  children?: React.ReactNode;
  className?: string;
}

// Componente principal PageHeader
export const PageHeader = ({
  title,
  description,
  subtitle,
  backButton,
  actions = [],
  badges = [],
  children,
  className
}: PageHeaderProps) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Linha principal com título e ações */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          {/* Botão de voltar */}
          {backButton && (
            <Button
              onClick={backButton.onClick}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backButton.label || 'Voltar'}
            </Button>
          )}
          
          {/* Título e informações */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold tracking-tight truncate">
                {title}
              </h1>
              
              {/* Badges */}
              {badges.length > 0 && (
                <div className="flex items-center space-x-2 shrink-0">
                  {badges.map((badge, index) => (
                    <Badge key={index} variant={badge.variant} className="flex items-center space-x-1">
                      {badge.icon}
                      <span>{badge.label}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* Subtitle */}
            {subtitle && (
              <p className="text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
            
            {/* Description */}
            {description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>
        
        {/* Ações e children inline */}
        {(actions.length > 0 || children) && (
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.onClick}
                variant={action.variant || 'default'}
                disabled={action.disabled}
                className="flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                {action.icon}
                <span>{action.label}</span>
              </Button>
            ))}
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para seção de informações adicionais
export const PageHeaderInfo = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) => {
  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border",
      className
    )}>
      {children}
    </div>
  );
};

// Componente para item de informação
export const PageHeaderInfoItem = ({
  label,
  value,
  icon,
  className
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center space-x-2">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
};

export default PageHeader;