# 🚀 WUZAPI Manager

Sistema completo de gerenciamento para WUZAPI com interface web moderna, API robusta e integração com WhatsApp Business.

## 📋 Visão Geral

O WUZAPI Manager é uma plataforma completa para gerenciamento de instâncias WhatsApp Business via WUZAPI, oferecendo:

- **Dashboard Administrativo**: Gerenciamento completo de usuários e configurações
- **Dashboard do Usuário**: Interface intuitiva para envio de mensagens e configurações
- **Sistema de Chat**: Interface de chat integrada com suporte a conversas em tempo real
- **Integração com Banco de Dados**: Conectividade com NocoDB e outros bancos via API
- **Sistema de Webhook**: Configuração e gerenciamento de eventos WhatsApp
- **Envio de Mensagens**: Interface para envio de mensagens com modelos pré-definidos
- **Arquitetura Moderna**: Deploy via Docker Swarm com alta disponibilidade

## 🏗️ Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| **Backend** | Node.js 20 + Express 4 (CommonJS) |
| **Banco de Dados** | Supabase (PostgreSQL) |
| **Testes** | Vitest (frontend), Node test runner (backend), Cypress (E2E) |
| **Deploy** | Docker, single-node Docker Swarm |

## 🎯 Funcionalidades Principais

### 👨‍💼 Dashboard Administrativo
- Gerenciamento de usuários (CRUD completo)
- Configuração de branding (logo, cores, nome)
- Monitoramento do sistema e health checks
- Configuração de banco de dados

### 👤 Dashboard do Usuário
- Envio de mensagens WhatsApp com templates
- Interface de chat em tempo real
- Configuração de webhooks (40+ eventos)
- Navegação de dados do NocoDB
- Configurações pessoais

### 🎨 Personalização
- Cores de tema dinâmicas (modo claro/escuro)
- Validação automática de contraste WCAG AA
- White label completo
- Página inicial customizável

## 🛠️ Desenvolvimento

### Pré-requisitos

- Node.js 20+
- npm ou yarn
- Docker (opcional)

### Instalação Rápida

```bash
# Clonar repositório
git clone <repository-url>
cd wuzapi-manager

# Instalar dependências
npm run setup

# Configurar variáveis de ambiente
cp .env.example .env
cp server/.env.example server/.env

# Executar em desenvolvimento
npm run dev:full
```

### Scripts Principais

```bash
# Desenvolvimento
npm run dev:full        # Frontend + Backend (recomendado)
npm run dev             # Frontend apenas (porta 5173)
npm run server:dev      # Backend apenas (porta 3000)

# Testes
npm run test:run        # Todos os testes
npm run test:e2e        # Testes E2E

# Build e Deploy
npm run build           # Build de produção
npm run lint            # Verificar código
npm run deploy:production  # Deploy em Docker Swarm

# Diagnóstico
npm run docker:check    # Verificar status do deploy
npm run docker:status   # Status do serviço
npm run docker:logs     # Logs em tempo real
```

### URLs de Desenvolvimento

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🐳 Deploy em Produção

### Docker Swarm (Recomendado)

```bash
# Build da imagem
npm run deploy:official

# Deploy em Docker Swarm (com registro automático no Traefik)
./deploy.sh
# ou
npm run deploy:production

# Verificar status completo (recomendado após deploy)
npm run docker:check

# Verificar status do serviço
npm run docker:status

# Ver logs em tempo real
npm run docker:logs
```

**Nota**: O script `deploy.sh` garante que o Traefik registre corretamente as rotas do serviço, evitando erros 404. Ele executa automaticamente `docker service update --force` após o deploy.

**Diagnóstico**: Use `npm run docker:check` para verificar:
- Status do serviço e replicas
- Labels do Traefik
- Conectividade de rede
- Health checks
- Acesso externo (testa o domínio)

### Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `WUZAPI_BASE_URL` | ✅ | URL da API WUZAPI |
| `VITE_ADMIN_TOKEN` | ✅ | Token de administrador |
| `NODE_ENV` | ❌ | Ambiente (production/development) |
| `PORT` | ❌ | Porta do servidor (padrão: 3000) |
| `CORS_ORIGINS` | ❌ | Origens permitidas para CORS |
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Chave de serviço do Supabase |

### Docker Compose

```yaml
version: "3.8"
services:
  wuzapi-manager:
    image: heltonfraga/wuzapi-manager:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WUZAPI_BASE_URL=https://wzapi.wasend.com.br
      - CORS_ORIGINS=https://seu-dominio.com
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
```

## 📊 API

### Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/auth/login` | Login de usuário |
| `GET` | `/api/admin/users` | Listar usuários |
| `POST` | `/api/chat/send/text` | Enviar mensagem |
| `GET` | `/api/webhook` | Configuração de webhook |
| `GET` | `/health` | Health check |

Para documentação completa da API, consulte [docs/api/README.md](docs/api/README.md).

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | ⚡ Referência rápida de comandos e soluções |
| [docs/INDEX.md](docs/INDEX.md) | Índice completo da documentação |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Guia de configuração |
| [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) | Guia de desenvolvimento |
| [docs/DEPLOYMENT_SCRIPTS.md](docs/DEPLOYMENT_SCRIPTS.md) | Scripts de deploy e diagnóstico |
| [docs/TRAEFIK_404_FIX.md](docs/TRAEFIK_404_FIX.md) | Fix rápido para erro 404 do Traefik |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Guia de deploy |
| [DOCKER_QUICK_START.md](DOCKER_QUICK_START.md) | Quick start Docker |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guia de contribuição |

## 🔒 Segurança

- Autenticação baseada em tokens (Admin/User)
- CORS configurável
- Rate limiting
- SSL/TLS automático via Traefik
- Validação de entrada em todas as rotas

## 📈 Monitoramento

```bash
# Health check
curl http://localhost:3000/health

# Status do Docker
npm run docker:status

# Logs em tempo real
npm run docker:logs
```

## 🧪 Testes

```bash
# Todos os testes
npm run test:run

# Testes do frontend
npm run test:unit

# Testes do backend
cd server && npm test

# Testes E2E
npm run test:e2e
```

## 📦 Estrutura do Projeto

```
wuzapi-manager/
├── src/                    # Frontend React
│   ├── components/         # Componentes (admin, user, shared, ui)
│   ├── services/           # Serviços de API
│   ├── hooks/              # Hooks customizados
│   ├── contexts/           # Contextos React
│   └── types/              # Definições TypeScript
├── server/                 # Backend Node.js
│   ├── routes/             # Endpoints HTTP
│   ├── services/           # Lógica de negócio
│   ├── middleware/         # Middlewares Express
│   └── utils/              # Utilitários
├── docs/                   # Documentação
├── scripts/                # Scripts de automação
└── .kiro/                  # Specs e steering files
```

## 🤝 Contribuindo

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes de contribuição.

## 📄 Licença

Este projeto é privado e de uso restrito.

---

**Versão:** 1.5.21  
**Última Atualização:** Dezembro 2025
