import { useEffect, useRef, useState } from 'react';
import { Loader2, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CustomHtmlLoadingIndicatorProps {
  message?: string;
  timeout?: number;
  onTimeout?: () => void;
}

/**
 * CustomHtmlLoadingIndicator - Indicador de carregamento para HTML personalizado
 * 
 * Mostra um spinner animado enquanto o HTML está sendo carregado.
 * Detecta timeout após o tempo especificado (padrão: 10 segundos).
 * 
 * @example
 * <CustomHtmlLoadingIndicator 
 *   message="Carregando página personalizada..."
 *   timeout={10000}
 *   onTimeout={() => console.log('Timeout!')}
 * />
 */
export default function CustomHtmlLoadingIndicator({
  message = 'Carregando página personalizada...',
  timeout = 10000,
  onTimeout,
}: CustomHtmlLoadingIndicatorProps) {
  const [isTimeout, setIsTimeout] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setIsTimeout(false);
    setElapsedTime(0);

    // Atualizar tempo decorrido a cada 100ms
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(elapsed);
    }, 100);

    // Configurar timeout
    if (timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        console.warn(`[CustomHtmlLoadingIndicator] Timeout após ${timeout}ms`);
        setIsTimeout(true);
        
        if (onTimeout) {
          onTimeout();
        }
      }, timeout);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeout, onTimeout]);

  // Formatar tempo decorrido
  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${seconds}.${milliseconds}s`;
  };

  if (isTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <Clock className="h-4 w-4" />
            <AlertTitle>Tempo limite excedido</AlertTitle>
            <AlertDescription>
              <p>
                A página personalizada está demorando mais do que o esperado para carregar.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Tempo decorrido: {formatElapsedTime(elapsedTime)}
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">
            {formatElapsedTime(elapsedTime)}
          </p>
        </div>
      </div>
    </div>
  );
}
