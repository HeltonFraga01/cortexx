import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrandingProvider } from '@/contexts/BrandingContext'
import { AuthProvider } from '@/contexts/AuthContext'

// Enhanced wrapper for integration tests
const IntegrationTestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <BrandingProvider>
            {children}
          </BrandingProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: IntegrationTestWrapper, ...options })

export * from '@testing-library/react'
export { renderWithProviders as render }

// Mock API responses for integration tests
export const mockApiResponses = {
  users: {
    success: [
      {
        id: 'user-1',
        name: 'Test User 1',
        token: 'token-123',
        webhook: 'https://example.com/webhook1',
        events: 'Message,Receipt',
        connected: true,
        loggedIn: true,
        jid: '5511999999999:49@s.whatsapp.net',
      },
      {
        id: 'user-2',
        name: 'Test User 2',
        token: 'token-456',
        webhook: 'https://example.com/webhook2',
        events: 'Message',
        connected: false,
        loggedIn: false,
        jid: '',
      }
    ],
    error: {
      success: false,
      error: 'Failed to fetch users',
    }
  },
  
  branding: {
    success: {
      success: true,
      data: {
        // Valor de teste fixo para garantir consistência nos testes
        // Em produção, este valor vem do banco de dados ou variável de ambiente
        appName: 'WUZAPI Manager',
        logoUrl: null,
        primaryColor: '#3b82f6',
        secondaryColor: '#64748b',
      }
    },
    error: {
      success: false,
      error: 'Failed to fetch branding config',
    }
  },
  
  auth: {
    validAdmin: {
      success: true,
      isAdmin: true,
    },
    validUser: {
      success: true,
      isUser: true,
    },
    invalid: {
      success: false,
      error: 'Invalid token',
    }
  }
}

// Helper to setup API mocks
export const setupApiMocks = () => {
  // Mock fetch globally
  global.fetch = vi.fn()
  
  const mockFetch = global.fetch as any
  
  // Default successful responses
  mockFetch.mockImplementation((url: string, options?: RequestInit) => {
    const method = options?.method || 'GET'
    
    // Admin users endpoint
    if (url.includes('/api/admin/users') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponses.users.success),
      })
    }
    
    // User update endpoint
    if (url.includes('/api/admin/users/') && method === 'PUT') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, message: 'User updated' }),
      })
    }
    
    // Branding config endpoint
    if (url.includes('/api/branding/config') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponses.branding.success),
      })
    }
    
    // Branding update endpoint
    if (url.includes('/api/branding/config') && method === 'PUT') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, message: 'Branding updated' }),
      })
    }
    
    // Auth validation endpoints
    if (url.includes('/api/auth/validate-admin')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponses.auth.validAdmin),
      })
    }
    
    if (url.includes('/api/auth/validate-user')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponses.auth.validUser),
      })
    }
    
    // Default fallback
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    })
  })
  
  return mockFetch
}

// Helper to mock API errors
export const mockApiError = (endpoint: string, error: any) => {
  const mockFetch = global.fetch as any
  
  mockFetch.mockImplementation((url: string) => {
    if (url.includes(endpoint)) {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve(error),
      })
    }
    
    // Call original implementation for other endpoints
    return mockFetch.mockImplementation.call(this, url)
  })
}

// Helper to wait for async operations
export const waitForAsyncOperations = () => {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// Helper to simulate user interactions
export const simulateUserFlow = {
  async fillForm(fields: Record<string, string>) {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    
    for (const [name, value] of Object.entries(fields)) {
      const input = document.querySelector(`[name="${name}"]`) as HTMLInputElement
      if (input) {
        await user.clear(input)
        await user.type(input, value)
      }
    }
  },
  
  async clickButton(text: string) {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    const { screen } = await import('@testing-library/react')
    
    const button = screen.getByText(text)
    await user.click(button)
  },
  
  async selectOption(selectName: string, optionValue: string) {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    
    const select = document.querySelector(`[name="${selectName}"]`) as HTMLSelectElement
    if (select) {
      await user.selectOptions(select, optionValue)
    }
  }
}