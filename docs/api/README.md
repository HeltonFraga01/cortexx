# Documentação da API WUZAPI Manager

Bem-vindo à documentação completa da API do WUZAPI Manager. Esta API fornece endpoints para gerenciamento de usuários WhatsApp, sessões, configurações de branding e conexões de banco de dados.

## 📚 Índice da Documentação

### Documentos Principais

- **[OpenAPI Specification](./openapi.yaml)** - Especificação completa da API em formato OpenAPI 3.0
- **[Exemplos de Uso](./examples.md)** - Exemplos práticos de como usar todos os endpoints
- **[Códigos de Erro](./error-codes.md)** - Guia completo de troubleshooting e códigos de erro

### Visualização Interativa

Para visualizar a documentação de forma interativa, você pode usar:

1. **Swagger UI**: Abra o arquivo `openapi.yaml` em [Swagger Editor](https://editor.swagger.io/)
2. **Redoc**: Use [Redoc](https://redocly.github.io/redoc/) para uma visualização mais limpa
3. **Postman**: Importe o arquivo OpenAPI no Postman para testes

## 🚀 Início Rápido

### 1. Configuração Base

```bash
# URL base da API
API_BASE="http://localhost:3001"

# Tokens de exemplo
ADMIN_TOKEN="UeH7cZ2c1K3zVUBFi7SginSC"
USER_TOKEN="abc123def456ghi789"
```

### 2. Verificar Saúde do Sistema

```bash
curl -X GET $API_BASE/health
```

### 3. Listar Usuários (Admin)

```bash
curl -X GET \
  -H "Authorization: $ADMIN_TOKEN" \
  $API_BASE/api/admin/users
```

### 4. Verificar Status da Sessão (Usuário)

```bash
curl -X GET \
  -H "token: $USER_TOKEN" \
  $API_BASE/api/session/status
```

## 🔐 Autenticação

A API utiliza dois tipos de autenticação:

### Token Administrativo
- **Header**: `Authorization: {admin_token}`
- **Uso**: Endpoints `/api/admin/*`
- **Permissões**: Acesso completo ao sistema

### Token de Usuário
- **Header**: `token: {user_token}` ou `Authorization: Bearer {user_token}`
- **Uso**: Endpoints `/api/session/*`, `/api/user/*`, `/api/webhook`, `/api/chat/*`
- **Permissões**: Acesso limitado aos recursos do usuário

## 📋 Grupos de Endpoints

### 🏥 Health & Monitoring
- `GET /health` - Verificação geral de saúde
- `GET /api/admin/health` - Saúde do serviço administrativo
- `GET /api/session/health` - Saúde do serviço de sessão

### 👑 Administrativos
- `GET /api/admin/users` - Listar usuários
- `POST /api/admin/users` - Criar usuário
- `GET /api/admin/users/{id}` - Obter usuário específico
- `DELETE /api/admin/users/{id}` - Remover usuário
- `DELETE /api/admin/users/{id}/full` - Remover usuário completamente
- `GET /api/admin/stats` - Estatísticas administrativas
- `GET /api/admin/dashboard-stats` - Estatísticas do dashboard

### 🔐 Sessões
- `GET /api/session/status` - Status da sessão
- `POST /api/session/connect` - Conectar WhatsApp
- `POST /api/session/disconnect` - Desconectar WhatsApp
- `POST /api/session/logout` - Logout WhatsApp
- `GET /api/session/qr` - Obter QR Code
- `GET /api/session/token-info` - Informações do token

### 🎨 Branding
- `GET /api/admin/branding` - Obter configuração
- `PUT /api/admin/branding` - Atualizar configuração

### 🗄️ Banco de Dados
- `GET /api/database-connections` - Listar conexões
- `POST /api/database-connections` - Criar conexão
- `GET /api/database-connections/{id}` - Obter conexão
- `PUT /api/database-connections/{id}` - Atualizar conexão
- `DELETE /api/database-connections/{id}` - Deletar conexão
- `PATCH /api/database-connections/{id}/status` - Atualizar status

### 👤 Usuário
- `GET /api/user/messages` - Histórico de mensagens
- `GET /api/user/dashboard-stats` - Estatísticas do usuário
- `GET /api/user/database-connections` - Conexões do usuário
- `GET /api/user/database-connections/{id}/data` - Dados da tabela
- `POST /api/user/database-connections/{id}/data` - Criar registro
- `PUT /api/user/database-connections/{id}/data/{recordId}` - Atualizar registro
- `DELETE /api/user/database-connections/{id}/data/{recordId}` - Deletar registro

### 🔗 Webhooks
- `GET /api/webhook` - Obter configuração
- `POST /api/webhook` - Atualizar configuração

### 💬 Chat
- `POST /api/chat/send/text` - Enviar mensagem de texto

## 📊 Códigos de Status

| Código | Significado | Descrição |
|--------|-------------|-----------|
| 200 | OK | Requisição processada com sucesso |
| 201 | Created | Recurso criado com sucesso |
| 400 | Bad Request | Dados inválidos ou formato incorreto |
| 401 | Unauthorized | Token inválido ou expirado |
| 403 | Forbidden | Sem permissões para acessar o recurso |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Recurso já existe |
| 500 | Internal Server Error | Erro interno do servidor |
| 502 | Bad Gateway | Erro na comunicação com WuzAPI |
| 503 | Service Unavailable | Serviço indisponível |
| 504 | Gateway Timeout | Timeout na comunicação com WuzAPI |

## 🔧 Configuração do Ambiente

### Variáveis de Ambiente

```bash
# Servidor
PORT=3001
NODE_ENV=development

# WuzAPI
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
WUZAPI_TIMEOUT=10000

# Banco de Dados (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Tokens
VITE_ADMIN_TOKEN=UeH7cZ2c1K3zVUBFi7SginSC

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Logs
LOG_LEVEL=info
LOG_FILE=./server/logs/app.log
```

### Inicialização

```bash
# Instalar dependências
npm install

# Inicializar banco de dados
npm run db:init

# Iniciar servidor de desenvolvimento
npm run dev

# Iniciar servidor de produção
npm start
```

## 🧪 Testes

### Testes Unitários

```bash
# Executar todos os testes
npm test

# Testes com coverage
npm run test:coverage

# Testes específicos
npm test -- --grep "admin routes"
```

### Testes de Integração

```bash
# Testes E2E
npm run test:e2e

# Testes de API
npm run test:api
```

### Testes Manuais

Use os exemplos em [examples.md](./examples.md) para testes manuais com curl ou Postman.

## 📈 Monitoramento

### Health Checks

```bash
# Verificação básica
curl http://localhost:3001/health

# Verificação detalhada
curl http://localhost:3001/api/admin/health
curl http://localhost:3001/api/session/health
```

### Métricas

A API expõe métricas nos seguintes formatos:
- Logs estruturados em JSON
- Health checks com informações detalhadas
- Estatísticas de uso via endpoints específicos

### Alertas

Configure alertas para:
- Status de saúde != "ok"
- Tempo de resposta > 5 segundos
- Taxa de erro > 5%
- Uso de memória > 80%

## 🔒 Segurança

### Boas Práticas

1. **Tokens**: Mantenha tokens seguros e rotacione regularmente
2. **HTTPS**: Use sempre HTTPS em produção
3. **Rate Limiting**: Implemente limitação de taxa
4. **Validação**: Valide todos os inputs
5. **Logs**: Não registre informações sensíveis

### Headers de Segurança

```javascript
// Exemplo de headers recomendados
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000"
}
```

## 🚀 Deploy

### Docker

```dockerfile
# Dockerfile exemplo
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  wuzapi-manager:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WUZAPI_BASE_URL=https://api.wuzapi.com
    volumes:
      - ./data:/app/data
```

### Produção

1. **Build**: `npm run build`
2. **Testes**: `npm test`
3. **Deploy**: Use CI/CD pipeline
4. **Monitoramento**: Configure logs e alertas
5. **Backup**: Configure backup via Supabase Dashboard

## 📝 Changelog

### v1.0.0 (2024-01-15)
- ✨ Implementação inicial da API
- 🔐 Sistema de autenticação com tokens
- 👑 Endpoints administrativos completos
- 🔐 Gerenciamento de sessões WhatsApp
- 🎨 Sistema de branding configurável
- 🗄️ Conexões de banco de dados
- 💬 Envio de mensagens
- 🔗 Configuração de webhooks
- 📚 Documentação completa

## 🤝 Contribuição

### Como Contribuir

1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente as mudanças
4. Adicione testes
5. Atualize a documentação
6. Abra um Pull Request

### Padrões de Código

- Use ESLint e Prettier
- Siga convenções de nomenclatura
- Adicione testes para novas funcionalidades
- Documente mudanças na API

### Reportar Bugs

Use o template de issue no GitHub incluindo:
- Versão da API
- Endpoint afetado
- Dados de entrada
- Resposta esperada vs atual
- Logs relevantes

## 📞 Suporte

### Canais de Suporte

- **GitHub Issues**: Para bugs e feature requests
- **Documentação**: Para guias e referências
- **Comunidade**: Para discussões gerais

### FAQ

**P: Como obter um token administrativo?**
R: O token administrativo é configurado via variável de ambiente `VITE_ADMIN_TOKEN`.

**P: Por que recebo erro 502?**
R: Erro 502 indica problema na comunicação com a WuzAPI. Verifique se a URL base está correta e se a WuzAPI está funcionando.

**P: Como configurar CORS?**
R: Configure as variáveis `CORS_ORIGIN` e `CORS_CREDENTIALS` no arquivo `.env`.

**P: Posso usar a API sem WhatsApp?**
R: Alguns endpoints funcionam sem WhatsApp (branding, banco de dados), mas funcionalidades de sessão e chat requerem conexão ativa.

## 📄 Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](../../LICENSE) para detalhes.

---

**Última atualização**: 15 de Janeiro de 2024  
**Versão da API**: 1.0.0  
**Versão da Documentação**: 1.0.0