import { useRef } from 'react';
import { useBranding } from '@/hooks/useBranding';
import LoginPage from './LoginPage';
import { Loader2 } from 'lucide-react';
import CustomHtmlErrorBoundary from '@/components/shared/CustomHtmlErrorBoundary';
import CustomHtmlLoadingIndicator from '@/components/shared/CustomHtmlLoadingIndicator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

/**
 * PublicHome - Página inicial pública
 * 
 * Se houver HTML customizado configurado, renderiza o HTML customizado.
 * Caso contrário, renderiza a página de login padrão.
 */
const PublicHome = () => {
  const { config: brandingConfig, isLoading } = useBranding();

  // Se ainda está carregando, mostrar loader
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se existe HTML customizado, renderizar ele
  if (brandingConfig.customHomeHtml && brandingConfig.customHomeHtml.trim()) {
    return <CustomHtmlRenderer html={brandingConfig.customHomeHtml} />;
  }

  // Caso contrário, renderizar página de login padrão
  return <LoginPage />;
};

/**
 * CustomHtmlRenderState - Estado de renderização do HTML customizado
 */
interface CustomHtmlRenderState {
  status: 'loading' | 'ready' | 'error' | 'timeout';
  error: Error | null;
  loadTime: number | null;
  resourcesLoaded: number;
  resourcesFailed: number;
}

/**
 * CustomHtmlRenderer - Renderiza HTML customizado em um iframe fullscreen
 */
const CustomHtmlRenderer = ({ html }: { html: string }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const resourcesLoadedRef = useRef<number>(0);
  const resourcesFailedRef = useRef<number>(0);
  const statusRef = useRef<'loading' | 'ready' | 'error' | 'timeout'>('loading');
  const [showFallback, setShowFallback] = useState(false);
  
  const [renderState, setRenderState] = useState<CustomHtmlRenderState>({
    status: 'loading',
    error: null,
    loadTime: null,
    resourcesLoaded: 0,
    resourcesFailed: 0,
  });

  // Manter ref sincronizada com o estado
  useEffect(() => {
    statusRef.current = renderState.status;
  }, [renderState.status]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    resourcesLoadedRef.current = 0;
    resourcesFailedRef.current = 0;
    statusRef.current = 'loading';
    
    console.log('[CustomHtmlRenderer] Iniciando carregamento de HTML personalizado...');
    console.log('[CustomHtmlRenderer] Tamanho do HTML:', html.length, 'bytes');
    
    setRenderState({ 
      status: 'loading', 
      error: null, 
      loadTime: null,
      resourcesLoaded: 0,
      resourcesFailed: 0,
    });

    // Configurar timeout de 30 segundos (aumentado para páginas com muitos recursos)
    timeoutRef.current = setTimeout(() => {
      // Usar ref para verificar status atual (evita problema de closure)
      if (statusRef.current === 'loading') {
        const elapsed = Date.now() - startTimeRef.current;
        console.error('[CustomHtmlRenderer] Timeout: HTML demorou mais de 30 segundos para carregar');
        console.error('[CustomHtmlRenderer] Tempo decorrido:', elapsed, 'ms');
        console.error('[CustomHtmlRenderer] Recursos carregados:', resourcesLoadedRef.current);
        console.error('[CustomHtmlRenderer] Recursos falhados:', resourcesFailedRef.current);
        
        setRenderState({
          status: 'timeout',
          error: new Error('Timeout ao carregar HTML personalizado'),
          loadTime: null,
          resourcesLoaded: resourcesLoadedRef.current,
          resourcesFailed: resourcesFailedRef.current,
        });
      }
    }, 30000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [html]);

  // Handler para quando o iframe carregar
  const handleIframeLoad = () => {
    const loadTime = Date.now() - startTimeRef.current;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    console.log(`[CustomHtmlRenderer] ✅ HTML carregado com sucesso em ${loadTime}ms`);
    console.log(`[CustomHtmlRenderer] 📊 Recursos carregados: ${resourcesLoadedRef.current}`);
    console.log(`[CustomHtmlRenderer] ❌ Recursos falhados: ${resourcesFailedRef.current}`);
    console.log(`[CustomHtmlRenderer] 🎉 Todos os recursos foram processados`);
    
    statusRef.current = 'ready';
    setRenderState({
      status: 'ready',
      error: null,
      loadTime,
      resourcesLoaded: resourcesLoadedRef.current,
      resourcesFailed: resourcesFailedRef.current,
    });
  };

  // Handler para erros no iframe
  const handleIframeError = (error: Error) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const elapsed = Date.now() - startTimeRef.current;
    console.error('[CustomHtmlRenderer] ❌ Erro ao carregar HTML:', error.message);
    console.error('[CustomHtmlRenderer] Stack trace:', error.stack);
    console.error('[CustomHtmlRenderer] Tempo até erro:', elapsed, 'ms');
    console.error('[CustomHtmlRenderer] Recursos carregados antes do erro:', resourcesLoadedRef.current);
    
    statusRef.current = 'error';
    setRenderState({
      status: 'error',
      error,
      loadTime: null,
      resourcesLoaded: resourcesLoadedRef.current,
      resourcesFailed: resourcesFailedRef.current,
    });
  };

  // Handler para reload
  const handleReload = () => {
    console.log('[CustomHtmlRenderer] 🔄 Recarregando HTML personalizado...');
    setShowFallback(false);
    statusRef.current = 'loading';
    setRenderState({
      status: 'loading',
      error: null,
      loadTime: null,
      resourcesLoaded: 0,
      resourcesFailed: 0,
    });
    
    // Forçar reload do iframe
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
  };

  // Handler para fallback para LoginPage
  const handleFallbackToLogin = () => {
    console.log('[CustomHtmlRenderer] 🏠 Voltando para página de login padrão...');
    setShowFallback(true);
  };

  // Handler de erro do ErrorBoundary
  const handleErrorBoundary = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('[CustomHtmlRenderer] 🔴 Erro capturado pelo ErrorBoundary:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  };

  // Monitorar erros do iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      // Capturar erros e recursos do iframe
      try {
        const iframeWindow = iframe.contentWindow;
        const iframeDocument = iframe.contentDocument;
        
        if (iframeWindow && iframeDocument) {
          // Capturar erros JavaScript do iframe
          iframeWindow.onerror = (message, source, lineno, colno, error) => {
            console.error('[CustomHtmlRenderer] 🔴 Erro JavaScript no iframe:', {
              message,
              source,
              line: lineno,
              column: colno,
              error: error?.message,
              stack: error?.stack,
            });
            // Não mudar o status para error aqui, apenas logar
            return false;
          };

          // Capturar erros de console do iframe
          const originalConsoleError = iframeWindow.console.error;
          iframeWindow.console.error = (...args: unknown[]) => {
            console.error('[CustomHtmlRenderer] 🔴 Console error no iframe:', ...args);
            originalConsoleError.apply(iframeWindow.console, args);
          };

          const originalConsoleWarn = iframeWindow.console.warn;
          iframeWindow.console.warn = (...args: unknown[]) => {
            console.warn('[CustomHtmlRenderer] ⚠️ Console warning no iframe:', ...args);
            originalConsoleWarn.apply(iframeWindow.console, args);
          };

          // Monitorar carregamento de recursos
          const scripts = iframeDocument.querySelectorAll('script[src]');
          const links = iframeDocument.querySelectorAll('link[rel="stylesheet"]');
          const images = iframeDocument.querySelectorAll('img[src]');

          console.log('[CustomHtmlRenderer] 📦 Recursos detectados:');
          console.log(`  - Scripts externos: ${scripts.length}`);
          console.log(`  - Stylesheets: ${links.length}`);
          console.log(`  - Imagens: ${images.length}`);

          // Monitorar scripts
          scripts.forEach((script) => {
            const src = script.getAttribute('src');
            console.log(`[CustomHtmlRenderer] 📜 Carregando script: ${src}`);
            
            script.addEventListener('load', () => {
              resourcesLoadedRef.current++;
              console.log(`[CustomHtmlRenderer] ✅ Script carregado: ${src}`);
            });
            
            script.addEventListener('error', () => {
              resourcesFailedRef.current++;
              console.warn(`[CustomHtmlRenderer] ⚠️ Falha ao carregar script: ${src}`);
            });
          });

          // Monitorar stylesheets
          links.forEach((link) => {
            const href = link.getAttribute('href');
            console.log(`[CustomHtmlRenderer] 🎨 Carregando stylesheet: ${href}`);
            
            link.addEventListener('load', () => {
              resourcesLoadedRef.current++;
              console.log(`[CustomHtmlRenderer] ✅ Stylesheet carregado: ${href}`);
            });
            
            link.addEventListener('error', () => {
              resourcesFailedRef.current++;
              console.warn(`[CustomHtmlRenderer] ⚠️ Falha ao carregar stylesheet: ${href}`);
            });
          });

          // Monitorar imagens
          images.forEach((img) => {
            const src = img.getAttribute('src');
            if (img.complete) {
              resourcesLoadedRef.current++;
            } else {
              img.addEventListener('load', () => {
                resourcesLoadedRef.current++;
              });
              
              img.addEventListener('error', () => {
                resourcesFailedRef.current++;
                console.warn(`[CustomHtmlRenderer] ⚠️ Falha ao carregar imagem: ${src}`);
              });
            }
          });
        }
      } catch (e) {
        console.warn('[CustomHtmlRenderer] ⚠️ Não foi possível acessar iframe window:', e);
      }

      handleIframeLoad();
    };

    const handleError = () => {
      handleIframeError(new Error('Erro ao carregar iframe'));
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [html]); // Adicionar html como dependência para re-registrar listeners quando o HTML mudar

  // Se fallback foi acionado, mostrar LoginPage
  if (showFallback) {
    console.log('[CustomHtmlRenderer] Exibindo fallback: LoginPage');
    return <LoginPage />;
  }

  // Mostrar erro se timeout ou erro crítico
  if (renderState.status === 'timeout' || renderState.status === 'error') {
    console.error('[CustomHtmlRenderer] Falha ao renderizar HTML:', renderState.error);
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {renderState.status === 'timeout' 
                ? 'Tempo limite excedido' 
                : 'Erro ao carregar página'}
            </AlertTitle>
            <AlertDescription className="space-y-4">
              <p>
                {renderState.status === 'timeout'
                  ? 'A página personalizada está demorando mais do que o esperado para carregar.'
                  : 'Ocorreu um erro ao carregar a página personalizada.'}
              </p>
              
              {renderState.error && (
                <details className="text-xs">
                  <summary className="cursor-pointer hover:underline">
                    Detalhes do erro
                  </summary>
                  <pre className="mt-2 p-2 bg-destructive/10 rounded overflow-auto">
                    {renderState.error.message}
                  </pre>
                </details>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Recursos carregados: {renderState.resourcesLoaded}</p>
                <p>Recursos falhados: {renderState.resourcesFailed}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleReload}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recarregar
                </Button>
                <Button
                  onClick={handleFallbackToLogin}
                  variant="default"
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Ir para Login
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Renderizar iframe com ErrorBoundary
  // IMPORTANTE: O iframe DEVE ser renderizado mesmo durante o loading
  // para que o evento onload possa disparar e atualizar o estado
  return (
    <CustomHtmlErrorBoundary onError={handleErrorBoundary}>
      {/* Mostrar loading overlay enquanto carrega */}
      {renderState.status === 'loading' && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-background z-[1000000]"
          style={{ pointerEvents: 'none' }}
        >
          <CustomHtmlLoadingIndicator
            message="Carregando página personalizada..."
            timeout={30000}
            onTimeout={() => {
              if (statusRef.current === 'loading') {
                console.error('[CustomHtmlRenderer] Timeout detectado pelo LoadingIndicator');
                statusRef.current = 'timeout';
                setRenderState({
                  status: 'timeout',
                  error: new Error('Timeout ao carregar HTML personalizado'),
                  loadTime: null,
                  resourcesLoaded: resourcesLoadedRef.current,
                  resourcesFailed: resourcesFailedRef.current,
                });
              }
            }}
          />
        </div>
      )}
      
      {/* O iframe SEMPRE é renderizado para que onload possa disparar */}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation allow-downloads"
        className="fixed inset-0 w-full h-full border-0"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          zIndex: 999999,
          // Esconder iframe enquanto carrega para evitar flash de conteúdo
          opacity: renderState.status === 'ready' ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
        title="Custom Home Page"
        aria-label="Página inicial personalizada"
      />
    </CustomHtmlErrorBoundary>
  );
};

export default PublicHome;
