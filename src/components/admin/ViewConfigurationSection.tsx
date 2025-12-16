import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Columns3, AlertCircle } from 'lucide-react';
import { ViewConfiguration, NocoDBColumn, EditThemeConfig } from '@/lib/types';
import { EditThemeSelector } from '@/components/features/edit-themes/EditThemeSelector';

interface ViewConfigurationSectionProps {
  viewConfig: ViewConfiguration | null;
  columns: NocoDBColumn[];
  onViewConfigChange: (config: ViewConfiguration) => void;
}

export function ViewConfigurationSection({
  viewConfig,
  columns,
  onViewConfigChange,
}: ViewConfigurationSectionProps) {
  // Filtrar colunas de data/datetime para o calendário
  const getDateColumns = (): NocoDBColumn[] => {
    return columns.filter(col => 
      col.uidt === 'Date' || 
      col.uidt === 'DateTime' ||
      col.uidt === 'CreatedTime' ||
      col.uidt === 'LastModifiedTime'
    );
  };

  // Filtrar colunas agrupáveis para o kanban
  const getGroupableColumns = (): NocoDBColumn[] => {
    return columns.filter(col => 
      col.uidt === 'SingleLineText' ||
      col.uidt === 'LongText' ||
      col.uidt === 'SingleSelect' ||
      col.uidt === 'MultiSelect' ||
      col.uidt === 'Checkbox' || // Adicionar suporte para campos booleanos
      col.uidt === 'Number' ||
      col.uidt === 'Decimal' ||
      col.uidt === 'Rating' ||
      col.uidt === 'Percent'
    );
  };

  const dateColumns = getDateColumns();
  const groupableColumns = getGroupableColumns();

  // Handlers para Calendar
  const handleCalendarToggle = (enabled: boolean) => {
    const newConfig: ViewConfiguration = {
      ...viewConfig,
      calendar: {
        enabled,
        dateField: enabled ? viewConfig?.calendar?.dateField : undefined,
      },
    };
    onViewConfigChange(newConfig);
  };

  const handleCalendarDateFieldChange = (fieldName: string) => {
    const newConfig: ViewConfiguration = {
      ...viewConfig,
      calendar: {
        enabled: viewConfig?.calendar?.enabled ?? false,
        dateField: fieldName,
      },
    };
    onViewConfigChange(newConfig);
  };

  // Handlers para Kanban
  const handleKanbanToggle = (enabled: boolean) => {
    const newConfig: ViewConfiguration = {
      ...viewConfig,
      kanban: {
        enabled,
        statusField: enabled ? viewConfig?.kanban?.statusField : undefined,
      },
    };
    onViewConfigChange(newConfig);
  };

  const handleKanbanStatusFieldChange = (fieldName: string) => {
    const newConfig: ViewConfiguration = {
      ...viewConfig,
      kanban: {
        enabled: viewConfig?.kanban?.enabled ?? false,
        statusField: fieldName,
      },
    };
    onViewConfigChange(newConfig);
  };

  // Handler para Edit Theme
  const handleEditThemeChange = (editThemeConfig: EditThemeConfig) => {
    const newConfig: ViewConfiguration = {
      ...viewConfig,
      editTheme: editThemeConfig,
    };
    onViewConfigChange(newConfig);
  };

  // Validação
  const calendarEnabled = viewConfig?.calendar?.enabled ?? false;
  const calendarDateField = viewConfig?.calendar?.dateField;
  const calendarValid = !calendarEnabled || (calendarEnabled && calendarDateField);

  const kanbanEnabled = viewConfig?.kanban?.enabled ?? false;
  const kanbanStatusField = viewConfig?.kanban?.statusField;
  const kanbanValid = !kanbanEnabled || (kanbanEnabled && kanbanStatusField);

  const editThemeEnabled = viewConfig?.editTheme?.enabled ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Columns3 className="h-5 w-5" />
          <span>Configuração de Visualizações</span>
        </CardTitle>
        <CardDescription>
          Configure visualizações avançadas (Calendário e Kanban) para os usuários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seção de Calendário */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <Label htmlFor="calendar-enabled" className="text-base font-semibold">
                  Visualização Calendário
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permite visualizar registros organizados por data
                </p>
              </div>
            </div>
            <Switch
              id="calendar-enabled"
              checked={calendarEnabled}
              onCheckedChange={handleCalendarToggle}
            />
          </div>

          {calendarEnabled && (
            <div className="space-y-3 pl-8">
              {dateColumns.length === 0 ? (
                <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Nenhuma coluna de data encontrada
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      A tabela precisa ter pelo menos uma coluna do tipo Date ou DateTime para usar a visualização de calendário.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="calendar-date-field">
                      Organizar por (Coluna de Data) *
                    </Label>
                    <Select
                      value={calendarDateField || ''}
                      onValueChange={handleCalendarDateFieldChange}
                    >
                      <SelectTrigger id="calendar-date-field">
                        <SelectValue placeholder="Selecione a coluna de data" />
                      </SelectTrigger>
                      <SelectContent>
                        {dateColumns.map((column) => (
                          <SelectItem key={column.id} value={column.column_name}>
                            {column.title} ({column.uidt})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Os registros serão organizados no calendário usando esta coluna de data
                    </p>
                  </div>

                  {!calendarValid && (
                    <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <p className="text-sm text-red-800 dark:text-red-200">
                        Selecione uma coluna de data para habilitar a visualização de calendário
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Seção de Kanban */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Columns3 className="h-5 w-5 text-primary" />
              <div>
                <Label htmlFor="kanban-enabled" className="text-base font-semibold">
                  Visualização Kanban
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permite visualizar registros em colunas por status/etapa
                </p>
              </div>
            </div>
            <Switch
              id="kanban-enabled"
              checked={kanbanEnabled}
              onCheckedChange={handleKanbanToggle}
            />
          </div>

          {kanbanEnabled && (
            <div className="space-y-3 pl-8">
              {groupableColumns.length === 0 ? (
                <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Nenhuma coluna agrupável encontrada
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      A tabela precisa ter pelo menos uma coluna do tipo Text, Select, Checkbox, Number ou Rating para usar a visualização Kanban.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="kanban-status-field">
                      Organizar por (Coluna de Etapas/Status) *
                    </Label>
                    <Select
                      value={kanbanStatusField || ''}
                      onValueChange={handleKanbanStatusFieldChange}
                    >
                      <SelectTrigger id="kanban-status-field">
                        <SelectValue placeholder="Selecione a coluna de status" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupableColumns.map((column) => (
                          <SelectItem key={column.id} value={column.column_name}>
                            {column.title} ({column.uidt})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Os registros serão organizados em colunas baseadas nos valores únicos desta coluna. Suporta: Texto, Seleção, Checkbox (Sim/Não), Número, Rating.
                    </p>
                  </div>

                  {!kanbanValid && (
                    <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <p className="text-sm text-red-800 dark:text-red-200">
                        Selecione uma coluna de status para habilitar a visualização Kanban
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Seção de Tema de Edição */}
        <div className="p-4 border rounded-lg">
          <EditThemeSelector
            config={viewConfig?.editTheme}
            onConfigChange={handleEditThemeChange}
          />
        </div>

        {/* Informações adicionais */}
        {(calendarEnabled || kanbanEnabled || editThemeEnabled) && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              ℹ️ Informações sobre as visualizações:
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              {calendarEnabled && (
                <li>• <strong>Calendário:</strong> Os usuários poderão alternar para a visualização de calendário e ver seus registros organizados por data</li>
              )}
              {kanbanEnabled && (
                <li>• <strong>Kanban:</strong> Os usuários poderão alternar para a visualização Kanban e arrastar cards entre colunas para atualizar o status</li>
              )}
              {editThemeEnabled && (
                <li>• <strong>Tema de Edição:</strong> A página de edição usará o tema personalizado selecionado</li>
              )}
              <li>• A visualização padrão sempre será o <strong>Formulário</strong></li>
              <li>• Os usuários podem alternar entre as visualizações habilitadas usando abas</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
