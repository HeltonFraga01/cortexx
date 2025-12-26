import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatabaseConnection, FieldMapping, ViewConfiguration, databaseConnectionsService } from '@/services/database-connections';
import { adminUsersService, SupabaseUser } from '@/services/admin-users';
import { ViewConfigurationSection } from './ViewConfigurationSection';

import { Loader2, Users, Link2, Table2, Eye, EyeOff, Edit, Lock, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

interface DatabaseAdvancedTabProps {
  formData: Partial<DatabaseConnection>;
  onFormDataChange: (data: Partial<DatabaseConnection>) => void;
}

interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string; // UI Data Type
  dt?: string; // Database Type
}

interface FieldMappingWithOrder extends FieldMapping {
  displayOrder?: number;
}

export function DatabaseAdvancedTab({ formData, onFormDataChange }: DatabaseAdvancedTabProps) {
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [columns, setColumns] = useState<NocoDBColumn[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(formData.assignedUsers || formData.assigned_users || []);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(formData.fieldMappings || formData.field_mappings || []);
  const [viewConfig, setViewConfig] = useState<ViewConfiguration | null>(formData.viewConfiguration || formData.view_configuration || null);

  // Carregar usuários do sistema
  useEffect(() => {
    loadUsers();
  }, []);

  // Carregar colunas quando tiver dados suficientes
  useEffect(() => {
    if (formData.type === 'NOCODB' && formData.host && formData.nocodb_token && 
        (formData.nocodb_table_id || formData.table_name)) {
      loadColumns();
    } else if (formData.type === 'SUPABASE' && formData.supabase_url && formData.supabase_key && 
        (formData.supabase_table || formData.table_name)) {
      loadSupabaseColumns();
    } else if (formData.type === 'POSTGRES' && formData.host && formData.table_name) {
      // Para PostgreSQL, carregar colunas se tiver conexão configurada
      loadPostgresColumns();
    }
  }, [formData.host, formData.nocodb_token, formData.nocodb_table_id, formData.table_name, 
      formData.supabase_url, formData.supabase_key, formData.supabase_table, formData.type]);

  // Sincronizar com formData quando mudar externamente
  useEffect(() => {
    setSelectedUsers(formData.assignedUsers || formData.assigned_users || []);
    setFieldMappings(formData.fieldMappings || formData.field_mappings || []);
    setViewConfig(formData.viewConfiguration || formData.view_configuration || null);
  }, [formData.assignedUsers, formData.assigned_users, formData.fieldMappings, formData.field_mappings, formData.viewConfiguration, formData.view_configuration]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersList = await adminUsersService.listUsers();
      setUsers(usersList);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários do sistema');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadColumns = async () => {
    if (!formData.host || !formData.nocodb_token) return;
    
    const tableId = formData.nocodb_table_id || formData.table_name;
    if (!tableId) return;

    setLoadingColumns(true);
    try {
      const columnsList = await databaseConnectionsService.getNocoDBColumns(
        formData.host,
        formData.nocodb_token,
        tableId
      );
      setColumns(columnsList);

      // Se não há mapeamentos ainda, criar mapeamentos padrão
      if (fieldMappings.length === 0 && columnsList.length > 0) {
        const defaultMappings: FieldMapping[] = columnsList.map((col, index) => ({
          columnName: col.column_name || col.title,
          label: col.title,
          visible: true,
          editable: true,
          displayOrder: index,
        }));
        setFieldMappings(defaultMappings);
        onFormDataChange({
          ...formData,
          fieldMappings: defaultMappings,
        });
      } else if (fieldMappings.length > 0 && columnsList.length > 0) {
        // Sincronizar campos: manter configurações existentes e adicionar novos campos
        const existingColumnNames = new Set(fieldMappings.map(m => m.columnName));
        const newColumns = columnsList.filter(col => !existingColumnNames.has(col.column_name || col.title));
        
        if (newColumns.length > 0) {
          console.log(`🔄 Sincronizando ${newColumns.length} novos campos:`, newColumns.map(c => c.column_name || c.title));
          
          // Adicionar novos campos ao final da lista
          const maxOrder = Math.max(...fieldMappings.map(m => m.displayOrder ?? 0), -1);
          const newMappings: FieldMapping[] = newColumns.map((col, index) => ({
            columnName: col.column_name || col.title,
            label: col.title,
            visible: true,
            editable: true,
            displayOrder: maxOrder + index + 1,
          }));
          
          const updatedMappings = [...fieldMappings, ...newMappings];
          setFieldMappings(updatedMappings);
          onFormDataChange({
            ...formData,
            fieldMappings: updatedMappings,
          });
          
          toast.success(`${newColumns.length} novo(s) campo(s) adicionado(s) ao mapeamento`);
        } else {
          // Garantir que todos os campos tenham displayOrder
          const mappingsWithOrder = fieldMappings.map((mapping, index) => ({
            ...mapping,
            displayOrder: mapping.displayOrder ?? index,
          }));
          if (JSON.stringify(mappingsWithOrder) !== JSON.stringify(fieldMappings)) {
            setFieldMappings(mappingsWithOrder);
            onFormDataChange({
              ...formData,
              fieldMappings: mappingsWithOrder,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar colunas:', error);
      toast.error('Erro ao carregar colunas da tabela');
    } finally {
      setLoadingColumns(false);
    }
  };

  const loadSupabaseColumns = async () => {
    if (!formData.supabase_url || !formData.supabase_key) return;
    
    const tableName = formData.supabase_table || formData.table_name;
    if (!tableName) return;

    setLoadingColumns(true);
    try {
      const columnsList = await databaseConnectionsService.getSupabaseColumnsWithCredentials(
        formData.supabase_url,
        formData.supabase_key,
        formData.supabase_key_type || 'anon',
        tableName
      );
      
      // Converter para formato compatível com NocoDBColumn
      const convertedColumns: NocoDBColumn[] = columnsList.map((col, index) => ({
        id: `col_${index}`,
        title: col.name,
        column_name: col.name,
        uidt: mapSupabaseTypeToNocoDB(col.dataType),
        dt: col.dataType,
      }));
      
      setColumns(convertedColumns);
      updateFieldMappingsFromColumns(convertedColumns);
    } catch (error: any) {
      console.error('Erro ao carregar colunas do Supabase:', error);
      toast.error('Erro ao carregar colunas da tabela');
    } finally {
      setLoadingColumns(false);
    }
  };

  const loadPostgresColumns = async () => {
    // Para PostgreSQL direto, precisaríamos de um endpoint específico
    // Por enquanto, mostrar mensagem informativa
    console.log('PostgreSQL column loading not yet implemented');
  };

  // Mapear tipos do Supabase para tipos do NocoDB (para ícones)
  const mapSupabaseTypeToNocoDB = (dataType: string): string => {
    const typeMap: Record<string, string> = {
      'integer': 'Number',
      'bigint': 'Number',
      'smallint': 'Number',
      'numeric': 'Decimal',
      'real': 'Decimal',
      'double precision': 'Decimal',
      'boolean': 'Checkbox',
      'text': 'LongText',
      'varchar': 'SingleLineText',
      'character varying': 'SingleLineText',
      'uuid': 'SingleLineText',
      'date': 'Date',
      'timestamp': 'DateTime',
      'timestamp with time zone': 'DateTime',
      'timestamp without time zone': 'DateTime',
      'timestamptz': 'DateTime',
      'time': 'Duration',
      'json': 'LongText',
      'jsonb': 'LongText',
      'ARRAY': 'MultiSelect',
    };
    return typeMap[dataType.toLowerCase()] || 'SingleLineText';
  };

  // Função auxiliar para atualizar mapeamentos de campos
  const updateFieldMappingsFromColumns = (columnsList: NocoDBColumn[]) => {
    if (fieldMappings.length === 0 && columnsList.length > 0) {
      const defaultMappings: FieldMapping[] = columnsList.map((col, index) => ({
        columnName: col.column_name || col.title,
        label: col.title,
        visible: true,
        editable: true,
        displayOrder: index,
      }));
      setFieldMappings(defaultMappings);
      onFormDataChange({
        ...formData,
        fieldMappings: defaultMappings,
      });
    } else if (fieldMappings.length > 0 && columnsList.length > 0) {
      const existingColumnNames = new Set(fieldMappings.map(m => m.columnName));
      const newColumns = columnsList.filter(col => !existingColumnNames.has(col.column_name || col.title));
      
      if (newColumns.length > 0) {
        const maxOrder = Math.max(...fieldMappings.map(m => m.displayOrder ?? 0), -1);
        const newMappings: FieldMapping[] = newColumns.map((col, index) => ({
          columnName: col.column_name || col.title,
          label: col.title,
          visible: true,
          editable: true,
          displayOrder: maxOrder + index + 1,
        }));
        
        const updatedMappings = [...fieldMappings, ...newMappings];
        setFieldMappings(updatedMappings);
        onFormDataChange({
          ...formData,
          fieldMappings: updatedMappings,
        });
        
        toast.success(`${newColumns.length} novo(s) campo(s) adicionado(s) ao mapeamento`);
      }
    }
  };

  const handleUserToggle = (userId: string) => {
    const newSelectedUsers = selectedUsers.includes(userId)
      ? selectedUsers.filter(id => id !== userId)
      : [...selectedUsers, userId];
    
    setSelectedUsers(newSelectedUsers);
    onFormDataChange({
      ...formData,
      assignedUsers: newSelectedUsers,
    });
  };

  const handleLinkFieldChange = (fieldName: string) => {
    onFormDataChange({
      ...formData,
      user_link_field: fieldName,
      userLinkField: fieldName,
    });
  };

  const handleFieldMappingChange = (index: number, field: keyof FieldMapping, value: any) => {
    const newMappings = [...fieldMappings];
    newMappings[index] = {
      ...newMappings[index],
      [field]: value,
    };
    
    // Se desmarcar "visible", também desmarcar "editable" e "showInCard"
    if (field === 'visible' && !value) {
      newMappings[index].editable = false;
      newMappings[index].showInCard = false;
    }
    
    setFieldMappings(newMappings);
    onFormDataChange({
      ...formData,
      fieldMappings: newMappings,
    });
  };

  // Função para obter ícone baseado no tipo de campo
  const getFieldTypeIcon = (columnName: string) => {
    const column = columns.find(c => c.column_name === columnName || c.title === columnName);
    if (!column) return '📝'; // Texto padrão
    
    const typeMap: Record<string, string> = {
      'Number': '🔢',
      'Decimal': '🔢',
      'Currency': '💰',
      'Percent': '📊',
      'Duration': '⏱️',
      'Rating': '⭐',
      'Date': '📅',
      'DateTime': '📅',
      'CreatedTime': '📅',
      'LastModifiedTime': '📅',
      'Checkbox': '☑️',
      'SingleSelect': '📋',
      'MultiSelect': '📋',
      'Email': '📧',
      'URL': '🔗',
      'PhoneNumber': '📞',
      'SingleLineText': '📝',
      'LongText': '📄',
      'Attachment': '📎',
      'LinkToAnotherRecord': '🔗',
      'Lookup': '🔍',
      'Rollup': '📊',
      'Formula': '🧮',
      'QrCode': '📱',
      'Barcode': '📱',
      'Button': '🔘',
    };
    
    return typeMap[column.uidt] || '📝';
  };

  // Função para obter descrição do tipo
  const getFieldTypeDescription = (columnName: string) => {
    const column = columns.find(c => c.column_name === columnName || c.title === columnName);
    if (!column) return 'Texto';
    
    const typeDescMap: Record<string, string> = {
      'Number': 'Número',
      'Decimal': 'Decimal',
      'Currency': 'Moeda',
      'Percent': 'Porcentagem',
      'Duration': 'Duração',
      'Rating': 'Avaliação',
      'Date': 'Data',
      'DateTime': 'Data e Hora',
      'CreatedTime': 'Data de Criação',
      'LastModifiedTime': 'Data de Modificação',
      'Checkbox': 'Caixa de Seleção (Sim/Não)',
      'SingleSelect': 'Seleção Única',
      'MultiSelect': 'Seleção Múltipla',
      'Email': 'E-mail',
      'URL': 'Link/URL',
      'PhoneNumber': 'Telefone',
      'SingleLineText': 'Texto Curto',
      'LongText': 'Texto Longo',
      'Attachment': 'Anexo/Arquivo',
      'LinkToAnotherRecord': 'Link para Outro Registro',
      'Lookup': 'Busca',
      'Rollup': 'Agregação',
      'Formula': 'Fórmula',
      'QrCode': 'QR Code',
      'Barcode': 'Código de Barras',
      'Button': 'Botão',
    };
    
    return typeDescMap[column.uidt] || 'Texto';
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newMappings = [...fieldMappings];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newMappings.length) return;
    
    // Trocar posições
    [newMappings[index], newMappings[targetIndex]] = [newMappings[targetIndex], newMappings[index]];
    
    // Atualizar displayOrder
    newMappings.forEach((mapping, idx) => {
      mapping.displayOrder = idx;
    });
    
    setFieldMappings(newMappings);
    onFormDataChange({
      ...formData,
      fieldMappings: newMappings,
    });
  };

  const handleSelectAllUsers = () => {
    const allUserIds = users.map(u => u.id);
    setSelectedUsers(allUserIds);
    onFormDataChange({
      ...formData,
      assignedUsers: allUserIds,
    });
  };

  const handleDeselectAllUsers = () => {
    setSelectedUsers([]);
    onFormDataChange({
      ...formData,
      assignedUsers: [],
    });
  };

  const handleSetAllVisible = (visible: boolean) => {
    const newMappings = fieldMappings.map(m => ({
      ...m,
      visible,
      editable: visible ? m.editable : false,
    }));
    setFieldMappings(newMappings);
    onFormDataChange({
      ...formData,
      fieldMappings: newMappings,
    });
  };

  const handleSetAllEditable = (editable: boolean) => {
    const newMappings = fieldMappings.map(m => ({
      ...m,
      editable: m.visible ? editable : false,
    }));
    setFieldMappings(newMappings);
    onFormDataChange({
      ...formData,
      fieldMappings: newMappings,
    });
  };

  const handleViewConfigChange = (config: ViewConfiguration) => {
    setViewConfig(config);
    onFormDataChange({
      ...formData,
      viewConfiguration: config,
    });
  };

  return (
    <div className="space-y-6">
      {/* Seção 1: Atribuição de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Atribuição de Usuários</span>
          </CardTitle>
          <CardDescription>
            Selecione quais usuários do sistema terão acesso a esta conexão de banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando usuários...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum usuário encontrado no sistema</p>
              <Button variant="outline" size="sm" onClick={loadUsers} className="mt-2">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedUsers.length} de {users.length} usuários selecionados
                </p>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllUsers}>
                    Selecionar Todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAllUsers}>
                    Limpar Seleção
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => handleUserToggle(user.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {user.user_metadata?.name || user.email || 'Sem nome'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email || user.id}
                      </p>
                    </div>
                    {user.email_confirmed_at && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Verificado
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Vínculo de Dados (para NocoDB, Supabase e PostgreSQL) */}
      {(formData.type === 'NOCODB' || formData.type === 'SUPABASE' || formData.type === 'POSTGRES') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link2 className="h-5 w-5" />
              <span>Vínculo de Dados</span>
            </CardTitle>
            <CardDescription>
              Selecione qual coluna será usada para vincular os dados ao usuário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingColumns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando colunas...</span>
              </div>
            ) : columns.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {formData.type === 'NOCODB' 
                    ? 'Configure a conexão NocoDB primeiro para carregar as colunas'
                    : formData.type === 'SUPABASE'
                    ? 'Selecione uma tabela na aba Conexão para carregar as colunas'
                    : 'Configure a conexão PostgreSQL primeiro para carregar as colunas'
                  }
                </p>
                <Button variant="outline" size="sm" onClick={() => {
                  if (formData.type === 'NOCODB') loadColumns();
                  else if (formData.type === 'SUPABASE') loadSupabaseColumns();
                  else loadPostgresColumns();
                }} className="mt-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Carregar
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user_link_field">Campo de Vínculo do Usuário *</Label>
                  <Select 
                    value={formData.user_link_field || formData.userLinkField || ''} 
                    onValueChange={handleLinkFieldChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna de vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.column_name || column.title}>
                          {column.title} ({column.column_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Esta coluna será usada para fazer o WHERE e encontrar a linha específica do usuário
                  </p>
                </div>

                {(formData.user_link_field || formData.userLinkField) && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Exemplo de consulta:</strong><br />
                      WHERE {formData.user_link_field || formData.userLinkField} = '[token_do_usuario]'
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seção 3: Mapeador de Campos (para NocoDB, Supabase e PostgreSQL) */}
      {(formData.type === 'NOCODB' || formData.type === 'SUPABASE' || formData.type === 'POSTGRES') && fieldMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Table2 className="h-5 w-5" />
              <span>Mapeador de Campos</span>
            </CardTitle>
            <CardDescription>
              Configure como cada campo será exibido e editado pelos usuários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {fieldMappings.filter(m => m.visible).length} campos visíveis, {fieldMappings.filter(m => m.editable).length} editáveis
              </p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (formData.type === 'NOCODB') loadColumns();
                    else if (formData.type === 'SUPABASE') loadSupabaseColumns();
                    else loadPostgresColumns();
                  }}
                  disabled={loadingColumns}
                >
                  {loadingColumns ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sincronizar Campos
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSetAllVisible(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Mostrar Todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSetAllVisible(false)}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ocultar Todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSetAllEditable(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Todos Editáveis
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSetAllEditable(false)}>
                  <Lock className="h-4 w-4 mr-2" />
                  Todos Somente Leitura
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-center text-sm font-medium">Ordem</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Tipo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Coluna Original</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Rótulo (Nome Amigável)</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Texto de Ajuda (Descrição)</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Visível</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Editável</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Exibir no Card</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fieldMappings.map((mapping, index) => {
                      const helperTextLength = mapping.helperText?.length || 0;
                      const isHelperTextTooLong = helperTextLength > 500;
                      
                      return (
                        <tr key={mapping.columnName} className="hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveField(index, 'up')}
                                disabled={index === 0}
                                className="h-7 w-7 p-0"
                                title="Mover para cima"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <span className="text-sm font-medium text-muted-foreground min-w-[2ch] text-center">
                                {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveField(index, 'down')}
                                disabled={index === fieldMappings.length - 1}
                                className="h-7 w-7 p-0"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg" title={getFieldTypeDescription(mapping.columnName)}>
                                {getFieldTypeIcon(mapping.columnName)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {getFieldTypeDescription(mapping.columnName)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {mapping.columnName}
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={mapping.label}
                              onChange={(e) => handleFieldMappingChange(index, 'label', e.target.value)}
                              placeholder="Nome que o usuário verá"
                              className="max-w-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <Input
                                value={mapping.helperText || ''}
                                onChange={(e) => handleFieldMappingChange(index, 'helperText', e.target.value)}
                                placeholder="Texto de ajuda para o usuário (opcional)"
                                className={`max-w-md ${isHelperTextTooLong ? 'border-red-500' : ''}`}
                                maxLength={500}
                              />
                              <div className="flex items-center justify-between">
                                <p className={`text-xs ${isHelperTextTooLong ? 'text-red-500' : 'text-muted-foreground'}`}>
                                  {helperTextLength}/500 caracteres
                                </p>
                                {isHelperTextTooLong && (
                                  <p className="text-xs text-red-500">
                                    Limite excedido!
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={mapping.visible}
                              onCheckedChange={(checked) => handleFieldMappingChange(index, 'visible', checked)}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={mapping.editable}
                              onCheckedChange={(checked) => handleFieldMappingChange(index, 'editable', checked)}
                              disabled={!mapping.visible}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={mapping.showInCard ?? false}
                              onCheckedChange={(checked) => handleFieldMappingChange(index, 'showInCard', checked)}
                              disabled={!mapping.visible}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Legenda:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Ordem:</strong> Define a sequência de exibição dos campos no formulário (use as setas para reordenar)</li>
                  <li>• <strong>Tipo:</strong> Indica o tipo de dado do campo (número, texto, data, booleano, etc.)</li>
                  <li>• <strong>Visível:</strong> O usuário poderá ver este campo na página de detalhes</li>
                  <li>• <strong>Editável:</strong> O usuário poderá modificar o valor (requer Visível marcado)</li>
                  <li>• <strong>Exibir no Card:</strong> O campo aparecerá nos cards da visualização Grid/List (requer Visível marcado)</li>
                  <li>• <strong>Texto de Ajuda:</strong> Descrição que aparecerá abaixo do campo para orientar o usuário (máximo 500 caracteres)</li>
                  <li>• <strong>Oculto:</strong> O campo não será exibido para o usuário</li>
                  <li>• <strong>Somente Leitura:</strong> O usuário verá o valor mas não poderá editá-lo</li>
                </ul>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Tipos de Campos Suportados:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>🔢 Número / Decimal</div>
                  <div>💰 Moeda</div>
                  <div>📊 Porcentagem</div>
                  <div>📅 Data / Data e Hora</div>
                  <div>☑️ Caixa de Seleção</div>
                  <div>📋 Seleção Única/Múltipla</div>
                  <div>📧 E-mail</div>
                  <div>🔗 Link/URL</div>
                  <div>📞 Telefone</div>
                  <div>📝 Texto Curto</div>
                  <div>📄 Texto Longo</div>
                  <div>📎 Anexo/Arquivo</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção 4: Configuração de Visualizações (para NocoDB, Supabase e PostgreSQL) */}
      {(formData.type === 'NOCODB' || formData.type === 'SUPABASE' || formData.type === 'POSTGRES') && columns.length > 0 && (
        <ViewConfigurationSection
          viewConfig={viewConfig}
          columns={columns}
          onViewConfigChange={handleViewConfigChange}
        />
      )}

      {/* Mensagem para outros tipos de banco */}
      {formData.type !== 'NOCODB' && formData.type !== 'SUPABASE' && formData.type !== 'POSTGRES' && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              As configurações avançadas de vínculo e mapeamento de campos estão disponíveis para conexões NocoDB, Supabase e PostgreSQL.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
