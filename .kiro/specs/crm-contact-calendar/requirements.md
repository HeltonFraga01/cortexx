# Requirements Document

## Introduction

Este documento especifica os requisitos para o Sistema de Agenda Completo no CRM. A feature adiciona um sistema robusto de agendamento na página de detalhes do contato, permitindo gestão de serviços, reservas, bloqueio de horários, e integração financeira. Todos os agendamentos (serviços comprados, reservas, disparos programados, campanhas) ficam vinculados ao contato em uma interface visual de calendário com visualização por dia, semana e mês.

## Glossary

- **Calendar_Panel**: Componente visual de calendário que exibe e gerencia agendamentos de um contato
- **Appointment**: Agendamento de serviço ou reserva vinculado a um contato, com data/hora, duração, status e valor
- **Service**: Tipo de serviço que pode ser agendado (consulta, reunião, entrega, etc.)
- **Time_Slot**: Período de tempo específico no calendário (disponível, ocupado, bloqueado)
- **Blocked_Slot**: Horário bloqueado que não permite novos agendamentos
- **Scheduled_Event**: Evento automático do sistema (mensagem programada, campanha, follow-up)
- **View_Mode**: Modo de visualização do calendário (day, week, month)
- **Appointment_Status**: Estado do agendamento (scheduled, confirmed, completed, cancelled, no_show)
- **Financial_Record**: Registro financeiro vinculado a um agendamento (valor, status de pagamento)

## Requirements

### Requirement 1: Visualização do Calendário

**User Story:** As a user, I want to see a comprehensive calendar panel in the contact detail page, so that I can visualize all appointments and scheduled events for that contact.

#### Acceptance Criteria

1. WHEN a user opens a contact detail page, THE Calendar_Panel SHALL display a calendar interface as a new tab "Agenda"
2. THE Calendar_Panel SHALL support three View_Modes: day, week, and month
3. WHEN a user switches View_Mode, THE Calendar_Panel SHALL update the display to show events in the selected time granularity
4. THE Calendar_Panel SHALL display appointments with visual indicators for different statuses (color-coded)
5. THE Calendar_Panel SHALL display Time_Slots showing availability (available, occupied, blocked)
6. THE Calendar_Panel SHALL distinguish between Appointments (services/reservations) and Scheduled_Events (messages/campaigns)

### Requirement 2: Gestão de Agendamentos (Appointments)

**User Story:** As a user, I want to create and manage appointments for contacts, so that I can schedule services and reservations.

#### Acceptance Criteria

1. THE System SHALL allow creating new Appointments with: title, service type, date/time, duration, and optional value
2. WHEN creating an Appointment, THE System SHALL validate that the Time_Slot is available (not blocked or occupied)
3. THE System SHALL allow editing existing Appointments (reschedule, change duration, update status)
4. THE System SHALL allow cancelling Appointments with optional reason
5. WHEN an Appointment is created, THE System SHALL automatically link it to the contact
6. THE System SHALL support recurring appointments (weekly, monthly)

### Requirement 3: Serviços e Tipos de Agendamento

**User Story:** As a user, I want to define service types, so that I can categorize and price my appointments.

#### Acceptance Criteria

1. THE System SHALL allow defining Service types with: name, default duration, default price, and color
2. WHEN creating an Appointment, THE System SHALL allow selecting a Service type
3. WHEN a Service is selected, THE System SHALL pre-fill duration and price from the Service definition
4. THE System SHALL display Service name and color in the Calendar_Panel for each Appointment

### Requirement 4: Bloqueio de Horários

**User Story:** As a user, I want to block time slots, so that I can prevent appointments during unavailable periods.

#### Acceptance Criteria

1. THE System SHALL allow creating Blocked_Slots with: start time, end time, and optional reason
2. WHEN a Time_Slot is blocked, THE Calendar_Panel SHALL display it as unavailable
3. THE System SHALL prevent creating Appointments in Blocked_Slots
4. THE System SHALL allow creating recurring Blocked_Slots (e.g., lunch break every day)
5. THE System SHALL allow removing Blocked_Slots

### Requirement 5: Integração Financeira

**User Story:** As a user, I want appointments to integrate with financial records, so that I can track payments for scheduled services.

#### Acceptance Criteria

1. WHEN an Appointment has a value, THE System SHALL create a Financial_Record linked to the appointment
2. THE Financial_Record SHALL track: amount, payment status (pending, paid, refunded), and payment date
3. WHEN a purchase is made (from existing purchase system), THE System SHALL optionally create an Appointment if it's a service
4. THE Calendar_Panel SHALL display payment status indicator on Appointments with financial records
5. WHEN an Appointment is completed, THE System SHALL prompt to update payment status if pending

### Requirement 6: Status e Fluxo de Agendamentos

**User Story:** As a user, I want to manage appointment statuses, so that I can track the lifecycle of each booking.

#### Acceptance Criteria

1. THE System SHALL support Appointment_Status: scheduled, confirmed, completed, cancelled, no_show
2. WHEN an Appointment is created, THE System SHALL set status to "scheduled"
3. THE System SHALL allow updating Appointment status manually
4. WHEN an Appointment time passes, THE System SHALL highlight it for status update (completed or no_show)
5. THE Calendar_Panel SHALL use different colors for each Appointment_Status

### Requirement 7: Integração com Sistema Existente

**User Story:** As a user, I want the calendar to show all scheduled items, so that I have a complete view of contact interactions.

#### Acceptance Criteria

1. THE Calendar_Panel SHALL display scheduled messages from the existing scheduled-messages system
2. THE Calendar_Panel SHALL display scheduled campaigns that include the contact
3. THE Calendar_Panel SHALL display follow-up reminders created for the contact
4. WHEN a message is scheduled from chat, THE Calendar_Panel SHALL display it as a Scheduled_Event
5. THE System SHALL visually distinguish Appointments from Scheduled_Events

### Requirement 8: Interação com Eventos

**User Story:** As a user, I want to interact with calendar items, so that I can view details and take actions.

#### Acceptance Criteria

1. WHEN a user clicks on an Appointment, THE System SHALL display a detail popover
2. THE popover SHALL show: title, service, date/time, duration, status, value, and payment status
3. THE popover SHALL provide quick actions: confirm, complete, cancel, reschedule
4. WHEN a user clicks on a Scheduled_Event, THE System SHALL show event details and link to source
5. WHEN a user clicks on an empty Time_Slot, THE System SHALL open quick-create form for new Appointment

### Requirement 9: Navegação e Filtros

**User Story:** As a user, I want to navigate and filter the calendar, so that I can find specific appointments easily.

#### Acceptance Criteria

1. THE Calendar_Panel SHALL provide navigation controls to move forward and backward in time
2. WHEN a user clicks "Today", THE Calendar_Panel SHALL navigate to the current date
3. THE Calendar_Panel SHALL display the current date range being viewed
4. THE System SHALL allow filtering by: Appointment_Status, Service type, and event type (appointments vs scheduled events)

### Requirement 10: Notificações e Lembretes

**User Story:** As a user, I want to be notified about upcoming appointments, so that I don't miss scheduled services.

#### Acceptance Criteria

1. THE System SHALL display a count of today's appointments in the Calendar_Panel header
2. THE System SHALL highlight overdue appointments that need status update
3. WHEN an Appointment is approaching (configurable time before), THE System SHALL optionally send a reminder message to the contact

### Requirement 11: Responsividade e Performance

**User Story:** As a user, I want the calendar to be responsive and fast, so that I can use it efficiently.

#### Acceptance Criteria

1. THE Calendar_Panel SHALL be responsive and adapt to different screen sizes
2. WHEN loading data, THE System SHALL display a loading indicator
3. THE System SHALL cache fetched data to minimize API calls when switching View_Modes
4. IF no items exist for the displayed period, THE Calendar_Panel SHALL show an empty state with quick-create option

