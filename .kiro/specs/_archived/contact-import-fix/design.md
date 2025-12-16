# Design Document

## Overview

Este documento detalha as soluções técnicas para corrigir a importação de contatos da agenda WUZAPI na página de gerenciamento de contatos. A solução é baseada no padrão já implementado e funcional no DisparadorForm, garantindo consistência e reutilização de código testado.

## Architecture

### Componentes Envolvidos

```
Frontend:
├── src/pages/UserContacts.tsx                    # Página principal
├── src/components/contacts/ContactImportButton.tsx  # Botão de importação
├── src/services/contactImportService.ts          # Serviço de importação
├── src/hooks/useContacts.ts                      # Hook de gerenciamento
└── src/services/contactsStorageService.ts        # Armazenamento local

Backend:
└── server/routes/contactImportRoutes.js          # Rota de importação
```

### Fluxo de Importação

```
1. Usuário clica em "Importar da Agenda"
   ↓
2. ContactImportButton chama contactImportService.importFromWuzapi()
   ↓
3. Service faz GET /api/user/contacts/import/wuzapi?instance=X
   ↓
4. Backend faz proxy para WUZAPI /user/contacts
   ↓
5. Backend normaliza e valida números
   ↓
6. Backend retorna contatos válidos
   ↓
7. Service salva no localStorage via contactsStorageService
   ↓
8. Hook useContacts atualiza estado
   ↓
9. Tabela é atualizada automaticamente
   ↓
10. Toast de sucesso é exibido
```

## Components and Interfaces

### 1. ContactImportButton - Correções

**Problema Atual**: O botão existe mas a importação não funciona corretamente.

**Solução**: Seguir o padrão do DisparadorForm que funciona.

#### Comparação: Disparador vs Contatos

**DisparadorForm (funciona)**:
```tsx
// Importação via lib/api.ts
import { parseCsvContacts } from "@/lib/api";

const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const csvContent = event.target?.result as string;
    try {
      const parsedContacts = parseCsvContacts(csvContent);
      if (parsedContacts.length > 0) {
        setContacts(parsedContacts);
        toast.success("Contatos importados", {
          description: `${parsedContacts.length} contatos carregados com sucesso`,
        });
      }
    } catch (error) {
      toast.error("Erro ao processar arquivo");
    }
  };
  reader.readAsText(file);
};
```

**ContactImportButton (atual)**:
```tsx
// Usa contactImportService
const result = await contactImportService.importFromWuzapi(instance, userToken);
```

**Problema Identificado**: 
- O DisparadorForm importa de CSV (funciona)
- O ContactImportButton tenta importar do WUZAPI (não funciona)
- Ambos deveriam usar a mesma API do WUZAPI

#### Solução: Verificar e Corrigir a Chamada da API

**Arquivo**: `src/services/contactImportService.ts`

```typescript
// Método atual (linha 73-91)
async importFromWuzapi(instance: string, userToken: string): Promise<{
  contacts: Contact[];
  total: number;
  lidCount?: number;
  warning?: string;
}> {
  const response = await this.api.get<{
    contacts: Contact[];
    total: number;
    lidCount?: number;
    warning?: string;
  }>(
    `${this.baseUrl}/import/wuzapi`,  // /user/contacts/import/wuzapi
    {
      params: { instance },
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );

  return response.data;
}
```

**Verificações Necessárias**:
1. ✅ Endpoint correto: `/api/user/contacts/import/wuzapi`
2. ✅ Parâmetro `instance` sendo passado
3. ✅ Header `Authorization` com token
4. ❓ Backend está registrando a rota corretamente?
5. ❓ Token está sendo passado corretamente do componente?

### 2. Backend Route - Verificação e Correção

**Arquivo**: `server/routes/contactImportRoutes.js`

**Rota Atual** (linha 118):
```javascript
router.get('/import/wuzapi', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { instance } = req.query;

    // Buscar contatos via WUZAPI
    const response = await axios.get(
      `${wuzapiBaseUrl}/user/contacts`,
      {
        headers: {
          'Token': userToken  // ⚠️ Verificar se é 'Token' ou 'Authorization'
        },
        timeout: 30000
      }
    );
    
    // ... processar contatos
  }
});
```

**Problema Potencial**: Header pode estar incorreto.

**Verificação no Disparador**:
```javascript
// Como o disparador faz a chamada?
// Verificar em lib/api.ts ou wuzapi-client.ts
```

**Solução**: Garantir que o header seja consistente com o que funciona no disparador.

### 3. useContacts Hook - Integração

**Arquivo**: `src/hooks/useContacts.ts`

**Método Atual**:
```typescript
const importContacts = async (instance: string, userToken: string) => {
  try {
    const result = await contactImportService.importFromWuzapi(instance, userToken);
    
    // Salvar no storage
    const saved = contactsStorageService.saveContacts(result.contacts);
    
    // Atualizar estado
    setContacts(saved);
    
    return result;
  } catch (error) {
    throw error;
  }
};
```

**Problema**: Pode não estar mesclando com contatos existentes.

**Solução**: Implementar merge inteligente.

```typescript
const importContacts = async (instance: string, userToken: string) => {
  try {
    setLoading(true);
    
    const result = await contactImportService.importFromWuzapi(instance, userToken);
    
    // Mesclar com contatos existentes
    const existingContacts = contactsStorageService.loadContacts();
    const mergedContacts = mergeContacts(existingContacts, result.contacts);
    
    // Salvar no storage
    contactsStorageService.saveContacts(mergedContacts);
    
    // Atualizar estado
    setContacts(mergedContacts);
    
    return {
      ...result,
      total: mergedContacts.length
    };
  } catch (error) {
    console.error('Erro ao importar contatos:', error);
    throw error;
  } finally {
    setLoading(false);
  }
};

// Função auxiliar para mesclar contatos
function mergeContacts(existing: Contact[], imported: Contact[]): Contact[] {
  const contactMap = new Map<string, Contact>();
  
  // Adicionar contatos existentes
  existing.forEach(contact => {
    contactMap.set(contact.phone, contact);
  });
  
  // Mesclar/adicionar contatos importados
  imported.forEach(contact => {
    const existingContact = contactMap.get(contact.phone);
    
    if (existingContact) {
      // Mesclar: manter tags/grupos existentes, atualizar nome se vazio
      contactMap.set(contact.phone, {
        ...existingContact,
        name: existingContact.name || contact.name,
        variables: {
          ...existingContact.variables,
          ...contact.variables
        }
      });
    } else {
      // Adicionar novo contato
      contactMap.set(contact.phone, contact);
    }
  });
  
  return Array.from(contactMap.values());
}
```

### 4. ContactsStorageService - Melhorias

**Arquivo**: `src/services/contactsStorageService.ts`

**Métodos Necessários**:

```typescript
class ContactsStorageService {
  private STORAGE_KEY = 'wuzapi_contacts';
  private METADATA_KEY = 'wuzapi_contacts_metadata';

  // Salvar contatos com metadados
  saveContacts(contacts: Contact[], instance?: string): Contact[] {
    try {
      const data = {
        contacts,
        instance,
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      
      // Salvar metadados separadamente
      this.updateMetadata({
        totalContacts: contacts.length,
        lastImport: new Date().toISOString(),
        instance
      });
      
      return contacts;
    } catch (error) {
      console.error('Erro ao salvar contatos:', error);
      throw new Error('Falha ao salvar contatos no armazenamento local');
    }
  }

  // Carregar contatos
  loadContacts(): Contact[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      
      if (!stored) {
        return [];
      }
      
      const data = JSON.parse(stored);
      return data.contacts || [];
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      return [];
    }
  }

  // Mesclar contatos sem duplicar
  mergeContacts(existing: Contact[], imported: Contact[]): Contact[] {
    const contactMap = new Map<string, Contact>();
    
    // Adicionar existentes
    existing.forEach(contact => {
      contactMap.set(contact.phone, contact);
    });
    
    // Mesclar importados
    imported.forEach(contact => {
      const existingContact = contactMap.get(contact.phone);
      
      if (existingContact) {
        // Manter dados existentes, atualizar apenas se vazio
        contactMap.set(contact.phone, {
          ...existingContact,
          name: existingContact.name || contact.name,
          variables: {
            ...existingContact.variables,
            ...contact.variables
          }
        });
      } else {
        contactMap.set(contact.phone, contact);
      }
    });
    
    return Array.from(contactMap.values());
  }

  // Atualizar metadados
  private updateMetadata(metadata: any): void {
    try {
      const existing = this.getMetadata();
      const updated = { ...existing, ...metadata };
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Erro ao atualizar metadados:', error);
    }
  }

  // Obter metadados
  getMetadata(): any {
    try {
      const stored = localStorage.getItem(this.METADATA_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  // Limpar contatos
  clearContacts(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.METADATA_KEY);
  }
}
```

### 5. Tratamento de Erros

**Padrão de Erro Handling**:

```typescript
// No ContactImportButton
const handleImport = async (isRetry: boolean = false) => {
  try {
    setLoading(true);
    setError(null);

    const result = await contactImportService.importFromWuzapi(instance, userToken);

    toast.success(`${result.total} contatos importados`, {
      description: result.warning || undefined,
    });

    if (onImportComplete) {
      onImportComplete(result.contacts, result.total);
    }
  } catch (err: any) {
    const errorMessage = getErrorMessage(err);
    setError(errorMessage);
    
    // Retry automático
    if (retryCount < maxRetries && !isRetry) {
      setRetryCount(prev => prev + 1);
      setTimeout(() => handleImport(true), 2000);
    } else {
      toast.error('Erro ao importar contatos', {
        description: errorMessage,
        action: {
          label: 'Tentar Novamente',
          onClick: () => handleRetry(),
        }
      });
    }
  } finally {
    setLoading(false);
  }
};

// Função auxiliar para extrair mensagem de erro
function getErrorMessage(error: any): string {
  if (error.response?.status === 401) {
    return 'Token WUZAPI inválido. Verifique suas credenciais.';
  }
  
  if (error.response?.status === 404) {
    return 'Instância não encontrada ou não conectada.';
  }
  
  if (error.response?.status === 408 || error.code === 'ECONNABORTED') {
    return 'Tempo limite excedido. Tente novamente.';
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'Erro desconhecido ao importar contatos';
}
```

## Data Models

### Contact Interface

```typescript
interface Contact {
  phone: string;              // Número normalizado (ex: 5511999999999)
  name?: string | null;       // Nome do contato
  variables: Record<string, string>;  // Variáveis customizadas
}
```

### Import Result

```typescript
interface ImportResult {
  contacts: Contact[];
  total: number;
  lidCount?: number;          // Contatos com @lid (grupos)
  warning?: string;           // Avisos sobre a importação
}
```

### Storage Data

```typescript
interface StorageData {
  contacts: Contact[];
  instance?: string;
  lastUpdated: string;        // ISO date string
  version: string;            // Versão do formato
}

interface StorageMetadata {
  totalContacts: number;
  lastImport: string;         // ISO date string
  instance?: string;
}
```

## Error Handling

### Tipos de Erro

1. **401 Unauthorized**: Token inválido
   - Mensagem: "Token WUZAPI inválido. Verifique suas credenciais."
   - Ação: Solicitar reautenticação

2. **404 Not Found**: Instância não encontrada
   - Mensagem: "Instância não encontrada ou não conectada."
   - Ação: Verificar seleção de instância

3. **408 Timeout**: Tempo limite excedido
   - Mensagem: "Tempo limite excedido. Tente novamente."
   - Ação: Retry automático

4. **500 Internal Server Error**: Erro no servidor
   - Mensagem: "Erro no servidor. Tente novamente mais tarde."
   - Ação: Retry manual

5. **Network Error**: Erro de rede
   - Mensagem: "Erro de conexão. Verifique sua internet."
   - Ação: Retry manual

### Retry Strategy

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 segundos

let retryCount = 0;

const handleImportWithRetry = async () => {
  try {
    return await importContacts();
  } catch (error) {
    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      retryCount++;
      await delay(RETRY_DELAY);
      return handleImportWithRetry();
    }
    throw error;
  }
};

function isRetryableError(error: any): boolean {
  return (
    error.response?.status === 408 ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.message?.includes('timeout')
  );
}
```

## Testing Strategy

### Testes Manuais

**Cenários de Teste**:

1. **Importação Bem-Sucedida**:
   - [ ] Selecionar instância conectada
   - [ ] Clicar em "Importar da Agenda"
   - [ ] Verificar loading indicator
   - [ ] Verificar toast de sucesso com número de contatos
   - [ ] Verificar contatos na tabela
   - [ ] Verificar contatos salvos no localStorage

2. **Importação com Contatos Existentes**:
   - [ ] Importar contatos pela primeira vez
   - [ ] Adicionar tags a alguns contatos
   - [ ] Importar novamente
   - [ ] Verificar que tags foram mantidas
   - [ ] Verificar que não há duplicatas

3. **Erro de Token Inválido**:
   - [ ] Usar token inválido
   - [ ] Verificar mensagem de erro 401
   - [ ] Verificar opção de tentar novamente

4. **Erro de Instância Não Conectada**:
   - [ ] Selecionar instância desconectada
   - [ ] Verificar mensagem de erro 404
   - [ ] Verificar sugestão de verificar instância

5. **Erro de Timeout**:
   - [ ] Simular timeout (desconectar internet temporariamente)
   - [ ] Verificar retry automático
   - [ ] Verificar mensagem de erro após 3 tentativas

6. **Múltiplas Instâncias**:
   - [ ] Importar contatos da instância A
   - [ ] Trocar para instância B
   - [ ] Importar contatos da instância B
   - [ ] Verificar que contatos são separados por instância

### Testes Automatizados

**Unit Tests** (Vitest):

```typescript
// src/services/contactImportService.test.ts
describe('ContactImportService', () => {
  it('should import contacts from WUZAPI', async () => {
    const result = await contactImportService.importFromWuzapi('instance', 'token');
    expect(result.contacts).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should handle 401 error', async () => {
    await expect(
      contactImportService.importFromWuzapi('instance', 'invalid-token')
    ).rejects.toThrow('Token WUZAPI inválido');
  });
});

// src/services/contactsStorageService.test.ts
describe('ContactsStorageService', () => {
  it('should save and load contacts', () => {
    const contacts = [{ phone: '5511999999999', name: 'Test', variables: {} }];
    contactsStorageService.saveContacts(contacts);
    const loaded = contactsStorageService.loadContacts();
    expect(loaded).toEqual(contacts);
  });

  it('should merge contacts without duplicates', () => {
    const existing = [{ phone: '5511999999999', name: 'Test 1', variables: {} }];
    const imported = [
      { phone: '5511999999999', name: 'Test 2', variables: {} },
      { phone: '5511888888888', name: 'Test 3', variables: {} }
    ];
    const merged = contactsStorageService.mergeContacts(existing, imported);
    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe('Test 1'); // Mantém nome existente
  });
});
```

**Integration Tests** (Cypress):

```typescript
// cypress/e2e/contact-import.cy.ts
describe('Contact Import', () => {
  beforeEach(() => {
    cy.login('user');
    cy.visit('/user/contacts');
  });

  it('should import contacts successfully', () => {
    cy.intercept('GET', '/api/user/contacts/import/wuzapi*', {
      statusCode: 200,
      body: {
        success: true,
        contacts: [
          { phone: '5511999999999', name: 'Test Contact', variables: {} }
        ],
        total: 1
      }
    }).as('importContacts');

    cy.contains('Importar da Agenda').click();
    cy.wait('@importContacts');
    cy.contains('1 contato importado').should('be.visible');
    cy.contains('Test Contact').should('be.visible');
  });

  it('should handle import error', () => {
    cy.intercept('GET', '/api/user/contacts/import/wuzapi*', {
      statusCode: 401,
      body: { error: 'Token inválido' }
    }).as('importError');

    cy.contains('Importar da Agenda').click();
    cy.wait('@importError');
    cy.contains('Token WUZAPI inválido').should('be.visible');
  });
});
```

## Implementation Notes

### Ordem de Implementação

1. **Verificar Backend Route** (mais provável causa do problema)
   - Verificar se rota está registrada corretamente
   - Verificar header do token
   - Testar endpoint diretamente com Postman/curl

2. **Corrigir ContactImportService**
   - Garantir que está chamando endpoint correto
   - Adicionar logs para debug
   - Implementar tratamento de erros robusto

3. **Melhorar ContactsStorageService**
   - Implementar merge inteligente
   - Adicionar metadados
   - Implementar limpeza de dados antigos

4. **Atualizar useContacts Hook**
   - Integrar merge de contatos
   - Atualizar estado corretamente
   - Adicionar loading states

5. **Melhorar ContactImportButton**
   - Adicionar retry automático
   - Melhorar feedback visual
   - Adicionar tratamento de erros específicos

### Debug Checklist

Para identificar o problema atual:

- [ ] Verificar se rota está registrada: `console.log` em `server/routes/index.js`
- [ ] Verificar se token está sendo passado: `console.log` no `ContactImportButton`
- [ ] Verificar se backend está recebendo requisição: `logger.info` na rota
- [ ] Verificar resposta do WUZAPI: `console.log` da resposta do axios
- [ ] Verificar se contatos estão sendo salvos: `console.log` no storage service
- [ ] Verificar se estado está sendo atualizado: React DevTools

### Compatibilidade

**Browsers suportados**:
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+

**Features utilizadas**:
- localStorage API
- Fetch API / Axios
- Async/await
- ES6+ features

### Performance

**Otimizações**:
- Debounce de importação (prevenir múltiplos cliques)
- Lazy loading de contatos (virtualização já implementada)
- Memoization de contatos filtrados (já implementado)
- Batch updates no localStorage

**Limites**:
- Máximo de 10.000 contatos no localStorage (~5MB)
- Timeout de 30 segundos para importação
- Máximo de 3 tentativas de retry
