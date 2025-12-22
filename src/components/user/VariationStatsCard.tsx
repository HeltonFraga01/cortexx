/**
 * VariationStatsCard Component
 * 
 * Card inline expansível que exibe estatísticas de uso de variações em campanhas.
 * Mostra distribuição, porcentagens e permite exportação de dados.
 * 
 * Features:
 * - Gráfico de distribuição de variações
 * - Porcentagem e contagem por variação
 * - Expansão inline (sem modal)
 * - Exportação de dados (JSON/CSV)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Loader2,
  TrendingUp,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VariationDistribution {
  variation: string;
  count: number;
  percentage: number;
}

interface BlockStats {
  blockIndex: number;
  variations: VariationDistribution[];
  totalSent: number;
}

interface VariationStats {
  campaignId: string;
  totalMessages: number;
  blocks: {
    blockIndex: number;
    total: number;
    variations: {
      text: string;
      count: number;
      percentage: string;
    }[];
  }[];
  deliveryStats?: {
    sent: number;
    delivered: number;
    read: number;
    deliveryRate: string;
    readRate: string;
  };
  metadata?: {
    calculationTime: number;
    firstSent: string;
    lastSent: string;
  };
}

interface VariationStatsCardProps {
  campaignId: string;
  userToken: string;
  apiBaseUrl?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

export function VariationStatsCard({
  campaignId,
  userToken,
  apiBaseUrl = '/api',
  expanded: controlledExpanded,
  onToggleExpand,
  className
}: VariationStatsCardProps) {
  const [isExpanded, setIsExpanded] = useState(controlledExpanded ?? false);
  const [stats, setStats] = useState<VariationStats | null>(null);
  const [blockStats, setBlockStats] = useState<BlockStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [isExporting, setIsExporting] = useState(false);

  // Controle de expansão
  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const actualExpanded = controlledExpanded ?? isExpanded;

  // Carregar estatísticas
  const loadStats = async () => {
    if (!campaignId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/user/campaigns/${campaignId}/variation-stats`,
        {
          headers: {
            'Content-Type': 'application/json',
            'token': userToken
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VariationStats] API error:', response.status, errorText);
        throw new Error(`Erro ao carregar estatísticas (${response.status})`);
      }

      const data = await response.json();
      console.log('[VariationStats] Data received:', data);

      if (data.success && data.data) {
        setStats(data.data);
        
        // Processar distribuição em formato de blocos
        const blocks: BlockStats[] = [];
        
        // O backend retorna 'blocks' ao invés de 'distribution'
        if (data.data.blocks && Array.isArray(data.data.blocks)) {
          data.data.blocks.forEach((block: any) => {
            // Verificar se block é válido
            if (!block || !Array.isArray(block.variations)) {
              console.warn(`[VariationStats] Invalid block:`, block);
              return;
            }

            const variationList: VariationDistribution[] = block.variations.map((v: any) => ({
              variation: v.text || '',
              count: v.count || 0,
              percentage: parseFloat(v.percentage) || 0
            }));

            blocks.push({
              blockIndex: block.blockIndex,
              variations: variationList,
              totalSent: block.total || 0
            });
          });

          setBlockStats(blocks.sort((a, b) => a.blockIndex - b.blockIndex));
        } else {
          console.warn('[VariationStats] No blocks data available');
          setBlockStats([]);
        }
      } else {
        const errorMsg = data.error || 'Erro ao processar estatísticas';
        setError(errorMsg);
        toast.error('Erro ao carregar estatísticas', {
          description: errorMsg
        });
      }
    } catch (err: any) {
      console.error('Erro ao carregar estatísticas:', err);
      const errorMsg = err.message || 'Erro ao conectar com o servidor';
      setError(errorMsg);
      toast.error('Erro ao carregar estatísticas', {
        description: errorMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar ao expandir
  useEffect(() => {
    if (actualExpanded && !stats) {
      loadStats();
    }
  }, [actualExpanded, campaignId]);

  // Exportar dados
  const handleExport = async () => {
    if (!stats) return;

    setIsExporting(true);

    try {
      const response = await fetch(
        `${apiBaseUrl}/user/campaigns/${campaignId}/variation-stats/export?format=${exportFormat}`,
        {
          headers: {
            'token': userToken
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao exportar dados');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `variation-stats-${campaignId}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Dados exportados com sucesso');
    } catch (err: any) {
      console.error('Erro ao exportar:', err);
      const errorMsg = err.message || 'Erro ao exportar dados';
      setError(errorMsg);
      toast.error('Erro ao exportar', {
        description: errorMsg
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Estatísticas de Variações</CardTitle>
            {stats && (
              <Badge variant="secondary" className="text-xs">
                {stats.totalMessages} enviadas
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleExpand}
            disabled={isLoading}
          >
            {actualExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        <CardDescription className="text-xs">
          Distribuição de variações usadas nesta campanha
        </CardDescription>
      </CardHeader>

      {actualExpanded && (
        <CardContent className="space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando estatísticas...</span>
            </div>
          )}

          {/* Erro */}
          {error && !isLoading && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Estatísticas */}
          {stats && !isLoading && !error && (
            <div className="space-y-6">
              {/* Resumo Geral */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Enviado</p>
                  <p className="text-2xl font-bold">{stats.totalMessages}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Blocos</p>
                  <p className="text-2xl font-bold">{stats.blocks?.length || 0}</p>
                </div>
                {stats.deliveryStats && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Entregues</p>
                      <p className="text-2xl font-bold text-green-600">
                        {stats.deliveryStats.delivered}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.deliveryStats.deliveryRate}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Lidas</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {stats.deliveryStats.read}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.deliveryStats.readRate}%
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Distribuição por Bloco */}
              {blockStats.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Distribuição por Bloco
                    </h4>
                    
                    {/* Exportar */}
                    <div className="flex items-center gap-2">
                      <Select
                        value={exportFormat}
                        onValueChange={(value: 'json' | 'csv') => setExportFormat(value)}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">JSON</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExport}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Download className="h-3 w-3 mr-1" />
                        )}
                        Exportar
                      </Button>
                    </div>
                  </div>

                  {blockStats.map((block) => (
                    <Card key={block.blockIndex} className="bg-muted/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          Bloco {block.blockIndex + 1}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {block.variations.length} variações • {block.totalSent} usos
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {block.variations.map((variation, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium truncate flex-1 mr-2">
                                {variation.variation}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {variation.percentage.toFixed(1)}%
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {variation.count}x
                                </span>
                              </div>
                            </div>
                            <Progress value={variation.percentage} className="h-2" />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Sem variações */}
              {blockStats.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma variação encontrada</p>
                  <p className="text-sm">Esta campanha não utilizou variações de mensagem</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default VariationStatsCard;
