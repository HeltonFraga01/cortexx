/**
 * ContactUserCreationForm Component
 * 
 * Simplified user creation form for contact pages.
 * Allows creating new users directly from contact management interface.
 */

import { useState } from 'react'
import { User, Phone, Globe, Loader2, Check, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validatePhoneFormat } from '@/lib/phone-utils'
import { WuzAPIService } from '@/services/wuzapi'

interface ContactUserCreationFormProps {
  onSuccess?: (userData: { name: string; token: string; phone: string }) => void
  onCancel?: () => void
  className?: string
}

export function ContactUserCreationForm({ 
  onSuccess, 
  onCancel,
  className = '' 
}: ContactUserCreationFormProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Form state
  const [instanceName, setInstanceName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')

  const wuzapi = new WuzAPIService()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!instanceName.trim()) {
      toast.error('Nome obrigatório', {
        description: 'Digite um nome para a instância'
      })
      return
    }

    if (!phoneNumber.trim()) {
      toast.error('Telefone obrigatório', {
        description: 'Digite um número de telefone válido'
      })
      return
    }

    // Validate phone format
    const phoneValidation = validatePhoneFormat(phoneNumber)
    if (!phoneValidation.isValid) {
      toast.error('Telefone inválido', {
        description: phoneValidation.error || 'Formato de telefone inválido'
      })
      return
    }

    setIsLoading(true)

    try {
      // Generate unique token
      const randomCode = `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`.toUpperCase()
      const userToken = `${phoneNumber}${randomCode}`

      // Prepare user data
      const userData = {
        name: instanceName,
        token: userToken,
        webhook: webhookUrl || '',
        events: 'Message', // Default to basic message events
        history: 0
      }

      // Create user via WuzAPI
      await wuzapi.createUser(userData)

      toast.success('Usuário criado com sucesso!', {
        description: `Usuário ${userData.name} foi criado`
      })

      // Clear form
      setInstanceName('')
      setPhoneNumber('')
      setWebhookUrl('')
      setIsVisible(false)

      // Call success callback
      onSuccess?.({
        name: userData.name,
        token: userToken,
        phone: phoneNumber
      })

    } catch (error: any) {
      console.error('Erro ao criar usuário:', error)
      toast.error('Erro ao criar usuário', {
        description: error.message || 'Tente novamente'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setInstanceName('')
    setPhoneNumber('')
    setWebhookUrl('')
    setIsVisible(false)
    onCancel?.()
  }

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        variant="outline"
        size="default"
        className={className}
      >
        <Plus className="h-4 w-4 mr-2" />
        Criar Usuário
      </Button>
    )
  }

  return (
    <Card className={`border-2 border-primary ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center text-foreground">
          <User className="h-5 w-5 mr-2 text-primary" />
          Criar Novo Usuário
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Instance Name */}
          <div className="space-y-2">
            <Label htmlFor="instanceName" className="text-sm font-medium">
              Nome da Instância <span className="text-destructive">*</span>
            </Label>
            <Input
              id="instanceName"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              required
              disabled={isLoading}
              className="h-10"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumber" className="text-sm font-medium flex items-center">
              <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
              Número de Telefone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              disabled={isLoading}
              placeholder="5521999999999"
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Apenas números, com código do país (ex: 5521999999999)
            </p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhookUrl" className="text-sm font-medium flex items-center">
              <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
              Webhook URL (Opcional)
            </Label>
            <Input
              id="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={isLoading}
              placeholder="https://example.com/webhook"
              className="h-10"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="h-10"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !instanceName || !phoneNumber}
              className="h-10"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Criar Usuário
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}