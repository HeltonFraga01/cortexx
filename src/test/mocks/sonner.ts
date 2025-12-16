import { vi } from 'vitest'

export const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
}

export const Toaster = () => null