/**
 * Profile Card Theme
 * 
 * A card-based layout optimized for profile-like data with avatar support.
 * Features a prominent header card with key info and organized sections below.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Loader2, User } from 'lucide-react';
import RecordForm from '@/components/user/RecordForm';
import type { EditThemeProps } from '@/types/edit-themes';

/**
 * Try to find an avatar/image field from the record
 */
function findAvatarField(record: Record<string, any>): string | null {
  const avatarFieldNames = ['avatar', 'avatar_url', 'image', 'photo', 'picture', 'profile_image', 'foto', 'imagem'];
  
  for (const fieldName of avatarFieldNames) {
    const value = record[fieldName] || record[fieldName.toLowerCase()];
    if (value && typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:'))) {
      return value;
    }
  }
  
  return null;
}

/**
 * Try to find a name/title field from the record
 */
function findNameField(record: Record<string, any>): string {
  const nameFieldNames = ['name', 'nome', 'title', 'titulo', 'full_name', 'nome_completo', 'display_name'];
  
  for (const fieldName of nameFieldNames) {
    const value = record[fieldName] || record[fieldName.toLowerCase()];
    if (value && typeof value === 'string') {
      return value;
    }
  }
  
  return 'Registro';
}

/**
 * Try to find a status/badge field from the record
 */
function findStatusField(record: Record<string, any>): string | null {
  const statusFieldNames = ['status', 'estado', 'type', 'tipo', 'category', 'categoria', 'role', 'cargo'];
  
  for (const fieldName of statusFieldNames) {
    const value = record[fieldName] || record[fieldName.toLowerCase()];
    if (value && typeof value === 'string') {
      return value;
    }
  }
  
  return null;
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ProfileCardThemeComponent({
  connection,
  record,
  formData,
  onRecordChange,
  onSave,
  onBack,
  saving,
  disabled,
  hasChanges,
}: EditThemeProps) {
  const avatarUrl = findAvatarField(record);
  const name = findNameField(record);
  const status = findStatusField(record);
  const initials = getInitials(name);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Saving Overlay */}
      {saving && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-auto max-w-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-lg font-semibold">Salvando alterações...</p>
                  <p className="text-sm text-muted-foreground">Por favor, aguarde</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background shadow-lg">
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback className="text-2xl sm:text-3xl bg-primary/10">
                {avatarUrl ? <User className="h-12 w-12 text-muted-foreground" /> : initials}
              </AvatarFallback>
            </Avatar>
            
            {/* Info */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{name}</h1>
              <p className="text-muted-foreground">{connection.name}</p>
              {status && (
                <Badge variant="secondary" className="mt-2">
                  {status}
                </Badge>
              )}
            </div>

            {/* Save Button */}
            <Button 
              onClick={onSave} 
              disabled={saving || !hasChanges}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <RecordForm
            connection={connection}
            record={record}
            onRecordChange={onRecordChange}
            disabled={saving || disabled}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default ProfileCardThemeComponent;
