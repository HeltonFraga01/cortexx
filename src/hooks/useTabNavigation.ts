/**
 * useTabNavigation Hook
 * 
 * Gerencia navegação por tabs com persistência na URL.
 * Permite compartilhar links diretos para tabs específicas.
 * 
 * @example
 * const { activeTab, setActiveTab } = useTabNavigation({
 *   defaultTab: 'overview',
 *   validTabs: ['overview', 'webhooks', 'automation']
 * })
 */

import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

interface UseTabNavigationOptions {
  /** Tab padrão quando nenhuma é especificada na URL */
  defaultTab: string
  /** Lista de tabs válidas para validação */
  validTabs: string[]
  /** Nome do parâmetro na URL (default: 'tab') */
  paramName?: string
}

interface UseTabNavigationReturn {
  /** Tab atualmente ativa */
  activeTab: string
  /** Função para mudar a tab ativa */
  setActiveTab: (tabId: string) => void
  /** Verifica se uma tab específica está ativa */
  isActive: (tabId: string) => boolean
}

export function useTabNavigation({
  defaultTab,
  validTabs,
  paramName = 'tab'
}: UseTabNavigationOptions): UseTabNavigationReturn {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Obter tab da URL ou usar default
  const tabParam = searchParams.get(paramName)
  const activeTab = validTabs.includes(tabParam || '') 
    ? tabParam! 
    : defaultTab

  // Limpar parâmetro inválido da URL
  useEffect(() => {
    if (tabParam && !validTabs.includes(tabParam)) {
      setSearchParams(prev => {
        prev.delete(paramName)
        return prev
      }, { replace: true })
    }
  }, [tabParam, validTabs, paramName, setSearchParams])

  // Função para mudar tab
  const setActiveTab = useCallback((tabId: string) => {
    if (!validTabs.includes(tabId)) {
      console.warn(`Invalid tab: ${tabId}. Valid tabs: ${validTabs.join(', ')}`)
      return
    }

    setSearchParams(prev => {
      if (tabId === defaultTab) {
        // Remover parâmetro se for a tab default (URL mais limpa)
        prev.delete(paramName)
      } else {
        prev.set(paramName, tabId)
      }
      return prev
    }, { replace: true })
  }, [validTabs, defaultTab, paramName, setSearchParams])

  // Helper para verificar se tab está ativa
  const isActive = useCallback((tabId: string) => {
    return activeTab === tabId
  }, [activeTab])

  return {
    activeTab,
    setActiveTab,
    isActive
  }
}

export default useTabNavigation
