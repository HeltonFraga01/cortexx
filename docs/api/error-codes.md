# Códigos de Erro e Troubleshooting - WUZAPI Manager API

Este documento detalha todos os códigos de erro possíveis da API WUZAPI Manager e como resolvê-los.

## Índice

- [Códigos de Status HTTP](#códigos-de-status-http)
- [Estrutura de Resposta de Erro](#estrutura-de-resposta-de-erro)
- [Erros por Categoria](#erros-por-categoria)
- [Troubleshooting por Endpoint](#troubleshooting-por-endpoint)
- [Logs e Debugging](#logs-e-debugging)
- [Soluções Comuns](#soluções-comuns)

## Códigos de Status HTTP

### 2xx - Sucesso
- **200 OK**: Requisição processada com sucesso
- **201 Created**: Recurso criado com sucesso

### 4xx - Erros do Cliente
- **400 Bad Request**: Dados inválidos ou formato incorreto
- **401 Unauthorized**: Token inválido ou expirado
- **403 Forbidden**: Sem permissões para acessar o recurso
- **404 Not Found**: Recurso não encontrado
- **409 Conflict**: Recurso já existe (conflito)

### 5xx - Erros do Servidor
- **500 Internal Server Error**: Erro interno do servidor
- **502 Bad Gateway**: Erro na comunicação com WuzAPI
- **503 Service Unavailable**: Serviço indisponível
- **504 Gateway Timeout**: Timeout na comunicação com WuzAPI

## Estrutura de Resposta de Erro

Todas as respostas de erro seguem o mesmo formato:

```json
{
  "success": false,
  "error": "Tipo do erro",
  "message": "Descrição detalhada do erro",
  "code": 400,
  "details": "Informações adicionais (opcional)",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Erros por Categoria

### Erros de Autenticação (401)

#### Token Administrativo Inválido
```json
{
  "success": false,
  "error": "Token administrativo inválido ou expirado",
  "code": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- Token não fornecido no header `Authorization`
- Token incorreto ou expirado
- Formato do token inválido

**Soluções:**
- Verificar se o token está sendo enviado no header correto
- Confirmar se o token administrativo está correto
- Verificar se o token não expirou

#### Token de Usuário Inválido
```json
{
  "success": false,
  "error": "Token de usuário inválido",
  "code": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- Token não fornecido no header `token`
- Token de usuário incorreto
- Sessão expirada na WuzAPI

**Soluções:**
- Verificar se o token está sendo enviado no header `token`
- Confirmar se o token do usuário está correto
- Verificar status da sessão na WuzAPI

### Erros de Validação (400)

#### Dados Obrigatórios Ausentes
```json
{
  "success": false,
  "error": "Dados inválidos",
  "message": "Nome e token são obrigatórios",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- Campos obrigatórios não fornecidos
- Valores vazios ou nulos
- Formato de dados incorreto

**Soluções:**
- Verificar documentação da API para campos obrigatórios
- Validar dados antes de enviar
- Confirmar tipos de dados corretos

#### Formato de Token Inválido
```json
{
  "success": false,
  "error": "Formato de token administrativo inválido",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- Token com formato incorreto
- Caracteres especiais inválidos
- Comprimento inadequado

**Soluções:**
- Verificar formato esperado do token
- Remover caracteres especiais desnecessários
- Confirmar comprimento do token

#### Dados de Branding Inválidos
```json
{
  "success": false,
  "error": "Dados de configuração inválidos",
  "message": "appName deve ter entre 1 e 50 caracteres",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- Nome da aplicação muito longo ou vazio
- URL do logo inválida
- Cores em formato incorreto

**Soluções:**
- Verificar limites de caracteres (1-50 para appName)
- Validar URLs com formato correto
- Usar cores no formato #RRGGBB

### Erros de Recurso (404)

#### Usuário Não Encontrado
```json
{
  "success": false,
  "error": "Usuário não encontrado",
  "code": 404,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- ID do usuário incorreto
- Usuário foi removido
- Erro de digitação no ID

**Soluções:**
- Verificar se o ID do usuário está correto
- Listar usuários para confirmar existência
- Verificar se o usuário não foi removido

#### Conexão de Banco Não Encontrada
```json
{
  "success": false,
  "error": "Conexão não encontrada",
  "message": "Conexão com ID 123 não existe",
  "code": 404,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- ID da conexão incorreto
- Conexão foi removida
- Usuário sem acesso à conexão

**Soluções:**
- Verificar ID da conexão
- Listar conexões disponíveis
- Confirmar permissões de acesso

### Erros de Conflito (409)

#### Usuário Já Existe
```json
{
  "success": false,
  "error": "Usuário com este token já existe",
  "code": 409,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- Token já está em uso
- Tentativa de criar usuário duplicado

**Soluções:**
- Usar token único
- Verificar se usuário já existe antes de criar
- Atualizar usuário existente em vez de criar novo

### Erros de Comunicação (502/504)

#### Erro na WuzAPI
```json
{
  "success": false,
  "error": "Erro na comunicação com WuzAPI",
  "code": 502,
  "details": "Connection refused",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- WuzAPI indisponível
- Problemas de rede
- Configuração incorreta da URL base

**Soluções:**
- Verificar se WuzAPI está funcionando
- Testar conectividade de rede
- Confirmar URL base da WuzAPI

#### Timeout na WuzAPI
```json
{
  "success": false,
  "error": "Timeout na comunicação com WuzAPI",
  "code": 504,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- WuzAPI respondendo lentamente
- Timeout configurado muito baixo
- Sobrecarga na WuzAPI

**Soluções:**
- Aumentar timeout nas requisições
- Verificar performance da WuzAPI
- Implementar retry logic

### Erros Internos (500)

#### Erro no Banco de Dados
```json
{
  "success": false,
  "error": "Erro interno do servidor",
  "code": 500,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Causas:**
- Problemas com banco de dados (Supabase)
- Erro de conexão
- Timeout de operação

**Soluções:**
- Verificar logs do servidor
- Confirmar conectividade com Supabase
- Verificar variáveis de ambiente

## Troubleshooting por Endpoint

### Endpoints Administrativos

#### GET /api/admin/users

**Erro Comum:**
```bash
curl -H "Authorization: token_errado" http://localhost:3001/api/admin/users
```

**Resposta:**
```json
{
  "success": false,
  "error": "Token administrativo inválido ou expirado",
  "code": 401
}
```

**Solução:**
```bash
# Usar token correto
curl -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" http://localhost:3001/api/admin/users
```

#### POST /api/admin/users

**Erro Comum:**
```bash
curl -X POST \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{"name": ""}' \
  http://localhost:3001/api/admin/users
```

**Resposta:**
```json
{
  "success": false,
  "error": "Dados inválidos",
  "message": "Nome e token são obrigatórios",
  "code": 400
}
```

**Solução:**
```bash
curl -X POST \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{"name": "Minha Instância", "token": "abc123"}' \
  http://localhost:3001/api/admin/users
```

### Endpoints de Sessão

#### GET /api/session/status

**Erro Comum:**
```bash
curl http://localhost:3001/api/session/status
```

**Resposta:**
```json
{
  "success": false,
  "error": "Token não fornecido ou formato inválido",
  "code": 400
}
```

**Solução:**
```bash
curl -H "token: abc123def456" http://localhost:3001/api/session/status
```

### Endpoints de Branding

#### PUT /api/admin/branding

**Erro Comum:**
```bash
curl -X PUT \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{"appName": "", "primaryColor": "azul"}' \
  http://localhost:3001/api/admin/branding
```

**Resposta:**
```json
{
  "success": false,
  "error": "Dados de configuração inválidos",
  "message": "appName deve ter entre 1 e 50 caracteres e primaryColor deve estar no formato #RRGGBB",
  "code": 400
}
```

**Solução:**
```bash
curl -X PUT \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{"appName": "Minha Empresa", "primaryColor": "#007bff"}' \
  http://localhost:3001/api/admin/branding
```

## Logs e Debugging

### Verificar Logs do Servidor

```bash
# Logs em tempo real
tail -f server/logs/app.log

# Filtrar erros
grep "ERROR" server/logs/app.log

# Logs de uma requisição específica
grep "request_id_123" server/logs/app.log
```

### Logs Estruturados

Os logs seguem formato estruturado JSON:

```json
{
  "level": "error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Erro ao validar token administrativo",
  "url": "/api/admin/users",
  "method": "GET",
  "error_message": "Token format invalid",
  "user_agent": "curl/7.68.0",
  "ip": "127.0.0.1"
}
```

### Debug Mode

Para ativar modo debug:

```bash
# Definir variável de ambiente
export DEBUG=true
export LOG_LEVEL=debug

# Reiniciar servidor
npm run dev
```

## Soluções Comuns

### 1. Problemas de CORS

**Erro:**
```
Access to fetch at 'http://localhost:3001/api/admin/users' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solução:**
- Verificar configuração CORS no servidor
- Adicionar origem permitida nas configurações
- Usar proxy em desenvolvimento

### 2. Timeout em Requisições

**Erro:**
```json
{
  "success": false,
  "error": "Timeout na comunicação com WuzAPI",
  "code": 504
}
```

**Soluções:**
- Aumentar timeout nas configurações
- Implementar retry logic
- Verificar performance da WuzAPI

### 3. Banco de Dados Bloqueado

**Erro:**
```json
{
  "success": false,
  "error": "Database is locked",
  "code": 500
}
```

**Soluções:**
- Verificar se há processos usando o banco
- Reiniciar servidor
- Verificar permissões de arquivo

### 4. Memória Insuficiente

**Erro:**
```json
{
  "success": false,
  "error": "Out of memory",
  "code": 500
}
```

**Soluções:**
- Aumentar limite de memória do Node.js
- Otimizar consultas de banco
- Implementar paginação

### 5. Rate Limiting

**Erro:**
```json
{
  "success": false,
  "error": "Too many requests",
  "code": 429
}
```

**Soluções:**
- Implementar backoff exponencial
- Reduzir frequência de requisições
- Usar cache quando possível

## Scripts de Monitoramento

### Script de Health Check

```bash
#!/bin/bash

API_BASE="http://localhost:3001"

# Verificar saúde geral
health_status=$(curl -s "$API_BASE/health" | jq -r '.status')

if [ "$health_status" != "ok" ]; then
    echo "ALERTA: Sistema com problemas - Status: $health_status"
    exit 1
fi

# Verificar serviços específicos
admin_health=$(curl -s "$API_BASE/api/admin/health" | jq -r '.data.status')
session_health=$(curl -s "$API_BASE/api/session/health" | jq -r '.data.status')

if [ "$admin_health" != "healthy" ] || [ "$session_health" != "healthy" ]; then
    echo "ALERTA: Serviços com problemas"
    echo "Admin: $admin_health"
    echo "Session: $session_health"
    exit 1
fi

echo "Todos os serviços funcionando normalmente"
```

### Script de Teste de Conectividade

```python
import requests
import time
import json

def test_endpoint(url, headers=None, expected_status=200):
    """Testar endpoint específico"""
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == expected_status:
            print(f"✅ {url} - OK")
            return True
        else:
            print(f"❌ {url} - Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"⏰ {url} - Timeout")
        return False
    except requests.exceptions.ConnectionError:
        print(f"🔌 {url} - Connection Error")
        return False
    except Exception as e:
        print(f"❌ {url} - Error: {str(e)}")
        return False

# Configurações
BASE_URL = "http://localhost:3001"
ADMIN_TOKEN = "UeH7cZ2c1K3zVUBFi7SginSC"
USER_TOKEN = "abc123def456ghi789"

# Testes
tests = [
    (f"{BASE_URL}/health", None, 200),
    (f"{BASE_URL}/api/admin/health", None, 200),
    (f"{BASE_URL}/api/session/health", None, 200),
    (f"{BASE_URL}/api/admin/users", {"Authorization": ADMIN_TOKEN}, 200),
    (f"{BASE_URL}/api/session/status", {"token": USER_TOKEN}, 200),
]

print("Iniciando testes de conectividade...")
print("=" * 50)

success_count = 0
total_tests = len(tests)

for url, headers, expected_status in tests:
    if test_endpoint(url, headers, expected_status):
        success_count += 1
    time.sleep(1)  # Evitar rate limiting

print("=" * 50)
print(f"Resultados: {success_count}/{total_tests} testes passaram")

if success_count == total_tests:
    print("🎉 Todos os testes passaram!")
else:
    print("⚠️  Alguns testes falharam. Verificar logs do servidor.")
```

## Contato e Suporte

Para problemas não cobertos nesta documentação:

1. **Verificar Logs**: Sempre verificar logs do servidor primeiro
2. **GitHub Issues**: Reportar bugs no repositório do projeto
3. **Documentação**: Consultar documentação completa da API
4. **Comunidade**: Participar de discussões na comunidade

## Atualizações

Esta documentação é atualizada regularmente. Verificar versão mais recente em:
- Documentação online
- Arquivo CHANGELOG.md
- Release notes no GitHub