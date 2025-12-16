# Exemplos de Uso da API WUZAPI Manager

Este documento contém exemplos práticos de como usar a API do WUZAPI Manager.

## Índice

- [Autenticação](#autenticação)
- [Endpoints Administrativos](#endpoints-administrativos)
- [Gerenciamento de Sessões](#gerenciamento-de-sessões)
- [Configuração de Branding](#configuração-de-branding)
- [Conexões de Banco de Dados](#conexões-de-banco-de-dados)
- [Endpoints de Usuário](#endpoints-de-usuário)
- [Webhooks](#webhooks)
- [Envio de Mensagens](#envio-de-mensagens)
- [Tratamento de Erros](#tratamento-de-erros)

## Autenticação

### Token Administrativo
```bash
# Definir token administrativo
ADMIN_TOKEN="UeH7cZ2c1K3zVUBFi7SginSC"

# Usar em requisições admin
curl -H "Authorization: $ADMIN_TOKEN" \
     http://localhost:3001/api/admin/users
```

### Token de Usuário
```bash
# Definir token de usuário
USER_TOKEN="abc123def456ghi789"

# Usar em requisições de usuário
curl -H "token: $USER_TOKEN" \
     http://localhost:3001/api/session/status
```

## Endpoints Administrativos

### 1. Listar Todos os Usuários

```bash
curl -X GET \
  http://localhost:3001/api/admin/users \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

**Resposta:**
```json
{
  "success": true,
  "code": 200,
  "data": {
    "users": [
      {
        "id": "user1",
        "name": "João Silva",
        "connected": true,
        "loggedIn": true,
        "jid": "5511999999999@s.whatsapp.net"
      }
    ],
    "filtered_data": [...],
    "stats": {
      "total": 5,
      "connected": 3,
      "logged_in": 2,
      "disconnected": 2
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Filtrar Usuários Conectados

```bash
curl -X GET \
  "http://localhost:3001/api/admin/users?connected_only=true&include_stats=true" \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

### 3. Criar Novo Usuário

```bash
curl -X POST \
  http://localhost:3001/api/admin/users \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nova Instância",
    "token": "novo_token_123",
    "webhook": "https://meusite.com/webhook",
    "events": "Message,ReadReceipt"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "code": 201,
  "data": {
    "id": "novo_user_id",
    "name": "Nova Instância",
    "connected": false,
    "loggedIn": false,
    "token": "novo_token_123"
  },
  "message": "Usuário criado com sucesso",
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### 4. Obter Usuário Específico

```bash
curl -X GET \
  http://localhost:3001/api/admin/users/user1 \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

### 5. Remover Usuário (Banco Apenas)

```bash
curl -X DELETE \
  http://localhost:3001/api/admin/users/user1 \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

### 6. Remover Usuário Completamente

```bash
curl -X DELETE \
  http://localhost:3001/api/admin/users/user1/full \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

### 7. Obter Estatísticas Administrativas

```bash
curl -X GET \
  http://localhost:3001/api/admin/stats \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

### 8. Estatísticas do Dashboard

```bash
curl -X GET \
  http://localhost:3001/api/admin/dashboard-stats \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

## Gerenciamento de Sessões

### 1. Verificar Status da Sessão

```bash
curl -X GET \
  http://localhost:3001/api/session/status \
  -H "token: abc123def456ghi789"
```

**Resposta:**
```json
{
  "success": true,
  "code": 200,
  "data": {
    "Connected": true,
    "LoggedIn": true,
    "JID": "5511999999999@s.whatsapp.net"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Conectar Sessão WhatsApp

```bash
curl -X POST \
  http://localhost:3001/api/session/connect \
  -H "token: abc123def456ghi789" \
  -H "Content-Type: application/json" \
  -d '{
    "Subscribe": ["Message", "ReadReceipt"],
    "Immediate": false
  }'
```

### 3. Desconectar Sessão

```bash
curl -X POST \
  http://localhost:3001/api/session/disconnect \
  -H "token: abc123def456ghi789"
```

### 4. Logout da Sessão

```bash
curl -X POST \
  http://localhost:3001/api/session/logout \
  -H "token: abc123def456ghi789"
```

### 5. Obter QR Code

```bash
curl -X GET \
  http://localhost:3001/api/session/qr \
  -H "token: abc123def456ghi789"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "QRCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

### 6. Informações do Token

```bash
curl -X GET \
  http://localhost:3001/api/session/token-info \
  -H "token: abc123def456ghi789"
```

## Configuração de Branding

### 1. Obter Configuração Atual

```bash
curl -X GET \
  http://localhost:3001/api/admin/branding \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

**Resposta:**
```json
{
  "success": true,
  "code": 200,
  "data": {
    "id": 1,
    "appName": "WUZAPI Manager",
    "logoUrl": "https://exemplo.com/logo.png",
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Atualizar Branding

```bash
curl -X PUT \
  http://localhost:3001/api/admin/branding \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "Minha Empresa WhatsApp",
    "logoUrl": "https://minhaempresa.com/logo.png",
    "primaryColor": "#28a745",
    "secondaryColor": "#17a2b8"
  }'
```

## Conexões de Banco de Dados

### 1. Listar Todas as Conexões

```bash
curl -X GET \
  http://localhost:3001/api/database-connections
```

### 2. Criar Conexão MySQL

```bash
curl -X POST \
  http://localhost:3001/api/database-connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Banco Principal",
    "type": "MYSQL",
    "host": "localhost",
    "port": 3306,
    "database": "meu_banco",
    "username": "usuario",
    "password": "senha123"
  }'
```

### 3. Criar Conexão NocoDB

```bash
curl -X POST \
  http://localhost:3001/api/database-connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NocoDB Leads",
    "type": "NOCODB",
    "host": "https://app.nocodb.com",
    "nocodbToken": "nc_token_123",
    "nocodbProjectId": "projeto_123",
    "nocodbTableId": "tabela_456"
  }'
```

### 4. Atualizar Conexão

```bash
curl -X PUT \
  http://localhost:3001/api/database-connections/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Banco Atualizado",
    "type": "MYSQL",
    "host": "novo-host.com",
    "port": 3306,
    "database": "novo_banco",
    "username": "novo_usuario",
    "password": "nova_senha"
  }'
```

### 5. Atualizar Status da Conexão

```bash
curl -X PATCH \
  http://localhost:3001/api/database-connections/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "connected"
  }'
```

### 6. Deletar Conexão

```bash
curl -X DELETE \
  http://localhost:3001/api/database-connections/1
```

## Endpoints de Usuário

### 1. Histórico de Mensagens

```bash
curl -X GET \
  "http://localhost:3001/api/user/messages?limit=20&offset=0" \
  -H "token: abc123def456ghi789"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "1",
        "phone": "5511999999999",
        "message": "Olá! Como posso ajudá-lo hoje?",
        "timestamp": "2024-01-15T09:30:00.000Z",
        "status": "sent",
        "type": "text"
      }
    ],
    "total": 50,
    "limit": 20,
    "offset": 0
  }
}
```

### 2. Estatísticas do Dashboard do Usuário

```bash
curl -X GET \
  http://localhost:3001/api/user/dashboard-stats \
  -H "token: abc123def456ghi789"
```

### 3. Conexões do Usuário

```bash
curl -X GET \
  http://localhost:3001/api/user/database-connections \
  -H "token: abc123def456ghi789"
```

### 4. Dados da Tabela

```bash
curl -X GET \
  http://localhost:3001/api/user/database-connections/1/data \
  -H "token: abc123def456ghi789"
```

### 5. Criar Registro na Tabela

```bash
curl -X POST \
  http://localhost:3001/api/user/database-connections/1/data \
  -H "token: abc123def456ghi789" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "telefone": "5511999999999",
    "email": "joao@exemplo.com"
  }'
```

### 6. Atualizar Registro

```bash
curl -X PUT \
  http://localhost:3001/api/user/database-connections/1/data/123 \
  -H "token: abc123def456ghi789" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva Santos",
    "telefone": "5511888888888"
  }'
```

### 7. Deletar Registro

```bash
curl -X DELETE \
  http://localhost:3001/api/user/database-connections/1/data/123 \
  -H "token: abc123def456ghi789"
```

## Webhooks

### 1. Obter Configuração de Webhook

```bash
curl -X GET \
  http://localhost:3001/api/webhook \
  -H "token: abc123def456ghi789"
```

**Resposta:**
```json
{
  "success": true,
  "webhook": "https://meusite.com/webhook",
  "events": ["Message", "ReadReceipt", "MessageStatus"],
  "subscribe": ["Message"],
  "data": {
    "webhook": "https://meusite.com/webhook",
    "events": ["Message", "ReadReceipt", "MessageStatus"],
    "subscribe": ["Message"]
  }
}
```

### 2. Atualizar Webhook

```bash
curl -X POST \
  http://localhost:3001/api/webhook \
  -H "token: abc123def456ghi789" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": "https://novosite.com/webhook",
    "events": ["Message", "ReadReceipt", "MessageStatus", "Call"],
    "subscribe": ["Message", "ReadReceipt"]
  }'
```

## Envio de Mensagens

### 1. Enviar Mensagem de Texto

```bash
curl -X POST \
  http://localhost:3001/api/chat/send/text \
  -H "token: abc123def456ghi789" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5511999999999",
    "Body": "Olá! Esta é uma mensagem de teste."
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso",
  "data": {
    "messageId": "msg_123456",
    "status": "sent"
  }
}
```

## Tratamento de Erros

### Exemplo de Erro 400 - Bad Request

```bash
curl -X POST \
  http://localhost:3001/api/admin/users \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "token": ""
  }'
```

**Resposta:**
```json
{
  "success": false,
  "error": "Dados inválidos",
  "message": "Nome e token são obrigatórios",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Exemplo de Erro 401 - Unauthorized

```bash
curl -X GET \
  http://localhost:3001/api/admin/users \
  -H "Authorization: token_invalido"
```

**Resposta:**
```json
{
  "success": false,
  "error": "Token administrativo inválido ou expirado",
  "code": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Exemplo de Erro 404 - Not Found

```bash
curl -X GET \
  http://localhost:3001/api/admin/users/usuario_inexistente \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC"
```

**Resposta:**
```json
{
  "success": false,
  "error": "Usuário não encontrado",
  "code": 404,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Exemplo de Erro 502 - Bad Gateway

```json
{
  "success": false,
  "error": "Erro na comunicação com WuzAPI",
  "code": 502,
  "details": "Connection refused",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Exemplo de Erro 504 - Timeout

```json
{
  "success": false,
  "error": "Timeout na comunicação com WuzAPI",
  "code": 504,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Verificação de Saúde

### Health Check Geral

```bash
curl -X GET http://localhost:3001/health
```

### Health Check do Serviço Administrativo

```bash
curl -X GET http://localhost:3001/api/admin/health
```

### Health Check do Serviço de Sessão

```bash
curl -X GET http://localhost:3001/api/session/health
```

## Scripts de Automação

### Script Bash para Monitoramento

```bash
#!/bin/bash

# Configurações
API_BASE="http://localhost:3001"
ADMIN_TOKEN="UeH7cZ2c1K3zVUBFi7SginSC"

# Função para verificar saúde
check_health() {
    echo "Verificando saúde do sistema..."
    curl -s "$API_BASE/health" | jq '.status'
}

# Função para listar usuários conectados
list_connected_users() {
    echo "Usuários conectados:"
    curl -s -H "Authorization: $ADMIN_TOKEN" \
         "$API_BASE/api/admin/users?connected_only=true" | \
         jq '.data.filtered_data[] | {name: .name, connected: .connected, loggedIn: .loggedIn}'
}

# Executar verificações
check_health
list_connected_users
```

### Script Python para Integração

```python
import requests
import json

class WuzAPIManager:
    def __init__(self, base_url, admin_token=None, user_token=None):
        self.base_url = base_url
        self.admin_token = admin_token
        self.user_token = user_token
    
    def get_users(self, connected_only=False):
        """Obter lista de usuários"""
        url = f"{self.base_url}/api/admin/users"
        headers = {"Authorization": self.admin_token}
        params = {"connected_only": connected_only} if connected_only else {}
        
        response = requests.get(url, headers=headers, params=params)
        return response.json()
    
    def create_user(self, name, token, webhook=None):
        """Criar novo usuário"""
        url = f"{self.base_url}/api/admin/users"
        headers = {
            "Authorization": self.admin_token,
            "Content-Type": "application/json"
        }
        data = {
            "name": name,
            "token": token,
            "webhook": webhook
        }
        
        response = requests.post(url, headers=headers, json=data)
        return response.json()
    
    def send_message(self, phone, message):
        """Enviar mensagem de texto"""
        url = f"{self.base_url}/api/chat/send/text"
        headers = {
            "token": self.user_token,
            "Content-Type": "application/json"
        }
        data = {
            "Phone": phone,
            "Body": message
        }
        
        response = requests.post(url, headers=headers, json=data)
        return response.json()

# Exemplo de uso
if __name__ == "__main__":
    api = WuzAPIManager(
        base_url="http://localhost:3001",
        admin_token="UeH7cZ2c1K3zVUBFi7SginSC",
        user_token="abc123def456ghi789"
    )
    
    # Listar usuários conectados
    users = api.get_users(connected_only=True)
    print("Usuários conectados:", json.dumps(users, indent=2))
    
    # Enviar mensagem
    result = api.send_message("5511999999999", "Olá do Python!")
    print("Resultado do envio:", json.dumps(result, indent=2))
```

## Navegação Dinâmica de Sidebar (Novo)

### 1. Obter Conexões do Usuário

```bash
curl -X GET \
  http://localhost:3001/api/user/database-connections \
  -H "Authorization: Bearer abc123def456ghi789"
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Teste Final",
      "type": "NOCODB",
      "host": "https://nocodb.example.com",
      "nocodb_project_id": "p123",
      "nocodb_table_id": "my7kpxstrt02976",
      "table_name": "users",
      "user_link_field": "apiToken",
      "field_mappings": [
        {
          "columnName": "companyName",
          "label": "Nome da Empresa",
          "visible": true,
          "editable": true
        },
        {
          "columnName": "websiteUrl",
          "label": "Website",
          "visible": true,
          "editable": true
        }
      ],
      "assignedUsers": ["abc123def456ghi789"],
      "status": "connected"
    }
  ]
}
```

### 2. Buscar Registro Único do Usuário

```bash
curl -X GET \
  http://localhost:3001/api/user/database-connections/1/record \
  -H "Authorization: Bearer abc123def456ghi789"
```

**Resposta (Sucesso):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "created_at": "2025-10-30T11:30:40+00:00",
    "updated_at": "2025-11-04T20:51:09+00:00",
    "companyName": "Minha Empresa",
    "websiteUrl": "https://minhaempresa.com",
    "apiToken": "abc123def456ghi789"
  },
  "metadata": {
    "connectionId": 1,
    "connectionName": "Teste Final",
    "tableName": "my7kpxstrt02976",
    "userLinkField": "apiToken"
  }
}
```

**Resposta (Registro Não Encontrado):**
```json
{
  "success": false,
  "error": "No record found for this user",
  "code": "RECORD_NOT_FOUND",
  "suggestion": "Contact administrator to create a record for your account",
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

**Resposta (Acesso Negado):**
```json
{
  "success": false,
  "error": "Access denied to this connection",
  "code": "FORBIDDEN",
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

### 3. Atualizar Registro do Usuário

```bash
curl -X PUT \
  http://localhost:3001/api/user/database-connections/1/data/1 \
  -H "Authorization: Bearer abc123def456ghi789" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "NovaEmpresa",
    "websiteUrl": "https://nova.empresa.com.br"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Record updated successfully",
  "data": {
    "id": 1,
    "companyName": "NovaEmpresa",
    "websiteUrl": "https://nova.empresa.com.br",
    "updated_at": "2025-11-07T10:35:00.000Z"
  }
}
```

### 4. Fluxo Completo de Navegação

```bash
#!/bin/bash

USER_TOKEN="abc123def456ghi789"
API_BASE="http://localhost:3001"

# 1. Obter conexões do usuário
echo "1. Buscando conexões..."
CONNECTIONS=$(curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$API_BASE/api/user/database-connections")

echo "$CONNECTIONS" | jq '.data[] | {id, name, type}'

# 2. Extrair ID da primeira conexão
CONNECTION_ID=$(echo "$CONNECTIONS" | jq -r '.data[0].id')
echo -e "\n2. Usando conexão ID: $CONNECTION_ID"

# 3. Buscar registro do usuário
echo -e "\n3. Buscando registro do usuário..."
RECORD=$(curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$API_BASE/api/user/database-connections/$CONNECTION_ID/record")

echo "$RECORD" | jq '.data'

# 4. Extrair ID do registro
RECORD_ID=$(echo "$RECORD" | jq -r '.data.id')
echo -e "\n4. Registro ID: $RECORD_ID"

# 5. Atualizar registro
echo -e "\n5. Atualizando registro..."
UPDATE_RESULT=$(curl -s -X PUT \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Updated via API"}' \
  "$API_BASE/api/user/database-connections/$CONNECTION_ID/data/$RECORD_ID")

echo "$UPDATE_RESULT" | jq '.'
```

### 5. Exemplo Python - Cliente de Navegação

```python
import requests
from typing import List, Dict, Optional

class DynamicSidebarClient:
    def __init__(self, base_url: str, user_token: str):
        self.base_url = base_url
        self.user_token = user_token
        self.headers = {
            "Authorization": f"Bearer {user_token}",
            "Content-Type": "application/json"
        }
    
    def get_connections(self) -> List[Dict]:
        """Obter todas as conexões do usuário"""
        url = f"{self.base_url}/api/user/database-connections"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()["data"]
    
    def get_user_record(self, connection_id: int) -> Optional[Dict]:
        """Buscar registro do usuário para uma conexão"""
        url = f"{self.base_url}/api/user/database-connections/{connection_id}/record"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 404:
            print(f"No record found for connection {connection_id}")
            return None
        
        response.raise_for_status()
        result = response.json()
        return result["data"]
    
    def update_record(self, connection_id: int, record_id: int, data: Dict) -> Dict:
        """Atualizar registro do usuário"""
        url = f"{self.base_url}/api/user/database-connections/{connection_id}/data/{record_id}"
        response = requests.put(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()
    
    def navigate_to_edit(self, connection_id: int) -> Optional[Dict]:
        """Simular navegação: buscar conexão e registro"""
        # Buscar registro
        record = self.get_user_record(connection_id)
        
        if not record:
            return None
        
        return {
            "connection_id": connection_id,
            "record_id": record["id"],
            "record_data": record
        }

# Exemplo de uso
if __name__ == "__main__":
    client = DynamicSidebarClient(
        base_url="http://localhost:3001",
        user_token="abc123def456ghi789"
    )
    
    # Listar conexões
    print("Conexões disponíveis:")
    connections = client.get_connections()
    for conn in connections:
        print(f"  - {conn['name']} (ID: {conn['id']}, Type: {conn['type']})")
    
    # Navegar para primeira conexão
    if connections:
        connection_id = connections[0]["id"]
        print(f"\nNavegando para conexão {connection_id}...")
        
        edit_data = client.navigate_to_edit(connection_id)
        if edit_data:
            print(f"Registro carregado: {edit_data['record_data']}")
            
            # Atualizar campo
            print("\nAtualizando registro...")
            result = client.update_record(
                connection_id=edit_data["connection_id"],
                record_id=edit_data["record_id"],
                data={"companyName": "Updated from Python"}
            )
            print(f"Resultado: {result}")
```

### 6. Tratamento de Erros Específicos

```bash
# Função para tratar erros da API de navegação
handle_navigation_error() {
    local response=$1
    local error_code=$(echo "$response" | jq -r '.code')
    
    case $error_code in
        "CONNECTION_NOT_FOUND")
            echo "Erro: Conexão não encontrada. Verifique o ID."
            ;;
        "RECORD_NOT_FOUND")
            echo "Erro: Nenhum registro encontrado para este usuário."
            echo "Sugestão: Contate o administrador para criar um registro."
            ;;
        "FORBIDDEN")
            echo "Erro: Acesso negado a esta conexão."
            echo "Verifique se você tem permissão."
            ;;
        "UNAUTHORIZED")
            echo "Erro: Token inválido ou expirado."
            echo "Faça login novamente."
            ;;
        *)
            echo "Erro desconhecido: $error_code"
            echo "$response" | jq '.'
            ;;
    esac
}

# Uso
RESPONSE=$(curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$API_BASE/api/user/database-connections/999/record")

if [ "$(echo "$RESPONSE" | jq -r '.success')" = "false" ]; then
    handle_navigation_error "$RESPONSE"
fi
```

## Notas Importantes

1. **Rate Limiting**: A API pode ter limitações de taxa. Implemente retry logic em suas integrações.

2. **Timeouts**: Configure timeouts apropriados em suas requisições (recomendado: 10-15 segundos).

3. **Logs**: Monitore os logs do servidor para debugging e troubleshooting.

4. **Segurança**: Mantenha os tokens seguros e use HTTPS em produção.

5. **Versionamento**: A API pode evoluir. Monitore mudanças na documentação.

6. **Webhook Validation**: Sempre valide webhooks recebidos para garantir autenticidade.

7. **Caching**: A navegação dinâmica usa cache no frontend. Considere isso ao testar atualizações.

8. **Field Mappings**: Respeite as configurações de visibilidade e editabilidade dos campos ao atualizar registros.

7. **Error Handling**: Implemente tratamento robusto de erros em suas integrações.