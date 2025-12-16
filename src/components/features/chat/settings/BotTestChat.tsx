/**
 * BotTestChat Component
 * 
 * Full chat interface for testing bot webhooks.
 * Simulates a real conversation with the bot, sending the same
 * payload structure that would be sent from a real WhatsApp message.
 * 
 * Requirements: 1.2, 2.1, 2.2, 2.3, 3.5, 4.1, 4.2, 4.3, 7.1, 7.2, 7.4
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { 
  startBotTest, 
  sendBotTestMessage, 
  endBotTest, 
  clearBotTestHistory,
  getBotTestMessages
} from '@/services/chat'
import type { 
  BotTestSession, 
  BotTestMessage, 
  BotTestQuotaUsage 
} from '@/types/chat'
import type { AgentBot, AssignedBot } from '@/types/chat'
import { 
  FlaskConical, 
  Send, 
  X, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  Phone,
  MessageSquare,
  Cpu,
  Bot,
  User,
  RotateCcw
} from 'lucide-react'

interface BotTestChatProps {
  bot: AgentBot | AssignedBot
  onClose: () => void
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (date.toDateString() === today.toDateString()) {
    return 'Hoje'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem'
  }
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })
}

function QuotaBar({ 
  label, 
  icon, 
  current, 
  limit 
}: { 
  label: string
  icon: React.ReactNode
  current: number
  limit: number 
}) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0
  const isWarning = percentage >= 80
  const isExceeded = percentage >= 100

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className={isExceeded ? 'text-destructive font-medium' : isWarning ? 'text-yellow-600' : 'text-muted-foreground'}>
          {current.toLocaleString()}/{limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${
            isExceeded ? 'bg-destructive' : isWarning ? 'bg-yellow-500' : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function BotTestChat({ bot, onClose }: BotTestChatProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [session, setSession] = useState<BotTestSession | null>(null)
  const [messages, setMessages] = useState<BotTestMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [quotaUsage, setQuotaUsage] = useState<BotTestQuotaUsage | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping])

  // Focus textarea when session starts
  useEffect(() => {
    if (session) {
      textareaRef.current?.focus()
    }
  }, [session])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputValue])

  // Start test session
  const startMutation = useMutation({
    mutationFn: () => startBotTest(bot.id),
    onSuccess: (data) => {
      setSession(data)
      setQuotaUsage(data.quotaUsage)
      setMessages([])
    },
    onError: (error: Error) => {
      if (error.message.includes('quota') || error.message.includes('Quota')) {
        toast.error('Quota excedida', { 
          description: 'Você atingiu o limite de chamadas de bot' 
        })
      } else {
        toast.error('Erro ao iniciar conversa', { description: error.message })
      }
    }
  })

  // Send message
  const sendMutation = useMutation({
    mutationFn: (message: string) => {
      if (!session) throw new Error('No active session')
      return sendBotTestMessage(bot.id, session.conversationId, message)
    },
    onMutate: () => {
      setIsTyping(true)
    },
    onSuccess: (data) => {
      // Add user message
      setMessages(prev => [...prev, data.userMessage])
      
      // Add bot reply if present
      if (data.botReply) {
        setTimeout(() => {
          setMessages(prev => [...prev, data.botReply!])
          setIsTyping(false)
        }, 300) // Small delay for natural feel
      } else {
        setIsTyping(false)
      }
      
      // Update quota
      setQuotaUsage(data.quotaUsage)
      
      // Handle errors
      if (data.webhookError) {
        toast.error('Erro no webhook do bot', { 
          description: data.webhookError 
        })
        setIsTyping(false)
      }
      if (data.quotaExceeded) {
        toast.error('Quota excedida', { 
          description: `Limite de ${data.quotaExceeded} atingido` 
        })
      }
      
      setInputValue('')
    },
    onError: (error: Error) => {
      setIsTyping(false)
      toast.error('Erro ao enviar mensagem', { description: error.message })
    }
  })

  // End session
  const endMutation = useMutation({
    mutationFn: () => {
      if (!session) throw new Error('No active session')
      return endBotTest(bot.id, session.conversationId)
    },
    onSuccess: () => {
      setSession(null)
      setMessages([])
      setQuotaUsage(null)
      onClose()
    },
    onError: (error: Error) => {
      toast.error('Erro ao encerrar conversa', { description: error.message })
    }
  })

  // Clear history
  const clearMutation = useMutation({
    mutationFn: () => {
      if (!session) throw new Error('No active session')
      return clearBotTestHistory(bot.id, session.conversationId)
    },
    onSuccess: () => {
      setMessages([])
      toast.success('Histórico limpo')
    },
    onError: (error: Error) => {
      toast.error('Erro ao limpar histórico', { description: error.message })
    }
  })

  // Restart session
  const restartSession = useCallback(() => {
    setSession(null)
    setMessages([])
    startMutation.mutate()
  }, [startMutation])

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || sendMutation.isPending) return
    sendMutation.mutate(trimmed)
  }, [inputValue, sendMutation])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Start session automatically when component mounts
  useEffect(() => {
    if (!session && !startMutation.isPending && !startMutation.isError) {
      startMutation.mutate()
    }
  }, [])

  const isLoading = startMutation.isPending || endMutation.isPending

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.timestamp)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(msg)
    return groups
  }, {} as Record<string, BotTestMessage[]>)

  return (
    <Card className="border-2 border-yellow-500/50 overflow-hidden">
      {/* Header */}
      <CardHeader className="p-3 bg-yellow-50/50 dark:bg-yellow-950/20 border-b border-yellow-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-yellow-500/50">
              <AvatarFallback className="bg-yellow-100 text-yellow-700">
                <Bot className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{bot.name}</h3>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                  <FlaskConical className="h-3 w-3 mr-1" />
                  Conversa de Teste
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {session ? `JID: ${session.simulatedJid.split('@')[0]}` : 'Iniciando...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={restartSession}
              disabled={isLoading}
              title="Reiniciar conversa"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending || messages.length === 0}
              title="Limpar histórico"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => endMutation.mutate()}
              disabled={isLoading}
              title="Fechar conversa"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Warning banner */}
        <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 rounded px-2 py-1.5 mt-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Ambiente de teste - O bot recebe o mesmo payload de uma mensagem real do WhatsApp</span>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col" style={{ height: '450px' }}>
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          {startMutation.isPending ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Iniciando conversa...</p>
            </div>
          ) : startMutation.isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive">Erro ao iniciar conversa</p>
              <Button variant="outline" size="sm" onClick={() => startMutation.mutate()}>
                Tentar novamente
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Envie uma mensagem para conversar com o bot
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-xs">
                O bot receberá o mesmo payload que receberia de uma mensagem real do WhatsApp
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {date}
                    </span>
                  </div>
                  
                  {/* Messages */}
                  <div className="space-y-3">
                    {msgs.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!msg.fromMe && (
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              <Bot className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            msg.fromMe
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                          <p className={`text-[10px] mt-1 ${
                            msg.fromMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {formatTimestamp(msg.timestamp)}
                          </p>
                        </div>
                        {msg.fromMe && (
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                              <User className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-end gap-2 justify-start">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Quota indicators */}
        {quotaUsage && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <div className="grid grid-cols-3 gap-3">
              <QuotaBar
                label="Chamadas"
                icon={<Phone className="h-3 w-3 text-muted-foreground" />}
                current={quotaUsage.calls.daily}
                limit={quotaUsage.calls.dailyLimit}
              />
              <QuotaBar
                label="Mensagens"
                icon={<MessageSquare className="h-3 w-3 text-muted-foreground" />}
                current={quotaUsage.messages.daily}
                limit={quotaUsage.messages.dailyLimit}
              />
              <QuotaBar
                label="Tokens"
                icon={<Cpu className="h-3 w-3 text-muted-foreground" />}
                current={quotaUsage.tokens.daily}
                limit={quotaUsage.tokens.dailyLimit}
              />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-3 border-t bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              disabled={!session || sendMutation.isPending}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!session || !inputValue.trim() || sendMutation.isPending}
              size="icon"
              className="h-10 w-10 flex-shrink-0"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Pressione <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Enter</kbd> para enviar ou <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Shift+Enter</kbd> para nova linha
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default BotTestChat
