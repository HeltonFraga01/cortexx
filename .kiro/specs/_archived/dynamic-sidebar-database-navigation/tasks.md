# Implementation Plan

- [x] 1. Backend - Criar novo endpoint para buscar registro único do usuário
  - Implementar GET /api/user/database-connections/:id/record
  - Adicionar validação de token e verificação de acesso
  - Implementar lógica de busca por user_link_field
  - Adicionar suporte para NocoDB, SQLite e bancos relacionais
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3_

- [x] 2. Backend - Criar camada de serviço UserRecordService
  - Criar classe UserRecordService com métodos de busca
  - Implementar fetchNocoDBRecord() para buscar em NocoDB
  - Implementar fetchSQLiteRecord() para buscar em SQLite
  - Implementar fetchSQLRecord() para bancos relacionais
  - Adicionar método hasAccess() para verificar permissões
  - _Requirements: 4.1, 4.2, 4.3, 8.1, 8.2, 8.3_

- [x] 2.1 Escrever testes unitários para UserRecordService
  - Testar busca de registro em NocoDB
  - Testar busca de registro em SQLite
  - Testar verificação de acesso
  - Testar tratamento de erros
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Backend - Adicionar middleware de rate limiting
  - Implementar rate limiter para endpoint de busca de registro
  - Configurar limite de 30 requisições por minuto
  - Adicionar headers de rate limit nas respostas
  - _Requirements: 6.1, 6.2_

- [x] 3.1 Testar rate limiting
  - Verificar que limite é aplicado corretamente
  - Testar resposta quando limite é excedido
  - _Requirements: 6.1, 6.2_

- [x] 4. Frontend - Criar serviço de cache ConnectionCache
  - Criar classe ConnectionCache com métodos set/get/invalidate
  - Implementar lógica de TTL (time to live)
  - Adicionar método invalidatePattern() para invalidação em massa
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 4.1 Escrever testes para ConnectionCache
  - Testar armazenamento e recuperação de dados
  - Testar expiração de cache
  - Testar invalidação de cache
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 5. Frontend - Atualizar DatabaseConnectionsService
  - Adicionar método getUserRecord() para buscar registro único
  - Integrar ConnectionCache nos métodos existentes
  - Implementar invalidação de cache após updates
  - Adicionar tratamento de erros específicos (RECORD_NOT_FOUND, etc.)
  - _Requirements: 4.4, 4.5, 6.3, 6.4, 9.1, 9.2, 9.3, 9.4_

- [x] 6. Frontend - Criar componente DynamicDatabaseItems
  - Criar componente que busca conexões do usuário
  - Implementar renderização de itens de menu dinâmicos
  - Adicionar ícone de Database para cada item
  - Implementar ordenação alfabética das conexões
  - Adicionar estado de loading durante busca
  - Implementar handleConnectionClick() para navegação direct-to-edit
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1_

- [x] 6.1 Escrever testes para DynamicDatabaseItems
  - Testar renderização de conexões
  - Testar ordenação alfabética
  - Testar estado de loading
  - Testar navegação ao clicar
  - _Requirements: 2.1, 2.2, 3.1, 3.5_

- [x] 7. Frontend - Criar componente DirectEditPage
  - Criar página que recebe connectionId via URL params
  - Implementar fetchData() para buscar conexão e registro
  - Adicionar renderização de cabeçalho com nome da conexão
  - Exibir metadados (Tipo do Banco, Tabela, Campo de Vínculo)
  - Implementar RecordForm com campos pré-preenchidos
  - Adicionar botão de salvar com estado de loading
  - _Requirements: 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.1 Implementar tratamento de erros em DirectEditPage
  - Adicionar tratamento para CONNECTION_NOT_FOUND
  - Adicionar tratamento para RECORD_NOT_FOUND
  - Adicionar tratamento para UNAUTHORIZED
  - Exibir mensagens de erro apropriadas
  - Implementar redirecionamento em caso de erro crítico
  - _Requirements: 4.5, 6.3, 6.4_

- [x] 7.2 Escrever testes para DirectEditPage
  - Testar carregamento de dados
  - Testar renderização do formulário
  - Testar salvamento de alterações
  - Testar tratamento de erros
  - _Requirements: 4.4, 5.1, 6.3_

- [x] 8. Frontend - Integrar DynamicDatabaseItems na Sidebar
  - Remover item estático "Meu Banco" da Sidebar
  - Adicionar DynamicDatabaseItems entre "Mensagens" e "Configurações"
  - Garantir que estilos sejam consistentes com outros itens
  - Adicionar lazy loading para DynamicDatabaseItems
  - _Requirements: 1.1, 1.2, 2.5, 3.1, 3.3, 3.4_

- [x] 9. Frontend - Atualizar configuração de rotas
  - Adicionar rota /database/:connectionId/edit/:recordId
  - Adicionar redirect de /meu-banco para /dashboard
  - Remover rotas antigas relacionadas a "Meu Banco"
  - _Requirements: 1.3, 1.4_

- [x] 10. Frontend - Implementar RecordForm component
  - Criar formulário dinâmico baseado em field_mappings
  - Aplicar configurações de visibilidade (visible)
  - Aplicar configurações de editabilidade (editable)
  - Usar labels customizados quando configurados
  - Adicionar validação de campos
  - Implementar handleFieldChange() para atualizar estado
  - _Requirements: 5.4, 5.5_

- [x] 10.1 Escrever testes para RecordForm
  - Testar renderização de campos
  - Testar aplicação de field mappings
  - Testar validação de campos
  - Testar atualização de valores
  - _Requirements: 5.4, 5.5_

- [x] 11. Frontend - Adicionar estados de loading e feedback visual
  - Implementar spinner durante busca de conexões
  - Implementar spinner durante busca de registro
  - Adicionar indicador de loading no item clicado da sidebar
  - Implementar toast notifications para sucesso/erro
  - Adicionar skeleton loading para formulário
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 12. Frontend - Implementar acessibilidade
  - Garantir navegação por teclado (Tab, Enter, Setas)
  - Adicionar aria-labels apropriados
  - Testar com leitor de tela
  - Garantir contraste de cores adequado
  - _Requirements: 10.1, 10.2_

- [x] 13. Frontend - Implementar responsividade mobile
  - Testar sidebar em dispositivos móveis
  - Garantir que nomes de conexões não quebrem layout
  - Implementar scroll na sidebar quando necessário
  - Testar formulário de edição em telas pequenas
  - _Requirements: 10.3, 10.4, 10.5_

- [x] 14. Integração - Testar fluxo completo end-to-end
  - Testar login → sidebar → edição → salvamento
  - Testar com múltiplas conexões
  - Testar com diferentes tipos de banco (NocoDB, SQLite)
  - Testar cenários de erro
  - Verificar que cache funciona corretamente
  - _Requirements: Todos_

- [x] 14.1 Escrever testes de integração
  - Testar fluxo completo de navegação
  - Testar com múltiplos usuários
  - Testar sincronização com mudanças do Admin
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 15. Documentação - Atualizar documentação do usuário
  - Criar guia de como acessar conexões pela sidebar
  - Documentar como editar registros
  - Adicionar troubleshooting para problemas comuns
  - _Requirements: Todos_

- [x] 16. Documentação - Atualizar documentação técnica
  - Documentar novos endpoints da API
  - Documentar arquitetura de componentes
  - Documentar estratégia de caching
  - Adicionar exemplos de uso
  - _Requirements: Todos_

- [ ] 17. Deploy - Preparar para produção
  - Atualizar variáveis de ambiente necessárias
  - Verificar configurações de rate limiting
  - Testar build de produção
  - Preparar plano de rollback
  - _Requirements: Todos_

- [ ] 18. Deploy - Monitoramento pós-deploy
  - Configurar alertas para erros
  - Monitorar métricas de performance
  - Coletar feedback dos usuários
  - Ajustar configurações conforme necessário
  - _Requirements: Todos_
![alt text](image.png)