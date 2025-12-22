/**
 * VariationPreviewPanel Component
 * 
 * Painel expansível inline para preview de mensagens com variações.
 * Mostra como a mensagem ficará com diferentes combinações de variações.
 * 
 * Features:
 * - Gera múltiplos previews (1-10)
 * - Mostra variações selecionadas
 * - Destaca partes variadas
 * - Expansível/colapsável inline
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getCsrfToken } from '@/lib/api';

interface PreviewSelection {
  blockIndex: number;
  variationIndex: number;
  selected: string;
  totalOptions?: number;
}

interface Preview {
  index: number;
  message: string;
  selections: PreviewSelection[];
  hasVariations: boolean;
  hasVariables: boolean;
}

interface VariationPreviewPanelProps {
  template: string;
  variables?: Record<string, string>;
  count?: number;
  apiBaseUrl?: string;
  userToken?: string;
  className?: string;
  autoExpand?: boolean;
}

export function VariationPreviewPanel({
  template,
  variables = {},
  count = 3,
  apiBaseUrl = '/api',
  userToken,
  className,
  autoExpand = false
}: VariationPreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gerar previews
  const generatePreviews = async () => {
    if (!template || template.trim().length === 0) {
      setError('Template vazio');
      return;
    }

    // Verificar se há variações no template
    if (!template.includes('|')) {
      setError('Nenhuma variação encontrada. Use o formato: Texto1|Texto2|Texto3');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get CSRF token
      const csrfToken = await getCsrfToken();
      
      const response = await fetch(`${apiBaseUrl}/user/messages/preview-variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken }),
          ...(userToken && { 'token': userToken })
        },
        credentials: 'include',
        body: JSON.stringify({
          template,
          variables,
          count
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Erro ao gerar previews');
      }

      const data = await response.json();

      if (data.success && data.data?.previews) {
        setPreviews(data.data.previews);
        setIsExpanded(true);
      } else {
        setError(data.error || data.message || 'Erro ao gerar previews');
        setPreviews([]);
      }
    } catch (err: any) {
      console.error('Erro ao gerar previews:', err);
      const errorMessage = err.message || 'Erro ao conectar com o servidor';
      setError(errorMessage);
      setPreviews([]);
      toast.error('Erro ao gerar preview', {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle expansão
  const toggleExpand = () => {
    if (!isExpanded && previews.length === 0) {
      generatePreviews();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  // Destacar partes variadas na mensagem
  const highlightVariations = (message: string, selections: PreviewSelection[]) => {
    if (selections.length === 0) return message;

    // Criar array de partes da mensagem
    const parts: { text: string; isVariation: boolean }[] = [];
    let lastIndex = 0;

    // Ordenar seleções por posição na mensagem
    const sortedSelections = [...selections].sort((a, b) => {
      const posA = message.indexOf(a.selected, lastIndex);
      const posB = message.indexOf(b.selected, lastIndex);
      return posA - posB;
    });

    sortedSelections.forEach((selection) => {
      const index = message.indexOf(selection.selected, lastIndex);
      
      if (index > lastIndex) {
        // Adicionar texto antes da variação
        parts.push({
          text: message.substring(lastIndex, index),
          isVariation: false
        });
      }

      // Adicionar variação
      parts.push({
        text: selection.selected,
        isVariation: true
      });

      lastIndex = index + selection.selected.length;
    });

    // Adicionar texto restante
    if (lastIndex < message.length) {
      parts.push({
        text: message.substring(lastIndex),
        isVariation: false
      });
    }

    return parts;
  };

  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Preview de Variações</CardTitle>
            {previews.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {previews.length} {previews.length === 1 ? 'preview' : 'previews'}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {previews.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={generatePreviews}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpand}
              disabled={isLoading}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <CardDescription className="text-xs">
          {template.includes('|') 
            ? 'Veja como sua mensagem ficará com diferentes variações'
            : 'Adicione variações usando | para ver o preview (ex: Olá|Oi|E aí)'
          }
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {/* Botão de gerar (quando não há previews) */}
          {previews.length === 0 && !isLoading && !error && (
            <Button
              onClick={generatePreviews}
              className="w-full"
              variant="outline"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Previews
            </Button>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Gerando previews...</span>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Previews */}
          {previews.length > 0 && !isLoading && (
            <div className="space-y-3">
              {previews.map((preview) => {
                const parts = highlightVariations(preview.message, preview.selections);

                return (
                  <Card key={preview.index} className="bg-muted/50">
                    <CardContent className="pt-4 space-y-2">
                      {/* Mensagem com destaque */}
                      <div className="text-sm leading-relaxed">
                        {Array.isArray(parts) ? (
                          parts.map((part, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                part.isVariation && 'bg-primary/20 px-1 rounded font-medium'
                              )}
                            >
                              {part.text}
                            </span>
                          ))
                        ) : (
                          <span>{preview.message}</span>
                        )}
                      </div>

                      {/* Seleções feitas */}
                      {preview.selections.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2 border-t">
                          {preview.selections.map((selection, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              Bloco {selection.blockIndex + 1}: {selection.selected}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Info sobre variáveis */}
          {Object.keys(variables).length > 0 && previews.length > 0 && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <p className="font-medium mb-1">Variáveis aplicadas:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(variables).map(([key, value]) => (
                  <code key={key} className="px-2 py-1 bg-muted rounded text-xs">
                    {`{{${key}}}`} → {value}
                  </code>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default VariationPreviewPanel;
