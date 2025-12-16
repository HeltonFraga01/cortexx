import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock dos componentes de UI que podem causar problemas nos testes
vi.mock('sonner', () => import('./mocks/sonner'))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    ...await import('./mocks/react-router-dom')
  }
})

// Wrapper para testes que precisam de providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Mock data para testes
export const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  token: 'test-token-123',
  webhook: 'https://example.com/webhook',
  events: 'Message,Receipt',
  connected: true,
  loggedIn: true,
  jid: '5511999999999:49@s.whatsapp.net',
  qrcode: '',
  expiration: 0,
  proxy_config: {
    enabled: false,
    proxy_url: ''
  },
  s3_config: {
    enabled: false,
    endpoint: '',
    region: '',
    bucket: '',
    access_key: '',
    path_style: false,
    public_url: '',
    media_delivery: 'base64',
    retention_days: 30
  }
}

export const mockUsers = [mockUser]

// Mock do WuzAPIService
export const mockWuzAPIService = {
  getUsers: vi.fn().mockResolvedValue(mockUsers),
  getUser: vi.fn().mockResolvedValue(mockUser),
  updateWebhook: vi.fn().mockResolvedValue({ success: true }),
  deleteUser: vi.fn().mockResolvedValue({ success: true }),
  deleteUserFull: vi.fn().mockResolvedValue({ success: true }),
  getQRCode: vi.fn().mockResolvedValue({ QRCode: 'mock-qr-code' }),
  connectSession: vi.fn().mockResolvedValue({ success: true })
}

// Mock do BrandingService
export const mockBrandingService = {
  getBrandingConfig: vi.fn(),
  updateBrandingConfig: vi.fn(),
  validateBrandingConfig: vi.fn(),
  getLocalConfig: vi.fn(),
  saveLocalConfig: vi.fn(),
  clearLocalConfig: vi.fn(),
  clearCache: vi.fn(),
  refreshConfig: vi.fn(),
  preloadConfig: vi.fn().mockResolvedValue(),
}