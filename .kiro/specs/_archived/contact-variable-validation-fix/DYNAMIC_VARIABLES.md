# Variáveis Dinâmicas - Implementação

## 🎯 Problema Resolvido

Anteriormente, as variáveis `{{data}}` e `{{saudacao}}` eram geradas no momento da **importação** dos contatos, causando problemas:

- ❌ Se importar hoje e enviar amanhã, a data seria de hoje
- ❌ Se importar de manhã e enviar à noite, a saudação seria "Bom dia"
- ❌ Campanhas agendadas teriam data/saudação incorretas

## ✅ Solução Implementada

Agora `{{data}}` e `{{saudacao}}` são geradas **dinamicamente no momento do envio** de cada mensagem.

## 📋 Fluxo de Dados

### 1. Importação de Contatos

**Arquivo**: `server/routes/contactImportRoutes.js`

```javascript
function mapWuzapiContactToVariables(contact, phone) {
  return {
    nome: contact.FullName || contact.PushName || ...,
    telefone: phone,
    empresa: contact.BusinessName  // opcional
    // ⚠️ NÃO gera 'data' nem 'saudacao' aqui
  };
}
```

**Resultado**:
```javascript
{
  phone: "5511999999999",
  name: "João Silva",
  variables: {
    nome: "João Silva",
    telefone: "5511999999999",
    empresa: "Empresa XYZ"
  }
}
```

### 2. Envio de Mensagens

**Arquivo**: `server/services/QueueManager.js`

```javascript
// Gerar variáveis dinâmicas no momento do envio
generateDynamicVariables() {
  const now = new Date();
  const hour = now.getHours();
  
  let saudacao = 'Olá';
  if (hour >= 6 && hour < 12) saudacao = 'Bom dia';
  else if (hour >= 12 && hour < 18) saudacao = 'Boa tarde';
  else saudacao = 'Boa noite';
  
  return {
    data: now.toLocaleDateString('pt-BR'),
    saudacao: saudacao
  };
}

// No processamento de cada mensagem
const dynamicVars = this.generateDynamicVariables();
const allVariables = {
  ...contact.variables,  // nome, telefone, empresa
  ...dynamicVars         // data, saudacao (sobrescreve se existir)
};

const processed = templateProcessor.process(template, allVariables);
```

**Resultado no momento do envio**:
```javascript
{
  nome: "João Silva",
  telefone: "5511999999999",
  empresa: "Empresa XYZ",
  data: "15/11/2025",      // ⚡ Gerada AGORA
  saudacao: "Boa tarde"    // ⚡ Gerada AGORA
}
```

## 🔄 Exemplos de Uso

### Exemplo 1: Campanha Imediata

```
Importação: 14/11/2025 10:00 (manhã)
Envio:      14/11/2025 10:05 (manhã)

Mensagem: "{{saudacao}} {{nome}}, hoje é {{data}}"
Resultado: "Bom dia João Silva, hoje é 14/11/2025"
```

### Exemplo 2: Campanha Agendada

```
Importação: 14/11/2025 10:00 (manhã)
Agendamento: 15/11/2025 20:00 (noite)
Envio:      15/11/2025 20:00 (noite)

Mensagem: "{{saudacao}} {{nome}}, hoje é {{data}}"
Resultado: "Boa noite João Silva, hoje é 15/11/2025"
```

### Exemplo 3: Reutilização de Contatos

```
Importação: 14/11/2025 10:00

Campanha 1 (14/11 às 11:00):
  "{{saudacao}} {{nome}}" → "Bom dia João Silva"

Campanha 2 (14/11 às 15:00):
  "{{saudacao}} {{nome}}" → "Boa tarde João Silva"

Campanha 3 (15/11 às 09:00):
  "Hoje é {{data}}" → "Hoje é 15/11/2025"
```

## 📊 Comparação

| Aspecto | Antes (Estático) | Depois (Dinâmico) |
|---------|------------------|-------------------|
| **Geração** | Na importação | No envio |
| **Precisão** | ❌ Pode ficar desatualizada | ✅ Sempre atual |
| **Agendamento** | ❌ Data/hora da importação | ✅ Data/hora do envio |
| **Reutilização** | ❌ Precisa reimportar | ✅ Pode reutilizar |
| **Performance** | ⚡ Mais rápido (pré-calculado) | ⚡ Mínimo impacto |

## 🎨 Horários de Saudação

| Horário | Saudação |
|---------|----------|
| 00:00 - 05:59 | Boa noite |
| 06:00 - 11:59 | Bom dia |
| 12:00 - 17:59 | Boa tarde |
| 18:00 - 23:59 | Boa noite |

## 🧪 Como Testar

### Teste 1: Verificar Variáveis na Importação

```bash
# Importar contatos
# Verificar no console do backend:
{
  phone: "5511999999999",
  name: "João Silva",
  variables: {
    nome: "João Silva",
    telefone: "5511999999999"
    // ✅ NÃO deve ter 'data' nem 'saudacao'
  }
}
```

### Teste 2: Verificar Geração Dinâmica

```bash
# Criar campanha com template:
"{{saudacao}} {{nome}}, hoje é {{data}}"

# Verificar logs do QueueManager:
[QueueManager] Gerando variáveis dinâmicas
[QueueManager] Variáveis mescladas: {
  nome: "João Silva",
  telefone: "5511999999999",
  data: "15/11/2025",      # ⚡ Gerada agora
  saudacao: "Boa tarde"    # ⚡ Gerada agora
}
```

### Teste 3: Verificar Mensagem Final

```bash
# Verificar mensagem enviada:
"Boa tarde João Silva, hoje é 15/11/2025"

# ✅ Data e saudação devem corresponder ao momento do envio
```

## 🔍 Debug

Se as variáveis dinâmicas não estiverem funcionando:

1. **Verificar logs do QueueManager**:
   ```bash
   tail -f server/logs/app-*.log | grep "QueueManager"
   ```

2. **Verificar se a função está sendo chamada**:
   ```javascript
   // Em QueueManager.js, adicionar log temporário:
   const dynamicVars = this.generateDynamicVariables();
   console.log('[DEBUG] Dynamic vars:', dynamicVars);
   ```

3. **Verificar merge de variáveis**:
   ```javascript
   const allVariables = {
     ...contact.variables,
     ...dynamicVars
   };
   console.log('[DEBUG] All variables:', allVariables);
   ```

## 📝 Notas Técnicas

### Performance

- Geração de variáveis dinâmicas é **extremamente rápida** (< 1ms)
- Não há impacto perceptível no tempo de envio
- Cache não é necessário pois cada mensagem pode ter horário diferente

### Timezone

- Usa horário do servidor (configurável via `TZ` env var)
- Para produção, configurar `TZ=America/Sao_Paulo`
- Formato de data: `DD/MM/YYYY` (padrão brasileiro)

### Extensibilidade

Para adicionar novas variáveis dinâmicas:

```javascript
generateDynamicVariables() {
  const now = new Date();
  
  return {
    data: now.toLocaleDateString('pt-BR'),
    saudacao: this.getSaudacao(now.getHours()),
    // Adicionar novas variáveis aqui:
    dia_semana: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
    mes: now.toLocaleDateString('pt-BR', { month: 'long' }),
    ano: now.getFullYear().toString()
  };
}
```

## ✅ Checklist de Implementação

- [x] Remover `data` e `saudacao` de `mapWuzapiContactToVariables()`
- [x] Criar função `generateDynamicVariables()` no `QueueManager`
- [x] Mesclar variáveis dinâmicas com variáveis do contato
- [x] Atualizar documentação
- [x] Adicionar logs para debug
- [x] Testar com campanha imediata
- [x] Testar com campanha agendada
- [x] Testar diferentes horários do dia
- [x] Validar formato de data brasileiro
- [x] Atualizar validação para ignorar variáveis dinâmicas

## ⚠️ IMPORTANTE: Validação de Variáveis Dinâmicas

A validação no frontend foi atualizada para **ignorar** as variáveis `data` e `saudacao` durante a verificação de contatos, pois elas são geradas dinamicamente no momento do envio.

**Antes**:
```
❌ 2 contato(s) sem variáveis necessárias
   555318499696: faltam {{data}}, {{saudacao}}
```

**Depois**:
```
✅ Todos os 2 contatos possuem as variáveis necessárias
   (data e saudacao serão geradas no envio)
```

Isso significa que:
- ✅ Contatos antigos (importados antes da correção) continuam funcionando
- ✅ Não é necessário reimportar contatos
- ✅ Validação passa corretamente
- ✅ Mensagens são enviadas com data/saudacao atuais
