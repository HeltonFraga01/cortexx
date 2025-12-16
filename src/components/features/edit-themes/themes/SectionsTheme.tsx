/**
 * Sections Theme
 * 
 * A layout that organizes fields into collapsible sections.
 * Good for forms with many fields that can be logically grouped.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Save, Loader2, FileText, Info, ChevronDown, ChevronUp } from 'lucide-react';
import RecordForm from '@/components/user/RecordForm';
import type { EditThemeProps } from '@/types/edit-themes';

export function SectionsThemeComponent({
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
  const [mainDataOpen, setMainDataOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 sm:pb-6">
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
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
          <div>
            <h1 className="text-2xl font-bold">{connection.name}</h1>
            <p className="text-sm text-muted-foreground">Editar registro</p>
          </div>
        </div>
        
        <Button 
          onClick={onSave} 
          disabled={saving || !hasChanges}
          className="w-full sm:w-auto hidden sm:flex"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      {/* Main Data Section */}
      <Collapsible open={mainDataOpen} onOpenChange={setMainDataOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Dados Principais</CardTitle>
                </div>
                {mainDataOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <RecordForm
                connection={connection}
                record={record}
                onRecordChange={onRecordChange}
                disabled={saving || disabled}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Info Section */}
      <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-lg">Informações do Registro</CardTitle>
                </div>
                {infoOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Conexão
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{connection.name}</p>
                    <p className="text-sm text-muted-foreground">{connection.type}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Tabela
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{connection.table_name}</p>
                  </CardContent>
                </Card>

                {(record.id || record.Id) && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        ID do Registro
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-sm">{record.id || record.Id}</p>
                    </CardContent>
                  </Card>
                )}

                {(record.created_at || record.CreatedAt) && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Criado em
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">
                        {new Date(record.created_at || record.CreatedAt).toLocaleString('pt-BR')}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Mobile Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 sm:hidden">
        <Button 
          onClick={onSave} 
          disabled={saving || !hasChanges}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {hasChanges ? 'Salvar Alterações' : 'Sem Alterações'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default SectionsThemeComponent;
