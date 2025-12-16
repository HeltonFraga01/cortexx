import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { genericTableService, QueryOptions, TableRecord } from '@/services/generic-table';
import { tablePermissionsService, ColumnInfo } from '@/services/table-permissions';
import { cn } from '@/lib/utils';

interface GenericTableViewProps {
  tableName: string;
  userToken: string;
}

interface TablePermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

interface FormData {
  [key: string]: any;
}

export function GenericTableView({ tableName, userToken }: GenericTableViewProps) {
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // State management
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TableRecord[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [permissions, setPermissions] = useState<TablePermissions>({
    canRead: false,
    canWrite: false,
    canDelete: false,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Dialog state
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<TableRecord | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // View mode state (table or card)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Set user token on mount
  useEffect(() => {
    genericTableService.setUserToken(userToken);
  }, [userToken]);

  // Load table schema and initial data
  useEffect(() => {
    loadTableData();
  }, [tableName, currentPage, pageSize, sortBy, sortOrder]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        loadTableData();
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadTableData = async () => {
    setLoading(true);
    try {
      // Load table schema
      const schemaResponse = await tablePermissionsService.getTableSchema(tableName);
      if (schemaResponse.success && schemaResponse.data) {
        setColumns(schemaResponse.data.columns);
      }

      // Build query options
      const options: QueryOptions = {
        page: currentPage,
        limit: pageSize,
      };

      if (sortBy) {
        options.sortBy = sortBy;
        options.sortOrder = sortOrder;
      }

      if (searchTerm) {
        // Apply search term to all text columns
        const textColumns = columns
          .filter(col => col.type.toLowerCase().includes('text') || col.type.toLowerCase().includes('char'))
          .map(col => col.name);
        
        if (textColumns.length > 0) {
          options.filters = {};
          textColumns.forEach(col => {
            options.filters![col] = searchTerm;
          });
        }
      }

      // Query table data
      const response = await genericTableService.queryTable(tableName, options);
      
      if (response.success && response.data) {
        setRecords(response.data.data);
        setTotalRecords(response.data.pagination.total);
        setTotalPages(response.data.pagination.total_pages);
        
        // Infer permissions from successful operations
        setPermissions({
          canRead: true,
          canWrite: true, // Will be validated on actual write attempt
          canDelete: true, // Will be validated on actual delete attempt
        });
      } else {
        handlePermissionError(response.error);
      }
    } catch (error: any) {
      console.error('Error loading table data:', error);
      handlePermissionError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionError = (errorMessage?: string) => {
    if (errorMessage?.includes('PERMISSION_DENIED') || errorMessage?.includes('403')) {
      toast({
        title: 'Acesso Negado',
        description: 'Você não tem permissão para acessar esta tabela.',
        variant: 'destructive',
      });
      setPermissions({
        canRead: false,
        canWrite: false,
        canDelete: false,
      });
    } else {
      toast({
        title: 'Erro',
        description: errorMessage || 'Erro ao carregar dados da tabela',
        variant: 'destructive',
      });
    }
  };

  const handleSort = (columnName: string) => {
    if (sortBy === columnName) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(columnName);
      setSortOrder('ASC');
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1);
  };

  const openCreateDialog = () => {
    if (!permissions.canWrite) {
      toast({
        title: 'Acesso Negado',
        description: 'Você não tem permissão para criar registros.',
        variant: 'destructive',
      });
      return;
    }

    setFormMode('create');
    setEditingRecord(null);
    setFormData({});
    setFormErrors({});
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (record: TableRecord) => {
    if (!permissions.canWrite) {
      toast({
        title: 'Acesso Negado',
        description: 'Você não tem permissão para editar registros.',
        variant: 'destructive',
      });
      return;
    }

    setFormMode('edit');
    setEditingRecord(record);
    setFormData({ ...record });
    setFormErrors({});
    setIsFormDialogOpen(true);
  };

  const closeFormDialog = () => {
    setIsFormDialogOpen(false);
    setFormMode('create');
    setEditingRecord(null);
    setFormData({});
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate required fields
    columns.forEach(col => {
      if (col.not_null && !col.primary_key && col.default_value === null) {
        const value = formData[col.name];
        if (value === null || value === undefined || value === '') {
          errors[col.name] = `${col.name} é obrigatório`;
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: 'Erro de Validação',
        description: 'Por favor, corrija os erros no formulário.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Remove system fields
      const sanitizedData = genericTableService.sanitizeRecordData(formData);

      if (formMode === 'create') {
        const response = await genericTableService.createRecord(tableName, sanitizedData);
        if (response.success) {
          closeFormDialog();
          loadTableData();
        } else if (response.error?.includes('PERMISSION_DENIED')) {
          setPermissions(prev => ({ ...prev, canWrite: false }));
        }
      } else if (formMode === 'edit' && editingRecord) {
        const response = await genericTableService.updateRecord(
          tableName,
          editingRecord.id,
          sanitizedData
        );
        if (response.success) {
          closeFormDialog();
          loadTableData();
        } else if (response.error?.includes('PERMISSION_DENIED')) {
          setPermissions(prev => ({ ...prev, canWrite: false }));
        }
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: TableRecord) => {
    if (!permissions.canDelete) {
      toast({
        title: 'Acesso Negado',
        description: 'Você não tem permissão para deletar registros.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmar Exclusão',
      description: `Tem certeza que deseja excluir o registro #${record.id}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (confirmed) {
      const response = await genericTableService.deleteRecord(tableName, record.id);
      if (response.success) {
        loadTableData();
      } else if (response.error?.includes('PERMISSION_DENIED')) {
        setPermissions(prev => ({ ...prev, canDelete: false }));
      }
    }
  };

  const handleFormFieldChange = (columnName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [columnName]: value,
    }));
    
    // Clear error for this field
    if (formErrors[columnName]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[columnName];
        return newErrors;
      });
    }
  };

  const renderFormField = (column: ColumnInfo) => {
    // Skip primary key and auto-increment fields in create mode
    if (formMode === 'create' && (column.primary_key || column.name.toLowerCase() === 'id')) {
      return null;
    }

    const value = formData[column.name] ?? '';
    const error = formErrors[column.name];
    const isRequired = column.not_null && !column.primary_key && column.default_value === null;

    return (
      <div key={column.name} className="space-y-2">
        <Label htmlFor={`field-${column.name}`}>
          {column.name}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
          <span className="text-xs text-muted-foreground ml-2">({column.type})</span>
        </Label>
        <Input
          id={`field-${column.name}`}
          value={value}
          onChange={(e) => handleFormFieldChange(column.name, e.target.value)}
          placeholder={`Digite ${column.name}`}
          className={cn(error && 'border-red-500')}
        />
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  };

  // Loading state
  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Permission denied state
  if (!permissions.canRead) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Acesso Negado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Você não tem permissão para acessar esta tabela. Entre em contato com o administrador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tableName}</h1>
          <p className="text-muted-foreground">
            {totalRecords} {totalRecords === 1 ? 'registro' : 'registros'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('card')}
              className="rounded-l-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={loadTableData}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          {permissions.canWrite && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Novo Registro</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.name}>
                        <button
                          onClick={() => handleSort(column.name)}
                          className="flex items-center gap-2 hover:text-foreground"
                        >
                          {column.name}
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                      </TableHead>
                    ))}
                    {(permissions.canWrite || permissions.canDelete) && (
                      <TableHead className="text-right">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + (permissions.canWrite || permissions.canDelete ? 1 : 0)}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        {columns.map((column) => (
                          <TableCell key={column.name}>
                            {genericTableService.formatFieldValue(record[column.name])}
                          </TableCell>
                        ))}
                        {(permissions.canWrite || permissions.canDelete) && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {permissions.canWrite && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(record)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {permissions.canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(record)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {records.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Nenhum registro encontrado
                </p>
              </CardContent>
            </Card>
          ) : (
            records.map((record) => (
              <Card key={record.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        Registro #{record.id}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {columns.slice(0, 2).map((col, idx) => (
                          <span key={col.name}>
                            {idx > 0 && ' • '}
                            {genericTableService.formatFieldValue(record[col.name])}
                          </span>
                        ))}
                      </CardDescription>
                    </div>
                    {(permissions.canWrite || permissions.canDelete) && (
                      <div className="flex gap-1">
                        {permissions.canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(record)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(record)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2">
                    {columns.slice(0, 5).map((column) => (
                      <div key={column.name} className="flex justify-between text-sm">
                        <dt className="font-medium text-muted-foreground">
                          {column.name}:
                        </dt>
                        <dd className="text-right truncate ml-2">
                          {genericTableService.formatFieldValue(record[column.name])}
                        </dd>
                      </div>
                    ))}
                    {columns.length > 5 && (
                      <div className="pt-2">
                        <Badge variant="secondary" className="text-xs">
                          +{columns.length - 5} campos
                        </Badge>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {startRecord} a {endRecord} de {totalRecords} registros
                </p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="page-size" className="text-sm">
                    Por página:
                  </Label>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger id="page-size" className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {genericTableService.getPaginationOptions().map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={closeFormDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? 'Novo Registro' : 'Editar Registro'}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? 'Preencha os campos abaixo para criar um novo registro.'
                : 'Modifique os campos abaixo para atualizar o registro.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {columns.map((column) => renderFormField(column))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFormDialog} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleFormSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {formMode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog />
    </div>
  );
}
