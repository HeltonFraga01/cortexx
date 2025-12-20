# Requirements Document

## Introduction

Esta funcionalidade adiciona a exibição do status de conexão (online/offline) das caixas de entrada no dashboard do agente. Atualmente, a página de caixas de entrada do agente (`AgentInboxesPage`) lista as caixas atribuídas, mas não mostra se cada uma está conectada ao WhatsApp ou não. O objetivo é permitir que o agente visualize rapidamente quais caixas de entrada estão online e prontas para receber/enviar mensagens.

## Glossary

- **Agent_Dashboard**: Interface do agente autenticado onde ele visualiza suas caixas de entrada, conversas e contatos
- **Inbox**: Caixa de entrada que representa um canal de comunicação (WhatsApp, Email, etc.)
- **Connection_Status**: Estado da conexão da caixa de entrada com o serviço externo (WhatsApp)
- **Online_Status**: Indica que a caixa de entrada está conectada e logada no WhatsApp, pronta para uso
- **Offline_Status**: Indica que a caixa de entrada não está conectada ou não está logada no WhatsApp
- **WUZAPI**: Serviço externo de API do WhatsApp Business utilizado para conexão

## Requirements

### Requirement 1: Exibição do Status de Conexão nas Caixas de Entrada

**User Story:** Como um agente, eu quero ver o status de conexão de cada caixa de entrada atribuída a mim, para que eu saiba quais estão disponíveis para enviar e receber mensagens.

#### Acceptance Criteria

1. WHEN a página de caixas de entrada do agente é carregada, THE Agent_Dashboard SHALL buscar o status de conexão de cada caixa de entrada do tipo WhatsApp
2. WHEN uma caixa de entrada está conectada e logada, THE Agent_Dashboard SHALL exibir um indicador visual verde com o texto "Online" ou "Conectado"
3. WHEN uma caixa de entrada está desconectada, THE Agent_Dashboard SHALL exibir um indicador visual cinza/vermelho com o texto "Offline" ou "Desconectado"
4. WHEN uma caixa de entrada está conectando (aguardando QR code), THE Agent_Dashboard SHALL exibir um indicador visual amarelo com o texto "Conectando" ou "Aguardando QR"
5. WHEN uma caixa de entrada não é do tipo WhatsApp, THE Agent_Dashboard SHALL não exibir indicador de status de conexão

### Requirement 2: Atualização Automática do Status

**User Story:** Como um agente, eu quero que o status das caixas de entrada seja atualizado automaticamente, para que eu tenha informações em tempo real sem precisar recarregar a página.

#### Acceptance Criteria

1. WHEN a página de caixas de entrada está aberta, THE Agent_Dashboard SHALL atualizar o status de conexão a cada 30 segundos
2. WHEN o agente clica no botão de atualizar, THE Agent_Dashboard SHALL buscar imediatamente o status atualizado de todas as caixas de entrada
3. WHILE o status está sendo carregado, THE Agent_Dashboard SHALL exibir um indicador de carregamento no lugar do status

### Requirement 3: Resumo de Status no Dashboard Principal

**User Story:** Como um agente, eu quero ver um resumo rápido de quantas caixas de entrada estão online no dashboard principal, para ter uma visão geral sem precisar navegar para a página de caixas de entrada.

#### Acceptance Criteria

1. WHEN o dashboard principal do agente é carregado, THE Agent_Dashboard SHALL exibir o número de caixas de entrada online vs total
2. WHEN todas as caixas de entrada estão offline, THE Agent_Dashboard SHALL exibir um alerta visual indicando que nenhuma caixa está disponível
3. WHEN pelo menos uma caixa de entrada está online, THE Agent_Dashboard SHALL exibir o contador com destaque positivo (verde)

### Requirement 4: Endpoint de Status para Agentes

**User Story:** Como desenvolvedor, eu preciso de um endpoint que retorne o status de conexão das caixas de entrada do agente, para que o frontend possa exibir essas informações.

#### Acceptance Criteria

1. WHEN um agente autenticado faz requisição ao endpoint de status, THE Backend SHALL retornar o status de conexão de todas as caixas de entrada atribuídas ao agente
2. WHEN o agente não tem caixas de entrada atribuídas, THE Backend SHALL retornar uma lista vazia
3. IF um agente não autenticado tenta acessar o endpoint, THEN THE Backend SHALL retornar erro 401 Unauthorized
4. WHEN o serviço WUZAPI está indisponível, THE Backend SHALL retornar status "unknown" para as caixas afetadas
