# Implementation Plan - Custom HOME Page Editor

- [x] 1. Preparar infraestrutura de banco de dados
  - Adicionar coluna `custom_home_html` na tabela `branding_config`
  - Criar migration script para atualizar schema existente
  - Atualizar método `createBrandingConfigTable()` para incluir novo campo
  - _Requirements: 1.1, 1.4_

- [x] 2. Implementar sanitização de HTML no backend
  - [x] 2.1 Criar serviço de sanitização HTML
    - Instalar dependências `dompurify` e `jsdom`
    - Criar arquivo `server/utils/htmlSanitizer.js`
    - Implementar classe `HtmlSanitizer` com configuração de tags permitidas
    - Implementar método `sanitize()` para limpar HTML
    - Implementar método `validate()` para detectar padrões perigosos
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.2 Integrar sanitização nas rotas de branding
    - Importar `htmlSanitizer` em `server/routes/brandingRoutes.js`
    - Adicionar validação de HTML antes de salvar no PUT route
    - Retornar erros específicos quando conteúdo perigoso for detectado
    - _Requirements: 5.1, 5.4_

- [x] 3. Estender métodos de banco de dados
  - [x] 3.1 Atualizar método `getBrandingConfig()`
    - Adicionar `custom_home_html` no SELECT query
    - Incluir `customHomeHtml` no objeto de retorno
    - _Requirements: 1.1_

  - [x] 3.2 Atualizar método `updateBrandingConfig()`
    - Adicionar `custom_home_html` no UPDATE query
    - Incluir parâmetro `customHomeHtml` nos values
    - _Requirements: 1.4_

  - [x] 3.3 Estender método `validateBrandingData()`
    - Adicionar validação de tipo para `customHomeHtml`
    - Validar tamanho máximo (100KB)
    - Retornar `customHomeHtml` validado
    - _Requirements: 1.4, 5.1_

- [x] 4. Atualizar tipos TypeScript no frontend
  - Estender interface `BrandingConfig` com campo `customHomeHtml`
  - Estender interface `BrandingConfigUpdate` com campo opcional `customHomeHtml`
  - Atualizar arquivo `src/types/branding.ts`
  - _Requirements: 1.1, 1.4_

- [x] 5. Estender serviço de branding no frontend
  - Atualizar método `validateBrandingConfig()` em `src/services/branding.ts`
  - Adicionar validação de tamanho para HTML customizado
  - Adicionar detecção de padrões perigosos
  - Incluir erros e warnings específicos para HTML
  - _Requirements: 5.1, 5.4_

- [x] 6. Criar componente de editor de HTML customizado
  - [x] 6.1 Criar componente `CustomHomeHtmlEditor`
    - Criar arquivo `src/components/admin/CustomHomeHtmlEditor.tsx`
    - Implementar textarea com syntax highlighting (opcional)
    - Adicionar botões de Preview e Reset
    - Implementar contador de caracteres
    - Adicionar alert informativo sobre variáveis CSS
    - _Requirements: 1.1, 2.1, 3.1, 4.1_

  - [x] 6.2 Criar template HTML padrão
    - Definir constante `DEFAULT_HOME_HTML` com estrutura básica
    - Incluir exemplos de uso de variáveis CSS
    - Adicionar comentários explicativos no template
    - _Requirements: 3.1, 4.1_

- [x] 7. Criar componente de preview de HTML
  - Criar arquivo `src/components/admin/HtmlPreviewModal.tsx`
  - Implementar Dialog/Modal com iframe sandboxed
  - Injetar CSS com variáveis de branding no iframe
  - Renderizar HTML sanitizado dentro do iframe
  - Adicionar botão de fechar modal
  - _Requirements: 2.1, 2.2, 2.3, 4.1_

- [x] 8. Integrar editor no componente BrandingSettings
  - [x] 8.1 Adicionar estado para HTML customizado
    - Criar state `customHomeHtml` em `BrandingSettings`
    - Criar state `showPreview` para controlar modal
    - Sincronizar com `config.customHomeHtml` no useEffect
    - _Requirements: 1.1, 2.1_

  - [x] 8.2 Adicionar seção de HTML customizado
    - Importar `CustomHomeHtmlEditor` component
    - Adicionar Separator antes da nova seção
    - Renderizar editor com props apropriadas
    - Implementar handler `handleResetHtml` com confirmação
    - _Requirements: 1.1, 3.1, 3.2, 3.3_

  - [x] 8.3 Integrar modal de preview
    - Importar `HtmlPreviewModal` component
    - Renderizar modal com estado `showPreview`
    - Passar HTML e branding config como props
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 8.4 Atualizar lógica de salvamento
    - Incluir `customHomeHtml` no objeto de updates
    - Validar HTML antes de enviar ao backend
    - Exibir erros de validação específicos
    - _Requirements: 1.4, 5.1_

- [x] 9. Implementar renderização no UserOverview
  - [x] 9.1 Adicionar lógica de renderização customizada
    - Criar state para armazenar HTML customizado
    - Buscar `customHomeHtml` do branding config
    - Aplicar variáveis CSS inline no container
    - _Requirements: 1.5, 4.2, 4.3_

  - [x] 9.2 Implementar fallback para conteúdo padrão
    - Verificar se `customHomeHtml` existe
    - Renderizar HTML customizado com `dangerouslySetInnerHTML`
    - Mostrar conteúdo padrão se HTML não existir
    - _Requirements: 1.5_

  - [x] 9.3 Otimizar performance de carregamento
    - Implementar cache do HTML customizado
    - Adicionar lazy loading para imagens
    - Medir tempo de renderização
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 10. Adicionar validação e tratamento de erros
  - [x] 10.1 Implementar validação no frontend
    - Validar tamanho do HTML antes de salvar
    - Detectar padrões perigosos no cliente
    - Exibir mensagens de erro inline
    - Prevenir submissão com erros
    - _Requirements: 5.1, 5.4_

  - [x] 10.2 Implementar tratamento de erros de rede
    - Adicionar try-catch em chamadas de API
    - Exibir toast notifications para erros
    - Preservar input do usuário em caso de erro
    - Implementar retry mechanism
    - _Requirements: 1.4_

- [ ]* 11. Criar testes automatizados
  - [ ]* 11.1 Testes unitários do backend
    - Criar `server/tests/htmlSanitizer.test.js`
    - Testar sanitização de tags perigosas
    - Testar validação de padrões perigosos
    - Testar limites de tamanho
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ]* 11.2 Testes de integração do backend
    - Adicionar testes em `server/tests/branding.test.js`
    - Testar GET com campo `custom_home_html`
    - Testar PUT com HTML válido
    - Testar PUT com HTML perigoso (deve falhar)
    - Testar PUT com HTML muito grande (deve falhar)
    - _Requirements: 1.1, 1.4, 5.1_

  - [ ]* 11.3 Testes unitários do frontend
    - Criar `src/components/admin/__tests__/CustomHomeHtmlEditor.test.tsx`
    - Testar renderização do editor
    - Testar mudanças de valor
    - Testar botões de preview e reset
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ]* 11.4 Testes do modal de preview
    - Criar `src/components/admin/__tests__/HtmlPreviewModal.test.tsx`
    - Testar renderização do modal
    - Testar injeção de HTML no iframe
    - Testar aplicação de variáveis CSS
    - _Requirements: 2.1, 2.2, 2.3, 4.1_

  - [ ]* 11.5 Testes de integração frontend
    - Adicionar testes em `src/test/branding-integration.test.tsx`
    - Testar fluxo completo de edição e salvamento
    - Testar preview de HTML
    - Testar reset para template padrão
    - _Requirements: 1.1, 1.4, 2.1, 3.1_

- [x] 12. Documentar funcionalidade
  - [x] 12.1 Criar guia para administradores
    - Documentar como acessar o editor
    - Listar variáveis CSS disponíveis
    - Fornecer exemplos de HTML
    - Adicionar guidelines de segurança
    - _Requirements: 1.1, 4.1_

  - [x] 12.2 Atualizar documentação técnica
    - Documentar novos endpoints de API
    - Documentar estrutura de dados
    - Adicionar exemplos de uso
    - Documentar processo de sanitização
    - _Requirements: 1.1, 5.1_
