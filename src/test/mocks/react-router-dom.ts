import { vi } from 'vitest'
import React from 'react'

export const mockNavigate = vi.fn()
export const mockUseParams = vi.fn()

export const useNavigate = () => mockNavigate
export const useParams = () => mockUseParams()

export const BrowserRouter = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'browser-router' }, children)
export const Routes = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'routes' }, children)
export const Route = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'route' }, children)