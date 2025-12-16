import { useState, useEffect } from 'react'
import { useAgentAuth } from '@/contexts/AgentAuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Circle, Users, Shield, Briefcase, Save, Loader2, Edit2, X, Image } from 'lucide-react'
import { toast } from 'sonner'
import { updateAvailability, updateAgentProfile } from '@/services/agent-auth'
import { CardHeaderWithIcon } from '@/components/ui-custom/CardHeaderWithIcon'
import { GradientCard, getIconClasses } from '@/components/ui-custom/GradientCard'
import { CardContent as GradientCardContent } from '@/components/ui/card'

export default function AgentProfilePage() {
  const { agent, account, permissions, checkAuth } = useAgentAuth()
  const [availability, setAvailability] = useState(agent?.availability || 'offline')
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(agent?.name || '')
  const [editAvatarUrl, setEditAvatarUrl] = useState(agent?.avatarUrl || '')
  const [isSaving, setIsSaving] = useState(false)

  // Sync edit fields when agent data changes
  useEffect(() => {
    if (agent) {
      setEditName(agent.name || '')
      setEditAvatarUrl(agent.avatarUrl || '')
      setAvailability(agent.availability || 'offline')
    }
  }, [agent])

  const handleAvailabilityChange = async (value: string) => {
    setIsUpdating(true)
    try {
      await updateAvailability(value as 'online' | 'busy' | 'offline')
      setAvailability(value)
      // Refresh agent data in context to sync all components (sidebar, header, etc.)
      await checkAuth()
      toast.success('Disponibilidade atualizada')
    } catch (error) {
      toast.error('Erro ao atualizar disponibilidade')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStartEdit = () => {
    setEditName(agent?.name || '')
    setEditAvatarUrl(agent?.avatarUrl || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditName(agent?.name || '')
    setEditAvatarUrl(agent?.avatarUrl || '')
    setIsEditing(false)
  }

  const handleSaveProfile = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      toast.error('Nome deve ter pelo menos 2 caracteres')
      return
    }

    // Validate URL if provided
    if (editAvatarUrl.trim()) {
      try {
        new URL(editAvatarUrl.trim())
      } catch {
        toast.error('URL do avatar inválida')
        return
      }
    }

    setIsSaving(true)
    try {
      await updateAgentProfile({
        name: editName.trim(),
        avatarUrl: editAvatarUrl.trim() || undefined
      })
      await checkAuth() // Refresh agent data
      setIsEditing(false)
      toast.success('Perfil atualizado com sucesso')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar perfil')
    } finally {
      setIsSaving(false)
    }
  }

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500'
      case 'busy': return 'text-yellow-500'
      case 'offline': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  const getAvailabilityBgColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'busy': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header with Avatar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="relative">
          {agent?.avatarUrl ? (
            <img 
              src={agent.avatarUrl} 
              alt={agent.name}
              className="h-24 w-24 rounded-2xl object-cover shadow-lg"
            />
          ) : (
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 shadow-lg shadow-orange-500/20">
              <User className="w-10 h-10 text-white" />
            </div>
          )}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${getAvailabilityBgColor(availability)} rounded-full border-3 border-background`} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{agent?.name || 'Meu Perfil'}</h1>
          <p className="text-muted-foreground">{agent?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">{agent?.role}</Badge>
            <Badge variant="outline" className={`${getAvailabilityColor(availability)}`}>
              <Circle className={`h-2 w-2 fill-current mr-1`} />
              {availability === 'online' && 'Online'}
              {availability === 'busy' && 'Ocupado'}
              {availability === 'offline' && 'Offline'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <GradientCard variant="blue">
          <GradientCardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getIconClasses('blue')}`}>
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Função</p>
                <p className="font-semibold">{agent?.role || '-'}</p>
              </div>
            </div>
          </GradientCardContent>
        </GradientCard>

        <GradientCard variant="green">
          <GradientCardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getIconClasses('green')}`}>
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Permissões</p>
                <p className="font-semibold">{permissions.length}</p>
              </div>
            </div>
          </GradientCardContent>
        </GradientCard>

        <GradientCard variant="purple">
          <GradientCardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getIconClasses('purple')}`}>
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conta</p>
                <p className="font-semibold truncate">{account?.name || '-'}</p>
              </div>
            </div>
          </GradientCardContent>
        </GradientCard>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeaderWithIcon 
          icon={User} 
          title="Informações do Perfil" 
          action={!isEditing ? {
            label: 'Editar',
            onClick: handleStartEdit,
            showChevron: false
          } : undefined}
        />
        <CardContent className="space-y-4">
          {isEditing ? (
            // Edit Mode
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                  <Input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={agent?.email || ''} disabled className="bg-muted/50" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Image className="h-3 w-3" />
                  URL do Avatar
                </Label>
                <Input 
                  value={editAvatarUrl} 
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://exemplo.com/avatar.jpg"
                  disabled={isSaving}
                />
                {editAvatarUrl && (
                  <div className="flex items-center gap-3 mt-2 p-2 border rounded-lg bg-muted/30">
                    <img 
                      src={editAvatarUrl} 
                      alt="Preview" 
                      className="h-12 w-12 rounded-lg object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Preview do avatar</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={isSaving}
                  className="flex-1 sm:flex-none"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            // View Mode
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                <Input value={agent?.name || ''} disabled className="bg-muted/50" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={agent?.email || ''} disabled className="bg-muted/50" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Função</Label>
                <Input value={agent?.role || ''} disabled className="bg-muted/50" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Disponibilidade</Label>
                <Select 
                  value={availability} 
                  onValueChange={handleAvailabilityChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <Circle className={`h-3 w-3 fill-current ${getAvailabilityColor(availability)}`} />
                        {availability === 'online' && 'Online'}
                        {availability === 'busy' && 'Ocupado'}
                        {availability === 'offline' && 'Offline'}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <Circle className="h-3 w-3 fill-current text-green-500" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="busy">
                      <div className="flex items-center gap-2">
                        <Circle className="h-3 w-3 fill-current text-yellow-500" />
                        Ocupado
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center gap-2">
                        <Circle className="h-3 w-3 fill-current text-gray-500" />
                        Offline
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeaderWithIcon icon={Users} title="Conta Vinculada" />
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Nome da Conta</Label>
            <Input value={account?.name || ''} disabled className="bg-muted/50" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Permissões</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
              {permissions.length === 0 ? (
                <span className="text-muted-foreground text-sm">Nenhuma permissão</span>
              ) : (
                permissions.map((perm) => (
                  <Badge key={perm} variant="outline" className="text-xs font-normal">
                    {perm}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
