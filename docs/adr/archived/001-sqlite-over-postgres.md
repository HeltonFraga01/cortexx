# ADR 001: SQLite sobre PostgreSQL

## Status
Aceito

## Contexto
O WUZAPI Manager precisa de um banco de dados para persistência. As opções consideradas foram PostgreSQL (banco cliente-servidor) e SQLite (banco embarcado).

## Decisão
Escolhemos SQLite com modo WAL (Write-Ahead Logging) como motor de persistência principal.

## Justificativa

### Vantagens do SQLite para este caso de uso:
1. **Latência**: Consultas em <1ms (sem overhead de rede)
2. **Simplicidade Operacional**: Sem servidor separado para gerenciar
3. **Backup Simples**: Arquivo único, fácil de copiar
4. **Performance**: Com WAL mode, suporta centenas de req/s em single-node
5. **Custo**: Zero custo de infraestrutura adicional

### Configurações Críticas (Manual de Engenharia Seção 3.2):
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -20000;
```

### Restrições Aceitas:
- Single-instance apenas (sem escala horizontal de escrita)
- Requer node pinning em Docker Swarm
- Backup contínuo via Litestream para DR

## Consequências

### Positivas:
- Menor complexidade operacional
- Menor custo de infraestrutura
- Performance superior para workloads de leitura

### Negativas:
- Não suporta múltiplas réplicas de escrita
- Requer estratégia de backup específica (Litestream)
- Dependência de file locking do sistema de arquivos

## Referências
- Manual de Engenharia WUZAPI Manager, Seção 3
- SQLite WAL Mode: https://sqlite.org/wal.html
- Litestream: https://litestream.io/
