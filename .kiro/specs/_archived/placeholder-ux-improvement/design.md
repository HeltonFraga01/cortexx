# Design: Melhoria de Placeholders

## Padrões de Placeholder por Tipo de Campo

### 1. Campos de Identificação

| Campo | Label | Placeholder Atual | Placeholder Novo |
|-------|-------|-------------------|------------------|
| Nome de usuário | Nome Completo | "Nome Completo do Usuário" | "Ex: João da Silva" |
| Nome de instância | Nome da Instância | "Nome da Instância" | "Ex: minha-instancia" ✅ |
| Nome de conexão | Nome da Conexão | "Nome da Conexão" | "Ex: Banco Clientes" |
| Descrição | Descrição | "Descrição" | "Ex: Conexão para envio de mensagens" |

### 2. Campos de Autenticação

| Campo | Label | Placeholder Atual | Placeholder Novo |
|-------|-------|-------------------|------------------|
| Token Admin | Token de Administrador | "Digite seu token de administrador" | "Cole seu token aqui" |
| Token User | Token de Usuário | "Digite seu token de usuário" | "Cole seu token aqui" |
| Senha | Senha | "Senha" | "" (vazio) |
| API Key | API Key | "API Key" | "sk-..." ou "Cole sua chave" |

### 3. Campos de Contato

| Campo | Label | Placeholder Atual | Placeholder Novo |
|-------|-------|-------------------|------------------|
| Telefone | Telefone | "+55 11 99999-9999" | "+55 11 99999-9999" ✅ |
| Email | Email | "email@exemplo.com" | "email@exemplo.com" ✅ |
| WhatsApp | Número WhatsApp | "557499879409" | "5511999999999" |

### 4. Campos de URL/Endpoint

| Campo | Label | Placeholder Atual | Placeholder Novo |
|-------|-------|-------------------|------------------|
| Base URL | URL Base | "https://wzapi.wasend.com.br/api" | "https://wzapi.wasend.com.br/api" ✅ |
| Webhook URL | URL do Webhook | "https://seu-webhook.com/endpoint" | "https://seu-webhook.com/endpoint" ✅ |
| URL Genérica | URL | "https://exemplo.com" | "https://exemplo.com" ✅ |

### 5. Campos de Configuração

| Campo | Label | Placeholder Atual | Placeholder Novo |
|-------|-------|-------------------|------------------|
| Host | Host | "Host" | "Ex: localhost ou 192.168.1.10" |
| Porta | Porta | "Porta" | "Ex: 3306" |
| Database | Nome do Banco | "Nome do Banco" | "Ex: clientes_db" |
| Username | Usuário | "Usuário" | "Ex: root" |
| Tabela | Nome da Tabela | "Nome da Tabela" | "Ex: contatos" |

### 6. Campos de Mensagem

| Campo | Label | Placeholder Atual | Placeholder Novo |
|-------|-------|-------------------|------------------|
| Mensagem | Mensagem | "Mensagem" | "Digite sua mensagem aqui..." |
| Assunto | Assunto | "Assunto" | "Ex: Confirmação de pedido" |
| Template | Nome do Template | "Nome do Template" | "Ex: Boas-vindas" |

### 7. Campos de Seleção (já corretos)

| Campo | Placeholder |
|-------|-------------|
| Select | "Selecione uma opção" ✅ |
| Multi-select | "Selecione opções" ✅ |
| Date picker | "Selecione uma data" ✅ |
| Time picker | "Selecione horário" ✅ |
| DateTime picker | "Selecione data e hora" ✅ |

### 8. Campos de Busca (já corretos)

| Campo | Placeholder |
|-------|-------------|
| Busca geral | "Buscar..." ✅ |
| Filtro | "Filtrar..." ✅ |

## Regras de Implementação

### Quando Usar "Ex:"

Use "Ex:" quando o placeholder mostra um exemplo concreto:

```tsx
// ✅ Bom
<Input placeholder="Ex: João da Silva" />
<Input placeholder="Ex: minha-instancia" />
<Input placeholder="Ex: localhost" />
```

### Quando Usar Formato

Use formato quando há padrão específico:

```tsx
// ✅ Bom
<Input placeholder="+55 11 99999-9999" />
<Input placeholder="https://exemplo.com" />
<Input placeholder="email@exemplo.com" />
```

### Quando Usar Instrução

Use instrução quando há ação específica:

```tsx
// ✅ Bom
<Input placeholder="Cole seu token aqui" />
<Input placeholder="Digite sua mensagem aqui..." />
<Input placeholder="Selecione uma opção" />
```

### Quando Deixar Vazio

Deixe vazio quando o label é auto-explicativo e não há formato específico:

```tsx
// ✅ Bom
<Label>Senha</Label>
<Input type="password" placeholder="" />

<Label>Observações</Label>
<Textarea placeholder="" />
```

## Componentes Afetados

### Alta Prioridade (formulários principais)

1. **WuzAPILoginForm** (`src/components/wuzapi/auth/WuzAPILoginForm.tsx`)
   - Token admin: "Cole seu token aqui"
   - Token user: "Cole seu token aqui"
   - Base URL: ✅ já está bom
   - Telefone: ✅ já está bom

2. **LoginPage** (`src/pages/LoginPage.tsx`)
   - Token user: "Cole seu token aqui"
   - Token admin: "Cole seu token aqui"

3. **WuzAPIInstancesList** (`src/components/wuzapi/instances/WuzAPIInstancesList.tsx`)
   - Nome: ✅ já está bom
   - Webhook: ✅ já está bom

4. **TypebotStart** (`src/components/TypebotStart.tsx`)
   - Telefone: "5511999999999"
   - Nome variável: "Ex: nome"
   - Valor variável: "Ex: João"

5. **OpenAICredentialForm** (`src/components/OpenAICredentialForm.tsx`)
   - Nome: ✅ já está bom
   - API Key: "sk-..." ou "Cole sua chave OpenAI"

### Média Prioridade (formulários de configuração)

6. Formulários de banco de dados
7. Formulários de webhook
8. Formulários de usuário (admin)
9. Formulários de branding

### Baixa Prioridade (componentes base)

10. Componentes UI customizados (já têm defaults corretos)

## Checklist de Validação

Para cada campo alterado, verificar:

- [ ] Placeholder não repete o label
- [ ] Placeholder adiciona valor (exemplo, formato ou dica)
- [ ] Linguagem consistente (português brasileiro)
- [ ] Usa "Ex:" para exemplos práticos
- [ ] Usa formato para padrões específicos
- [ ] Usa instrução para ações
- [ ] Vazio apenas quando realmente óbvio
