/**
 * Utilitários de teste para componentes React
 * 
 * Este arquivo contém funções auxiliares específicas para testes
 * de componentes React, incluindo renderização, interações e validações
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

// Tipos para TypeScript
interface RenderOptions {
  initialEntries?: string[]
  queryClient?: QueryClient
  wrapper?: React.ComponentType<any>
}

interface FormField {
  label?: string
  name?: string
  testId?: string
  value: string
  type?: 'input' | 'select' | 'textarea' | 'checkbox' | 'radio'
}

interface MockApiResponse {
  success: boolean
  data?: any
  error?: string
  status?: number
}

/**
 * Wrapper customizado para renderização de componentes
 */
export const createTestWrapper = (options: RenderOptions = {}) => {
  const queryClient = options.queryClient || new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )

  return TestWrapper
}

/**
 * Renderizar componente com providers necessários
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  options: RenderOptions = {}
) => {
  const Wrapper = createTestWrapper(options)
  return render(ui, { wrapper: Wrapper, ...options })
}

/**
 * Helpers para interação com formulários
 */
export class FormTestHelpers {
  private user = userEvent.setup()

  /**
   * Preencher campo de formulário
   */
  async fillField(field: FormField) {
    let element: HTMLElement

    // Encontrar elemento por diferentes estratégias
    if (field.testId) {
      element = screen.getByTestId(field.testId)
    } else if (field.label) {
      element = screen.getByLabelText(field.label)
    } else if (field.name) {
      element = screen.getByRole('textbox', { name: field.name })
    } else {
      throw new Error('Field identifier (label, name, or testId) is required')
    }

    // Interagir baseado no tipo
    switch (field.type) {
      case 'select':
        await this.user.selectOptions(element, field.value)
        break
      case 'checkbox':
        if (field.value === 'true' || field.value === true) {
          await this.user.click(element)
        }
        break
      case 'radio':
        await this.user.click(element)
        break
      default:
        await this.user.clear(element)
        await this.user.type(element, field.value)
    }
  }

  /**
   * Preencher múltiplos campos
   */
  async fillForm(fields: FormField[]) {
    for (const field of fields) {
      await this.fillField(field)
    }
  }

  /**
   * Submeter formulário
   */
  async submitForm(submitButtonText = 'Submit') {
    const submitButton = screen.getByRole('button', { name: submitButtonText })
    await this.user.click(submitButton)
  }

  /**
   * Validar erros de formulário
   */
  expectFormErrors(expectedErrors: string[]) {
    expectedErrors.forEach(error => {
      expect(screen.getByText(error)).toBeInTheDocument()
    })
  }

  /**
   * Validar que não há erros
   */
  expectNoFormErrors() {
    const errorElements = screen.queryAllByRole('alert')
    expect(errorElements).toHaveLength(0)
  }
}

/**
 * Helpers para testes de acessibilidade
 */
export class AccessibilityTestHelpers {
  /**
   * Verificar navegação por teclado
   */
  async testKeyboardNavigation(expectedFocusOrder: string[]) {
    const user = userEvent.setup()
    
    for (let i = 0; i < expectedFocusOrder.length; i++) {
      await user.tab()
      const focusedElement = document.activeElement
      
      if (expectedFocusOrder[i].startsWith('role:')) {
        const role = expectedFocusOrder[i].replace('role:', '')
        expect(focusedElement).toHaveAttribute('role', role)
      } else {
        expect(focusedElement).toHaveAttribute('data-testid', expectedFocusOrder[i])
      }
    }
  }

  /**
   * Verificar ARIA labels
   */
  expectAriaLabels(elements: Array<{ selector: string; expectedLabel: string }>) {
    elements.forEach(({ selector, expectedLabel }) => {
      const element = screen.getByTestId(selector)
      expect(element).toHaveAttribute('aria-label', expectedLabel)
    })
  }

  /**
   * Verificar anúncios para screen readers
   */
  expectScreenReaderAnnouncement(message: string) {
    const liveRegion = screen.getByRole('status') || screen.getByRole('alert')
    expect(liveRegion).toHaveTextContent(message)
  }

  /**
   * Verificar contraste de cores (simulado)
   */
  expectSufficientContrast(elementTestId: string) {
    const element = screen.getByTestId(elementTestId)
    const styles = window.getComputedStyle(element)
    
    // Verificação básica - em um ambiente real, usaria uma biblioteca específica
    expect(styles.color).not.toBe(styles.backgroundColor)
  }
}

/**
 * Helpers para mocks de API
 */
export class ApiMockHelpers {
  private mockFetch: any

  constructor() {
    this.mockFetch = vi.fn()
    global.fetch = this.mockFetch
  }

  /**
   * Configurar resposta de sucesso
   */
  mockSuccessResponse(endpoint: string, data: any, status = 200) {
    this.mockFetch.mockImplementation((url: string) => {
      if (url.includes(endpoint)) {
        return Promise.resolve({
          ok: true,
          status,
          json: () => Promise.resolve({
            success: true,
            data
          })
        })
      }
      return this.mockFetch.mockImplementation.call(this, url)
    })
  }

  /**
   * Configurar resposta de erro
   */
  mockErrorResponse(endpoint: string, error: string, status = 500) {
    this.mockFetch.mockImplementation((url: string) => {
      if (url.includes(endpoint)) {
        return Promise.resolve({
          ok: false,
          status,
          json: () => Promise.resolve({
            success: false,
            error
          })
        })
      }
      return this.mockFetch.mockImplementation.call(this, url)
    })
  }

  /**
   * Configurar resposta com delay
   */
  mockDelayedResponse(endpoint: string, data: any, delay = 100) {
    this.mockFetch.mockImplementation((url: string) => {
      if (url.includes(endpoint)) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({
                success: true,
                data
              })
            })
          }, delay)
        })
      }
      return this.mockFetch.mockImplementation.call(this, url)
    })
  }

  /**
   * Verificar se endpoint foi chamado
   */
  expectEndpointCalled(endpoint: string, times = 1) {
    const calls = this.mockFetch.mock.calls.filter((call: any) => 
      call[0].includes(endpoint)
    )
    expect(calls).toHaveLength(times)
  }

  /**
   * Verificar payload da requisição
   */
  expectRequestPayload(endpoint: string, expectedPayload: any) {
    const call = this.mockFetch.mock.calls.find((call: any) => 
      call[0].includes(endpoint)
    )
    
    if (call && call[1] && call[1].body) {
      const actualPayload = JSON.parse(call[1].body)
      expect(actualPayload).toEqual(expectedPayload)
    } else {
      throw new Error(`No request found for endpoint: ${endpoint}`)
    }
  }

  /**
   * Resetar mocks
   */
  reset() {
    this.mockFetch.mockReset()
  }
}

/**
 * Helpers para testes de estado de loading
 */
export class LoadingStateHelpers {
  /**
   * Aguardar elemento aparecer
   */
  async waitForElement(text: string, timeout = 1000) {
    await waitFor(() => {
      expect(screen.getByText(text)).toBeInTheDocument()
    }, { timeout })
  }

  /**
   * Aguardar elemento desaparecer
   */
  async waitForElementToDisappear(text: string, timeout = 1000) {
    await waitFor(() => {
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    }, { timeout })
  }

  /**
   * Verificar estado de loading
   */
  expectLoadingState(isLoading = true) {
    if (isLoading) {
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    } else {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    }
  }

  /**
   * Verificar botão desabilitado durante loading
   */
  expectDisabledButton(buttonText: string) {
    const button = screen.getByRole('button', { name: buttonText })
    expect(button).toBeDisabled()
  }
}

/**
 * Helpers para testes de componentes de lista
 */
export class ListTestHelpers {
  /**
   * Verificar itens da lista
   */
  expectListItems(items: string[]) {
    items.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  }

  /**
   * Verificar lista vazia
   */
  expectEmptyList(emptyMessage = 'No items found') {
    expect(screen.getByText(emptyMessage)).toBeInTheDocument()
  }

  /**
   * Testar paginação
   */
  async testPagination(nextButtonText = 'Next', prevButtonText = 'Previous') {
    const user = userEvent.setup()
    
    // Clicar em próxima página
    const nextButton = screen.getByRole('button', { name: nextButtonText })
    await user.click(nextButton)
    
    // Verificar se botão anterior está habilitado
    const prevButton = screen.getByRole('button', { name: prevButtonText })
    expect(prevButton).not.toBeDisabled()
  }

  /**
   * Testar filtros
   */
  async testFilter(filterInput: string, filterValue: string, expectedResults: string[]) {
    const user = userEvent.setup()
    
    const input = screen.getByLabelText(filterInput)
    await user.type(input, filterValue)
    
    // Aguardar resultados filtrados
    await waitFor(() => {
      expectedResults.forEach(result => {
        expect(screen.getByText(result)).toBeInTheDocument()
      })
    })
  }
}

/**
 * Helpers para testes de modal/dialog
 */
export class ModalTestHelpers {
  /**
   * Verificar se modal está aberto
   */
  expectModalOpen(modalTitle?: string) {
    const modal = screen.getByRole('dialog')
    expect(modal).toBeInTheDocument()
    
    if (modalTitle) {
      expect(within(modal).getByText(modalTitle)).toBeInTheDocument()
    }
  }

  /**
   * Verificar se modal está fechado
   */
  expectModalClosed() {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }

  /**
   * Fechar modal
   */
  async closeModal(closeButtonText = 'Close') {
    const user = userEvent.setup()
    const closeButton = screen.getByRole('button', { name: closeButtonText })
    await user.click(closeButton)
  }

  /**
   * Fechar modal com ESC
   */
  async closeModalWithEscape() {
    const user = userEvent.setup()
    await user.keyboard('{Escape}')
  }

  /**
   * Fechar modal clicando fora
   */
  async closeModalByClickingOutside() {
    const modal = screen.getByRole('dialog')
    fireEvent.click(modal.parentElement!)
  }
}

/**
 * Factory para criar helpers de teste
 */
export class ComponentTestHelpersFactory {
  static create() {
    return {
      form: new FormTestHelpers(),
      accessibility: new AccessibilityTestHelpers(),
      api: new ApiMockHelpers(),
      loading: new LoadingStateHelpers(),
      list: new ListTestHelpers(),
      modal: new ModalTestHelpers(),
    }
  }
}

/**
 * Hook personalizado para testes
 */
export const useTestHelpers = () => {
  return ComponentTestHelpersFactory.create()
}

// Exportar helpers individuais
export {
  FormTestHelpers,
  AccessibilityTestHelpers,
  ApiMockHelpers,
  LoadingStateHelpers,
  ListTestHelpers,
  ModalTestHelpers,
}