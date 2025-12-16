# Requirements Document

## Introduction

Este documento define os requisitos para a funcionalidade de atribuição automática de bots em novas conversas. Quando um usuário tem bots configurados, novas conversas devem ser automaticamente atribuídas ao bot padrão/prioritário. Usuários podem definir a ordem de prioridade dos bots nas configurações.

## Glossary

- **Bot**: Agente automatizado que processa mensagens de uma conversa via webhook
- **Conversa**: Thread de mensagens entre o usuário e um contato do WhatsApp
- **Bot Padrão**: Bot com maior prioridade que será atribuído automaticamente a novas conversas
- **Prioridade**: Número que define a ordem de preferência dos bots (menor número = maior prioridade)

## Requirements

### Requirement 1

**User Story:** Como usuário, quero que novas conversas sejam automaticamente atribuídas ao meu bot padrão, para que eu não precise atribuir manualmente cada conversa.

#### Acceptance Criteria

1. WHEN uma nova conversa é criada AND o usuário possui pelo menos um bot ativo THEN o Sistema SHALL atribuir automaticamente o bot com maior prioridade à conversa
2. WHEN uma nova conversa é criada AND o usuário não possui bots ativos THEN o Sistema SHALL criar a conversa sem bot atribuído
3. WHEN uma nova conversa é criada AND o bot padrão está pausado THEN o Sistema SHALL atribuir o próximo bot ativo na ordem de prioridade
4. WHEN todos os bots do usuário estão pausados THEN o Sistema SHALL criar a conversa sem bot atribuído

### Requirement 2

**User Story:** Como usuário, quero definir a ordem de prioridade dos meus bots, para que eu possa controlar qual bot será atribuído automaticamente às novas conversas.

#### Acceptance Criteria

1. WHEN o usuário visualiza a lista de bots THEN o Sistema SHALL exibir a prioridade atual de cada bot
2. WHEN o usuário altera a prioridade de um bot THEN o Sistema SHALL persistir a nova prioridade imediatamente
3. WHEN o usuário cria um novo bot THEN o Sistema SHALL atribuir a menor prioridade (maior número) ao novo bot
4. WHEN dois bots possuem a mesma prioridade THEN o Sistema SHALL usar o bot criado mais recentemente como desempate

### Requirement 3

**User Story:** Como usuário, quero poder marcar um bot como "bot padrão" de forma explícita, para facilitar a identificação de qual bot será usado em novas conversas.

#### Acceptance Criteria

1. WHEN o usuário marca um bot como padrão THEN o Sistema SHALL definir a prioridade desse bot como 1 (maior prioridade)
2. WHEN o usuário marca um bot como padrão AND já existe outro bot padrão THEN o Sistema SHALL remover o status de padrão do bot anterior
3. WHEN o usuário visualiza a lista de bots THEN o Sistema SHALL destacar visualmente o bot padrão
4. WHEN o bot padrão é excluído THEN o Sistema SHALL promover o próximo bot na ordem de prioridade como padrão

### Requirement 4

**User Story:** Como usuário, quero reordenar meus bots usando drag-and-drop, para facilitar a definição de prioridades.

#### Acceptance Criteria

1. WHEN o usuário arrasta um bot para uma nova posição THEN o Sistema SHALL atualizar as prioridades de todos os bots afetados
2. WHEN o usuário arrasta um bot para a primeira posição THEN o Sistema SHALL definir esse bot como o novo bot padrão
3. WHEN a reordenação é concluída THEN o Sistema SHALL persistir as novas prioridades no banco de dados
4. WHEN ocorre erro na persistência THEN o Sistema SHALL reverter a ordem visual e exibir mensagem de erro
