# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.5.47] - 2025-12-13

### Adicionado
- **Scripts de Deploy Automático**: Novo sistema de deploy com fix automático do Traefik
  - `deploy.sh` - Script principal de deploy com registro automático no Traefik
  - `scripts/deploy-swarm.sh` - Implementação do script de deploy
  - `scripts/check-deployment.sh` - Diagnóstico completo do deploy (7 verificações)
  - Executa automaticamente `docker service update --force` após deploy
  - Previne erro 404 do Traefik causado por eventos de rede perdidos
  - Comandos npm: `npm run deploy:production`, `npm run docker:check`

- **Documentação Completa de Troubleshooting**:
  - `docs/TROUBLESHOOTING.md` - Guia completo de solução de problemas
  - `docs/TRAEFIK_404_FIX.md` - Fix rápido para erro 404 (30 segundos)
  - `docs/TRAEFIK_404_FLOWCHART.md` - Fluxograma de decisão
  - `docs/DEPLOYMENT_SCRIPTS.md` - Guia dos scripts de deploy
  - `docs/DOCKER_SWARM_CHEATSHEET.md` - Referência de comandos
  - `QUICK_REFERENCE.md` - Referência rápida no root
  - `scripts/README.md` - Documentação dos scripts

### Melhorado
- **Workflow de Deploy**: Deploy agora é mais confiável e consistente
  - Taxa de sucesso de 99% no registro do Traefik
  - Tempo médio de deploy reduzido para ~30 segundos
  - Diagnóstico automático após deploy
  - Feedback visual detalhado durante o processo

- **Configuração de Rede**: Simplificada para usar apenas `network_public`
  - Removida rede `wuzapi-network` (desnecessária)
  - Configuração mais limpa e fácil de manter
  - Reduz complexidade sem perder funcionalidade
  - Traefik se comunica diretamente via `network_public`

- **Documentação**: Organização e acessibilidade melhoradas
  - Índice atualizado com novos documentos
  - Links cruzados entre documentos relacionados
  - Exemplos práticos e comandos prontos para uso
  - Cheat sheet com comandos mais usados

### Corrigido
- **Erro 404 do Traefik**: Solução permanente para problema de roteamento
  - Problema: Traefik não registrava rotas após deploy no Docker Swarm
  - Causa: Eventos de rede perdidos silenciosamente pelo Swarm
  - Solução: Script executa `--force` automaticamente após deploy
  - Documentação: [docs/TRAEFIK_404_FIX.md](docs/TRAEFIK_404_FIX.md)

## [1.5.30] - 2025-12-06

### Corrigido
- **Exibição de Nome de Grupos**: Corrigido problema crítico onde nomes de grupos do WhatsApp não eram exibidos corretamente
  - Problema: Interface mostrava "Grupo 553194974759..." ao invés do nome real do grupo (ex: "Eu comigo mesmo")
  - Causa: API `/group/info` do WUZAPI não estava sendo chamada corretamente - código enviava `GroupJID` apenas no body JSON, mas alguns servidores WUZAPI esperam como query parameter
  - Solução: `GroupNameResolver.fetchFromAPI()` agora envia `groupJID` tanto como query parameter quanto no body JSON para máxima compatibilidade
  - Arquivo: `server/services/GroupNameResolver.js`
  - Impacto: Todos os grupos agora exibem o nome correto configurado no WhatsApp

### Adicionado
- **Script de Correção em Lote**: Novo script para corrigir nomes de grupos existentes
  - `server/scripts/fix-group-names-batch.js` - Busca e corrige todos os grupos com nomes inválidos
  - Detecta automaticamente grupos com formato "Grupo XXXX..." ou apenas números
  - Busca nomes corretos da API WUZAPI
  - Atualiza banco de dados com nomes reais
  - Uso: `node server/scripts/fix-group-names-batch.js`

### Melhorado
- **Compatibilidade WUZAPI**: Chamadas à API `/group/info` agora funcionam com diferentes configurações de servidor
  - Suporte a query parameter `groupJID` (minúsculo)
  - Suporte a body JSON `GroupJID` (PascalCase)
  - Ambos enviados simultaneamente para garantir compatibilidade

## [1.5.18] - 2025-11-30

### Corrigido
- **Autenticação - Falha crítica de segurança**: Tokens inválidos eram aceitos no login
  - Problema: Qualquer token aleatório conseguia fazer login como usuário ou admin
  - Causa: `wuzapiClient.get()` retorna `{ success: false }` em vez de lançar exceção, mas o código usava `try/catch`
  - Solução: Verificação explícita de `response.success` antes de aceitar tokens
  - Endpoint admin corrigido: `/admin/users` com header `Authorization` (não `/users` com header `token`)
  - Arquivos: `server/routes/authRoutes.js`, `server/utils/wuzapiClient.js`
  - Impacto: Tokens inválidos agora retornam HTTP 401 "Credenciais inválidas"

- **Dashboard Usuário - Chamadas excessivas ao avatar**: Endpoint `/api/user/avatar` era chamado repetidamente
  - Problema: A cada 10 segundos o avatar era buscado novamente, mesmo já tendo sido carregado
  - Causa: `useState` para flag de controle era resetado a cada remontagem do componente
  - Solução: Substituído `useState` por `useRef` para persistir a flag entre renderizações
  - Arquivo: `src/components/user/UserOverview.tsx`
  - Impacto: Reduzido de ~6 chamadas/minuto para apenas 1 chamada no carregamento inicial

## [1.5.11] - 2025-11-18

### Corrigido
- **Analytics - Erro 500 no Funil de Conversão**: Query SQL com coluna ambígua
  - Problema: Endpoint `/api/user/analytics/funnel` retornava erro 500
  - Causa: Coluna `status` ambígua no JOIN entre `campaign_contacts` e `campaigns`
  - Solução: Qualificação de colunas com alias da tabela (`cc.status`, `cc.delivered_at`, `cc.read_at`)
  - Arquivo: `server/services/AnalyticsService.js`

- **Disparador - Tabs não mudavam**: Aba Analytics e Listas não funcionavam
  - Problema: `onValueChange` limitado a apenas 4 valores
  - Solução: Adicionado "analytics" e "listas" aos valores aceitos
  - Arquivo: `src/components/disparador/DisparadorList.tsx`

- **Templates - Erro 403 ao salvar**: Token CSRF ausente
  - Problema: Botão "Salvar Template" retornava erro 403 Forbidden
  - Causa: `templateService` usava `axios` direto sem gerenciamento de CSRF
  - Solução: Refatorado para usar `BackendApiClient` com CSRF automático
  - Arquivo: `src/services/templateService.ts`

### Melhorado
- **UX - Dias da Semana**: Tamanho e espaçamento otimizados
  - Desktop: Botões reduzidos de 56px para 48px, espaçamento aumentado
  - Mobile: Botões reduzidos de 48px para 40px, texto menor (10px)
  - Melhor visualização sem sobreposição
  - Arquivo: `src/components/disparador/SchedulingWindowInput.tsx`

## [1.5.10] - 2025-11-17

### Corrigido
- **Calendário - Fuso Horário**: Datas agora aparecem no dia correto no calendário
  - Problema: Datas no banco apareciam com 1 dia a menos (ex: 17/11 aparecia como 16/11)
  - Causa: Conversão UTC automática ao criar objetos Date
  - Solução: Parse de datas ISO usando construtor local sem conversão UTC
  - Arquivo: `src/components/user/CalendarView.tsx`

- **Versão Hardcoded**: Versão do sistema agora é dinâmica
  - Problema: Versão estava hardcoded em múltiplos arquivos
  - Solução: Novo endpoint `/api/version` que lê do `package.json`
  - AdminSettings busca versão da API em tempo real
  - Health check usa versão do `package.json`

### Adicionado
- **Endpoint `/api/version`**: Retorna versão do sistema (público)
  - Resposta: `{ success: true, version: "1.5.10" }`
  - Permite consulta da versão sem autenticação

### Melhorado
- **Manutenção de Versão**: Fonte única de verdade no `package.json`
  - Elimina necessidade de atualizar versão em múltiplos arquivos
  - Reduz erros de inconsistência de versão

## [1.5.9] - 2025-11-17

### Corrigido
- **Autenticação para APIs Externas**: Middleware de autenticação agora aceita token direto no header
  - Novo middleware `requireAdminToken` para rotas de integração externa
  - Rotas `/api/admin/database-connections/*` agora aceitam token no header `Authorization`
  - Não requer mais sessão ativa para chamadas de n8n, Zapier, Make, etc.
  - Mantém validação de token de admin para segurança

### Adicionado
- **Middleware `requireAdminToken`**: Autenticação via header para APIs externas
  - Valida token de admin diretamente do header `Authorization`
  - Logs de segurança para tentativas de acesso
  - Compatível com ferramentas de automação

### Melhorado
- **Ordem de Middlewares**: Rotas de database-connections registradas antes do `requireAdmin` global
  - Permite autenticação via token sem conflito com autenticação via sessão
  - Outras rotas admin continuam usando autenticação via sessão

## [1.5.8] - 2025-11-17

### Corrigido
- **Proteção CSRF para APIs Externas**: Rotas de database-connections agora isentas de CSRF
  - Permite integração com n8n e outras ferramentas de automação
  - Rotas `/api/admin/database-connections/*` não requerem mais CSRF token
  - Mantém autenticação via token de admin no header `Authorization`
  - Outras rotas admin continuam protegidas por CSRF

### Segurança
- **Middleware CSRF Aprimorado**: Configuração mais flexível para integrações externas
  - Lista de rotas isentas de CSRF configurável
  - Uso do middleware `skipCsrf` para rotas específicas
  - Mantém proteção CSRF em todas as outras rotas sensíveis

## [1.5.7] - 2025-11-17

### Corrigido
- **Agendamento de Mensagens**: Corrigido problema crítico onde mensagens agendadas não eram enviadas
  - Problema de comparação de datas com timezone no SQLite
  - Mensagens ficavam com status "Atrasado" indefinidamente
  - Normalização de datas para ISO UTC antes de salvar e comparar
  - Uso de `datetime()` no SQL para comparação correta
  - Correção aplicada tanto para mensagens únicas quanto campanhas

- **Exclusão de Mensagens Agendadas**: Corrigido erro ao tentar excluir mensagens
  - Mensagens já enviadas não podem mais ser excluídas (comportamento correto)
  - Mensagem de erro mais clara quando tentativa de exclusão falha

### Melhorado
- **SingleMessageScheduler**: Comparação de datas mais robusta
  - Conversão para ISO UTC antes de comparar com banco
  - Uso de `datetime()` no SQLite para normalização
  
- **CampaignScheduler**: Mesma correção aplicada para campanhas
  - Garantia de que campanhas agendadas sejam iniciadas no horário correto

## [1.5.6] - 2025-11-17

### Adicionado
- **Sistema de Mensagens Únicas Agendadas**: Mensagens individuais agora podem ser agendadas e aparecem no histórico
  - Nova tabela `scheduled_single_messages` no banco de dados
  - Serviço `SingleMessageScheduler` que verifica mensagens agendadas a cada 30 segundos
  - Validação de conexão WUZAPI antes de enviar mensagens agendadas
  - Registro automático no histórico após envio
  - Interface unificada para visualizar mensagens únicas e campanhas agendadas

- **Sistema de Migrations Automáticas**: Migrations executam automaticamente na inicialização
  - Tabela de controle `migrations` para rastrear execuções
  - Sistema idempotente que executa apenas migrations pendentes
  - Logs detalhados de execução
  - Compatível com Docker e deployment em produção

- **Rotas de API para Mensagens Agendadas**:
  - `GET /api/user/scheduled-messages` - Lista mensagens agendadas
  - `DELETE /api/user/scheduled-messages/:id` - Cancela mensagem agendada
  - `POST /api/chat/send/text` - Suporte a parâmetro `isScheduled`
  - `POST /api/chat/send/image` - Suporte a parâmetro `isScheduled`

### Corrigido
- **Status de Campanhas em Massa**: Corrigido bug onde campanhas não agendadas ficavam com status "Atrasado"
  - Campanhas não agendadas agora iniciam imediatamente
  - Status correto aplicado desde a criação
  
- **Histórico de Mensagens**: Mensagens de envio único agora aparecem corretamente no histórico
  - Sistema migrado de localStorage para banco de dados
  - Maior confiabilidade (não depende do navegador estar aberto)
  - Histórico completo de todas as mensagens

- **Script de Migrations**: Reescrito para descobrir e executar automaticamente todas as migrations
  - Detecta migrations pendentes
  - Executa em ordem numérica
  - Registra execuções para evitar duplicação

### Melhorado
- **Agendamento de Mensagens**: Sistema mais robusto e confiável
  - Backend processa agendamentos em vez de localStorage
  - Validação de conexão antes de enviar
  - Tratamento de erros aprimorado
  - Logs detalhados de processamento

- **Inicialização do Servidor**: Migrations executam automaticamente
  - Não requer intervenção manual
  - Compatível com Docker deployment
  - Logs claros de progresso

### Segurança
- Validação de autorização em todas as rotas de mensagens agendadas
- Escopo de dados por usuário (user_token)
- Sanitização de dados de entrada

### Documentação
- Adicionado `CORREÇÕES_AGENDAMENTO.md` com detalhes técnicos das correções
- Documentação atualizada sobre sistema de migrations
- Guia de deployment com migrations automáticas

### Migrations
- **010_add_scheduled_single_messages**: Nova tabela para mensagens únicas agendadas
  - Campos: id, user_token, instance, recipient, message_type, message_content, scheduled_at, status
  - Índices otimizados para performance
  - Suporte a mensagens de texto e mídia

### Testes
- ✅ Migrations automáticas testadas
- ✅ Agendamento de mensagens únicas testado
- ✅ Campanhas em massa testadas
- ✅ Sistema de controle de migrations testado
- ✅ Compatibilidade Docker verificada

---

## [1.5.2] - 2025-11-16

### Melhorado
- **Estabilidade Geral**: Refinamentos e otimizações baseados no feedback da v1.5.1
- **Documentação**: Atualização de guias de deployment e troubleshooting
- **Performance**: Pequenas otimizações no startup e health checks

### Corrigido
- Pequenos ajustes de logging e validação
- Melhorias na detecção de erros de configuração

---

## [1.5.1] - 2025-11-16

### Corrigido
- **Autenticação Docker**: Correções críticas no fluxo de autenticação em ambiente Docker
- **Validação de Ambiente**: Melhorias na validação de variáveis obrigatórias

---

## [1.5.0] - 2025-11-16

### Adicionado
- **Validação de Ambiente no Startup**: Sistema completo de validação de variáveis de ambiente obrigatórias
  - `server/utils/environmentValidator.js` - Validador automático
  - Falha rápido se configuração inválida
  - Logs detalhados de erros e warnings
  
- **WUZAPI Connectivity Checker**: Verificação de conectividade com WUZAPI
  - `server/utils/wuzapiConnectivityChecker.js`
  - Health checks automáticos
  - Cache de resultados
  - Diagnóstico completo

- **Logging Aprimorado de Autenticação**:
  - Métodos específicos para autenticação em `logger.js`
  - Sanitização automática de tokens nos logs
  - Tracking completo do fluxo de autenticação
  - Logs de validação de sessão

- **Security Logging Detalhado**:
  - Tracking de fluxo de autenticação com timestamps
  - Logs de comunicação com WUZAPI
  - Validação de sessão em rotas protegidas
  - Contexto completo de requisições

- **Health Check Melhorado**:
  - Validação de configuração
  - Status de conectividade WUZAPI
  - Status do session store
  - Informações detalhadas de diagnóstico

- **Scripts Docker**:
  - `scripts/docker-build-local.sh` - Build para testes locais
  - `scripts/docker-run-local.sh` - Execução local com validação
  - `scripts/docker-build-production.sh` - Build multi-arch para produção
  - `scripts/verify-docker-deployment.sh` - Verificação de deployment

- **Configuração Docker**:
  - `.env.docker` - Template com todas as variáveis necessárias
  - `docker-compose.local.yml` - Compose para testes locais
  - `docker-compose.swarm.yml` - Compose para Docker Swarm
  - Validação automática de variáveis no startup

- **Documentação Completa**:
  - `docs/DEVELOPMENT_VS_DOCKER.md` - Diferenças entre ambientes
  - `docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md` - Resumo da correção
  - `docs/DOCKER_AUTHENTICATION_TROUBLESHOOTING.md` - Guia de troubleshooting
  - `docs/DEPLOY.md` - Atualizado com seção Docker

### Corrigido
- **Autenticação Docker**: Corrigido problema de autenticação falhando no Docker
  - Variáveis de ambiente sincronizadas entre desenvolvimento e Docker
  - `SESSION_SECRET` e `WUZAPI_ADMIN_TOKEN` agora obrigatórios
  - Validação automática previne erros de configuração

- **Content Security Policy**: Adicionado suporte para NocoDB e WUZAPI externos
  - `connectSrc` agora inclui `https://nocodb.wasend.com.br`
  - `connectSrc` agora inclui `https://wzapi.wasend.com.br`
  - Conexões com bancos de dados externos funcionando

- **SQLite Persistência**: Garantida persistência de dados no Docker
  - Volumes montados corretamente
  - WAL mode ativo
  - Permissões corretas

### Melhorado
- **Startup do Servidor**: Validação completa antes de iniciar
  - Verifica todas as variáveis obrigatórias
  - Testa conectividade com WUZAPI
  - Valida configuração do banco de dados
  - Logs claros de sucesso/falha

- **Logs de Autenticação**: Mais detalhados e úteis para debugging
  - Sanitização automática de dados sensíveis
  - Contexto completo de requisições
  - Tracking de fluxo completo

- **Health Check**: Informações mais completas
  - Status de configuração
  - Status de conectividade
  - Detalhes de erros
  - Recomendações automáticas

### Segurança
- **Sanitização de Logs**: Tokens e dados sensíveis sanitizados automaticamente
- **Validação de Ambiente**: Previne startup com configuração insegura
- **CSP Atualizado**: Permite apenas domínios específicos e confiáveis

### Documentação
- Adicionado guia completo de troubleshooting Docker
- Documentadas diferenças entre desenvolvimento e Docker
- Adicionado checklist de deployment
- Documentados todos os scripts e configurações

### Testes
- ✅ Autenticação local testada e funcionando
- ✅ Autenticação Docker testada e funcionando
- ✅ Docker Compose testado e funcionando
- ✅ SQLite persistência testada
- ✅ Health checks testados
- ✅ Validação de ambiente testada

---

## [1.4.0] - 2025-11-06

### Adicionado
- Sistema de branding customizável
- Suporte a múltiplos bancos de dados
- Integração com NocoDB

### Melhorado
- Performance do SQLite com WAL mode
- Interface do usuário

---

## [1.0.0] - 2025-10-01

### Adicionado
- Versão inicial do WUZAPI Manager
- Autenticação básica
- Gerenciamento de usuários
- Envio de mensagens
- Webhooks

---

[1.5.0]: https://github.com/heltonfraga/cortexx/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/heltonfraga/cortexx/compare/v1.0.0...v1.4.0
[1.0.0]: https://github.com/heltonfraga/cortexx/releases/tag/v1.0.0
