/**
 * BotGrid Component
 * 
 * Grid responsivo de BotCards para seleção de bot.
 * Inclui opção "Nenhum bot" e empty state.
 * 
 * Features:
 * - Grid responsivo (1 col mobile, 2 tablet, 3 desktop)
 * - Card "Nenhum bot" como opção
 * - Empty state quando não há bots disponíveis
 * - Loading state
 */

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Bot, Loader2, MessageSquare, XCircle } from 'lucide-react'
import { BotCard, type BotInfo } from './BotCard'

interface BotGridProps {
  /** Lista de bots disponíveis */
  bots: BotInfo[]
  /** ID do bot atualmente selecionado (null = nenhum) */
  selectedBotId: string | null
  /** Callback quando um bot é selecionado */
  onSelectBot: (botId: string | null) => void
  /** Se está carregando a lista de bots */
  isLoading?: boolean
  /** Se está salvando a seleção */
  isSaving?: boolean
  /** Classes adicionais */
  className?: string
}

/** Card para opção "Nenhum bot" */
function NoBotCard({ 
  isSelected, 
  onSelect, 
  isLoading 
}: { 
  isSelected: boolean
  onSelect: () => void
  isLoading?: boolean
}) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        isSelected && "ring-2 ring-primary border-primary shadow-md",
        isLoading && "opacity-60 pointer-events-none"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0",
            isSelected 
              ? "bg-primary/10 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            <XCircle className="h-6 w-6" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">Nenhum bot</span>
              {isSelected && (
                <span className="text-xs text-primary font-medium">
                  (Selecionado)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Mensagens não serão processadas automaticamente
            </p>
          </div>

          <div className="flex-shrink-0">
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : isSelected ? (
              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <XCircle className="h-3 w-3 text-primary-foreground" />
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

/** Empty state quando não há bots */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-1">Nenhum bot disponível</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Crie um bot na seção de Automações para poder atribuí-lo a esta caixa de entrada.
      </p>
    </div>
  )
}

/** Loading state */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">Carregando bots...</p>
    </div>
  )
}

export function BotGrid({ 
  bots, 
  selectedBotId, 
  onSelectBot, 
  isLoading = false,
  isSaving = false,
  className 
}: BotGridProps) {
  // Loading state
  if (isLoading) {
    return <LoadingState />
  }

  // Empty state (mas ainda mostra opção "Nenhum bot")
  if (bots.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <NoBotCard 
          isSelected={selectedBotId === null}
          onSelect={() => onSelectBot(null)}
          isLoading={isSaving && selectedBotId !== null}
        />
        <EmptyState />
      </div>
    )
  }

  return (
    <div className={cn(
      "grid gap-4",
      "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      className
    )}>
      {/* Opção "Nenhum bot" */}
      <NoBotCard 
        isSelected={selectedBotId === null}
        onSelect={() => onSelectBot(null)}
        isLoading={isSaving && selectedBotId !== null}
      />

      {/* Lista de bots */}
      {bots.map(bot => (
        <BotCard
          key={bot.id}
          bot={bot}
          isSelected={selectedBotId === bot.id}
          onSelect={() => onSelectBot(bot.id)}
          isLoading={isSaving && selectedBotId !== bot.id}
        />
      ))}
    </div>
  )
}

export default BotGrid
