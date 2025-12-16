# Requirements Document

## Introduction

Este documento define os requisitos para o sistema de atribuição automática de conversas para agentes. O sistema deve distribuir automaticamente novas conversas entre agentes online, permitir que usuários (owners) vejam todas as conversas, e garantir que agentes vejam apenas conversas atribuídas a eles ou não atribuídas (disponíveis para pegar).

## Glossary

- **Agent**: Usuário com papel de atendente que responde conversas em inboxes atribuídas
- **User/Owner**: Proprietário da conta que tem acesso total a todas as conversas
- **Inbox**: Caixa de entrada que agrupa conversas e agentes
- **Conversation**: Uma conversa com um contato do WhatsApp
- **Assignment**: Atribuição de uma conversa a um agente específico
- **Availability**: Status de disponibilidade do agente (online, offline, busy, away)
- **Round-Robin**: Algoritmo de distribuição que alterna entre agentes disponíveis

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want new conversations to be automatically assigned to available agents, so that customers receive timely responses.

#### Acceptance Criteria

1. WHEN a new conversation is created in an inbox THEN the system SHALL automatically assign it to an online agent who is a member of that inbox
2. WHEN multiple agents are online in an inbox THEN the system SHALL use round-robin distribution to balance workload
3. WHEN no agents are online in an inbox THEN the system SHALL leave the conversation unassigned (assigned_agent_id = NULL)
4. WHEN an agent goes online THEN the system SHALL NOT automatically assign existing unassigned conversations to them
5. WHEN a conversation is auto-assigned THEN the system SHALL log the assignment action for audit purposes

### Requirement 2

**User Story:** As an agent, I want to see only conversations assigned to me or available to pick up, so that I can focus on my work without confusion.

#### Acceptance Criteria

1. WHEN an agent views the conversation list THEN the system SHALL display only conversations where assigned_agent_id equals the agent's ID OR assigned_agent_id is NULL (unassigned)
2. WHEN an agent views an unassigned conversation THEN the system SHALL display a visual indicator that the conversation is available
3. WHEN an agent clicks on an unassigned conversation THEN the system SHALL automatically assign it to that agent
4. WHEN a conversation is assigned to another agent THEN the system SHALL NOT display it in the current agent's list
5. WHEN filtering conversations THEN the system SHALL provide options to filter by "Minhas conversas" (assigned to me) and "Disponíveis" (unassigned)

### Requirement 3

**User Story:** As a user/owner, I want to see all conversations regardless of assignment, so that I can monitor and manage all customer interactions.

#### Acceptance Criteria

1. WHEN a user/owner views the conversation list THEN the system SHALL display all conversations from all inboxes
2. WHEN a user/owner views a conversation THEN the system SHALL display which agent is assigned (if any)
3. WHEN a user/owner manually assigns a conversation to an agent THEN the system SHALL update the assignment immediately
4. WHEN a user/owner views the conversation list THEN the system SHALL NOT filter by assigned_agent_id

### Requirement 4

**User Story:** As an agent, I want to change my availability status, so that the system knows when I'm available to receive new conversations.

#### Acceptance Criteria

1. WHEN an agent changes their availability to "online" THEN the system SHALL include them in the auto-assignment pool
2. WHEN an agent changes their availability to "offline" THEN the system SHALL exclude them from the auto-assignment pool
3. WHEN an agent changes their availability to "busy" THEN the system SHALL exclude them from the auto-assignment pool but keep existing assignments
4. WHEN an agent changes their availability THEN the system SHALL persist the status across sessions
5. WHEN an agent logs out THEN the system SHALL automatically set their availability to "offline"

### Requirement 5

**User Story:** As an agent, I want to transfer a conversation to another agent, so that the right person can handle specific issues.

#### Acceptance Criteria

1. WHEN an agent transfers a conversation THEN the system SHALL update assigned_agent_id to the target agent
2. WHEN an agent transfers a conversation THEN the system SHALL remove it from the original agent's list
3. WHEN an agent transfers a conversation THEN the system SHALL add it to the target agent's list immediately
4. WHEN an agent attempts to transfer to an offline agent THEN the system SHALL display a warning but allow the transfer
5. WHEN a conversation is transferred THEN the system SHALL log the transfer action with both agent IDs

### Requirement 6

**User Story:** As an agent, I want to release a conversation back to the pool, so that other agents can pick it up if I cannot handle it.

#### Acceptance Criteria

1. WHEN an agent releases a conversation THEN the system SHALL set assigned_agent_id to NULL
2. WHEN a conversation is released THEN the system SHALL make it visible to all agents in the inbox
3. WHEN a conversation is released THEN the system SHALL NOT auto-assign it to another agent immediately
4. WHEN a conversation is released THEN the system SHALL log the release action

### Requirement 7

**User Story:** As a system administrator, I want to configure auto-assignment settings per inbox, so that different inboxes can have different assignment behaviors.

#### Acceptance Criteria

1. WHEN configuring an inbox THEN the system SHALL provide an option to enable/disable auto-assignment
2. WHEN auto-assignment is disabled for an inbox THEN the system SHALL leave all new conversations unassigned
3. WHEN configuring an inbox THEN the system SHALL provide an option to set maximum concurrent conversations per agent
4. WHEN an agent reaches their maximum concurrent conversations THEN the system SHALL skip them in the round-robin rotation

