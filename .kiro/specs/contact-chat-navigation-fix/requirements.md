# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o bug de navegação do chat a partir da página de contatos. Atualmente, quando um agente clica no botão de chat em um contato na página `/agent/contacts`, o sistema mostra um toast de sucesso "Conversa iniciada", mas a conversa não é selecionada/aberta na página de chat - a tela continua mostrando "Selecione uma conversa".

## Glossary

- **Chat_Layout**: Componente principal que gerencia a interface de chat, incluindo sidebar de conversas, visualização de mensagens e painel de contato
- **Contacts_Table**: Componente que exibe a tabela de contatos com ações inline, incluindo o botão de iniciar chat
- **Agent_Inbox_Context**: Contexto React que fornece informações sobre as caixas de entrada do agente e habilita o modo agente
- **Chat_API**: Hook que retorna as funções de API apropriadas baseado no contexto (modo agente ou modo usuário)
- **Conversation_ID**: Identificador único de uma conversa passado via query parameter na URL

## Requirements

### Requirement 1: Navegação para Chat com Conversa Selecionada

**User Story:** Como um agente, eu quero clicar no botão de chat de um contato e ser redirecionado para a página de chat com a conversa já aberta, para que eu possa começar a enviar mensagens imediatamente.

#### Acceptance Criteria

1. WHEN um agente clica no botão de chat de um contato na página de contatos THEN THE Chat_Layout SHALL carregar e selecionar a conversa correspondente automaticamente
2. WHEN a página de chat é carregada com um parâmetro `conversation` na URL THEN THE Chat_Layout SHALL aguardar o Chat_API estar pronto no modo correto antes de carregar a conversa
3. WHEN a conversa é carregada com sucesso THEN THE Chat_Layout SHALL exibir a conversa selecionada no painel central
4. IF o carregamento da conversa falhar THEN THE Chat_Layout SHALL exibir uma mensagem de erro apropriada ao usuário

### Requirement 2: Consistência entre Modos de Operação

**User Story:** Como um desenvolvedor, eu quero que o sistema de navegação funcione consistentemente tanto no modo agente quanto no modo usuário, para que a experiência seja uniforme.

#### Acceptance Criteria

1. WHEN navegando de `/agent/contacts` para `/agent/chat` THEN THE Chat_Layout SHALL usar o Chat_API no modo agente
2. WHEN navegando de `/user/contacts` para `/user/chat` THEN THE Chat_Layout SHALL usar o Chat_API no modo usuário
3. WHEN o Chat_API muda de modo durante o carregamento THEN THE Chat_Layout SHALL recarregar a conversa com o modo correto

### Requirement 3: Feedback Visual Durante Carregamento

**User Story:** Como um agente, eu quero ver feedback visual enquanto a conversa está sendo carregada, para que eu saiba que o sistema está processando minha solicitação.

#### Acceptance Criteria

1. WHEN a conversa está sendo carregada da URL THEN THE Chat_Layout SHALL exibir um indicador de carregamento
2. WHEN o carregamento é concluído com sucesso THEN THE Chat_Layout SHALL remover o indicador de carregamento e exibir a conversa
3. IF o carregamento falhar THEN THE Chat_Layout SHALL remover o indicador de carregamento e exibir o estado vazio com mensagem de erro

### Requirement 4: Limpeza de Parâmetros da URL

**User Story:** Como um usuário, eu quero que o parâmetro de conversa seja removido da URL após a conversa ser carregada, para que a URL fique limpa e eu possa compartilhá-la ou recarregar a página sem problemas.

#### Acceptance Criteria

1. WHEN a conversa é carregada com sucesso da URL THEN THE Chat_Layout SHALL remover o parâmetro `conversation` da URL
2. WHEN o carregamento da conversa falha THEN THE Chat_Layout SHALL remover o parâmetro `conversation` da URL
3. THE Chat_Layout SHALL usar `replace: true` ao atualizar a URL para não criar entradas desnecessárias no histórico
