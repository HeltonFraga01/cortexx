# Requirements Document

## Introduction

Este documento especifica os requisitos para a modularização do sistema de envio de mensagens do WUZAPI Manager. O sistema atual concentra todas as funcionalidades em uma única página (`DisparadorWrapper`), o que dificulta a navegação, manutenção e escalabilidade. A refatoração visa separar as funcionalidades em páginas e módulos conectados, melhorando a experiência do usuário e a arquitetura do código.

## Glossary

- **Sistema de Envio**: Conjunto de funcionalidades para envio de mensagens via WhatsApp (individual, em massa, agendado)
- **Template**: Modelo de mensagem reutilizável com variáveis de substituição
- **Campanha**: Conjunto de mensagens a serem enviadas para múltiplos contatos
- **Caixa de Saída**: Área para visualização e gerenciamento de campanhas (programadas, em execução, finalizadas)
- **Relatório**: Documento com métricas e estatísticas de campanhas
- **Grupo de Contatos**: Conjunto de contatos agrupados para envio em massa
- **Tag**: Etiqueta para categorização de contatos
- **Tipo de Envio**: Modalidade de envio (manual, grupo, tag, CSV, banco de dados)

## Requirements

### Requirement 1: Página de Templates de Mensagem

**User Story:** Como usuário, quero gerenciar meus templates de mensagem em uma página dedicada, para que eu possa criar, editar e reutilizar modelos de forma organizada.

#### Acceptance Criteria

1. WHEN o usuário acessa a página de templates, THE Sistema SHALL exibir lista paginada de templates existentes com nome, prévia e data de criação
2. WHEN o usuário cria um novo template, THE Sistema SHALL validar campos obrigatórios e salvar no banco de dados
3. WHEN o usuário edita um template, THE Sistema SHALL carregar dados existentes e permitir modificação
4. WHEN o usuário exclui um template, THE Sistema SHALL solicitar confirmação e remover do banco de dados
5. WHEN o usuário seleciona um template na página de envio, THE Sistema SHALL preencher automaticamente o campo de mensagem

### Requirement 2: Página de Caixa de Saída (Campanhas)

**User Story:** Como usuário, quero visualizar e gerenciar minhas campanhas em uma página dedicada, para que eu possa acompanhar o status de envios programados, em execução e finalizados.

#### Acceptance Criteria

1. WHEN o usuário acessa a caixa de saída, THE Sistema SHALL exibir campanhas organizadas em abas (Programadas, Em Execução, Finalizadas)
2. WHEN uma campanha está programada, THE Sistema SHALL exibir data/hora de início e permitir edição ou cancelamento
3. WHEN uma campanha está em execução, THE Sistema SHALL exibir progresso em tempo real com contadores de enviados/pendentes/erros
4. WHEN uma campanha está finalizada, THE Sistema SHALL exibir resumo com total enviado, taxa de sucesso e link para relatório
5. WHEN o usuário pausa uma campanha em execução, THE Sistema SHALL interromper envios e permitir retomada posterior
6. WHEN o usuário cancela uma campanha, THE Sistema SHALL interromper envios e marcar como cancelada

### Requirement 3: Página de Relatórios

**User Story:** Como usuário, quero acessar relatórios detalhados das minhas campanhas em uma página dedicada, para que eu possa analisar métricas e exportar dados.

#### Acceptance Criteria

1. WHEN o usuário acessa a página de relatórios, THE Sistema SHALL exibir lista de campanhas com métricas resumidas
2. WHEN o usuário seleciona uma campanha, THE Sistema SHALL exibir relatório detalhado com gráficos e tabelas
3. WHEN o usuário aplica filtros, THE Sistema SHALL filtrar relatórios por período, status e tipo de campanha
4. WHEN o usuário exporta um relatório, THE Sistema SHALL gerar arquivo CSV ou PDF com dados da campanha
5. WHEN o usuário visualiza métricas, THE Sistema SHALL exibir taxa de entrega, erros por tipo e tempo médio de envio

### Requirement 4: Página de Envio de Mensagens Simplificada

**User Story:** Como usuário, quero uma página de envio com fluxo inteligente, para que eu possa escolher o tipo de envio e ver apenas as opções relevantes.

#### Acceptance Criteria

1. WHEN o usuário acessa a página de envio, THE Sistema SHALL exibir seletor de tipo de envio (Manual, Grupo, Tag, CSV, Banco de Dados)
2. WHEN o usuário seleciona tipo "Manual", THE Sistema SHALL exibir campo para inserir números de telefone manualmente
3. WHEN o usuário seleciona tipo "Grupo", THE Sistema SHALL exibir lista de grupos criados em Contatos para seleção
4. WHEN o usuário seleciona tipo "Tag", THE Sistema SHALL exibir lista de tags existentes para seleção
5. WHEN o usuário seleciona tipo "CSV", THE Sistema SHALL exibir área de upload de arquivo CSV
6. WHEN o usuário seleciona tipo "Banco de Dados", THE Sistema SHALL exibir seletor de tabela e mapeamento de campos
7. WHEN o usuário seleciona destinatários, THE Sistema SHALL exibir contador de contatos selecionados
8. WHEN o usuário configura a mensagem, THE Sistema SHALL permitir seleção de template ou digitação livre

### Requirement 5: Navegação Integrada entre Módulos

**User Story:** Como usuário, quero navegar facilmente entre os módulos do sistema de envio, para que eu possa acessar funcionalidades relacionadas sem perder contexto.

#### Acceptance Criteria

1. WHEN o usuário está na página de envio, THE Sistema SHALL exibir links rápidos para Templates, Caixa de Saída e Relatórios
2. WHEN o usuário cria uma campanha, THE Sistema SHALL redirecionar para Caixa de Saída com a nova campanha destacada
3. WHEN o usuário clica em "Ver Relatório" na Caixa de Saída, THE Sistema SHALL navegar para página de Relatórios com campanha selecionada
4. WHEN o usuário está em Contatos e seleciona contatos para envio, THE Sistema SHALL navegar para página de Envio com contatos pré-selecionados
5. WHEN o usuário está em qualquer módulo, THE Sistema SHALL manter breadcrumb de navegação visível

### Requirement 6: Integração com Sistema de Contatos Existente

**User Story:** Como usuário, quero que o sistema de envio utilize os grupos e tags já criados em Contatos, para que eu não precise duplicar informações.

#### Acceptance Criteria

1. WHEN o usuário seleciona tipo "Grupo" no envio, THE Sistema SHALL listar grupos criados na página de Contatos
2. WHEN o usuário seleciona tipo "Tag" no envio, THE Sistema SHALL listar tags existentes na página de Contatos
3. WHEN um grupo ou tag é atualizado em Contatos, THE Sistema SHALL refletir mudanças automaticamente no seletor de envio
4. WHEN o usuário cria novo grupo/tag durante envio, THE Sistema SHALL salvar no mesmo local usado por Contatos

### Requirement 7: Persistência de Estado entre Navegações

**User Story:** Como usuário, quero que meu progresso seja mantido ao navegar entre páginas, para que eu não perca dados ao alternar entre módulos.

#### Acceptance Criteria

1. WHEN o usuário navega para outra página durante criação de campanha, THE Sistema SHALL salvar rascunho automaticamente
2. WHEN o usuário retorna à página de envio, THE Sistema SHALL restaurar rascunho se existir
3. WHEN o usuário descarta rascunho explicitamente, THE Sistema SHALL limpar dados salvos
4. THE Sistema SHALL manter filtros e ordenação aplicados ao retornar para listas

### Requirement 8: Configuração Avançada de Campanha

**User Story:** Como usuário, quero configurar campanhas com recursos avançados de humanização e agendamento, para que eu possa enviar mensagens de forma mais natural e controlada.

#### Acceptance Criteria

1. WHEN o usuário configura uma campanha, THE Sistema SHALL exibir campo para nome da campanha
2. WHEN o usuário configura mensagens, THE Sistema SHALL permitir criar sequência de múltiplas mensagens com editor dedicado
3. WHEN o usuário configura mensagens, THE Sistema SHALL exibir variáveis disponíveis (nome, telefone, data, empresa, saudação) para inserção
4. WHEN o usuário importa contatos com variáveis customizadas, THE Sistema SHALL exibir essas variáveis para inserção nas mensagens
5. WHEN o usuário configura humanização, THE Sistema SHALL permitir definir delay mínimo e máximo entre mensagens (5-300 segundos)
6. WHEN o usuário ativa randomização, THE Sistema SHALL embaralhar a ordem dos contatos antes do envio
7. WHEN o usuário agenda uma campanha, THE Sistema SHALL permitir selecionar data e hora de início
8. WHEN o usuário define janela de envio, THE Sistema SHALL permitir configurar horário comercial (início, fim) e dias da semana
9. WHEN o usuário seleciona instância, THE Sistema SHALL exibir seletor de instância WhatsApp conectada
10. WHEN o usuário visualiza resumo, THE Sistema SHALL exibir tempo estimado de envio baseado nos delays e quantidade de contatos

### Requirement 9: Integração Real com API de Contatos

**User Story:** Como usuário, quero que o sistema de envio busque grupos e tags reais da API, para que eu possa selecionar destinatários de forma precisa.

#### Acceptance Criteria

1. WHEN o usuário seleciona tipo "Grupo", THE Sistema SHALL buscar grupos da API /api/user/contact-groups
2. WHEN o usuário seleciona tipo "Tag", THE Sistema SHALL buscar tags da API /api/user/contact-tags
3. WHEN o usuário seleciona um grupo, THE Sistema SHALL buscar contatos reais desse grupo via API
4. WHEN o usuário seleciona uma tag, THE Sistema SHALL buscar contatos reais com essa tag via API
5. WHEN a API retorna erro, THE Sistema SHALL exibir mensagem de erro e permitir retry

