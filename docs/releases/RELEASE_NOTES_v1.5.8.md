# Release Notes - v1.5.8

**Data de Lançamento**: 17 de Novembro de 2025

## 🎯 Objetivo da Release

Correção crítica para permitir integração com ferramentas de automação externas (n8n, Zapier, Make, etc.) removendo a proteção CSRF de rotas específicas de API.

## 🐛 Correções

### Proteção CSRF para APIs Externas

**Problema**: Rotas de database-connections retornavam erro 403 "Invalid or missing CSRF token" quando chamadas por ferramentas externas como n8n.

**Solução**: 
- Rotas `/api/admin/database-connections/*` agora isentas de CSRF
- Mantém autenticação via token de admin no header `Authorization`
- Outras rotas admin continuam protegidas por CSRF

**Rotas Afetadas**:
- `POST /api/admin/database-connections/:connectionId/users` - Atribuir usuários
- `DELETE /api/admin/database-connections/:connectionId/users/:userId` - Remover usuário
- `GET /api/admin/database-connections/:connectionId/users` - Listar usuários

## 🔒 Segurança

### Middleware CSRF Aprimorado

- Lista configurável de rotas isentas de CSRF
- Uso do middleware `skipCsrf` para rotas específicas
- Proteção CSRF mantida em todas as outras rotas sensíveis
- Autenticação via token de admin continua obrigatória

## 📦 Deployment

### Imagem Docker

```bash
# Pull da imagem
docker pull heltonfraga/wuzapi-manager:v1.5.8

# Ou usar latest
docker pull heltonfraga/wuzapi-manager:latest
```

### Arquiteturas Suportadas

- ✅ linux/amd64
- ✅ linux/arm64

### Atualização no Docker Swarm

```bash
# Atualizar serviço existente
docker service update --image heltonfraga/wuzapi-manager:v1.5.8 wuzapi-manager_wuzapi-manager

# Verificar status
docker service ps wuzapi-manager_wuzapi-manager

# Acompanhar logs
docker service logs wuzapi-manager_wuzapi-manager -f
```

## 🔧 Integração com n8n

### Exemplo de Configuração

```json
{
  "method": "POST",
  "url": "https://seu-dominio.com/api/admin/database-connections/{{connectionId}}/users",
  "headers": {
    "Authorization": "{{admin_token}}",
    "Content-Type": "application/json"
  },
  "body": {
    "user_ids": ["{{user_token}}"],
    "create_permissions": true,
    "permissions": {
      "can_read": true,
      "can_write": false,
      "can_delete": false
    }
  }
}
```

### Headers Necessários

- `Authorization`: Token de admin (obrigatório)
- `Content-Type`: application/json (obrigatório)
- ~~`CSRF-Token`: Não é mais necessário~~ ✅

## 📝 Notas de Upgrade

### De v1.5.7 para v1.5.8

1. **Sem Breaking Changes**: Atualização compatível
2. **Sem Migrations**: Nenhuma alteração no banco de dados
3. **Configuração**: Nenhuma mudança necessária em variáveis de ambiente
4. **Downtime**: Zero (rolling update no Docker Swarm)

### Checklist de Atualização

- [ ] Fazer backup do banco de dados (`/app/data/wuzapi.db`)
- [ ] Atualizar imagem Docker para v1.5.8
- [ ] Verificar health check (`GET /health`)
- [ ] Testar integração n8n (se aplicável)
- [ ] Verificar logs para erros

## 🧪 Testes

### Validação da Correção

```bash
# Testar endpoint sem CSRF token
curl -X POST https://seu-dominio.com/api/admin/database-connections/1/users \
  -H "Authorization: seu_admin_token" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["user_token"]}'

# Deve retornar 201 Created (não mais 403 Forbidden)
```

## 📊 Estatísticas da Release

- **Arquivos Modificados**: 4
  - `server/index.js` (middleware CSRF)
  - `package.json` (versão)
  - `server/package.json` (versão)
  - `CHANGELOG.md` (documentação)

- **Linhas de Código**: ~20 linhas modificadas
- **Tempo de Build**: ~2 minutos (multi-arch)
- **Tamanho da Imagem**: ~450 MB (comprimido)

## 🔗 Links Úteis

- [CHANGELOG Completo](../../CHANGELOG.md)
- [Documentação de Deploy](../deployment/)
- [Guia de Integração n8n](../../docs/integrations/n8n.md) (em breve)

## 👥 Contribuidores

- [@heltonfraga](https://github.com/heltonfraga) - Correção CSRF

---

**Versão Anterior**: [v1.5.7](./RELEASE_NOTES_v1.5.7.md)
**Próxima Versão**: TBD
