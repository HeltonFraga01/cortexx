/**
 * MessageVariationEditor Component
 * 
 * Editor de mensagens com suporte a variações inline.
 * Sintaxe: Texto1|Texto2|Texto3
 * 
 * Features:
 * - Syntax highlighting para blocos de variação
 * - Validação em tempo real
 * - Feedback visual de erros
 * - Contador de combinações
 * - Tooltips com sugestões
 */

import { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { debounce } from 'lodash';
import { toast } from 'sonner';
import { getCsrfToken } from '@/lib/api';

interface ValidationError {
  type: string;
  message: string;
  blockIndex?: number;
  suggestion?: string;
}

interface ValidationWarning {
  type: string;
  message: string;
  blockIndex?: number;
  suggestion?: string;
}

interface ValidationResult {
  isValid: boolean;
  blocks: {
    index: number;
    variations: string[];
    variationCount: number;
  }[];
  totalCombinations: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: {
    blockCount: number;
    hasStaticText: boolean;
  };
}

interface MessageVariationEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (result: ValidationResult | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCombinations?: boolean;
  apiBaseUrl?: string;
  userToken?: string;
}

export function MessageVariationEditor({
  value,
  onChange,
  onValidationChange,
  label = 'Mensagem',
  placeholder = 'Digite sua mensagem... Use | para criar variações: Olá|Oi|E aí',
  disabled = false,
  className,
  showCombinations = true,
  apiBaseUrl = '/api',
  userToken
}: MessageVariationEditorProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [highlightedText, setHighlightedText] = useState('');

  // Validar template via API
  const validateTemplate = useCallback(async (template: string) => {
    if (!template || template.trim().length === 0) {
      setValidationResult(null);
      if (onValidationChange) onValidationChange(null);
      return;
    }

    setIsValidating(true);

    try {
      // Get CSRF token
      const csrfToken = await getCsrfToken();
      
      const response = await fetch(`${apiBaseUrl}/user/messages/validate-variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken }),
          ...(userToken && { 'token': userToken })
        },
        credentials: 'include',
        body: JSON.stringify({ template })
      });

      const data = await response.json();

      if (data.success && data.data) {
        setValidationResult(data.data);
        if (onValidationChange) onValidationChange(data.data);
      } else {
        setValidationResult(null);
        if (onValidationChange) onValidationChange(null);
      }
    } catch (error: any) {
      console.error('Erro ao validar template:', error);
      toast.error('Erro ao validar variações', {
        description: error.message || 'Não foi possível conectar ao servidor'
      });
      setValidationResult(null);
      if (onValidationChange) onValidationChange(null);
    } finally {
      setIsValidating(false);
    }
  }, [apiBaseUrl, userToken, onValidationChange]);

  // Debounce da validação (500ms)
  const debouncedValidate = useCallback(
    debounce((template: string) => validateTemplate(template), 500),
    [validateTemplate]
  );

  // Validar quando o valor mudar
  useEffect(() => {
    debouncedValidate(value);
    
    // Cleanup
    return () => {
      debouncedValidate.cancel();
    };
  }, [value, debouncedValidate]);

  // Aplicar syntax highlighting
  useEffect(() => {
    if (!value) {
      setHighlightedText('');
      return;
    }

    // Destacar blocos de variação com regex
    // Padrão: texto|texto|texto (separado por espaços)
    const highlighted = value.replace(
      /(\S+\|[^\s]+)/g,
      '<span class="variation-block">$1</span>'
    );

    setHighlightedText(highlighted);
  }, [value]);

  // Determinar cor do badge de status
  const getStatusColor = () => {
    if (!validationResult) return 'default';
    if (validationResult.errors.length > 0) return 'destructive';
    if (validationResult.warnings.length > 0) return 'warning';
    return 'success';
  };

  // Ícone de status
  const getStatusIcon = () => {
    if (isValidating) return <Sparkles className="h-3 w-3 animate-spin" />;
    if (!validationResult) return null;
    if (validationResult.errors.length > 0) return <AlertCircle className="h-3 w-3" />;
    if (validationResult.warnings.length > 0) return <Info className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label e contador de combinações */}
      <div className="flex items-center justify-between">
        <Label htmlFor="message-editor" className="flex items-center gap-2">
          {label}
          {validationResult && validationResult.blocks.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {validationResult.blocks.length} {validationResult.blocks.length === 1 ? 'bloco' : 'blocos'}
            </Badge>
          )}
        </Label>

        {showCombinations && validationResult && validationResult.totalCombinations > 1 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>{validationResult.totalCombinations} combinações possíveis</span>
          </div>
        )}
      </div>

      {/* Editor de texto */}
      <div className="relative">
        <Textarea
          id="message-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'min-h-[120px] font-mono text-sm',
            validationResult?.errors.length > 0 && 'border-destructive focus-visible:ring-destructive'
          )}
        />

        {/* Badge de status no canto */}
        {(isValidating || validationResult) && (
          <div className="absolute top-2 right-2">
            <Badge variant={getStatusColor()} className="text-xs flex items-center gap-1">
              {getStatusIcon()}
              {isValidating ? 'Validando...' : validationResult?.isValid ? 'Válido' : 'Inválido'}
            </Badge>
          </div>
        )}
      </div>

      {/* Mensagens de erro */}
      {validationResult && validationResult.errors.length > 0 && (
        <div className="space-y-1">
          {validationResult.errors.map((error, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{error.message}</p>
                {error.suggestion && (
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 {error.suggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mensagens de aviso */}
      {validationResult && validationResult.warnings.length > 0 && validationResult.errors.length === 0 && (
        <div className="space-y-1">
          {validationResult.warnings.map((warning, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-sm text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded-md"
            >
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{warning.message}</p>
                {warning.suggestion && (
                  <p className="text-xs opacity-80 mt-1">
                    💡 {warning.suggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Informações sobre blocos */}
      {validationResult && validationResult.blocks.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Blocos de variação encontrados:</p>
          {validationResult.blocks.map((block) => (
            <div key={block.index} className="pl-4">
              <span className="font-mono">Bloco {block.index + 1}:</span>{' '}
              {block.variations.map((v, i) => (
                <span key={i}>
                  <span className="font-medium">{v}</span>
                  {i < block.variations.length - 1 && ' | '}
                </span>
              ))}
              {' '}
              <span className="text-muted-foreground">
                ({block.variationCount} opções)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dica de uso */}
      {!value && (
        <p className="text-xs text-muted-foreground">
          💡 Use o caractere <code className="px-1 py-0.5 bg-muted rounded">|</code> para criar variações.
          Exemplo: <code className="px-1 py-0.5 bg-muted rounded">Olá|Oi|E aí</code>
        </p>
      )}
    </div>
  );
}

export default MessageVariationEditor;
