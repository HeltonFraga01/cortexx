# Requirements Document

## Introduction

Este documento especifica os requisitos para o sistema de humanização de mensagens através de variações aleatórias. O sistema permitirá que usuários definam múltiplas variações de texto separadas por barras verticais (|), e o sistema selecionará aleatoriamente uma variação para cada envio, tornando as mensagens mais naturais e menos detectáveis como automação.

## Glossary

- **Message Variation System**: O sistema completo que processa e rotaciona variações de mensagem
- **Variation Delimiter**: O caractere barra vertical (|) usado para separar diferentes variações de texto
- **Variation Block**: Um conjunto de variações separadas por delimitadores dentro de uma mensagem
- **Random Selector**: O componente que escolhe aleatoriamente uma variação de cada bloco
- **Template Processor**: O componente que processa a mensagem completa substituindo blocos por variações selecionadas
- **User**: Usuário autenticado que envia mensagens através do sistema
- **Message Template**: Template de mensagem que pode conter blocos de variação

## Requirements

### Requirement 1

**User Story:** Como usuário, eu quero definir múltiplas variações de texto em uma mensagem usando o delimitador "|", para que cada envio use uma combinação diferente e pareça mais humano

#### Acceptance Criteria

1. WHEN o User insere uma mensagem contendo texto separado por "|", THE Message Variation System SHALL identificar cada bloco de variação
2. WHEN o User envia uma mensagem com variações, THE Random Selector SHALL escolher aleatoriamente uma opção de cada bloco de variação
3. THE Template Processor SHALL substituir cada bloco de variação pela opção selecionada antes do envio
4. THE Message Variation System SHALL suportar múltiplos blocos de variação em uma única mensagem
5. THE Message Variation System SHALL preservar espaços em branco e formatação dentro de cada variação

### Requirement 2

**User Story:** Como usuário, eu quero visualizar um preview da mensagem com as variações aplicadas, para que eu possa verificar como ficará antes de enviar

#### Acceptance Criteria

1. WHEN o User digita uma mensagem com variações, THE Message Variation System SHALL exibir um preview em tempo real
2. THE Message Variation System SHALL destacar visualmente os blocos de variação no editor
3. WHEN o User clica em "Gerar Preview", THE Message Variation System SHALL mostrar uma amostra aleatória da mensagem processada
4. THE Message Variation System SHALL permitir gerar múltiplos previews para ver diferentes combinações
5. THE Message Variation System SHALL exibir o número total de combinações possíveis

### Requirement 3

**User Story:** Como usuário, eu quero usar variações em envios em massa, para que cada contato receba uma versão diferente da mensagem

#### Acceptance Criteria

1. WHEN o User inicia um envio em massa com mensagem contendo variações, THE Message Variation System SHALL processar cada mensagem individualmente
2. THE Random Selector SHALL garantir distribuição aleatória das variações entre os destinatários
3. THE Message Variation System SHALL registrar qual variação foi enviada para cada destinatário
4. THE Message Variation System SHALL funcionar em conjunto com variáveis de personalização (ex: {{nome}})
5. THE Message Variation System SHALL processar variações antes de aplicar variáveis de personalização

### Requirement 4

**User Story:** Como usuário, eu quero salvar templates de mensagem com variações, para que eu possa reutilizá-los em diferentes campanhas

#### Acceptance Criteria

1. THE Message Variation System SHALL permitir salvar mensagens com blocos de variação como templates
2. WHEN o User carrega um template salvo, THE Message Variation System SHALL preservar todos os blocos de variação
3. THE Message Variation System SHALL validar a sintaxe dos blocos de variação ao salvar templates
4. THE Message Variation System SHALL exibir um indicador visual quando um template contém variações
5. THE Message Variation System SHALL permitir editar variações em templates existentes

### Requirement 5

**User Story:** Como usuário, eu quero que o sistema valide minha sintaxe de variações, para que eu seja alertado sobre erros antes de enviar

#### Acceptance Criteria

1. WHEN o User insere uma mensagem, THE Message Variation System SHALL validar a sintaxe dos blocos de variação
2. THE Message Variation System SHALL alertar o User sobre blocos de variação vazios ou mal formatados
3. THE Message Variation System SHALL alertar o User se houver delimitadores "|" sem variações válidas
4. THE Message Variation System SHALL sugerir correções para erros comuns de sintaxe
5. THE Message Variation System SHALL permitir o envio apenas quando todas as variações forem válidas

### Requirement 6

**User Story:** Como desenvolvedor, eu quero que o sistema de variações seja performático, para que não impacte o tempo de envio de mensagens em massa

#### Acceptance Criteria

1. THE Template Processor SHALL processar variações em menos de 10 milissegundos por mensagem
2. THE Random Selector SHALL usar um algoritmo eficiente de seleção aleatória
3. THE Message Variation System SHALL cachear o parsing de templates quando possível
4. THE Message Variation System SHALL processar variações de forma assíncrona em envios em massa
5. THE Message Variation System SHALL suportar pelo menos 1000 mensagens por minuto com variações

### Requirement 7

**User Story:** Como usuário, eu quero ver estatísticas sobre quais variações foram mais usadas, para que eu possa otimizar minhas mensagens

#### Acceptance Criteria

1. THE Message Variation System SHALL registrar qual variação foi selecionada em cada envio
2. THE Message Variation System SHALL exibir relatório de distribuição de variações por campanha
3. THE Message Variation System SHALL calcular a porcentagem de uso de cada variação
4. THE Message Variation System SHALL permitir exportar dados de variações usadas
5. THE Message Variation System SHALL associar variações com métricas de entrega e resposta

## Exemplos de Uso

### Exemplo 1: Saudação Variada
```
Olá, tudo bem? | Olá, como vai? | Como está você? | Oi, tudo certo?
```
Resultado possível: "Olá, como vai?"

### Exemplo 2: Mensagem Completa com Múltiplas Variações
```
Olá {{nome}}, tudo bem? | Oi {{nome}}, como vai? | E aí {{nome}}, beleza?

Eu sou o Helton | Meu nome é Helton | Helton aqui e gostaria de | Queria te apresentar | Tenho uma proposta para você | Posso te mostrar algo interessante?

Podemos conversar? | Você tem um minuto? | Posso te enviar mais detalhes?
```

### Exemplo 3: Variações com Pontuação
```
Obrigado! | Muito obrigado! | Agradeço! | Valeu!
```

## Regras de Sintaxe

1. Delimitador: barra vertical `|`
2. Espaços ao redor do delimitador são removidos automaticamente
3. Variações vazias são ignoradas
4. Mínimo de 2 variações por bloco
5. Máximo recomendado: 10 variações por bloco para manter legibilidade
6. Compatível com variáveis de personalização `{{variavel}}`
