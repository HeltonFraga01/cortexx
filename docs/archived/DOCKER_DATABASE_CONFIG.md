# Configuração do Banco de Dados para Docker

## Problema Resolvido

O sistema estava exibindo erro de conexão com o banco SQLite mesmo quando a conexão estava funcionando corretamente. Isso ocorria porque o frontend estava verificando o campo errado na resposta da API.

## Correção Aplicada

### Frontend (`src/services/database-connections.ts`)

**Antes:**
```typescript
if (response.success && response.data?.status === 'connected') {
  return { success: true };
}
```

**Depois:**
```typescript
if (response.success) {
  const connectionStatus = response.data?.data?.status;
  if (connectionStatus === 'connected') {
    return { success: true };
  }
}
```

A API retorna a estrutura:
```json
{
  "success": true,
  "message": "Conexão SQLite testada com sucesso",
  "data": {
    "status": "connected",
    "type": "SQLITE",
    "database": "wuzapi.db"
  }
}
```

## Configuração para Docker

### Variáveis de Ambiente

O sistema está configurado para funcionar tanto em desenvolvimento quanto em produção (Docker):

**Desenvolvimento:**
```env
SQLITE_DB_PATH=./server/wuzapi.db
```

**Produção (Docker):**
```env
SQLITE_DB_PATH=/app/data/wuzapi.db
```

### Dockerfile

O Dockerfile já está configurado corretamente:

```dockerfile
ENV SQLITE_DB_PATH=/app/data/wuzapi.db

# Criar diretórios necessários com permissões corretas
RUN mkdir -p /app/data /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app
```

### Docker Compose

O volume está mapeado corretamente para persistir os dados:

```yaml
services:
  wuzapi-manager-dev:
    environment:
      - SQLITE_DB_PATH=/app/data/wuzapi.db
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

## Como o Sistema Funciona

1. **Inicialização**: O `SQLiteConfig` (`server/config/sqlite.js`) lê a variável `SQLITE_DB_PATH`
2. **Criação de Diretório**: Se o diretório não existir, ele é criado automaticamente
3. **Verificação de Permissões**: O sistema verifica se tem permissão de leitura/escrita
4. **Conexão**: O banco é criado/conectado no caminho especificado

## Testando a Conexão

### Via Interface Web

1. Acesse `http://localhost:8080/admin/databases`
2. Clique em "Testar Conexões"
3. O status deve mostrar "Conectado" em verde

### Via API

```bash
# Health check
curl http://localhost:3001/health

# Testar conexão específica
curl -X POST http://localhost:3001/api/database-connections/1/test
```

## Troubleshooting

### Erro: "Diretório do banco de dados não encontrado"

**Solução**: Certifique-se de que o volume está mapeado corretamente no docker-compose.yml

```yaml
volumes:
  - ./data:/app/data  # Mapeia ./data do host para /app/data no container
```

### Erro: "Sem permissão de escrita"

**Solução**: Verifique as permissões do diretório no host:

```bash
chmod -R 755 ./data
```

### Banco não persiste após restart

**Solução**: Verifique se o volume está configurado corretamente e se o caminho `SQLITE_DB_PATH` aponta para dentro do volume mapeado.

## Backup Automático

O docker-compose inclui um serviço de backup automático:

```yaml
wuzapi-db-backup:
  volumes:
    - ./data:/data
    - ./backups:/backups
  command: >
    sh -c "
      while true; do
        sqlite3 /data/wuzapi.db \".backup /backups/wuzapi-\$(date +%Y%m%d-%H%M%S).db\"
        find /backups -name 'wuzapi-*.db' -mtime +7 -delete
        sleep 3600
      done
    "
```

Backups são criados a cada hora e mantidos por 7 dias.

## Migração de Dados

### De Desenvolvimento para Produção

```bash
# 1. Fazer backup do banco de desenvolvimento
cp ./server/wuzapi.db ./data/wuzapi.db

# 2. Subir o container
docker-compose up -d

# 3. Verificar se o banco foi carregado
docker-compose exec wuzapi-manager-dev ls -la /app/data/
```

### De Produção para Desenvolvimento

```bash
# 1. Copiar banco do container
docker cp wuzapi-manager-dev:/app/data/wuzapi.db ./server/wuzapi.db

# 2. Reiniciar servidor de desenvolvimento
npm run dev:full
```

## Conclusão

O sistema está totalmente compatível com Docker e pronto para produção. A correção aplicada garante que o status da conexão seja exibido corretamente na interface, e a configuração de volumes garante a persistência dos dados.
