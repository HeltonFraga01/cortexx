# Migration 006: Table Permissions

## Descrição

Esta migration cria a infraestrutura de banco de dados para o sistema de permissões de acesso a tabelas. Permite que administradores configurem quais usuários podem executar operações (read, write, delete) em tabelas específicas do banco de dados.

## Arquivos Criados

- `server/migrations/006_add_table_permissions.js` - Migration principal

## Estrutura da Tabela

```sql
CREATE TABLE table_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  can_read BOOLEAN DEFAULT 0,
  can_write BOOLEAN DEFAULT 0,
  can_delete BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, table_name)
);
```

## Índices Criados

Para otimizar as consultas de permissões:

1. **idx_table_permissions_user_id** - Busca rápida por usuário
2. **idx_table_permissions_table_name** - Busca rápida por tabela
3. **idx_table_permissions_composite** - Busca otimizada por usuário + tabela

## Constraints

- **UNIQUE(user_id, table_name)** - Garante que cada usuário tenha apenas uma configuração de permissão por tabela

## Campos

- **id**: Identificador único da permissão
- **user_id**: ID do usuário (obtido via token de autenticação)
- **table_name**: Nome da tabela no banco SQLite
- **can_read**: Permissão de leitura (SELECT)
- **can_write**: Permissão de escrita (INSERT, UPDATE)
- **can_delete**: Permissão de exclusão (DELETE)
- **created_at**: Data de criação do registro
- **updated_at**: Data da última atualização

## Execução

A migration é executada automaticamente quando o servidor inicia, através do sistema de migrations em `server/index.js`.

## Testes

Foram criados testes para validar:

- ✅ Criação da tabela
- ✅ Criação dos índices
- ✅ Constraint UNIQUE funcionando
- ✅ Operações CRUD (INSERT, SELECT, UPDATE, DELETE)
- ✅ Idempotência (pode ser executada múltiplas vezes)
- ✅ Rollback (função down)

Execute os testes com:

```bash
node server/test-migration-simple.js
node server/test-all-migrations.js
```

## Rollback

Para reverter a migration:

```javascript
const migration = require('./migrations/006_add_table_permissions.js');
await migration.down(db);
```

Isso irá:
1. Remover todos os índices
2. Remover a tabela table_permissions

## Próximos Passos

Após esta migration, os próximos passos são:

1. Implementar métodos no `database.js` para gerenciar permissões
2. Criar middleware de validação de permissões
3. Implementar rotas admin para configuração
4. Implementar rotas de usuário com validação de permissões
5. Criar interfaces frontend para gerenciamento

## Requisitos Atendidos

Esta migration atende aos seguintes requisitos da spec:

- **1.1**: Criar permissões de tabela
- **1.2**: Listar permissões
- **1.3**: Atualizar permissões
- **1.4**: Deletar permissões
- **1.5**: Prevenir duplicatas (constraint UNIQUE)
