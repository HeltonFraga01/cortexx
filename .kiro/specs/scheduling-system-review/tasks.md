# Implementation Plan - Sistema de Agendamento Melhorado

- [x] 1. Criar hook useIsMobile para detecção de dispositivos
  - Implementar detecção baseada em largura de tela e user agent
  - Adicionar listener de resize para responsividade
  - Exportar de `src/hooks/useIsMobile.ts`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 2. Criar componente SchedulingInput compartilhado
  - Criar arquivo `src/components/shared/forms/SchedulingInput.tsx`
  - Implementar interface SchedulingInputProps com todas as props necessárias
  - Adicionar estado interno para date, time, error e isValid
  - Implementar lógica de detecção mobile/desktop para escolha de input
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2.1 Implementar validação em tempo real no SchedulingInput
  - Criar função validateDateTime com todas as regras de validação
  - Validar data não nula
  - Validar horário não nulo e formato HH:mm
  - Validar que data/hora é futura usando Luxon com timezone
  - Chamar onValidationChange com resultado
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2_

- [x] 2.2 Implementar renderização condicional de inputs
  - Renderizar `<Input type="date">` nativo em mobile
  - Renderizar `<DatePicker>` do react-datepicker em desktop
  - Renderizar `<Input type="time">` nativo sempre
  - Aplicar estilos consistentes do shadcn/ui
  - Adicionar className condicional para estado de erro
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.3_

- [x] 2.3 Adicionar feedback visual de validação
  - Renderizar Alert com erro quando houver erro de validação
  - Renderizar Alert com resumo quando válido e showSummary=true
  - Formatar data/hora no resumo usando Luxon: "dd/MM/yyyy 'às' HH:mm"
  - Adicionar ícones Calendar e AlertCircle apropriados
  - Destacar campos com erro usando border-destructive
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.4 Implementar conversão e formatação de timezone
  - Criar função toBackendFormat que converte Date para ISO com timezone
  - Criar função toDisplayFormat que formata para exibição brasileira
  - Usar Luxon DateTime com setZone("America/Sao_Paulo")
  - Garantir que comparações de data usam o mesmo timezone
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2.5 Adicionar textos de ajuda e acessibilidade
  - Adicionar Label para cada campo com htmlFor correto
  - Adicionar texto de ajuda "Horário de Brasília (GMT-3)"
  - Implementar ARIA labels e aria-invalid
  - Adicionar aria-describedby para textos de ajuda
  - Adicionar role="alert" para mensagens de erro
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ]* 2.6 Escrever testes unitários para SchedulingInput
  - Testar validação de datas futuras
  - Testar rejeição de datas passadas
  - Testar rejeição de horários passados no dia atual
  - Testar formatação de display
  - Testar conversão de timezone
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 3. Migrar DisparadorUnico para usar SchedulingInput
  - Substituir campos scheduledDate e scheduledTime por scheduledDateTime único
  - Substituir DatePicker + Input time por <SchedulingInput>
  - Remover função getScheduledDateTime (agora no componente)
  - Adicionar estado isSchedulingValid
  - Atualizar validação no handleSubmit para usar isSchedulingValid
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 3.1 Atualizar lógica de envio no DisparadorUnico
  - Usar scheduledDateTime diretamente (já é Date)
  - Converter para Luxon DateTime apenas para exibição no toast
  - Remover lógica de combinação de data/hora
  - Manter validação de agendamento futuro como fallback
  - _Requirements: 7.1, 7.3_

- [x] 3.2 Atualizar feedback de sucesso no DisparadorUnico
  - Usar toDisplayFormat para formatar data no toast
  - Garantir que mensagem mostra timezone correto
  - Manter diferenciação entre envio imediato e agendado
  - _Requirements: 5.3, 5.4, 9.4_

- [ ]* 3.3 Testar DisparadorUnico em desktop e mobile
  - Testar seleção de data em desktop (DatePicker)
  - Testar seleção de data em mobile (input nativo)
  - Testar seleção de hora em ambos
  - Testar validação de horário passado
  - Testar envio agendado com sucesso
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.5_

- [x] 4. Migrar CampaignBuilder para usar SchedulingInput
  - Substituir Input datetime-local por <SchedulingInput>
  - Converter scheduledAt de string para Date | null
  - Adicionar estado isSchedulingValid
  - Atualizar conversão para backend (Date -> ISO string)
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 4.1 Adicionar validação no CampaignBuilder
  - Usar onValidationChange do SchedulingInput
  - Desabilitar botão de criar campanha se !isSchedulingValid
  - Adicionar validação no handleCreateCampaign
  - Exibir erro claro se validação falhar
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.2 Atualizar feedback de sucesso no CampaignBuilder
  - Usar toDisplayFormat para formatar data no toast
  - Diferenciar mensagem entre "agendada" e "iniciada"
  - Garantir consistência com DisparadorUnico
  - _Requirements: 5.3, 5.4, 9.4_

- [ ]* 4.3 Testar CampaignBuilder em desktop e mobile
  - Testar criação de campanha agendada
  - Testar validação de horário passado
  - Testar desabilitação do botão quando inválido
  - Testar feedback de sucesso
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.5_

- [x] 5. Adicionar estilos CSS para inputs nativos mobile
  - Criar arquivo `src/styles/native-inputs.css` ou adicionar em index.css
  - Estilizar input[type="date"] com classes do shadcn/ui
  - Estilizar input[type="time"] com classes do shadcn/ui
  - Adicionar touch-manipulation para otimização mobile
  - Estilizar calendar-picker-indicator
  - Adicionar classe .error para estado de validação
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Implementar otimizações de performance
  - Adicionar useMemo para displayDate no SchedulingInput
  - Adicionar useCallback para validateDateTime
  - Implementar debounce na validação (300ms)
  - Evitar re-renders desnecessários com React.memo se necessário
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. Adicionar feature flag para rollback
  - Criar variável de ambiente VITE_NEW_SCHEDULING
  - Implementar condicional em DisparadorUnico
  - Implementar condicional em CampaignBuilder
  - Manter código antigo comentado
  - Documentar processo de rollback
  - _Requirements: 1.1, 1.2_

- [ ]* 8. Criar testes E2E com Cypress
  - Criar teste para agendamento em mobile (viewport iPhone)
  - Criar teste para agendamento em desktop
  - Testar validação de horário passado
  - Testar fluxo completo de envio agendado
  - Testar feedback de sucesso
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.5_

- [x] 9. Atualizar documentação
  - Documentar uso do SchedulingInput em README ou docs
  - Adicionar exemplos de código
  - Documentar props e comportamento
  - Adicionar screenshots de mobile e desktop
  - Documentar processo de migração
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 10. Realizar testes manuais em dispositivos reais
  - Testar em iPhone (Safari iOS)
  - Testar em Android (Chrome)
  - Testar em Android (Firefox)
  - Testar em desktop (Chrome, Firefox, Safari)
  - Documentar quaisquer problemas encontrados
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Corrigir bug do input de hora travando
  - Analisar race condition entre useState e useEffect
  - Remover estado interno duplicado de time
  - Tornar componente totalmente controlado via props
  - Mover validação para onBlur ao invés de onChange
  - Remover dependências circulares do useEffect
  - Simplificar lógica de atualização de hora
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 11.1 Refatorar SchedulingInput para componente controlado
  - Remover useState para time interno
  - Extrair time diretamente do value prop usando Luxon
  - Implementar handleTimeChange que atualiza via onChange prop
  - Implementar handleTimeBlur para validação
  - Remover debounce desnecessário
  - _Requirements: 11.1, 11.2, 11.4_

- [x] 11.2 Simplificar validação do SchedulingInput
  - Remover validação automática no useEffect
  - Validar apenas no onBlur do campo de hora
  - Validar apenas no onChange do campo de data
  - Remover useMemo e useCallback desnecessários
  - Garantir que validação não dispara onChange
  - _Requirements: 11.3, 11.5, 10.1, 10.2_

- [ ]* 11.3 Testar correção do input de hora
  - Testar digitação de horas como 18:00, 22:00, 01:00
  - Testar alternância rápida entre valores
  - Testar em mobile e desktop
  - Verificar que não há loops de atualização
  - Verificar que validação funciona corretamente
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 12. Unificar visualização de mensagens agendadas
  - Criar função getAllScheduledItems que combina localStorage + backend
  - Buscar mensagens únicas do localStorage via getScheduledMessages
  - Buscar campanhas agendadas do backend via bulkCampaignService
  - Filtrar campanhas com status 'scheduled' e isScheduled=true
  - Ordenar todos os itens por scheduledAt
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [x] 12.1 Criar interface unificada para itens agendados
  - Criar type ScheduledItem com discriminated union
  - Adicionar type: 'single' | 'campaign'
  - Incluir campos comuns: id, scheduledAt, status
  - Incluir campos específicos de mensagem única
  - Incluir campos específicos de campanha
  - _Requirements: 12.1, 12.2_

- [x] 12.2 Atualizar componente de listagem de agendados
  - Identificar componente que renderiza aba "Agendados"
  - Substituir leitura de localStorage por getAllScheduledItems
  - Renderizar SingleMessageCard para type='single'
  - Renderizar CampaignCard para type='campaign'
  - Adicionar listener de storage para atualização automática
  - Adicionar polling ou websocket para campanhas do backend
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 12.3 Criar componentes de card para cada tipo
  - Criar ou adaptar SingleMessageCard
  - Criar ou adaptar CampaignCard
  - Exibir informações relevantes de cada tipo
  - Adicionar ações apropriadas (cancelar, editar, etc)
  - Manter consistência visual entre os cards
  - _Requirements: 12.1, 12.2, 12.3_

- [ ]* 12.4 Testar unificação de agendados
  - Criar mensagem única agendada
  - Criar campanha agendada
  - Verificar que ambas aparecem na aba "Agendados"
  - Verificar ordenação por data
  - Verificar atualização automática
  - Testar cancelamento de cada tipo
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 13. Monitorar e ajustar após deploy
  - Configurar logging de erros de agendamento
  - Monitorar taxa de erro no Sentry
  - Coletar feedback de usuários
  - Fazer ajustes baseados em dados reais
  - Remover feature flag após 2 semanas sem problemas
  - _Requirements: 1.3, 1.4, 1.5_
