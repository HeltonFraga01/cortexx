# Design Document - Correção de Validação de Variáveis

## Overview

Este documento descreve a solução técnica para corrigir o problema de validação de variáveis em contatos. A solução envolve:

1. Mapear campos do WUZAPI para variáveis padrão
2. Normalizar nomes de variáveis customizadas
3. Melhorar feedback de validação no frontend
4. Garantir consistência entre backend e frontend

## Architecture

### Fluxo de Dados Atual (Com Problema)

```
┌─────────────────────────────────────────────────────────────┐
│                    Importação WUZAPI                         │
│  - Busca contatos da API                                    │
│  - Retorna: { phone, name, variables: {} }  ❌ VAZIO       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Validation                       │
│  - Detecta variáveis: {{nome}}, {{telefone}}, etc.         │
│  - Verifica contact.variables[varName]                      │
│  - Resultado: FALHA (variables está vazio)  ❌              │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados Corrigido

```
┌─────────────────────────────────────────────────────────────┐
│                    Importação WUZAPI                         │
│  - Busca contatos da API                                    │
│  - Mapeia campos para variáveis:                            │
│    * nome: FullName || PushName || FirstName                │
│    * telefone: phone formatado                              │
│    * data: data atual                                       │
│    * saudacao: gerada dinamicamente                         │
│  - Retorna: { phone, name, variables: {...} }  ✅          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Validation                       │
│  - Detecta variáveis: {{nome}}, {{telefone}}, etc.         │
│  - Verifica contact.variables[varName]                      │
│  - Resultado: SUCESSO (variables populado)  ✅              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Backend - Mapeamento de Variáveis WUZAPI

#### Função: `mapWuzapiContactToVariables(contact, phone)`

```javascript
/**
 * Mapeia campos do contato WUZAPI para variáveis padrão
 * @param {Object} contact - Contato do WUZAPI
 * @param {string} phone - Telefone normalizado
 * @returns {Object} Objeto com variáveis mapeadas
 */
function mapWuzapiContactToVariables(contact, phone) {
  const now = new Date();
  const nome = contact.FullName || contact.PushName || contact.FirstName || contact.BusinessName || '';
  
  // Gerar saudação baseada na hora
  const hour = now.getHours();
  let saudacao = 'Olá';
  if (hour >= 6 && hour < 12) {
    saudacao = 'Bom dia';
  } else if (hour >= 12 && hour < 18) {
    saudacao = 'Boa tarde';
  } else {
    saudacao = 'Boa noite';
  }
  
  return {
    nome: nome,
    telefone: phone,
    data: now.toLocaleDateString('pt-BR'),
    saudacao: saudacao,
    // Adicionar campos extras do WUZAPI se disponíveis
    ...(contact.BusinessName && { empresa: contact.BusinessName })
  };
}
```

#### Atualização na Rota `/import/wuzapi`

**Antes** (linha 195):
```javascript
return {
  phone: validation.valid ? validation.normalized : phone,
  name: contact.FullName || contact.PushName || contact.FirstName || contact.BusinessName || null,
  variables: {},  // ❌ PROBLEMA
  valid: validation.valid
};
```

**Depois**:
```javascript
const normalizedPhone = validation.valid ? validation.normalized : phone;
const variables = mapWuzapiContactToVariables(contact, normalizedPhone);

return {
  phone: normalizedPhone,
  name: variables.nome || null,
  variables: variables,  // ✅ CORRIGIDO
  valid: validation.valid
};
```

### 2. Backend - Normalização de Variáveis CSV

#### Função: `normalizeVariableName(name)`

```javascript
/**
 * Normaliza nome de variável para garantir consistência
 * @param {string} name - Nome da variável
 * @returns {string} Nome normalizado
 */
function normalizeVariableName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')  // Substituir espaços por underscore
    .replace(/[^a-z0-9_]/g, '');  // Remover caracteres especiais
}
```

#### Atualização no Parse de CSV

**Antes** (linha 68):
```javascript
const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
```

**Depois**:
```javascript
const headers = lines[0].split(',').map(h => normalizeVariableName(h));
```

**Antes** (linha 95):
```javascript
const variables = {};
customVariables.forEach(varName => {
  const varIndex = headers.indexOf(varName);
  if (varIndex !== -1 && values[varIndex]) {
    variables[varName] = values[varIndex];
  }
});
```

**Depois**:
```javascript
const variables = {};
customVariables.forEach(varName => {
  const varIndex = headers.indexOf(varName);
  if (varIndex !== -1 && values[varIndex]) {
    const normalizedVarName = normalizeVariableName(varName);
    variables[normalizedVarName] = values[varIndex].trim();
  }
});
```

### 3. Frontend - Melhor Feedback de Validação

#### Atualização em `CampaignBuilder.tsx`

**Antes** (linha 135):
```typescript
if (!varValidation.valid) {
  toast.error(
    `${varValidation.missingVariables.length} contato(s) sem variáveis necessárias: ${detectedVariables.join(', ')}`
  );
  return;
}
```

**Depois**:
```typescript
if (!varValidation.valid) {
  // Mostrar detalhes dos contatos com variáveis faltando
  const details = varValidation.missingVariables
    .slice(0, 3)  // Mostrar apenas os 3 primeiros
    .map(item => `${item.phone}: faltam ${item.missing.join(', ')}`)
    .join('\n');
  
  const moreCount = varValidation.missingVariables.length - 3;
  const moreText = moreCount > 0 ? `\n... e mais ${moreCount} contato(s)` : '';
  
  toast.error(
    `${varValidation.missingVariables.length} contato(s) sem variáveis necessárias`,
    {
      description: `Variáveis necessárias: ${detectedVariables.join(', ')}\n\n${details}${moreText}`,
      duration: 10000  // 10 segundos para dar tempo de ler
    }
  );
  return;
}
```

#### Adicionar Alerta Visual no UI

Adicionar antes do botão de criar campanha:

```typescript
{/* Validation Alert */}
{detectedVariables.length > 0 && contacts.length > 0 && (() => {
  const varValidation = contactImportService.validateContactVariables(contacts, detectedVariables);
  
  if (!varValidation.valid) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>{varValidation.missingVariables.length} contato(s) sem variáveis necessárias</strong>
          <div className="mt-2 space-y-1">
            {varValidation.missingVariables.slice(0, 5).map((item, idx) => (
              <div key={idx} className="text-xs">
                {item.phone}: faltam {item.missing.map(v => `{{${v}}}`).join(', ')}
              </div>
            ))}
            {varValidation.missingVariables.length > 5 && (
              <div className="text-xs font-medium">
                ... e mais {varValidation.missingVariables.length - 5} contato(s)
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        ✅ Todos os {contacts.length} contatos possuem as variáveis necessárias
      </AlertDescription>
    </Alert>
  );
})()}
```

### 4. Frontend - Logging para Debug

#### Atualização em `contactImportService.ts`

```typescript
validateContactVariables(
  contacts: Contact[],
  requiredVariables: string[]
): { valid: boolean; missingVariables: Array<{ phone: string; missing: string[] }> } {
  const missingVariables: Array<{ phone: string; missing: string[] }> = [];

  // Debug logging
  console.log('[ContactImport] Validating variables:', {
    totalContacts: contacts.length,
    requiredVariables,
    sampleContact: contacts[0]
  });

  contacts.forEach(contact => {
    const missing = requiredVariables.filter(
      varName => !contact.variables || !contact.variables[varName]
    );

    if (missing.length > 0) {
      console.log('[ContactImport] Contact missing variables:', {
        phone: contact.phone,
        missing,
        hasVariables: !!contact.variables,
        variables: contact.variables
      });
      
      missingVariables.push({
        phone: contact.phone,
        missing
      });
    }
  });

  console.log('[ContactImport] Validation result:', {
    valid: missingVariables.length === 0,
    totalMissing: missingVariables.length
  });

  return {
    valid: missingVariables.length === 0,
    missingVariables
  };
}
```

## Data Models

### Contact Interface (Atualizado)

```typescript
interface Contact {
  phone: string;           // Telefone normalizado (ex: "5511999999999")
  name: string | null;     // Nome do contato
  variables: {             // Variáveis para substituição no template
    nome?: string;         // Nome do contato
    telefone?: string;     // Telefone formatado
    data?: string;         // Data atual (DD/MM/YYYY)
    saudacao?: string;     // Saudação baseada na hora
    empresa?: string;      // Nome da empresa (se disponível)
    [key: string]: string; // Variáveis customizadas do CSV
  };
}
```

### Variáveis Padrão

| Variável | Fonte WUZAPI | Fonte CSV | Fallback |
|----------|--------------|-----------|----------|
| `nome` | FullName, PushName, FirstName, BusinessName | Coluna "nome" ou "name" | "" |
| `telefone` | JID (normalizado) | Coluna "phone" ou "telefone" | phone |
| `data` | Data atual | Data atual | Data atual |
| `saudacao` | Hora atual | Hora atual | "Olá" |
| `empresa` | BusinessName | Coluna "empresa" | undefined |

## Error Handling

### Cenários de Erro

1. **Contato sem variáveis necessárias**:
   - Mostrar alerta detalhado
   - Desabilitar botão de envio
   - Listar contatos e variáveis faltando

2. **Variável não encontrada no template**:
   - Manter placeholder original
   - Não bloquear envio (variável pode ser opcional)

3. **Erro ao importar contatos**:
   - Mostrar mensagem de erro clara
   - Permitir retry
   - Logar erro no backend

### Implementação

```typescript
// Validação antes de criar campanha
const handleCreateCampaign = async () => {
  // ... validações existentes ...

  // Validar variáveis com logging detalhado
  if (detectedVariables.length > 0) {
    console.log('[Campaign] Validating variables before send:', {
      detectedVariables,
      totalContacts: contacts.length,
      sampleContact: contacts[0]
    });
    
    const varValidation = contactImportService.validateContactVariables(contacts, detectedVariables);
    
    if (!varValidation.valid) {
      console.error('[Campaign] Variable validation failed:', varValidation);
      
      // Mostrar erro detalhado
      toast.error(/* ... mensagem detalhada ... */);
      return;
    }
    
    console.log('[Campaign] Variable validation passed');
  }

  // ... continuar com criação da campanha ...
};
```

## Testing Strategy

### 1. Testes Unitários

#### Backend - Mapeamento de Variáveis

```javascript
describe('mapWuzapiContactToVariables', () => {
  it('should map WUZAPI contact fields to variables', () => {
    const contact = {
      FullName: 'João Silva',
      PushName: 'João',
      BusinessName: 'Empresa XYZ'
    };
    const phone = '5511999999999';
    
    const variables = mapWuzapiContactToVariables(contact, phone);
    
    expect(variables.nome).toBe('João Silva');
    expect(variables.telefone).toBe('5511999999999');
    expect(variables.data).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(variables.saudacao).toMatch(/Bom dia|Boa tarde|Boa noite/);
    expect(variables.empresa).toBe('Empresa XYZ');
  });
  
  it('should generate greeting based on time', () => {
    // Mock time
    const mockDate = new Date('2024-01-01T10:00:00');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    
    const variables = mapWuzapiContactToVariables({}, '5511999999999');
    expect(variables.saudacao).toBe('Bom dia');
  });
});
```

#### Frontend - Validação de Variáveis

```typescript
describe('validateContactVariables', () => {
  it('should validate contacts with all required variables', () => {
    const contacts = [
      {
        phone: '5511999999999',
        name: 'João',
        variables: { nome: 'João', telefone: '5511999999999', data: '01/01/2024' }
      }
    ];
    const required = ['nome', 'telefone', 'data'];
    
    const result = contactImportService.validateContactVariables(contacts, required);
    
    expect(result.valid).toBe(true);
    expect(result.missingVariables).toHaveLength(0);
  });
  
  it('should detect missing variables', () => {
    const contacts = [
      {
        phone: '5511999999999',
        name: 'João',
        variables: { nome: 'João' }  // Faltam telefone e data
      }
    ];
    const required = ['nome', 'telefone', 'data'];
    
    const result = contactImportService.validateContactVariables(contacts, required);
    
    expect(result.valid).toBe(false);
    expect(result.missingVariables).toHaveLength(1);
    expect(result.missingVariables[0].missing).toEqual(['telefone', 'data']);
  });
});
```

### 2. Testes de Integração

#### Fluxo Completo: Importar WUZAPI → Validar → Enviar

```typescript
describe('Campaign with WUZAPI contacts', () => {
  it('should import contacts with variables and send campaign', async () => {
    // 1. Importar contatos
    const { contacts } = await contactImportService.importFromWuzapi(instance, token);
    
    // 2. Verificar que variáveis foram mapeadas
    expect(contacts[0].variables).toHaveProperty('nome');
    expect(contacts[0].variables).toHaveProperty('telefone');
    expect(contacts[0].variables).toHaveProperty('data');
    expect(contacts[0].variables).toHaveProperty('saudacao');
    
    // 3. Criar campanha com template
    const template = 'Olá {{nome}}, seu telefone é {{telefone}}';
    const config = {
      name: 'Test Campaign',
      messageContent: template,
      contacts
    };
    
    // 4. Validar variáveis
    const detectedVars = contactImportService.detectVariables(template);
    const validation = contactImportService.validateContactVariables(contacts, detectedVars);
    
    expect(validation.valid).toBe(true);
    
    // 5. Criar campanha
    const result = await bulkCampaignService.createCampaign(config, token);
    expect(result.campaignId).toBeDefined();
  });
});
```

## Implementation Plan

### Fase 1: Backend - Mapeamento de Variáveis (Prioridade Alta)
1. Criar função `mapWuzapiContactToVariables`
2. Atualizar rota `/import/wuzapi` para usar a função
3. Criar função `normalizeVariableName`
4. Atualizar parse de CSV para normalizar variáveis
5. Testar importação de contatos

### Fase 2: Frontend - Melhor Feedback (Prioridade Alta)
1. Adicionar logging em `validateContactVariables`
2. Melhorar mensagem de erro em `CampaignBuilder`
3. Adicionar alerta visual de validação
4. Testar fluxo completo de validação

### Fase 3: Testes (Prioridade Média)
1. Criar testes unitários para mapeamento
2. Criar testes unitários para validação
3. Criar testes de integração
4. Validar todos os cenários

### Fase 4: Documentação (Prioridade Baixa)
1. Atualizar documentação de API
2. Adicionar exemplos de uso
3. Documentar variáveis padrão

## Performance Considerations

- **Mapeamento de variáveis**: Operação O(1) por contato, sem impacto
- **Normalização de nomes**: Operação O(n) onde n é o tamanho do nome, desprezível
- **Validação**: Operação O(n*m) onde n é número de contatos e m é número de variáveis, aceitável para até 10k contatos

## Security Considerations

- **Sanitização**: Variáveis devem ser sanitizadas antes de uso em templates
- **Validação**: Nomes de variáveis devem ser validados (apenas alfanuméricos e underscore)
- **Limite**: Limitar número de variáveis customizadas por contato (máximo 50)
