# Design Document: Superadmin Panel Fix

## Overview

Este documento descreve o design para corrigir o painel de Superadmin do WUZAPI Manager. A solução envolve criar um layout dedicado para o superadmin com sidebar de navegação, corrigir o fluxo de autenticação e redirecionamento, e implementar tratamento de erros adequado para evitar telas em branco.

A arquitetura segue o padrão já estabelecido no AdminLayout, adaptado para as necessidades específicas do superadmin com navegação simplificada e foco em gerenciamento de tenants.

## Architecture

```mermaid
graph TB
    subgraph Frontend
        App[App.tsx]
        AuthContext[AuthContext]
        ProtectedRoute[ProtectedRoute]
        
        subgraph SuperadminModule
            SuperadminLayout[SuperadminLayout]
            SuperadminSidebar[SuperadminSidebar]
            SuperadminDashboard[SuperadminDashboard]
            TenantManagement[TenantManagement]
            SuperadminSettings[SuperadminSettings]
        end
        
        ErrorBoundary[ErrorBoundary]
    end
    
    subgraph Backend
        AuthRoutes[/api/auth/status]
        SuperadminRoutes[/api/superadmin/*]
    end
    
    App --> AuthContext
    App --> ProtectedRoute
    ProtectedRoute --> SuperadminLayout
    SuperadminLayout --> SuperadminSidebar
    SuperadminLayout --> SuperadminDashboard
    SuperadminLayout --> TenantManagement
    SuperadminLayout --> SuperadminSettings
    
    AuthContext --> AuthRoutes
    SuperadminDashboard --> SuperadminRoutes
    TenantManagement --> SuperadminRoutes
```

## Components and Interfaces

### 1. SuperadminLayout Component

Componente de layout principal que encapsula todas as páginas do superadmin com sidebar e header.

```typescript
// src/components/superadmin/SuperadminLayout.tsx
interface SuperadminLayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/superadmin/dashboard', icon: BarChart3 },
  { name: 'Tenants', href: '/superadmin/tenants', icon: Building2 },
  { name: 'Settings', href: '/superadmin/settings', icon: Settings },
];
```

### 2. SuperadminDashboard Refactored

Componente de dashboard simplificado que usa o novo layout.

```typescript
// src/pages/superadmin/SuperadminDashboard.tsx
interface DashboardMetrics {
  totalMRR: number;
  totalTenants: number;
  activeTenants: number;
  totalAccounts: number;
  activeAccounts: number;
  tenantGrowth: number;
}

interface DashboardState {
  metrics: DashboardMetrics | null;
  tenants: TenantSummary[];
  loading: boolean;
  error: string | null;
}
```

### 3. App.tsx Route Structure

Estrutura de rotas atualizada para usar o SuperadminLayout.

```typescript
// Rotas do Superadmin com layout dedicado
<Route path="/superadmin/*" element={
  <ProtectedRoute requiredRole="superadmin">
    <SuperadminLayout>
      <Routes>
        <Route path="dashboard" element={<SuperadminDashboard />} />
        <Route path="tenants" element={<TenantManagement />} />
        <Route path="tenants/:id" element={<TenantManagement />} />
        <Route path="settings" element={<SuperadminSettings />} />
        <Route path="*" element={<Navigate to="/superadmin/dashboard" />} />
      </Routes>
    </SuperadminLayout>
  </ProtectedRoute>
} />
```

### 4. Error Boundary Component

Componente para capturar erros de renderização e exibir fallback UI.

```typescript
// src/components/shared/SuperadminErrorBoundary.tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

## Data Models

### DashboardMetrics

```typescript
interface DashboardMetrics {
  totalMRR: number;           // Receita mensal recorrente em centavos
  totalTenants: number;       // Total de tenants na plataforma
  activeTenants: number;      // Tenants com status 'active'
  totalAccounts: number;      // Total de contas de usuário
  activeAccounts: number;     // Contas ativas
  tenantGrowth: number;       // Crescimento de tenants no período
}
```

### TenantSummary

```typescript
interface TenantSummary {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended';
  accountCount: number;
  mrr: number;
  lastActivity: string;
  createdAt: string;
}
```

### SuperadminUser

```typescript
interface SuperadminUser {
  id: string;
  role: 'superadmin';
  token: string;
  name: string;
  email?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties have been identified:

### Property 1: Sidebar presence on all superadmin routes
*For any* superadmin route (dashboard, tenants, settings), when the page renders, the sidebar navigation component SHALL be present in the DOM.
**Validates: Requirements 1.1**

### Property 2: Active navigation link highlighting
*For any* navigation item in the sidebar, when the current URL matches the item's href, that item SHALL have the active visual state (active CSS class applied).
**Validates: Requirements 1.4**

### Property 3: Client-side navigation without reload
*For any* navigation link click in the sidebar, the navigation SHALL occur via React Router without triggering a full page reload (window.location should not change via assignment).
**Validates: Requirements 1.3**

### Property 4: Tenant list displays all required fields
*For any* tenant displayed in the tenant list, the rendered output SHALL contain the tenant's name, subdomain, status, account count, and MRR.
**Validates: Requirements 3.2**

### Property 5: Superadmin role stored after successful login
*For any* successful superadmin login, the AuthContext user object SHALL have role equal to "superadmin".
**Validates: Requirements 4.2**

### Property 6: Protected route redirect for unauthenticated access
*For any* protected superadmin route, when accessed without authentication (user is null), the system SHALL redirect to /superadmin/login.
**Validates: Requirements 4.3**

### Property 7: Superadmin role grants access to superadmin routes
*For any* user with role "superadmin", accessing any superadmin route SHALL NOT trigger a redirect to login or access denied.
**Validates: Requirements 4.5**

### Property 8: API errors trigger toast notifications
*For any* API call that returns an error response, a toast notification SHALL be displayed with the error message.
**Validates: Requirements 5.2**

### Property 9: Errors are logged to console
*For any* error that occurs in the superadmin panel, the error details SHALL be logged to the console.
**Validates: Requirements 5.5**

## Error Handling

### Frontend Error Handling

1. **Error Boundary**: Wrap SuperadminLayout content with ErrorBoundary to catch rendering errors
2. **API Error Handling**: All fetch calls wrapped in try-catch with toast notifications
3. **Loading States**: Show skeleton loaders during data fetching
4. **Session Expiration**: Detect 401 responses and redirect to login

```typescript
// Error handling pattern for API calls
const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/superadmin/dashboard', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        toast.error('Session expired. Please login again');
        navigate('/superadmin/login');
        return;
      }
      throw new Error(`Failed to load data: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success) {
      setMetrics(data.data);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    setError(error.message);
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};
```

### Backend Error Handling

1. **Authentication Middleware**: Return 401 for unauthenticated requests
2. **Authorization Middleware**: Return 403 for non-superadmin access
3. **Structured Error Responses**: Always return `{ success: false, error: string }`

## Testing Strategy

### Unit Tests

Unit tests will verify individual component behavior:

1. **SuperadminLayout**: Renders sidebar and children correctly
2. **SuperadminSidebar**: Renders all navigation items, highlights active item
3. **SuperadminDashboard**: Renders metrics cards, handles loading/error states
4. **ErrorBoundary**: Catches errors and displays fallback UI

### Property-Based Tests

Property-based tests will use **fast-check** library to verify correctness properties across many inputs:

1. **Navigation highlighting**: For any valid route, the correct nav item is highlighted
2. **Tenant list rendering**: For any tenant data, all required fields are displayed
3. **Auth context role**: For any successful login response, role is correctly set
4. **Error toast display**: For any error response, toast is triggered

### Integration Tests

Integration tests will verify end-to-end flows:

1. **Login flow**: Submit credentials → redirect to dashboard
2. **Navigation flow**: Click nav item → page changes without reload
3. **Tenant CRUD**: Create tenant → appears in list → delete → removed from list

### Test Configuration

```typescript
// vitest.config.ts - ensure fast-check is available
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

Each property-based test MUST:
- Run a minimum of 100 iterations
- Be tagged with a comment referencing the correctness property: `**Feature: superadmin-panel-fix, Property {number}: {property_text}**`
- Use fast-check arbitraries to generate test inputs
