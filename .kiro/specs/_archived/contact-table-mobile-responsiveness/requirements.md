# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir problemas de responsividade mobile na tabela de contatos do WUZAPI Manager. Os problemas identificados incluem sobreposição de colunas (telefone e nome), desalinhamento do header fixo durante scroll horizontal, e quebra de layout na ilha de seleção (action buttons) em dispositivos móveis.

## Glossary

- **Contact_Table**: Componente de tabela que exibe a lista de contatos com colunas para checkbox, telefone, nome, tags e ações
- **Selection_Island**: Barra flutuante que aparece quando contatos são selecionados, contendo botões de ação (enviar mensagem, exportar)
- **Fixed_Header**: Cabeçalho da tabela que permanece visível durante scroll vertical
- **Mobile_Viewport**: Viewport com largura inferior a 768px (breakpoint md do Tailwind)
- **Column_Overlap**: Problema onde o conteúdo de uma coluna invade visualmente o espaço de outra coluna
- **Horizontal_Scroll**: Scroll lateral necessário quando o conteúdo da tabela excede a largura do viewport

## Requirements

### Requirement 1

**User Story:** Como usuário mobile, eu quero que as colunas de telefone e nome sejam exibidas sem sobreposição, para que eu possa ler claramente ambas as informações

#### Acceptance Criteria

1. WHEN THE Contact_Table é renderizada em Mobile_Viewport, THE Contact_Table SHALL aplicar larguras mínimas adequadas para cada coluna
2. WHILE o usuário visualiza a Contact_Table em Mobile_Viewport, THE Contact_Table SHALL permitir Horizontal_Scroll quando o conteúdo exceder a largura disponível
3. WHEN Column_Overlap ocorre, THE Contact_Table SHALL truncar texto longo com ellipsis ao invés de permitir sobreposição
4. THE Contact_Table SHALL definir largura mínima de 120px para a coluna de telefone
5. THE Contact_Table SHALL definir largura mínima de 100px para a coluna de nome

### Requirement 2

**User Story:** Como usuário mobile, eu quero que o header da tabela acompanhe o scroll horizontal, para que eu sempre saiba qual coluna estou visualizando

#### Acceptance Criteria

1. WHEN o usuário realiza Horizontal_Scroll na Contact_Table, THE Fixed_Header SHALL mover-se sincronizadamente com o corpo da tabela
2. WHILE Fixed_Header está ativo, THE Fixed_Header SHALL manter alinhamento perfeito com as colunas do corpo da tabela
3. WHEN Horizontal_Scroll atinge o final, THE Fixed_Header SHALL parar no mesmo ponto que o corpo da tabela
4. THE Contact_Table SHALL usar container com overflow-x-auto para sincronizar header e body
5. THE Fixed_Header SHALL aplicar position sticky apenas no eixo vertical, não no horizontal

### Requirement 3

**User Story:** Como usuário mobile, eu quero que a ilha de seleção respeite os limites da tela, para que eu possa acessar todos os botões de ação sem quebra de layout

#### Acceptance Criteria

1. WHEN Selection_Island é exibida em Mobile_Viewport, THE Selection_Island SHALL ajustar seu layout para caber na largura disponível
2. WHILE Selection_Island contém múltiplos botões, THE Selection_Island SHALL empilhar botões verticalmente ou usar scroll horizontal interno
3. WHEN a largura do Mobile_Viewport é inferior a 640px, THE Selection_Island SHALL reduzir padding e espaçamento entre botões
4. THE Selection_Island SHALL aplicar max-width de 100vw menos padding lateral
5. THE Selection_Island SHALL usar flex-wrap ou grid responsivo para organizar botões em Mobile_Viewport

### Requirement 4

**User Story:** Como usuário mobile, eu quero que a tabela utilize todo o espaço disponível eficientemente, para que eu possa visualizar o máximo de informações possível

#### Acceptance Criteria

1. WHEN Contact_Table é renderizada em Mobile_Viewport, THE Contact_Table SHALL remover padding excessivo das células
2. WHILE em Mobile_Viewport, THE Contact_Table SHALL reduzir tamanho de fonte para 14px ou menor quando apropriado
3. WHEN a coluna de ações contém ícones, THE Contact_Table SHALL usar apenas ícones sem texto em Mobile_Viewport
4. THE Contact_Table SHALL aplicar padding de 8px ou menos nas células em Mobile_Viewport
5. THE Contact_Table SHALL ocultar colunas não essenciais (como tags) em viewports menores que 640px

### Requirement 5

**User Story:** Como desenvolvedor, eu quero que as correções de responsividade sejam implementadas usando Tailwind CSS, para manter consistência com o resto da aplicação

#### Acceptance Criteria

1. THE Contact_Table SHALL usar classes responsivas do Tailwind (sm:, md:, lg:) para ajustes de layout
2. THE Contact_Table SHALL evitar CSS inline ou styled-components para regras de responsividade
3. WHEN breakpoints customizados são necessários, THE Contact_Table SHALL usar classes Tailwind existentes ou adicionar ao tailwind.config.ts
4. THE Contact_Table SHALL usar utilities do Tailwind como min-w-*, max-w-*, truncate, overflow-x-auto
5. THE Selection_Island SHALL usar classes Tailwind para flex, grid e spacing responsivos
