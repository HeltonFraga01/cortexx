/**
 * QuotaGate Component
 * 
 * Wrapper component that checks quota before allowing action.
 * Disables action when quota reached and shows upgrade message.
 * 
 * Requirements: 2.6, 3.5, 4.5
 */

import { ReactNode } from 'react'
import { useAgentContext } from '@/contexts/AgentContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Sparkles, TrendingUp } from 'lucide-react'

interface QuotaGateProps {
  quotaType: string
  children: ReactNode
  fallback?: ReactNode
  showUpgradePrompt?: boolean
  title?: string
  description?: string
  /** If true, renders children but disables interactive elements */
  disableOnly?: boolean
}

export function QuotaGate({
  quotaType,
  children,
  fallback,
  showUpgradePrompt = true,
  title,
  description,
  disableOnly = false,
}: QuotaGateProps) {
  const { checkQuota } = useAgentContext()
  
  const quotaStatus = checkQuota(quotaType)

  // If no quota status found or quota is not exceeded, render children normally
  if (!quotaStatus?.exceeded) {
    return <>{children}</>
  }

  // If disableOnly mode, render children with disabled state context
  if (disableOnly) {
    return (
      <QuotaDisabledContext.Provider value={{ disabled: true, quotaType, quotaStatus }}>
        {children}
      </QuotaDisabledContext.Provider>
    )
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>
  }

  // If no upgrade prompt, return null
  if (!showUpgradePrompt) {
    return null
  }

  // Default upgrade prompt
  return (
    <Card className="border-dashed border-destructive/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-lg">
          {title || 'Limite Atingido'}
        </CardTitle>
        <CardDescription>
          {description || `Você atingiu o limite de ${quotaType}. Faça upgrade do seu plano para continuar.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Uso atual</span>
            <span className="font-medium text-destructive">
              {quotaStatus.current} / {quotaStatus.limit}
            </span>
          </div>
          <Progress value={100} className="h-2 bg-destructive/20" />
        </div>
        <div className="text-center">
          <Button variant="default" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Fazer Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Context for quota disabled state
 */
import { createContext, useContext } from 'react'

interface QuotaDisabledContextValue {
  disabled: boolean
  quotaType: string
  quotaStatus: {
    allowed: boolean
    current: number
    limit: number
    percentage: number
    warning: boolean
    exceeded: boolean
  }
}

const QuotaDisabledContext = createContext<QuotaDisabledContextValue | null>(null)

/**
 * Hook to check if quota is disabled in current context
 */
export function useQuotaDisabled(): QuotaDisabledContextValue | null {
  return useContext(QuotaDisabledContext)
}

/**
 * QuotaWarning Component
 * 
 * Shows a warning when quota is near limit (80%+)
 */
interface QuotaWarningProps {
  quotaType: string
  className?: string
}

export function QuotaWarning({ quotaType, className }: QuotaWarningProps) {
  const { checkQuota } = useAgentContext()
  const quotaStatus = checkQuota(quotaType)

  // If no quota status found or not in warning state, don't show warning
  if (!quotaStatus || !quotaStatus.warning || quotaStatus.exceeded) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 ${className}`}>
      <TrendingUp className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-medium">Atenção:</span> Você está usando {quotaStatus.percentage.toFixed(0)}% do limite de {quotaType}.
      </div>
      <Button variant="outline" size="sm" className="text-yellow-800 border-yellow-300 hover:bg-yellow-100">
        <Sparkles className="h-3 w-3 mr-1" />
        Upgrade
      </Button>
    </div>
  )
}

/**
 * Hook to check quota status
 */
export function useQuotaGate(quotaType: string) {
  const { checkQuota } = useAgentContext()
  return checkQuota(quotaType)
}

export default QuotaGate
