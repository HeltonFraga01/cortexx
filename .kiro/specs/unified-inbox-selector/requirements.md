# Requirements Document

## Introduction

Este documento define os requisitos para unificar e aprimorar o seletor de caixas de entrada (inbox) no sistema. Atualmente existem dois seletores redundantes: um no header global e outro dentro do sidebar do chat. O objetivo é consolidar em um único seletor no topo com funcionalidades avançadas de seleção múltipla e opção "Todas as Caixas".

## Glossary

- **Inbox_Selector**: Componente dropdown para seleção de caixas de entrada
- **Header_Selector**: Seletor de inbox localizado no header global do sistema
- **Chat_Sidebar_Selector**: Seletor de inbox localizado dentro do sidebar de conversas (a ser removido)
- **Multi_Select**: Modo de seleção que permite escolher múltiplas inboxes simultaneamente
- **All_Inboxes**: Opção especial que representa todas as caixas de entrada disponíveis

## Requirements

### Requirement 1: Remoção do Seletor Duplicado no Chat

**User Story:** Como usuário, quero ter apenas um controle de seleção de inbox, para evitar confusão e redundância na interface.

#### Acceptance Criteria

1. WHEN o usuário acessa a página de chat THEN o Sistema SHALL exibir apenas o seletor de inbox no header
2. THE Chat_Sidebar SHALL NOT exibir o componente InboxSelector
3. THE Chat_Sidebar SHALL usar o contexto de inbox do header para filtrar conversas
4. WHEN o usuário muda a inbox no header THEN o Chat_Sidebar SHALL atualizar automaticamente as conversas exibidas

### Requirement 2: Opção "Todas as Caixas" no Header

**User Story:** Como usuário, quero poder ver conversas de todas as minhas caixas de entrada ao mesmo tempo, para ter uma visão unificada das mensagens.

#### Acceptance Criteria

1. THE Header_Selector SHALL exibir a opção "Todas as Caixas" como primeira opção do dropdown
2. WHEN o usuário seleciona "Todas as Caixas" THEN o Sistema SHALL carregar conversas de todas as inboxes disponíveis
3. WHEN "Todas as Caixas" está selecionado THEN o Header_Selector SHALL exibir "Todas as Caixas" como texto do botão
4. THE Sistema SHALL manter a contagem de mensagens não lidas agregada de todas as inboxes
5. WHEN "Todas as Caixas" está selecionado THEN o Sistema SHALL exibir indicador de qual inbox cada conversa pertence

### Requirement 3: Seleção Múltipla de Inboxes

**User Story:** Como usuário com múltiplas caixas de entrada, quero poder selecionar um subconjunto específico de inboxes para visualizar, para focar em determinados números WhatsApp.

#### Acceptance Criteria

1. THE Header_Selector SHALL permitir seleção de múltiplas inboxes via checkboxes
2. WHEN múltiplas inboxes estão selecionadas THEN o Sistema SHALL filtrar conversas apenas das inboxes selecionadas
3. THE Header_Selector SHALL exibir contador de inboxes selecionadas quando mais de uma está ativa
4. WHEN o usuário clica em uma inbox já selecionada THEN o Sistema SHALL desmarcar essa inbox
5. THE Sistema SHALL manter pelo menos uma inbox selecionada (não permitir desmarcar todas)
6. WHEN múltiplas inboxes estão selecionadas THEN o Header_Selector SHALL exibir "X caixas selecionadas"

### Requirement 4: Indicador Visual de Inbox por Conversa

**User Story:** Como usuário visualizando conversas de múltiplas inboxes, quero identificar facilmente de qual caixa de entrada cada conversa pertence.

#### Acceptance Criteria

1. WHEN múltiplas inboxes ou "Todas as Caixas" está selecionado THEN cada conversa SHALL exibir badge com nome/ícone da inbox
2. THE Badge SHALL usar cor ou ícone distintivo para cada inbox
3. THE Badge SHALL ser compacto para não ocupar muito espaço na lista
4. WHEN apenas uma inbox está selecionada THEN o Sistema SHALL NOT exibir o badge de inbox nas conversas

### Requirement 5: Persistência de Seleção

**User Story:** Como usuário, quero que minha seleção de inboxes seja lembrada entre sessões, para não precisar reconfigurar toda vez que acesso o sistema.

#### Acceptance Criteria

1. THE Sistema SHALL persistir a seleção de inboxes do usuário
2. WHEN o usuário faz login THEN o Sistema SHALL restaurar a última seleção de inboxes
3. IF a seleção salva inclui inboxes que não existem mais THEN o Sistema SHALL ignorar essas inboxes
4. THE Sistema SHALL usar "Todas as Caixas" como padrão para novos usuários

### Requirement 6: Contagem de Mensagens por Inbox

**User Story:** Como usuário, quero ver quantas mensagens não lidas tenho em cada inbox no seletor, para priorizar qual caixa verificar.

#### Acceptance Criteria

1. THE Header_Selector SHALL exibir contador de mensagens não lidas ao lado de cada inbox no dropdown
2. THE Contador SHALL ser atualizado em tempo real quando novas mensagens chegam
3. WHEN uma inbox tem zero mensagens não lidas THEN o Sistema SHALL NOT exibir o contador
4. THE Opção "Todas as Caixas" SHALL exibir o total agregado de mensagens não lidas

### Requirement 7: Status de Conexão no Seletor

**User Story:** Como usuário, quero ver o status de conexão de cada inbox no seletor, para saber quais estão funcionando.

#### Acceptance Criteria

1. THE Header_Selector SHALL exibir indicador de status (verde/vermelho) ao lado de cada inbox
2. WHEN uma inbox está desconectada THEN o Sistema SHALL exibir indicador vermelho
3. WHEN uma inbox está conectada THEN o Sistema SHALL exibir indicador verde
4. THE Status SHALL ser atualizado periodicamente (a cada 30 segundos)
5. WHEN "Todas as Caixas" está selecionado e alguma inbox está desconectada THEN o Sistema SHALL exibir indicador amarelo de alerta

</content>
</invoke>