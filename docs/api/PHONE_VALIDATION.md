# Sistema de Validação de Telefone

## Visão Geral

O WUZAPI Manager implementa validação centralizada de números de telefone em todos os pontos de envio de mensagens, garantindo que o número correto seja sempre usado para comunicação via WhatsApp.

## Fluxo de Validação

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Cliente digita número                                    │
│    Entrada: 5531982547187 (COM o 9)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 2. Sistema normaliza                                        │
│    Saída: 5531982547187 (COM o 9)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 3. validatePhoneWithAPI() - API /user/check                │
│    Entrada: 5531982547187                                  │
│    Retorno: JID = 553182547187@s.whatsapp.net (SEM 9)     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 4. Sistema extrai do JID                                   │
│    Saída: 553182547187 (SEM o 9)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 5. Sistema envia para WUZAPI                               │
│    Endpoint: /chat/send/text                               │
│    Phone: 553182547187 (SEM o 9)                           │
└─────────────────────────────────────────────────────────────┘
```

## Arquitetura

### Serviço Principal

**Arquivo:** `server/services/PhoneValidationService.js`

```javascript
const { validatePhoneWithAPI } = require('./PhoneValidationService');

// Uso
const result = await validatePhoneWithAPI(phone, userToken);
// result: { isValid, validatedPhone, jid, error }
```

### Pontos de Validação

| Ponto | Arquivo | Função |
|-------|---------|--------|
| Envio único (texto) | `server/routes/chatRoutes.js` | `validatePhoneWithAPI` |
| Envio único (imagem) | `server/routes/chatRoutes.js` | `validatePhoneWithAPI` |
| Envio agendado | `server/services/SingleMessageScheduler.js` | `validatePhoneWithAPI` |
| Envio em massa | `server/services/QueueManager.js` | `validatePhoneWithAPI` |
| Teste de permissão | `server/utils/wuzapiValidator.js` | `validatePhoneWithAPI` |

### Utilitários

**Arquivo:** `server/utils/phoneUtils.js`

- `normalizePhoneNumber(phone)` - Normaliza formato do número
- `validatePhoneFormat(phone)` - Validação local de formato

**Arquivo:** `server/utils/phoneErrorMessages.js`

- Mensagens de erro padronizadas para validação

## API

### Validação de Número

```http
POST /api/chat/send/text
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "Phone": "5531982547187",
  "Body": "Mensagem de teste"
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "messageId": "3EB0EE5BB835857F88EC61"
}
```

**Resposta de Erro (número inválido):**
```json
{
  "success": false,
  "error": "Número não está registrado no WhatsApp"
}
```

## Problema do 9 Brasileiro

### Contexto

Números de celular brasileiros podem ter 8 ou 9 dígitos após o DDD:
- **Com 9:** `5531982547187` (formato digitado pelo usuário)
- **Sem 9:** `553182547187` (formato reconhecido pelo WhatsApp)

### Solução

O sistema usa a API WUZAPI `/user/check` para descobrir o formato correto:

1. Usuário digita: `5531982547187`
2. API retorna JID: `553182547187@s.whatsapp.net`
3. Sistema extrai: `553182547187`
4. Mensagem enviada com número correto

## Testes

### Testes Automatizados

```bash
# Executar testes de validação de telefone
npm test --prefix server
```

**Arquivos de teste:**
- `server/tests/phoneUtils.test.js`
- `server/tests/phoneUtils.property.test.js`
- `server/tests/PhoneValidationService.test.js`
- `server/tests/integration/phone-validation-flow.test.js`

## Garantias

1. **Nenhum envio sem validação** - Todos os pontos usam `validatePhoneWithAPI`
2. **Número sempre correto** - Extraído do JID retornado pela API
3. **Suporte a variações** - Cliente pode digitar com ou sem 9
4. **Consistência** - Mesmo comportamento em todos os pontos
5. **Rastreabilidade** - Logs detalhados em cada etapa

## Troubleshooting

### Número não validado

1. Verificar se o número está registrado no WhatsApp
2. Verificar formato do número (deve incluir código do país)
3. Verificar token do usuário
4. Verificar logs do `PhoneValidationService`

### Logs

```bash
# Procurar logs de validação
grep "PhoneValidationService" server/logs/app-*.log
```

### Mensagens de Erro Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Número não está registrado no WhatsApp" | Número não existe no WhatsApp | Verificar número com o cliente |
| "Token inválido" | Token do usuário expirado | Renovar token |
| "Timeout na validação" | API WUZAPI lenta | Tentar novamente |
