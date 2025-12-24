/**
 * SupabaseUserInfoCard
 * 
 * Displays and allows editing of Supabase Auth user info (email, phone, metadata).
 * Requirements: 2.1, 3.1, 4.1, 4.3
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { User, Mail, Phone, Calendar, Shield, Edit2, X, Check, Key, MailCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabaseUserService } from '@/services/supabase-user'
import type { SupabaseAuthUser } from '@/types/supabase-user'

interface SupabaseUserInfoCardProps {
  user: SupabaseAuthUser
  onUpdate: () => void
}

export function SupabaseUserInfoCard({ user, onUpdate }: SupabaseUserInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isConfirmingEmail, setIsConfirmingEmail] = useState(false)
  
  const [formData, setFormData] = useState({
    email: user.email || '',
    phone: user.phone || '',
    name: user.user_metadata?.name || ''
  })
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleString('pt-BR')
  }
  
  const handleSave = async () => {
    try {
      setIsSaving(true)
      await supabaseUserService.updateUser(user.id, {
        email: formData.email !== user.email ? formData.email : undefined,
        phone: formData.phone !== user.phone ? formData.phone : undefined,
        user_metadata: {
          ...user.user_metadata,
          name: formData.name
        }
      })
      toast.success('Usuário atualizado com sucesso')
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar usuário')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleCancel = () => {
    setFormData({
      email: user.email || '',
      phone: user.phone || '',
      name: user.user_metadata?.name || ''
    })
    setIsEditing(false)
  }
  
  const handleResetPassword = async (sendEmail: boolean) => {
    try {
      setIsResettingPassword(true)
      const result = await supabaseUserService.resetPassword(user.id, sendEmail)
      
      if (result.tempPassword) {
        toast.success(`Senha temporária: ${result.tempPassword}`, { duration: 10000 })
      } else {
        toast.success(result.message)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao resetar senha')
    } finally {
      setIsResettingPassword(false)
    }
  }
  
  const handleConfirmEmail = async () => {
    try {
      setIsConfirmingEmail(true)
      await supabaseUserService.confirmEmail(user.id)
      toast.success('Email confirmado com sucesso')
      onUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao confirmar email')
    } finally {
      setIsConfirmingEmail(false)
    }
  }
  
  const isEmailConfirmed = !!user.email_confirmed_at
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <User className="h-5 w-5" />
          Informações do Usuário
        </CardTitle>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar and Role */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-semibold text-primary">
              {(user.email?.[0] || 'U').toUpperCase()}
            </span>
          </div>
          <div>
            <Badge variant={user.user_metadata?.role === 'admin' ? 'default' : 'secondary'}>
              <Shield className="h-3 w-3 mr-1" />
              {user.user_metadata?.role || 'user'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">ID: {user.id.slice(0, 8)}...</p>
          </div>
        </div>
        
        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+55 11 99999-9999"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Info Display */}
            <div className="space-y-3 pt-2">
              {user.user_metadata?.name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{user.user_metadata.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email || 'Não informado'}</span>
                {isEmailConfirmed ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">Verificado</Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendente</Badge>
                )}
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Criado em:</span>
                <span>{formatDate(user.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Último login:</span>
                <span>{formatDate(user.last_sign_in_at)}</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleResetPassword(true)}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Key className="h-4 w-4 mr-1" />}
                Enviar Reset de Senha
              </Button>
              {!isEmailConfirmed && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleConfirmEmail}
                  disabled={isConfirmingEmail}
                >
                  {isConfirmingEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MailCheck className="h-4 w-4 mr-1" />}
                  Confirmar Email
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
