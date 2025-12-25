/**
 * ModernConnectionCard Component
 * 
 * Card de conexão com design moderno, gradientes baseados no status
 * e seção expansível para detalhes técnicos.
 * 
 * Features:
 * - Gradiente de fundo baseado no status de conexão
 * - Campos copiáveis com feedback visual
 * - Seção "Detalhes" expansível (Collapsible)
 * - Hierarquia visual clara
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { 
  Check, 
  ChevronDown, 
  Copy, 
  Hash, 
  Key, 
  Phone, 
  Wifi, 
  WifiOff 
} from 'lucide-react'
import { toast } from 'sonner'

interface ConnectionInfo {
  id: string
  name: string
  phoneNumber?: string
  jid?: string
  token: string
  isConnected: boolean
  isLoggedIn: boolean
}

interface ModernConnectionCardProps {
  /** Informações da conexão */
  connection: ConnectionInfo
  /** Classes adicionais */
  className?: string
}

/** Retorna classes de gradiente baseado no status */
function getStatusGradient(isLoggedIn: boolean, isConnected: boolean): string {
  if (isLoggedIn) {
    return 'from-green-50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/10'
  }
  if (isConnected) {
    return 'from-yellow-50 to-amber-50/50 dark:from-yellow-950/20 dark:to-amber-950/10'
  }
  return 'from-gray-50 to-slate-50/50 dark:from-gray-950/20 dark:to-slate-950/10'
}

/** Campo copiável com feedback visual */
function CopyableField({ 
  label, 
  value, 
  icon: Icon,
  truncate = false,
  mono = false
}: { 
  label: string
  value: string
  icon: React.ElementType
  truncate?: boolean
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copiado!`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  return (
    <div className="flex items-center gap-3 group">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn(
          "text-sm",
          truncate && "truncate",
          mono && "font-mono"
        )}>
          {value}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity",
          copied && "opacity-100"
        )}
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

export function ModernConnectionCard({ 
  connection, 
  className 
}: ModernConnectionCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const { isLoggedIn, isConnected } = connection

  const gradient = getStatusGradient(isLoggedIn, isConnected)

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className={cn("bg-gradient-to-br", gradient)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Informações da Conexão
            </CardTitle>
            {isLoggedIn ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                <Wifi className="h-3 w-3 mr-1" />
                Logado
              </Badge>
            ) : isConnected ? (
              <Badge variant="secondary">
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Informações principais */}
          <div className="space-y-3">
            {/* ID */}
            <CopyableField
              label="ID da Caixa de Entrada"
              value={connection.id}
              icon={Hash}
              truncate
              mono
            />

            {/* Telefone */}
            {connection.phoneNumber && (
              <CopyableField
                label="Telefone"
                value={connection.phoneNumber}
                icon={Phone}
              />
            )}

            {/* JID simplificado */}
            {connection.jid && (
              <CopyableField
                label="WhatsApp ID"
                value={connection.jid.split('@')[0]}
                icon={Phone}
              />
            )}
          </div>

          {/* Seção expansível de detalhes */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between h-9 px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <span>Detalhes técnicos</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  detailsOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-3 pt-3 border-t mt-2">
              {/* Token */}
              <CopyableField
                label="Token WUZAPI"
                value={connection.token}
                icon={Key}
                truncate
                mono
              />

              {/* JID completo */}
              {connection.jid && (
                <CopyableField
                  label="JID Completo"
                  value={connection.jid}
                  icon={Phone}
                  truncate
                  mono
                />
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Status message */}
          <p className="text-xs text-muted-foreground pt-2 border-t">
            {isLoggedIn 
              ? 'Conectado e autenticado no WhatsApp. Pronto para enviar/receber mensagens.'
              : isConnected 
              ? 'Conectado mas não autenticado. É necessário escanear o QR Code.'
              : 'Não conectado ao WhatsApp. Gere um novo QR Code para conectar.'
            }
          </p>
        </CardContent>
      </div>
    </Card>
  )
}

export default ModernConnectionCard
