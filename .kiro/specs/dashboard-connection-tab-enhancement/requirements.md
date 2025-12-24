# Requirements Document

## Introduction

Aprimorar a aba "Conexão" do Dashboard do usuário (`/user/dashboard`) para exibir as mesmas informações e funcionalidades que já funcionam na página de edição de inbox (`/user/inboxes/edit/:id`). Atualmente, a página de edição tem uma experiência mais completa com avatar, status visual, ID, JID, token e ações rápidas, enquanto a aba de conexão do Dashboard usa componentes mais simples.

## Glossary

- **Dashboard**: Página principal do usuário em `/user/dashboard`
- **Connection_Tab**: Aba "Conexão" dentro do Dashboard
- **Inbox_Edit_Page**: Página de edição de inbox em `/user/inboxes/edit/:id`
- **InboxInfoCard**: Componente compartilhado que exibe informações da inbox
- **ConnectionControlCard**: Componente compartilhado que exibe controles de conexão
- **WUZAPI**: API de WhatsApp que fornece status de conexão em tempo real
- **Session_Status**: Status da sessão WhatsApp (connected, loggedIn)

## Requirements

### Requirement 1: Exibir Card de Informações da Conexão Completo

**User Story:** Como usuário, quero ver todas as informações da minha conexão WhatsApp na aba Conexão do Dashboard, assim como vejo na página de edição de inbox.

#### Acceptance Criteria

1. WHEN a aba Conexão é exibida THEN THE Connection_Tab SHALL mostrar um card com avatar, nome da inbox, status e informações detalhadas
2. WHEN o usuário está logado no WhatsApp THEN THE Connection_Tab SHALL exibir o avatar do perfil WhatsApp
3. WHEN o avatar não está disponível THEN THE Connection_Tab SHALL exibir um fallback com ícone de usuário
4. THE Connection_Tab SHALL exibir o ID da inbox com botão de copiar
5. THE Connection_Tab SHALL exibir o JID WhatsApp (quando disponível) com botão de copiar
6. THE Connection_Tab SHALL exibir o token de acesso com botão de copiar e opção de mostrar/ocultar
7. WHEN o status muda THEN THE Connection_Tab SHALL atualizar o badge de status (Logado/Conectado/Offline)

### Requirement 2: Exibir Ações Rápidas

**User Story:** Como usuário, quero ter acesso rápido às ações de conexão diretamente no card de informações.

#### Acceptance Criteria

1. THE Connection_Tab SHALL exibir botão "Gerar QR Code" no card de informações
2. THE Connection_Tab SHALL exibir botão "Atualizar Status" no card de informações
3. WHEN o botão "Gerar QR Code" é clicado THEN THE Connection_Tab SHALL iniciar o processo de geração de QR
4. WHEN o botão "Atualizar Status" é clicado THEN THE Connection_Tab SHALL atualizar o status da conexão
5. WHILE uma ação está em progresso THEN THE Connection_Tab SHALL exibir indicador de loading no botão

### Requirement 3: Manter Consistência Visual com Página de Edição

**User Story:** Como usuário, quero que a experiência visual seja consistente entre a aba Conexão do Dashboard e a página de edição de inbox.

#### Acceptance Criteria

1. THE Connection_Tab SHALL usar o mesmo layout de card com avatar à esquerda e informações à direita
2. THE Connection_Tab SHALL usar as mesmas cores de badge de status (verde para logado, amarelo para conectado, cinza para offline)
3. THE Connection_Tab SHALL usar os mesmos ícones para cada tipo de informação (Hash para ID, Phone para JID, Key para token)
4. THE Connection_Tab SHALL manter o mesmo espaçamento e tipografia

### Requirement 4: Botão de Navegação para Configurações

**User Story:** Como usuário, quero poder acessar rapidamente a página de configurações completas da inbox.

#### Acceptance Criteria

1. THE Connection_Tab SHALL exibir botão "Configurações" no card de informações
2. WHEN o botão "Configurações" é clicado THEN THE Connection_Tab SHALL navegar para `/user/inboxes/edit/:inboxId`

### Requirement 5: Sincronização de Status em Tempo Real

**User Story:** Como usuário, quero que o status de conexão seja atualizado automaticamente para refletir o estado real.

#### Acceptance Criteria

1. THE Connection_Tab SHALL usar o sessionStatus do WUZAPI como fonte de verdade para o status
2. THE Connection_Tab SHALL atualizar o status via polling a cada 10 segundos
3. WHEN o status muda THEN THE Connection_Tab SHALL atualizar todos os indicadores visuais imediatamente
4. IF o sessionStatus não está disponível THEN THE Connection_Tab SHALL usar o connectionData como fallback
