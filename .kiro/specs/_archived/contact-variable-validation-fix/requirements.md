# Requirements Document - Correção de Validação de Variáveis de Contatos

## Introduction

Este documento define os requisitos para corrigir o problema de validação de variáveis em contatos importados. Atualmente, o sistema está reportando incorretamente que contatos não possuem variáveis necessárias, mesmo quando elas estão presentes.

## Glossary

- **Sistema**: O WUZAPI Manager
- **Variável**: Placeholder no formato `{{nome_variavel}}` usado em templates de mensagem
- **Contato**: Registro com telefone, nome e variáveis customizadas
- **Validação de Variáveis**: Processo que verifica se todos os contatos possuem as variáveis necessárias para o template

## Requirements

### Requirement 1: Corrigir Validação de Variáveis no Frontend

**User Story:** Como usuário, eu quero que o sistema valide corretamente se meus contatos possuem as variáveis necessárias, para que eu possa enviar campanhas sem erros falsos

#### Acceptance Criteria

1. WHEN o Sistema detecta variáveis no template de mensagem, THE Sistema SHALL verificar se cada contato possui essas variáveis em seu objeto `variables`
2. WHEN um contato possui todas as variáveis necessárias, THE Sistema SHALL considerar o contato como válido
3. WHEN um contato não possui uma ou mais variáveis necessárias, THE Sistema SHALL adicionar o contato à lista de `missingVariables`
4. WHEN todos os contatos possuem as variáveis necessárias, THE Sistema SHALL permitir o envio da campanha
5. WHERE um contato não possui o objeto `variables` ou ele está vazio, THE Sistema SHALL considerar todas as variáveis como ausentes

### Requirement 2: Melhorar Feedback de Validação

**User Story:** Como usuário, eu quero ver claramente quais contatos não possuem quais variáveis, para que eu possa corrigir os dados antes de enviar

#### Acceptance Criteria

1. WHEN a validação falha, THE Sistema SHALL exibir uma mensagem detalhada indicando quantos contatos falharam
2. WHEN a validação falha, THE Sistema SHALL listar quais variáveis estão faltando
3. WHERE possível, THE Sistema SHALL mostrar quais contatos específicos não possuem as variáveis
4. THE Sistema SHALL exibir um alerta visual antes de tentar criar a campanha
5. THE Sistema SHALL desabilitar o botão de envio quando a validação falhar

### Requirement 3: Garantir Consistência entre Backend e Frontend

**User Story:** Como desenvolvedor, eu quero que a validação de variáveis seja consistente entre backend e frontend, para evitar erros de sincronização

#### Acceptance Criteria

1. THE Sistema SHALL usar a mesma lógica de validação no frontend e backend
2. WHEN o backend valida contatos, THE Sistema SHALL retornar o objeto `variables` corretamente populado
3. WHEN o frontend importa contatos, THE Sistema SHALL preservar o objeto `variables` de cada contato
4. THE Sistema SHALL garantir que variáveis customizadas do CSV sejam mapeadas corretamente
5. THE Sistema SHALL normalizar nomes de variáveis (lowercase, sem espaços) para evitar incompatibilidades

## Análise do Problema Atual

### Causa Raiz Identificada

Analisando o código, identifiquei o seguinte fluxo:

1. **Importação de Contatos WUZAPI** (`server/routes/contactImportRoutes.js` linha 195):
   ```javascript
   variables: {},  // ❌ PROBLEMA: Sempre retorna objeto vazio
   ```

2. **Validação no Frontend** (`src/services/contactImportService.ts` linha 266):
   ```typescript
   const missing = requiredVariables.filter(
     varName => !contact.variables || !contact.variables[varName]
   );
   ```
   Esta validação está correta, mas os contatos vêm com `variables: {}` vazio.

3. **Parse de CSV** (`server/routes/contactImportRoutes.js` linha 95):
   ```javascript
   const variables = {};
   customVariables.forEach(varName => {
     const varIndex = headers.indexOf(varName);
     if (varIndex !== -1 && values[varIndex]) {
       variables[varName] = values[varIndex];
     }
   });
   ```
   Esta parte está correta e popula as variáveis do CSV.

### Problema Principal

O problema está na **importação de contatos do WUZAPI** (linha 195 do `contactImportRoutes.js`):
- Contatos importados da agenda WUZAPI sempre têm `variables: {}`
- Não há mapeamento de campos do WUZAPI para variáveis customizadas
- O sistema deveria mapear campos como `FullName`, `PushName`, etc. para variáveis padrão

### Problema Secundário

Na **validação de CSV**, as variáveis customizadas são detectadas corretamente, mas:
- Nomes de colunas podem ter case diferente (ex: "Nome" vs "nome")
- Espaços em nomes de colunas podem causar problemas
- Não há normalização consistente de nomes de variáveis

## Locais de Mudança Necessários

### Backend

1. **server/routes/contactImportRoutes.js** (linha 195):
   - Mapear campos do WUZAPI para variáveis padrão
   - Adicionar `nome`, `telefone`, `data`, `saudacao` ao objeto `variables`

2. **server/routes/contactImportRoutes.js** (linha 95):
   - Normalizar nomes de variáveis customizadas (lowercase, trim)
   - Garantir consistência no mapeamento

### Frontend

3. **src/services/contactImportService.ts** (linha 266):
   - Adicionar logging para debug de validação
   - Melhorar mensagem de erro com detalhes dos contatos

4. **src/components/disparador/CampaignBuilder.tsx** (linha 135):
   - Melhorar feedback visual de validação
   - Mostrar lista de contatos com variáveis faltando

## Critérios de Aceitação Globais

1. Contatos importados do WUZAPI devem ter variáveis padrão populadas
2. Contatos importados de CSV devem ter variáveis customizadas preservadas
3. Validação deve ser consistente entre backend e frontend
4. Mensagens de erro devem ser claras e acionáveis
5. Todos os testes devem continuar passando
