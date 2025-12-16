# Implementation Plan

- [x] 1. Criar serviço de gerenciamento de cores de tema
  - Criar arquivo `src/services/themeColorManager.ts` com funções de conversão e aplicação
  - Implementar função `hexToHSL()` para converter cores hex em formato HSL
  - Implementar função `calculateForeground()` para calcular cor de contraste adequada
  - Implementar função `applyThemeColors()` para aplicar CSS variables no DOM
  - Implementar função `resetThemeColors()` para remover cores customizadas
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 1.1 Escrever testes unitários para conversão de cores
  - Criar testes para conversão hex para HSL com diferentes valores
  - Testar cálculo de cor foreground para cores claras e escuras
  - Testar edge cases (cores inválidas, valores extremos)
  - _Requirements: 5.1, 5.2_

- [x] 2. Estender BrandingContext com funcionalidades de tema
  - Adicionar método `applyThemeColors()` no BrandingContext
  - Adicionar método `resetThemeColors()` no BrandingContext
  - Adicionar método `previewThemeColors()` para preview temporário
  - Implementar listener para mudanças de tema (dark/light toggle)
  - Aplicar cores automaticamente quando configuração é carregada
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 2.1 Integrar aplicação de cores no ciclo de vida do contexto
  - Adicionar useEffect para aplicar cores quando config muda
  - Adicionar useEffect para reagir a mudanças de tema (dark/light)
  - Implementar lógica de fallback para cores padrão
  - Garantir que cores sejam aplicadas na inicialização da aplicação
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 3. Criar componente de preview de cores de tema
  - Criar arquivo `src/components/admin/ThemeColorPreview.tsx`
  - Implementar preview de botões primários com as cores selecionadas
  - Implementar preview de cards e badges com as cores
  - Adicionar toggle para alternar entre preview dark/light
  - Mostrar exemplos de sidebar e outros componentes principais
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3.1 Adicionar validação de contraste no preview
  - Implementar cálculo de contraste WCAG AA (mínimo 4.5:1)
  - Exibir warning se contraste for insuficiente
  - Mostrar indicador visual de contraste adequado/inadequado
  - Sugerir ajustes de cor se contraste for baixo
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Atualizar componente BrandingSettings
  - Atualizar label do campo "Cor Primária" para "Cor do Tema Dark"
  - Atualizar label do campo "Cor Secundária" para "Cor do Tema Light"
  - Adicionar descrições explicativas abaixo de cada campo
  - Integrar componente ThemeColorPreview na página
  - Implementar preview em tempo real ao selecionar cores (debounce 300ms)
  - _Requirements: 1.1, 2.1, 4.1, 4.4_

- [x] 4.1 Melhorar UX dos seletores de cor
  - Adicionar preview visual da cor selecionada ao lado do input
  - Implementar feedback visual ao mudar cores
  - Adicionar botão para resetar cores para padrão
  - Mostrar cores atuais vs. cores sendo editadas
  - _Requirements: 1.1, 4.1, 4.4_

- [x] 5. Implementar aplicação de cores no backend
  - Verificar se validação de cores hex já existe em `server/routes/brandingRoutes.js`
  - Adicionar validação adicional se necessário (formato hex válido)
  - Garantir que cores null/undefined sejam aceitas (usar padrão)
  - Testar persistência de cores no banco de dados
  - _Requirements: 1.2, 1.3_

- [ ]* 5.1 Escrever testes de integração para fluxo completo
  - Testar salvamento de cores via API
  - Testar carregamento de cores na inicialização
  - Testar aplicação de cores ao alternar tema dark/light
  - Testar comportamento com cores não configuradas
  - _Requirements: 1.3, 2.1, 3.1, 3.2_

- [x] 6. Adicionar documentação e exemplos
  - Documentar como usar as cores de tema no README
  - Adicionar exemplos de combinações de cores recomendadas
  - Criar guia de acessibilidade para escolha de cores
  - Documentar estrutura de CSS variables utilizadas
  - _Requirements: 4.1, 4.2_
