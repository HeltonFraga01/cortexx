/**
 * MessageInput Component
 * 
 * Input area for composing and sending messages
 * 
 * Requirements: 2.1, 3.1-3.4, 5.2, 12.2, 21.1, 21.2
 */

import { useState, useCallback, useRef, useEffect, KeyboardEvent, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { useChatApi } from '@/hooks/useChatApi'
import type { CannedResponse } from '@/types/chat'
import { 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  MicOff,
  Image, 
  FileText, 
  MapPin, 
  User,
  Loader2,
  X,
  Square
} from 'lucide-react'

interface MessageInputProps {
  onSend: (content: string) => void
  isLoading?: boolean
  conversationId: number
  onTyping?: (isTyping: boolean) => void
  onPresence?: (state: 'composing' | 'paused' | 'recording' | 'available' | 'unavailable') => void
}

export function MessageInput({ onSend, isLoading, conversationId, onTyping, onPresence }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [showCannedResponses, setShowCannedResponses] = useState(false)
  const [cannedSearchQuery, setCannedSearchQuery] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showLocationDialog, setShowLocationDialog] = useState(false)
  const [locationData, setLocationData] = useState({ latitude: '', longitude: '', name: '' })
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const lastTypingRef = useRef<number>(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout>()
  
  const TYPING_DEBOUNCE = 2000 // 2 seconds
  const queryClient = useQueryClient()
  
  // Get the appropriate chat API based on context (user or agent)
  const chatApi = useChatApi()

  // Mutations for media messages using the appropriate API
  const sendImageMutation = useMutation({
    mutationFn: ({ image, caption, mimeType }: { image: string; caption?: string; mimeType?: string }) =>
      chatApi.sendImageMessage(conversationId, { image, caption, mimeType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Imagem enviada com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar imagem', { description: error.message })
    }
  })

  const sendDocumentMutation = useMutation({
    mutationFn: ({ document, filename, caption, mimeType }: { document: string; filename: string; caption?: string; mimeType?: string }) =>
      chatApi.sendDocumentMessage(conversationId, { document, filename, caption, mimeType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Documento enviado com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar documento', { description: error.message })
    }
  })

  const sendLocationMutation = useMutation({
    mutationFn: (data: { latitude: number; longitude: number; name?: string }) =>
      chatApi.sendLocationMessage(conversationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setShowLocationDialog(false)
      setLocationData({ latitude: '', longitude: '', name: '' })
      toast.success('Localização enviada com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar localização', { description: error.message })
    }
  })

  const sendAudioMutation = useMutation({
    mutationFn: ({ audio, mimeType }: { audio: string; mimeType?: string }) => 
      chatApi.sendAudioMessage(conversationId, { audio, mimeType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Áudio enviado com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar áudio', { description: error.message })
    }
  })

  // Fetch canned responses using the appropriate API
  const { data: cannedResponses } = useQuery({
    queryKey: ['canned-responses', cannedSearchQuery, chatApi.isAgentMode],
    queryFn: () => chatApi.getCannedResponses(cannedSearchQuery),
    enabled: showCannedResponses,
    staleTime: 30000
  })

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [content])

  // Check for canned response trigger (/)
  useEffect(() => {
    if (content.startsWith('/')) {
      setShowCannedResponses(true)
      setCannedSearchQuery(content.slice(1))
    } else {
      setShowCannedResponses(false)
      setCannedSearchQuery('')
    }
  }, [content])

  // Handle typing indicator
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    
    // Send typing indicator with debounce
    if (onTyping && newContent.length > 0) {
      const now = Date.now()
      if (now - lastTypingRef.current > TYPING_DEBOUNCE) {
        onTyping(true)
        onPresence?.('composing')
        lastTypingRef.current = now
      }
      
      // Clear previous timeout and set new one to stop typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false)
        onPresence?.('paused')
      }, 3000)
    }
  }, [onTyping, onPresence])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Handle image selection
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Arquivo inválido', { description: 'Selecione uma imagem' })
      return
    }

    if (file.size > 16 * 1024 * 1024) { // 16MB limit
      toast.error('Arquivo muito grande', { description: 'O tamanho máximo é 16MB' })
      return
    }

    const mimeType = file.type
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      sendImageMutation.mutate({ image: base64, mimeType })
    }
    reader.readAsDataURL(file)
    
    // Reset input
    e.target.value = ''
    setAttachmentMenuOpen(false)
  }, [sendImageMutation, toast])

  // Handle document selection
  const handleDocumentSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      toast.error('Arquivo muito grande', { description: 'O tamanho máximo é 100MB' })
      return
    }

    const mimeType = file.type || 'application/octet-stream'
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      sendDocumentMutation.mutate({ document: base64, filename: file.name, mimeType })
    }
    reader.readAsDataURL(file)
    
    // Reset input
    e.target.value = ''
    setAttachmentMenuOpen(false)
  }, [sendDocumentMutation, toast])

  // Handle location send
  const handleSendLocation = useCallback(() => {
    const lat = parseFloat(locationData.latitude)
    const lng = parseFloat(locationData.longitude)
    
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Coordenadas inválidas', { description: 'Informe latitude e longitude válidas' })
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Coordenadas fora do intervalo', { description: 'Latitude: -90 a 90, Longitude: -180 a 180' })
      return
    }

    sendLocationMutation.mutate({ 
      latitude: lat, 
      longitude: lng, 
      name: locationData.name || undefined 
    })
  }, [locationData, sendLocationMutation, toast])

  // Get current location
  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Não suportado', { description: 'Geolocalização não é suportada neste navegador' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationData({
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
          name: ''
        })
      },
      (error) => {
        toast.error('Erro ao obter localização', { description: error.message })
      }
    )
  }, [])

  // Start audio recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        
        if (audioChunksRef.current.length > 0) {
          const mimeType = 'audio/webm;codecs=opus'
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = reader.result as string
            sendAudioMutation.mutate({ audio: base64, mimeType })
          }
          reader.readAsDataURL(audioBlob)
        }
        
        setRecordingTime(0)
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current)
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      onPresence?.('recording')
      
      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
    } catch (error) {
      toast.error('Erro ao acessar microfone', { description: 'Verifique as permissões do navegador' })
    }
  }, [onPresence, sendAudioMutation, toast])

  // Stop audio recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      onPresence?.('available')
    }
  }, [onPresence])

  // Cancel audio recording
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop())
      }
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
    audioChunksRef.current = []
    setIsRecording(false)
    setRecordingTime(0)
    onPresence?.('available')
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
    }
  }, [onPresence])

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.slice(0, start) + emoji.native + content.slice(end)
      setContent(newContent)
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length
        textarea.focus()
      }, 0)
    } else {
      setContent(prev => prev + emoji.native)
    }
    setEmojiPickerOpen(false)
  }, [content])

  const handleSend = useCallback(() => {
    if (content.trim() && !isLoading) {
      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      onTyping?.(false)
      onPresence?.('available')
      
      onSend(content.trim())
      setContent('')
      setShowCannedResponses(false)
    }
  }, [content, isLoading, onSend, onTyping, onPresence])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
    // Enter without shift to send (single line mode)
    if (e.key === 'Enter' && !e.shiftKey && !showCannedResponses) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend, showCannedResponses])

  const handleSelectCannedResponse = useCallback((response: CannedResponse) => {
    setContent(response.content)
    setShowCannedResponses(false)
    textareaRef.current?.focus()
  }, [])

  const filteredCannedResponses = cannedResponses?.filter(
    (r) => r.shortcut.toLowerCase().includes(cannedSearchQuery.toLowerCase())
  ) || []

  const isSendingMedia = sendImageMutation.isPending || sendDocumentMutation.isPending || 
                         sendLocationMutation.isPending || sendAudioMutation.isPending

  return (
    <div className="border-t bg-background p-4">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        className="hidden"
        onChange={handleDocumentSelect}
      />

      {/* Location dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Localização</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="-23.550520"
                value={locationData.latitude}
                onChange={(e) => setLocationData(prev => ({ ...prev, latitude: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="-46.633308"
                value={locationData.longitude}
                onChange={(e) => setLocationData(prev => ({ ...prev, longitude: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationName">Nome do local (opcional)</Label>
              <Input
                id="locationName"
                placeholder="Ex: Escritório"
                value={locationData.name}
                onChange={(e) => setLocationData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={handleGetCurrentLocation}
              className="w-full"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Usar minha localização atual
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendLocation} 
              disabled={sendLocationMutation.isPending}
            >
              {sendLocationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Canned responses dropdown */}
      {showCannedResponses && filteredCannedResponses.length > 0 && (
        <div className="mb-2 p-2 bg-muted rounded-lg max-h-48 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Respostas rápidas</p>
          <div className="space-y-1">
            {filteredCannedResponses.map((response) => (
              <button
                key={response.id}
                onClick={() => handleSelectCannedResponse(response)}
                className="w-full text-left p-2 rounded hover:bg-background transition-colors"
              >
                <span className="text-sm font-medium text-primary">
                  /{response.shortcut}
                </span>
                <p className="text-sm text-muted-foreground truncate">
                  {response.content}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recording UI */}
      {isRecording ? (
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-500">
              Gravando {formatTime(recordingTime)}
            </span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 transition-all duration-1000"
                style={{ width: `${Math.min((recordingTime / 60) * 100, 100)}%` }}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            onClick={stopRecording}
            className="bg-red-500 hover:bg-red-600"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Attachment menu */}
          <Popover open={attachmentMenuOpen} onOpenChange={setAttachmentMenuOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="flex-shrink-0"
                disabled={isSendingMedia}
              >
                {isSendingMedia ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Paperclip className="h-5 w-5" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-48 p-2">
              <div className="space-y-1">
                <AttachmentButton 
                  icon={Image} 
                  label="Imagem" 
                  onClick={() => imageInputRef.current?.click()} 
                />
                <AttachmentButton 
                  icon={FileText} 
                  label="Documento" 
                  onClick={() => documentInputRef.current?.click()} 
                />
                <AttachmentButton 
                  icon={MapPin} 
                  label="Localização" 
                  onClick={() => {
                    setAttachmentMenuOpen(false)
                    setShowLocationDialog(true)
                  }} 
                />
                <AttachmentButton 
                  icon={User} 
                  label="Contato" 
                  onClick={() => {
                    setAttachmentMenuOpen(false)
                    toast.info('Em breve', { description: 'Envio de contato será implementado em breve' })
                  }} 
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Text input */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem... (/ para respostas rápidas)"
              className="min-h-[40px] max-h-[150px] resize-none pr-10"
              rows={1}
              disabled={isLoading || isSendingMedia}
            />
            
            {/* Emoji picker */}
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 bottom-1 h-8 w-8"
                  type="button"
                >
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                side="top" 
                align="end" 
                className="w-auto p-0 border-none shadow-lg"
                sideOffset={8}
              >
                <Picker 
                  data={data} 
                  onEmojiSelect={handleEmojiSelect}
                  theme="auto"
                  locale="pt"
                  previewPosition="none"
                  skinTonePosition="search"
                  maxFrequentRows={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Send/Record button */}
          {content.trim() ? (
            <Button
              onClick={handleSend}
              disabled={isLoading || isSendingMedia}
              size="icon"
              className="flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="icon" 
              className="flex-shrink-0"
              onClick={startRecording}
              disabled={isSendingMedia}
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {!isRecording && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Pressione <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> para enviar ou{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Shift+Enter</kbd> para nova linha
        </p>
      )}
    </div>
  )
}

interface AttachmentButtonProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}

function AttachmentButton({ icon: Icon, label, onClick }: AttachmentButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors"
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </button>
  )
}

export default MessageInput
