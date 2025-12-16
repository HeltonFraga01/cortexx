import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, Bell, Lock, Loader2, Volume2, MessageSquare, AtSign, MessagesSquare } from 'lucide-react'
import { toast } from 'sonner'
import { changePassword } from '@/services/agent-auth'
import { useAgentAuth } from '@/contexts/AgentAuthContext'
import { CardHeaderWithIcon } from '@/components/ui-custom/CardHeaderWithIcon'

export default function AgentSettingsPage() {
  const { agent } = useAgentAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // Notification settings (local state for now)
  const [notifications, setNotifications] = useState({
    newMessage: true,
    newConversation: true,
    mentions: true,
    sounds: true
  })

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres')
      return
    }

    setIsChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success('Senha alterada com sucesso')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar senha')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-3 shadow-lg shadow-purple-500/20">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Preferências de {agent?.name?.split(' ')[0] || 'usuário'}</p>
        </div>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeaderWithIcon 
          icon={Bell} 
          iconColor="text-orange-500"
          title="Notificações" 
        />
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MessageSquare className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <Label className="font-medium">Novas mensagens</Label>
                <p className="text-xs text-muted-foreground">Receber notificação de novas mensagens</p>
              </div>
            </div>
            <Switch
              checked={notifications.newMessage}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, newMessage: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MessagesSquare className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <Label className="font-medium">Novas conversas</Label>
                <p className="text-xs text-muted-foreground">Receber notificação de novas conversas atribuídas</p>
              </div>
            </div>
            <Switch
              checked={notifications.newConversation}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, newConversation: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <AtSign className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <Label className="font-medium">Menções</Label>
                <p className="text-xs text-muted-foreground">Receber notificação quando for mencionado</p>
              </div>
            </div>
            <Switch
              checked={notifications.mentions}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, mentions: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Volume2 className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <Label className="font-medium">Sons</Label>
                <p className="text-xs text-muted-foreground">Reproduzir sons de notificação</p>
              </div>
            </div>
            <Switch
              checked={notifications.sounds}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sounds: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeaderWithIcon 
          icon={Lock} 
          iconColor="text-red-500"
          title="Alterar Senha" 
        />
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleChangePassword} 
            disabled={isChangingPassword}
            className="w-full sm:w-auto"
          >
            {isChangingPassword ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Alterando...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Alterar Senha
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
