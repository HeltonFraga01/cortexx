# Documentação de Integração NocoDB

Este diretório contém a documentação completa para integração NocoDB no WUZAPI Manager.

## 📋 Índice

### Guias Principais
- **[Guia de Configuração](./configuration-guide.md)** - Setup passo-a-passo de conexões NocoDB
- **[Guia de Integração](./integration-guide.md)** - Implementação técnica completa
- **[Guia de Operações CRUD](./crud-operations-guide.md)** - Padrões para operações de dados
- **[Guia de Mapeamento de Campos](./field-mapping-guide.md)** - Configuração de campos e validações

### Documentação Técnica
- **[Referência da API](./api-reference.md)** - Endpoints e métodos disponíveis
- **[Exemplos de Código](./code-examples.md)** - Implementações práticas
- **[Troubleshooting](./troubleshooting.md)** - Solução de problemas comuns

## 🚀 Início Rápido

### 1. Configuração Básica
```javascript
const connection = {
  name: 'Minha Base NocoDB',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_123456789',
  nocodb_project_id: 'p_abc123def456',
  nocodb_table_id: 't_xyz789uvw012',
  user_link_field: 'wasendToken'
};
```

### 2. Operações Básicas
```javascript
// Buscar dados do usuário
const data = await db.getUserTableData(userToken, connectionId);

// Criar novo registro
const newRecord = await db.createUserTableRecord(userToken, connectionId, {
  nome: 'João Silva',
  email: 'joao@example.com'
});

// Atualizar registro
await db.updateUserTableRecord(userToken, connectionId, recordId, {
  nome: 'João Santos'
});

// Deletar registro
await db.deleteUserTableRecord(userToken, connectionId, recordId);
```

## 🔧 Configuração Mínima

### Pré-requisitos
- Conta NocoDB ativa
- Token de API válido
- Projeto e tabela configurados
- Campo de vinculação do usuário

### Estrutura Mínima da Tabela
```sql
CREATE TABLE exemplo (
  Id INTEGER PRIMARY KEY,
  wasendToken VARCHAR(255) NOT NULL,  -- Campo obrigatório
  nome VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📊 Casos de Uso Comuns

### CRM/Leads
- Captura automática de leads via WhatsApp
- Acompanhamento de status de vendas
- Histórico de interações

### Sistema de Tickets
- Criação automática de tickets
- Acompanhamento de atendimentos
- Métricas de suporte

### Catálogo de Produtos
- Gerenciamento de inventário
- Consultas via WhatsApp
- Atualizações de preços

## 🔒 Segurança

### Isolamento de Dados
- Filtro automático por token de usuário
- Validação de acesso a conexões
- Logs de auditoria

### Autenticação
- Tokens NocoDB seguros
- Validação de permissões
- Timeout de sessão

## 📈 Performance

### Otimizações
- Cache de validação de usuários
- Limites de registros por requisição
- Timeout configurável

### Monitoramento
- Logs estruturados
- Métricas de performance
- Alertas de erro

## 🆘 Suporte

### Problemas Comuns
1. **Token inválido** → Verificar configuração de API
2. **Projeto não encontrado** → Validar IDs de projeto/tabela
3. **Sem dados** → Verificar campo de vinculação
4. **Timeout** → Ajustar configurações de rede

### Recursos Adicionais
- [Documentação oficial NocoDB](https://docs.nocodb.com/)
- [API Reference NocoDB](https://docs.nocodb.com/developer-resources/rest-apis/)
- [Comunidade NocoDB](https://github.com/nocodb/nocodb/discussions)

---

**Última atualização**: Novembro 2024  
**Versão**: 1.0.0