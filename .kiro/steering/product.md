---
inclusion: always
---

# Contexto do Produto & Domínio

WUZAPI Manager: Plataforma de gerenciamento da API WhatsApp Business com suporte multi-usuário, envio de mensagens, configuração de webhooks e integração com banco de dados externo.

## Autenticação & Autorização

**Modelo de segurança de três papéis (CRÍTICO):**

| Papel | Capacidades | Token | Escopo de Dados |
|-------|-------------|-------|-----------------|
| Admin | Gerenciamento de usuários, configurações do sistema, branding, config global | admin token | Todos os dados |
| User | Envio de mensagens, config de webhook, navegação no banco de dados | user token | Apenas dados próprios |
| Public | Visualização da landing page | nenhum | Sem autenticação |

**Aplicação de segurança (SEMPRE):**
- Endpoints admin DEVEM rejeitar tokens de usuário (`server/routes/admin*.js`)
- Endpoints user DEVEM limitar queries ao usuário autenticado (`server/routes/user*.js`)
- NUNCA permitir acesso a dados entre usuários
- Endpoints públicos não requerem autenticação (`server/routes/public*.js`)

## Integrações Externas

**WUZAPI (WhatsApp Business API):**
- Backend: `server/utils/wuzapiClient.js` (**SEMPRE use este**)
- Frontend: `src/services/wuzapi.ts`
- Recursos: 40+ eventos webhook, envio de mensagens, mídia, QR codes
- Eventos principais: `message.received`, `message.sent`, `qr.code`, `connection.status`

**NocoDB (Banco de Dados Externo):**
- Frontend: `src/services/nocodb.ts`
- Recursos: Mapeamento de campos, CRUD, filtragem, ordenação, paginação
- **DEVE implementar paginação em todas as visualizações de lista**
- Todas as operações limitadas ao token do usuário autenticado

**Stripe (Sistema de Pagamentos):**
- Backend: `server/services/StripeService.js`
- Recursos: Assinaturas, checkout, webhooks de pagamento
- Tabelas: `plans`, `user_subscriptions`, `user_quota_usage`
- Webhooks: `checkout.session.completed`, `invoice.paid`, `customer.subscription.*`

**Opcionais:**
- Chatwoot (suporte ao cliente)
- Typebot (fluxos de chatbot)

## Funcionalidades Principais

**Branding:**
- Armazenamento: tabela `branding` (logo, cores, nome da empresa)
- Carregamento: `BrandingContext` na inicialização do app
- Atualizações: Aplicadas imediatamente (sem reiniciar)
- Escopo: Landing page, cabeçalho do dashboard, templates de email

**Webhooks:**
- URLs definidas pelo usuário para encaminhamento de eventos WUZAPI
- Usuários selecionam tipos de eventos (40+ disponíveis)
- Escopo por usuário via token de usuário

**Mensagens:**
- Individual: Baseado em formulário com substituição de variáveis (`{{name}}`, `{{phone}}`)
- Em massa: Upload CSV com processamento em fila e rastreamento de status
- Rate limiting aplicado para prevenir spam

**Navegação no Banco de Dados:**
- Usuários conectam suas próprias instâncias NocoDB
- Mapeamento de campos necessário para CRUD
- **Todas as visualizações de lista DEVEM implementar paginação**
- Todas as operações limitadas ao usuário autenticado

**Sistema de Pagamentos (Stripe):**
- Planos de assinatura com diferentes limites de recursos
- Checkout integrado via Stripe
- Controle de quotas (mensagens, bots, campanhas)
- Webhooks para atualização automática de status

## Gerenciamento de Estado

**Estado global (React Context):**
- `AuthContext` → Estado de autenticação, token, papel do usuário
- `BrandingContext` → Logo, cores, informações da empresa
- `WuzAPIContext` → Status de conexão WhatsApp

**Estado do servidor (TanStack Query):**
- Cache e refetch automáticos
- Atualizações otimistas para melhor UX
- Sincronização em background

**Estado de formulários (React Hook Form + Zod):**
- Validação baseada em schema
- Manipulação de formulários type-safe
- Exibição consistente de erros

## Padrões de UX

- **Sucesso/Erro:** Notificações toast (hook `useToast`)
- **Carregamento:** Estados de loading para operações assíncronas (estados `isLoading`)
- **Ações destrutivas:** Diálogos de confirmação antes da execução
