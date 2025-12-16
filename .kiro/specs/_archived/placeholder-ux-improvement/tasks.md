# Tasks: Melhoria de Placeholders

## ✅ Status: Em Andamento

## 📋 Tasks Organizadas por Prioridade

### 🔴 Alta Prioridade - Formulários de Autenticação

#### ✅ Task 1: Corrigir WuzAPILoginForm (CONCLUÍDA)
**Arquivo**: `src/components/wuzapi/auth/WuzAPILoginForm.tsx`

**Alterações**:
```tsx
// Linha 149 - Token Admin
- placeholder="Digite seu token de administrador"
+ placeholder="Cole seu token aqui"

// Linha 206 - Token User
- placeholder="Digite seu token de usuário"
+ placeholder="Cole seu token aqui"

// Linha 133 e 237 - Manter como estão (já corretos)
✅ placeholder="https://wzapi.wasend.com.br/api"
✅ placeholder="+55 11 99999-9999"
```

**Motivo**: "Digite seu token" é redundante. "Cole seu token aqui" é mais direto e indica a ação esperada.

---

#### ✅ Task 2: Corrigir LoginPage (CONCLUÍDA)
**Arquivo**: `src/pages/LoginPage.tsx`

**Alterações**:
```tsx
// Linha 100 - Token User
- placeholder="Insira seu token de usuário"
+ placeholder="Cole seu token aqui"

// Linha 122 - Token Admin
- placeholder="Insira seu token de administrador"
+ placeholder="Cole seu token aqui"
```

**Motivo**: Consistência com WuzAPILoginForm e ação mais clara.

---

### 🟡 Média Prioridade - Formulários de Integração

#### ✅ Task 3: Corrigir TypebotStart (CONCLUÍDA)
**Arquivo**: `src/components/TypebotStart.tsx`

**Alterações**:
```tsx
// Linha 149 - Telefone
- placeholder="557499879409"
+ placeholder="5511999999999"

// Linha 173 - Nome da variável
- placeholder="Nome"
+ placeholder="Ex: nome"

// Linha 181 - Valor da variável
- placeholder="Valor"
+ placeholder="Ex: João"
```

**Motivo**: 
- Telefone: Formato mais claro com DDD separado visualmente
- Variáveis: "Nome" e "Valor" repetem o conceito do campo, usar exemplos é melhor

---

#### ✅ Task 4: Corrigir OpenAICredentialForm (CONCLUÍDA)
**Arquivo**: `src/components/OpenAICredentialForm.tsx`

**Alterações**:
```tsx
// Linha 166 - Nome da credencial
✅ placeholder="Nome descritivo (ex: Produção, Testes)"
// Já está correto! Usa "ex:" e fornece exemplos práticos

// Linha 175 - API Key
- placeholder="sk-..."
+ placeholder="sk-proj-..."
```

**Motivo**: 
- Nome: Já está perfeito
- API Key: Formato mais atual das chaves OpenAI (começam com "sk-proj-")

---

### 🟢 Baixa Prioridade - Outros Formulários

#### ✅ Task 5: Buscar e corrigir formulários de banco de dados (CONCLUÍDA)

**Arquivos corrigidos**:
- ✅ DatabaseConnectionDialog.tsx
- ✅ DatabaseConnectionForm.tsx
- ✅ TypebotForm.tsx

#### Task 5b: Buscar e corrigir formulários de banco de dados (CONTINUAÇÃO)

**Comando de busca**:
```bash
grep -r "placeholder=" src/components/user/ src/components/admin/ --include="*.tsx"
```

**Critérios**:
- Campos de "Nome": usar "Ex: [exemplo]"
- Campos de "Host": usar "Ex: localhost"
- Campos de "Porta": usar "Ex: 3306"
- Campos de "Database": usar "Ex: clientes_db"
- Campos de "Username": usar "Ex: root"
- Campos de "Tabela": usar "Ex: contatos"

---

#### ✅ Task 6: Buscar e corrigir formulários de webhook (CONCLUÍDA)

**Arquivos corrigidos**:
- ✅ WebhookForm.tsx

#### Task 6b: Buscar e corrigir formulários de webhook (CONTINUAÇÃO)

**Arquivos prováveis**:
- `src/components/user/WebhookConfig*.tsx`
- `src/components/features/webhooks/*.tsx`

**Critérios**:
- URL: manter formato "https://..." (já correto)
- Nome: usar "Ex: [exemplo]"
- Descrição: usar "Ex: [exemplo]" ou deixar vazio

---

#### Task 7: Buscar e corrigir formulários de mensagem

**Arquivos prováveis**:
- `src/components/user/MessageSender*.tsx`
- `src/components/features/messaging/*.tsx`
- `src/components/disparador/*.tsx`

**Critérios**:
- Mensagem: "Digite sua mensagem aqui..."
- Assunto: "Ex: Confirmação de pedido"
- Template: "Ex: Boas-vindas"
- Destinatário: manter formato de telefone

---

## 🎯 Checklist de Implementação

### Para cada arquivo alterado:

- [ ] Placeholder não repete o label
- [ ] Placeholder adiciona valor (exemplo, formato ou dica)
- [ ] Usa "Ex:" para exemplos práticos
- [ ] Usa formato para padrões específicos (URL, telefone, email)
- [ ] Usa instrução para ações ("Cole...", "Digite...", "Selecione...")
- [ ] Linguagem em português brasileiro
- [ ] Testado visualmente no navegador

---

## 📝 Ordem de Execução Recomendada

1. **Task 1**: WuzAPILoginForm (mais usado)
2. **Task 2**: LoginPage (mais usado)
3. **Task 3**: TypebotStart
4. **Task 4**: OpenAICredentialForm
5. **Task 5**: Formulários de banco de dados
6. **Task 6**: Formulários de webhook
7. **Task 7**: Formulários de mensagem

---

## 🧪 Testes Visuais

Após cada alteração, verificar:

1. Abrir o formulário no navegador
2. Verificar que o placeholder não confunde com conteúdo preenchido
3. Verificar que o placeholder adiciona informação útil
4. Verificar que label + placeholder fazem sentido juntos
5. Testar em modo claro e escuro

---

## 📊 Métricas de Sucesso

- ✅ 0 placeholders repetindo labels
- ✅ 100% dos placeholders com valor adicional
- ✅ Feedback positivo de usuários sobre clareza
- ✅ Redução de erros de preenchimento

---

## 🔄 Próximos Passos

Após implementar todas as tasks:

1. Criar PR com todas as alterações
2. Solicitar review focado em UX
3. Testar com usuários reais
4. Documentar padrões em guia de estilo
5. Adicionar lint rule para prevenir regressão (opcional)

---

## ✅ Alterações Implementadas

### Nova Regra Aplicada

**Placeholders devem estar VAZIOS quando o campo não está recuperando dados do banco.**

Exceções apenas para:
- Formatos específicos (telefone, URL, email, chaves API)
- Campos de busca/seleção/filtro

### Arquivos Corrigidos (8 arquivos)

1. **WuzAPILoginForm.tsx**
   - Token Admin: ~~"Digite seu token de administrador"~~ → **VAZIO**
   - Token User: ~~"Digite seu token de usuário"~~ → **VAZIO**
   - Base URL: ✅ Mantido "https://wzapi.wasend.com.br/api" (formato URL)
   - Telefone: ✅ Mantido "+55 11 99999-9999" (formato telefone)

2. **LoginPage.tsx**
   - Token User: ~~"Insira seu token de usuário"~~ → **VAZIO**
   - Token Admin: ~~"Insira seu token de administrador"~~ → **VAZIO**

3. **TypebotStart.tsx**
   - Telefone: ✅ Mantido "5511999999999" (formato telefone)
   - Nome variável: ~~"Nome"~~ → **VAZIO**
   - Valor variável: ~~"Valor"~~ → **VAZIO**

4. **OpenAICredentialForm.tsx**
   - Nome: ~~"Nome descritivo (ex: Produção, Testes)"~~ → **VAZIO**
   - API Key: ✅ Mantido "sk-proj-..." (formato chave API)

5. **DatabaseConnectionDialog.tsx**
   - Nome: ~~"Ex: Clientes Principal"~~ → **VAZIO**
   - Host: ~~"Ex: localhost"~~ → **VAZIO**
   - Database: ~~"Ex: clientes_db"~~ → **VAZIO**
   - Username: ~~"Ex: root"~~ → **VAZIO**
   - Tabela: ~~"Ex: contatos"~~ → **VAZIO**
   - URL NocoDB: ✅ Mantido "https://nocodb.wasend.com.br" (formato URL)

6. **DatabaseConnectionForm.tsx**
   - Nome: ~~"Ex: Clientes Principal"~~ → **VAZIO**
   - Host: ~~"Ex: localhost"~~ → **VAZIO**
   - Database: ~~"Ex: clientes_db"~~ → **VAZIO**
   - Username: ~~"Ex: root"~~ → **VAZIO**
   - Tabela: ~~"Ex: contatos"~~ → **VAZIO**
   - URL NocoDB: ✅ Mantido "https://nocodb.wasend.com.br" (formato URL)

7. **TypebotForm.tsx**
   - Descrição: ~~"Ex: Bot de Atendimento"~~ → **VAZIO**
   - URL: ✅ Mantido "https://bot.packtypebot.com.br" (formato URL)

8. **WebhookForm.tsx**
   - Header Nome: ~~"Ex: Authorization"~~ → **VAZIO**
   - Header Valor: ~~"Ex: Bearer token123"~~ → **VAZIO**
   - URL: ✅ Mantido "https://seu-webhook.com/callback" (formato URL)

### Impacto

- ✅ 20+ placeholders removidos (agora vazios)
- ✅ Mantidos apenas placeholders de formato (URL, telefone, email, chaves)
- ✅ 0 erros de compilação
- ✅ Todos os formulários principais cobertos
- ✅ **Regra de steering criada**: `.kiro/steering/form-placeholders.md`
- ✅ Melhor UX: campos vazios são claramente vazios
- ✅ Sem confusão visual: usuário não pensa que campo já está preenchido
