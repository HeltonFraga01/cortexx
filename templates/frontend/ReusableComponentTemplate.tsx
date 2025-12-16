import { ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  // Add your icons here
  Settings,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  Info
} from 'lucide-react';

// TODO: Replace with your actual component props
interface ReusableComponentProps {
  // Basic props
  children?: ReactNode;
  className?: string;
  
  // Styling props
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  
  // Behavior props
  disabled?: boolean;
  loading?: boolean;
  
  // Event handlers
  onClick?: () => void;
  onClose?: () => void;
  
  // Content props
  title?: string;
  description?: string;
  icon?: ReactNode;
  
  // Add your specific props here
  customProp?: string;
}

// Main component with forwardRef for better ref handling
const ReusableComponentTemplate = forwardRef<HTMLDivElement, ReusableComponentProps>(({
  children,
  className,
  variant = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  onClose,
  title,
  description,
  icon,
  customProp,
  ...props
}, ref) => {
  
  // Variant styles
  const variantStyles = {
    default: 'bg-background border-border text-foreground',
    primary: 'bg-primary/10 border-primary/20 text-primary-foreground',
    secondary: 'bg-secondary/10 border-secondary/20 text-secondary-foreground',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
  };

  // Size styles
  const sizeStyles = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-base',
    lg: 'p-6 text-lg'
  };

  // Icon mapping for variants
  const variantIcons = {
    default: <Settings className="h-4 w-4" />,
    primary: <Info className="h-4 w-4" />,
    secondary: <Info className="h-4 w-4" />,
    success: <Check className="h-4 w-4" />,
    warning: <AlertCircle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />
  };

  return (
    <div
      ref={ref}
      className={cn(
        // Base styles
        'rounded-lg border transition-all duration-200',
        
        // Variant styles
        variantStyles[variant],
        
        // Size styles
        sizeStyles[size],
        
        // Interactive styles
        onClick && !disabled && 'cursor-pointer hover:shadow-md hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        loading && 'opacity-75',
        
        // Custom className
        className
      )}
      onClick={!disabled && !loading ? onClick : undefined}
      {...props}
    >
      {/* Header section */}
      {(title || description || onClose) && (
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3">
            {/* Icon */}
            {icon || variantIcons[variant]}
            
            {/* Title and description */}
            <div>
              {title && (
                <h3 className="font-semibold leading-none tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          
          {/* Close button */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Content section */}
      <div className="space-y-3">
        {children}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}
    </div>
  );
});

ReusableComponentTemplate.displayName = 'ReusableComponentTemplate';

// Sub-components for composition pattern
const ComponentHeader = ({ 
  title, 
  description, 
  action,
  className 
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex items-center justify-between', className)}>
    <div>
      <h3 className="font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
);

const ComponentContent = ({ 
  children, 
  className 
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('space-y-3', className)}>
    {children}
  </div>
);

const ComponentFooter = ({ 
  children, 
  className 
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex items-center justify-end space-x-2 pt-3 border-t', className)}>
    {children}
  </div>
);

// List component for displaying collections
interface ListItem {
  id: string;
  title: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
  metadata?: Record<string, any>;
}

const ComponentList = ({ 
  items, 
  onItemClick,
  onItemAction,
  emptyMessage = 'Nenhum item encontrado',
  className 
}: {
  items: ListItem[];
  onItemClick?: (item: ListItem) => void;
  onItemAction?: (item: ListItem, action: string) => void;
  emptyMessage?: string;
  className?: string;
}) => (
  <div className={cn('space-y-2', className)}>
    {items.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p>{emptyMessage}</p>
      </div>
    ) : (
      items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex items-center justify-between p-3 border rounded-lg transition-colors',
            onItemClick && 'cursor-pointer hover:bg-muted/50'
          )}
          onClick={() => onItemClick?.(item)}
        >
          <div className="flex-1">
            <h4 className="font-medium">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {item.status && (
              <Badge variant={
                item.status === 'active' ? 'default' :
                item.status === 'pending' ? 'secondary' : 'outline'
              }>
                {item.status}
              </Badge>
            )}
            
            {onItemAction && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onItemAction(item, 'edit');
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))
    )}
  </div>
);

// Form component for input handling
const ComponentForm = ({ 
  fields, 
  onSubmit,
  onCancel,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  loading = false,
  className 
}: {
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'textarea' | 'select';
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
  }>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  className?: string;
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="block text-sm font-medium mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          
          {field.type === 'textarea' ? (
            <textarea
              id={field.name}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[80px]"
            />
          ) : field.type === 'select' ? (
            <select
              id={field.name}
              name={field.name}
              required={field.required}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="">Selecione...</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              id={field.name}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          )}
        </div>
      ))}
      
      <div className="flex justify-end space-x-2 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

// Export all components
export default ReusableComponentTemplate;
export { 
  ComponentHeader, 
  ComponentContent, 
  ComponentFooter, 
  ComponentList, 
  ComponentForm 
};

// Usage examples (remove in actual implementation):
/*
// Basic usage
<ReusableComponentTemplate
  title="Exemplo de Componente"
  description="Este é um exemplo de como usar o template"
  variant="primary"
  size="md"
>
  <p>Conteúdo do componente aqui</p>
</ReusableComponentTemplate>

// With composition
<ReusableComponentTemplate>
  <ComponentHeader 
    title="Título Customizado"
    description="Descrição customizada"
    action={<Button size="sm">Ação</Button>}
  />
  <ComponentContent>
    <p>Conteúdo principal</p>
  </ComponentContent>
  <ComponentFooter>
    <Button variant="outline">Cancelar</Button>
    <Button>Confirmar</Button>
  </ComponentFooter>
</ReusableComponentTemplate>

// List usage
<ComponentList
  items={[
    { id: '1', title: 'Item 1', description: 'Descrição 1', status: 'active' },
    { id: '2', title: 'Item 2', description: 'Descrição 2', status: 'inactive' }
  ]}
  onItemClick={(item) => console.log('Clicked:', item)}
  onItemAction={(item, action) => console.log('Action:', action, item)}
/>

// Form usage
<ComponentForm
  fields={[
    { name: 'name', label: 'Nome', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'type', label: 'Tipo', type: 'select', options: [
      { value: 'admin', label: 'Administrador' },
      { value: 'user', label: 'Usuário' }
    ]}
  ]}
  onSubmit={(data) => console.log('Form data:', data)}
  onCancel={() => console.log('Cancelled')}
/>
*/