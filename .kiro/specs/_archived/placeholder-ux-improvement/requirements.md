# Melhoria de UX: Placeholders em Formulários

## Problema

Atualmente, muitos campos de formulário repetem no placeholder exatamente o mesmo texto do label, causando confusão visual e fazendo o usuário pensar que o campo já está preenchido.

### Exemplo do Problema Atual

```tsx
<Label>Nome Completo</Label>
<Input placeholder="Nome Completo do Usuário" />
```

**Resultado visual**: Parece que o campo já tem conteúdo, confundindo o usuário.

## Solução

Placeholders devem fornecer **exemplos práticos** ou **dicas de formato**, não repetir o label.

### Diretrizes para Placeholders

**REGRA PRINCIPAL**: Placeholders devem estar **VAZIOS** quando o campo não está recuperando dados do banco. Isso evita confusão visual com campos preenchidos.

1. **Campos Vazios (Padrão)**: Quando não há dados do banco, deixe vazio
   - ❌ `placeholder="Nome Completo"`
   - ❌ `placeholder="Ex: João da Silva"`
   - ✅ `placeholder=""` ou sem placeholder
   - ✅ Apenas o label é suficiente

2. **Formato Esperado (Exceção)**: Use placeholder APENAS para formatos específicos
   - ✅ `placeholder="+55 11 99999-9999"` (telefone)
   - ✅ `placeholder="https://exemplo.com"` (URL)
   - ✅ `placeholder="email@exemplo.com"` (email)
   - ✅ `placeholder="sk-proj-..."` (formato de chave API)

3. **Campos de Busca/Seleção (Exceção)**: Use texto que indique ação
   - ✅ `placeholder="Selecione uma opção"`
   - ✅ `placeholder="Buscar..."`
   - ✅ `placeholder="Filtrar..."`

4. **Campos com Dados do Banco**: Quando recuperando dados, o value já preenche
   - ✅ `value={userData.name}` (sem placeholder)
   - ✅ O campo mostra o dado real, não precisa placeholder

5. **NUNCA Repetir o Label**: Placeholder nunca deve repetir o texto do label
   - ❌ `<Label>Nome</Label> <Input placeholder="Nome" />`
   - ✅ `<Label>Nome</Label> <Input placeholder="" />`

## Categorias de Campos Afetados

### 1. Campos de Texto Simples
- Nome, descrição, título
- **Solução**: Usar "Ex: [exemplo]" ou deixar vazio

### 2. Campos com Formato Específico
- URL, telefone, email, data
- **Solução**: Mostrar formato esperado (já está correto na maioria)

### 3. Campos de Seleção
- Select, multi-select, date picker
- **Solução**: "Selecione..." (já está correto)

### 4. Campos de Busca
- **Solução**: "Buscar..." (já está correto)

## Escopo

Revisar e corrigir placeholders em todos os formulários do projeto:

- ✅ Componentes de autenticação (WuzAPILoginForm, LoginPage)
- ✅ Formulários de instâncias (WuzAPIInstancesList)
- ✅ Formulários de integração (TypebotStart, OpenAICredentialForm)
- ✅ Formulários de usuário (componentes em `src/components/admin/`)
- ✅ Formulários de banco de dados (componentes em `src/components/user/`)
- ✅ Formulários de webhook
- ✅ Formulários de mensagens
- ✅ Formulários de branding

## Critérios de Aceitação

1. Nenhum placeholder deve repetir exatamente o texto do label
2. Placeholders devem fornecer valor adicional (exemplo, formato, dica)
3. Campos óbvios podem não ter placeholder
4. Manter consistência de linguagem (português brasileiro)
5. Usar "Ex:" para exemplos práticos

## Impacto

- **UX**: Reduz confusão visual, melhora clareza
- **Acessibilidade**: Labels e placeholders com propósitos distintos
- **Conversão**: Usuários entendem melhor o que preencher
