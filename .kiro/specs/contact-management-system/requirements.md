# Requirements Document

## Introduction

Sistema de gerenciamento de contatos para o WUZAPI Manager que permite aos usuários visualizar, filtrar, organizar e selecionar contatos da agenda WUZAPI para envio de mensagens em massa. O sistema deve seguir o padrão de UX inline do projeto, sem uso de modais.

## Glossary

- **Sistema**: WUZAPI Manager - Sistema de gerenciamento de mensagens WhatsApp
- **Usuário**: Pessoa autenticada que utiliza o sistema para gerenciar contatos e enviar mensagens
- **Contato**: Registro de telefone e informações associadas importadas da agenda WUZAPI
- **Agenda WUZAPI**: Lista de contatos salvos na instância WhatsApp do usuário
- **Filtro**: Mecanismo de busca e seleção de contatos baseado em critérios específicos
- **Seleção**: Conjunto de contatos marcados para receber mensagens
- **Tag**: Etiqueta customizada atribuída a contatos para organização
- **Grupo**: Coleção nomeada de contatos para reutilização

## Requirements

### Requirement 1

**User Story:** Como usuário, quero acessar uma página dedicada de gerenciamento de contatos no menu lateral, para que eu possa visualizar e organizar meus contatos de forma centralizada

#### Acceptance Criteria

1. WHEN o usuário está autenticado, THE Sistema SHALL exibir a opção "Contatos" no menu lateral de navegação
2. WHEN o usuário clica em "Contatos", THE Sistema SHALL navegar para a página de gerenciamento de contatos sem recarregar a aplicação
3. THE Sistema SHALL exibir o ícone de usuários múltiplos ao lado do texto "Contatos" no menu
4. WHEN a página de contatos está ativa, THE Sistema SHALL destacar visualmente a opção no menu lateral

### Requirement 2

**User Story:** Como usuário, quero importar contatos da agenda WUZAPI diretamente na página de contatos, para que eu possa ter acesso rápido à minha lista completa

#### Acceptance Criteria

1. THE Sistema SHALL exibir um botão "Importar da Agenda WUZAPI" na página de contatos
2. WHEN o usuário clica em "Importar da Agenda WUZAPI", THE Sistema SHALL buscar todos os contatos da instância ativa
3. WHEN a importação está em progresso, THE Sistema SHALL exibir um indicador de carregamento inline
4. WHEN a importação é concluída, THE Sistema SHALL exibir o total de contatos importados em uma notificação toast
5. THE Sistema SHALL armazenar os contatos importados localmente para acesso rápido

### Requirement 3

**User Story:** Como usuário, quero visualizar meus contatos em uma tabela paginada, para que eu possa navegar facilmente por grandes listas

#### Acceptance Criteria

1. THE Sistema SHALL exibir os contatos em uma tabela com colunas: checkbox, telefone, nome, tags e ações
2. THE Sistema SHALL paginar a lista exibindo 50 contatos por página
3. THE Sistema SHALL exibir controles de navegação (anterior, próxima, ir para página) abaixo da tabela
4. THE Sistema SHALL exibir o total de contatos e a página atual acima da tabela
5. WHEN não há contatos, THE Sistema SHALL exibir uma mensagem informativa com botão para importar

### Requirement 4

**User Story:** Como usuário, quero buscar contatos por nome ou telefone, para que eu possa encontrar rapidamente contatos específicos

#### Acceptance Criteria

1. THE Sistema SHALL exibir um campo de busca acima da tabela de contatos
2. WHEN o usuário digita no campo de busca, THE Sistema SHALL filtrar os contatos em tempo real
3. THE Sistema SHALL buscar tanto no campo de nome quanto no campo de telefone
4. THE Sistema SHALL ignorar diferenças de maiúsculas/minúsculas na busca
5. WHEN a busca não retorna resultados, THE Sistema SHALL exibir mensagem "Nenhum contato encontrado"

### Requirement 5

**User Story:** Como usuário, quero filtrar contatos por múltiplos critérios simultaneamente, para que eu possa criar seleções precisas

#### Acceptance Criteria

1. THE Sistema SHALL exibir uma seção de filtros avançados inline acima da tabela
2. THE Sistema SHALL permitir filtrar por: nome contém texto, telefone contém texto, possui nome, possui tags específicas
3. WHEN múltiplos filtros são aplicados, THE Sistema SHALL combinar os critérios usando operador AND
4. THE Sistema SHALL exibir o número de contatos que atendem aos filtros ativos
5. THE Sistema SHALL permitir limpar todos os filtros com um único botão

### Requirement 6

**User Story:** Como usuário, quero selecionar contatos individualmente ou em massa, para que eu possa escolher destinatários de mensagens

#### Acceptance Criteria

1. THE Sistema SHALL exibir um checkbox ao lado de cada contato na tabela
2. THE Sistema SHALL exibir um checkbox no cabeçalho da tabela para seleção em massa
3. WHEN o usuário marca o checkbox do cabeçalho, THE Sistema SHALL selecionar todos os contatos visíveis na página atual
4. THE Sistema SHALL exibir o total de contatos selecionados em um badge fixo na tela
5. THE Sistema SHALL permitir desmarcar todos os contatos selecionados com um botão

### Requirement 7

**User Story:** Como usuário, quero selecionar todos os contatos que atendem aos filtros ativos, para que eu possa trabalhar com grandes conjuntos filtrados

#### Acceptance Criteria

1. WHEN há filtros ativos, THE Sistema SHALL exibir um botão "Selecionar todos os X contatos filtrados"
2. WHEN o usuário clica neste botão, THE Sistema SHALL selecionar todos os contatos que atendem aos filtros, não apenas os da página atual
3. THE Sistema SHALL exibir uma notificação confirmando quantos contatos foram selecionados
4. THE Sistema SHALL manter a seleção ao navegar entre páginas
5. THE Sistema SHALL atualizar o contador de selecionados em tempo real

### Requirement 8

**User Story:** Como usuário, quero atribuir tags customizadas aos contatos, para que eu possa organizá-los por categorias

#### Acceptance Criteria

1. THE Sistema SHALL permitir adicionar tags a um ou múltiplos contatos selecionados
2. THE Sistema SHALL exibir as tags de cada contato como badges coloridos na tabela
3. THE Sistema SHALL permitir criar novas tags digitando um nome e escolhendo uma cor
4. THE Sistema SHALL armazenar as tags localmente associadas aos contatos
5. THE Sistema SHALL permitir remover tags de contatos individualmente ou em massa

### Requirement 9

**User Story:** Como usuário, quero salvar grupos de contatos selecionados, para que eu possa reutilizá-los em campanhas futuras

#### Acceptance Criteria

1. WHEN há contatos selecionados, THE Sistema SHALL exibir um botão "Salvar como Grupo"
2. WHEN o usuário clica em "Salvar como Grupo", THE Sistema SHALL exibir um formulário inline para nomear o grupo
3. THE Sistema SHALL salvar o grupo com os IDs dos contatos selecionados
4. THE Sistema SHALL exibir uma lista de grupos salvos em uma seção lateral
5. WHEN o usuário clica em um grupo salvo, THE Sistema SHALL selecionar automaticamente todos os contatos daquele grupo

### Requirement 10

**User Story:** Como usuário, quero exportar contatos selecionados para CSV, para que eu possa usar os dados em outras ferramentas

#### Acceptance Criteria

1. WHEN há contatos selecionados, THE Sistema SHALL exibir um botão "Exportar Selecionados"
2. WHEN o usuário clica em "Exportar Selecionados", THE Sistema SHALL gerar um arquivo CSV
3. THE Sistema SHALL incluir no CSV as colunas: telefone, nome, tags
4. THE Sistema SHALL iniciar o download do arquivo automaticamente
5. THE Sistema SHALL nomear o arquivo com formato "contatos-YYYY-MM-DD.csv"

### Requirement 11

**User Story:** Como usuário, quero usar contatos selecionados diretamente no disparador de mensagens, para que eu possa iniciar campanhas rapidamente

#### Acceptance Criteria

1. WHEN há contatos selecionados na página de contatos, THE Sistema SHALL exibir um botão "Enviar Mensagem"
2. WHEN o usuário clica em "Enviar Mensagem", THE Sistema SHALL navegar para a página de disparador
3. THE Sistema SHALL pré-preencher o disparador com os contatos selecionados
4. THE Sistema SHALL manter a seleção de contatos ao navegar entre páginas
5. THE Sistema SHALL exibir uma notificação confirmando quantos contatos foram adicionados ao disparador

### Requirement 12

**User Story:** Como usuário, quero que o sistema de filtros no disparador seja mais inteligente, para que eu possa selecionar contatos de forma eficiente durante a criação de campanhas

#### Acceptance Criteria

1. THE Sistema SHALL exibir filtros inline no componente de importação de contatos do disparador
2. THE Sistema SHALL permitir aplicar filtros antes de adicionar contatos à campanha
3. THE Sistema SHALL exibir preview dos contatos filtrados antes da confirmação
4. THE Sistema SHALL permitir ajustar filtros e ver resultados em tempo real
5. THE Sistema SHALL manter os filtros aplicados ao adicionar mais contatos à mesma campanha

### Requirement 13

**User Story:** Como usuário, quero ver estatísticas sobre meus contatos, para que eu possa entender melhor minha base

#### Acceptance Criteria

1. THE Sistema SHALL exibir cards de estatísticas no topo da página de contatos
2. THE Sistema SHALL mostrar: total de contatos, contatos com nome, contatos sem nome, total de tags
3. THE Sistema SHALL atualizar as estatísticas em tempo real ao aplicar filtros
4. THE Sistema SHALL exibir um gráfico de distribuição de contatos por tags
5. THE Sistema SHALL permitir clicar nas estatísticas para aplicar filtros relacionados

### Requirement 14

**User Story:** Como usuário, quero que o sistema persista minhas preferências de visualização, para que eu tenha uma experiência consistente

#### Acceptance Criteria

1. THE Sistema SHALL salvar no localStorage: filtros ativos, página atual, contatos por página
2. WHEN o usuário retorna à página de contatos, THE Sistema SHALL restaurar as preferências salvas
3. THE Sistema SHALL salvar grupos e tags no localStorage
4. THE Sistema SHALL sincronizar seleções entre a página de contatos e o disparador
5. THE Sistema SHALL limpar dados antigos automaticamente após 7 dias

### Requirement 15

**User Story:** Como usuário, quero que a interface seja responsiva e performática, para que eu possa gerenciar milhares de contatos sem travamentos

#### Acceptance Criteria

1. THE Sistema SHALL virtualizar a tabela para renderizar apenas contatos visíveis
2. THE Sistema SHALL debounce a busca em tempo real com delay de 300ms
3. THE Sistema SHALL processar filtros em background usando Web Workers quando disponível
4. THE Sistema SHALL exibir skeleton loaders durante carregamentos
5. THE Sistema SHALL manter a interface responsiva mesmo com 10.000+ contatos carregados
