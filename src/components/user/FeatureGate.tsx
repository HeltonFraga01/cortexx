/**
 * FeatureGate Component
 * 
 * Wrapper component that checks feature access and shows lock/upgrade message for disabled features.
 * 
 * Requirements: 7.2, 7.3
 */

import { ReactNode } from 'react'
import { useAgentContext } from '@/contexts/AgentContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock, Sparkles } from 'lucide-react'

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
  showUpgradePrompt?: boolean
  title?: string
  description?: string
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  title,
  description,
}: FeatureGateProps) {
  const { isFeatureEnabled } = useAgentContext()
  
  const enabled = isFeatureEnabled(feature)

  if (enabled) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showUpgradePrompt) {
    return null
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">
          {title || 'Funcionalidade Bloqueada'}
        </CardTitle>
        <CardDescription>
          {description || 'Esta funcionalidade não está disponível no seu plano atual.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button variant="default" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Fazer Upgrade
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Hook to check if a feature is enabled
 */
export function useFeatureGate(feature: string): boolean {
  const { isFeatureEnabled } = useAgentContext()
  return isFeatureEnabled(feature)
}

export default FeatureGate
