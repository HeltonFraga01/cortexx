# Implementation Plan

## Task List

- [x] 1. Modificar CustomHtmlRenderer para usar srcdoc
  - Alterar implementação do componente `CustomHtmlRenderer` em `src/pages/PublicHome.tsx`
  - Substituir `document.write()` por atributo `srcdoc` no iframe
  - Configurar sandbox permissions corretas: `allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation allow-downloads`
  - Adicionar state para tracking de loading/error
  - Implementar timeout de 10 segundos para detecção de falhas
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Criar componente CustomHtmlErrorBoundary
  - Criar arquivo `src/components/shared/CustomHtmlErrorBoundary.tsx`
  - Implementar Error Boundary React para capturar erros de renderização
  - Adicionar fallback UI com mensagem de erro e botão "Reload"
  - Implementar callback `onError` para logging
  - Adicionar opção de fallback customizado
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 3. Criar componente CustomHtmlLoadingIndicator
  - Criar arquivo `src/components/shared/CustomHtmlLoadingIndicator.tsx`
  - Implementar indicador de loading com spinner e mensagem
  - Adicionar timeout detection (10 segundos)
  - Implementar callback `onTimeout`
  - Adicionar animação de loading
  - _Requirements: 7.1, 7.4_

- [x] 4. Implementar debugging e logging
  - Adicionar console logs para tracking de carregamento de recursos
  - Implementar captura de erros do iframe via `window.onerror`
  - Adicionar logging de performance (tempo de carregamento)
  - Implementar tracking de recursos carregados/falhados
  - Criar interface `CustomHtmlRenderState` para state management
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Adicionar error handling e fallbacks
  - Implementar tratamento de timeout (10 segundos)
  - Adicionar fallback para LoginPage em caso de erro crítico
  - Implementar mensagens de erro user-friendly
  - Adicionar botão "Reload" para retry
  - Implementar logging de erros para debugging
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Integrar componentes no PublicHome
  - Envolver `CustomHtmlRenderer` com `CustomHtmlErrorBoundary`
  - Adicionar `CustomHtmlLoadingIndicator` durante carregamento
  - Implementar lógica de fallback para LoginPage
  - Adicionar ARIA labels para acessibilidade
  - Testar fluxo completo de renderização
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.5_

- [ ]* 7. Escrever testes unitários
  - Criar `src/pages/PublicHome.test.tsx` para testar PublicHome
  - Criar `src/components/shared/CustomHtmlErrorBoundary.test.tsx`
  - Criar `src/components/shared/CustomHtmlLoadingIndicator.test.tsx`
  - Testar renderização de HTML simples
  - Testar detecção de timeout
  - Testar error handling
  - Testar fallback para LoginPage
  - _Requirements: 1.1, 7.1, 7.2, 7.4, 7.5_

- [ ]* 8. Escrever testes de integração
  - Testar integração entre PublicHome e CustomHtmlRenderer
  - Testar integração com useBrandingConfig hook
  - Testar fluxo de loading → success
  - Testar fluxo de loading → error → fallback
  - Testar fluxo de loading → timeout → retry
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.4, 7.5_

- [ ]* 9. Escrever testes E2E com Cypress
  - Criar `cypress/e2e/custom-html-rendering.cy.ts`
  - Testar carregamento completo de homeCompativel.html
  - Testar aplicação de estilos Tailwind CSS
  - Testar renderização de ícones Lucide
  - Testar execução de animações TAOS
  - Testar funcionalidade do menu mobile
  - Testar abertura/fechamento de modais
  - Testar navegação por links
  - Testar submissão de formulários
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

- [x] 10. Validar com homeCompativel.html
  - Configurar homeCompativel.html no branding config
  - Testar carregamento completo da página
  - Validar que Tailwind CSS é aplicado corretamente
  - Validar que ícones Lucide são renderizados
  - Validar que animações TAOS funcionam
  - Validar que menu mobile funciona
  - Validar que modais abrem e fecham
  - Validar que formulários funcionam
  - Validar que links de navegação funcionam
  - Medir performance de carregamento
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 11. Otimizar performance
  - Medir tempo de carregamento inicial
  - Otimizar loading de recursos externos
  - Implementar lazy loading se necessário
  - Validar que performance está < 3 segundos
  - Adicionar monitoring de performance
  - _Requirements: 5.5, 6.3_

- [ ] 12. Documentar mudanças
  - Atualizar documentação do componente CustomHtmlRenderer
  - Documentar novos componentes (ErrorBoundary, LoadingIndicator)
  - Atualizar guia de uso de HTML personalizado
  - Adicionar exemplos de HTML compatível
  - Documentar troubleshooting de problemas comuns
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
