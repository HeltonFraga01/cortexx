# Design Document: Chat UX Improvements

## Overview

Este documento detalha o design técnico para melhorias de UX/UI na interface de chat do Cortexx. As melhorias são baseadas em análise da interface atual e melhores práticas de aplicativos de mensagens modernos (WhatsApp, Chatwoot, Intercom, Zendesk).

O objetivo é criar uma experiência de chat mais fluida, visualmente agradável e acessível, mantendo a compatibilidade com o design system existente (shadcn/ui + Tailwind CSS).

## Architecture

A arquitetura atual já está bem estruturada com separação clara de componentes:

```
src/components/features/chat/
├── ChatLayout.tsx          # Layout principal 3 colunas
├── InboxSidebar.tsx        # Lista de conversas (coluna esquerda)
├── ConversationView.tsx    # Área de mensagens (coluna central)
├── ContactPanel.tsx        # Detalhes do contato (coluna direita)
├── MessageBubble.tsx       # Componente de mensagem individual
├── MessageInput.tsx        # Campo de entrada de mensagem
└── ...outros componentes
```

As melhorias serão implementadas de forma incremental, modificando os componentes existentes sem alterar a arquitetura geral.

## Components and Interfaces

### 1. ConversationItem (InboxSidebar)

**Melhorias de Design:**

```tsx
// Estrutura visual melhorada
<div className={cn(
  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
  isSelected && "bg-primary/10 border-l-2 border-primary",
  hasUnread && !isSelected && "bg-muted/60",
  "hover:bg-muted/80"
)}>
  {/* Avatar com indicador de status */}
  <div className="relative">
    <Avatar className="h-11 w-11 ring-2 ring-background">
      <AvatarImage src={avatarUrl} loading="lazy" />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
    {isOnline && (
      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
    )}
  </div>

  {/* Conteúdo principal */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className={cn(
        "font-medium truncate",
        hasUnread && "font-semibold text-foreground"
      )}>
        {displayName}
      </span>
      <span className="text-xs text-muted-foreground shrink-0">
        {formattedTime}
      </span>
    </div>
    
    <div className="flex items-center justify-between gap-2 mt-0.5">
      {isTyping ? (
        <TypingIndicator />
      ) : (
        <p className={cn(
          "text-sm truncate",
          hasUnread ? "text-foreground/80" : "text-muted-foreground"
        )}>
          {messagePreview}
        </p>
      )}
      
      {hasUnread && (
        <Badge className="h-5 min-w-5 px-1.5 bg-primary text-primary-foreground">
          {unreadCount}
        </Badge>
      )}
    </div>
  </div>

  {/* Quick actions no hover */}
  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
    <QuickActions conversationId={id} />
  </div>
</div>
```

**Typing Indicator Component:**

```tsx
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 text-sm text-primary">
      <span className="italic">digitando</span>
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce" />
      </span>
    </div>
  )
}
```

### 2. MessageBubble Improvements

**Design Tokens:**

```css
/* Variáveis CSS para bolhas de mensagem */
:root {
  --message-bubble-radius: 16px;
  --message-bubble-padding-x: 12px;
  --message-bubble-padding-y: 8px;
  --message-bubble-max-width: 70%;
  --message-bubble-gap: 4px;
  --message-grouped-gap: 2px;
}
```

**Estrutura Melhorada:**

```tsx
interface MessageBubbleProps {
  message: ChatMessage
  isGrouped: boolean      // Se é parte de um grupo de mensagens consecutivas
  isFirstInGroup: boolean // Se é a primeira do grupo
  isLastInGroup: boolean  // Se é a última do grupo
  onReply: (message: ChatMessage) => void
  onDelete?: (message: ChatMessage) => void
}

function MessageBubble({ 
  message, 
  isGrouped, 
  isFirstInGroup, 
  isLastInGroup,
  onReply,
  onDelete 
}: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing'
  const isEmojiOnly = isEmojiOnlyMessage(message.content)
  
  // Cantos arredondados dinâmicos baseado na posição no grupo
  const bubbleRadius = cn(
    "rounded-2xl",
    isOutgoing ? {
      "rounded-tr-md": !isFirstInGroup,
      "rounded-br-md": !isLastInGroup,
    } : {
      "rounded-tl-md": !isFirstInGroup,
      "rounded-bl-md": !isLastInGroup,
    }
  )

  if (isEmojiOnly) {
    return (
      <div className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
        <span className="text-4xl">{message.content}</span>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex group",
      isOutgoing ? "justify-end" : "justify-start",
      isGrouped ? "mt-0.5" : "mt-2"
    )}>
      <div className={cn(
        "relative max-w-[70%] px-3 py-2",
        bubbleRadius,
        isOutgoing 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        {/* Conteúdo da mensagem */}
        <MessageContent message={message} />
        
        {/* Footer com timestamp e status */}
        <div className={cn(
          "flex items-center justify-end gap-1 mt-1",
          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          <span className="text-[10px]">{formattedTime}</span>
          {isOutgoing && <MessageStatusIcon status={message.status} />}
        </div>
        
        {/* Actions no hover */}
        <MessageActions 
          message={message}
          onReply={onReply}
          onDelete={onDelete}
          isOutgoing={isOutgoing}
        />
      </div>
    </div>
  )
}
```

**Emoji Detection:**

```tsx
function isEmojiOnlyMessage(content: string | null): boolean {
  if (!content) return false
  
  // Remove espaços e verifica se só tem emojis (1-3)
  const trimmed = content.trim()
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F){1,3}$/u
  return emojiRegex.test(trimmed)
}
```

**Message Status Icons:**

```tsx
function MessageStatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'sending':
      return <Clock className="h-3 w-3 animate-pulse" />
    case 'sent':
      return <Check className="h-3 w-3" />
    case 'delivered':
      return <CheckCheck className="h-3 w-3" />
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-400" />
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />
    default:
      return null
  }
}
```

### 3. MessageInput Improvements

**Auto-expanding Textarea:**

```tsx
function MessageInput({ onSend, isLoading, conversationId, onTyping }: MessageInputProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Auto-expand até 4 linhas
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    textarea.style.height = 'auto'
    const lineHeight = 24 // px
    const maxLines = 4
    const maxHeight = lineHeight * maxLines
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  }, [content])

  return (
    <div className="border-t bg-background p-3">
      {/* Reply preview */}
      {replyTo && <ReplyPreview message={replyTo} onDismiss={clearReply} />}
      
      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <Button variant="ghost" size="icon" className="shrink-0">
          <Paperclip className="h-5 w-5" />
        </Button>
        
        {/* Input container */}
        <div className={cn(
          "flex-1 relative rounded-2xl border bg-muted/50 transition-all",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary"
        )}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite uma mensagem... (/ para respostas rápidas)"
            className={cn(
              "w-full resize-none bg-transparent px-4 py-3 text-sm",
              "placeholder:text-muted-foreground focus:outline-none",
              "min-h-[44px] max-h-[96px]"
            )}
            rows={1}
          />
          
          {/* Emoji picker trigger */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 bottom-1.5 h-8 w-8"
          >
            <Smile className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
        
        {/* Send button - aparece quando tem conteúdo */}
        <Button 
          size="icon"
          disabled={!content.trim() || isLoading}
          onClick={() => handleSend()}
          className={cn(
            "shrink-0 rounded-full transition-all",
            content.trim() 
              ? "bg-primary text-primary-foreground scale-100" 
              : "bg-muted text-muted-foreground scale-90"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      
      {/* Keyboard hint */}
      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
        <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Enter</kbd> para enviar • 
        <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-1">Shift+Enter</kbd> para nova linha
      </p>
    </div>
  )
}
```

### 4. ContactPanel Improvements

**Estrutura Reorganizada:**

```tsx
function ContactPanel({ conversation, onClose }: ContactPanelProps) {
  return (
    <div className="flex flex-col h-full max-w-[320px] bg-background">
      {/* Header com close button */}
      <div className="flex items-center justify-between px-4 h-14 border-b">
        <h3 className="font-semibold">Detalhes do contato</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {/* Contact header */}
        <div className="p-6 text-center border-b">
          <Avatar className="h-20 w-20 mx-auto ring-4 ring-muted">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <h4 className="mt-4 text-lg font-semibold">{displayName}</h4>
          <div className="flex items-center justify-center gap-2 mt-1 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span className="text-sm">{phoneNumber}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Collapsible sections */}
        <div className="p-2">
          <CollapsibleSection title="Status" icon={Circle} defaultOpen>
            <StatusSelector currentStatus={conversation.status} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Etiquetas" icon={Tag}>
            <LabelManager labels={conversation.labels} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Bot atribuído" icon={Bot}>
            <BotAssignment botId={conversation.assignedBotId} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Ações da conversa" icon={Settings} defaultOpen>
            <ConversationActions conversation={conversation} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Informações" icon={Info}>
            <ConversationInfo conversation={conversation} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Notas" icon={StickyNote}>
            <ContactNotes contactId={conversation.contactId} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Histórico" icon={History}>
            <ConversationTimeline conversationId={conversation.id} />
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </div>
  )
}
```

**Collapsible Section com Animação:**

```tsx
function CollapsibleSection({ 
  title, 
  icon: Icon, 
  defaultOpen = false, 
  children 
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>
      
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}
```

## Data Models

Não há alterações nos modelos de dados. As melhorias são puramente visuais e de interação.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unread Badge Display

*For any* conversation with unreadCount > 0, the conversation item SHALL render a badge element displaying the exact unread count value.

**Validates: Requirements 1.2**

### Property 2: Selected Conversation Visual State

*For any* conversation item where isSelected is true, the component SHALL apply the selected CSS classes (bg-primary/10, border-l-2, border-primary).

**Validates: Requirements 1.4**

### Property 3: Message Preview Truncation

*For any* message preview text longer than the container width, the text SHALL be truncated with ellipsis and not overflow the container.

**Validates: Requirements 1.5**

### Property 4: Typing Indicator Display

*For any* conversation where isTyping is true, the conversation item SHALL render the TypingIndicator component instead of the message preview.

**Validates: Requirements 1.6**

### Property 5: Outgoing Message Styling

*For any* message with direction === 'outgoing', the MessageBubble SHALL apply the primary color background class (bg-primary).

**Validates: Requirements 2.2**

### Property 6: Incoming Message Styling

*For any* message with direction === 'incoming', the MessageBubble SHALL apply the muted background class (bg-muted).

**Validates: Requirements 2.3**

### Property 7: Message Status Icon Mapping

*For any* message status value (sending, sent, delivered, read, failed), the MessageStatusIcon SHALL render the corresponding icon (Clock, Check, CheckCheck, CheckCheck-blue, AlertCircle).

**Validates: Requirements 2.5**

### Property 8: Emoji-Only Message Display

*For any* message containing only 1-3 emoji characters, the MessageBubble SHALL render the emojis at 32-48px size without a bubble background.

**Validates: Requirements 2.6**

### Property 9: Consecutive Message Grouping

*For any* sequence of consecutive messages from the same sender, the MessageBubble components SHALL have reduced spacing (mt-0.5 instead of mt-2) and modified border radius.

**Validates: Requirements 2.7**

### Property 10: Input Auto-Expansion

*For any* textarea content that exceeds one line, the input height SHALL increase up to a maximum of 4 lines (96px), then show overflow scroll.

**Validates: Requirements 3.2**

### Property 11: Send Button Visibility

*For any* input field with non-empty trimmed content, the send button SHALL be visible with primary color styling.

**Validates: Requirements 3.3**

### Property 12: Quick Reply Autocomplete

*For any* input starting with "/" character, the autocomplete dropdown SHALL appear with matching quick reply options.

**Validates: Requirements 3.6**

### Property 13: Reply Preview Display

*For any* active reply state (replyToMessage !== null), the input area SHALL display a compact preview of the replied message with a dismiss button.

**Validates: Requirements 3.7**

### Property 14: Label Chip Rendering

*For any* conversation with labels array, the ContactPanel SHALL render each label as a colored chip with the label's color property.

**Validates: Requirements 4.5**

### Property 15: Optimistic Message Update

*For any* message being sent, the UI SHALL immediately display the message with 'sending' status before server confirmation.

**Validates: Requirements 5.1**

### Property 16: Failed Message Error State

*For any* message with status === 'failed', the MessageBubble SHALL display an error indicator and a retry action button.

**Validates: Requirements 5.2**

### Property 17: Keyboard Navigation Support

*For all* interactive elements in the chat interface, the element SHALL be focusable via Tab key navigation and have a visible focus indicator.

**Validates: Requirements 6.1**

### Property 18: ARIA Labels Presence

*For all* interactive elements (buttons, inputs, links), the element SHALL have an appropriate aria-label or aria-labelledby attribute.

**Validates: Requirements 6.2**

### Property 19: Contrast Ratio Compliance

*For all* text elements in both light and dark modes, the contrast ratio between text and background SHALL meet WCAG AA minimum (4.5:1 for normal text, 3:1 for large text).

**Validates: Requirements 6.6, 7.2**

### Property 20: List Virtualization

*For any* conversation list with more than 50 items, the component SHALL use virtualization to render only visible items plus a buffer.

**Validates: Requirements 8.1**

### Property 21: Avatar Lazy Loading

*For all* avatar images in the conversation list, the img element SHALL have loading="lazy" attribute.

**Validates: Requirements 8.3**

### Property 22: Connection Status Indicator

*For any* change in isConnected state, the UI SHALL display a visible connection status indicator (green dot for connected, red for disconnected).

**Validates: Requirements 8.5**

## Error Handling

### Message Send Failures

```tsx
// Retry mechanism for failed messages
function handleMessageRetry(messageId: string) {
  // 1. Update UI to show retrying state
  setMessageStatus(messageId, 'sending')
  
  // 2. Attempt resend
  try {
    await chatApi.resendMessage(messageId)
    setMessageStatus(messageId, 'sent')
  } catch (error) {
    setMessageStatus(messageId, 'failed')
    toast.error('Falha ao enviar mensagem. Tente novamente.')
  }
}
```

### Connection Loss Handling

```tsx
// Connection status banner
function ConnectionBanner({ isConnected }: { isConnected: boolean }) {
  if (isConnected) return null
  
  return (
    <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm text-center">
      <WifiOff className="h-4 w-4 inline mr-2" />
      Conexão perdida. Tentando reconectar...
    </div>
  )
}
```

## Testing Strategy

### Unit Tests

- Testar renderização de componentes com diferentes props
- Testar lógica de detecção de emoji-only messages
- Testar formatação de timestamps relativos
- Testar agrupamento de mensagens consecutivas

### Property-Based Tests

Usar Vitest com fast-check para testes de propriedade:

```typescript
import { test, fc } from '@fast-check/vitest'

// Property 1: Unread badge display
test.prop([fc.integer({ min: 1, max: 999 })])('unread badge shows correct count', (count) => {
  const { getByTestId } = render(<ConversationItem unreadCount={count} />)
  expect(getByTestId('unread-badge')).toHaveTextContent(String(count))
})

// Property 8: Emoji-only detection
test.prop([fc.stringOf(fc.constantFrom('😀', '🎉', '❤️'), { minLength: 1, maxLength: 3 })])(
  'emoji-only messages render without bubble',
  (emojiContent) => {
    const { container } = render(<MessageBubble content={emojiContent} />)
    expect(container.querySelector('.bg-primary')).toBeNull()
    expect(container.querySelector('.text-4xl')).toBeInTheDocument()
  }
)
```

### E2E Tests (Cypress)

- Testar fluxo completo de envio de mensagem
- Testar navegação por teclado
- Testar responsividade em diferentes viewports
- Testar transição de tema claro/escuro

### Accessibility Tests

- Usar axe-core para verificar violações de acessibilidade
- Testar navegação por teclado manualmente
- Verificar contraste de cores com ferramentas automatizadas
