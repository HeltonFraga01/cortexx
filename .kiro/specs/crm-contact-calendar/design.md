# Design Document: CRM Contact Calendar

## Overview

Este documento descreve o design técnico do Sistema de Agenda Completo no CRM. A feature adiciona um sistema robusto de agendamento na página de detalhes do contato, utilizando `react-big-calendar` (já instalado no projeto) para a visualização, com backend em Node.js/Express e Supabase para persistência.

A arquitetura segue os padrões existentes do projeto:
- Frontend: React 18 + TypeScript + shadcn/ui + react-big-calendar
- Backend: Node.js + Express (CommonJS) + Supabase
- Integração com sistemas existentes de scheduled-messages e bulk campaigns

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CRM Contact Calendar                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Frontend (React + TypeScript)                                       │
│  ├── ContactDetailPage.tsx (existing - add "Agenda" tab)            │
│  ├── components/features/crm/calendar/                               │
│  │   ├── ContactCalendar.tsx (main calendar component)              │
│  │   ├── AppointmentPopover.tsx (detail popover)                    │
│  │   ├── AppointmentForm.tsx (create/edit form)                     │
│  │   ├── BlockedSlotForm.tsx (block time form)                      │
│  │   └── CalendarFilters.tsx (filter controls)                      │
│  ├── services/appointmentService.ts (API client)                    │
│  └── types/appointment.ts (TypeScript interfaces)                   │
│                                                                      │
│  Backend (Node.js + Express)                                         │
│  ├── routes/userAppointmentRoutes.js                                │
│  ├── services/AppointmentService.js                                 │
│  ├── validators/appointmentValidator.js                             │
│  └── Integration with existing:                                      │
│      ├── scheduled-messages API                                      │
│      └── bulkCampaignService                                         │
│                                                                      │
│  Database (Supabase)                                                 │
│  ├── appointments (main appointments table)                          │
│  ├── appointment_services (service types)                           │
│  ├── blocked_slots (blocked time periods)                           │
│  └── appointment_financial_records (payment tracking)               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### ContactCalendar (Main Component)
```typescript
interface ContactCalendarProps {
  contactId: string
  contactPhone: string
  contactName: string | null
}

// Main calendar component that orchestrates all calendar functionality
// Uses react-big-calendar with custom event rendering
// Integrates appointments, scheduled events, and blocked slots
```

#### AppointmentPopover
```typescript
interface AppointmentPopoverProps {
  appointment: Appointment
  onClose: () => void
  onConfirm: (id: string) => void
  onComplete: (id: string) => void
  onCancel: (id: string, reason?: string) => void
  onReschedule: (id: string) => void
}
```

#### AppointmentForm
```typescript
interface AppointmentFormProps {
  contactId: string
  contactPhone: string
  initialDate?: Date
  initialTime?: string
  appointment?: Appointment // for editing
  services: AppointmentService[]
  onSubmit: (data: CreateAppointmentData) => void
  onCancel: () => void
}
```

### Backend Routes

```javascript
// server/routes/userAppointmentRoutes.js
router.get('/appointments', authenticate, getContactAppointments)
router.post('/appointments', authenticate, createAppointment)
router.put('/appointments/:id', authenticate, updateAppointment)
router.delete('/appointments/:id', authenticate, deleteAppointment)
router.post('/appointments/:id/status', authenticate, updateAppointmentStatus)

router.get('/services', authenticate, getServices)
router.post('/services', authenticate, createService)
router.put('/services/:id', authenticate, updateService)
router.delete('/services/:id', authenticate, deleteService)

router.get('/blocked-slots', authenticate, getBlockedSlots)
router.post('/blocked-slots', authenticate, createBlockedSlot)
router.delete('/blocked-slots/:id', authenticate, deleteBlockedSlot)

router.get('/calendar-events', authenticate, getCalendarEvents) // unified endpoint
```

## Data Models

### Database Schema (Supabase)

```sql
-- Appointment Services (tipos de serviço)
CREATE TABLE appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  default_price_cents INTEGER DEFAULT 0,
  color VARCHAR(7) DEFAULT '#3b82f6', -- hex color
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments (agendamentos)
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  service_id UUID REFERENCES appointment_services(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  -- status: scheduled, confirmed, completed, cancelled, no_show
  price_cents INTEGER DEFAULT 0,
  notes TEXT,
  cancellation_reason TEXT,
  recurring_parent_id UUID REFERENCES appointments(id),
  recurring_pattern JSONB, -- {type: 'weekly'|'monthly', interval: 1, endDate: '...'}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Blocked Slots (horários bloqueados)
CREATE TABLE blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason VARCHAR(255),
  is_recurring BOOLEAN DEFAULT false,
  recurring_pattern JSONB, -- {type: 'daily'|'weekly', days: [0,1,2,3,4,5,6]}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_block_range CHECK (end_time > start_time)
);

-- Appointment Financial Records (registros financeiros)
CREATE TABLE appointment_financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- payment_status: pending, paid, refunded
  payment_date TIMESTAMPTZ,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'paid', 'refunded'))
);

-- Indexes for performance
CREATE INDEX idx_appointments_user_contact ON appointments(user_id, contact_id);
CREATE INDEX idx_appointments_user_time ON appointments(user_id, start_time, end_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_blocked_slots_user_time ON blocked_slots(user_id, start_time, end_time);
CREATE INDEX idx_services_user ON appointment_services(user_id);

-- RLS Policies
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_financial_records ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY appointments_user_policy ON appointments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY services_user_policy ON appointment_services
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY blocked_slots_user_policy ON blocked_slots
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY financial_records_policy ON appointment_financial_records
  FOR ALL USING (
    appointment_id IN (SELECT id FROM appointments WHERE user_id = auth.uid())
  );
```

### TypeScript Interfaces

```typescript
// src/types/appointment.ts

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'
export type RecurringType = 'weekly' | 'monthly'

export interface AppointmentService {
  id: string
  name: string
  description: string | null
  defaultDurationMinutes: number
  defaultPriceCents: number
  color: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Appointment {
  id: string
  contactId: string
  serviceId: string | null
  service: AppointmentService | null
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: AppointmentStatus
  priceCents: number
  notes: string | null
  cancellationReason: string | null
  recurringParentId: string | null
  recurringPattern: RecurringPattern | null
  financialRecord: FinancialRecord | null
  createdAt: string
  updatedAt: string
}

export interface RecurringPattern {
  type: RecurringType
  interval: number
  endDate: string | null
}

export interface BlockedSlot {
  id: string
  startTime: string
  endTime: string
  reason: string | null
  isRecurring: boolean
  recurringPattern: BlockedSlotRecurringPattern | null
  createdAt: string
}

export interface BlockedSlotRecurringPattern {
  type: 'daily' | 'weekly'
  days?: number[] // 0-6 for weekly
}

export interface FinancialRecord {
  id: string
  appointmentId: string
  amountCents: number
  paymentStatus: PaymentStatus
  paymentDate: string | null
  paymentMethod: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Calendar Event (unified type for calendar display)
export type CalendarEventType = 'appointment' | 'scheduled_message' | 'campaign' | 'blocked'

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  start: Date
  end: Date
  color: string
  status?: AppointmentStatus | string
  data: Appointment | ScheduledEvent | BlockedSlot
}

export interface ScheduledEvent {
  id: string
  type: 'single' | 'campaign'
  scheduledAt: string
  status: string
  instance: string
  phone?: string
  message?: string
  campaignName?: string
}

// Form Data
export interface CreateAppointmentData {
  contactId: string
  serviceId?: string
  title: string
  description?: string
  startTime: string
  endTime: string
  priceCents?: number
  notes?: string
  recurringPattern?: RecurringPattern
}

export interface UpdateAppointmentData {
  serviceId?: string
  title?: string
  description?: string
  startTime?: string
  endTime?: string
  status?: AppointmentStatus
  priceCents?: number
  notes?: string
  cancellationReason?: string
}

export interface CreateBlockedSlotData {
  startTime: string
  endTime: string
  reason?: string
  isRecurring?: boolean
  recurringPattern?: BlockedSlotRecurringPattern
}

export interface CreateServiceData {
  name: string
  description?: string
  defaultDurationMinutes: number
  defaultPriceCents?: number
  color?: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: View Mode State Consistency
*For any* Calendar_Panel and any View_Mode (day, week, month), switching to that mode SHALL update the internal state and the displayed date range SHALL match the selected granularity.
**Validates: Requirements 1.2, 1.3**

### Property 2: Event Type Visual Differentiation
*For any* calendar event, the rendered element SHALL have visual indicators (color, icon, badge) that correctly identify its type (appointment vs scheduled_event) and status (scheduled, confirmed, completed, cancelled, no_show, blocked).
**Validates: Requirements 1.4, 1.5, 1.6, 6.5, 7.5**

### Property 3: Appointment Creation with Contact Binding
*For any* valid appointment creation request with required fields (title, startTime, endTime), the created appointment SHALL have contactId matching the current contact and status set to "scheduled".
**Validates: Requirements 2.1, 2.5, 6.2**

### Property 4: Time Slot Availability Validation
*For any* appointment creation or update request, IF the requested time slot overlaps with a blocked slot OR an existing appointment, THEN the operation SHALL fail with an appropriate error.
**Validates: Requirements 2.2, 4.3**

### Property 5: Appointment Status Transitions
*For any* appointment, the status SHALL only be one of: scheduled, confirmed, completed, cancelled, no_show. Status updates SHALL be persisted correctly.
**Validates: Requirements 6.1, 6.3**

### Property 6: Service Pre-fill on Selection
*For any* service selection in the appointment form, the duration and price fields SHALL be pre-filled with the service's defaultDurationMinutes and defaultPriceCents values.
**Validates: Requirements 3.3**

### Property 7: Recurring Appointment Generation
*For any* appointment with a recurring pattern, the system SHALL generate the correct number of appointment instances based on the pattern type (weekly/monthly), interval, and end date.
**Validates: Requirements 2.6**

### Property 8: Financial Record Creation
*For any* appointment with priceCents > 0, a FinancialRecord SHALL be created with the same amount and paymentStatus set to "pending".
**Validates: Requirements 5.1, 5.2**

### Property 9: Blocked Slot Prevention
*For any* blocked slot, the calendar SHALL display it as unavailable, and any attempt to create an appointment in that slot SHALL be rejected.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 10: Navigation Date Consistency
*For any* navigation action (Today, Previous, Next), the displayed date range SHALL update correctly and match the current View_Mode.
**Validates: Requirements 9.2, 9.3**

### Property 11: Filter Application
*For any* filter combination (status, service type, event type), the displayed events SHALL only include items matching ALL active filters.
**Validates: Requirements 9.4**

### Property 12: Today's Appointment Count
*For any* calendar state, the displayed count of today's appointments SHALL equal the actual number of appointments scheduled for the current date.
**Validates: Requirements 10.1**

### Property 13: Overdue Appointment Highlighting
*For any* appointment where startTime is in the past AND status is NOT in (completed, cancelled, no_show), the appointment SHALL be visually highlighted as needing attention.
**Validates: Requirements 6.4, 10.2**

### Property 14: Popover Content Completeness
*For any* appointment popover, the displayed content SHALL include: title, service name (if set), date/time, duration, status, value (if > 0), and payment status (if financial record exists).
**Validates: Requirements 8.2**

### Property 15: Cache Efficiency
*For any* view mode switch within the same date range, the system SHALL NOT make additional API calls if the data is already cached.
**Validates: Requirements 11.3**

### Property 16: Empty State Display
*For any* date range with zero appointments and zero scheduled events, the calendar SHALL display an empty state message with a quick-create option.
**Validates: Requirements 11.4**

## Error Handling

### Frontend Error Handling

```typescript
// Appointment creation errors
interface AppointmentError {
  code: 'SLOT_UNAVAILABLE' | 'VALIDATION_ERROR' | 'SERVICE_NOT_FOUND' | 'CONTACT_NOT_FOUND' | 'SERVER_ERROR'
  message: string
  details?: Record<string, string>
}

// Error handling in components
const handleCreateAppointment = async (data: CreateAppointmentData) => {
  try {
    await appointmentService.create(data)
    toast.success('Agendamento criado')
    queryClient.invalidateQueries(['calendar-events', contactId])
  } catch (error) {
    if (error instanceof AppointmentError) {
      switch (error.code) {
        case 'SLOT_UNAVAILABLE':
          toast.error('Horário indisponível', { description: 'Este horário já está ocupado ou bloqueado' })
          break
        case 'VALIDATION_ERROR':
          toast.error('Dados inválidos', { description: error.message })
          break
        default:
          toast.error('Erro ao criar agendamento', { description: error.message })
      }
    } else {
      toast.error('Erro inesperado', { description: 'Tente novamente' })
    }
  }
}
```

### Backend Error Handling

```javascript
// server/routes/userAppointmentRoutes.js
router.post('/appointments', authenticate, async (req, res) => {
  try {
    const validationResult = validateAppointment(req.body)
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validationResult.message,
        details: validationResult.errors
      })
    }

    // Check slot availability
    const isAvailable = await AppointmentService.checkSlotAvailability(
      req.user.id,
      req.body.startTime,
      req.body.endTime
    )
    
    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        error: 'SLOT_UNAVAILABLE',
        message: 'O horário selecionado não está disponível'
      })
    }

    const appointment = await AppointmentService.create(req.user.id, req.body)
    res.status(201).json({ success: true, data: appointment })
  } catch (error) {
    logger.error('Failed to create appointment', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/appointments'
    })
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erro ao criar agendamento'
    })
  }
})
```

## Testing Strategy

### Unit Tests
- Appointment validation functions
- Date/time utility functions
- Status transition logic
- Recurring pattern generation
- Filter application logic

### Property-Based Tests (using fast-check)
- Property 1: View mode state consistency
- Property 3: Appointment creation with contact binding
- Property 4: Time slot availability validation
- Property 5: Appointment status transitions
- Property 6: Service pre-fill on selection
- Property 7: Recurring appointment generation
- Property 8: Financial record creation
- Property 11: Filter application
- Property 12: Today's appointment count
- Property 13: Overdue appointment highlighting

### Integration Tests
- Calendar events endpoint (unified data from appointments + scheduled messages + campaigns)
- Appointment CRUD operations
- Blocked slot management
- Financial record creation on appointment with value

### E2E Tests (Cypress)
- Create appointment from calendar
- Edit and reschedule appointment
- Cancel appointment with reason
- Block time slot
- Filter calendar events
- Navigate between view modes

### Test Configuration
- Minimum 100 iterations per property test
- Use Vitest for frontend tests
- Use Node test runner for backend tests
- Tag format: **Feature: crm-contact-calendar, Property {number}: {property_text}**
