# Advanced View Builder - Próximos Passos

## 🎯 Resumo Executivo

**Status Atual**: Fundação completa e funcional (43.75% das tarefas)
**Próximo Marco**: Implementar visualizações Calendar e Kanban

## ✅ O Que Já Funciona

1. **Configuração Admin**
   - Helper text configurável (máx 500 chars)
   - Toggle para habilitar Calendar/Kanban
   - Seleção de campos apropriados
   - Validação em tempo real

2. **Experiência do Usuário**
   - Helper text exibido nos formulários
   - Navegação por abas (Form/Calendar/Kanban)
   - Preferências salvas no localStorage
   - Form view totalmente funcional

3. **Backend**
   - API completa com validação
   - Schema do banco atualizado
   - Tipos TypeScript robustos

## 🚀 Guia de Implementação Rápida

### Passo 1: Instalar Dependências

```bash
# Para Calendar View
npm install react-big-calendar date-fns
npm install --save-dev @types/react-big-calendar

# Para Kanban View
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Passo 2: Implementar CalendarView

Criar `src/components/user/CalendarView.tsx`:

```typescript
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  connection: DatabaseConnection;
  records: any[];
  dateField: string;
  onRecordClick: (record: any) => void;
}

export function CalendarView({ connection, records, dateField, onRecordClick }: CalendarViewProps) {
  // Mapear records para eventos
  const events = records.map(record => ({
    id: record.id || record.Id,
    title: getRecordTitle(record, connection.fieldMappings),
    start: new Date(record[dateField]),
    end: new Date(record[dateField]),
    resource: record,
  }));

  return (
    <div className="h-[600px]">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        onSelectEvent={(event) => onRecordClick(event.resource)}
        culture="pt-BR"
      />
    </div>
  );
}

function getRecordTitle(record: any, fieldMappings?: FieldMapping[]): string {
  const cardFields = fieldMappings?.filter(f => f.showInCard) || [];
  if (cardFields.length === 0) return `Registro #${record.id || record.Id}`;
  
  return cardFields
    .map(f => record[f.columnName])
    .filter(Boolean)
    .join(' - ');
}
```

### Passo 3: Implementar KanbanView

Criar `src/components/user/KanbanView.tsx`:

```typescript
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';

interface KanbanViewProps {
  connection: DatabaseConnection;
  records: any[];
  statusField: string;
  onRecordUpdate: (recordId: string, updates: any) => Promise<void>;
}

export function KanbanView({ connection, records, statusField, onRecordUpdate }: KanbanViewProps) {
  // Gerar colunas baseadas em valores únicos
  const columns = generateKanbanColumns(records, statusField);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const recordId = active.id as string;
    const newStatus = over.id as string;

    // Atualização otimista
    await onRecordUpdate(recordId, { [statusField]: newStatus });
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <div key={column.id} className="flex-shrink-0 w-80">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-4">{column.title}</h3>
              <SortableContext items={column.records.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {column.records.map(record => (
                    <KanbanCard
                      key={record.id}
                      record={record}
                      fieldMappings={connection.fieldMappings}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  );
}

function generateKanbanColumns(records: any[], statusField: string): KanbanColumn[] {
  const uniqueStatuses = Array.from(new Set(records.map(r => r[statusField]).filter(Boolean)));
  
  return uniqueStatuses.map(status => ({
    id: status,
    title: status,
    records: records.filter(r => r[statusField] === status),
  }));
}
```

### Passo 4: Integrar no UserDatabaseView

Substituir os placeholders em `UserDatabaseView.tsx`:

```typescript
// Importar componentes
import { CalendarView } from './CalendarView';
import { KanbanView } from './KanbanView';

// Substituir TabsContent do Calendar
<TabsContent value="calendar">
  <CalendarView
    connection={connection}
    records={[record]} // ou buscar múltiplos records
    dateField={viewConfig.calendar.dateField!}
    onRecordClick={(record) => {
      setRecord(record);
      setSelectedView('form');
    }}
  />
</TabsContent>

// Substituir TabsContent do Kanban
<TabsContent value="kanban">
  <KanbanView
    connection={connection}
    records={[record]} // ou buscar múltiplos records
    statusField={viewConfig.kanban.statusField!}
    onRecordUpdate={async (recordId, updates) => {
      await handleSave(); // implementar lógica de update
    }}
  />
</TabsContent>
```

## 📝 Checklist de Implementação

### Calendar View
- [ ] Instalar react-big-calendar e date-fns
- [ ] Criar CalendarView.tsx
- [ ] Implementar mapeamento de records para eventos
- [ ] Adicionar navegação (mês/semana/dia)
- [ ] Implementar click handler
- [ ] Estilizar para tema claro/escuro
- [ ] Testar responsividade

### Kanban View
- [ ] Instalar @dnd-kit
- [ ] Criar KanbanView.tsx
- [ ] Criar KanbanCard.tsx
- [ ] Implementar geração de colunas
- [ ] Implementar drag-and-drop
- [ ] Adicionar atualização otimista
- [ ] Tratar erros de atualização
- [ ] Testar responsividade

### Integração
- [ ] Substituir placeholders no UserDatabaseView
- [ ] Buscar múltiplos records (não apenas um)
- [ ] Implementar modal de edição compartilhado
- [ ] Adicionar refresh após edições
- [ ] Testar navegação entre views

### Polimento
- [ ] Adicionar loading states
- [ ] Implementar tratamento de erros
- [ ] Otimizar performance
- [ ] Adicionar testes
- [ ] Documentar uso

## 🎨 Considerações de Design

### Calendar
- Usar cores do tema para eventos
- Mostrar tooltip com detalhes ao hover
- Permitir criar novos eventos (opcional)
- Suportar eventos de múltiplos dias

### Kanban
- Limitar altura das colunas com scroll
- Mostrar contador de cards por coluna
- Adicionar botão "+" para novos cards
- Animações suaves no drag-and-drop

## 🧪 Testes Recomendados

```typescript
// CalendarView.test.tsx
describe('CalendarView', () => {
  it('should render events from records', () => {});
  it('should call onRecordClick when event is clicked', () => {});
  it('should handle records without date field', () => {});
});

// KanbanView.test.tsx
describe('KanbanView', () => {
  it('should generate columns from unique statuses', () => {});
  it('should update record status on drag', () => {});
  it('should handle drag errors gracefully', () => {});
});
```

## 📚 Recursos Úteis

- [React Big Calendar Docs](https://jquense.github.io/react-big-calendar/)
- [DnD Kit Docs](https://docs.dndkit.com/)
- [Date-fns Docs](https://date-fns.org/)

## 🎯 Critérios de Sucesso

✅ **Mínimo Viável**:
- Calendar exibe eventos corretamente
- Kanban permite arrastar cards
- Ambos permitem editar registros

✅ **Completo**:
- Navegação fluida entre views
- Performance otimizada
- Acessibilidade completa
- Testes automatizados
- Documentação de uso

---

**Tempo Estimado**: 8-12 horas de desenvolvimento
**Prioridade**: Alta (completa a feature principal)
**Complexidade**: Média (bibliotecas bem documentadas)
