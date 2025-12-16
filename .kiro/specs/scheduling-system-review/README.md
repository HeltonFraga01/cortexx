# Spec: Revisão e Melhoria do Sistema de Agendamento

## Status: Ready for Implementation

## Overview

Esta spec documenta a revisão completa do sistema de agendamento de mensagens do WUZAPI Manager, com foco em corrigir problemas de UX mobile e padronizar a implementação.

## Problem Statement

O sistema atual de agendamento apresenta inconsistências:
- **DisparadorUnico** usa `react-datepicker` + `input type="time"` separados
- **CampaignBuilder** usa `input type="datetime-local"` nativo
- Possíveis problemas com seletores nativos em dispositivos Android
- Falta de validação consistente
- Feedback visual inconsistente

## Solution

Criar um componente `SchedulingInput` unificado que:
- Detecta automaticamente mobile vs desktop
- Usa inputs nativos otimizados em mobile
- Valida em tempo real com feedback claro
- Garante tratamento consistente de timezone
- Fornece experiência fluida em todos os dispositivos

## Key Features

1. **Componente Unificado:** `SchedulingInput` reutilizável
2. **Detecção Inteligente:** Inputs nativos em mobile, DatePicker em desktop
3. **Validação Robusta:** Tempo real com mensagens claras
4. **Timezone Consistente:** Luxon com America/Sao_Paulo
5. **Compatibilidade:** Feature detection + fallbacks

## Documents

- [requirements.md](./requirements.md) - 10 user stories com critérios EARS/INCOSE
- [design.md](./design.md) - Arquitetura, componentes e estratégia de migração
- [tasks.md](./tasks.md) - 11 tarefas principais + 4 opcionais

## Implementation Phases

### Phase 1: Core Component (Tasks 1-2)
- Criar hook useIsMobile
- Criar componente SchedulingInput com validação

### Phase 2: Migration (Tasks 3-4)
- Migrar DisparadorUnico
- Migrar CampaignBuilder

### Phase 3: Polish (Tasks 5-7)
- Estilos CSS mobile
- Otimizações de performance
- Feature flag para rollback

### Phase 4: Testing & Docs (Tasks 8-11)
- Testes E2E (opcional)
- Documentação
- Testes manuais em dispositivos
- Monitoramento pós-deploy

## Success Criteria

- ✅ Seleção de data funciona perfeitamente em Android e iOS
- ✅ Validação impede agendamentos em horários passados
- ✅ Feedback visual claro em todos os estados
- ✅ Experiência consistente entre DisparadorUnico e CampaignBuilder
- ✅ Performance mantida (< 100ms de resposta)
- ✅ Zero regressões em funcionalidades existentes

## Testing Strategy

**Manual Testing:**
- iPhone (Safari iOS)
- Android (Chrome, Firefox)
- Desktop (Chrome, Firefox, Safari)

**Automated Testing (Optional):**
- Unit tests para SchedulingInput
- Integration tests para componentes migrados
- E2E tests com Cypress

## Rollback Plan

- Feature flag `VITE_NEW_SCHEDULING`
- Código antigo mantido comentado por 2 sprints
- Rollback automático se taxa de erro > 5%

## Timeline Estimate

- Phase 1: 4-6 horas
- Phase 2: 4-6 horas
- Phase 3: 2-3 horas
- Phase 4: 3-4 horas

**Total: 13-19 horas** (sem testes opcionais)

## Next Steps

Para começar a implementação:

1. Abra o arquivo `tasks.md`
2. Clique em "Start task" na primeira tarefa
3. Siga a ordem sequencial das tarefas
4. Teste em dispositivos reais após cada fase

## Notes

- Prioridade: **Alta** (afeta UX mobile crítica)
- Complexidade: **Média** (refatoração com testes)
- Risco: **Baixo** (feature flag + rollback)
- Impacto: **Alto** (melhora experiência de todos os usuários)
