# SchedulingInput Component

Componente compartilhado para seleção de data/hora com validação automática, otimizado para mobile e desktop.

## Localização

```
src/components/shared/forms/SchedulingInput.tsx
```

## Features

- ✅ Detecção automática de dispositivo (mobile vs desktop)
- ✅ Validação em tempo real com debounce
- ✅ Feedback visual imediato
- ✅ Formatação brasileira (dd/MM/yyyy às HH:mm)
- ✅ Suporte a timezone (America/Sao_Paulo)
- ✅ Inputs nativos em mobile para melhor UX
- ✅ DatePicker em desktop
- ✅ Acessibilidade completa (ARIA labels)
- ✅ Otimizado para performance (useMemo, useCallback, debounce)

## Uso Básico

```tsx
import { SchedulingInput } from '@/components/shared/forms/SchedulingInput';

function MyComponent() {
  const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
  const [isValid, setIsValid] = useState(false);

  return (
    <SchedulingInput
      value={scheduledDateTime}
      onChange={setScheduledDateTime}
      onValidationChange={setIsValid}
      showSummary={true}
    />
  );
}
```

## Props

### `value: Date | null` (required)
Data/hora selecionada. Use `null` para estado inicial vazio.

### `onChange: (date: Date | null) => void` (required)
Callback chamado quando data/hora válida é selecionada.

### `onValidationChange?: (isValid: boolean, error?: string) => void`
Callback chamado quando validação muda. Use para desabilitar botões de submit.

```tsx
<SchedulingInput
  value={date}
  onChange={setDate}
  onValidationChange={(isValid, error) => {
    setIsSchedulingValid(isValid);
    if (error) console.log(error);
  }}
/>
```

### `minDate?: Date`
Data mínima permitida. Default: `new Date()` (hoje).

```tsx
<SchedulingInput
  value={date}
  onChange={setDate}
  minDate={new Date('2024-12-01')}
/>
```

### `disabled?: boolean`
Desabilita todos os inputs. Default: `false`.

### `className?: string`
Classes CSS adicionais para o container.

### `showSummary?: boolean`
Mostra resumo da data/hora selecionada. Default: `true`.

```tsx
<SchedulingInput
  value={date}
  onChange={setDate}
  showSummary={false} // Oculta o resumo
/>
```

### `timezone?: string`
Timezone para validação e formatação. Default: `'America/Sao_Paulo'`.

## Validação

O componente valida automaticamente:

1. **Data não nula** - Usuário deve selecionar uma data
2. **Horário não nulo** - Usuário deve selecionar um horário
3. **Formato HH:mm** - Horário deve estar no formato correto
4. **Data/hora futura** - Não permite agendar no passado

### Mensagens de Erro

- "Selecione uma data"
- "Selecione um horário válido"
- "O horário deve ser no futuro"

## Comportamento Mobile vs Desktop

### Mobile (< 768px)
- Input nativo `<input type="date">` para data
- Input nativo `<input type="time">` para hora
- Área de toque otimizada (min 44x44px)
- Teclado numérico automático

### Desktop (>= 768px)
- DatePicker do react-datepicker para data
- Input nativo `<input type="time">` para hora
- Calendário visual interativo

## Exemplos Completos

### DisparadorUnico

```tsx
const [isScheduled, setIsScheduled] = useState(false);
const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
const [isSchedulingValid, setIsSchedulingValid] = useState(false);

// No JSX
{isScheduled && (
  <SchedulingInput
    value={scheduledDateTime}
    onChange={setScheduledDateTime}
    onValidationChange={setIsSchedulingValid}
    showSummary={true}
  />
)}

// Na validação do submit
if (isScheduled && !isSchedulingValid) {
  toast.error('Agendamento inválido');
  return;
}

// No envio
if (isScheduled && scheduledDateTime) {
  await scheduleMessage(payload, 'text', scheduledDateTime);
  const luxonDateTime = DateTime.fromJSDate(scheduledDateTime)
    .setZone('America/Sao_Paulo');
  toast.success(`Agendado para ${luxonDateTime.toFormat("dd/MM/yyyy 'às' HH:mm")}`);
}
```

### CampaignBuilder

```tsx
const [isScheduled, setIsScheduled] = useState(false);
const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
const [isSchedulingValid, setIsSchedulingValid] = useState(false);

// No JSX
{isScheduled && (
  <SchedulingInput
    value={scheduledDateTime}
    onChange={setScheduledDateTime}
    onValidationChange={setIsSchedulingValid}
    showSummary={true}
  />
)}

// Desabilitar botão se inválido
<Button
  disabled={isScheduled && !isSchedulingValid}
  onClick={handleCreateCampaign}
>
  Criar Campanha
</Button>

// Converter para ISO string no backend
const config = {
  scheduledAt: isScheduled && scheduledDateTime 
    ? scheduledDateTime.toISOString() 
    : undefined
};
```

## Estilos CSS

Os inputs nativos são estilizados em `src/index.css`:

```css
input[type="date"],
input[type="time"] {
  /* Estilos do shadcn/ui */
  @apply flex h-10 w-full rounded-md border border-input bg-background px-3 py-2;
  @apply touch-manipulation; /* Otimização mobile */
}

/* Área de toque adequada em mobile */
@media (max-width: 768px) {
  input[type="date"],
  input[type="time"] {
    min-height: 44px;
    padding: 12px;
  }
}
```

## Performance

O componente é otimizado com:

- **useMemo** - Formatação de data memoizada
- **useCallback** - Handlers estáveis
- **Debounce** - Validação com 300ms de delay

## Acessibilidade

- Labels com `htmlFor` correto
- ARIA labels (`aria-invalid`, `aria-describedby`)
- Textos de ajuda descritivos
- Role="alert" para erros
- Navegação por teclado funcional

## Timezone

O componente usa Luxon para manipulação de timezone:

```typescript
const dateTime = DateTime.fromJSDate(date)
  .setZone('America/Sao_Paulo')
  .set({ hour, minute, second: 0, millisecond: 0 });
```

Todas as comparações e validações usam o mesmo timezone para consistência.

## Troubleshooting

### Data não valida mesmo sendo futura

Verifique se o timezone está correto. O componente compara com `DateTime.now().setZone(timezone)`.

### Input nativo não aparece em mobile

Verifique se o hook `useIsMobile` está funcionando. Ele detecta por largura de tela E user agent.

### Validação não dispara

O componente usa debounce de 300ms. Aguarde um pouco após digitar.

### Formato de data incorreto

O componente sempre retorna `Date` JavaScript. Para backend, converta para ISO:
```typescript
scheduledDateTime.toISOString()
```

## Migração do Sistema Antigo

### Antes (DisparadorUnico)
```tsx
const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
const [scheduledTime, setScheduledTime] = useState("12:00");

const getScheduledDateTime = (): DateTime | null => {
  // ... lógica complexa de combinação
};
```

### Depois
```tsx
const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
const [isSchedulingValid, setIsSchedulingValid] = useState(false);

<SchedulingInput
  value={scheduledDateTime}
  onChange={setScheduledDateTime}
  onValidationChange={setIsSchedulingValid}
/>
```

## Dependências

- `luxon` - Manipulação de timezone
- `react-datepicker` - DatePicker para desktop
- `date-fns` - Formatação de datas
- `@/hooks/useIsMobile` - Detecção de dispositivo

## Changelog

- **2024-11-13**: Componente criado
- **2024-11-13**: Otimizações de performance adicionadas
- **2024-11-13**: Migração completa de DisparadorUnico e CampaignBuilder
