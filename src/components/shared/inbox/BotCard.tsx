/**
 * BotCard Component
 * 
 * Card visual para seleção de bot com highlight quando selecionado.
 * Exibe avatar, nome, tipo e status do bot.
 * 
 * Features:
 * - Highlight visual quando selecionado (ring-2 ring-primary)
 * - Badge "Ativo" no bot selecionado
 * - Badge de status (ativo/pausado)
 * - Hover effect com shadow
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Bot, Check, Loader2 } from 'lucide-react'

export interface BotInfo {
  id: string
  name: string
  description?: string | null
  botType?: string | null
  status?: 'active' | 'paused' | string | null
  avatarUrl?: string | null
}

interface BotCardProps {
  /** Informações do bot */
  bot: BotInfo
  /** Se este bot está selecionado */
  isSelected: boolean
  /** Callback quando o card é clicado */
  onSelect: () => void
  /** Se está carregando (salvando seleção) */
  isLoading?: boolean
  /** Classes adicionais */
  className?: string
}

export function BotCard({ 
  bot, 
  isSelected, 
  onSelect, 
  isLoading = false,
  className 
}: BotCardProps) {
  const isPaused = bot.status === 'paused'

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        isSelected && "ring-2 ring-primary border-primary shadow-md",
        isLoading && "opacity-60 pointer-events-none",
        className
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className={cn(
            "h-12 w-12 flex-shrink-0",
            isSelected && "ring-2 ring-primary ring-offset-2"
          )}>
            {bot.avatarUrl ? (
              <AvatarImage src={bot.avatarUrl} alt={bot.name} />
            ) : null}
            <AvatarFallback className={cn(
              isSelected 
                ? "bg-primary/10 text-primary" 
                : "bg-muted"
            )}>
              <Bot className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{bot.name}</span>
              {isSelected && (
                <Badge variant="default" className="text-xs h-5">
                  Ativo
                </Badge>
              )}
              {isPaused && (
                <Badge variant="secondary" className="text-xs h-5">
                  Pausado
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              {bot.botType || 'webhook'}
            </p>
            
            {bot.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {bot.description}
              </p>
            )}
          </div>

          {/* Selection indicator */}
          <div className="flex-shrink-0">
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : isSelected ? (
              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default BotCard
