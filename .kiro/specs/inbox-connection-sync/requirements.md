# Requirements Document

## Introduction

Este documento especifica os requisitos para sincronização dos dados de conexão quando o usuário altera a caixa de entrada (inbox) selecionada. Atualmente, ao mudar a inbox no seletor, os dados exibidos na aba "Conexão" não são atualizados para refletir a inbox correspondente.

## Glossary

- **Inbox**: Caixa de entrada do WhatsApp associada a um número/conta específica
- **Connection_Panel**: Painel que exibe informações de conexão da inbox (status, token, ID, controles)
- **Inbox_Selector**: Componente dropdown que permite ao usuário alternar entre suas inboxes
- **Connection_Status**: Estado atual da conexão WhatsApp (conectado, desconectado, aguardando QR)
- **User_Info_Card**: Card que exibe informações do usuário/inbox (nome, foto, ID, token)
- **Connection_Control_Card**: Card com botões de controle da conexão (atualizar status, desconectar, logout)

## Requirements

### Requirement 1: Sincronização de Dados ao Mudar Inbox

**User Story:** Como usuário, quero que ao selecionar uma inbox diferente no seletor, todos os dados da aba Conexão sejam atualizados para mostrar as informações da inbox selecionada, para que eu possa gerenciar cada conexão corretamente.

#### Acceptance Criteria

1. WHEN o usuário seleciona uma inbox diferente no Inbox_Selector THEN o Connection_Panel SHALL atualizar todos os dados exibidos para corresponder à inbox selecionada
2. WHEN a inbox selecionada muda THEN o User_Info_Card SHALL exibir o nome, foto e ID da inbox correspondente
3. WHEN a inbox selecionada muda THEN o Connection_Status SHALL refletir o estado de conexão da inbox selecionada
4. WHEN a inbox selecionada muda THEN o token de acesso exibido SHALL corresponder ao token da inbox selecionada
5. WHEN a inbox selecionada muda THEN o Connection_Control_Card SHALL operar sobre a inbox atualmente selecionada

### Requirement 2: Feedback Visual Durante Carregamento

**User Story:** Como usuário, quero ver um indicador de carregamento enquanto os dados da nova inbox são buscados, para saber que a mudança está sendo processada.

#### Acceptance Criteria

1. WHEN o usuário seleciona uma inbox diferente THEN o Connection_Panel SHALL exibir um estado de carregamento
2. WHEN os dados da nova inbox são carregados com sucesso THEN o Connection_Panel SHALL remover o estado de carregamento e exibir os dados
3. IF ocorrer um erro ao carregar os dados da inbox THEN o Connection_Panel SHALL exibir uma mensagem de erro apropriada

### Requirement 3: Persistência da Inbox Selecionada

**User Story:** Como usuário, quero que a inbox selecionada seja mantida ao navegar entre abas (Dashboard/Conexão), para não precisar selecionar novamente.

#### Acceptance Criteria

1. WHEN o usuário navega da aba Dashboard para Conexão THEN o Inbox_Selector SHALL manter a inbox previamente selecionada
2. WHEN o usuário navega da aba Conexão para Dashboard THEN o Inbox_Selector SHALL manter a inbox previamente selecionada
3. WHEN a página é recarregada THEN o Inbox_Selector SHALL restaurar a última inbox selecionada (se disponível)

### Requirement 4: Ações de Controle na Inbox Correta

**User Story:** Como usuário, quero que as ações de controle (Atualizar Status, Desconectar, Logout WhatsApp) sejam executadas na inbox atualmente selecionada, para evitar ações acidentais em outras inboxes.

#### Acceptance Criteria

1. WHEN o usuário clica em "Atualizar Status" THEN o Connection_Control_Card SHALL atualizar o status da inbox atualmente selecionada
2. WHEN o usuário clica em "Desconectar" THEN o Connection_Control_Card SHALL desconectar a inbox atualmente selecionada
3. WHEN o usuário clica em "Logout WhatsApp" THEN o Connection_Control_Card SHALL fazer logout da inbox atualmente selecionada
4. WHEN uma ação de controle é executada THEN o Connection_Panel SHALL atualizar os dados para refletir o novo estado
