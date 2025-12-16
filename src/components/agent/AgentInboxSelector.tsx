/**
 * AgentInboxSelector Component
 * Allows agents to select inboxes they have access to for campaigns
 * Uses agent-specific API to fetch only permitted inboxes
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  Inbox as InboxIcon, 
  Phone, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { getAgentInboxes, type AgentInbox } from '@/services/agent-messaging'

export interface SelectedInbox {
  id: string
  name: string
  phoneNumber?: string
  wuzapiToken?: string
  connected: boolean
}

interface AgentInboxSelectorProps {
  selectedInboxes: SelectedInbox[]
  onSelectionChange: (inboxes: SelectedInbox[]) => void
  minSelection?: number
  maxSelection?: number
}

export function AgentInboxSelector({
  selectedInboxes,
  onSelectionChange,
  minSelection = 1,
  maxSelection,
}: AgentInboxSelectorProps) {
  const [inboxes, setInboxes] = useState<AgentInbox[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInboxes = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getAgentInboxes()
      setInboxes(data)
      
      // Auto-select first connected inbox if none selected
      if (selectedInboxes.length === 0 && data.length > 0) {
        const connectedInbox = data.find(i => i.connected)
        if (connectedInbox) {
          onSelectionChange([{
            id: connectedInbox.id,
            name: connectedInbox.name,
            phoneNumber: connectedInbox.phoneNumber,
            wuzapiToken: connectedInbox.wuzapiToken,
            connected: connectedInbox.connected,
          }])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar caixas de entrada')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInboxes()
  }, [])

  const handleToggleInbox = (inbox: AgentInbox) => {
    const isSelected = selectedInboxes.some(s => s.id === inbox.id)
    
    if (isSelected) {
      if (selectedInboxes.length <= minSelection) return
      onSelectionChange(selectedInboxes.filter(s => s.id !== inbox.id))
    } else {
      if (maxSelection && selectedInboxes.length >= maxSelection) return
      onSelectionChange([
        ...selectedInboxes,
        {
          id: inbox.id,
          name: inbox.name,
          phoneNumber: inbox.phoneNumber,
          wuzapiToken: inbox.wuzapiToken,
          connected: inbox.connected,
        },
      ])
    }
  }

  const getStatusBadge = (inbox: AgentInbox) => {
    if (inbox.connected) {
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Conectado
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">
        <XCircle className="h-3 w-3 mr-1" />
        Desconectado
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchInboxes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (inboxes.length === 0) {
    return (
      <Alert>
        <InboxIcon className="h-4 w-4" />
        <AlertDescription>
          Nenhuma caixa de entrada disponível. Solicite acesso ao administrador.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InboxIcon className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Caixas de Entrada</h3>
        </div>
        <Badge variant="outline">
          {selectedInboxes.length} selecionada{selectedInboxes.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Selecione qual caixa de entrada será usada para enviar as mensagens.
      </p>

      <div className="grid gap-3">
        {inboxes.map((inbox) => {
          const isSelected = selectedInboxes.some(s => s.id === inbox.id)
          const isDisabled = !inbox.connected
          
          return (
            <Card
              key={inbox.id}
              className={`cursor-pointer transition-all ${
                isSelected 
                  ? 'border-primary bg-primary/5' 
                  : isDisabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:border-primary/50'
              }`}
              onClick={() => !isDisabled && handleToggleInbox(inbox)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={() => !isDisabled && handleToggleInbox(inbox)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{inbox.name}</span>
                      {getStatusBadge(inbox)}
                    </div>
                    
                    {inbox.phoneNumber && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        <span>{inbox.phoneNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {isDisabled && (
                  <p className="text-xs text-muted-foreground mt-2 ml-10">
                    Esta caixa de entrada precisa estar conectada para ser usada.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedInboxes.length === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selecione pelo menos uma caixa de entrada conectada para continuar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default AgentInboxSelector
