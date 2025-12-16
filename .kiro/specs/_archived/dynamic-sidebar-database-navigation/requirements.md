# Requirements Document

## Introduction

Esta especificação define a refatoração da experiência do usuário (UX) para acesso aos bancos de dados pessoais. O objetivo é eliminar o fluxo atual de múltiplos cliques (Meu Banco → Seleção de Card → Visualização de Tabela → Edição) e substituí-lo por navegação direta através de itens dinâmicos na sidebar que levam imediatamente ao formulário de edição do registro do usuário.

## Glossary

- **System**: O sistema WUZAPI Manager
- **User**: Usuário final autenticado no sistema (ex: "Helton")
- **Admin**: Administrador que configura as conexões de banco de dados
- **Sidebar**: Barra lateral de navegação principal da aplicação
- **Database Connection**: Conexão configurada pelo Admin para um banco de dados externo (NocoDB, SQLite, etc.)
- **User Link Field**: Campo configurado pelo Admin que vincula registros ao usuário (ex: apiToken)
- **Direct-to-Edit**: Navegação direta do clique na sidebar para o formulário de edição
- **Dynamic Menu Item**: Item de menu gerado dinamicamente baseado nas conexões atribuídas ao usuário

## Requirements

### Requirement 1: Remoção do Menu Estático "Meu Banco"

**User Story:** Como usuário, eu quero que o item estático "Meu Banco" seja removido da sidebar, para que eu tenha acesso direto às minhas conexões de banco de dados.

#### Acceptance Criteria

1. WHEN THE User visualiza a sidebar, THE System SHALL NOT exibir o item de menu "Meu Banco"
2. WHEN THE User está autenticado, THE System SHALL remover todas as rotas relacionadas à página intermediária de seleção de bancos
3. WHEN THE Admin configura novas conexões, THE System SHALL garantir que nenhum link para "/meu-banco" seja gerado
4. WHEN THE User navega pela aplicação, THE System SHALL redirecionar automaticamente qualquer tentativa de acesso a "/meu-banco" para o dashboard principal

### Requirement 2: Carregamento Dinâmico de Itens de Menu

**User Story:** Como usuário, eu quero ver na sidebar apenas as conexões de banco de dados que foram atribuídas a mim pelo Admin, para que eu possa acessá-las diretamente.

#### Acceptance Criteria

1. WHEN THE User completa o login, THE System SHALL buscar todas as conexões de banco de dados atribuídas ao token daquele usuário
2. WHEN THE System recebe a lista de conexões atribuídas, THE System SHALL gerar dinamicamente um item de menu na sidebar para cada conexão
3. WHEN THE User não possui conexões atribuídas, THE System SHALL exibir uma mensagem informativa na sidebar indicando que nenhuma conexão está disponível
4. WHEN THE Admin atribui uma nova conexão ao usuário, THE System SHALL atualizar a sidebar automaticamente após o próximo login ou refresh
5. WHEN THE System gera os itens de menu dinâmicos, THE System SHALL posicionar esses itens entre "Mensagens" e "Configurações" na sidebar

### Requirement 3: Renderização Visual dos Itens Dinâmicos

**User Story:** Como usuário, eu quero que cada conexão de banco apareça na sidebar com um ícone apropriado e o nome configurado pelo Admin, para que eu possa identificá-las facilmente.

#### Acceptance Criteria

1. WHEN THE System renderiza um item de menu dinâmico, THE System SHALL exibir o ícone de banco de dados (Database icon) antes do nome da conexão
2. WHEN THE System renderiza um item de menu dinâmico, THE System SHALL exibir o nome da conexão exatamente como configurado pelo Admin (ex: "Teste Final", "MasterMegga")
3. WHEN THE User passa o mouse sobre um item de menu dinâmico, THE System SHALL aplicar o mesmo efeito hover dos outros itens da sidebar
4. WHEN THE User seleciona um item de menu dinâmico, THE System SHALL aplicar o estilo de "item ativo" (background azul) igual aos outros itens da sidebar
5. WHEN THE System possui múltiplas conexões para exibir, THE System SHALL ordená-las alfabeticamente por nome

### Requirement 4: Navegação Direct-to-Edit

**User Story:** Como usuário, eu quero que ao clicar em uma conexão na sidebar, o sistema me leve diretamente para o formulário de edição do meu registro, sem passar por páginas intermediárias.

#### Acceptance Criteria

1. WHEN THE User clica em um item de menu dinâmico na sidebar, THE System SHALL identificar o token do usuário autenticado
2. WHEN THE System identifica o token do usuário, THE System SHALL buscar o campo de vínculo (User Link Field) configurado pelo Admin para aquela conexão
3. WHEN THE System possui o campo de vínculo, THE System SHALL fazer uma requisição GET à API do banco de dados filtrando pelo valor do token do usuário no campo de vínculo
4. WHEN THE System recebe o registro único do usuário, THE System SHALL navegar diretamente para a rota de edição (ex: "/database/:connectionId/edit/:recordId")
5. WHEN THE System não encontra nenhum registro para o usuário, THE System SHALL exibir uma mensagem de erro informando que nenhum registro foi encontrado e oferecer a opção de criar um novo registro

### Requirement 5: Pré-carregamento do Formulário de Edição

**User Story:** Como usuário, eu quero que o formulário de edição já apareça preenchido com meus dados quando eu clicar em uma conexão na sidebar, para que eu possa editá-los imediatamente.

#### Acceptance Criteria

1. WHEN THE System navega para a página de edição, THE System SHALL pré-carregar todos os campos do formulário com os valores do registro do usuário
2. WHEN THE System renderiza o formulário, THE System SHALL exibir o nome da conexão no cabeçalho (ex: "Editar Registro - Teste Final")
3. WHEN THE System renderiza o formulário, THE System SHALL exibir informações de contexto (Tipo do Banco, Tabela, Campo de Vínculo) no topo da página
4. WHEN THE System renderiza campos editáveis, THE System SHALL aplicar as configurações de Field Mappings definidas pelo Admin (visibilidade, editabilidade, labels customizados)
5. WHEN THE System renderiza campos somente leitura, THE System SHALL desabilitar a edição e aplicar estilo visual diferenciado (ex: fundo cinza, texto em itálico)

### Requirement 6: Tratamento de Erros e Estados de Loading

**User Story:** Como usuário, eu quero feedback visual claro durante o carregamento dos dados e em caso de erros, para que eu entenda o que está acontecendo.

#### Acceptance Criteria

1. WHEN THE User clica em um item de menu dinâmico, THE System SHALL exibir um indicador de loading (spinner) enquanto busca o registro
2. WHEN THE System está buscando o registro, THE System SHALL desabilitar temporariamente o item de menu clicado para evitar cliques duplicados
3. IF THE System falha ao buscar o registro devido a erro de rede, THEN THE System SHALL exibir uma notificação toast de erro com mensagem descritiva e opção de tentar novamente
4. IF THE System falha ao buscar o registro devido a erro de autenticação, THEN THE System SHALL redirecionar o usuário para a página de login
5. WHEN THE System completa o carregamento com sucesso, THE System SHALL remover o indicador de loading e renderizar o formulário

### Requirement 7: Sincronização com Configurações do Admin

**User Story:** Como usuário, eu quero que as mudanças feitas pelo Admin nas configurações das conexões sejam refletidas automaticamente na minha sidebar, para que eu sempre veja informações atualizadas.

#### Acceptance Criteria

1. WHEN THE Admin remove uma conexão atribuída ao usuário, THE System SHALL remover o item de menu correspondente da sidebar após o próximo login ou refresh
2. WHEN THE Admin renomeia uma conexão, THE System SHALL atualizar o nome exibido na sidebar após o próximo login ou refresh
3. WHEN THE Admin altera o campo de vínculo de uma conexão, THE System SHALL utilizar o novo campo na próxima busca de registro do usuário
4. WHEN THE Admin altera as Field Mappings de uma conexão, THE System SHALL aplicar as novas configurações no formulário de edição
5. WHEN THE User está com a aplicação aberta e o Admin faz alterações, THE System SHALL exibir uma notificação sugerindo refresh da página para ver as atualizações

### Requirement 8: Compatibilidade com Múltiplos Tipos de Banco

**User Story:** Como usuário, eu quero que a navegação direct-to-edit funcione independentemente do tipo de banco de dados configurado (NocoDB, SQLite, PostgreSQL, etc.).

#### Acceptance Criteria

1. WHEN THE System busca o registro do usuário em uma conexão NocoDB, THE System SHALL utilizar a API REST do NocoDB com o formato correto de filtro
2. WHEN THE System busca o registro do usuário em uma conexão SQLite, THE System SHALL utilizar a API do backend que abstrai o acesso ao SQLite
3. WHEN THE System busca o registro do usuário em uma conexão PostgreSQL ou MySQL, THE System SHALL utilizar a API do backend que abstrai o acesso ao banco relacional
4. WHEN THE System renderiza o formulário de edição, THE System SHALL adaptar os tipos de campos de acordo com o schema do banco de dados
5. WHEN THE System salva alterações no registro, THE System SHALL utilizar o método apropriado para o tipo de banco (PUT para NocoDB, UPDATE SQL para bancos relacionais)

### Requirement 9: Performance e Caching

**User Story:** Como usuário, eu quero que a navegação entre diferentes conexões seja rápida e responsiva, para que eu possa trabalhar eficientemente.

#### Acceptance Criteria

1. WHEN THE User faz login, THE System SHALL fazer cache da lista de conexões atribuídas por até 5 minutos
2. WHEN THE User clica em uma conexão pela primeira vez, THE System SHALL fazer cache do registro do usuário por até 2 minutos
3. WHEN THE User navega de volta para uma conexão já visitada, THE System SHALL utilizar o cache se ainda válido, evitando requisições desnecessárias
4. WHEN THE User salva alterações em um registro, THE System SHALL invalidar o cache daquele registro específico
5. WHEN THE System detecta que o cache expirou, THE System SHALL buscar os dados atualizados do backend de forma transparente

### Requirement 10: Acessibilidade e Responsividade

**User Story:** Como usuário, eu quero que os novos itens de menu dinâmicos sejam acessíveis e funcionem bem em dispositivos móveis, para que eu possa usar a aplicação em qualquer dispositivo.

#### Acceptance Criteria

1. WHEN THE System renderiza itens de menu dinâmicos, THE System SHALL garantir que sejam navegáveis via teclado (Tab, Enter, Setas)
2. WHEN THE User utiliza um leitor de tela, THE System SHALL anunciar corretamente o nome e tipo de cada conexão
3. WHEN THE User acessa a aplicação em um dispositivo móvel, THE System SHALL exibir os itens de menu dinâmicos na sidebar mobile com o mesmo comportamento
4. WHEN THE User acessa a aplicação em tela pequena, THE System SHALL garantir que os nomes das conexões não quebrem o layout da sidebar
5. WHEN THE System possui muitas conexões para exibir, THE System SHALL tornar a sidebar scrollável mantendo o header e footer fixos
