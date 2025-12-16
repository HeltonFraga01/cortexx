# Frontend Component Templates

Este diretório contém templates para criação de novos componentes no projeto WUZAPI Manager. Os templates seguem os padrões estabelecidos no projeto e incluem as melhores práticas de desenvolvimento.

## Templates Disponíveis

### 1. AdminPageTemplate.tsx
Template para páginas administrativas com funcionalidades completas de CRUD.

**Características:**
- Layout responsivo com sidebar administrativa
- Gerenciamento de estado com React hooks
- Operações CRUD (Create, Read, Update, Delete)
- Sistema de busca e filtros
- Seleção múltipla e operações em lote
- Cards de estatísticas
- Formulários de criação e edição
- Tratamento de erros e loading states
- Integração com toast notifications

**Como usar:**
1. Copie o arquivo `AdminPageTemplate.tsx`
2. Renomeie para o nome da sua página (ex: `AdminProducts.tsx`)
3. Substitua os comentários `TODO` com sua implementação específica
4. Atualize os tipos de dados (`YourDataType`, `YourApiService`)
5. Implemente as chamadas de API reais
6. Customize os campos do formulário conforme necessário

### 2. UserPageTemplate.tsx
Template para páginas de usuário com foco em perfil e configurações pessoais.

**Características:**
- Interface centrada no usuário
- Sistema de abas (Overview, Settings, Activity)
- Gerenciamento de perfil pessoal
- Configurações personalizáveis
- Histórico de atividades
- Cards de status e estatísticas
- Formulários de configuração
- Integração com contexto de autenticação

**Como usar:**
1. Copie o arquivo `UserPageTemplate.tsx`
2. Renomeie para o nome da sua página (ex: `UserProfile.tsx`)
3. Substitua os comentários `TODO` com sua implementação específica
4. Atualize os tipos de dados (`UserDataType`, `UserSettings`)
5. Implemente as chamadas de API reais
6. Customize as configurações e campos conforme necessário

### 3. ReusableComponentTemplate.tsx
Template para componentes reutilizáveis com padrão de composição.

**Características:**
- Componente principal flexível com múltiplas variantes
- Sub-componentes para composição (Header, Content, Footer)
- Componente de lista para exibição de coleções
- Componente de formulário dinâmico
- Sistema de variantes (default, primary, secondary, success, warning, error)
- Suporte a diferentes tamanhos (sm, md, lg)
- Estados de loading e disabled
- Forwarded refs para melhor integração
- Exemplos de uso incluídos

**Como usar:**
1. Copie o arquivo `ReusableComponentTemplate.tsx`
2. Renomeie para o nome do seu componente (ex: `ProductCard.tsx`)
3. Customize as props conforme suas necessidades
4. Implemente a lógica específica do componente
5. Remova os sub-componentes que não precisar
6. Atualize os estilos e variantes conforme necessário

### 4. CustomHookTemplate.ts
Template para custom hooks com gerenciamento completo de dados e estado.

**Características:**
- Gerenciamento de estado com React hooks
- Operações CRUD completas (Create, Read, Update, Delete)
- Sistema de cache e refresh automático
- Tratamento de erros integrado
- Hooks utilitários para filtros, paginação e seleção
- Valores computados e memoização
- Configurações flexíveis
- Callbacks para eventos de sucesso e erro

**Como usar:**
1. Copie o arquivo `CustomHookTemplate.ts`
2. Renomeie para o nome do seu hook (ex: `useProducts.ts`)
3. Substitua os comentários `TODO` com sua implementação específica
4. Atualize os tipos de dados (`HookDataType`, `ApiService`)
5. Implemente as chamadas de API reais
6. Customize as opções e comportamentos conforme necessário

## Padrões Seguidos

### Estrutura de Arquivos
```
src/components/
├── admin/           # Componentes específicos do admin
├── user/            # Componentes específicos do usuário
├── ui/              # Componentes base (shadcn/ui)
├── ui-custom/       # Componentes customizados
└── shared/          # Componentes compartilhados
```

### Convenções de Nomenclatura
- **Componentes**: PascalCase (ex: `AdminUsers.tsx`)
- **Arquivos**: PascalCase para componentes, camelCase para utilitários
- **Props**: camelCase
- **Tipos**: PascalCase com sufixo apropriado (ex: `UserDataType`)

### Padrões de Código

#### Imports
```typescript
// React imports primeiro
import { useState, useEffect } from 'react';

// Componentes UI
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Hooks e contextos
import { useAuth } from '@/contexts/AuthContext';

// Ícones
import { Settings, Plus } from 'lucide-react';

// Utilitários
import { toast } from 'sonner';
```

#### Tipagem TypeScript
```typescript
// Sempre definir interfaces para props
interface ComponentProps {
  title: string;
  description?: string;
  onAction: (id: string) => void;
}

// Usar tipos específicos para dados
interface UserData {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}
```

#### Estado e Efeitos
```typescript
// Agrupar estados relacionados
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Usar useEffect para carregamento inicial
useEffect(() => {
  fetchData();
}, []);
```

#### Tratamento de Erros
```typescript
try {
  const result = await apiCall();
  setData(result);
  toast.success('Operação realizada com sucesso!');
} catch (error) {
  console.error('Error:', error);
  toast.error('Erro ao realizar operação');
}
```

### Componentes UI Utilizados

#### Componentes Base (shadcn/ui)
- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
- `Button`
- `Input`, `Label`, `Textarea`
- `Badge`
- `Separator`
- `Dialog`, `AlertDialog`

#### Componentes Customizados
- `Button` (ui-custom) - Versão estendida com mais variantes
- `Card` (ui-custom) - Versão estendida com efeitos visuais
- `ThemeToggle` - Alternador de tema

#### Ícones (Lucide React)
- Use ícones consistentes do Lucide React
- Tamanho padrão: `h-4 w-4` para botões, `h-5 w-5` para títulos
- Sempre adicione classes de cor apropriadas

### Responsividade

#### Grid System
```typescript
// Cards de estatísticas
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

// Layout de duas colunas
<div className="grid gap-6 lg:grid-cols-2">

// Formulários responsivos
<div className="grid gap-4 md:grid-cols-2">
```

#### Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

### Acessibilidade

#### Labels e IDs
```typescript
<Label htmlFor="name">Nome</Label>
<Input id="name" />
```

#### ARIA Labels
```typescript
<Button aria-label="Excluir item">
  <Trash2 className="h-4 w-4" />
</Button>
```

#### Navegação por Teclado
- Todos os elementos interativos devem ser acessíveis via teclado
- Use `tabIndex` quando necessário
- Implemente handlers para `onKeyDown` em componentes customizados

### Performance

#### Lazy Loading
```typescript
// Para componentes grandes
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Para dados
const [data, setData] = useState<DataType[]>([]);
const [hasMore, setHasMore] = useState(true);
```

#### Memoização
```typescript
// Para cálculos custosos
const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

// Para callbacks
const handleClick = useCallback((id: string) => {
  onItemClick(id);
}, [onItemClick]);
```

## Exemplos de Uso

### Criando uma Nova Página Admin
```bash
# 1. Copiar template
cp templates/frontend/AdminPageTemplate.tsx src/components/admin/AdminProducts.tsx

# 2. Atualizar imports no arquivo de rotas
# 3. Implementar tipos específicos
# 4. Conectar com API
# 5. Testar funcionalidades
```

### Criando um Componente Reutilizável
```bash
# 1. Copiar template
cp templates/frontend/ReusableComponentTemplate.tsx src/components/ui-custom/ProductCard.tsx

# 2. Customizar props e lógica
# 3. Implementar variantes necessárias
# 4. Adicionar testes se necessário
# 5. Documentar uso
```

## Checklist de Implementação

### Antes de Começar
- [ ] Definir requisitos e funcionalidades
- [ ] Escolher o template apropriado
- [ ] Planejar estrutura de dados e API
- [ ] Verificar dependências necessárias

### Durante o Desenvolvimento
- [ ] Substituir todos os comentários `TODO`
- [ ] Implementar tipos TypeScript específicos
- [ ] Conectar com APIs reais
- [ ] Adicionar validações necessárias
- [ ] Implementar tratamento de erros
- [ ] Testar responsividade
- [ ] Verificar acessibilidade

### Após Implementação
- [ ] Testar todas as funcionalidades
- [ ] Verificar performance
- [ ] Revisar código para padrões
- [ ] Documentar componente se necessário
- [ ] Adicionar testes unitários (opcional)

## Recursos Adicionais

### Documentação
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Lucide React Icons](https://lucide.dev/icons/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com/) (para formulários complexos)

### Ferramentas Úteis
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
- [TypeScript Importer](https://marketplace.visualstudio.com/items?itemName=pmneo.tsimporter)
- [Auto Rename Tag](https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-rename-tag)

### Troubleshooting

#### Problemas Comuns
1. **Imports não encontrados**: Verifique o `tsconfig.json` e paths
2. **Estilos não aplicados**: Verifique se o Tailwind está configurado
3. **Componentes não renderizam**: Verifique se todos os imports estão corretos
4. **TypeScript errors**: Verifique se todos os tipos estão definidos

#### Dicas de Debug
- Use React DevTools para inspecionar componentes
- Use console.log estratégico para debug de estado
- Verifique Network tab para problemas de API
- Use TypeScript strict mode para melhor tipagem