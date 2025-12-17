# Migrações SQLite - Arquivo Histórico

## ⚠️ IMPORTANTE: Este diretório é apenas para referência histórica

O WUZAPI Manager **não utiliza mais SQLite**. O sistema foi migrado para **Supabase (PostgreSQL)** em Dezembro de 2025.

## Por que manter este diretório?

1. **Referência histórica**: Documenta a evolução do schema do banco de dados
2. **Entendimento do sistema**: Ajuda a entender como as tabelas foram criadas e modificadas
3. **Migração de dados**: Pode ser útil para entender estruturas antigas caso seja necessário migrar dados legados

## Estrutura Atual

O sistema agora utiliza:
- **Supabase** como banco de dados (PostgreSQL hospedado)
- **SupabaseService** (`server/services/SupabaseService.js`) como abstração de acesso
- **Migrações gerenciadas pelo Supabase** (via Dashboard ou CLI)

## Arquivos neste diretório

Os arquivos `.js` e `.sql` neste diretório são migrações SQLite que foram executadas historicamente:

- `002_add_view_configuration.js` - Configuração de visualização
- `003_add_custom_home_html.js` - HTML customizado da home
- `004_add_messages_table.js` - Tabela de mensagens
- ... (e muitos outros)

## NÃO EXECUTE ESTAS MIGRAÇÕES

Estas migrações são para SQLite e **não funcionarão** com Supabase. O schema atual do banco de dados é gerenciado diretamente no Supabase.

## Para desenvolvedores

Se você precisa modificar o schema do banco de dados:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Use o SQL Editor ou Table Editor
3. Documente as mudanças no código se necessário

## Referências

- Documentação do Supabase: https://supabase.com/docs
- SupabaseService: `server/services/SupabaseService.js`
- Configuração: Variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`

---

**Última atualização:** Dezembro 2025
**Motivo da migração:** Escalabilidade, recursos avançados (RLS, Realtime), e simplificação da infraestrutura
