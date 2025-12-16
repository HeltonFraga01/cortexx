# Requirements Document - Revisão e Melhoria do Sistema de Agendamento

## Introduction

Este documento especifica os requisitos para revisar, corrigir e melhorar o sistema de agendamento de mensagens do WUZAPI Manager, com foco especial na experiência mobile e na confiabilidade da seleção de data/hora.

## Glossary

- **Sistema de Agendamento**: Funcionalidade que permite agendar o envio de mensagens para uma data e hora futura
- **DisparadorUnico**: Componente para envio de mensagens individuais com opção de agendamento
- **CampaignBuilder**: Componente para criação de campanhas em massa com opção de agendamento
- **DatePicker**: Componente react-datepicker usado para seleção de datas
- **Input Time**: Campo HTML nativo type="time" para seleção de horário
- **Input DateTime-Local**: Campo HTML nativo type="datetime-local" para seleção de data e hora combinadas
- **Mobile UX**: Experiência do usuário em dispositivos móveis (smartphones e tablets)
- **Timezone**: Fuso horário, fixado em America/Sao_Paulo (GMT-3)

## Requirements

### Requirement 1: Auditoria Completa do Sistema Atual

**User Story:** Como desenvolvedor, eu quero auditar o sistema de agendamento atual, para que eu possa identificar todos os problemas e inconsistências existentes

#### Acceptance Criteria

1. WHEN o desenvolvedor analisa o código, THE Sistema de Agendamento SHALL identificar todos os componentes que implementam agendamento
2. WHEN o desenvolvedor revisa a implementação, THE Sistema de Agendamento SHALL documentar os tipos de inputs usados (DatePicker, time, datetime-local)
3. WHEN o desenvolvedor testa em mobile, THE Sistema de Agendamento SHALL registrar todos os problemas de UX identificados
4. WHEN o desenvolvedor valida a lógica, THE Sistema de Agendamento SHALL verificar a consistência do tratamento de timezone
5. WHEN o desenvolvedor examina a validação, THE Sistema de Agendamento SHALL confirmar que horários passados são rejeitados corretamente

### Requirement 2: Correção de Problemas Mobile

**User Story:** Como usuário mobile, eu quero selecionar data e hora de agendamento facilmente, para que eu possa agendar mensagens sem frustração

#### Acceptance Criteria

1. WHEN o usuário mobile toca no campo de data, THE Sistema de Agendamento SHALL abrir um seletor nativo apropriado para o dispositivo
2. WHEN o usuário mobile toca no campo de hora, THE Sistema de Agendamento SHALL abrir um seletor nativo apropriado para o dispositivo
3. WHEN o usuário mobile seleciona uma data, THE Sistema de Agendamento SHALL aplicar a data sem erros de formatação
4. WHEN o usuário mobile seleciona uma hora, THE Sistema de Agendamento SHALL aplicar a hora sem erros de formatação
5. WHEN o usuário mobile visualiza os campos, THE Sistema de Agendamento SHALL exibir valores legíveis no formato brasileiro (dd/MM/yyyy HH:mm)

### Requirement 3: Padronização de Componentes

**User Story:** Como desenvolvedor, eu quero que todos os pontos de agendamento usem a mesma implementação, para que a experiência seja consistente em todo o sistema

#### Acceptance Criteria

1. WHEN o sistema implementa agendamento, THE Sistema de Agendamento SHALL usar o mesmo componente em DisparadorUnico e CampaignBuilder
2. WHEN o componente é renderizado, THE Sistema de Agendamento SHALL aplicar os mesmos estilos e comportamentos
3. WHEN o usuário interage com o agendamento, THE Sistema de Agendamento SHALL validar da mesma forma em todos os contextos
4. WHEN ocorre um erro, THE Sistema de Agendamento SHALL exibir mensagens consistentes
5. WHEN o agendamento é salvo, THE Sistema de Agendamento SHALL processar o timezone da mesma forma

### Requirement 4: Validação Robusta

**User Story:** Como usuário, eu quero que o sistema me impeça de agendar em horários inválidos, para que eu não perca tempo criando agendamentos que não funcionarão

#### Acceptance Criteria

1. WHEN o usuário seleciona uma data passada, THE Sistema de Agendamento SHALL exibir erro claro e impedir o envio
2. WHEN o usuário seleciona uma hora passada no dia atual, THE Sistema de Agendamento SHALL exibir erro claro e impedir o envio
3. WHEN o usuário tenta agendar sem selecionar data, THE Sistema de Agendamento SHALL exibir erro claro
4. WHEN o usuário tenta agendar sem selecionar hora, THE Sistema de Agendamento SHALL exibir erro claro
5. WHEN a validação falha, THE Sistema de Agendamento SHALL manter o foco no campo problemático

### Requirement 5: Feedback Visual Claro

**User Story:** Como usuário, eu quero ver claramente quando o agendamento está ativo e para quando está agendado, para que eu tenha confiança no que estou fazendo

#### Acceptance Criteria

1. WHEN o usuário ativa o agendamento, THE Sistema de Agendamento SHALL destacar visualmente a seção de agendamento
2. WHEN o usuário seleciona data e hora, THE Sistema de Agendamento SHALL exibir um resumo legível do agendamento
3. WHEN o usuário está prestes a enviar, THE Sistema de Agendamento SHALL mostrar confirmação clara do horário agendado
4. WHEN o agendamento é criado, THE Sistema de Agendamento SHALL exibir toast com data/hora formatada em português
5. WHEN há erro de validação, THE Sistema de Agendamento SHALL destacar o campo problemático com borda vermelha

### Requirement 6: Compatibilidade Cross-Browser e Cross-Device

**User Story:** Como usuário, eu quero que o agendamento funcione em qualquer navegador e dispositivo, para que eu possa usar o sistema de onde estiver

#### Acceptance Criteria

1. WHEN o usuário acessa em Chrome mobile, THE Sistema de Agendamento SHALL funcionar corretamente
2. WHEN o usuário acessa em Safari iOS, THE Sistema de Agendamento SHALL funcionar corretamente
3. WHEN o usuário acessa em Firefox Android, THE Sistema de Agendamento SHALL funcionar corretamente
4. WHEN o usuário acessa em desktop, THE Sistema de Agendamento SHALL funcionar corretamente
5. WHEN o navegador não suporta inputs nativos, THE Sistema de Agendamento SHALL fornecer fallback funcional

### Requirement 7: Tratamento Correto de Timezone

**User Story:** Como usuário, eu quero que meus agendamentos respeitem o horário de Brasília, para que as mensagens sejam enviadas no horário correto

#### Acceptance Criteria

1. WHEN o usuário agenda uma mensagem, THE Sistema de Agendamento SHALL converter para America/Sao_Paulo timezone
2. WHEN o sistema valida o horário, THE Sistema de Agendamento SHALL comparar usando o mesmo timezone
3. WHEN o agendamento é salvo no backend, THE Sistema de Agendamento SHALL armazenar em formato ISO com timezone
4. WHEN o agendamento é exibido, THE Sistema de Agendamento SHALL mostrar no timezone de Brasília
5. WHEN ocorre horário de verão, THE Sistema de Agendamento SHALL ajustar automaticamente

### Requirement 8: Testes de Regressão

**User Story:** Como desenvolvedor, eu quero testes automatizados para o agendamento, para que futuras mudanças não quebrem a funcionalidade

#### Acceptance Criteria

1. WHEN os testes são executados, THE Sistema de Agendamento SHALL validar seleção de data futura
2. WHEN os testes são executados, THE Sistema de Agendamento SHALL validar rejeição de data passada
3. WHEN os testes são executados, THE Sistema de Agendamento SHALL validar formatação de data/hora
4. WHEN os testes são executados, THE Sistema de Agendamento SHALL validar conversão de timezone
5. WHEN os testes são executados, THE Sistema de Agendamento SHALL validar integração com backend

### Requirement 9: Documentação de UX

**User Story:** Como usuário, eu quero instruções claras sobre como usar o agendamento, para que eu não tenha dúvidas

#### Acceptance Criteria

1. WHEN o usuário ativa o agendamento, THE Sistema de Agendamento SHALL exibir texto de ajuda sobre o formato esperado
2. WHEN o usuário passa o mouse sobre o campo, THE Sistema de Agendamento SHALL exibir tooltip com exemplo
3. WHEN ocorre erro, THE Sistema de Agendamento SHALL exibir mensagem explicativa clara
4. WHEN o agendamento é bem-sucedido, THE Sistema de Agendamento SHALL confirmar com mensagem descritiva
5. WHEN há dúvidas, THE Sistema de Agendamento SHALL fornecer link para documentação

### Requirement 10: Performance e Responsividade

**User Story:** Como usuário, eu quero que o agendamento responda instantaneamente, para que a experiência seja fluida

#### Acceptance Criteria

1. WHEN o usuário interage com os campos, THE Sistema de Agendamento SHALL responder em menos de 100ms
2. WHEN o usuário alterna entre campos, THE Sistema de Agendamento SHALL manter o estado sem delay
3. WHEN o usuário valida o formulário, THE Sistema de Agendamento SHALL processar em menos de 200ms
4. WHEN o usuário envia o agendamento, THE Sistema de Agendamento SHALL confirmar em menos de 2 segundos
5. WHEN há muitos campos no formulário, THE Sistema de Agendamento SHALL manter performance consistente

### Requirement 11: Correção de Bug no Input de Hora

**User Story:** Como usuário, eu quero digitar a hora desejada sem que o campo fique travando ou voltando para 12:00, para que eu possa agendar no horário correto

#### Acceptance Criteria

1. WHEN o usuário digita uma hora no campo, THE Sistema de Agendamento SHALL aceitar o valor sem resetar para 12:00
2. WHEN o usuário altera a hora, THE Sistema de Agendamento SHALL manter o valor digitado sem loops de atualização
3. WHEN o usuário termina de digitar, THE Sistema de Agendamento SHALL validar apenas uma vez
4. WHEN o componente recebe novo valor via props, THE Sistema de Agendamento SHALL atualizar sem criar race conditions
5. WHEN o usuário interage rapidamente com o campo, THE Sistema de Agendamento SHALL responder de forma estável

### Requirement 12: Unificação de Mensagens Agendadas

**User Story:** Como usuário, eu quero ver todas as minhas mensagens agendadas em um único lugar, independente de serem envios únicos ou campanhas em massa, para que eu possa gerenciar todos os meus agendamentos

#### Acceptance Criteria

1. WHEN o usuário acessa a aba "Agendados", THE Sistema de Agendamento SHALL exibir mensagens únicas do localStorage
2. WHEN o usuário acessa a aba "Agendados", THE Sistema de Agendamento SHALL exibir campanhas agendadas do backend
3. WHEN há agendamentos de ambos os tipos, THE Sistema de Agendamento SHALL ordená-los por data/hora
4. WHEN uma campanha é agendada, THE Sistema de Agendamento SHALL aparecer imediatamente na aba "Agendados"
5. WHEN o usuário atualiza a página, THE Sistema de Agendamento SHALL carregar todos os agendamentos corretamente
