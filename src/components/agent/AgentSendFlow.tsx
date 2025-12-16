/**
 * AgentSendFlow Component
 * Main component for agent message sending with type selection and recipient management
 * Adapted from SendFlow for agent context - uses agent-specific APIs
 * 
 * Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Send,
  Users,
  ArrowRight,
  ArrowLeft,
  Clock,
  Sparkles,
  Shuffle,
  Tag,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { AgentInboxSelector, type SelectedInbox } from './AgentInboxSelector'
import { AgentRecipientSelector } from './AgentRecipientSelector'
import { MessageSequenceEditor } from '@/components/disparador/MessageSequenceEditor'
import { SchedulingInput } from '@/components/shared/forms/SchedulingInput'
import { SchedulingWindowInput } from '@/components/disparador/SchedulingWindowInput'
import { toast } from 'sonner'

interface MessageItem {
  id: string
  content: string
  delay?: number
}

interface SendingWindow {
  startTime: string
  endTime: string
  days: number[]
}

interface Contact {
  id: string
  phone: string
  name?: string
  variables?: Record<string, string>
}

export interface AgentSendFlowData {
  recipients: Contact[]
  campaignName: string
  messages: MessageItem[]
  selectedInboxes: SelectedInbox[]
  humanization: {
    delayMin: number
    delayMax: number
    randomizeOrder: boolean
  }
  schedule?: {
    scheduledAt: string
    timezone?: string
    sendingWindow?: SendingWindow
  }
}

interface AgentSendFlowProps {
  onSend?: (data: AgentSendFlowData) => Promise<void>
  onSaveDraft?: (data: AgentSendFlowData) => void
  preSelectedContacts?: Contact[]
}

type FlowStep = 'recipients' | 'message' | 'review'

export function AgentSendFlow({
  onSend,
  onSaveDraft,
  preSelectedContacts,
}: AgentSendFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('recipients')
  const [recipients, setRecipients] = useState<Contact[]>(preSelectedContacts || [])
  const [selectedInboxes, setSelectedInboxes] = useState<SelectedInbox[]>([])
  const [isSending, setIsSending] = useState(false)

  // Campaign configuration state
  const [campaignName, setCampaignName] = useState('')
  const [messages, setMessages] = useState<MessageItem[]>([{ id: '1', content: '' }])
  const [delayMin, setDelayMin] = useState(2)
  const [delayMax, setDelayMax] = useState(5)
  const [randomizeOrder, setRandomizeOrder] = useState(true)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDateTime, setScheduledDateTime] = useState('')
  const [isSchedulingValid, setIsSchedulingValid] = useState(true)
  const [enableWindow, setEnableWindow] = useState(false)
  const [sendingWindow, setSendingWindow] = useState<SendingWindow | null>(null)

  // Update recipients when preSelectedContacts changes
  useEffect(() => {
    if (preSelectedContacts && preSelectedContacts.length > 0) {
      setRecipients(preSelectedContacts)
      setCurrentStep('message')
    }
  }, [preSelectedContacts])

  // Handler for contacts selected
  const handleContactsSelected = (contacts: Contact[]) => {
    setRecipients(contacts)
  }

  // Insert variable into last message
  const insertVariable = (varName: string) => {
    if (messages.length === 0) return
    const lastIndex = messages.length - 1
    const updatedMessages = [...messages]
    updatedMessages[lastIndex] = {
      ...updatedMessages[lastIndex],
      content: updatedMessages[lastIndex].content + `{{${varName}}}`,
    }
    setMessages(updatedMessages)
  }

  // Get unique variables from contacts
  const contactVariables = recipients
    .flatMap(r => Object.keys(r.variables || {}))
    .filter((v, i, arr) => arr.indexOf(v) === i)

  const handleNext = () => {
    const steps: FlowStep[] = ['recipients', 'message', 'review']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }

  const handleBack = () => {
    const steps: FlowStep[] = ['recipients', 'message', 'review']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }

  const handleSend = async () => {
    if (!onSend) return

    const data: AgentSendFlowData = {
      recipients,
      campaignName: campaignName || `Campanha ${new Date().toLocaleDateString('pt-BR')}`,
      messages,
      selectedInboxes,
      humanization: {
        delayMin: delayMin * 60,
        delayMax: delayMax * 60,
        randomizeOrder,
      },
      schedule: isScheduled && scheduledDateTime ? {
        scheduledAt: scheduledDateTime,
        sendingWindow: enableWindow && sendingWindow ? sendingWindow : undefined,
      } : undefined,
    }

    setIsSending(true)
    try {
      await onSend(data)
      toast.success(isScheduled ? 'Campanha agendada com sucesso' : 'Campanha iniciada')
    } catch (error: any) {
      toast.error('Erro ao enviar', { description: error.message })
    } finally {
      setIsSending(false)
    }
  }

  const handleSaveDraft = () => {
    if (!onSaveDraft) return

    const data: AgentSendFlowData = {
      recipients,
      campaignName,
      messages,
      selectedInboxes,
      humanization: {
        delayMin: delayMin * 60,
        delayMax: delayMax * 60,
        randomizeOrder,
      },
      schedule: isScheduled && scheduledDateTime ? {
        scheduledAt: scheduledDateTime,
        sendingWindow: enableWindow && sendingWindow ? sendingWindow : undefined,
      } : undefined,
    }

    onSaveDraft(data)
    toast.success('Rascunho salvo')
  }

  const hasValidMessage = messages.some(m => m.content.trim().length > 0)
  const hasValidInboxes = selectedInboxes.length > 0 && selectedInboxes.some(i => i.connected)

  const canProceed = () => {
    switch (currentStep) {
      case 'recipients':
        return recipients.length > 0 && hasValidInboxes
      case 'message':
        return hasValidMessage
      case 'review':
        return recipients.length > 0 && hasValidMessage && hasValidInboxes && (isScheduled ? isSchedulingValid : true)
      default:
        return false
    }
  }

  // Calculate estimated time
  const estimatedTime = recipients.length > 0 && messages.length > 0
    ? Math.round(((delayMin + delayMax) / 2) * 60 * recipients.length * messages.length)
    : 0

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} segundos`
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutos`
    const hours = Math.floor(seconds / 3600)
    const mins = Math.round((seconds % 3600) / 60)
    return `${hours}h ${mins}min`
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'recipients':
        return 'Selecione os destinatários'
      case 'message':
        return 'Configure a mensagem'
      case 'review':
        return 'Revise e envie'
      default:
        return ''
    }
  }

  const renderStepIndicator = () => {
    const steps: { key: FlowStep; label: string }[] = [
      { key: 'recipients', label: 'Destinatários' },
      { key: 'message', label: 'Mensagem' },
      { key: 'review', label: 'Enviar' },
    ]

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep === step.key
                  ? 'bg-primary text-primary-foreground'
                  : steps.findIndex((s) => s.key === currentStep) > index
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`ml-2 text-sm hidden md:inline ${
                currentStep === step.key ? 'font-medium' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          {getStepTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderStepIndicator()}

        {/* Recipient Counter */}
        {recipients.length > 0 && (
          <div className="flex items-center justify-center">
            <Badge variant="secondary" className="text-base px-4 py-2">
              <Users className="h-4 w-4 mr-2" />
              {recipients.length} contato{recipients.length !== 1 ? 's' : ''} selecionado{recipients.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}

        <Separator />

        {/* Step Content */}
        {currentStep === 'recipients' && (
          <div className="space-y-6">
            {/* Inbox Selection */}
            <AgentInboxSelector
              selectedInboxes={selectedInboxes}
              onSelectionChange={setSelectedInboxes}
              minSelection={1}
            />

            <Separator />

            {/* Recipient Selection */}
            <AgentRecipientSelector
              onContactsSelected={handleContactsSelected}
              selectedContactsCount={recipients.length}
            />
          </div>
        )}

        {currentStep === 'message' && (
          <div className="space-y-6">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nome da Campanha</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Promoção Black Friday"
              />
            </div>

            <Separator />

            {/* Message Sequence Editor */}
            <MessageSequenceEditor
              messages={messages}
              onChange={setMessages}
              userToken=""
            />

            {/* Variables */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-3.5 w-3.5 text-primary" />
                Variáveis Disponíveis (clique para adicionar)
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('nome')}>Nome</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('telefone')}>Telefone</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('data')}>Data</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('empresa')}>Empresa</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('saudacao')}>Saudação</Button>
              </div>
            </div>

            {/* Custom Variables from Contacts */}
            {contactVariables.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Variáveis Customizadas (dos contatos)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {contactVariables.map(varName => (
                    <Button
                      key={varName}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(varName)}
                    >
                      {`{{${varName}}}`}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Humanization Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Humanização</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delay-min">Delay Mínimo (minutos)</Label>
                  <Input
                    id="delay-min"
                    type="number"
                    min={1}
                    max={30}
                    value={delayMin}
                    onChange={(e) => setDelayMin(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Mínimo: 1 min</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delay-max">Delay Máximo (minutos)</Label>
                  <Input
                    id="delay-max"
                    type="number"
                    min={1}
                    max={30}
                    value={delayMax}
                    onChange={(e) => setDelayMax(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Máximo: 30 min</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="randomize"
                  checked={randomizeOrder}
                  onCheckedChange={(checked) => setRandomizeOrder(checked as boolean)}
                />
                <Label htmlFor="randomize" className="flex items-center gap-2 cursor-pointer">
                  <Shuffle className="h-4 w-4" />
                  Randomizar ordem dos contatos
                </Label>
              </div>
            </div>

            <Separator />

            {/* Scheduling */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Agendamento e Horários</h3>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="schedule"
                  checked={isScheduled}
                  onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
                />
                <Label htmlFor="schedule" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Calendar className="h-4 w-4" />
                  Agendar Início da Campanha
                </Label>
              </div>

              {isScheduled && (
                <div className="pl-6 border-l-2 ml-2">
                  <SchedulingInput
                    value={scheduledDateTime}
                    onChange={setScheduledDateTime}
                    onValidationChange={setIsSchedulingValid}
                    showSummary={true}
                  />
                </div>
              )}

              <SchedulingWindowInput
                value={sendingWindow}
                onChange={setSendingWindow}
                enabled={enableWindow}
                onEnabledChange={(enabled) => {
                  setEnableWindow(enabled)
                  if (enabled && !sendingWindow) {
                    setSendingWindow({
                      startTime: '08:00',
                      endTime: '18:00',
                      days: [1, 2, 3, 4, 5]
                    })
                  } else if (!enabled) {
                    setSendingWindow(null)
                  }
                }}
              />
            </div>

            {/* Estimated Time */}
            {estimatedTime > 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Tempo estimado:</strong> {formatDuration(estimatedTime)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nome da campanha:</span>
                <span className="ml-2 font-medium">{campaignName || 'Sem nome'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Destinatários:</span>
                <span className="ml-2 font-medium">{recipients.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Mensagens:</span>
                <span className="ml-2 font-medium">{messages.length}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Caixa(s) de entrada:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedInboxes.map(inbox => (
                    <Badge key={inbox.id} variant="secondary">
                      {inbox.name}
                      {inbox.phoneNumber && ` (${inbox.phoneNumber})`}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Delay:</span>
                <span className="ml-2 font-medium">{delayMin} min - {delayMax} min</span>
              </div>
              <div>
                <span className="text-muted-foreground">Randomizar:</span>
                <span className="ml-2 font-medium">{randomizeOrder ? 'Sim' : 'Não'}</span>
              </div>
              {isScheduled && scheduledDateTime && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Agendado para:</span>
                  <span className="ml-2 font-medium">
                    {new Date(scheduledDateTime).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              {enableWindow && sendingWindow && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Janela de envio:</span>
                  <span className="ml-2 font-medium">
                    {sendingWindow.startTime} - {sendingWindow.endTime}
                  </span>
                </div>
              )}
            </div>
            <Separator />
            <div>
              <span className="text-sm text-muted-foreground">Prévia das mensagens:</span>
              {messages.map((msg, idx) => (
                <div key={msg.id} className="mt-2 p-4 rounded-lg bg-muted whitespace-pre-wrap text-sm">
                  {messages.length > 1 && (
                    <Badge variant="outline" className="mb-2">Mensagem {idx + 1}</Badge>
                  )}
                  <div>{msg.content || <span className="italic text-muted-foreground">Sem conteúdo</span>}</div>
                </div>
              ))}
            </div>
            {estimatedTime > 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Tempo estimado:</strong> {formatDuration(estimatedTime)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Separator />

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <div>
            {currentStep !== 'recipients' && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSaveDraft && currentStep !== 'recipients' && (
              <Button variant="outline" onClick={handleSaveDraft}>
                Salvar Rascunho
              </Button>
            )}
            {currentStep === 'review' ? (
              <Button
                onClick={handleSend}
                disabled={!canProceed() || isSending}
              >
                <Send className="h-4 w-4 mr-2" />
                {isSending ? 'Enviando...' : isScheduled ? 'Agendar' : 'Enviar'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AgentSendFlow
