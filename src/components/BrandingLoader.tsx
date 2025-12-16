import React from 'react';
import { useBrandingLoading, useBrandingError } from '@/hooks/useBranding';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

interface BrandingLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}

/**
 * Componente que gerencia o estado de carregamento do branding
 * Mostra um loader enquanto a configuração está sendo carregada
 * e opcionalmente mostra erros de carregamento
 */
export const BrandingLoader: React.FC<BrandingLoaderProps> = ({
  children,
  fallback,
  showError = true,
}) => {
  const isLoading = useBrandingLoading();
  const error = useBrandingError();

  // Se está carregando, mostrar fallback ou loader padrão
  if (isLoading) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Carregando configurações...
          </p>
        </div>
      </div>
    );
  }

  // Se há erro e deve mostrar, exibir alerta
  if (error && showError) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar configurações de branding: {error}
          </AlertDescription>
        </Alert>
        {children}
      </div>
    );
  }

  // Renderizar children normalmente
  return <>{children}</>;
};

/**
 * Componente de loading simples para branding
 */
export const SimpleBrandingLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          Carregando...
        </span>
      </div>
    </div>
  );
};

export default BrandingLoader;