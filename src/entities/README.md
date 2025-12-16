# Entities Layer - Modelagem de Negócio

Esta camada contém a visualização de dados de negócio.

## Exemplos

- user: Dados e visualização de usuário
- instance: Dados e status de instância WhatsApp
- message: Dados e visualização de mensagem
- contact: Dados e visualização de contato

## Regras FSD

- **Pode importar de:** shared
- **Não pode importar de:** app, pages, widgets, features
- **Não pode ser importado por:** shared

## Estrutura de uma Entity

```
entities/
├── user/
│   ├── ui/
│   │   ├── UserCard.tsx
│   │   └── UserAvatar.tsx
│   ├── model/
│   │   ├── types.ts
│   │   └── userStore.ts
│   ├── api/
│   │   └── userApi.ts
│   └── index.ts
├── instance/
│   ├── ui/
│   │   ├── InstanceCard.tsx
│   │   └── InstanceStatus.tsx
│   ├── model/
│   │   ├── types.ts
│   │   └── instanceStore.ts
│   └── index.ts
├── message/
│   ├── ui/
│   │   ├── MessageBubble.tsx
│   │   └── MessageStatus.tsx
│   ├── model/
│   │   └── types.ts
│   └── index.ts
```

## Tipos de Domínio

Cada entity define seus tipos em `model/types.ts`:

```typescript
// entities/instance/model/types.ts
export interface Instance {
  id: string;
  name: string;
  phone: string;
  status: 'connected' | 'disconnected' | 'connecting';
  qrCode?: string;
  createdAt: Date;
}

export interface InstanceStatus {
  isConnected: boolean;
  lastSeen?: Date;
  batteryLevel?: number;
}
```

## Referências

- Manual de Engenharia WUZAPI Manager, Seção 4.1
- Feature-Sliced Design: https://feature-sliced.design/
