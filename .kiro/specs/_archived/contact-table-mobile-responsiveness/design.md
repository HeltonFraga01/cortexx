# Design Document

## Overview

Este documento detalha as soluções técnicas para corrigir problemas de responsividade mobile na tabela de contatos (`ContactsTable.tsx`) e na ilha de seleção (`ContactSelection.tsx`). As correções focam em:

1. Eliminar sobreposição de colunas através de larguras mínimas e truncamento
2. Sincronizar scroll horizontal entre header e body da tabela
3. Ajustar layout da ilha de seleção para mobile
4. Otimizar uso de espaço em viewports pequenos
5. Manter consistência com padrões Tailwind CSS do projeto

## Architecture

### Componentes Afetados

```
src/components/contacts/
├── ContactsTable.tsx       # Componente principal - tabela virtualizada
└── ContactSelection.tsx    # Ilha de seleção flutuante
```

### Estrutura Atual

**ContactsTable.tsx**:
- Usa `react-window` para virtualização de linhas
- Header fixo com `position: sticky` (apenas vertical)
- Colunas com larguras flexíveis: `w-10`, `w-28`, `flex-[2]`, `flex-1`, `w-16`
- Container com `overflow-x-auto` para scroll horizontal
- Breakpoints: `sm:` (640px) para ajustes de padding e tamanho de fonte

**ContactSelection.tsx**:
- Card flutuante com `position: fixed`
- Layout desktop: flex horizontal com todos os botões
- Layout mobile: grid 4 colunas (já implementado parcialmente)
- Breakpoint: `sm:` (640px) para alternar entre layouts

### Problemas Identificados

1. **Sobreposição de Colunas**:
   - Larguras flexíveis (`flex-[2]`, `flex-1`) colapsam em mobile
   - Texto longo não trunca, invade colunas adjacentes
   - Padding excessivo reduz espaço útil

2. **Header Desalinhado**:
   - Header e body são elementos separados (`<div>` para header, `<List>` para body)
   - Scroll horizontal não sincroniza entre os dois
   - Header fixo usa classes diferentes das linhas do body

3. **Ilha de Seleção**:
   - Layout mobile já existe mas botões ainda quebram em telas < 360px
   - Falta `max-width` para evitar overflow
   - Padding lateral insuficiente em mobile

4. **Espaço Ineficiente**:
   - Padding de células muito grande em mobile (`px-1` ainda é 4px)
   - Fonte de 10px dificulta leitura
   - Coluna de tags ocupa espaço mesmo quando vazia

## Components and Interfaces

### ContactsTable - Correções de Layout

#### 1. Larguras Mínimas e Truncamento

**Problema**: Colunas flexíveis colapsam e texto invade espaços adjacentes.

**Solução**: Aplicar `min-w-*` e `truncate` em todas as colunas.

```tsx
// Antes (linha 186-187)
<div className="w-28 sm:w-44 px-1 sm:px-4 font-mono text-[10px] sm:text-sm whitespace-nowrap flex-shrink-0" role="cell">

// Depois
<div className="min-w-[120px] w-28 sm:w-44 px-1 sm:px-4 font-mono text-xs sm:text-sm whitespace-nowrap flex-shrink-0 truncate" role="cell">
```

```tsx
// Antes (linha 194)
<div className="flex-[2] px-1 sm:px-4 min-w-[100px] text-xs sm:text-sm" role="cell">

// Depois
<div className="flex-[2] px-1 sm:px-4 min-w-[120px] text-xs sm:text-sm" role="cell">
```

```tsx
// Antes (linha 227)
<div className="flex-1 px-1 sm:px-4 min-w-[80px]" role="cell">

// Depois
<div className="flex-1 px-1 sm:px-4 min-w-[100px]" role="cell">
```

**Aplicar em**:
- Linha do body (componente `RowComponent`)
- Header da tabela (linha 280-285)

#### 2. Sincronização de Scroll Horizontal

**Problema**: Header e body são elementos separados, scroll não sincroniza.

**Solução**: Envolver header e body em container único com scroll compartilhado.

```tsx
// Estrutura Atual (linhas 270-310)
<div className="border rounded-lg overflow-x-auto" ref={containerRef}>
  {/* Header fixo */}
  <div className="flex items-center border-b bg-muted/50 ...">
    {/* Colunas do header */}
  </div>
  
  {/* Body com virtualização */}
  <List ... />
</div>

// Nova Estrutura
<div className="border rounded-lg" ref={containerRef}>
  <div className="overflow-x-auto">
    {/* Header fixo com sticky apenas no eixo Y */}
    <div className="flex items-center border-b bg-muted/50 sticky top-0 z-10 ...">
      {/* Colunas do header */}
    </div>
    
    {/* Body com virtualização */}
    <div className="overflow-x-auto">
      <List ... />
    </div>
  </div>
</div>
```

**Mudanças**:
1. Remover `overflow-x-auto` do container externo
2. Adicionar `overflow-x-auto` em wrapper interno que contém header + body
3. Header usa `sticky top-0 z-10` para fixar apenas verticalmente
4. Body mantém scroll horizontal sincronizado com header

#### 3. Otimização de Espaço Mobile

**Problema**: Padding excessivo, fonte pequena demais, coluna de tags sempre visível.

**Solução**: Ajustar padding, aumentar fonte mínima, ocultar coluna de tags em telas muito pequenas.

```tsx
// Padding de células
// Antes: px-1 sm:px-4 (4px / 16px)
// Depois: px-2 sm:px-4 (8px / 16px)

// Tamanho de fonte
// Antes: text-[10px] sm:text-sm (10px / 14px)
// Depois: text-xs sm:text-sm (12px / 14px)

// Coluna de tags
// Antes: sempre visível
// Depois: hidden xs:block (oculta em < 475px)
```

**Aplicar em**:
- Todas as células do body
- Todas as células do header
- Coluna de tags: adicionar `hidden xs:flex` (xs = 475px, custom breakpoint)

#### 4. Largura Mínima da Tabela

**Problema**: `min-w-[600px]` força scroll mesmo quando não necessário.

**Solução**: Reduzir para `min-w-[500px]` e ajustar dinamicamente.

```tsx
// Antes (linha 175)
<div style={style} className="... min-w-[600px]">

// Depois
<div style={style} className="... min-w-[500px] xs:min-w-[600px]">
```

### ContactSelection - Correções de Layout

#### 1. Max-Width e Padding Lateral

**Problema**: Card pode exceder largura do viewport em telas muito pequenas.

**Solução**: Adicionar `max-w-[calc(100vw-16px)]` e garantir padding lateral.

```tsx
// Antes (linha 32-35)
<div
  className={cn(
    "fixed bottom-2 left-2 right-2 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50",
    "animate-slide-up transition-all duration-300"
  )}
>

// Depois
<div
  className={cn(
    "fixed bottom-2 left-2 right-2 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50",
    "max-w-[calc(100vw-16px)] sm:max-w-2xl",
    "animate-slide-up transition-all duration-300"
  )}
>
```

#### 2. Grid Responsivo de Botões

**Problema**: Grid 4 colunas quebra em telas < 360px.

**Solução**: Usar grid 2x2 em telas muito pequenas, 4 colunas em telas maiores.

```tsx
// Antes (linha 58)
<div className="grid grid-cols-4 gap-1.5">

// Depois
<div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5">
```

#### 3. Tamanho de Botões Mobile

**Problema**: Botões com `h-8` são pequenos demais para toque confortável.

**Solução**: Aumentar para `h-9` (36px) para melhor área de toque.

```tsx
// Antes (linha 60-65)
<Button
  variant="outline"
  size="sm"
  onClick={onAddTags}
  className="h-8 px-1 text-xs"
>

// Depois
<Button
  variant="outline"
  size="sm"
  onClick={onAddTags}
  className="h-9 px-2 text-xs flex flex-col items-center justify-center gap-0.5"
>
  <Tag className="h-4 w-4" />
  <span className="text-[10px]">Tags</span>
</Button>
```

**Mudanças**:
- Altura de `h-8` (32px) para `h-9` (36px)
- Padding de `px-1` para `px-2`
- Layout vertical: ícone + label pequeno
- Label com `text-[10px]` para identificação

## Data Models

Não há mudanças em modelos de dados. As correções são puramente de CSS/layout.

## Error Handling

Não há novos casos de erro. As correções mantêm o tratamento de erros existente.

## Testing Strategy

### Testes Manuais

**Viewports a testar**:
1. **320px** (iPhone SE) - Menor viewport comum
2. **375px** (iPhone 12/13) - Viewport mobile padrão
3. **414px** (iPhone 12 Pro Max) - Viewport mobile grande
4. **768px** (iPad) - Breakpoint `md`
5. **1024px** (Desktop) - Viewport desktop padrão

**Cenários de teste**:

1. **Sobreposição de Colunas**:
   - [ ] Telefone e nome não se sobrepõem em 320px
   - [ ] Texto longo trunca com ellipsis
   - [ ] Todas as colunas visíveis em 375px
   - [ ] Scroll horizontal funciona suavemente

2. **Header Fixo**:
   - [ ] Header permanece visível ao rolar verticalmente
   - [ ] Header rola horizontalmente junto com body
   - [ ] Alinhamento perfeito entre header e colunas do body
   - [ ] Sem "buraco" ou desalinhamento ao rolar

3. **Ilha de Seleção**:
   - [ ] Card não excede largura do viewport em 320px
   - [ ] Botões acessíveis e clicáveis em 375px
   - [ ] Grid 2x2 em 320px, 4 colunas em 475px+
   - [ ] Labels dos botões legíveis

4. **Espaço e Legibilidade**:
   - [ ] Fonte de 12px legível em mobile
   - [ ] Padding adequado para toque (min 8px)
   - [ ] Coluna de tags oculta em < 475px
   - [ ] Tabela usa espaço disponível eficientemente

### Testes Automatizados

**Cypress E2E** (opcional):

```typescript
// cypress/e2e/contact-table-mobile.cy.ts
describe('ContactsTable Mobile Responsiveness', () => {
  beforeEach(() => {
    cy.login('user');
    cy.visit('/contacts');
  });

  it('should not overlap phone and name columns on mobile', () => {
    cy.viewport(375, 667); // iPhone SE
    cy.get('[role="cell"]').first().should('be.visible');
    cy.get('[role="cell"]').eq(1).should('not.overlap', '[role="cell"]').first();
  });

  it('should sync header scroll with body', () => {
    cy.viewport(375, 667);
    cy.get('[role="table"]').scrollTo('right');
    cy.get('[role="columnheader"]').first().should('have.css', 'transform');
  });

  it('should display selection island within viewport', () => {
    cy.viewport(320, 568); // iPhone SE
    cy.get('[role="row"]').first().find('[type="checkbox"]').check();
    cy.get('[role="region"][aria-label*="selecionados"]')
      .should('be.visible')
      .and('have.css', 'max-width');
  });
});
```

### Checklist de Validação

Antes de considerar a implementação completa:

- [ ] Testado em Chrome DevTools com viewports 320px, 375px, 414px, 768px
- [ ] Testado em dispositivo físico iOS (iPhone)
- [ ] Testado em dispositivo físico Android
- [ ] Scroll horizontal funciona suavemente
- [ ] Header e body sincronizados
- [ ] Ilha de seleção não quebra layout
- [ ] Texto trunca corretamente
- [ ] Botões têm área de toque adequada (min 36px)
- [ ] Fonte legível (min 12px)
- [ ] Sem regressões em desktop

## Implementation Notes

### Breakpoints Customizados

Adicionar breakpoint `xs` ao `tailwind.config.ts` para telas muito pequenas:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      screens: {
        'xs': '475px', // Entre mobile e sm
      },
    },
  },
}
```

### Classes Tailwind Utilizadas

**Larguras**:
- `min-w-[120px]` - Largura mínima de coluna
- `max-w-[calc(100vw-16px)]` - Largura máxima com padding

**Truncamento**:
- `truncate` - Ellipsis para texto longo
- `whitespace-nowrap` - Prevenir quebra de linha

**Scroll**:
- `overflow-x-auto` - Scroll horizontal
- `sticky top-0` - Header fixo verticalmente

**Layout**:
- `grid grid-cols-2 xs:grid-cols-4` - Grid responsivo
- `flex flex-col` - Layout vertical de botões

**Espaçamento**:
- `px-2 sm:px-4` - Padding horizontal responsivo
- `gap-1.5` - Espaçamento entre botões

**Tipografia**:
- `text-xs sm:text-sm` - Fonte responsiva (12px / 14px)
- `text-[10px]` - Fonte extra pequena para labels

### Performance

As mudanças são puramente de CSS, sem impacto em performance:
- Virtualização com `react-window` mantida
- Memoization de callbacks mantida
- Sem re-renders adicionais

### Acessibilidade

Manter atributos ARIA existentes:
- `role="table"`, `role="row"`, `role="cell"`
- `aria-label` em botões
- `aria-live="polite"` em contadores

### Compatibilidade

**Browsers suportados**:
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+

**Features CSS utilizadas**:
- `calc()` - Suportado em todos os browsers modernos
- `position: sticky` - Suportado em todos os browsers modernos
- `overflow-x: auto` - Suportado universalmente
- Tailwind CSS classes - Compiladas para CSS padrão

## Diagrams

### Estrutura de Scroll Sincronizado

```
┌─────────────────────────────────────┐
│ Container Externo (border, rounded) │
│ ┌─────────────────────────────────┐ │
│ │ Wrapper com overflow-x-auto     │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ Header (sticky top-0)       │ │ │
│ │ │ ┌───┬─────┬──────┬────┬────┐│ │ │
│ │ │ │ ☑ │ Tel │ Nome │Tags│Ações││ │ │
│ │ │ └───┴─────┴──────┴────┴────┘│ │ │
│ │ └─────────────────────────────┘ │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ Body (react-window List)    │ │ │
│ │ │ ┌───┬─────┬──────┬────┬────┐│ │ │
│ │ │ │ ☐ │ +55 │ João │ 🏷 │✏️🗑││ │ │
│ │ │ ├───┼─────┼──────┼────┼────┤│ │ │
│ │ │ │ ☐ │ +55 │ Maria│ 🏷 │✏️🗑││ │ │
│ │ │ └───┴─────┴──────┴────┴────┘│ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
│         ↕️ Scroll Vertical           │
│         ↔️ Scroll Horizontal         │
└─────────────────────────────────────┘
```

### Layout Mobile da Ilha de Seleção

```
┌─────────────────────────────────┐
│ ContactSelection (< 640px)      │
│ ┌─────────────────────────────┐ │
│ │ Linha 1: Badge + Limpar     │ │
│ │ ┌──────────────┐  ┌───┐    │ │
│ │ │ 5 contatos   │  │ X │    │ │
│ │ └──────────────┘  └───┘    │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Linha 2: Grid 2x2 (< 475px) │ │
│ │ ┌──────┬──────┐             │ │
│ │ │ 🏷   │ 📁   │             │ │
│ │ │ Tags │Grupo │             │ │
│ │ ├──────┼──────┤             │ │
│ │ │ 💬   │ 📥   │             │ │
│ │ │Enviar│ CSV  │             │ │
│ │ └──────┴──────┘             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ContactSelection (≥ 475px)      │
│ ┌─────────────────────────────┐ │
│ │ Linha 1: Badge + Limpar     │ │
│ │ ┌──────────────┐  ┌───┐    │ │
│ │ │ 5 contatos   │  │ X │    │ │
│ │ └──────────────┘  └───┘    │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Linha 2: Grid 1x4           │ │
│ │ ┌────┬────┬────┬────┐       │ │
│ │ │ 🏷 │ 📁 │ 💬 │ 📥 │       │ │
│ │ │Tags│Grp │Env │CSV │       │ │
│ │ └────┴────┴────┴────┘       │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Larguras de Colunas

```
Mobile (< 640px):
┌────┬────────────┬────────────┬──────────┬────────┐
│ ☑  │  Telefone  │    Nome    │   Tags   │ Ações  │
│10px│   120px    │   120px    │  100px   │  64px  │
│    │ (min-w)    │ (min-w)    │ (min-w)  │        │
└────┴────────────┴────────────┴──────────┴────────┘
Total: ~414px (cabe em iPhone 12)

Desktop (≥ 640px):
┌────┬────────────┬────────────┬──────────┬────────┐
│ ☑  │  Telefone  │    Nome    │   Tags   │ Ações  │
│48px│   176px    │   flex-2   │  flex-1  │  96px  │
└────┴────────────┴────────────┴──────────┴────────┘
```
