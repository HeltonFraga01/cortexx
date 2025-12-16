/**
 * TemplateList Component
 * Displays a paginated list of message templates with selection and actions
 * 
 * Requirements: 1.1, 1.5
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom';
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Search,
  FileText,
  Check,
} from 'lucide-react';
import { templateService, CampaignTemplate, PaginatedResult } from '@/services/templateService';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TemplateListProps {
  onSelect?: (template: CampaignTemplate) => void;
  onEdit?: (template: CampaignTemplate) => void;
  selectionMode?: boolean;
  selectedId?: string;
}

export function TemplateList({
  onSelect,
  onEdit,
  selectionMode = false,
  selectedId,
}: TemplateListProps) {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadTemplates = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const result = await templateService.list(page, pagination.limit);
      setTemplates(result.data);
      setPagination(result.pagination);
    } catch (error: any) {
      toast.error('Erro ao carregar templates', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (template: CampaignTemplate) => {
    const confirmed = await confirm({
      title: 'Excluir Template',
      description: `Tem certeza que deseja excluir o template "${template.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await templateService.delete(template.id);
        toast.success('Template excluído com sucesso');
        loadTemplates(pagination.page);
      } catch (error: any) {
        toast.error('Erro ao excluir template', {
          description: error.message,
        });
      }
    }
  };

  const handleSelect = (template: CampaignTemplate) => {
    if (selectionMode && onSelect) {
      onSelect(template);
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return dateString;
    }
  };

  const getPreview = (template: CampaignTemplate) => {
    const content = template.config?.messageContent || '';
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeaderWithIcon
          icon={FileText}
          iconColor="text-purple-500"
          title="Templates de Mensagem"
        />
        <CardContent className="space-y-4">
          <LoadingSkeleton variant="list" count={3} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeaderWithIcon
          icon={FileText}
          iconColor="text-purple-500"
          title="Templates de Mensagem"
        >
          <div className="relative w-64 ml-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeaderWithIcon>
        <CardContent>
          {filteredTemplates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={searchTerm ? 'Nenhum template encontrado' : 'Nenhum template criado ainda'}
              description={searchTerm ? 'Tente uma busca diferente' : 'Crie seu primeiro template para começar'}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectionMode && <TableHead className="w-12" />}
                    <TableHead>Nome</TableHead>
                    <TableHead>Prévia</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow
                      key={template.id}
                      className={
                        selectionMode
                          ? 'cursor-pointer hover:bg-muted/50'
                          : undefined
                      }
                      onClick={() => handleSelect(template)}
                    >
                      {selectionMode && (
                        <TableCell>
                          {selectedId === template.id && (
                            <Badge variant="default" className="h-6 w-6 p-0 flex items-center justify-center">
                              <Check className="h-4 w-4" />
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {template.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {getPreview(template)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(template.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(template);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(template);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {pagination.page} de {pagination.totalPages} ({pagination.total} templates)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadTemplates(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadTemplates(pagination.page + 1)}
                      disabled={!pagination.hasMore}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}

export default TemplateList;
