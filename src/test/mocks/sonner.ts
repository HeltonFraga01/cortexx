import { vi } from 'vitest'

// Mock the base toast function that can be called directly
const baseMock = vi.fn()

// Create a callable mock with methods attached
export const toast = Object.assign(baseMock, {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  promise: vi.fn(),
  dismiss: vi.fn(),
  custom: vi.fn(),
  message: vi.fn(),
})

export const Toaster = () => null
