import '@testing-library/jest-dom'

// Mock do environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    DEV: true,
    VITE_API_BASE_URL: '/api',
    VITE_APP_NAME: 'WhatsApp Manager'
  }
})

// Mock do fetch global
global.fetch = vi.fn()

// Mock do window.confirm e window.alert
Object.defineProperty(window, 'confirm', {
  value: vi.fn(() => true)
})

Object.defineProperty(window, 'alert', {
  value: vi.fn()
})

// Mock do localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock do sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
})

// Usar o URL nativo do Node.js para testes
import { URL } from 'url'
global.URL = URL