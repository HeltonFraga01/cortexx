/**
 * ThemePreview Component
 * 
 * Modal that renders the theme with real or sample data for preview.
 * Supports fetching real records from NocoDB using userToken.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { blockRegistry } from './BlockRegistry';
import type { ThemeBlock } from '@/types/page-builder';
import type { DatabaseConnection, FieldMetadata } from '@/lib/types';
import { Monitor, Smartphone, Tablet, Database, RefreshCw, Loader2, AlertCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axios from 'axios';

interface ThemePreviewProps {
  blocks: ThemeBlock[];
  connection: DatabaseConnection;
  fields: FieldMetadata[];
  onClose: () => void;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';
type DataSource = 'sample' | 'real';

const viewportWidths: Record<ViewportSize, string> = {
  desktop: 'w-full',
  tablet: 'w-[768px]',
  mobile: 'w-[375px]',
};

/**
 * Process blocks to organize children into their parent Row blocks
 */
function processBlocksWithParentRows(blocks: ThemeBlock[]): ThemeBlock[] {
  const rowBlocks = blocks.filter(b => b.type === 'row');
  const blocksWithParent = blocks.filter(b => b.props?.parentRowId);
  
  const processedRows = rowBlocks.map(row => {
    const children = blocksWithParent.filter(b => b.props?.parentRowId === row.id);
    return {
      ...row,
      children: [...(row.children || []), ...children],
    };
  });
  
  const result: ThemeBlock[] = [];
  
  for (const block of blocks) {
    if (block.type === 'row') {
      const processedRow = processedRows.find(r => r.id === block.id);
      if (processedRow) {
        result.push(processedRow);
      }
    } else if (!block.props?.parentRowId) {
      result.push(block);
    }
  }
  
  return result;
}

// Generate sample data based on field metadata
function generateSampleData(fields: FieldMetadata[]): Record<string, any> {
  const data: Record<string, any> = { id: 1 };

  fields.forEach((field) => {
    const { columnName, type, options, label } = field;
    const fieldLabel = label || columnName;
    const lowerName = columnName.toLowerCase();

    const isImageField = lowerName.includes('image') || 
                         lowerName.includes('img') || 
                         lowerName.includes('avatar') || 
                         lowerName.includes('photo') ||
                         lowerName.includes('foto') ||
                         lowerName.includes('picture') ||
                         lowerName.includes('imagem');

    const isUrlField = lowerName.includes('url') || 
                       lowerName.includes('link') || 
                       lowerName.includes('website') ||
                       lowerName.includes('site');

    switch (type) {
      case 'text':
      case 'longText':
      case 'TEXT':
      case 'SingleLineText':
      case 'LongText':
        if (isImageField) {
          data[columnName] = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
        } else if (isUrlField) {
          data[columnName] = 'https://exemplo.com';
        } else {
          data[columnName] = `Exemplo de ${fieldLabel}`;
        }
        break;
      case 'number':
      case 'decimal':
      case 'Number':
      case 'Decimal':
        data[columnName] = 42;
        break;
      case 'currency':
      case 'Currency':
        data[columnName] = 199.99;
        break;
      case 'percent':
      case 'Percent':
        data[columnName] = 75;
        break;
      case 'date':
      case 'datetime':
      case 'Date':
      case 'DateTime':
        data[columnName] = new Date().toISOString();
        break;
      case 'email':
      case 'Email':
        data[columnName] = 'exemplo@email.com';
        break;
      case 'phoneNumber':
      case 'PhoneNumber':
        data[columnName] = '+55 11 99999-9999';
        break;
      case 'url':
      case 'URL':
        if (isImageField) {
          data[columnName] = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
        } else {
          data[columnName] = 'https://exemplo.com';
        }
        break;
      case 'checkbox':
      case 'Checkbox':
        data[columnName] = true;
        break;
      case 'singleSelect':
      case 'SingleSelect':
        data[columnName] = options?.[0]?.title || 'Opção 1';
        break;
      case 'multiSelect':
      case 'MultiSelect':
        data[columnName] = options?.slice(0, 2).map(o => o.title) || ['Opção 1', 'Opção 2'];
        break;
      case 'rating':
      case 'Rating':
        data[columnName] = 4;
        break;
      case 'attachment':
      case 'Attachment':
        data[columnName] = [{ url: 'https://via.placeholder.com/150', title: 'Imagem' }];
        break;
      default:
        if (isImageField) {
          data[columnName] = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
        } else if (isUrlField) {
          data[columnName] = 'https://exemplo.com';
        } else {
          data[columnName] = `Valor de ${fieldLabel}`;
        }
    }
  });

  return data;
}

/**
 * Fetch records from NocoDB using connection details
 */
async function fetchNocoDBRecords(
  connection: DatabaseConnection,
  userLinkField?: string,
  userToken?: string,
  limit: number = 10
): Promise<{ records: Record<string, any>[]; error?: string }> {
  try {
    const baseURL = connection.host;
    const token = connection.nocodb_token || connection.password || '';
    const projectId = connection.nocodb_project_id || connection.database;
    const tableId = connection.nocodb_table_id || connection.table_name;

    const api = axios.create({
      baseURL,
      headers: {
        'xc-token': token,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Build query params
    const params: Record<string, any> = { limit };
    
    // If userLinkField and userToken are provided, filter by user
    if (userLinkField && userToken) {
      params.where = `(${userLinkField},eq,${userToken})`;
    }

    const response = await api.get(
      `/api/v1/db/data/noco/${projectId}/${tableId}`,
      { params }
    );

    const records = response.data?.list || response.data || [];
    return { records: Array.isArray(records) ? records : [] };
  } catch (error: any) {
    console.error('Erro ao buscar registros:', error);
    return { 
      records: [], 
      error: error.response?.data?.message || error.message || 'Erro ao buscar dados' 
    };
  }
}

function BlockRenderer({
  block,
  connection,
  record,
  formData,
  fieldMetadata,
  onRecordChange,
}: {
  block: ThemeBlock;
  connection: DatabaseConnection;
  record: Record<string, any>;
  formData: Record<string, any>;
  fieldMetadata: FieldMetadata[];
  onRecordChange: (data: Record<string, any>) => void;
}) {
  const definition = blockRegistry.get(block.type);

  if (!definition) {
    return (
      <div className="p-4 border border-dashed border-destructive rounded-md">
        <p className="text-sm text-destructive">
          Bloco desconhecido: {block.type}
        </p>
      </div>
    );
  }

  const Component = definition.component;

  return (
    <Component
      block={block}
      connection={connection}
      record={record}
      formData={formData}
      fieldMetadata={fieldMetadata}
      onRecordChange={onRecordChange}
      isPreview={true}
    />
  );
}

export function ThemePreview({
  blocks,
  connection,
  fields,
  onClose,
}: ThemePreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [dataSource, setDataSource] = useState<DataSource>('sample');
  const [userToken, setUserToken] = useState('');
  const [realRecords, setRealRecords] = useState<Record<string, any>[]>([]);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleRecord = useMemo(() => generateSampleData(fields), [fields]);

  // Fetch real records when switching to real data mode
  const fetchRecords = useCallback(async () => {
    if (connection.type !== 'NOCODB') {
      setError('Busca de dados reais só está disponível para conexões NocoDB');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await fetchNocoDBRecords(
      connection,
      connection.user_link_field,
      userToken || undefined,
      25
    );

    if (result.error) {
      setError(result.error);
    } else if (result.records.length === 0) {
      setError('Nenhum registro encontrado');
    } else {
      setRealRecords(result.records);
      setSelectedRecordIndex(0);
    }

    setLoading(false);
  }, [connection, userToken]);

  // Auto-fetch when switching to real data
  useEffect(() => {
    if (dataSource === 'real' && realRecords.length === 0 && !loading && !error) {
      fetchRecords();
    }
  }, [dataSource, realRecords.length, loading, error, fetchRecords]);

  const handleRecordChange = (data: Record<string, any>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  // Get current record based on data source
  const currentRecord = dataSource === 'real' && realRecords.length > 0
    ? realRecords[selectedRecordIndex]
    : sampleRecord;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Preview do Tema</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{blocks.length} blocos</Badge>
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewport('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewport === 'tablet' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none border-x"
                  onClick={() => setViewport('tablet')}
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewport === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewport('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Data Source Controls - Single Row Layout */}
        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Data Source Selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Fonte:</Label>
              <Select value={dataSource} onValueChange={(v) => setDataSource(v as DataSource)}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sample">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" />
                      <span>Exemplo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="real">
                    <div className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5" />
                      <span>NocoDB</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dataSource === 'real' && (
              <>
                {/* Separator */}
                <div className="h-6 w-px bg-border" />

                {/* User Token Input */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="userToken" className="text-sm whitespace-nowrap">
                    Token:
                  </Label>
                  <Input
                    id="userToken"
                    value={userToken}
                    onChange={(e) => setUserToken(e.target.value)}
                    placeholder="userToken (opcional)"
                    className="w-[180px] h-9"
                  />
                </div>

                {/* Record Selector */}
                {realRecords.length > 0 && (
                  <>
                    <div className="h-6 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">Registro:</Label>
                      <Select 
                        value={String(selectedRecordIndex)} 
                        onValueChange={(v) => setSelectedRecordIndex(parseInt(v, 10))}
                      >
                        <SelectTrigger className="w-[200px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {realRecords.map((record, index) => {
                            const displayValue = record.name || record.title || record.nome || 
                                                record.email || record.Id || record.id || 
                                                `Registro ${index + 1}`;
                            return (
                              <SelectItem key={index} value={String(index)}>
                                {displayValue}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Badge variant="secondary" className="text-xs">
                        {realRecords.length}
                      </Badge>
                    </div>
                  </>
                )}

                {/* Fetch Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRecords}
                  disabled={loading}
                  className="h-9"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex-1 bg-muted/30 rounded-lg overflow-hidden">
          <ScrollArea className="h-full">
            <div className="flex justify-center p-4">
              <div
                className={cn(
                  'bg-background rounded-lg shadow-lg transition-all duration-300',
                  viewportWidths[viewport],
                  viewport !== 'desktop' && 'border'
                )}
              >
                <div className="p-4 space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : blocks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Nenhum bloco adicionado</p>
                    </div>
                  ) : (
                    processBlocksWithParentRows(blocks).map((block) => (
                      <BlockRenderer
                        key={block.id}
                        block={block}
                        connection={connection}
                        record={currentRecord}
                        formData={{ ...currentRecord, ...formData }}
                        fieldMetadata={fields}
                        onRecordChange={handleRecordChange}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {dataSource === 'real' && realRecords.length > 0 
              ? `Registro ${selectedRecordIndex + 1}/${realRecords.length}`
              : 'Dados de exemplo'}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
