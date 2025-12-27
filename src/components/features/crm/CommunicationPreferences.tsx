/**
 * CommunicationPreferences Component
 * 
 * Toggle for opt-in/opt-out with status indicator.
 * 
 * Requirements: 5.1, 5.5, 5.6 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, BellOff, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommunicationPreferences as CommunicationPreferencesType } from '@/types/crm'

interface CommunicationPreferencesProps {
  preferences: CommunicationPreferencesType
  isLoading?: boolean
  onUpdate?: (optIn: boolean) => Promise<void>
}

export function CommunicationPreferences({
  preferences,
  isLoading,
  onUpdate
}: CommunicationPreferencesProps) {
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setIsSaving(true)
    try {
      await onUpdate?.(checked)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Preferências</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    )
  }

  const { bulkMessagingOptIn, optOutAt, optOutMethod } = preferences

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {bulkMessagingOptIn ? (
            <Bell className="h-4 w-4 text-green-600" />
          ) : (
            <BellOff className="h-4 w-4 text-red-600" />
          )}
          Preferências de Comunicação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="bulk-opt-in" className="text-sm font-medium">
              Mensagens em Massa
            </Label>
            <p className="text-xs text-muted-foreground">
              Receber campanhas e mensagens promocionais
            </p>
          </div>
          <Switch
            id="bulk-opt-in"
            checked={bulkMessagingOptIn}
            onCheckedChange={handleToggle}
            disabled={isSaving}
          />
        </div>

        {!bulkMessagingOptIn && optOutAt && (
          <div className={cn(
            'p-3 rounded-lg border',
            'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
          )}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Opt-out ativo
                </p>
                <p className="text-xs text-red-600 dark:text-red-500">
                  Data: {new Date(optOutAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                {optOutMethod && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Via: {optOutMethod === 'keyword' ? 'Palavra-chave' : 
                          optOutMethod === 'manual' ? 'Manual' : optOutMethod}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {bulkMessagingOptIn && (
          <div className={cn(
            'p-3 rounded-lg border',
            'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
          )}>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">
                Contato pode receber mensagens em massa
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CommunicationPreferences
