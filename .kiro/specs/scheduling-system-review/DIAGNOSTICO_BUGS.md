# Diagnóstico de Bugs - Sistema de Agendamento

**Data:** 13/11/2025  
**Versão:** 1.4.3  
**Ambiente:** Desenvolvimento (localhost:8080)

## Resumo Executivo

Foram identificados **2 problemas críticos** no sistema de agendamento:

1. **Bug no Input de Hora**: O campo de hora está "travando" e voltando para 12:00 ao tentar inserir valores como 18:00 ou 22:00
2. **Campanhas em Massa Não Aparecem em Agendados**: Campanhas agendadas via disparo em massa não são exibidas na aba "Agendados"

## Problema 1: Input de Hora Travando

### Sintomas Observados

- Usuário tenta digitar hora (ex: 18:00, 22:00)
- O número fica "bugado", iniciando e voltando para 12:00
- Comportamento inconsistente ao tentar alterar a hora
- Problema ocorre tanto em envio único quanto em massa

### Análise Técnica

#### Código Atual (SchedulingInput.tsx)

```typescript
// Linha 62-67
const [date, setDate] = useState<Date | null>(value);
const [time, setTime] = useState<string>('12:00');
const [error, setError] = useState<string | null>(null);

// Linha 70-75 - Inicialização do time
useEffect(() => {
  if (value) {
    const dt = DateTime.fromJSDate(value).setZone(timezone);
    setTime(dt.toFormat('HH:mm'));
    setDate(value);
  }
}, [value, timezone]);
```

#### Problema Identificado

**Race Condition entre useState e useEffect:**

1. Componente renderiza com `time = '12:00'` (valor inicial)
2. useEffect tenta atualizar o time baseado no `value` prop
3. Validação automática dispara a cada mudança de `time`
4. Validação chama `onChange` que atualiza o `value` prop
5. Isso dispara o useEffect novamente, criando um loop

**Debounce Insuficiente:**

```typescript
// Linha 115-120
const debouncedValidate = useMemo(
  () => debounce(validateDateTime, 300),
  [validateDateTime]
);
```

O debounce de 300ms não é suficiente para evitar o loop quando o usuário está digitando rapidamente.

**Dependências do useEffect:**

```typescript
// Linha 123-127
useEffect(() => {
  if (date && time) {
    debouncedValidate();
  }
}, [date, time, debouncedValidate]);
```

O `debouncedValidate` está nas dependências, mas ele mesmo depende de `validateDateTime`, que depende de `date` e `time`, criando dependências circulares.

### Evidências do Console

```
msgid=143 [log] DisparadorWrapper - Token status: JSHandle@object
msgid=144 [log] DisparadorWrapper - Token status: JSHandle@object
```

Múltiplas chamadas de validação em sequência rápida.

### Causa Raiz

**Problema de Sincronização de Estado:**

O componente está tentando ser "controlado" (recebe `value` prop) e "não-controlado" (mantém estado interno `time`) ao mesmo tempo. Isso cria conflitos quando:

1. Usuário digita no input → atualiza `time` interno
2. Validação dispara → chama `onChange(newDate)`
3. Parent component atualiza `value` prop
4. useEffect detecta mudança em `value` → atualiza `time` interno
5. Volta ao passo 1 (loop)

## Problema 2: Campanhas em Massa Não Aparecem em Agendados

### Sintomas Observados

- Usuário cria campanha agendada via "Envio em Massa"
- Toast de sucesso aparece: "Campanha 'Teste' agendada com sucesso!"
- Campanha NÃO aparece na aba "Agendados"
- Envio único agendado APARECE corretamente na aba "Agendados"

### Análise Técnica

#### Fluxo de Envio Único (Funciona)

```typescript
// DisparadorUnico.tsx - Linha 326-335
if (isScheduled && scheduledDateTime) {
  await scheduleMessage(payload, "text", scheduledDateTime);
  const luxonDateTime = DateTime.fromJSDate(scheduledDateTime).setZone(
    "America/Sao_Paulo"
  );
  toast.success("Mensagem Agendada", {
    description: `Mensagem de texto agendada para ${luxonDateTime.toFormat(
      "dd/MM/yyyy 'às' HH:mm"
    )}`,
  });
}
```

**scheduleMessage** salva no **localStorage**:

```typescript
// api.ts - Linha 1326-1360
export const scheduleMessage = async (
  payload: SendTextPayload | SendMediaPayload,
  type: "text" | "media",
  scheduledAt: Date
): Promise<void> => {
  try {
    const scheduledTime = DateTime.fromJSDate(scheduledAt).setZone("America/Sao_Paulo");

    const scheduledMessages = getScheduledMessages();

    scheduledMessages.push({
      id: `scheduled_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      payload: {
        ...payload,
        scheduledAt: scheduledTime.toISO(),
      },
      type,
      scheduledAt: scheduledTime.toISO(),
      status: "pending",
    });

    localStorage.setItem("scheduled_messages", JSON.stringify(scheduledMessages));
    window.dispatchEvent(new Event("storage"));
  } catch (error) {
    console.error("Erro ao agendar mensagem:", error);
    throw error;
  }
};
```

#### Fluxo de Campanha em Massa (Não Funciona)

```typescript
// CampaignBuilder.tsx - Linha 200-220
const result = await bulkCampaignService.createCampaign(config, userToken);

if (isScheduled && scheduledDateTime) {
  const luxonDateTime = DateTime.fromJSDate(scheduledDateTime).setZone('America/Sao_Paulo');
  toast.success(`Campanha "${name}" agendada com sucesso!`, {
    description: `Será iniciada em ${luxonDateTime.toFormat("dd/MM/yyyy 'às' HH:mm")}`,
  });
}
```

**bulkCampaignService.createCampaign** envia para o **backend**:

```typescript
// bulkCampaignService.ts - Linha 120-140
async createCampaign(config: CampaignConfig, userToken: string): Promise<{ campaignId: string; status: string }> {
  try {
    const response = await this.api.post<{ campaignId: string; status: string }>(
      this.baseUrl, // 'user/bulk-campaigns'
      config,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      }
    );

    return response.data;
  } catch (error: any) {
    // ...
  }
}
```

### Causa Raiz

**Armazenamento Diferente:**

- **Envio Único**: Salva em `localStorage` com chave `scheduled_messages`
- **Campanha em Massa**: Salva no **backend** via API `/user/bulk-campaigns`

**Aba "Agendados" Lê Apenas localStorage:**

A aba "Agendados" provavelmente está lendo apenas de `localStorage.getItem("scheduled_messages")`, ignorando as campanhas salvas no backend.

### Evidências do Console

```
msgid=161 [log] 🚀 API Request: POST user/bulk-campaigns
msgid=162 [log] ✅ API Response: POST user/bulk-campaigns
msgid=163 [log] 🚀 API Request: GET user/bulk-campaigns/active
msgid=165 [log] ✅ API Response: GET user/bulk-campaigns/active
```

A campanha é criada com sucesso no backend, mas não aparece na aba "Agendados".

## Impacto

### Problema 1 (Input de Hora)
- **Severidade**: 🔴 CRÍTICA
- **Impacto**: Usuários não conseguem agendar mensagens para horários específicos
- **Workaround**: Nenhum confiável
- **Usuários Afetados**: 100% dos que tentam agendar

### Problema 2 (Campanhas Não Aparecem)
- **Severidade**: 🟠 ALTA
- **Impacto**: Usuários não conseguem visualizar/gerenciar campanhas agendadas
- **Workaround**: Verificar diretamente no backend ou aguardar execução
- **Usuários Afetados**: 100% dos que agendam campanhas em massa

## Recomendações de Correção

### Problema 1: Input de Hora

**Solução Proposta:**

1. **Remover estado interno duplicado**: Tornar o componente totalmente controlado
2. **Separar validação de onChange**: Validar apenas quando usuário termina de digitar
3. **Usar onBlur para validação**: Validar quando campo perde foco, não a cada tecla
4. **Remover dependências circulares**: Simplificar useEffect

**Código Sugerido:**

```typescript
export function SchedulingInput({
  value,
  onChange,
  onValidationChange,
  // ...
}: SchedulingInputProps) {
  // Remover estado interno de time, usar apenas value prop
  const [error, setError] = useState<string | null>(null);
  
  // Extrair time do value prop
  const time = value 
    ? DateTime.fromJSDate(value).setZone(timezone).toFormat('HH:mm')
    : '12:00';
  
  const date = value;

  // Validar apenas no onBlur, não a cada mudança
  const handleTimeBlur = () => {
    validateDateTime();
  };

  // Atualizar apenas quando usuário termina
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    if (!date) return;
    
    const [hours, minutes] = newTime.split(':').map(Number);
    const newDateTime = DateTime.fromJSDate(date)
      .setZone(timezone)
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
    
    onChange(newDateTime.toJSDate());
  };

  // Validação simplificada sem debounce
  const validateDateTime = () => {
    if (!date) {
      setError('Selecione uma data');
      onValidationChange?.(false, 'Selecione uma data');
      return false;
    }

    const now = DateTime.now().setZone(timezone);
    const dateTime = DateTime.fromJSDate(date).setZone(timezone);

    if (dateTime <= now) {
      setError('O horário deve ser no futuro');
      onValidationChange?.(false, 'O horário deve ser no futuro');
      return false;
    }

    setError(null);
    onValidationChange?.(true);
    return true;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* ... date input ... */}
      
      <div className="space-y-2">
        <Label htmlFor="schedule-time">Hora</Label>
        <Input
          id="schedule-time"
          type="time"
          value={time}
          onChange={handleTimeChange}
          onBlur={handleTimeBlur}
          disabled={disabled}
          className={cn(error && 'border-destructive')}
        />
      </div>
      
      {/* ... error e summary ... */}
    </div>
  );
}
```

### Problema 2: Campanhas Não Aparecem

**Solução Proposta:**

1. **Unificar fonte de dados**: Aba "Agendados" deve ler de ambas as fontes
2. **Criar função agregadora**: Combinar localStorage + backend
3. **Atualizar componente de listagem**: Exibir ambos os tipos

**Código Sugerido:**

```typescript
// Criar função para buscar todos os agendamentos
async function getAllScheduledItems(userToken: string): Promise<ScheduledItem[]> {
  const items: ScheduledItem[] = [];
  
  // 1. Buscar mensagens únicas do localStorage
  const localMessages = getScheduledMessages();
  items.push(...localMessages.map(msg => ({
    id: msg.id,
    type: 'single' as const,
    scheduledAt: msg.scheduledAt,
    status: msg.status,
    payload: msg.payload
  })));
  
  // 2. Buscar campanhas do backend
  const campaigns = await bulkCampaignService.getActiveCampaigns(userToken);
  const scheduledCampaigns = campaigns.filter(c => 
    c.status === 'scheduled' && c.isScheduled
  );
  
  items.push(...scheduledCampaigns.map(campaign => ({
    id: campaign.id,
    type: 'campaign' as const,
    scheduledAt: campaign.scheduledAt!,
    status: campaign.status,
    name: campaign.name,
    totalContacts: campaign.totalContacts
  })));
  
  // 3. Ordenar por data
  return items.sort((a, b) => 
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}

// Atualizar componente de listagem
function ScheduledMessagesTab({ userToken }: Props) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  
  useEffect(() => {
    async function loadScheduled() {
      const allItems = await getAllScheduledItems(userToken);
      setItems(allItems);
    }
    
    loadScheduled();
    
    // Atualizar quando localStorage mudar
    window.addEventListener('storage', loadScheduled);
    return () => window.removeEventListener('storage', loadScheduled);
  }, [userToken]);
  
  return (
    <div>
      {items.map(item => (
        item.type === 'single' ? (
          <SingleMessageCard key={item.id} message={item} />
        ) : (
          <CampaignCard key={item.id} campaign={item} />
        )
      ))}
    </div>
  );
}
```

## Próximos Passos

1. ✅ Diagnóstico completo realizado
2. ⏳ Atualizar spec com novos requisitos
3. ⏳ Implementar correção do input de hora
4. ⏳ Implementar unificação de agendados
5. ⏳ Testar em múltiplos dispositivos
6. ⏳ Deploy e monitoramento

## Referências

- Spec: `.kiro/specs/scheduling-system-review/`
- Componente: `src/components/shared/forms/SchedulingInput.tsx`
- Envio Único: `src/components/disparador/DisparadorUnico.tsx`
- Campanha: `src/components/disparador/CampaignBuilder.tsx`
- API: `src/lib/api.ts`
- Serviço: `src/services/bulkCampaignService.ts`
