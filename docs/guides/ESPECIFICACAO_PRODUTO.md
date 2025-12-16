# Especificação do Produto - WUZAPI Manager

## 1. Visão Geral do Produto

### 1.1 Propósito
O WUZAPI Manager é um sistema completo de gerenciamento para WUZAPI (WhatsApp Business API) com interface web moderna, permitindo o gerenciamento de instâncias WhatsApp Business, envio de mensagens, configuração de webhooks e integração com bancos de dados.

### 1.2 Público-Alvo
- **Administradores**: Gerenciam usuários, configurações do sistema e integrações
- **Usuários**: Enviam mensagens, configuram webhooks e acessam dados
- **Empresas**: Que precisam automatizar comunicação via WhatsApp Business

### 1.3 Objetivos do Produto
- Simplificar o gerenciamento de instâncias WhatsApp Business
- Fornecer interface intuitiva para envio de mensagens
- Permitir configuração flexível de webhooks para eventos WhatsApp
- Integrar com bancos de dados externos (NocoDB, etc.)
- Oferecer deploy simplificado via Docker Swarm

## 2. Funcionalidades Principais

### 2.1 Dashboard Administrativo

#### 2.1.1 Gerenciamento de Usuários
- **Criar Usuário**: Formulário com nome, email, telefone, token único
- **Listar Usuários**: Tabela com todos os usuários cadastrados
- **Editar Usuário**: Atualizar informações do usuário
- **Deletar Usuário**: Remover usuário do sistema
- **Visualizar Token**: Exibir token de autenticação do usuário

#### 2.1.2 Configuração de Banco de Dados
- **Adicionar Conexão**: Configurar conexão com NocoDB ou outro banco
- **Testar Conexão**: Validar credenciais e conectividade
- **Listar Conexões**: Visualizar todas as conexões configuradas
- **Editar Conexão**: Atualizar configurações de conexão
- **Remover Conexão**: Deletar conexão do sistema

#### 2.1.3 Configurações de Marca (Branding)
- **Logo**: Upload de logo personalizado
- **Cores**: Definir cores primária e secundária
- **Nome da Empresa**: Configurar nome exibido no sistema
- **Favicon**: Upload de favicon personalizado

#### 2.1.4 Monitoramento do Sistema
- **Health Check**: Status de saúde do sistema
- **Estatísticas**: Número de usuários, mensagens enviadas, etc.
- **Logs**: Visualização de logs de atividade
- **Status WUZAPI**: Verificar conexão com API WhatsApp

### 2.2 Dashboard do Usuário

#### 2.2.1 Envio de Mensagens WhatsApp
- **Formulário de Envio**:
  - Campo de número (com validação de formato internacional)
  - Campo de mensagem (textarea com contador de caracteres)
  - Botão de envio
- **Modelos de Mensagem**:
  - Saudação
  - Agradecimento
  - Confirmação
  - Lembrete
  - Outros modelos personalizáveis
- **Histórico de Mensagens**:
  - Lista de mensagens enviadas
  - Status de entrega
  - Data e hora de envio
  - Filtros por data e status

#### 2.2.2 Configuração de Webhook
- **URL do Webhook**: Campo para inserir URL de destino
- **Seleção de Eventos**: Checkboxes para mais de 40 tipos de eventos:
  - message.received
  - message.sent
  - message.delivered
  - message.read
  - connection.update
  - qr.code
  - E muitos outros...
- **Teste de Webhook**: Botão para enviar evento de teste
- **Status**: Indicador visual de webhook ativo/inativo

#### 2.2.3 Configurações Pessoais
- **Dados Pessoais**: Nome, email, telefone
- **Alterar Senha**: Formulário de mudança de senha
- **Preferências**: Configurações de notificação e interface

#### 2.2.4 Navegação de Dados
- **Visualização de Tabelas**: Interface para visualizar dados do NocoDB
- **Filtros**: Busca e filtros por campos
- **Paginação**: Navegação entre páginas de dados
- **Edição**: Editar registros vinculados ao usuário

### 2.3 Sistema de Autenticação

#### 2.3.1 Login
- **Formulário**: Campo de token
- **Validação**: Verificar token no backend
- **Redirecionamento**: Admin ou User dashboard baseado no tipo de token
- **Persistência**: Manter sessão ativa

#### 2.3.2 Logout
- **Limpar Sessão**: Remover token do localStorage
- **Redirecionamento**: Voltar para página de login

### 2.4 Integrações

#### 2.4.1 WUZAPI (WhatsApp Business API)
- **Envio de Mensagens**: POST para endpoint de envio
- **Status de Sessão**: Verificar se instância está conectada
- **QR Code**: Obter QR code para conexão
- **Webhook**: Receber eventos do WhatsApp

#### 2.4.2 NocoDB
- **Listar Tabelas**: Obter lista de tabelas disponíveis
- **Buscar Dados**: Query de dados com filtros
- **Criar Registro**: Inserir novo registro
- **Atualizar Registro**: Editar registro existente
- **Deletar Registro**: Remover registro



## 3. Arquitetura Técnica

### 3.1 Stack Tecnológico

#### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5 com SWC
- **Estilização**: Tailwind CSS 3
- **Componentes UI**: shadcn/ui (Radix UI)
- **Gerenciamento de Estado**: React Context + TanStack Query
- **Roteamento**: React Router v6
- **Formulários**: React Hook Form + Zod
- **HTTP**: Axios

#### Backend
- **Runtime**: Node.js 20
- **Framework**: Express 4
- **Banco de Dados**: SQLite 3 com WAL mode
- **Validação**: Validadores customizados
- **Logging**: Winston
- **Segurança**: CORS, rate limiting, sanitização HTML

#### Deploy
- **Container**: Docker multi-stage
- **Orquestração**: Docker Swarm
- **Proxy Reverso**: Traefik v3 (SSL automático)
- **Persistência**: Volumes Docker

### 3.2 Estrutura de Diretórios

```
wuzapi-manager/
├── src/                    # Frontend React
│   ├── components/        # Componentes React
│   │   ├── admin/        # Dashboard admin
│   │   ├── user/         # Dashboard usuário
│   │   ├── ui/           # Componentes base
│   │   └── shared/       # Componentes compartilhados
│   ├── pages/            # Páginas de rota
│   ├── contexts/         # Contextos React
│   ├── services/         # Clientes API
│   ├── hooks/            # Hooks customizados
│   └── lib/              # Utilitários
├── server/                # Backend Node.js
│   ├── routes/           # Rotas Express
│   ├── middleware/       # Middlewares
│   ├── validators/       # Validadores
│   ├── utils/            # Utilitários
│   ├── migrations/       # Migrations SQLite
│   └── database.js       # Camada de banco
├── public/               # Arquivos estáticos
├── docs/                 # Documentação
└── scripts/              # Scripts utilitários
```

### 3.3 Fluxo de Dados

#### Autenticação
```
1. Usuário insere token
2. Frontend envia POST /api/auth/login
3. Backend valida token no SQLite
4. Retorna tipo de usuário (admin/user)
5. Frontend redireciona para dashboard apropriado
6. Token armazenado em localStorage
```

#### Envio de Mensagem
```
1. Usuário preenche formulário
2. Frontend valida dados (Zod)
3. POST /api/chat/send/text com token
4. Backend valida token e permissões
5. Backend envia para WUZAPI
6. WUZAPI processa e retorna status
7. Backend salva no histórico (SQLite)
8. Frontend exibe confirmação
```

#### Webhook
```
1. WhatsApp gera evento
2. WUZAPI recebe evento
3. WUZAPI envia para webhook configurado
4. Sistema do usuário recebe evento
5. Usuário processa evento
```

## 4. Requisitos Não-Funcionais

### 4.1 Performance
- **Tempo de Resposta**: < 500ms para 95% das requisições
- **Carregamento de Página**: < 2s para primeira carga
- **Capacidade**: Suportar 100 usuários simultâneos
- **Banco de Dados**: SQLite otimizado com WAL mode

### 4.2 Segurança
- **Autenticação**: Token-based (admin/user)
- **CORS**: Configurado para origens permitidas
- **Rate Limiting**: Proteção contra abuso de API
- **Sanitização**: HTML sanitizado para prevenir XSS
- **HTTPS**: SSL/TLS obrigatório em produção
- **Validação**: Validação de entrada em frontend e backend

### 4.3 Disponibilidade
- **Uptime**: 99.5% de disponibilidade
- **Health Check**: Endpoint /health para monitoramento
- **Backup**: Backup automático do SQLite
- **Recovery**: Restauração de backup em < 15 minutos

### 4.4 Escalabilidade
- **Arquitetura**: Single-node otimizado para SQLite
- **Recursos**: 1 CPU core, 512MB RAM mínimo
- **Armazenamento**: Volume persistente para dados
- **Limitação**: 1 réplica (constraint do SQLite)

### 4.5 Usabilidade
- **Interface**: Design moderno e intuitivo
- **Responsividade**: Funcional em desktop, tablet e mobile
- **Acessibilidade**: Seguir padrões WCAG 2.1
- **Feedback**: Mensagens claras de sucesso/erro
- **Loading**: Indicadores visuais de carregamento

### 4.6 Manutenibilidade
- **Código**: TypeScript para type safety
- **Testes**: Cobertura mínima de 70%
- **Documentação**: README, guias de deploy, API docs
- **Logs**: Logs estruturados com Winston
- **Migrations**: Automáticas no startup

## 5. Casos de Uso

### 5.1 UC01 - Administrador Cria Usuário
**Ator**: Administrador  
**Pré-condição**: Admin autenticado  
**Fluxo Principal**:
1. Admin acessa "Usuários" no menu
2. Clica em "Novo Usuário"
3. Preenche formulário (nome, email, telefone)
4. Sistema gera token único
5. Admin salva usuário
6. Sistema confirma criação
7. Admin visualiza token gerado

**Pós-condição**: Usuário criado e pode fazer login

### 5.2 UC02 - Usuário Envia Mensagem WhatsApp
**Ator**: Usuário  
**Pré-condição**: Usuário autenticado  
**Fluxo Principal**:
1. Usuário acessa "Mensagens"
2. Preenche número de destino
3. Escreve mensagem ou seleciona modelo
4. Clica em "Enviar"
5. Sistema valida dados
6. Sistema envia via WUZAPI
7. Sistema exibe confirmação
8. Mensagem aparece no histórico

**Fluxo Alternativo**:
- 5a. Número inválido: Sistema exibe erro
- 6a. WUZAPI offline: Sistema exibe erro de conexão

### 5.3 UC03 - Usuário Configura Webhook
**Ator**: Usuário  
**Pré-condição**: Usuário autenticado  
**Fluxo Principal**:
1. Usuário acessa "Configurações"
2. Insere URL do webhook
3. Seleciona eventos desejados
4. Clica em "Testar Webhook"
5. Sistema envia evento de teste
6. Sistema confirma recebimento
7. Usuário salva configuração
8. Sistema ativa webhook

**Fluxo Alternativo**:
- 5a. URL inválida: Sistema exibe erro
- 6a. Webhook não responde: Sistema exibe timeout

### 5.4 UC04 - Usuário Visualiza Dados do NocoDB
**Ator**: Usuário  
**Pré-condição**: Usuário autenticado, conexão NocoDB configurada  
**Fluxo Principal**:
1. Usuário acessa "Dados"
2. Seleciona conexão de banco
3. Sistema lista tabelas disponíveis
4. Usuário seleciona tabela
5. Sistema exibe dados paginados
6. Usuário aplica filtros (opcional)
7. Sistema atualiza visualização

**Fluxo Alternativo**:
- 3a. Conexão falha: Sistema exibe erro
- 5a. Sem dados: Sistema exibe mensagem vazia

## 6. Regras de Negócio

### 6.1 Autenticação
- RN01: Token de admin tem acesso total ao sistema
- RN02: Token de usuário tem acesso apenas ao seu dashboard
- RN03: Token deve ser único por usuário
- RN04: Sessão expira após 24 horas de inatividade

### 6.2 Mensagens
- RN05: Número deve estar no formato internacional (+55...)
- RN06: Mensagem não pode estar vazia
- RN07: Histórico mantém últimas 1000 mensagens por usuário
- RN08: Mensagens são salvas mesmo se envio falhar

### 6.3 Webhook
- RN09: URL deve ser HTTPS em produção
- RN10: Usuário pode configurar apenas 1 webhook
- RN11: Eventos são enviados em até 5 segundos
- RN12: Retry automático em caso de falha (3 tentativas)

### 6.4 Banco de Dados
- RN13: Usuário só acessa dados vinculados ao seu token
- RN14: Conexões são validadas antes de salvar
- RN15: Credenciais são armazenadas de forma segura
- RN16: Timeout de conexão: 10 segundos

## 7. Critérios de Aceitação

### 7.1 Dashboard Administrativo
- [ ] Admin consegue criar usuário com sucesso
- [ ] Admin visualiza lista de todos os usuários
- [ ] Admin consegue editar informações do usuário
- [ ] Admin consegue deletar usuário
- [ ] Admin visualiza token do usuário
- [ ] Admin configura conexão de banco de dados
- [ ] Admin testa conexão com sucesso
- [ ] Admin configura branding (logo, cores)
- [ ] Admin visualiza health check do sistema

### 7.2 Dashboard do Usuário
- [ ] Usuário envia mensagem com sucesso
- [ ] Usuário seleciona modelo de mensagem
- [ ] Usuário visualiza histórico de mensagens
- [ ] Usuário configura URL de webhook
- [ ] Usuário seleciona eventos de webhook
- [ ] Usuário testa webhook com sucesso
- [ ] Usuário visualiza dados do NocoDB
- [ ] Usuário aplica filtros nos dados
- [ ] Usuário edita suas configurações pessoais

### 7.3 Integrações
- [ ] Sistema envia mensagem via WUZAPI
- [ ] Sistema recebe eventos de webhook
- [ ] Sistema conecta com NocoDB
- [ ] Sistema lista tabelas do NocoDB
- [ ] Sistema busca dados do NocoDB
- [ ] Sistema valida credenciais de integração

### 7.4 Segurança
- [ ] Sistema valida token em todas as requisições
- [ ] Sistema bloqueia acesso não autorizado
- [ ] Sistema sanitiza entrada de usuário
- [ ] Sistema aplica rate limiting
- [ ] Sistema usa HTTPS em produção

### 7.5 Performance
- [ ] Página carrega em menos de 2 segundos
- [ ] API responde em menos de 500ms
- [ ] Sistema suporta 100 usuários simultâneos
- [ ] Banco de dados responde em menos de 100ms

## 8. Roadmap

### Versão 1.0 (Atual)
- ✅ Dashboard administrativo completo
- ✅ Dashboard do usuário completo
- ✅ Integração WUZAPI
- ✅ Sistema de webhook
- ✅ Integração NocoDB
- ✅ Deploy Docker Swarm
- ✅ SQLite com WAL mode

### Versão 1.1 (Próxima)
- [ ] Agendamento de mensagens
- [ ] Envio em massa
- [ ] Relatórios e analytics
- [ ] API pública documentada
- [ ] Suporte a múltiplas instâncias WUZAPI

### Versão 1.2 (Futuro)
- [ ] Chatbot integrado
- [ ] Templates de mensagem avançados
- [ ] Integração com CRM
- [ ] Dashboard de métricas
- [ ] Suporte a mídia (imagens, vídeos)

## 9. Glossário

- **WUZAPI**: API para integração com WhatsApp Business
- **Webhook**: URL que recebe notificações de eventos
- **NocoDB**: Banco de dados visual baseado em planilhas
- **Token**: Chave de autenticação única por usuário
- **WAL Mode**: Write-Ahead Logging para SQLite
- **Docker Swarm**: Orquestrador de containers
- **Traefik**: Proxy reverso com SSL automático
- **Health Check**: Verificação de saúde do sistema
- **Rate Limiting**: Limitação de requisições por tempo

## 10. Referências

- Documentação WUZAPI: https://wzapi.wasend.com.br
- Documentação NocoDB: https://docs.nocodb.com
- React Documentation: https://react.dev
- Express Documentation: https://expressjs.com
- SQLite Documentation: https://www.sqlite.org/docs.html
- Docker Swarm Documentation: https://docs.docker.com/engine/swarm/
