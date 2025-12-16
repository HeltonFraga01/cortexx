# Implementation Plan

- [x] 1. Atualizar componentes de UI para usar branding dinâmico
  - Modificar componentes para importar e usar `useBrandingConfig()`
  - Substituir strings hardcoded por valores dinâmicos do branding
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 Atualizar AdminSettings.tsx
  - Importar `useBrandingConfig` hook
  - Substituir "WUZAPI Team" por `{brandingConfig.appName} Team` na linha 222
  - Testar renderização com diferentes valores de appName
  - _Requirements: 1.1, 1.5_

- [x] 1.2 Atualizar UserSettings.tsx
  - Importar `useBrandingConfig` hook
  - Substituir "Detalhes da sua instância WUZAPI" por `Detalhes da sua instância {brandingConfig.appName}` na linha 207
  - Substituir "API WUZAPI" por `API {brandingConfig.appName}` na linha 261
  - Testar renderização com diferentes valores de appName
  - _Requirements: 1.2, 1.5_

- [x] 1.3 Atualizar UserContacts.tsx
  - Importar `useBrandingConfig` hook no início do componente
  - Substituir "Organize e gerencie seus contatos da agenda WUZAPI" por `Organize e gerencie seus contatos da agenda {brandingConfig.appName}` na linha 279
  - Substituir "Importe contatos da agenda WUZAPI para começar" por `Importe contatos da agenda {brandingConfig.appName} para começar` na linha 370
  - Substituir "importar seus contatos da agenda WUZAPI" por `importar seus contatos da agenda {brandingConfig.appName}` na linha 383
  - Substituir "💡 Faça login para importar contatos da agenda WUZAPI" por `💡 Faça login para importar contatos da agenda {brandingConfig.appName}` na linha 389
  - Testar renderização com diferentes valores de appName
  - _Requirements: 1.1, 1.5_

- [ ]* 1.4 Atualizar comentários técnicos (Opcional)
  - Atualizar comentário em CreateUserForm.tsx linha 2
  - Atualizar comentários em UserContacts.tsx linha 6
  - Atualizar comentários em Index.tsx linhas 2-3
  - _Requirements: 1.1_

- [x] 1.5 Atualizar componentes do Disparador
  - Importar `useBrandingConfig` hook em DisparadorWrapper.tsx e ContactImporter.tsx
  - Substituir "Use o token de outra instância WUZAPI" por `Use o token de outra instância {brandingConfig.appName}` em DisparadorWrapper.tsx linha 83
  - Substituir "Agenda WUZAPI" por `Agenda {brandingConfig.appName}` em ContactImporter.tsx linha 5
  - Substituir "Agenda WUZAPI" por `Agenda {brandingConfig.appName}` em ContactImporter.tsx linha 340
  - Substituir "contatos importados da agenda WUZAPI" por `contatos importados da agenda {brandingConfig.appName}` em ContactImporter.tsx linha 103
  - Substituir "Importe contatos da agenda WUZAPI" por `Importe contatos da agenda {brandingConfig.appName}` em ContactImporter.tsx linha 325
  - Testar renderização com diferentes valores de appName
  - _Requirements: 1.1, 1.5_

- [x] 2. Atualizar template HTML padrão para suportar substituição dinâmica
  - Criar função para substituir placeholders no template
  - Modificar template para usar placeholders ao invés de strings hardcoded
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 2.1 Criar função getDefaultHomeHtml em defaultHomeHtml.ts
  - Implementar função `getDefaultHomeHtml(appName: string = 'WUZAPI'): string`
  - Função deve substituir placeholders `{{APP_NAME}}` e `{{APP_NAME_MANAGER}}`
  - Adicionar fallback para "WUZAPI" quando appName não é fornecido
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 2.2 Atualizar template HTML com placeholders
  - Substituir "WUZAPI" por `{{APP_NAME}}` no comentário da linha 12
  - Substituir "WUZAPI centraliza" por `{{APP_NAME}} centraliza` na linha 142
  - Substituir "© 2025 WUZAPI Manager" por `© 2025 {{APP_NAME_MANAGER}}` na linha 247
  - Exportar template como `DEFAULT_HOME_HTML_TEMPLATE`
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2.3 Atualizar locais que usam o template
  - Identificar componentes que importam `DEFAULT_HOME_HTML`
  - Atualizar para usar `getDefaultHomeHtml(brandingConfig.appName)`
  - Garantir que fallback funciona corretamente
  - _Requirements: 4.4_

- [x] 3. Atualizar testes para refletir comportamento dinâmico
  - Modificar mocks de teste para usar valores dinâmicos
  - Adicionar testes para verificar substituição correta
  - Garantir que todos os testes continuam passando
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3.1 Atualizar integration-utils.tsx
  - Manter mock com `appName: 'WUZAPI Manager'` para compatibilidade
  - Adicionar comentário explicando que é valor de teste
  - _Requirements: 5.1_

- [x] 3.2 Atualizar branding-integration.test.tsx
  - Revisar expectativas nas linhas 113, 436, 475
  - Atualizar para verificar valor do mock ao invés de string hardcoded
  - Adicionar testes para verificar comportamento dinâmico
  - _Requirements: 5.2, 5.3_

- [x] 3.3 Atualizar test-config.js e test-helpers.js
  - Manter `appName: 'Test WUZAPI'` como valor de teste
  - Adicionar comentários explicando valores de teste
  - Garantir consistência entre mocks
  - _Requirements: 5.1, 5.4_

- [ ]* 3.4 Adicionar testes para getDefaultHomeHtml
  - Testar substituição de placeholders com diferentes appNames
  - Testar fallback para "WUZAPI" quando appName não é fornecido
  - Testar que múltiplas ocorrências são substituídas
  - Testar que placeholders não aparecem no HTML final
  - _Requirements: 5.4_

- [x] 4. Atualizar meta tags HTML para compartilhamento de links
  - Adicionar meta tags base no index.html
  - Criar função para atualizar meta tags dinamicamente
  - Integrar atualização de meta tags com BrandingContext
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 4.1 Adicionar meta tags base no index.html
  - Adicionar meta tags Open Graph (og:title, og:site_name, og:description, og:type, og:url, og:image)
  - Adicionar meta tags Twitter Card (twitter:card, twitter:title, twitter:description, twitter:image)
  - Usar "WUZAPI Manager" como valor padrão em todas as meta tags
  - _Requirements: 5.6_

- [x] 4.2 Criar função updateMetaTag em utils
  - Criar arquivo `src/utils/metaTags.ts`
  - Implementar função `updateMetaTag(property: string, content: string)`
  - Função deve buscar meta tag existente ou criar nova
  - Suportar tanto `property` (Open Graph) quanto `name` (Twitter)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4.3 Integrar atualização de meta tags com BrandingContext
  - Adicionar useEffect em `src/App.tsx` ou `src/main.tsx`
  - Atualizar `document.title` com `${appName} Manager`
  - Atualizar meta tags Open Graph e Twitter Card
  - Atualizar descrição para incluir nome da aplicação
  - Garantir que fallback para "WUZAPI Manager" funciona
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5. Validar implementação e garantir compatibilidade
  - Testar em ambiente de desenvolvimento
  - Verificar todas as telas afetadas
  - Validar cenários de fallback
  - _Requirements: 1.5, 2.4, 4.4, 6.3_

- [x] 5.1 Testar fluxo completo de branding
  - Admin configura novo appName
  - Verificar que AdminSettings exibe novo nome
  - Verificar que UserSettings exibe novo nome
  - Verificar que landing page exibe novo nome
  - Verificar que meta tags são atualizadas
  - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.2 Testar cenários de fallback
  - Desabilitar branding temporariamente
  - Verificar que "WUZAPI" aparece como fallback
  - Verificar que meta tags mantêm "WUZAPI Manager"
  - Verificar que não há erros no console
  - Verificar que interface continua funcional
  - _Requirements: 1.5, 2.4, 5.6_

- [x] 5.3 Testar reset de branding
  - Resetar configurações para padrão
  - Verificar que "WUZAPI" é restaurado
  - Verificar que todas as telas refletem a mudança
  - Verificar que meta tags voltam para "WUZAPI Manager"
  - _Requirements: 2.2, 2.3, 5.6_

- [ ] 5.4 Testar compartilhamento de links
  - Compartilhar link do sistema em WhatsApp
  - Verificar que prévia mostra nome configurado
  - Compartilhar link em outras redes sociais (Facebook, Twitter, LinkedIn)
  - Verificar que todas as prévias mostram nome correto
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 5.5 Executar suite completa de testes
  - Executar `npm run test:run`
  - Verificar que todos os testes passam
  - Corrigir quaisquer testes quebrados
  - _Requirements: 6.3_

## Notas de Implementação

### Arquivos a NÃO Modificar
Os seguintes arquivos contêm referências técnicas a "WUZAPI" que devem permanecer inalteradas:
- `src/services/wuzapi.ts` - Tipos e interfaces da API
- `src/lib/api.ts` - Variáveis de configuração técnica
- `src/config/environment.ts` - Variáveis de ambiente
- `src/services/branding.ts` - Valores padrão (fallback)
- `src/types/branding.ts` - Valores padrão (fallback)

### Valores Padrão vs Valores Dinâmicos
- **Valores Padrão**: Devem usar "WUZAPI" como fallback (ex: `DEFAULT_BRANDING_CONFIG`)
- **Valores Dinâmicos**: Devem usar `brandingConfig.appName` (ex: componentes de UI)

### Padrão de Implementação
```typescript
// ✅ Correto - Usar hook de branding
const brandingConfig = useBrandingConfig();
<span>{brandingConfig.appName} Team</span>

// ❌ Incorreto - Hardcoded
<span>WUZAPI Team</span>

// ✅ Correto - Fallback em valores padrão
const DEFAULT_CONFIG = { appName: 'WUZAPI' };

// ❌ Incorreto - Sem fallback
const DEFAULT_CONFIG = { appName: brandingConfig.appName };
```

### Ordem de Execução Recomendada
1. Começar pelos componentes de UI (tarefas 1.x) - mudanças simples e diretas
2. Atualizar template HTML (tarefas 2.x) - requer mais cuidado com substituições
3. Atualizar testes (tarefas 3.x) - garantir que mudanças não quebram testes
4. Validar implementação (tarefas 4.x) - testar tudo junto

### Critérios de Sucesso
- ✅ Todas as referências de UI usam `brandingConfig.appName`
- ✅ Valores padrão mantêm "WUZAPI" como fallback
- ✅ Template HTML substitui placeholders corretamente
- ✅ Todos os testes passam
- ✅ Não há erros no console
- ✅ Interface funciona com e sem branding configurado
