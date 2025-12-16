# Advanced View Builder - Guia do Usuário

## 📚 Índice

1. [Visão Geral](#visão-geral)
2. [Guia do Administrador](#guia-do-administrador)
3. [Guia do Usuário Final](#guia-do-usuário-final)
4. [Perguntas Frequentes](#perguntas-frequentes)

---

## Visão Geral

O **Advanced View Builder** transforma a experiência de visualização e edição de dados, oferecendo três modos de visualização:

- **📝 Formulário**: Visualização tradicional com campos editáveis
- **📅 Calendário**: Organização visual por datas
- **📊 Kanban**: Quadro de colunas por status/etapa

---

## Guia do Administrador

### 1. Configurando Helper Text

Helper text fornece orientação adicional aos usuários sobre o que preencher em cada campo.

**Passos:**

1. Acesse **Admin > Conexões de Banco de Dados**
2. Edite uma conexão existente ou crie uma nova
3. Vá para a aba **Configurações Avançadas**
4. Na tabela **Mapeador de Campos**, localize a coluna **"Texto de Ajuda (Descrição)"**
5. Digite o texto de ajuda para cada campo (máximo 500 caracteres)
6. Um contador mostrará quantos caracteres você usou
7. Clique em **Salvar**

**Exemplo:**
```
Campo: Email
Helper Text: "Digite seu email corporativo no formato nome@empresa.com"
```

**Dicas:**
- ✅ Seja claro e conciso
- ✅ Forneça exemplos quando apropriado
- ✅ Mencione formatos esperados
- ❌ Não exceda 500 caracteres

---

### 2. Habilitando Visualização de Calendário

A visualização de calendário organiza registros por data.

**Requisitos:**
- A tabela deve ter pelo menos uma coluna do tipo **Date** ou **DateTime**

**Passos:**

1. Na aba **Configurações Avançadas**, role até **"Configuração de Visualizações"**
2. Ative o toggle **"Habilitar Visualização Calendário"**
3. Selecione o campo de data no dropdown **"Organizar por (Coluna de Data)"**
   - Apenas colunas Date/DateTime aparecerão
4. Clique em **Salvar**

**Campos Suportados:**
- ✅ Date
- ✅ DateTime
- ✅ CreatedTime
- ✅ LastModifiedTime

**Validação:**
- ⚠️ Se não houver colunas de data, uma mensagem de aviso aparecerá
- ⚠️ Você deve selecionar um campo de data antes de salvar

---

### 3. Habilitando Visualização Kanban

A visualização Kanban organiza registros em colunas por status ou etapa.

**Requisitos:**
- A tabela deve ter pelo menos uma coluna de texto ou seleção

**Passos:**

1. Na seção **"Configuração de Visualizações"**, ative **"Habilitar Visualização Kanban"**
2. Selecione o campo de status no dropdown **"Organizar por (Coluna de Etapas/Status)"**
   - Colunas de texto e seleção aparecerão
3. Configure quais campos aparecerão nos cards marcando **"Exibir no Card"** na tabela de mapeamento
4. Clique em **Salvar**

**Campos Suportados:**
- ✅ SingleLineText
- ✅ LongText
- ✅ SingleSelect
- ✅ MultiSelect

**Configuração de Cards:**
- Marque **"Exibir no Card"** para os campos que devem aparecer nos cards Kanban
- Recomendado: 2-4 campos por card para melhor legibilidade

---

### 4. Melhores Práticas

**Helper Text:**
- Use para campos complexos ou que causam dúvidas
- Mantenha textos curtos e objetivos
- Atualize conforme feedback dos usuários

**Calendário:**
- Escolha o campo de data mais relevante para o contexto
- Considere usar "CreatedTime" para visualizar cronologia de criação
- Use campos de data customizados para eventos específicos

**Kanban:**
- Use campos com valores bem definidos (ex: "Novo", "Em Progresso", "Concluído")
- Evite campos com muitos valores únicos (>10 colunas fica confuso)
- Configure campos "Exibir no Card" para mostrar informações essenciais

---

## Guia do Usuário Final

### 1. Navegando Entre Visualizações

Quando você acessa seus dados, verá abas no topo da página:

- **📝 Formulário**: Sempre disponível
- **📅 Calendário**: Disponível se configurado pelo admin
- **📊 Kanban**: Disponível se configurado pelo admin

**Sua preferência é salva automaticamente!** Na próxima vez que acessar, a última visualização usada será exibida.

---

### 2. Usando a Visualização de Formulário

**Recursos:**
- ✏️ Edite campos marcados como "Editável"
- 👁️ Visualize campos marcados como "Somente leitura"
- 💡 Veja textos de ajuda abaixo dos campos
- 📊 Acompanhe suas alterações em tempo real

**Como Usar:**
1. Edite os campos desejados
2. Observe o resumo de alterações na parte inferior
3. Clique em **"Salvar Alterações"**
4. Aguarde a confirmação de sucesso

**Dicas:**
- Campos com texto de ajuda têm informações úteis logo abaixo
- Campos obrigatórios mostrarão erro se deixados vazios
- Alterações não salvas são destacadas

---

### 3. Usando a Visualização de Calendário

**Recursos:**
- 📅 Visualize seus registros organizados por data
- 🔄 Navegue entre meses, semanas e dias
- 🖱️ Clique em eventos para editar

**Controles:**
- **◀️ Anterior / Próximo ▶️**: Navega no tempo
- **Hoje**: Volta para a data atual
- **Mês / Semana / Dia**: Alterna o nível de zoom

**Como Usar:**
1. Navegue até a data desejada
2. Clique em um evento no calendário
3. Você será levado ao formulário para editar
4. Após salvar, volte ao calendário para ver a atualização

**Dicas:**
- Use visualização de **Mês** para visão geral
- Use **Semana** para planejamento detalhado
- Use **Dia** para foco em uma data específica

---

### 4. Usando a Visualização Kanban

**Recursos:**
- 📊 Visualize registros organizados em colunas
- 🖱️ Arraste cards entre colunas para mudar status
- ⚡ Atualizações instantâneas
- 🔄 Sincronização automática

**Como Usar:**

**Para Visualizar:**
1. Cada coluna representa um status diferente
2. Cards mostram informações resumidas do registro
3. Número no topo da coluna indica quantidade de cards

**Para Mover Cards:**
1. Clique e segure o ícone ⋮⋮ no card
2. Arraste para a coluna desejada
3. Solte o card
4. O status é atualizado automaticamente!

**Para Editar:**
1. Clique no card (não no ícone de arrastar)
2. Você será levado ao formulário
3. Edite e salve
4. Volte ao Kanban para ver as mudanças

**Dicas:**
- ✅ Arraste apenas pelo ícone ⋮⋮
- ✅ Aguarde a confirmação de "Status atualizado"
- ✅ Se houver erro, os dados serão recarregados automaticamente
- ⚠️ Colunas vazias mostram "Arraste cards para cá"

---

## Perguntas Frequentes

### Geral

**P: Minhas preferências de visualização são salvas?**
R: Sim! A última visualização que você usou será exibida automaticamente na próxima vez.

**P: Posso usar em dispositivos móveis?**
R: Sim! Todas as visualizações são responsivas e funcionam em smartphones e tablets.

**P: O que acontece se o admin desabilitar uma visualização que eu estava usando?**
R: Você será automaticamente redirecionado para a visualização de Formulário.

---

### Formulário

**P: Por que alguns campos não podem ser editados?**
R: O administrador configurou esses campos como "Somente leitura" para proteger dados importantes.

**P: O que significa o texto abaixo dos campos?**
R: É o "helper text" - orientação adicional configurada pelo admin para ajudá-lo a preencher corretamente.

**P: Posso desfazer alterações?**
R: Antes de salvar, você pode simplesmente recarregar a página. Após salvar, precisará editar novamente.

---

### Calendário

**P: Por que não vejo a aba Calendário?**
R: O administrador não habilitou essa visualização ou a tabela não possui campos de data.

**P: Posso criar novos eventos no calendário?**
R: Atualmente, você pode apenas visualizar e editar eventos existentes clicando neles.

**P: Como vejo eventos de meses diferentes?**
R: Use os botões ◀️ Anterior e Próximo ▶️, ou clique em "Hoje" e navegue a partir daí.

---

### Kanban

**P: Por que não vejo a aba Kanban?**
R: O administrador não habilitou essa visualização ou não configurou um campo de status.

**P: Posso criar novas colunas?**
R: Não. As colunas são geradas automaticamente baseadas nos valores únicos do campo de status.

**P: O que acontece se eu arrastar para a coluna errada?**
R: Você pode simplesmente arrastar de volta para a coluna correta. O status será atualizado novamente.

**P: Por que alguns cards não mostram muita informação?**
R: O administrador controla quais campos aparecem nos cards através da configuração "Exibir no Card".

---

## Suporte

Se você encontrar problemas ou tiver dúvidas:

1. **Verifique este guia** primeiro
2. **Entre em contato com seu administrador** para questões de configuração
3. **Reporte bugs** através dos canais apropriados da sua organização

---

**Versão**: 1.0.0  
**Última atualização**: 2025-11-07  
**Status**: Produção
