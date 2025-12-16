# Design Document

## Overview

Sistema completo de gerenciamento de contatos para o WUZAPI Manager, implementando uma interface inline moderna com filtros avançados, organização por tags e grupos, e integração direta com o disparador de mensagens. O design segue os padrões UX do projeto, evitando modais e priorizando edição inline.

## Architecture

### Frontend Architecture

```
src/
├── pages/
│   └── UserContacts.tsx              # Página principal de contatos
├── components/
│   └── contacts/
│       ├── ContactsTable.tsx         # Tabela virtualizada de contatos
│       ├── ContactsFilters.tsx       # Filtros avançados inline
│       ├── ContactsStats.tsx         # Cards de estatísticas
│       ├── ContactSelection.tsx      # Barra de seleção flutuante
│       ├── ContactTags.tsx           # Gerenciamento de tags
│       ├── ContactGroups.tsx         # Gerenciamento de grupos
│       ├── ContactImportButton.tsx   # Botão de importação
│       └── ContactActions.tsx        # Ações em massa
├── services/
│   ├── contactsService.ts            # Serviço de gerenciamento de contatos
│   └── contactsStorageService.ts     # Persistência local
└── hooks/
    ├── useContacts.ts                # Hook principal de contatos
    ├── useContactFilters.ts          # Hook de filtros
    └── useContactSelection.ts        # Hook de seleção
```

### Backend Architecture

```
server/
├── routes/
│   └── contactsManagementRoutes.js   # Rotas de gerenciamento
├── services/
│   └── ContactsService.js            # Lógica de negócio
└── utils/
    └── contactsCache.js              # Cache de contatos
```

## Components and Interfaces

### 1. UserContacts Page

Página principal de gerenciamento de contatos.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Gerenciamento de Contatos                               │
│ Organize e gerencie seus contatos da agenda WUZAPI      │
├─────────────────────────────────────────────────────────┤
│ [Importar da Agenda] [Exportar CSV] [Novo Grupo]       │
├─────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│ │ Total   │ │ Com     │ │ Sem     │ │ Tags    │       │
│ │ 3,693   │ │ Nome    │ │ Nome    │ │ 12      │       │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────────────────┤
│ Filtros Avançados [Expandir/Recolher]                  │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Buscar: [___________] Tags: [Selecionar▼]          ││
│ │ ☐ Apenas com nome  ☐ Apenas sem nome               ││
│ │ [Limpar Filtros] Mostrando 245 de 3,693 contatos   ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│ ☐ Telefone          Nome              Tags    Ações    │
│ ├─────────────────────────────────────────────────────┤│
│ │☐ (11) 91234-5678  João Silva       [VIP]   [...]   ││
│ │☐ (11) 98765-4321  Maria Santos     [Cliente] [...] ││
│ │☐ (21) 99999-8888  Pedro Oliveira   -        [...]  ││
│ └─────────────────────────────────────────────────────┘│
│ Página 1 de 74 [<] [1][2][3]...[74] [>]               │
└─────────────────────────────────────────────────────────┘

[Barra Flutuante quando há seleção]
┌─────────────────────────────────────────────────────────┐
│ 15 contatos selecionados                                │
│ [Adicionar Tags] [Salvar Grupo] [Enviar Mensagem] [X]  │
└─────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface UserContactsProps {
  // Sem props - página standalone
}
```

### 2. ContactsTable Component

Tabela virtualizada de contatos com seleção e ações inline.

**Features:**
- Virtualização para performance com grandes listas
- Seleção individual e em massa
- Ordenação por colunas
- Ações inline por contato
- Expansão de linha para detalhes

**Props:**
```typescript
interface ContactsTableProps {
  contacts: Contact[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onContactUpdate: (id: string, updates: Partial<Contact>) => void;
  loading?: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

### 3. ContactsFilters Component

Filtros avançados inline com preview de resultados.

**Features:**
- Busca por texto (nome/telefone)
- Filtro por tags (múltipla seleção)
- Filtro por presença de nome
- Filtro por data de adição
- Contador de resultados em tempo real
- Botão de limpar filtros

**Props:**
```typescript
interface ContactsFiltersProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
  availableTags: Tag[];
  resultCount: number;
  totalCount: number;
}

interface ContactFilters {
  search: string;
  tags: string[];
  hasName: boolean | null;
  dateRange?: { start: Date; end: Date };
}
```

### 4. ContactSelection Component

Barra flutuante que aparece quando há contatos selecionados.

**Features:**
- Contador de selecionados
- Ações em massa
- Botão de limpar seleção
- Animação de entrada/saída
- Posição fixa no bottom da tela

**Props:**
```typescript
interface ContactSelectionProps {
  selectedCount: number;
  onClearSelection: () => void;
  onAddTags: () => void;
  onSaveGroup: () => void;
  onSendMessage: () => void;
  onExport: () => void;
}
```

### 5. ContactTags Component

Gerenciamento inline de tags.

**Features:**
- Adicionar tags a contatos selecionados
- Criar novas tags com nome e cor
- Remover tags
- Filtrar por tags
- Visualização de tags como badges

**Props:**
```typescript
interface ContactTagsProps {
  contactIds: string[];
  existingTags: Tag[];
  onTagsUpdate: (contactIds: string[], tags: Tag[]) => void;
  onCreateTag: (tag: Omit<Tag, 'id'>) => void;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}
```

### 6. ContactGroups Component

Gerenciamento de grupos salvos.

**Features:**
- Listar grupos salvos
- Criar novo grupo
- Editar nome do grupo
- Deletar grupo
- Selecionar contatos do grupo
- Visualizar preview de contatos

**Props:**
```typescript
interface ContactGroupsProps {
  groups: ContactGroup[];
  onGroupSelect: (groupId: string) => void;
  onGroupCreate: (name: string, contactIds: string[]) => void;
  onGroupUpdate: (groupId: string, updates: Partial<ContactGroup>) => void;
  onGroupDelete: (groupId: string) => void;
}

interface ContactGroup {
  id: string;
  name: string;
  contactIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 7. Enhanced ContactImporter (Disparador)

Versão melhorada do importador com filtros inline.

**Features:**
- Filtros antes de adicionar
- Preview de contatos filtrados
- Seleção inteligente
- Integração com grupos salvos
- Contador de contatos a adicionar

**Props:**
```typescript
interface EnhancedContactImporterProps {
  instance: string;
  userToken: string;
  onContactsImported: (contacts: Contact[]) => void;
  preSelectedContacts?: Contact[]; // Vindos da página de contatos
}
```

## Data Models

### Contact Model

```typescript
interface Contact {
  phone: string;              // Telefone normalizado (55XXXXXXXXXXX)
  name: string | null;        // Nome do contato
  variables: Record<string, string>; // Variáveis customizadas
  tags: string[];             // IDs das tags
  addedAt: Date;              // Data de importação
  lastUpdated: Date;          // Última atualização
}
```

### ContactsState Model

```typescript
interface ContactsState {
  contacts: Contact[];
  selectedIds: Set<string>;
  filters: ContactFilters;
  tags: Tag[];
  groups: ContactGroup[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
  loading: boolean;
  error: string | null;
}
```

## Services

### ContactsService

Serviço principal de gerenciamento de contatos.

**Methods:**

```typescript
class ContactsService {
  // Importação
  async importFromWuzapi(instance: string, token: string): Promise<Contact[]>
  
  // Filtros
  filterContacts(contacts: Contact[], filters: ContactFilters): Contact[]
  searchContacts(contacts: Contact[], query: string): Contact[]
  
  // Tags
  addTagsToContacts(contactIds: string[], tags: Tag[]): void
  removeTagsFromContacts(contactIds: string[], tagIds: string[]): void
  createTag(tag: Omit<Tag, 'id'>): Tag
  deleteTag(tagId: string): void
  
  // Grupos
  createGroup(name: string, contactIds: string[]): ContactGroup
  updateGroup(groupId: string, updates: Partial<ContactGroup>): void
  deleteGroup(groupId: string): void
  getGroupContacts(groupId: string): Contact[]
  
  // Exportação
  exportToCSV(contacts: Contact[]): Blob
  
  // Estatísticas
  getStats(contacts: Contact[]): ContactStats
}
```

### ContactsStorageService

Serviço de persistência local.

**Methods:**

```typescript
class ContactsStorageService {
  // Contatos
  saveContacts(contacts: Contact[]): void
  loadContacts(): Contact[]
  clearContacts(): void
  
  // Tags
  saveTags(tags: Tag[]): void
  loadTags(): Tag[]
  
  // Grupos
  saveGroups(groups: ContactGroup[]): void
  loadGroups(): ContactGroup[]
  
  // Preferências
  savePreferences(prefs: UserPreferences): void
  loadPreferences(): UserPreferences
  
  // Limpeza
  cleanOldData(daysOld: number): void
}
```

## Hooks

### useContacts Hook

Hook principal para gerenciamento de contatos.

```typescript
function useContacts() {
  const [state, setState] = useState<ContactsState>(initialState);
  
  const importContacts = async (instance: string, token: string) => {
    // Importa contatos da WUZAPI
  };
  
  const updateContact = (id: string, updates: Partial<Contact>) => {
    // Atualiza contato
  };
  
  const deleteContacts = (ids: string[]) => {
    // Remove contatos
  };
  
  return {
    contacts: state.contacts,
    loading: state.loading,
    error: state.error,
    importContacts,
    updateContact,
    deleteContacts,
  };
}
```

### useContactFilters Hook

Hook para gerenciamento de filtros.

```typescript
function useContactFilters(contacts: Contact[]) {
  const [filters, setFilters] = useState<ContactFilters>(defaultFilters);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  
  useEffect(() => {
    const filtered = applyFilters(contacts, filters);
    setFilteredContacts(filtered);
  }, [contacts, filters]);
  
  const updateFilters = (newFilters: Partial<ContactFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };
  
  const clearFilters = () => {
    setFilters(defaultFilters);
  };
  
  return {
    filters,
    filteredContacts,
    updateFilters,
    clearFilters,
    resultCount: filteredContacts.length,
  };
}
```

### useContactSelection Hook

Hook para gerenciamento de seleção.

```typescript
function useContactSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const selectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };
  
  const clearSelection = () => {
    setSelectedIds(new Set());
  };
  
  const selectFiltered = (contacts: Contact[]) => {
    selectAll(contacts.map(c => c.phone));
  };
  
  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    selectAll,
    clearSelection,
    selectFiltered,
  };
}
```

## Error Handling

### Frontend Error Handling

```typescript
// Toast notifications para erros
try {
  await importContacts(instance, token);
  toast.success('Contatos importados com sucesso');
} catch (error) {
  toast.error(`Erro ao importar: ${error.message}`);
  logger.error('Import failed', { error });
}

// Fallback UI para erros críticos
if (error) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {error.message}
        <Button onClick={retry}>Tentar Novamente</Button>
      </AlertDescription>
    </Alert>
  );
}
```

### Backend Error Handling

```javascript
// Tratamento consistente de erros
router.get('/contacts', verifyUserToken, async (req, res) => {
  try {
    const contacts = await contactsService.getContacts(req.userToken);
    res.json({ success: true, data: contacts });
  } catch (error) {
    logger.error('Failed to get contacts', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar contatos',
      message: error.message
    });
  }
});
```

## Testing Strategy

### Unit Tests

```typescript
// ContactsService tests
describe('ContactsService', () => {
  describe('filterContacts', () => {
    it('should filter by search query', () => {
      const contacts = [
        { phone: '5511999999999', name: 'João Silva', tags: [] },
        { phone: '5511888888888', name: 'Maria Santos', tags: [] }
      ];
      const filtered = service.filterContacts(contacts, { search: 'joão' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('João Silva');
    });
    
    it('should filter by tags', () => {
      const contacts = [
        { phone: '5511999999999', name: 'João', tags: ['vip'] },
        { phone: '5511888888888', name: 'Maria', tags: ['cliente'] }
      ];
      const filtered = service.filterContacts(contacts, { tags: ['vip'] });
      expect(filtered).toHaveLength(1);
    });
  });
});
```

### Integration Tests

```typescript
// ContactsTable integration tests
describe('ContactsTable', () => {
  it('should select all visible contacts', async () => {
    const { getByRole, getAllByRole } = render(
      <ContactsTable contacts={mockContacts} {...props} />
    );
    
    const selectAllCheckbox = getByRole('checkbox', { name: /select all/i });
    fireEvent.click(selectAllCheckbox);
    
    const checkboxes = getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeChecked();
    });
  });
});
```

### E2E Tests

```typescript
// Cypress E2E tests
describe('Contact Management', () => {
  it('should import and filter contacts', () => {
    cy.visit('/user/contacts');
    cy.contains('Importar da Agenda').click();
    cy.contains('contatos importados', { timeout: 10000 });
    
    cy.get('[data-testid="search-input"]').type('João');
    cy.get('[data-testid="contacts-table"]')
      .find('tr')
      .should('have.length.lessThan', 10);
  });
  
  it('should create and use a group', () => {
    cy.visit('/user/contacts');
    cy.get('[data-testid="select-all"]').click();
    cy.contains('Salvar Grupo').click();
    cy.get('[data-testid="group-name"]').type('VIPs');
    cy.contains('Salvar').click();
    
    cy.contains('VIPs').click();
    cy.get('[data-testid="selected-count"]').should('contain', '15');
  });
});
```

## Performance Optimizations

### 1. Virtualization

```typescript
// Usar react-window para virtualização
import { FixedSizeList } from 'react-window';

function ContactsTable({ contacts }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ContactRow contact={contacts[index]} />
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={contacts.length}
      itemSize={60}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 2. Debouncing

```typescript
// Debounce de busca
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    setFilters(prev => ({ ...prev, search: query }));
  }, 300),
  []
);
```

### 3. Memoization

```typescript
// Memoizar contatos filtrados
const filteredContacts = useMemo(() => {
  return applyFilters(contacts, filters);
}, [contacts, filters]);

// Memoizar estatísticas
const stats = useMemo(() => {
  return calculateStats(filteredContacts);
}, [filteredContacts]);
```

### 4. Web Workers

```typescript
// Processar filtros em background
const filterWorker = new Worker('/workers/filter.worker.js');

filterWorker.postMessage({ contacts, filters });
filterWorker.onmessage = (e) => {
  setFilteredContacts(e.data);
};
```

## UI/UX Patterns

### 1. Inline Editing

```typescript
// Edição inline de nome
const [editing, setEditing] = useState(false);
const [name, setName] = useState(contact.name);

{editing ? (
  <Input
    value={name}
    onChange={(e) => setName(e.target.value)}
    onBlur={() => {
      updateContact(contact.phone, { name });
      setEditing(false);
    }}
    autoFocus
  />
) : (
  <span onClick={() => setEditing(true)}>
    {contact.name || 'Sem nome'}
  </span>
)}
```

### 2. Floating Action Bar

```typescript
// Barra flutuante com animação
<AnimatePresence>
  {selectedCount > 0 && (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <Card className="shadow-lg">
        <CardContent className="flex items-center gap-4 p-4">
          <Badge>{selectedCount} selecionados</Badge>
          <Button onClick={onAddTags}>Adicionar Tags</Button>
          <Button onClick={onSaveGroup}>Salvar Grupo</Button>
          <Button onClick={onSendMessage}>Enviar Mensagem</Button>
        </CardContent>
      </Card>
    </motion.div>
  )}
</AnimatePresence>
```

### 3. Expandable Filters

```typescript
// Filtros expansíveis
const [expanded, setExpanded] = useState(false);

<Card>
  <CardHeader onClick={() => setExpanded(!expanded)} className="cursor-pointer">
    <div className="flex items-center justify-between">
      <CardTitle>Filtros Avançados</CardTitle>
      {expanded ? <ChevronUp /> : <ChevronDown />}
    </div>
  </CardHeader>
  {expanded && (
    <CardContent>
      {/* Filtros */}
    </CardContent>
  )}
</Card>
```

## Integration Points

### 1. Menu Lateral

```typescript
// Adicionar item no menu
<nav>
  <Link to="/user" className={linkClass}>
    <LayoutDashboard className="h-4 w-4" />
    Dashboard
  </Link>
  <Link to="/user/contacts" className={linkClass}>
    <Users className="h-4 w-4" />
    Contatos
  </Link>
  <Link to="/user/disparador" className={linkClass}>
    <MessageSquare className="h-4 w-4" />
    Mensagens
  </Link>
</nav>
```

### 2. Disparador Integration

```typescript
// Passar contatos selecionados para o disparador
const navigate = useNavigate();

const handleSendMessage = () => {
  const selected = contacts.filter(c => selectedIds.has(c.phone));
  
  // Salvar no sessionStorage
  sessionStorage.setItem('preSelectedContacts', JSON.stringify(selected));
  
  // Navegar para disparador
  navigate('/user/disparador', {
    state: { preSelectedContacts: selected }
  });
  
  toast.success(`${selected.length} contatos adicionados ao disparador`);
};
```

### 3. Storage Sync

```typescript
// Sincronizar entre páginas
useEffect(() => {
  // Salvar estado
  contactsStorage.saveContacts(contacts);
  contactsStorage.saveTags(tags);
  contactsStorage.saveGroups(groups);
}, [contacts, tags, groups]);

// Carregar estado
useEffect(() => {
  const saved = contactsStorage.loadContacts();
  if (saved.length > 0) {
    setContacts(saved);
  }
}, []);
```

## Accessibility

- Todos os controles interativos devem ser acessíveis via teclado
- Labels apropriados para screen readers
- Contraste de cores adequado (WCAG AA)
- Focus indicators visíveis
- ARIA labels para ações

```typescript
<button
  aria-label={`Selecionar contato ${contact.name || contact.phone}`}
  onClick={() => toggleSelection(contact.phone)}
>
  <Checkbox checked={isSelected} />
</button>
```
