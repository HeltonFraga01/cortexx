# ADR 003: Feature-Sliced Design para Frontend

## Status
Proposto (Migração Gradual)

## Contexto
O frontend atual usa estrutura tradicional (components/, pages/, services/). Esta organização não escala bem com a complexidade das regras de negócio.

## Decisão
Migrar gradualmente para Feature-Sliced Design (FSD), organizando código por escopo de negócio e complexidade técnica.

## Estrutura Proposta

### Atual:
```
src/
├── components/
│   ├── admin/
│   ├── user/
│   └── shared/
├── pages/
├── services/
└── hooks/
```

### Proposta (FSD):
```
src/
├── app/              # Inicialização (Providers, Router)
├── pages/            # Composição de rotas
├── widgets/          # Blocos UI complexos (Header, Sidebar)
├── features/         # Casos de uso (SendMessage, ConnectInstance)
├── entities/         # Modelagem de negócio (User, Instance, Message)
└── shared/           # Código reutilizável (UI Kit, API clients)
```

## Hierarquia de Dependências

| Camada   | Pode Importar De                    |
|----------|-------------------------------------|
| app      | Todas as camadas abaixo             |
| pages    | widgets, features, entities, shared |
| widgets  | features, entities, shared          |
| features | entities, shared                    |
| entities | shared                              |
| shared   | Nenhuma (camada base)               |

## Justificativa

### Benefícios:
1. **Dependências Unidirecionais**: Previne ciclos de importação
2. **Isolamento de Features**: Cada feature é auto-contida
3. **Reutilização**: Entities e shared são compartilhados
4. **Escalabilidade**: Complexidade cresce linearmente

### Integração com Shadcn/UI:
Componentes Shadcn residem em `shared/ui/` e são tratados como primitivos "burros" (sem lógica de negócio).

```typescript
// shared/ui/button.tsx - Primitivo sem lógica
export const Button = ({ children, ...props }) => (
  <button {...props}>{children}</button>
);

// features/connect-instance/ui/ConnectButton.tsx - Com lógica
export const ConnectButton = () => {
  const { connect, isConnecting } = useConnectInstance();
  return (
    <Button onClick={connect} disabled={isConnecting}>
      {isConnecting ? 'Conectando...' : 'Conectar'}
    </Button>
  );
};
```

## Plano de Migração

### Fase 1: Criar estrutura shared/
- Mover componentes UI para shared/ui/
- Mover API clients para shared/api/

### Fase 2: Criar entities/
- Extrair modelagem de negócio (User, Instance, Message)

### Fase 3: Criar features/
- Migrar casos de uso (SendMessage, ConnectInstance)

### Fase 4: Criar widgets/
- Compor blocos complexos (Header, Sidebar, InstanceList)

## Consequências

### Positivas:
- Arquitetura mais previsível
- Facilita code splitting
- Melhor testabilidade

### Negativas:
- Esforço de migração significativo
- Mais arquivos e pastas
- Curva de aprendizado

## Referências
- Manual de Engenharia WUZAPI Manager, Seção 4
- Feature-Sliced Design: https://feature-sliced.design/
