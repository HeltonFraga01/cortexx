import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface CustomHtmlErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface CustomHtmlErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * CustomHtmlErrorBoundary - Error Boundary para capturar erros de renderização do HTML personalizado
 * 
 * Captura erros de renderização e mostra uma UI de fallback com mensagem de erro e botão de reload.
 * 
 * @example
 * <CustomHtmlErrorBoundary onError={(error) => console.error(error)}>
 *   <CustomHtmlRenderer html={html} />
 * </CustomHtmlErrorBoundary>
 */
class CustomHtmlErrorBoundary extends Component<
  CustomHtmlErrorBoundaryProps,
  CustomHtmlErrorBoundaryState
> {
  constructor(props: CustomHtmlErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): CustomHtmlErrorBoundaryState {
    // Atualizar state para mostrar fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log do erro para debugging
    console.error('[CustomHtmlErrorBoundary] Erro capturado:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Chamar callback onError se fornecido
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = (): void => {
    // Resetar state para tentar renderizar novamente
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Se fallback customizado foi fornecido, usar ele
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Caso contrário, mostrar UI de erro padrão
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro ao carregar página personalizada</AlertTitle>
              <AlertDescription className="mt-2 space-y-4">
                <p>
                  Ocorreu um erro ao renderizar a página personalizada. 
                  Tente recarregar ou entre em contato com o suporte.
                </p>
                {this.state.error && (
                  <details className="text-xs">
                    <summary className="cursor-pointer hover:underline">
                      Detalhes do erro
                    </summary>
                    <pre className="mt-2 p-2 bg-destructive/10 rounded overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recarregar
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CustomHtmlErrorBoundary;
