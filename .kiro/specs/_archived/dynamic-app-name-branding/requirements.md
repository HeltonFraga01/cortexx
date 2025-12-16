# Requirements Document

## Introduction

Este documento define os requisitos para substituir todas as referências hardcoded ao nome "WUZAPI" por valores dinâmicos baseados na configuração de branding do administrador. O sistema deve usar o "Nome da Aplicação" configurado no painel admin em todos os lugares onde atualmente aparece "WUZAPI" hardcoded.

## Glossary

- **Sistema**: O WUZAPI Manager
- **Branding Context**: Contexto React que fornece configurações de personalização
- **Nome da Aplicação**: Valor configurável pelo admin em Configurações > Branding
- **Referência Hardcoded**: Texto "WUZAPI" fixo no código que não muda dinamicamente
- **Fallback**: Valor padrão usado quando a configuração de branding não está disponível

## Requirements

### Requirement 1: Substituir Referências Hardcoded em Componentes de UI

**User Story:** Como administrador, eu quero que o nome da minha aplicação configurado no branding apareça em todas as telas, para que a interface reflita minha marca personalizada

#### Acceptance Criteria

1. WHEN o Sistema renderiza a página "Sobre o Sistema", THE Sistema SHALL exibir o Nome da Aplicação configurado no branding ao invés de "WUZAPI"
2. WHEN o Sistema renderiza a página de Configurações do Usuário, THE Sistema SHALL exibir o Nome da Aplicação na seção "Informações da Conta"
3. WHEN o Sistema renderiza a página de Configurações do Admin, THE Sistema SHALL exibir o Nome da Aplicação na seção "Sobre o Sistema"
4. WHEN o Sistema renderiza o template HTML da landing page, THE Sistema SHALL usar o Nome da Aplicação configurado
5. WHERE o branding não está carregado, THE Sistema SHALL usar "WUZAPI" como fallback

### Requirement 2: Atualizar Valores Padrão de Branding

**User Story:** Como desenvolvedor, eu quero que os valores padrão de branding usem "WUZAPI" apenas como fallback, para que o sistema seja consistente

#### Acceptance Criteria

1. WHEN o Sistema inicializa o BrandingContext sem configuração salva, THE Sistema SHALL usar "WUZAPI" como appName padrão
2. WHEN o Sistema reseta as configurações de branding para padrão, THE Sistema SHALL definir appName como "WUZAPI"
3. WHEN o Sistema cria um novo registro de branding no banco, THE Sistema SHALL usar "WUZAPI" como valor inicial de app_name
4. WHERE o usuário não configurou branding, THE Sistema SHALL exibir "WUZAPI" em todas as interfaces

### Requirement 3: Manter Referências Técnicas Inalteradas

**User Story:** Como desenvolvedor, eu quero que referências técnicas a "WUZAPI" (como nomes de variáveis, tipos, e URLs de API) permaneçam inalteradas, para que o código continue funcionando corretamente

#### Acceptance Criteria

1. THE Sistema SHALL manter o nome "WuzAPIClient" para a classe de cliente da API
2. THE Sistema SHALL manter "WUZAPI_BASE_URL" como nome da variável de ambiente
3. THE Sistema SHALL manter "wuzapi" em nomes de arquivos e módulos
4. THE Sistema SHALL manter comentários técnicos que referenciam "WUZAPI"
5. THE Sistema SHALL manter tipos TypeScript como "WuzAPIUser" inalterados

### Requirement 4: Atualizar Template HTML Padrão

**User Story:** Como administrador, eu quero que o template HTML da landing page use o nome da minha aplicação, para que visitantes vejam minha marca

#### Acceptance Criteria

1. WHEN o Sistema renderiza a landing page customizada, THE Sistema SHALL substituir "WUZAPI" pelo Nome da Aplicação no título
2. WHEN o Sistema renderiza a landing page customizada, THE Sistema SHALL substituir "WUZAPI Manager" pelo Nome da Aplicação + " Manager" no rodapé
3. WHEN o Sistema renderiza a landing page customizada, THE Sistema SHALL substituir "WUZAPI" nas descrições de funcionalidades
4. WHERE o admin não customizou o HTML, THE Sistema SHALL usar o template padrão com o Nome da Aplicação configurado

### Requirement 5: Atualizar Meta Tags para Compartilhamento de Links

**User Story:** Como administrador, eu quero que quando alguém compartilhar o link do sistema, apareça o nome da minha aplicação na prévia, para que minha marca seja visível em redes sociais e mensageiros

#### Acceptance Criteria

1. WHEN o Sistema carrega a configuração de branding, THE Sistema SHALL atualizar a meta tag `<title>` com o Nome da Aplicação + " Manager"
2. WHEN o Sistema carrega a configuração de branding, THE Sistema SHALL atualizar a meta tag `og:title` com o Nome da Aplicação + " Manager"
3. WHEN o Sistema carrega a configuração de branding, THE Sistema SHALL atualizar a meta tag `og:site_name` com o Nome da Aplicação + " Manager"
4. WHEN o Sistema carrega a configuração de branding, THE Sistema SHALL atualizar a meta tag `twitter:title` com o Nome da Aplicação + " Manager"
5. WHEN o Sistema carrega a configuração de branding, THE Sistema SHALL atualizar as meta tags de descrição para incluir o Nome da Aplicação
6. WHERE o branding não está carregado, THE Sistema SHALL manter "WUZAPI Manager" nas meta tags como fallback

### Requirement 6: Garantir Compatibilidade com Testes

**User Story:** Como desenvolvedor, eu quero que os testes continuem funcionando após as mudanças, para que a qualidade do código seja mantida

#### Acceptance Criteria

1. WHEN os testes de integração executam, THE Sistema SHALL usar "Test WUZAPI" ou "WUZAPI Manager" como appName nos mocks
2. WHEN os testes verificam branding, THE Sistema SHALL validar que o Nome da Aplicação é exibido corretamente
3. THE Sistema SHALL manter todos os testes existentes passando após as mudanças
4. WHERE novos testes são necessários, THE Sistema SHALL criar testes para validar o comportamento dinâmico do Nome da Aplicação

## Locais Identificados para Mudança

### Componentes de UI (Usar BrandingContext)

#### Já Implementados (Verificar se ainda estão corretos)
1. `src/components/admin/AdminSettings.tsx` - Linha 222: "WUZAPI Team" ✅
2. `src/components/user/UserSettings.tsx` - Linha 207: "Detalhes da sua instância WUZAPI" ✅
3. `src/components/user/UserSettings.tsx` - Linha 261: "Use este token para autenticar suas requisições à API WUZAPI" ✅

#### Novos Locais Identificados (Atualizados ✅)
4. `src/components/shared/forms/CreateUserForm.tsx` - Linha 2: Comentário "Componente avançado para criar usuários WuzAPI"
5. `src/components/shared/forms/CreateUserForm.tsx` - Linha 268: "Configure uma nova instância {brandingConfig.appName} com configurações avançadas" (JÁ USA BRANDING ✅)
6. `src/pages/UserContacts.tsx` - Linha 6: Comentário "da agenda WUZAPI para envio de mensagens"
7. `src/pages/UserContacts.tsx` - Linha 279: "Organize e gerencie seus contatos da agenda WUZAPI" ✅
8. `src/pages/UserContacts.tsx` - Linha 370: "Importe contatos da agenda WUZAPI para começar" ✅
9. `src/pages/UserContacts.tsx` - Linha 383: "Clique no botão abaixo para importar seus contatos da agenda WUZAPI" ✅
10. `src/pages/UserContacts.tsx` - Linha 389: "💡 Faça login para importar contatos da agenda WUZAPI" ✅
11. `src/pages/Index.tsx` - Linha 2: Comentário "Index Page - WuzAPI Dashboard"
12. `src/pages/Index.tsx` - Linha 3: Comentário "Página principal que renderiza o dashboard WuzAPI"
13. `src/components/disparador/DisparadorWrapper.tsx` - Linha 83: "Use o token de outra instância WUZAPI" ✅
14. `src/components/disparador/ContactImporter.tsx` - Linha 5: Comentário "Agenda WUZAPI" ✅
15. `src/components/disparador/ContactImporter.tsx` - Linha 103: "contatos importados da agenda WUZAPI" ✅
16. `src/components/disparador/ContactImporter.tsx` - Linha 325: "Importe contatos da agenda WUZAPI" ✅
17. `src/components/disparador/ContactImporter.tsx` - Linha 340: "Agenda WUZAPI" ✅

### Valores Padrão de Branding (Manter como Fallback)
13. `src/services/branding.ts` - Linhas 72, 345: `appName: 'WUZAPI'` ✅
14. `src/components/admin/BrandingSettings.tsx` - Linha 213: `appName: 'WUZAPI'` ✅
15. `src/types/branding.ts` - Linha 40: `appName: import.meta.env.VITE_APP_NAME || 'WUZAPI'` ✅

### Template HTML (Substituir Dinamicamente)
16. `src/constants/defaultHomeHtml.ts` - Linhas 12, 142, 247: Referências a "WUZAPI" no template ✅

### Meta Tags HTML (Atualizar Dinamicamente)
21. `index.html` - Linha 7: `<title>WUZAPI Manager</title>` - Adicionar meta tags Open Graph e Twitter Card
22. Criar `src/utils/metaTags.ts` - Nova função para atualizar meta tags dinamicamente
23. `src/App.tsx` ou `src/main.tsx` - Adicionar useEffect para atualizar meta tags quando branding carrega

### Testes (Atualizar Mocks)
17. `src/test/integration-utils.tsx` - Linha 79: `appName: 'WUZAPI Manager'` ✅
18. `src/test/branding-integration.test.tsx` - Linhas 113, 436, 475: Verificações de "WUZAPI Manager" ✅
19. `src/test/templates/test-config.js` - Linha 46: `appName: 'Test WUZAPI'` ✅
20. `src/test/templates/test-helpers.js` - Linhas 158, 184: `appName: 'Test WUZAPI'` e `appName: 'WUZAPI'` ✅

### Referências Técnicas (NÃO ALTERAR)
- `src/services/wuzapi.ts` - Tipos e interfaces (WuzAPIUser, WuzAPIService, etc.)
- `src/services/mock-api.ts` - Tipos e interfaces técnicas
- `src/lib/wuzapi-types.ts` - Tipos TypeScript (WuzAPIResponse, WuzAPIInstance, etc.)
- `src/lib/wuzapi-client.ts` - Cliente técnico
- `src/contexts/WuzAPIAuthContext.tsx` - Nomes de contextos e tipos técnicos
- `src/contexts/WuzAPIInstancesContext.tsx` - Nomes de contextos e tipos técnicos
- `src/components/wuzapi/` - Nomes de componentes e arquivos
- `src/lib/api.ts` - Variáveis de configuração
- `src/config/environment.ts` - Variáveis de ambiente
- Nomes de arquivos e módulos
- Comentários técnicos sobre a API
- localStorage keys (ex: 'wuzapi_user', 'wuzapi_config', 'wuzapi_contacts')

## Critérios de Aceitação Globais

1. Todas as referências de UI a "WUZAPI" devem usar o Nome da Aplicação do branding
2. Valores padrão devem usar "WUZAPI" como fallback
3. Referências técnicas (tipos, variáveis, URLs) devem permanecer inalteradas
4. Todos os testes devem continuar passando
5. A funcionalidade de branding deve continuar funcionando normalmente
