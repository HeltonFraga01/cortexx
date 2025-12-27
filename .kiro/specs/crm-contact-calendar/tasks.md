# Implementation Plan: CRM Contact Calendar

## Overview

Este plano implementa o Sistema de Agenda Completo no CRM, seguindo a ordem: database → backend → frontend. Cada tarefa é incremental e testável.

## Tasks

- [x] 1. Database Setup - Criar tabelas no Supabase
  - [x] 1.1 Criar migration para tabela `appointment_services`
    - Campos: id, user_id, name, description, default_duration_minutes, default_price_cents, color, is_active, created_at, updated_at
    - RLS policy para user_id
    - _Requirements: 3.1_

  - [x] 1.2 Criar migration para tabela `appointments`
    - Campos: id, user_id, contact_id, service_id, title, description, start_time, end_time, status, price_cents, notes, cancellation_reason, recurring_parent_id, recurring_pattern, created_at, updated_at
    - Constraints: valid_status, valid_time_range
    - Indexes: user_contact, user_time, status
    - RLS policy para user_id
    - _Requirements: 2.1, 2.5, 6.1_

  - [x] 1.3 Criar migration para tabela `blocked_slots`
    - Campos: id, user_id, start_time, end_time, reason, is_recurring, recurring_pattern, created_at
    - Index: user_time
    - RLS policy para user_id
    - _Requirements: 4.1_

  - [x] 1.4 Criar migration para tabela `appointment_financial_records`
    - Campos: id, appointment_id, amount_cents, payment_status, payment_date, payment_method, notes, created_at, updated_at
    - Foreign key para appointments com ON DELETE CASCADE
    - RLS policy baseada em appointment ownership
    - _Requirements: 5.1, 5.2_

- [x] 2. Backend - Services e Validators
  - [x] 2.1 Criar `server/validators/appointmentValidator.js`
    - validateAppointment(data) - validar campos obrigatórios e formatos
    - validateService(data) - validar serviço
    - validateBlockedSlot(data) - validar slot bloqueado
    - validateStatusTransition(currentStatus, newStatus) - validar transições
    - _Requirements: 2.1, 6.1_

  - [x] 2.2 Criar `server/services/AppointmentService.js`
    - getContactAppointments(userId, contactId, dateRange)
    - createAppointment(userId, data) - com criação de financial record se price > 0
    - updateAppointment(userId, appointmentId, data)
    - updateStatus(userId, appointmentId, status, reason?)
    - deleteAppointment(userId, appointmentId)
    - checkSlotAvailability(userId, startTime, endTime, excludeId?)
    - generateRecurringAppointments(appointment, pattern)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1_

  - [x] 2.3 Criar `server/services/AppointmentServiceService.js` (serviços/tipos)
    - getServices(userId)
    - createService(userId, data)
    - updateService(userId, serviceId, data)
    - deleteService(userId, serviceId)
    - _Requirements: 3.1_

  - [x] 2.4 Criar `server/services/BlockedSlotService.js`
    - getBlockedSlots(userId, dateRange)
    - createBlockedSlot(userId, data)
    - deleteBlockedSlot(userId, slotId)
    - expandRecurringSlots(slots, dateRange)
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 3. Backend - Routes
  - [x] 3.1 Criar `server/routes/userAppointmentRoutes.js`
    - GET /appointments - listar por contato e período
    - POST /appointments - criar com validação de disponibilidade
    - PUT /appointments/:id - atualizar
    - DELETE /appointments/:id - excluir
    - POST /appointments/:id/status - atualizar status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.3_

  - [x] 3.2 Adicionar rotas de serviços em `userAppointmentRoutes.js`
    - GET /services - listar serviços do usuário
    - POST /services - criar serviço
    - PUT /services/:id - atualizar serviço
    - DELETE /services/:id - excluir serviço
    - _Requirements: 3.1_

  - [x] 3.3 Adicionar rotas de blocked slots em `userAppointmentRoutes.js`
    - GET /blocked-slots - listar por período
    - POST /blocked-slots - criar
    - DELETE /blocked-slots/:id - excluir
    - _Requirements: 4.1, 4.5_

  - [x] 3.4 Criar endpoint unificado GET /calendar-events
    - Combinar: appointments + scheduled-messages + campaigns do contato
    - Filtros: dateRange, types, status
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.5 Registrar rotas em `server/routes/index.js`
    - Adicionar userAppointmentRoutes com prefixo /api/user
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Checkpoint - Backend Tests
  - Executar testes do backend
  - Verificar se todas as rotas respondem corretamente
  - Testar validação de disponibilidade de slots

- [x] 5. Frontend - Types e Service
  - [x] 5.1 Criar `src/types/appointment.ts`
    - Interfaces: Appointment, AppointmentService, BlockedSlot, FinancialRecord, CalendarEvent
    - Types: AppointmentStatus, PaymentStatus, RecurringType, CalendarEventType
    - Form data types: CreateAppointmentData, UpdateAppointmentData, etc.
    - _Requirements: 2.1, 3.1, 4.1, 5.1_

  - [x] 5.2 Criar `src/services/appointmentService.ts`
    - getCalendarEvents(contactId, dateRange) - endpoint unificado
    - getAppointments(contactId, dateRange)
    - createAppointment(data)
    - updateAppointment(id, data)
    - updateAppointmentStatus(id, status, reason?)
    - deleteAppointment(id)
    - getServices()
    - createService(data)
    - updateService(id, data)
    - deleteService(id)
    - getBlockedSlots(dateRange)
    - createBlockedSlot(data)
    - deleteBlockedSlot(id)
    - _Requirements: 2.1, 3.1, 4.1_

- [x] 6. Frontend - Calendar Components
  - [x] 6.1 Criar `src/components/features/crm/calendar/ContactCalendar.tsx`
    - Usar react-big-calendar com localizer pt-BR
    - View modes: day, week, month
    - Custom toolbar com navegação e filtros
    - Event rendering com cores por tipo/status
    - Click handlers para eventos e slots vazios
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 6.2 Criar `src/components/features/crm/calendar/AppointmentPopover.tsx`
    - Exibir detalhes: título, serviço, data/hora, duração, status, valor, pagamento
    - Ações rápidas: confirmar, completar, cancelar, reagendar
    - Link para edição completa
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.3 Criar `src/components/features/crm/calendar/AppointmentForm.tsx`
    - Form com React Hook Form + Zod
    - Campos: título, serviço (select), data/hora início, duração, valor, notas
    - Pre-fill de duração/preço ao selecionar serviço
    - Validação de disponibilidade antes de submit
    - Suporte a edição (pre-fill com dados existentes)
    - _Requirements: 2.1, 3.2, 3.3, 5.5_

  - [x] 6.4 Criar `src/components/features/crm/calendar/BlockedSlotForm.tsx`
    - Form para bloquear horários
    - Campos: data/hora início, data/hora fim, motivo, recorrente
    - Opções de recorrência: diário, semanal (selecionar dias)
    - _Requirements: 4.1, 4.4_

  - [x] 6.5 Criar `src/components/features/crm/calendar/CalendarFilters.tsx`
    - Filtro por status (multi-select)
    - Filtro por tipo de serviço
    - Filtro por tipo de evento (appointments vs scheduled events)
    - _Requirements: 9.4_

  - [x] 6.6 Criar `src/components/features/crm/calendar/CalendarEventComponent.tsx`
    - Renderização customizada de eventos no calendário
    - Cores por tipo e status
    - Indicadores: pagamento pendente, atrasado
    - _Requirements: 1.4, 5.4, 6.5, 10.2_

  - [x] 6.7 Criar CSS customizado `src/components/features/crm/calendar/ContactCalendar.css`
    - Estilos para react-big-calendar compatíveis com tema shadcn
    - Cores para diferentes status
    - Responsividade
    - _Requirements: 11.1_

- [x] 7. Frontend - Integration
  - [x] 7.1 Adicionar aba "Agenda" em `ContactDetailPage.tsx`
    - Nova TabsTrigger "Agenda" com ícone Calendar
    - TabsContent com ContactCalendar
    - Passar contactId, contactPhone, contactName
    - _Requirements: 1.1_

  - [x] 7.2 Criar `src/components/features/crm/calendar/ServiceManagement.tsx`
    - Lista de serviços do usuário
    - CRUD de serviços
    - Acessível via modal ou página separada
    - _Requirements: 3.1_

  - [x] 7.3 Criar página de Agenda Global `GlobalCalendarPage.tsx`
    - Visualização de todos os agendamentos de todos os contatos
    - Filtros por status e serviço
    - Stats cards (hoje, agendados, confirmados)
    - Navegação para detalhes do contato
    - Rota: `/user/agenda`
    - Menu item no CRM submenu
    - _Requirements: Global Agenda_

  - [x] 7.4 Atualizar `AppointmentPopover.tsx` com props para Agenda Global
    - Adicionar `showContactLink` prop
    - Adicionar `onViewContact` callback
    - Exibir link para contato quando showContactLink=true
    - _Requirements: Global Agenda_

- [ ] 8. Checkpoint - Integration Tests
  - Testar fluxo completo: criar serviço → criar agendamento → atualizar status
  - Testar bloqueio de horários
  - Testar integração com scheduled-messages existentes
  - Verificar se eventos aparecem corretamente no calendário

- [ ]* 9. Property-Based Tests
  - [ ]* 9.1 Write property test for View Mode State Consistency
    - **Property 1: View Mode State Consistency**
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 9.2 Write property test for Appointment Creation with Contact Binding
    - **Property 3: Appointment Creation with Contact Binding**
    - **Validates: Requirements 2.1, 2.5, 6.2**

  - [ ]* 9.3 Write property test for Time Slot Availability Validation
    - **Property 4: Time Slot Availability Validation**
    - **Validates: Requirements 2.2, 4.3**

  - [ ]* 9.4 Write property test for Appointment Status Transitions
    - **Property 5: Appointment Status Transitions**
    - **Validates: Requirements 6.1, 6.3**

  - [ ]* 9.5 Write property test for Service Pre-fill on Selection
    - **Property 6: Service Pre-fill on Selection**
    - **Validates: Requirements 3.3**

  - [ ]* 9.6 Write property test for Financial Record Creation
    - **Property 8: Financial Record Creation**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 9.7 Write property test for Filter Application
    - **Property 11: Filter Application**
    - **Validates: Requirements 9.4**

  - [ ]* 9.8 Write property test for Today's Appointment Count
    - **Property 12: Today's Appointment Count**
    - **Validates: Requirements 10.1**

- [ ] 10. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar responsividade em diferentes tamanhos de tela
  - Testar performance com muitos eventos

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- O projeto já tem `react-big-calendar` instalado e configurado em `CalendarView.tsx` - reutilizar padrões
