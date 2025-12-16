# Shared Layer - Código Reutilizável

Esta é a camada base do Feature-Sliced Design, contendo código reutilizável por todas as outras camadas.

## Conteúdo

- **ui/**: Componentes UI primitivos (Shadcn/UI)
- **api/**: Clientes API genéricos
- **lib/**: Utilitários e helpers
- **config/**: Configurações globais
- **types/**: Tipos TypeScript compartilhados

## Regras FSD

- **Pode importar de:** Nenhuma outra camada (é a camada base)
- **Pode ser importado por:** Todas as outras camadas

## Estrutura

```
shared/
├── ui/
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   └── ... (componentes Shadcn)
├── api/
│   ├── apiClient.ts
│   ├── wuzapiClient.ts
│   └── nocodbClient.ts
├── lib/
│   ├── utils.ts
│   ├── formatters.ts
│   └── validators.ts
├── config/
│   └── constants.ts
└── types/
    └── common.ts
```

## Regra de Ouro para UI

Componentes em `shared/ui/` devem ser "burros":
- ❌ NÃO devem conter lógica de negócio
- ❌ NÃO devem importar de entities ou features
- ✅ Devem ser puramente visuais e reutilizáveis

```typescript
// ✅ Correto - Componente "burro"
export const Button = ({ children, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

// ❌ Errado - Componente com lógica de negócio
export const ConnectButton = () => {
  const { connect, isConnecting } = useConnectInstance(); // ❌ Importa de features
  return <button onClick={connect}>{isConnecting ? 'Conectando...' : 'Conectar'}</button>;
};
```

Se um componente precisa de lógica de negócio, ele deve estar em `features/` ou `entities/`.

## Integração com Shadcn/UI

Os componentes Shadcn residem em `shared/ui/` e são tratados como primitivos do projeto:

```typescript
// Importação de componente Shadcn
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Dialog } from '@/shared/ui/dialog';
```

## Referências

- Manual de Engenharia WUZAPI Manager, Seção 4.3
- Feature-Sliced Design: https://feature-sliced.design/
- Shadcn/UI: https://ui.shadcn.com/
