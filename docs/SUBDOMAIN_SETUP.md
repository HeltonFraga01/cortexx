# Configuração de Subdomínios - Multi-Tenant

Este documento explica como configurar subdomínios para o sistema multi-tenant do WUZAPI Manager.

## Visão Geral da Arquitetura

```
cortexx.online (domínio principal)
├── superadmin.cortexx.online  → Painel do Superadmin
├── tenant1.cortexx.online     → Tenant 1
├── tenant2.cortexx.online     → Tenant 2
└── *.cortexx.online           → Wildcard para novos tenants
```

## 1. Configuração no Cloudflare

### DNS Records Necessários

Acesse o painel do Cloudflare → DNS → Records e adicione:

| Tipo | Nome | Conteúdo | Proxy | TTL |
|------|------|----------|-------|-----|
| A | @ | IP_DO_SERVIDOR | ✅ Proxied | Auto |
| A | * | IP_DO_SERVIDOR | ✅ Proxied | Auto |
| A | superadmin | IP_DO_SERVIDOR | ✅ Proxied | Auto |

O registro `*` (wildcard) captura automaticamente todos os subdomínios.

### SSL/TLS

1. Vá em SSL/TLS → Overview
2. Selecione "Full (strict)" para máxima segurança
3. Em Edge Certificates, ative "Always Use HTTPS"

### Page Rules (Opcional)

Para forçar HTTPS em todos os subdomínios:
- URL: `*cortexx.online/*`
- Setting: Always Use HTTPS

## 2. Ambiente de Desenvolvimento (localhost)

### Opção A: Editar /etc/hosts (Recomendado)

```bash
# macOS/Linux
sudo nano /etc/hosts

# Adicione as linhas:
127.0.0.1 cortexx.local
127.0.0.1 superadmin.cortexx.local
127.0.0.1 tenant1.cortexx.local
127.0.0.1 tenant2.cortexx.local
```

Depois acesse:
- http://superadmin.cortexx.local:5173 → Painel Superadmin
- http://tenant1.cortexx.local:5173 → Tenant 1

### Opção B: Query Parameter

Sem modificar /etc/hosts, use query parameter:

```
http://localhost:5173?tenant=superadmin
http://localhost:5173?tenant=tenant1
```

### Opção C: Header HTTP

Para testes de API, use o header `X-Tenant-Subdomain`:

```bash
curl -H "X-Tenant-Subdomain: superadmin" http://localhost:3000/api/superadmin/me
```

## 3. Criar o Primeiro Superadmin

Execute o script de criação:

```bash
# Modo interativo
node server/scripts/create-superadmin.js

# Ou com argumentos
node server/scripts/create-superadmin.js \
  --email admin@cortexx.online \
  --password SuaSenhaSegura123 \
  --name "Admin Principal"
```

## 4. Variáveis de Ambiente

### Backend (server/.env)

```env
# Domínio base para produção
BASE_DOMAIN=cortexx.online

# Domínio base para desenvolvimento
DEV_BASE_DOMAIN=cortexx.local

# Ambiente
NODE_ENV=development
```

### Frontend (.env)

```env
# URL da API
VITE_API_BASE_URL=http://localhost:3000

# Domínio base
VITE_BASE_DOMAIN=cortexx.local
```

## 5. Fluxo de Autenticação

### Superadmin

1. Acesse `superadmin.cortexx.online` (ou `superadmin.cortexx.local:5173`)
2. Faça login com email/senha do superadmin
3. Gerencie tenants, métricas, configurações globais

### Tenant Admin

1. Acesse `{subdomain}.cortexx.online`
2. Faça login como admin do tenant
3. Gerencie accounts, planos, branding do tenant

### Account/Agent

1. Acesse `{subdomain}.cortexx.online`
2. Faça login com credenciais da account/agent
3. Use o sistema normalmente

## 6. Troubleshooting

### Subdomínio não resolve

1. Verifique se o DNS está propagado: `dig tenant.cortexx.online`
2. Limpe cache DNS: `sudo dscacheutil -flushcache` (macOS)
3. Verifique se o wildcard está configurado no Cloudflare

### Erro "Tenant not found"

1. Verifique se o tenant existe no banco
2. Verifique se o subdomain está correto (lowercase, sem espaços)
3. Verifique se o tenant está ativo (status = 'active')

### CORS errors em desenvolvimento

Adicione as origens no `server/.env`:

```env
CORS_ORIGINS=http://localhost:5173,http://cortexx.local:5173,http://superadmin.cortexx.local:5173
```

### SSL certificate errors

Em desenvolvimento, use HTTP. Em produção, o Cloudflare gerencia SSL automaticamente.

## 7. Criar Novo Tenant

Via API (autenticado como superadmin):

```bash
curl -X POST http://localhost:3000/api/superadmin/tenants \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "subdomain": "novotenant",
    "name": "Novo Tenant"
  }'
```

Ou via painel do superadmin em `superadmin.cortexx.online`.

## 8. Arquitetura de Segurança

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  DNS Wildcard: *.cortexx.online → IP_SERVIDOR       │    │
│  │  SSL: Full (strict)                                  │    │
│  │  WAF: Enabled                                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Servidor (Docker)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Nginx/Traefik (Reverse Proxy)                       │    │
│  │  - SSL termination (se não usar Cloudflare)          │    │
│  │  - Proxy para Node.js                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Node.js (Express)                                   │    │
│  │  - subdomainRouter middleware                        │    │
│  │  - Extrai subdomain do hostname                      │    │
│  │  - Define tenant context                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Supabase (PostgreSQL + RLS)                         │    │
│  │  - Row Level Security por tenant_id                  │    │
│  │  - Isolamento de dados garantido                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```
