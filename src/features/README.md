# Features Layer - Casos de Uso

Esta camada contém interações do usuário com valor de negócio.

## Exemplos

- connect-instance: Conectar instância WhatsApp via QR Code
- send-message: Enviar mensagem individual
- bulk-send: Envio em massa de mensagens
- configure-webhook: Configurar webhooks

## Regras FSD

- **Pode importar de:** entities, shared
- **Não pode importar de:** app, pages, widgets
- **Não pode ser importado por:** entities, shared

## Estrutura de uma Feature

```
features/
├── connect-instance/
│   ├── ui/
│   │   ├── QRCodeScanner.tsx
│   │   └── ConnectButton.tsx
│   ├── model/
│   │   ├── useConnectInstance.ts
│   │   └── connectInstanceStore.ts
│   ├── api/
│   │   └── connectInstanceApi.ts
│   ├── lib/
│   │   └── qrCodeUtils.ts
│   └── index.ts
├── send-message/
│   ├── ui/
│   │   ├── MessageForm.tsx
│   │   └── VariableSelector.tsx
│   ├── model/
│   │   └── useSendMessage.ts
│   ├── api/
│   │   └── sendMessageApi.ts
│   └── index.ts
```

## API Pública

Cada feature expõe apenas o necessário via `index.ts`:

```typescript
// features/connect-instance/index.ts
export { QRCodeScanner } from './ui/QRCodeScanner';
export { ConnectButton } from './ui/ConnectButton';
export { useConnectInstance } from './model/useConnectInstance';
```

## Referências

- Manual de Engenharia WUZAPI Manager, Seção 4.2
- Feature-Sliced Design: https://feature-sliced.design/
