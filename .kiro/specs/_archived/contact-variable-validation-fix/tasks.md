# Implementation Plan - Correção de Validação de Variáveis

## Resumo

Este plano implementa a correção do problema de validação de variáveis em contatos importados. O problema principal é que contatos do WUZAPI não têm variáveis mapeadas, causando falhas de validação incorretas.

## Tasks

- [x] 1. Implementar mapeamento de variáveis no backend
  - Criar função para mapear campos WUZAPI para variáveis padrão
  - Atualizar rota de importação para usar o mapeamento
  - Garantir que todas as variáveis padrão sejam populadas
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3_

- [x] 1.1 Criar função mapWuzapiContactToVariables
  - Implementar em `server/routes/contactImportRoutes.js`
  - Mapear `nome` de FullName, PushName, FirstName ou BusinessName
  - Mapear `telefone` do phone normalizado
  - Mapear `data` da data atual no formato DD/MM/YYYY
  - Gerar `saudacao` baseada na hora atual (Bom dia/Boa tarde/Boa noite)
  - Adicionar `empresa` se BusinessName estiver disponível
  - _Requirements: 1.1, 1.2, 3.2_

- [x] 1.2 Atualizar rota /import/wuzapi
  - Modificar linha 195 de `server/routes/contactImportRoutes.js`
  - Chamar `mapWuzapiContactToVariables` para cada contato
  - Substituir `variables: {}` por `variables: mapWuzapiContactToVariables(...)`
  - Atualizar `name` para usar `variables.nome`
  - Adicionar logging para debug
  - _Requirements: 1.1, 1.2, 1.3, 3.2_

- [x] 1.3 Criar função normalizeVariableName
  - Implementar em `server/routes/contactImportRoutes.js`
  - Converter para lowercase
  - Remover espaços extras (trim)
  - Substituir espaços por underscore
  - Remover caracteres especiais (manter apenas a-z, 0-9, _)
  - _Requirements: 3.5_

- [x] 1.4 Atualizar parse de CSV para normalizar variáveis
  - Modificar linha 68 de `server/routes/contactImportRoutes.js`
  - Aplicar `normalizeVariableName` aos headers
  - Aplicar `normalizeVariableName` aos nomes de variáveis customizadas
  - Fazer trim nos valores das variáveis
  - _Requirements: 3.4, 3.5_

- [ ]* 1.5 Adicionar testes para mapeamento de variáveis
  - Criar `server/tests/routes/contactImportRoutes.test.js`
  - Testar `mapWuzapiContactToVariables` com diferentes inputs
  - Testar geração de saudação em diferentes horários
  - Testar `normalizeVariableName` com diferentes casos
  - Testar parse de CSV com variáveis normalizadas
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 2. Melhorar feedback de validação no frontend
  - Adicionar logging detalhado na validação
  - Melhorar mensagens de erro
  - Adicionar alerta visual no UI
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.1 Adicionar logging em validateContactVariables
  - Modificar `src/services/contactImportService.ts` linha 266
  - Adicionar console.log antes da validação com contexto
  - Adicionar console.log para cada contato com variáveis faltando
  - Adicionar console.log com resultado final da validação
  - Usar prefixo `[ContactImport]` para facilitar filtro
  - _Requirements: 2.3_

- [x] 2.2 Melhorar mensagem de erro em CampaignBuilder
  - Modificar `src/components/disparador/CampaignBuilder.tsx` linha 135
  - Mostrar detalhes dos 3 primeiros contatos com variáveis faltando
  - Incluir quais variáveis estão faltando para cada contato
  - Adicionar contador de contatos adicionais se houver mais de 3
  - Aumentar duração do toast para 10 segundos
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.3 Adicionar alerta visual de validação
  - Adicionar em `src/components/disparador/CampaignBuilder.tsx` antes do botão de criar campanha
  - Mostrar Alert vermelho se houver contatos com variáveis faltando
  - Listar até 5 contatos com suas variáveis faltando
  - Mostrar Alert verde se todos os contatos estiverem válidos
  - Calcular validação em tempo real conforme usuário digita
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 2.4 Adicionar logging em handleCreateCampaign
  - Modificar `src/components/disparador/CampaignBuilder.tsx` linha 110
  - Adicionar console.log antes da validação de variáveis
  - Adicionar console.error se validação falhar
  - Adicionar console.log se validação passar
  - Usar prefixo `[Campaign]` para facilitar filtro
  - _Requirements: 2.3_

- [ ]* 2.5 Adicionar testes para feedback de validação
  - Criar testes em `src/components/disparador/CampaignBuilder.test.tsx`
  - Testar exibição de alerta quando variáveis faltam
  - Testar exibição de alerta quando tudo está válido
  - Testar mensagem de erro detalhada
  - Testar desabilitação do botão quando inválido
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [ ] 3. Validar e testar solução completa
  - Testar importação de contatos WUZAPI
  - Testar importação de CSV
  - Testar validação de variáveis
  - Testar criação de campanha
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3.1 Testar importação WUZAPI com variáveis
  - Importar contatos da agenda WUZAPI
  - Verificar que cada contato tem `variables` populado
  - Verificar que `nome`, `telefone`, `data`, `saudacao` estão presentes
  - Verificar que `empresa` está presente quando disponível
  - Verificar logs no console do backend
  - _Requirements: 1.1, 1.2, 1.3, 3.2_

- [ ] 3.2 Testar importação CSV com variáveis customizadas
  - Criar CSV com colunas: phone, nome, empresa, cidade
  - Importar CSV
  - Verificar que variáveis customizadas foram mapeadas
  - Verificar que nomes foram normalizados (lowercase, sem espaços)
  - Verificar que valores foram trimados
  - _Requirements: 3.4, 3.5_

- [ ] 3.3 Testar validação de variáveis
  - Criar template com variáveis: "Olá {{nome}}, seu telefone é {{telefone}}"
  - Adicionar contatos com variáveis completas
  - Verificar que validação passa
  - Adicionar contato sem variável `nome`
  - Verificar que validação falha e mostra alerta
  - Verificar logs no console do frontend
  - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3_

- [ ] 3.4 Testar criação de campanha com variáveis
  - Criar campanha com template e contatos válidos
  - Verificar que campanha é criada com sucesso
  - Verificar que mensagens são enviadas com variáveis substituídas
  - Tentar criar campanha com contatos inválidos
  - Verificar que erro é mostrado e campanha não é criada
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5_

- [ ] 3.5 Testar casos extremos
  - Testar contato sem nome (apenas telefone)
  - Testar CSV com colunas com espaços e maiúsculas
  - Testar CSV com valores vazios
  - Testar template sem variáveis
  - Testar template com variáveis que não existem nos contatos
  - Verificar que sistema lida graciosamente com todos os casos
  - _Requirements: 1.5, 3.4, 3.5_

## Notas de Implementação

### Ordem de Execução Recomendada

1. **Fase 1 - Backend** (Tasks 1.x): Corrigir o problema na raiz
   - Começar por 1.1 e 1.2 (mapeamento WUZAPI) - CRÍTICO
   - Depois 1.3 e 1.4 (normalização CSV) - IMPORTANTE
   - Por último 1.5 (testes) - OPCIONAL

2. **Fase 2 - Frontend** (Tasks 2.x): Melhorar feedback
   - Começar por 2.1 e 2.4 (logging) - IMPORTANTE para debug
   - Depois 2.2 e 2.3 (UI) - IMPORTANTE para UX
   - Por último 2.5 (testes) - OPCIONAL

3. **Fase 3 - Validação** (Tasks 3.x): Garantir qualidade
   - Executar todos os testes manuais (3.1 a 3.5)
   - Corrigir quaisquer problemas encontrados

### Variáveis Padrão Mapeadas

| Variável | Fonte | Quando Gerada | Exemplo |
|----------|-------|---------------|---------|
| `nome` | FullName, PushName, FirstName, BusinessName | Na importação | "João Silva" |
| `telefone` | Phone normalizado | Na importação | "5511999999999" |
| `data` | Data atual | **No momento do envio** ⚡ | "14/11/2025" |
| `saudacao` | Hora atual | **No momento do envio** ⚡ | "Bom dia" / "Boa tarde" / "Boa noite" |
| `empresa` | BusinessName (opcional) | Na importação | "Empresa XYZ" |

**Nota**: `data` e `saudacao` são geradas dinamicamente no momento do envio de cada mensagem, garantindo que sejam sempre atuais.

### Normalização de Variáveis

Exemplos de normalização:
- "Nome Completo" → "nome_completo"
- "  Telefone  " → "telefone"
- "E-mail" → "email"
- "Data de Nascimento" → "data_de_nascimento"

### Critérios de Sucesso

- ✅ Contatos WUZAPI têm variáveis padrão populadas
- ✅ Contatos CSV têm variáveis customizadas preservadas
- ✅ Validação detecta corretamente variáveis faltando
- ✅ Mensagens de erro são claras e acionáveis
- ✅ Alerta visual mostra status de validação
- ✅ Logs facilitam debug de problemas
- ✅ Todos os testes passam

### Debugging

Se o problema persistir após implementação:

1. **Verificar logs do backend**:
   ```bash
   tail -f server/logs/app-*.log | grep "Importando contatos"
   ```

2. **Verificar logs do frontend**:
   - Abrir DevTools → Console
   - Filtrar por `[ContactImport]` ou `[Campaign]`

3. **Verificar estrutura de dados**:
   ```javascript
   console.log('Contact structure:', JSON.stringify(contacts[0], null, 2));
   ```

4. **Verificar variáveis detectadas**:
   ```javascript
   console.log('Detected variables:', detectedVariables);
   console.log('Contact variables:', contacts[0].variables);
   ```
