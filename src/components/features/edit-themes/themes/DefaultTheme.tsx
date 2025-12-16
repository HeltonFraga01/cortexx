/**
 * Default Theme
 * 
 * The default edit page theme that maintains the current layout.
 * This theme is used when no custom theme is configured.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import RecordForm from '@/components/user/RecordForm';
import type { EditThemeProps } from '@/types/edit-themes';

export function DefaultThemeComponent({
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
  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {/* Saving Overlay */}
      {saving && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="saving-dialog-title"
          aria-describedby="saving-dialog-description"
        >
          <Card className="w-auto max-w-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden="true" />
                <div className="text-center">
                  <p id="saving-dialog-title" className="text-lg font-semibold">Salvando alterações...</p>
                  <p id="saving-dialog-description" className="text-sm text-muted-foreground">Por favor, aguarde</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            aria-label="Voltar ao dashboard"
            className="self-start sm:self-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            Voltar
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              Editar Registro - {connection.name}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Modifique as informações do seu registro
            </p>
          </div>
        </div>
        <Button 
          onClick={onSave} 
          disabled={saving || !hasChanges}
          aria-label={
            saving 
              ? "Salvando alterações" 
              : hasChanges 
                ? "Salvar alterações no registro" 
                : "Nenhuma alteração para salvar"
          }
          aria-disabled={saving || !hasChanges}
          className="w-full sm:w-auto"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              Salvar Alterações
            </>
          )}
        </Button>
      </header>

      {/* Record Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Dados do Registro</CardTitle>
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

export default DefaultThemeComponent;
