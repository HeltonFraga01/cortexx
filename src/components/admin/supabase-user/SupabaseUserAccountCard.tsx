/**
 * SupabaseUserAccountCard
 * 
 * Displays and allows editing of user account info (name, status, settings).
 * Requirements: 2.2, 3.2, 7.1
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Building2, Edit2, X, Check, Loader2, Globe, Languages, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabaseUserService } from '@/services/supabase-user'
import type { UserAccount } from '@/types/supabase-user'

interface SupabaseUserAccountCardProps {
  account: UserAccount | null
  userId: string
  onUpdate: () => void
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
  inactive: { label: 'Inativo', variant: 'secondary' }
}

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'UTC', label: 'UTC' }
]

const LOCALES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' }
]

export function SupabaseUserAccountCard({ account, userId, onUpdate }: SupabaseUserAccountCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuspending, setIsSuspending] = useState(false)
  
  const [formData, setFormData] = useState({
    name: account?.name || '',
    timezone: account?.timezone || 'America/Sao_Paulo',
    locale: account?.locale || 'pt-BR'
  })
  
  if (!account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Nenhuma conta vinculada a este usuário</span>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  const handleSave = async () => {
    try {
      setIsSaving(true)
      await supabaseUserService.updateAccount(userId, {
        name: formData.name,
        timezone: formData.timezone,
        locale: formData.locale
      })
      toast.success('Conta atualizada com sucesso')
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar conta')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleCancel = () => {
    setFormData({
      name: account.name || '',
      timezone: account.timezone || 'America/Sao_Paulo',
      locale: account.locale || 'pt-BR'
    })
    setIsEditing(false)
  }
  
  const handleToggleStatus = async () => {
    try {
      setIsSuspending(true)
      if (account.status === 'suspended') {
        await supabaseUserService.reactivateUser(userId)
        toast.success('Usuário reativado com sucesso')
      } else {
        await supabaseUserService.suspendUser(userId)
        toast.success('Usuário suspenso com sucesso')
      }
      onUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar status')
    } finally {
      setIsSuspending(false)
    }
  }
  
  const statusInfo = STATUS_LABELS[account.status] || STATUS_LABELS.inactive
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Conta
        </CardTitle>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={isSuspending}
          >
            {isSuspending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : account.status === 'suspended' ? (
              'Reativar'
            ) : (
              'Suspender'
            )}
          </Button>
        </div>
        
        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="accountName">Nome da Conta</Label>
              <Input
                id="accountName"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Fuso Horário</Label>
              <Select value={formData.timezone} onValueChange={v => setFormData({ ...formData, timezone: v })}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">Idioma</Label>
              <Select value={formData.locale} onValueChange={v => setFormData({ ...formData, locale: v })}>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map(loc => (
                    <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Nome:</span>
              <span>{account.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Fuso:</span>
              <span>{TIMEZONES.find(t => t.value === account.timezone)?.label || account.timezone || 'Não definido'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Idioma:</span>
              <span>{LOCALES.find(l => l.value === account.locale)?.label || account.locale || 'Não definido'}</span>
            </div>
            {account.wuzapi_token && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Token WUZAPI:</span>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{account.wuzapi_token.slice(0, 12)}...</code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
